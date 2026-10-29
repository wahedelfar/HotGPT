// HotGPT SEO audit — real, evidence-based, on-page + technical.
//
// Twin of server/urlScan.ts, built for the same «تقارير الروابط»
// premium family: the user pastes a website URL, the server collects
// REAL data about the homepage (HTML meta, headings, links, images,
// structured data, robots.txt, sitemap, response timing and size),
// computes a deterministic SEO score HERE, and a dedicated writer
// model turns the evidence into a professional Arabic report with a
// practical growth plan.
//
// Honest limits (stated in every report): no paid SEO APIs are used,
// so there are NO keyword search volumes, NO backlink counts, NO real
// Google rankings and NO competitor data in v1 — and no Core Web
// Vitals field data (that needs the CrUX API / a headless browser).
// Everything reported here was actually fetched and measured.
//
// SSRF guard mirrors urlScan.ts: the target host (and every redirect
// hop, plus robots/sitemap fetches) is resolved and rejected when it
// points at private, loopback, link-local or reserved addresses.

import { lookup } from "node:dns/promises";

const AUDIT_UA = "HotGPT-SEOAudit/1.0 (+https://hotgpt.pro)";
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
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function ipv6Private(ip: string): boolean {
  const value = ip.toLowerCase().split("%")[0];
  if (value === "::1" || value === "::") return true;
  if (value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
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

type FetchOutcome = {
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  chain: Array<{ url: string; status: number }>;
  body: string;
  elapsedMs: number;
};

// GET with manual redirects; every hop is SSRF-validated before use.
async function fetchWithValidation(startUrl: URL, bodyCap: number, timeoutMs: number): Promise<FetchOutcome> {
  let current = new URL(startUrl.toString());
  const chain: Array<{ url: string; status: number }> = [];
  const started = Date.now();
  for (let hop = 0; hop <= 5; hop++) {
    await assertPublicHost(current.hostname);
    const response = await fetch(current.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": BROWSER_UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-encoding": "gzip, br",
        "accept-language": "ar,en;q=0.8",
      },
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
    return { finalUrl: current.toString(), status: response.status, headers, chain, body, elapsedMs: Date.now() - started };
  }
  throw new Error("target_too_many_redirects");
}

// Small auxiliary fetch (robots.txt / sitemap). Returns null on any
// failure so a missing aux file never fails the whole audit.
async function fetchAux(url: string, bodyCap: number, timeoutMs: number): Promise<FetchOutcome | null> {
  try {
    return await fetchWithValidation(new URL(url), bodyCap, timeoutMs);
  } catch {
    return null;
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_m, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " ";
    });
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeEntities((match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim());
}

// ------------------------------------------------------------ HTML analysis

type HtmlAnalysis = {
  title: string;
  titleLength: number;
  description: string;
  descriptionLength: number;
  canonical: string;
  metaRobots: string;
  hasViewport: boolean;
  charset: string;
  lang: string;
  og: Record<string, string>;
  twitterCard: string;
  hasFavicon: boolean;
  h1: string[];
  h2Count: number;
  h3Count: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  imagesEmptyAlt: number;
  internalLinks: number;
  externalLinks: number;
  totalLinks: number;
  scriptCount: number;
  stylesheetCount: number;
  jsonLdTypes: string[];
  wordCount: number;
};

function analyzeHtml(html: string, finalUrl: URL): HtmlAnalysis {
  const headHtml = (() => {
    const idx = html.toLowerCase().indexOf("</head>");
    return idx >= 0 ? html.slice(0, idx) : html.slice(0, 60000);
  })();

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : "";

  // Meta tags: build name/property -> content maps.
  const metaByName = new Map<string, string>();
  const metaByProperty = new Map<string, string>();
  let charset = "";
  let hasViewport = false;
  const metaTags = headHtml.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const cs = attr(tag, "charset");
    if (cs) charset = cs.toLowerCase();
    const httpEquiv = attr(tag, "http-equiv").toLowerCase();
    if (httpEquiv === "content-type") {
      const content = attr(tag, "content");
      const m = content.match(/charset\s*=\s*([^\s;]+)/i);
      if (m && !charset) charset = m[1].toLowerCase();
    }
    const name = attr(tag, "name").toLowerCase();
    const property = attr(tag, "property").toLowerCase();
    const content = attr(tag, "content");
    if (name) metaByName.set(name, content);
    if (property) metaByProperty.set(property, content);
    if (name === "viewport") hasViewport = true;
  }

  const description = metaByName.get("description") || "";
  const metaRobots = metaByName.get("robots") || "";

  let canonical = "";
  let hasFavicon = false;
  let stylesheetCount = 0;
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    const rel = attr(tag, "rel").toLowerCase();
    if (rel === "canonical") canonical = attr(tag, "href");
    if (/(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/.test(rel)) hasFavicon = true;
    if (rel === "stylesheet") stylesheetCount++;
  }

  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || "";
  const lang = attr(htmlTag, "lang").toLowerCase();

  const og: Record<string, string> = {};
  for (const key of ["og:title", "og:description", "og:image", "og:type", "og:url"]) {
    const value = metaByProperty.get(key) || "";
    if (value) og[key] = value;
  }
  const twitterCard = metaByName.get("twitter:card") || "";

  const headingTexts = (tag: string): string[] => {
    const out: string[] = [];
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(html))) {
      const text = stripTags(match[1]);
      if (text) out.push(text.slice(0, 160));
    }
    return out;
  };
  const h1 = headingTexts("h1");
  const h2Count = (html.match(/<h2\b/gi) || []).length;
  const h3Count = (html.match(/<h3\b/gi) || []).length;

  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  let imagesMissingAlt = 0;
  let imagesEmptyAlt = 0;
  for (const tag of imgTags) {
    if (!/\balt\s*=/i.test(tag)) imagesMissingAlt++;
    else if (!attr(tag, "alt")) imagesEmptyAlt++;
  }

  let internalLinks = 0;
  let externalLinks = 0;
  let totalLinks = 0;
  const anchorTags = html.match(/<a\b[^>]*>/gi) || [];
  for (const tag of anchorTags) {
    const href = attr(tag, "href");
    if (!href || href.startsWith("#") || /^(javascript:|mailto:|tel:)/i.test(href)) continue;
    totalLinks++;
    try {
      const resolved = new URL(href, finalUrl);
      if (resolved.hostname.toLowerCase() === finalUrl.hostname.toLowerCase()) internalLinks++;
      else if (resolved.protocol === "http:" || resolved.protocol === "https:") externalLinks++;
    } catch { /* unparseable href — counted in total only */ }
  }

  const scriptCount = (html.match(/<script\b[^>]*\bsrc\s*=/gi) || []).length;

  const jsonLdTypes: string[] = [];
  const ldRe = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch: RegExpExecArray | null;
  const collectTypes = (node: unknown, acc: string[]) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((n) => collectTypes(n, acc)); return; }
    const record = node as Record<string, unknown>;
    const type = record["@type"];
    if (typeof type === "string") acc.push(type);
    if (Array.isArray(type)) type.forEach((t) => { if (typeof t === "string") acc.push(t); });
    if (record["@graph"]) collectTypes(record["@graph"], acc);
  };
  while ((ldMatch = ldRe.exec(html))) {
    try {
      const parsed = JSON.parse(ldMatch[1].trim());
      collectTypes(parsed, jsonLdTypes);
    } catch { jsonLdTypes.push("(بيانات منظمة غير صالحة JSON)"); }
  }

  const visibleText = stripTags(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " "),
  );
  const wordCount = visibleText ? visibleText.split(/\s+/).filter(Boolean).length : 0;

  return {
    title,
    titleLength: title.length,
    description,
    descriptionLength: description.length,
    canonical,
    metaRobots,
    hasViewport,
    charset,
    lang,
    og,
    twitterCard,
    hasFavicon,
    h1,
    h2Count,
    h3Count,
    imagesTotal: imgTags.length,
    imagesMissingAlt,
    imagesEmptyAlt,
    internalLinks,
    externalLinks,
    totalLinks,
    scriptCount,
    stylesheetCount,
    jsonLdTypes: [...new Set(jsonLdTypes)].slice(0, 12),
    wordCount,
  };
}

// --------------------------------------------------------------------- audit

export type SeoFlag = { severity: "critical" | "high" | "medium" | "low" | "info"; title: string; evidence: string };
export type SeoAudit = {
  target: string;
  host: string;
  reachable: boolean;
  fatal?: string;
  score: number;
  grade: string;
  flags: SeoFlag[];
  passed: string[];
  details: Record<string, unknown>;
};

function dead(target: string, fatal: string): SeoAudit {
  return { target, host: "", reachable: false, fatal, score: 0, grade: "F", flags: [], passed: [], details: {} };
}


async function googleSiteSearch(query: string): Promise<{ checked: boolean; resultCount: number; html: string }> {
  try {
    const url = new URL("https://www.google.com/search");
    url.searchParams.set("q", query);
    url.searchParams.set("num", "10");
    const response = await fetch(url.toString(), { headers: { "user-agent": BROWSER_UA, accept: "text/html" }, signal: AbortSignal.timeout(8000), redirect: "follow" });
    if (!response.ok) return { checked: false, resultCount: 0, html: "" };
    const html = (await response.text()).slice(0, 250000);
    if (/unusual traffic|captcha|sorry\/index|our systems have detected/i.test(html)) return { checked: false, resultCount: 0, html: "" };
    return { checked: true, resultCount: (html.match(/<h3\b/gi) || []).length, html };
  } catch { return { checked: false, resultCount: 0, html: "" }; }
}

async function collectIndexingData(host: string, metaRobots: string, robotsBlocksAll: boolean, robotsTxt: string, sitemap: string) {
  const base = host.replace(/^www\./, "").split(".")[0];
  const tlds = ["com", "ai", "net", "org"].filter((tld) => !host.endsWith("." + tld));
  const candidates = tlds.slice(0, 3).map((tld) => base + "." + tld).filter((candidate) => candidate !== host);
  // These lookups are independent. Run them concurrently so optional Google
  // checks cannot consume 30+ seconds of the paid audit's 60-second budget.
  const [primary, ...similarResults] = await Promise.all([
    googleSiteSearch("site:" + host),
    ...candidates.map((candidate) => googleSiteSearch("site:" + candidate)),
  ]);
  let similarDomain: { domain: string; resultCount: number } | null = null;
  for (let i = 0; i < similarResults.length; i++) {
    const found = similarResults[i];
    if (found.checked && found.resultCount > 0) {
      similarDomain = { domain: candidates[i], resultCount: found.resultCount };
      break;
    }
  }
  const reasons: string[] = [];
  if (/noindex/i.test(metaRobots)) reasons.push("وسم meta robots يحتوي على noindex");
  if (robotsBlocksAll) reasons.push("robots.txt يمنع زحف الموقع بالكامل");
  if (similarDomain) reasons.push("ظهرت نتائج للنطاق المشابه " + similarDomain.domain + "؛ يلزم التحقق يدويًا من احتمال الالتباس");
  if (!reasons.length && primary.checked && primary.resultCount === 0) reasons.push("لم تظهر نتائج لاستعلام site:؛ الفحص الخارجي لا يحدد سبب عدم الظهور");
  return { isIndexed: primary.checked ? primary.resultCount > 0 : null, searchCheckCompleted: primary.checked, siteQueryResultCount: primary.resultCount, robotsTxt, sitemap, similarDomain, evidenceBasedReasons: reasons };
}

export async function runSeoAudit(rawInput: string): Promise<SeoAudit> {
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

  const main = await fetchWithValidation(parsed, 512 * 1024, 12000).catch(() => null);
  if (!main) return { ...dead(target, "target_unreachable"), host };
  if (main.status >= 400) return { ...dead(target, "target_unreachable"), host };

  const finalUrl = new URL(main.finalUrl);
  const origin = `${finalUrl.protocol}//${finalUrl.host}`;
  const usesHttps = finalUrl.protocol === "https:";
  const html = main.body || "";
  const htmlBytes = Buffer.byteLength(html, "utf8");
  const looksLikeHtml = /<html|<title|<!doctype/i.test(html.slice(0, 2000));
  const analysis = analyzeHtml(html, finalUrl);

  // robots.txt + sitemap (from robots directives first, else the
  // conventional /sitemap.xml). SPA catch-all shells are detected:
  // an HTML body answering for robots/sitemap means "not present".
  const robotsFetch = await fetchAux(`${origin}/robots.txt`, 32 * 1024, 6000);
  const robotsIsReal = Boolean(
    robotsFetch && robotsFetch.status === 200 && !/<html|<!doctype/i.test(robotsFetch.body.slice(0, 500)),
  );
  const robotsBody = robotsIsReal ? robotsFetch!.body : "";
  const robotsBlocksAll = (() => {
    if (!robotsBody) return false;
    // Only the wildcard agent group can block the whole site.
    const groups = robotsBody.split(/\n\s*\n/);
    for (const group of groups) {
      if (/user-agent:\s*\*/i.test(group) && /disallow:\s*\/\s*($|\n)/im.test(group)) return true;
    }
    return /user-agent:\s*\*\s*\n\s*disallow:\s*\/\s*($|\n)/im.test(robotsBody);
  })();
  const sitemapUrlsFromRobots: string[] = [];
  if (robotsBody) {
    for (const line of robotsBody.split(/\r?\n/)) {
      const match = line.match(/^\s*sitemap:\s*(\S+)/i);
      if (match) sitemapUrlsFromRobots.push(match[1]);
    }
  }

  const sitemapCandidate = sitemapUrlsFromRobots[0] || `${origin}/sitemap.xml`;
  let sitemapFetch: FetchOutcome | null = null;
  try {
    const sitemapUrl = new URL(sitemapCandidate);
    if (sitemapUrl.hostname.toLowerCase() === finalUrl.hostname.toLowerCase()) {
      sitemapFetch = await fetchAux(sitemapUrl.toString(), 512 * 1024, 8000);
    }
  } catch { sitemapFetch = null; }
  const sitemapIsReal = Boolean(
    sitemapFetch && sitemapFetch.status === 200 && /<urlset|<sitemapindex/i.test(sitemapFetch.body.slice(0, 5000)),
  );
  const sitemapBody = sitemapIsReal ? sitemapFetch!.body : "";
  const sitemapLocs = sitemapBody ? [...sitemapBody.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1]) : [];
  const isSitemapIndex = /<sitemapindex/i.test(sitemapBody);
  let sitemapUrlCount = isSitemapIndex ? 0 : sitemapLocs.length;
  let sitemapChildCount = isSitemapIndex ? sitemapLocs.length : 0;
  if (isSitemapIndex && sitemapLocs.length) {
    // Sample up to 2 child sitemaps to estimate the real URL count
    // without turning one audit into a crawl.
    const samples = sitemapLocs.slice(0, 2);
    let sampled = 0;
    for (const child of samples) {
      try {
        const childUrl = new URL(child);
        if (childUrl.hostname.toLowerCase() !== finalUrl.hostname.toLowerCase()) continue;
        const childFetch = await fetchAux(childUrl.toString(), 512 * 1024, 6000);
        if (childFetch && childFetch.status === 200) {
          sampled += (childFetch.body.match(/<loc>/gi) || []).length;
        }
      } catch { /* sample is best-effort */ }
    }
    sitemapUrlCount = sampled;
  }
  const hasSitemap = sitemapIsReal;

  // Response-time stability (Wahid round, 2026-10-27): one slow fetch
  // used to swing the score between runs (the same site scored 88 in
  // one run and 92 in another). Measure a second time and score on
  // the FASTER response — the site's capability, not a momentary hiccup.
  let elapsedMs = main.elapsedMs;
  try {
    const second = await fetchWithValidation(new URL(main.finalUrl), 24 * 1024, 6000);
    if (second.elapsedMs > 0) elapsedMs = Math.min(elapsedMs, second.elapsedMs);
  } catch { /* timing re-measure is best-effort */ }

  // ------------------------------------------------------------ scoring
  const flags: SeoFlag[] = [];
  const passed: string[] = [];
  let score = 100;
  const deduct = (points: number) => { score -= points; };

  if (!usesHttps) {
    flags.push({ severity: "high", title: "الموقع النهائي لا يعمل عبر HTTPS", evidence: `الرابط النهائي: ${main.finalUrl}` });
    deduct(10);
  } else passed.push("الموقع يعمل عبر HTTPS (عامل ثقة وترتيب)");

  if (!analysis.title) {
    flags.push({ severity: "critical", title: "لا يوجد عنوان صفحة (Title)", evidence: "وسم <title> غائب أو فارغ في الصفحة الرئيسية" });
    deduct(12);
  } else if (analysis.titleLength < 30 || analysis.titleLength > 60) {
    flags.push({ severity: "low", title: "طول العنوان خارج النطاق المثالي (30–60 حرفًا)", evidence: `العنوان الحالي (${analysis.titleLength} حرفًا): ${analysis.title}` });
    deduct(4);
  } else passed.push(`عنوان الصفحة موجود وبطول مناسب (${analysis.titleLength} حرفًا)`);

  if (!analysis.description) {
    flags.push({ severity: "high", title: "لا يوجد وصف تعريفي (Meta Description)", evidence: "وسم meta description غائب — جوجل سيقتطع نصًا عشوائيًا في نتائج البحث" });
    deduct(10);
  } else if (analysis.descriptionLength < 120 || analysis.descriptionLength > 160) {
    flags.push({ severity: "low", title: "طول الوصف التعريفي خارج النطاق المثالي (120–160 حرفًا)", evidence: `الوصف الحالي (${analysis.descriptionLength} حرفًا): ${analysis.description.slice(0, 180)}` });
    deduct(3);
  } else passed.push(`الوصف التعريفي موجود وبطول مناسب (${analysis.descriptionLength} حرفًا)`);

  if (!analysis.h1.length) {
    flags.push({ severity: "high", title: "لا يوجد عنوان رئيسي H1", evidence: "الصفحة بلا أي وسم <h1> — محركات البحث تفقد الموضوع الرئيسي للصفحة" });
    deduct(10);
  } else if (analysis.h1.length > 1) {
    flags.push({ severity: "medium", title: `عناوين H1 متعددة (${analysis.h1.length})`, evidence: `العناوين: ${analysis.h1.slice(0, 3).join(" · ")}` });
    deduct(4);
  } else passed.push(`عنوان H1 واحد واضح: ${analysis.h1[0].slice(0, 120)}`);

  if (!analysis.canonical) {
    flags.push({ severity: "medium", title: "لا يوجد رابط Canonical", evidence: "وسم link rel=canonical غائب — خطر تكرار المحتوى بين نسخ الرابط" });
    deduct(6);
  } else passed.push(`رابط Canonical مضبوط: ${analysis.canonical.slice(0, 140)}`);

  if (/noindex/i.test(analysis.metaRobots)) {
    flags.push({ severity: "critical", title: "الصفحة ممنوعة من الفهرسة (noindex)", evidence: `meta robots: ${analysis.metaRobots}` });
    deduct(20);
  }

  if (!robotsIsReal) {
    flags.push({ severity: "medium", title: "لا يوجد ملف robots.txt", evidence: "طلب /robots.txt لم يرجع ملفًا صالحًا — لا توجد تعليمات زحف ولا إعلان لخريطة الموقع" });
    deduct(5);
  } else if (robotsBlocksAll) {
    flags.push({ severity: "critical", title: "ملف robots.txt يمنع زحف الموقع بالكامل", evidence: "قاعدة Disallow: / تحت User-agent: * — جوجل ممنوع من زحف كل الصفحات" });
    deduct(10);
  } else passed.push("ملف robots.txt موجود ولا يمنع زحف الموقع");

  if (!hasSitemap) {
    flags.push({ severity: "medium", title: "لا توجد خريطة موقع (Sitemap)", evidence: "لم يتم العثور على sitemap.xml صالحة ولا إعلان عنها في robots.txt" });
    deduct(6);
  } else passed.push(isSitemapIndex
    ? `خريطة موقع رئيسية (فهرس) تضم ${sitemapChildCount} خريطة فرعية`
    : `خريطة موقع موجودة وتضم ${sitemapUrlCount} رابطًا`);

  if (!analysis.hasViewport) {
    flags.push({ severity: "high", title: "لا يوجد إعداد Viewport للجوال", evidence: "وسم meta viewport غائب — تجربة الجوال والترتيب على الهواتف يتضرران مباشرة" });
    deduct(8);
  } else passed.push("إعداد Viewport موجود (الصفحة مهيأة للجوال)");

  const ogCount = Object.keys(analysis.og).length;
  if (ogCount === 0) {
    flags.push({ severity: "medium", title: "لا توجد وسوم مشاركة (Open Graph)", evidence: "غياب og:title / og:description / og:image — روابط الموقع ستظهر بلا صورة وعنوان مضبوط عند المشاركة" });
    deduct(5);
  } else if (!analysis.og["og:image"]) {
    flags.push({ severity: "low", title: "صورة المشاركة og:image غائبة", evidence: `وسوم Open Graph الموجودة: ${Object.keys(analysis.og).join("، ")}` });
    deduct(2);
  } else passed.push("وسوم Open Graph للمشاركة مضبوطة مع صورة");

  if (!analysis.jsonLdTypes.length) {
    flags.push({ severity: "medium", title: "لا توجد بيانات منظمة (Schema / JSON-LD)", evidence: "لا توجد أي كتل application/ld+json — الموقع يخسر فرص النتائج الغنية (Rich Results)" });
    deduct(5);
  } else passed.push(`بيانات منظمة موجودة: ${analysis.jsonLdTypes.join("، ")}`);

  if (analysis.imagesTotal > 0 && analysis.imagesMissingAlt > 0) {
    const ratio = analysis.imagesMissingAlt / analysis.imagesTotal;
    flags.push({
      severity: ratio > 0.5 ? "medium" : "low",
      title: `صور بلا نص بديل (Alt): ${analysis.imagesMissingAlt} من ${analysis.imagesTotal}`,
      evidence: "النص البديل يساعد جوجل على فهم الصور ويظهر في بحث الصور، وغيابه يضعف إمكانية الوصول",
    });
    deduct(ratio > 0.5 ? 5 : 2);
  } else if (analysis.imagesTotal > 0) passed.push(`كل الصور (${analysis.imagesTotal}) تحمل نصًا بديلًا`);

  if (htmlBytes > 300 * 1024) {
    flags.push({ severity: "low", title: "حجم HTML الصفحة كبير", evidence: `حجم HTML الذي تم تحميله: ${Math.round(htmlBytes / 1024)} KB (قبل ملفات CSS/JS الخارجية)` });
    deduct(4);
  }

  if (!analysis.lang) {
    flags.push({ severity: "low", title: "لغة الصفحة غير معلنة (html lang)", evidence: "وسم <html> بلا سمة lang — جوجل والمتصفحات تخمّن لغة المحتوى" });
    deduct(3);
  } else passed.push(`لغة الصفحة معلنة: ${analysis.lang}`);

  if (!analysis.charset) {
    flags.push({ severity: "low", title: "ترميز الأحرف (charset) غير معلن", evidence: "لا يوجد meta charset في ترويسة الصفحة" });
    deduct(2);
  }

  if (!analysis.hasFavicon) {
    flags.push({ severity: "low", title: "لا توجد أيقونة موقع (Favicon)", evidence: "لا يوجد link rel=icon — شعار الموقع لا يظهر بجانب عنوانه في نتائج بحث الجوال" });
    deduct(2);
  }

  if (analysis.wordCount < 300) {
    flags.push({ severity: "medium", title: "محتوى نصي قليل في الصفحة الرئيسية", evidence: `النص المرئي المستخرج: ~${analysis.wordCount} كلمة فقط (يُفضّل 300+ كلمة محتوى حقيقي للصفحات المستهدفة)` });
    deduct(4);
  } else passed.push(`محتوى نصي جيد في الصفحة: ~${analysis.wordCount} كلمة`);

  if (elapsedMs > 3000) {
    flags.push({ severity: "medium", title: "استجابة الخادم بطيئة", evidence: `زمن تحميل HTML من الخادم: ${elapsedMs}ms (الأسرع من قياسين) — البطء يضر الترتيب ونسبة البقاء` });
    deduct(4);
  } else if (elapsedMs > 1500) {
    flags.push({ severity: "low", title: "استجابة الخادم أبطأ من المثالي", evidence: `زمن تحميل HTML من الخادم: ${elapsedMs}ms (الأسرع من قياسين؛ المثالي أقل من 1500ms)` });
    deduct(2);
  } else passed.push(`استجابة خادم سريعة: ${elapsedMs}ms لتحميل HTML (الأسرع من قياسين)`);

  const contentEncoding = main.headers["content-encoding"] || "";
  if (!contentEncoding && htmlBytes > 20 * 1024) {
    flags.push({ severity: "low", title: "ضغط النقل (gzip/br) غير مفعّل", evidence: "رد الخادم بلا Content-Encoding رغم حجم الصفحة — التفعيل يقلل زمن التحميل بشكل كبير" });
    deduct(2);
  }

  if (analysis.internalLinks === 0 && analysis.totalLinks > 0) {
    flags.push({ severity: "medium", title: "لا روابط داخلية من الصفحة الرئيسية", evidence: "كل الروابط القابلة للزحف خارجية — الربط الداخلي هو ما يوزع قوة الصفحة على باقي الموقع" });
    deduct(4);
  }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";

  const details: Record<string, unknown> = {
    finalUrl: main.finalUrl,
    httpStatus: main.status,
    redirectChain: main.chain,
    usesHttps,
    elapsedMs,
    htmlBytes,
    looksLikeHtml,
    contentEncoding: contentEncoding || null,
    cacheControl: main.headers["cache-control"] || null,
    title: analysis.title,
    titleLength: analysis.titleLength,
    description: analysis.description,
    descriptionLength: analysis.descriptionLength,
    canonical: analysis.canonical || null,
    metaRobots: analysis.metaRobots || null,
    hasViewport: analysis.hasViewport,
    charset: analysis.charset || null,
    lang: analysis.lang || null,
    og: analysis.og,
    twitterCard: analysis.twitterCard || null,
    hasFavicon: analysis.hasFavicon,
    h1: analysis.h1,
    h2Count: analysis.h2Count,
    h3Count: analysis.h3Count,
    imagesTotal: analysis.imagesTotal,
    imagesMissingAlt: analysis.imagesMissingAlt,
    imagesEmptyAlt: analysis.imagesEmptyAlt,
    internalLinks: analysis.internalLinks,
    externalLinks: analysis.externalLinks,
    totalLinks: analysis.totalLinks,
    scriptCount: analysis.scriptCount,
    stylesheetCount: analysis.stylesheetCount,
    jsonLdTypes: analysis.jsonLdTypes,
    wordCount: analysis.wordCount,
    robotsTxt: robotsIsReal ? "present" : "missing",
    robotsBlocksAll,
    sitemap: hasSitemap ? (isSitemapIndex ? "index" : "present") : "missing",
    sitemapUrlCount,
    sitemapChildCount,
    auditedAt: new Date().toISOString(),
  };

  // Indexing lookup is supplemental evidence: Google can rate-limit or block
  // automated queries. Never fail the paid technical audit just because this
  // optional lookup is unavailable; report the state as unknown instead.
  try {
    details.indexingData = await collectIndexingData(host, analysis.metaRobots, robotsBlocksAll, String(details.robotsTxt), String(details.sitemap));
  } catch (error) {
    console.warn("[SEO] Indexing lookup unavailable", error instanceof Error ? error.message : "unknown");
    details.indexingData = {
      isIndexed: null,
      searchCheckCompleted: false,
      siteQueryResultCount: null,
      robotsTxt: String(details.robotsTxt),
      sitemap: String(details.sitemap),
      similarDomain: null,
      evidenceBasedReasons: [],
      status: "unknown",
    };
  }
  return { target, host, reachable: true, score, grade, flags, passed, details };
}

// Compact Arabic evidence block for the report writer. Every line is a
// fact collected above — the model narrates and advises, it does not
// discover, and it must never invent volumes, backlinks or rankings.
export function seoFindingsText(audit: SeoAudit): string {
  const d = audit.details as any;
  let auditWhen = "";
  try {
    auditWhen = new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "full", timeStyle: "short" }).format(d.auditedAt ? new Date(d.auditedAt) : new Date());
  } catch { auditWhen = d.auditedAt || ""; }
  const lines: string[] = [
    `تاريخ ووقت الفحص: ${auditWhen} (توقيت القاهرة)`,
    `الهدف: ${audit.target}`,
    `الرابط النهائي بعد التحويلات: ${d.finalUrl} (HTTP ${d.httpStatus})`,
    `سلسلة التحويل: ${(d.redirectChain || []).map((hop: any) => `${hop.status}`).join(" ← ") || "بدون تحويل"}`,
    `درجة SEO المحسوبة من السيرفر: ${audit.score}/100 — التقييم: ${audit.grade}`,
    "",
    "== المشاكل المؤكدة بالأدلة ==",
    ...(audit.flags.length
      ? audit.flags.map((f) => `- [${f.severity}] ${f.title} — الدليل: ${f.evidence}`)
      : ["- لا مشاكل مؤكدة في هذا الفحص"]),
    "",
    "== نقاط سليمة تم التحقق منها ==",
    ...(audit.passed.length ? audit.passed.map((p) => `- ${p}`) : ["- لا شيء يذكر"]),
    "",
    "== بيانات خام داعمة ==",
    `العنوان (Title): ${d.title ? `«${d.title}» (${d.titleLength} حرفًا)` : "غائب"}`,
    `الوصف التعريفي: ${d.description ? `«${String(d.description).slice(0, 200)}» (${d.descriptionLength} حرفًا)` : "غائب"}`,
    `Canonical: ${d.canonical || "غائب"} · meta robots: ${d.metaRobots || "غير مضبوط (افتراضي: index, follow)"} · لغة الصفحة: ${d.lang || "غير معلنة"} · charset: ${d.charset || "غير معلن"}`,
    `Viewport للجوال: ${d.hasViewport ? "موجود" : "غائب"} · Favicon: ${d.hasFavicon ? "موجودة" : "غائبة"}`,
    `عناوين H1 (${(d.h1 || []).length}): ${(d.h1 || []).join(" · ") || "لا شيء"} · عدد H2: ${d.h2Count} · عدد H3: ${d.h3Count}`,
    `وسوم Open Graph: ${Object.keys(d.og || {}).length ? Object.entries(d.og).map(([k, v]) => `${k}=${String(v).slice(0, 80)}`).join(" · ") : "غائبة"} · Twitter Card: ${d.twitterCard || "غائبة"}`,
    `البيانات المنظمة (Schema): ${(d.jsonLdTypes || []).join("، ") || "غائبة"}`,
    `الصور: ${d.imagesTotal} صورة — بلا نص بديل: ${d.imagesMissingAlt} · نص بديل فارغ: ${d.imagesEmptyAlt}`,
    `الروابط القابلة للزحف: ${d.totalLinks} — داخلية: ${d.internalLinks} · خارجية: ${d.externalLinks}`,
    `المحتوى النصي المرئي: ~${d.wordCount} كلمة`,
    `الأداء المقاس من الخادم: زمن تحميل HTML ‏${d.elapsedMs}ms · حجم HTML ‏${Math.round((d.htmlBytes || 0) / 1024)} KB · ضغط النقل: ${d.contentEncoding || "غير مفعّل"} · سكربتات خارجية: ${d.scriptCount} · ملفات CSS: ${d.stylesheetCount} · Cache-Control: ${d.cacheControl || "غير مضبوط"}`,
    `robots.txt: ${d.robotsTxt}${d.robotsBlocksAll ? " (يمنع الكل)" : ""} · خريطة الموقع: ${d.sitemap}${d.sitemap === "index" ? ` (${d.sitemapChildCount} خريطة فرعية، عيّنة روابط مقروءة: ${d.sitemapUrlCount})` : d.sitemap === "present" ? ` (${d.sitemapUrlCount} رابطًا)` : ""}`,
    `HTTPS: ${d.usesHttps ? "مفعّل" : "غير مفعّل في الرابط النهائي"}`,
    "",
    "== بيانات الفهرسة والظهور في Google (منفصلة عن الدرجة التقنية) ==",
    `indexingData: ${JSON.stringify(d.indexingData || {})}`,
  ];
  return lines.join("\n").slice(0, 9500);
}
