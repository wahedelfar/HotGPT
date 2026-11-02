// Leak check («كشف التسريب») evidence collection — free sources only
// (owner decision, 2026-11-03: launch on the free stack, upgrade when
// revenue exists).
//
// Email mode — XposedOrNot's keyless API:
//   GET /v1/check-email/{email}      → {"breaches":[[names…]]} or
//                                      {"Error":"Not found"} when clean
//   GET /v1/breach-analytics?email= → BreachMetrics (risk score,
//                                      password-strength mix, exposed
//                                      data classes with counts)
// Domain mode — two honest halves, because NO breach API enumerates a
// domain's individual emails to third parties (privacy by design):
//   XposedOrNot MCP domain_breach_summary (keyless) → exposure COUNTS
//     for the domain (addresses exposed, breach count, pastes, last seen)
//   Have I Been Pwned GET /api/v3/breaches?domain= (keyless) → breaches
//     of the domain's OWN service, with dates, sizes and data classes.
//
// Free-tier rate limits are per-IP (XposedOrNot: ~25 checks/hour), so
// results are cached in memory for 6 hours per target — breach data
// changes slowly, and a repeat check of the same target inside the
// window is served from cache instead of burning the shared quota.
// Every shape above was verified live on 2026-11-03 before this file
// was written. A source being unreachable returns null evidence for
// that half; BOTH halves failing (or the email check failing) returns
// null overall, and the handler refunds instead of inventing a report.

export type LeakEvidence = {
  kind: "email" | "domain";
  target: string;
  // email mode
  found?: boolean;
  breachNames?: string[];
  riskLabel?: string | null;
  riskScore?: number | null;
  passwordStrength?: unknown;
  exposedData?: Array<{ name: string; value: number }>;
  // domain mode
  domainSummary?: {
    exposedAddresses: number | null;
    breachCount: number | null;
    pastes: number | null;
    total: number | null;
    lastSeen: string | null;
  } | null;
  serviceBreaches?: Array<{
    name: string;
    date: string;
    accounts: number;
    dataClasses: string[];
    description: string;
  }>;
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const cache = new Map<string, { at: number; evidence: LeakEvidence }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.trim()) out.push(value.trim());
  } else if (Array.isArray(value)) {
    for (const item of value) flattenStrings(item, out);
  }
  return out;
}

function flattenExposedData(node: unknown, out: Array<{ name: string; value: number }> = []): Array<{ name: string; value: number }> {
  if (Array.isArray(node)) {
    for (const item of node) flattenExposedData(item, out);
  } else if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (typeof record.name === "string" && record.name.startsWith("data_") && typeof record.value === "number") {
      out.push({ name: record.name.replace(/^data_/, ""), value: record.value });
    }
    if (Array.isArray(record.children)) flattenExposedData(record.children, out);
  }
  return out;
}

async function fetchEmailEvidence(email: string): Promise<LeakEvidence | null> {
  try {
    const [checkRes, analyticsRes] = await Promise.all([
      fetch(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`, {
        headers: { "user-agent": BROWSER_UA },
        signal: AbortSignal.timeout(12000),
      }),
      fetch(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`, {
        headers: { "user-agent": BROWSER_UA },
        signal: AbortSignal.timeout(12000),
      }).catch(() => null),
    ]);
    if (!checkRes.ok) return null;
    const checkPayload: any = await checkRes.json().catch(() => null);
    if (!checkPayload) return null;
    if (checkPayload.Error) {
      // The API answered: this address is in no known breach.
      return { kind: "email", target: email, found: false, breachNames: [] };
    }
    const breachNames = [...new Set(flattenStrings(checkPayload.breaches))];
    const evidence: LeakEvidence = {
      kind: "email",
      target: email,
      found: breachNames.length > 0,
      breachNames,
    };
    if (analyticsRes && analyticsRes.ok) {
      const analytics: any = await analyticsRes.json().catch(() => null);
      const metrics = analytics?.BreachMetrics;
      if (metrics) {
        const risk = Array.isArray(metrics.risk) ? metrics.risk[0] : null;
        evidence.riskLabel = typeof risk?.risk_label === "string" ? risk.risk_label : null;
        evidence.riskScore = typeof risk?.risk_score === "number" ? risk.risk_score : null;
        evidence.passwordStrength = metrics.passwords_strength ?? null;
        evidence.exposedData = flattenExposedData(metrics.xposed_data).slice(0, 24);
      }
    }
    return evidence;
  } catch {
    return null;
  }
}

async function fetchDomainSummary(domain: string): Promise<LeakEvidence["domainSummary"]> {
  try {
    const response = await fetch("https://api.xposedornot.com/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "user-agent": BROWSER_UA,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "domain_breach_summary", arguments: { domain } },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    let text = await response.text();
    // The MCP endpoint may answer as plain JSON or SSE-framed.
    const dataLine = text.split(/\r?\n/).find(line => line.startsWith("data:"));
    if (dataLine) text = dataLine.slice(5).trim();
    const outer: any = JSON.parse(text);
    const innerText = outer?.result?.content?.[0]?.text;
    if (typeof innerText !== "string") return null;
    const inner: any = JSON.parse(innerText);
    const detail = inner?.sendDomains?.breaches_details?.[0];
    if (!detail) return null;
    const num = (value: unknown): number | null => (typeof value === "number" ? value : null);
    return {
      exposedAddresses: num(detail.breach_emails),
      breachCount: num(detail.breach_count),
      pastes: num(detail.breach_pastes),
      total: num(detail.breach_total),
      lastSeen: typeof detail.breach_last_seen === "string" ? detail.breach_last_seen : null,
    };
  } catch {
    return null;
  }
}

async function fetchServiceBreaches(domain: string): Promise<LeakEvidence["serviceBreaches"] | null> {
  try {
    const response = await fetch(`https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(domain)}`, {
      headers: { "user-agent": "HotGPT-LeakCheck" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const payload: any = await response.json().catch(() => null);
    if (!Array.isArray(payload)) return null;
    return payload.slice(0, 12).map((breach: any) => ({
      name: String(breach?.Title || breach?.Name || "unknown"),
      date: String(breach?.BreachDate || ""),
      accounts: typeof breach?.PwnCount === "number" ? breach.PwnCount : 0,
      dataClasses: Array.isArray(breach?.DataClasses) ? breach.DataClasses.map((c: unknown) => String(c)).slice(0, 12) : [],
      description: stripTags(String(breach?.Description || "")).slice(0, 320),
    }));
  } catch {
    return null;
  }
}

async function fetchDomainEvidence(domain: string): Promise<LeakEvidence | null> {
  const [summary, serviceBreaches] = await Promise.all([
    fetchDomainSummary(domain),
    fetchServiceBreaches(domain),
  ]);
  // Both sources silent = the check itself failed; refund upstream.
  if (summary === null && serviceBreaches === null) return null;
  return {
    kind: "domain",
    target: domain,
    domainSummary: summary,
    serviceBreaches: serviceBreaches ?? [],
  };
}

export async function fetchLeakEvidence(kind: "email" | "domain", target: string): Promise<LeakEvidence | null> {
  const key = `${kind}:${target}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.evidence;
  const evidence = kind === "email" ? await fetchEmailEvidence(target) : await fetchDomainEvidence(target);
  if (evidence) cache.set(key, { at: Date.now(), evidence });
  return evidence;
}
