// HotGPT URL security scan — real, non-intrusive, evidence-based.
//
// The collectors below run from the server and gather REAL data about a
// target the user supplies: HTTP response headers and cookies, the
// redirect chain, the TLS certificate, certificate-transparency
// subdomains (crt.sh), DNS + email-security records (SPF/DMARC via
// DNS-over-HTTPS), domain registration (RDAP), Wayback Machine history,
// and a short list of read-only probes for commonly exposed files
// (.env, .git, backups). Everything is ordinary HTTP/DNS traffic — the
// same requests a browser or curl would make. There is NO port
// scanning, NO login testing and NO active exploitation.
//
// The risk score is computed HERE, deterministically, from the findings
// — the model only narrates the evidence it is given, so a score can
// never be invented. SSRF guard: the target host (and every redirect
// hop) is resolved and rejected when it points at private, loopback,
// link-local or reserved addresses.

import { lookup } from "node:dns/promises";
import { connect as tlsConnect } from "node:tls";

const SCANNER_UA = "HotGPT-Scanner/1.0 (+https://hotgpt.pro)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ---------------------------------------------------------------- IPs / SSRF

function ipv4Private(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT shared space
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function ipv6Private(ip: string): boolean {
  const value = ip.toLowerCase().split("%")[0];
  if (value === "::1" || value === "::") return true;
  if (value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) return true; // link-local fe80::/10
  if (value.startsWith("fc") || value.startsWith("fd")) return true; // unique local fc00::/7
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]);
  return false;
}

function ipIsPrivate(ip: string): boolean {
  return ip.includes(":") ? ipv6Private(ip) : ipv4Private(ip);
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("target_not_public");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) {
    if (ipIsPrivate(host)) throw new Error("target_not_public");
    return;
  }
  const addresses = await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length) throw new Error("target_unresolvable");
  if (addresses.some((entry) => ipIsPrivate(entry.address))) throw new Error("target_not_public");
}

// ------------------------------------------------------------------- helpers

async function readBodyCapped(response: Response, cap: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < cap) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
  } catch {
    /* partial body is fine */
  } finally {
    try { await reader.cancel(); } catch { /* ignore */ }
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, cap).toString("utf8");
}

function setCookiesOf(response: Response): string[] {
  const getSetCookie = (response.headers as any).getSetCookie as (() => string[]) | undefined;
  if (typeof getSetCookie === "function") {
    try { return getSetCookie.call(response.headers); } catch { /* fall through */ }
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

type FetchOutcome = {
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  cookies: string[];
  chain: Array<{ url: string; status: number }>;
  body: string;
};

// GET with manual redirects; every hop is SSRF-validated before use.
async function fetchWithValidation(startUrl: URL, bodyCap: number, timeoutMs: number): Promise<FetchOutcome> {
  let current = new URL(startUrl.toString());
  const chain: Array<{ url: string; status: number }> = [];
  for (let hop = 0; hop <= 5; hop++) {
    await assertPublicHost(current.hostname);
    const response = await fetch(current.toString(), {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": BROWSER_UA, accept: "text/html,application/xhtml+xml,*/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    chain.push({ url: current.toString(), status: response.status });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location && hop < 5) {
      try { await response.body?.cancel(); } catch { /* ignore */ }
      current = new URL(location, current);
      if (current.protocol !== "http:" && current.protocol !== "https:") throw new Error("target_bad_redirect");
      continue;
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
    const body = await readBodyCapped(response, bodyCap);
    return { finalUrl: current.toString(), status: response.status, headers, cookies: setCookiesOf(response), chain, body };
  }
  throw new Error("target_too_many_redirects");
}

async function probePath(origin: string, path: string): Promise<{ path: string; status: number; body: string }> {
  try {
    const response = await fetch(`${origin}${path}`, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": SCANNER_UA },
      signal: AbortSignal.timeout(3500),
    });
    const body = response.status === 200 ? await readBodyCapped(response, 2048) : "";
    return { path, status: response.status, body };
  } catch {
    return { path, status: 0, body: "" };
  }
}

// ---------------------------------------------------------------- collectors

type TlsInfo = {
  authorized: boolean;
  protocol: string | null;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysLeft: number;
  san: string;
} | null;

async function collectTls(host: string): Promise<TlsInfo> {
  return await new Promise<TlsInfo>((resolve) => {
    let settled = false;
    const done = (value: TlsInfo) => { if (!settled) { settled = true; resolve(value); } };
    try {
      const socket = tlsConnect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 5000 }, () => {
        try {
          const cert: any = socket.getPeerCertificate();
          const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
          done({
            authorized: Boolean((socket as any).authorized),
            protocol: typeof socket.getProtocol === "function" ? socket.getProtocol() : null,
            issuer: String(cert?.issuer?.O || cert?.issuer?.CN || ""),
            subject: String(cert?.subject?.CN || ""),
            validFrom: String(cert?.valid_from || ""),
            validTo: String(cert?.valid_to || ""),
            daysLeft: validTo ? Math.floor((validTo.getTime() - Date.now()) / 86400000) : -1,
            san: String(cert?.subjectaltname || "").slice(0, 400),
          });
        } catch { done(null); }
        socket.end();
      });
      socket.on("timeout", () => { socket.destroy(); done(null); });
      socket.on("error", () => done(null));
    } catch { done(null); }
  });
}

async function collectCrtSh(host: string): Promise<string[]> {
  try {
    const response = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(host)}&output=json`, {
      headers: { "user-agent": SCANNER_UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const rows = await response.json() as any[];
    const names = new Set<string>();
    for (const row of Array.isArray(rows) ? rows : []) {
      for (const name of String(row?.name_value || "").split("\n")) {
        const clean = name.trim().toLowerCase().replace(/^\*\./, "");
        if (clean && clean.endsWith(host) && !clean.includes(" ")) names.add(clean);
      }
    }
    return [...names].slice(0, 50);
  } catch { return []; }
}

async function doh(name: string, type: string): Promise<string[]> {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { "user-agent": SCANNER_UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const data = await response.json() as any;
    return (Array.isArray(data?.Answer) ? data.Answer : []).map((a: any) => String(a?.data || "")).filter(Boolean);
  } catch { return []; }
}

async function collectRdap(host: string): Promise<{ created: string; registrar: string } | null> {
  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(host)}`, {
      headers: { "user-agent": SCANNER_UA, accept: "application/rdap+json" },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const data = await response.json() as any;
    const created = (Array.isArray(data?.events) ? data.events : []).find((e: any) => e?.eventAction === "registration")?.eventDate || "";
    let registrar = "";
    for (const entity of Array.isArray(data?.entities) ? data.entities : []) {
      if (!(entity?.roles || []).includes("registrar")) continue;
      const vcard = entity?.vcardArray?.[1];
      const fn = (Array.isArray(vcard) ? vcard : []).find((entry: any) => entry?.[0] === "fn");
      if (fn) registrar = String(fn[3] || "");
    }
    return { created: String(created).slice(0, 10), registrar };
  } catch { return null; }
}

async function collectWayback(host: string): Promise<{ earliest: string; latest: string } | null> {
  const one = async (limit: string): Promise<string> => {
    try {
      const response = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}&output=json&fl=timestamp&limit=${limit}`, {
        headers: { "user-agent": SCANNER_UA },
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) return "";
      const rows = await response.json() as any[];
      const ts = Array.isArray(rows) && rows.length > 1 ? String(rows[1]?.[0] || "") : "";
      return ts.length >= 8 ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : "";
    } catch { return ""; }
  };
  const [earliest, latest] = await Promise.all([one("1"), one("-1")]);
  if (!earliest && !latest) return null;
  return { earliest, latest };
}

// --------------------------------------------------------------------- scan

export type ScanFlag = { severity: "critical" | "high" | "medium" | "low" | "info"; title: string; evidence: string };
export type UrlScan = {
  target: string;
  host: string;
  reachable: boolean;
  fatal?: string;
  score: number;
  grade: string;
  flags: ScanFlag[];
  passed: string[];
  details: Record<string, unknown>;
};

const SENSITIVE_PROBES: Array<{ path: string; verify?: (body: string) => boolean }> = [
  { path: "/.env", verify: (b) => /(^|\n)[A-Z][A-Z0-9_]{2,}\s*=\s*\S+/.test(b) },
  { path: "/.env.bak" },
  { path: "/.git/HEAD", verify: (b) => b.startsWith("ref:") || /^[0-9a-f]{40}/.test(b.trim()) },
  { path: "/.git/config", verify: (b) => b.includes("[core]") || b.includes("repositoryformatversion") },
  { path: "/.svn/entries" },
  { path: "/.DS_Store" },
  { path: "/phpinfo.php", verify: (b) => /phpinfo\(\)|PHP Version/i.test(b) },
  { path: "/info.php", verify: (b) => /phpinfo\(\)|PHP Version/i.test(b) },
  { path: "/.aws/credentials", verify: (b) => /aws_access_key_id/i.test(b) },
  { path: "/server-status", verify: (b) => /Apache Server Status/i.test(b) },
  { path: "/actuator/env", verify: (b) => /propertySources|activeProfiles/.test(b) },
  { path: "/backup.zip" },
  { path: "/db.sql", verify: (b) => /CREATE TABLE|INSERT INTO/i.test(b) },
  { path: "/wp-config.php.bak" },
  { path: "/config.json" },
  { path: "/.npmrc", verify: (b) => /_authToken|registry=/.test(b) },
];

export async function runUrlScan(rawInput: string): Promise<UrlScan> {
  const raw = String(rawInput || "").trim().slice(0, 500);
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try { parsed = new URL(withScheme); } catch { return dead(raw, "invalid_url"); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return dead(raw, "invalid_url");
  if (!parsed.hostname || !parsed.hostname.includes(".")) return dead(raw, "invalid_url");
  parsed.username = "";
  parsed.password = "";
  const host = parsed.hostname.toLowerCase();
  const target = parsed.toString();

  try {
    await assertPublicHost(host);
  } catch (error) {
    return dead(target, error instanceof Error ? error.message : "target_not_public");
  }

  const origin = `${parsed.protocol}//${parsed.host}`;
  const httpsOrigin = `https://${parsed.host}`;

  const [mainResult, httpProbe, tls, subdomains, aRecords, mxRecords, txtRecords, dmarcRecords, rdap, wayback] = await Promise.allSettled([
    fetchWithValidation(parsed, 256 * 1024, 9000),
    (async () => {
      try {
        const r = await fetch(`http://${parsed.host}/`, { redirect: "manual", headers: { "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(5000) });
        try { await r.body?.cancel(); } catch { /* ignore */ }
        return { status: r.status, location: r.headers.get("location") || "" };
      } catch { return { status: 0, location: "" }; }
    })(),
    collectTls(host),
    collectCrtSh(host),
    doh(host, "A"),
    doh(host, "MX"),
    doh(host, "TXT"),
    doh(`_dmarc.${host}`, "TXT"),
    collectRdap(host),
    collectWayback(host),
  ]);

  const main = mainResult.status === "fulfilled" ? mainResult.value : null;
  if (!main) return { ...dead(target, "target_unreachable"), host };

  const finalUrl = new URL(main.finalUrl);
  const usesHttps = finalUrl.protocol === "https:";
  const httpCheck = httpProbe.status === "fulfilled" ? httpProbe.value : { status: 0, location: "" };
  const httpRedirectsToHttps = httpCheck.status >= 300 && httpCheck.status < 400 && httpCheck.location.startsWith("https://");
  const tlsInfo = tls.status === "fulfilled" ? tls.value : null;
  const subs = subdomains.status === "fulfilled" ? subdomains.value : [];
  const txt = txtRecords.status === "fulfilled" ? txtRecords.value : [];
  const dmarc = dmarcRecords.status === "fulfilled" ? dmarcRecords.value : [];
  const spf = txt.find((t) => /v=spf1/i.test(t)) || "";
  const dmarcRecord = dmarc.find((t) => /v=DMARC1/i.test(t)) || "";
  const dmarcPolicy = (dmarcRecord.match(/p\s*=\s*(none|quarantine|reject)/i)?.[1] || "").toLowerCase();

  // Probes run against the FINAL origin (after redirects, same host only).
  const finalOrigin = `${finalUrl.protocol}//${finalUrl.host}`;
  const probeResults = await Promise.all(SENSITIVE_PROBES.map((p) => probePath(finalOrigin, p.path)));
  const robots = await probePath(finalOrigin, "/robots.txt");
  const securityTxt = await probePath(finalOrigin, "/.well-known/security.txt");
  // SPA catch-all detection: single-page apps (Vercel/Netlify rewrites)
  // answer EVERY path — including nonsense ones — with 200 + the app
  // shell, which would make every probe look "accessible". A canary
  // path that cannot exist exposes the fallback: any probe whose body
  // is byte-identical to the canary's body IS the shell, not a file.
  const canary = await probePath(finalOrigin, "/hotgpt-probe-8f4d2c-nonexistent");
  const fallbackBody = canary.status === 200 && canary.body ? canary.body : null;
  const robotsStatus = fallbackBody && robots.body === fallbackBody ? 404 : robots.status;
  const securityStatus = fallbackBody && securityTxt.body === fallbackBody ? 404 : securityTxt.status;

  const headers = main.headers;
  const body = main.body || "";
  const flags: ScanFlag[] = [];
  const passed: string[] = [];
  let score = 100;
  const deduct = (points: number) => { score -= points; };

  if (!usesHttps) { flags.push({ severity: "critical", title: "الموقع لا يستخدم HTTPS", evidence: `الرابط النهائي: ${main.finalUrl}` }); deduct(25); }
  else passed.push("الموقع يعمل عبر HTTPS");
  if (usesHttps && !httpRedirectsToHttps && httpCheck.status === 200) {
    flags.push({ severity: "medium", title: "نسخة HTTP لا تُحوّل إلى HTTPS تلقائيًا", evidence: `طلب http://${host}/ رجع 200 بدون تحويل` });
    deduct(10);
  }
  if (tlsInfo) {
    if (tlsInfo.daysLeft < 0) { flags.push({ severity: "critical", title: "شهادة TLS منتهية", evidence: `انتهت في ${tlsInfo.validTo}` }); deduct(30); }
    else if (tlsInfo.daysLeft <= 14) { flags.push({ severity: "medium", title: "شهادة TLS تنتهي قريبًا", evidence: `متبقي ${tlsInfo.daysLeft} يوم (تنتهي ${tlsInfo.validTo})` }); deduct(8); }
    else passed.push(`شهادة TLS سارية حتى ${tlsInfo.validTo} (${tlsInfo.daysLeft} يوم)`);
    if (!tlsInfo.authorized) { flags.push({ severity: "high", title: "سلسلة ثقة الشهادة غير مكتملة أو موقعة ذاتيًا", evidence: `المُصدر: ${tlsInfo.issuer || "غير معروف"}` }); deduct(15); }
  }

  const has = (name: string) => typeof headers[name] === "string" && headers[name].length > 0;
  if (usesHttps && !has("strict-transport-security")) { flags.push({ severity: "medium", title: "غياب HSTS", evidence: "لا يوجد ترويسة Strict-Transport-Security في الرد" }); deduct(8); }
  if (usesHttps && has("strict-transport-security")) passed.push("HSTS مفعّل");
  if (!has("content-security-policy")) { flags.push({ severity: "medium", title: "غياب Content-Security-Policy", evidence: "لا توجد ترويسة CSP في الرد" }); deduct(8); }
  else passed.push("Content-Security-Policy موجودة");
  const frameProtected = has("x-frame-options") || /frame-ancestors/i.test(headers["content-security-policy"] || "");
  if (!frameProtected) { flags.push({ severity: "medium", title: "لا حماية من Clickjacking", evidence: "غياب X-Frame-Options و frame-ancestors" }); deduct(6); }
  if (!/nosniff/i.test(headers["x-content-type-options"] || "")) { flags.push({ severity: "low", title: "غياب X-Content-Type-Options: nosniff", evidence: "الترويسة غير موجودة أو بقيمة مختلفة" }); deduct(4); }
  if (!has("referrer-policy")) { flags.push({ severity: "low", title: "غياب Referrer-Policy", evidence: "الترويسة غير موجودة" }); deduct(3); }
  if (!has("permissions-policy")) { flags.push({ severity: "low", title: "غياب Permissions-Policy", evidence: "الترويسة غير موجودة" }); deduct(2); }

  let cookieIssues = 0;
  for (const rawCookie of main.cookies) {
    const name = (rawCookie.split("=")[0] || "cookie").trim();
    if (usesHttps && !/;\s*secure/i.test(rawCookie)) { flags.push({ severity: "medium", title: `كوكيز بدون Secure: ${name}`, evidence: rawCookie.slice(0, 160) }); deduct(4); cookieIssues++; }
    if (!/;\s*httponly/i.test(rawCookie)) { flags.push({ severity: "low", title: `كوكيز بدون HttpOnly: ${name}`, evidence: rawCookie.slice(0, 160) }); deduct(3); }
    if (!/;\s*samesite/i.test(rawCookie)) { flags.push({ severity: "low", title: `كوكيز بدون SameSite: ${name}`, evidence: rawCookie.slice(0, 160) }); deduct(2); }
    if (cookieIssues > 6) break;
  }
  if (main.cookies.length && !flags.some((f) => f.title.startsWith("كوكيز"))) passed.push("إعدادات الكوكيز سليمة");

  const serverHeader = headers["server"] || "";
  if (/\d+\.\d+/.test(serverHeader) || /\d+\.\d+/.test(headers["x-powered-by"] || "")) {
    flags.push({ severity: "low", title: "تسريب إصدار الخادم", evidence: `Server: ${serverHeader || "(فارغ)"} · X-Powered-By: ${headers["x-powered-by"] || "(فارغ)"}` });
    deduct(4);
  }

  let verifiedExposures = 0;
  let suspicious = 0;
  probeResults.forEach((result, index) => {
    if (result.status !== 200) return;
    const probe = SENSITIVE_PROBES[index];
    const verified = probe.verify ? probe.verify(result.body) : false;
    if (!verified && fallbackBody !== null && result.body === fallbackBody) return; // SPA shell, not a real file
    if (verified) {
      verifiedExposures++;
      flags.push({ severity: "critical", title: `ملف حساس مكشوف فعليًا: ${result.path}`, evidence: `HTTP 200 ومحتوى مؤكد — بداية المحتوى: ${result.body.slice(0, 90).replace(/\s+/g, " ")}` });
    } else {
      suspicious++;
      flags.push({ severity: "high", title: `مسار حساس قابل للوصول (يحتاج تحققًا يدويًا): ${result.path}`, evidence: "HTTP 200 بدون تحقق تلقائي من المحتوى" });
    }
  });
  deduct(Math.min(50, verifiedExposures * 35));
  deduct(Math.min(16, suspicious * 8));
  if (!verifiedExposures && !suspicious) passed.push("لا ملفات حساسة مكشوفة في المسارات المفحوصة");

  if (/Index of \//i.test(body)) { flags.push({ severity: "high", title: "قائمة ملفات المجلد مفتوحة (Directory Listing)", evidence: "صفحة «Index of /» ظاهرة في الرد" }); deduct(15); }

  const mixedCount = usesHttps ? (body.match(/(?:src|href)\s*=\s*"http:\/\//gi) || []).length : 0;
  if (mixedCount > 0) { flags.push({ severity: "medium", title: "محتوى مختلط (Mixed Content)", evidence: `${mixedCount} عنصر يُحمّل عبر HTTP داخل صفحة HTTPS` }); deduct(6); }

  const isWordPress = /wp-content|wp-includes/i.test(body);
  const wpVersion = body.match(/<meta name="generator" content="WordPress ([\d.]+)"/i)?.[1] || "";
  if (isWordPress && wpVersion) { flags.push({ severity: "low", title: "إصدار WordPress معلن", evidence: `WordPress ${wpVersion} ظاهر في وسم generator` }); deduct(3); }

  if (!spf) { flags.push({ severity: "medium", title: "لا يوجد سجل SPF", evidence: "لا يوجد TXT يبدأ بـ v=spf1 على الدومين" }); deduct(6); }
  else passed.push("سجل SPF موجود");
  if (!dmarcRecord) { flags.push({ severity: "medium", title: "لا يوجد سجل DMARC", evidence: "لا يوجد سجل على _dmarc — انتحال الإيميل أسهل" }); deduct(8); }
  else if (dmarcPolicy === "none") { flags.push({ severity: "low", title: "سياسة DMARC على المراقبة فقط (p=none)", evidence: dmarcRecord.slice(0, 140) }); deduct(4); }
  else passed.push(`DMARC موجود بسياسة ${dmarcPolicy || "غير محددة"}`);

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";

  const details: Record<string, unknown> = {
    finalUrl: main.finalUrl,
    httpStatus: main.status,
    redirectChain: main.chain,
    usesHttps,
    httpRedirectsToHttps,
    tls: tlsInfo,
    server: serverHeader || null,
    poweredBy: headers["x-powered-by"] || null,
    headersPresent: Object.keys(headers).filter((h) => ["strict-transport-security", "content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy"].includes(h)),
    cookiesCount: main.cookies.length,
    wordpress: isWordPress ? (wpVersion || "detected") : null,
    mixedContentCount: mixedCount,
    subdomains: subs,
    dns: { a: aRecords.status === "fulfilled" ? aRecords.value.slice(0, 6) : [], mx: mxRecords.status === "fulfilled" ? mxRecords.value.slice(0, 6) : [], spf: spf || null, dmarc: dmarcRecord || null },
    rdap: rdap.status === "fulfilled" ? rdap.value : null,
    wayback: wayback.status === "fulfilled" ? wayback.value : null,
    robotsTxt: robotsStatus === 200 ? "present" : robotsStatus === 404 ? "missing" : `status ${robotsStatus}`,
    securityTxt: securityStatus === 200 ? "present" : "missing",
    probesChecked: SENSITIVE_PROBES.length,
    scannedAt: new Date().toISOString(),
  };

  return { target, host, reachable: true, score, grade, flags, passed, details };
}

function dead(target: string, fatal: string): UrlScan {
  return { target, host: "", reachable: false, fatal, score: 0, grade: "F", flags: [], passed: [], details: {} };
}

// Compact Arabic evidence block for the report writer. Every line is a
// fact collected above — the model narrates, it does not discover.
export function scanFindingsText(scan: UrlScan): string {
  const d = scan.details as any;
  let scanWhen = "";
  try {
    scanWhen = new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "full", timeStyle: "short" }).format(d.scannedAt ? new Date(d.scannedAt) : new Date());
  } catch { scanWhen = d.scannedAt || ""; }
  const lines: string[] = [
    `تاريخ ووقت الفحص: ${scanWhen} (توقيت القاهرة)`,
    `الهدف: ${scan.target}`,
    `الرابط النهائي بعد التحويلات: ${d.finalUrl} (HTTP ${d.httpStatus})`,
    `سلسلة التحويل: ${(d.redirectChain || []).map((hop: any) => `${hop.status}`).join(" ← ") || "بدون تحويل"}`,
    `درجة الأمان المحسوبة من السيرفر: ${scan.score}/100 — التقييم: ${scan.grade}`,
    "",
    "== النتائج المؤكدة بالأدلة ==",
    ...(scan.flags.length
      ? scan.flags.map((f) => `- [${f.severity}] ${f.title} — الدليل: ${f.evidence}`)
      : ["- لا نتائج سلبية مؤكدة في هذا الفحص"]),
    "",
    "== نقاط سليمة تم التحقق منها ==",
    ...(scan.passed.length ? scan.passed.map((p) => `- ${p}`) : ["- لا شيء يذكر"]),
    "",
    "== بيانات خام داعمة ==",
    `الخادم: ${d.server || "غير معلن"} · X-Powered-By: ${d.poweredBy || "غير معلن"} · WordPress: ${d.wordpress || "غير مكتشف"}`,
    d.tls ? `شهادة TLS: المُصدر ${d.tls.issuer} · البروتوكول ${d.tls.protocol || "?"} · صالحة من ${d.tls.validFrom} إلى ${d.tls.validTo} (متبقي ${d.tls.daysLeft} يوم) · سلسلة الثقة سليمة: ${d.tls.authorized ? "نعم" : "لا"} · تواريخ الشهادة كما هي مسجلة بتوقيت UTC` : "شهادة TLS: لا بيانات (الموقع قد لا يدعم HTTPS)",
    `النطاقات الفرعية من سجلات الشهادات (${(d.subdomains || []).length}): ${(d.subdomains || []).slice(0, 30).join("، ") || "لا شيء"}`,
    `DNS: A=${(d.dns?.a || []).join("، ") || "—"} · MX=${(d.dns?.mx || []).join("، ") || "—"}`,
    `أمان الإيميل: SPF=${d.dns?.spf ? "موجود" : "غائب"} · DMARC=${d.dns?.dmarc || "غائب"}`,
    d.rdap ? `تسجيل الدومين: ${d.rdap.created || "غير معروف"} (التاريخ كما هو مسجل بتوقيت UTC) · المسجّل: ${d.rdap.registrar || "غير معروف"}` : "تسجيل الدومين: غير متاح",
    d.wayback ? `أرشيف الإنترنت: أول لقطة ${d.wayback.earliest || "—"} · أحدث لقطة ${d.wayback.latest || "—"}` : "أرشيف الإنترنت: لا لقطات",
    `robots.txt: ${d.robotsTxt} · security.txt: ${d.securityTxt} · عدد المسارات الحساسة المفحوصة: ${d.probesChecked}`,
    `كوكيز مضبوطة في الرد: ${d.cookiesCount} · عناصر محتوى مختلط: ${d.mixedContentCount}`,
  ];
  return lines.join("\n").slice(0, 9500);
}
