// Live dark-web index search through Ahmia (clearnet gateway).
//
// Ahmia's search form carries a per-session anti-bot token: a hidden input
// whose NAME and VALUE are randomized on every page load, plus a session
// cookie. A bare /search/?q= request redirects to the homepage, so the
// lookup is two steps: (1) fetch the homepage with a cookie jar and parse
// the hidden token out of the search form, (2) submit the search with the
// token and the same cookies, then parse the structured result items
// (<li class="result">: redirect link with the real .onion URL in its
// redirect_url parameter, a <p> description, and a <cite> host).
//
// Verified end-to-end against the live site on 2026-10-27. Any failure
// returns an empty list — callers must treat "no results" as "the live
// index is unavailable" and never let the model invent .onion links.

export type DarkSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const cache = new Map<string, { at: number; results: DarkSearchResult[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RESULTS = 8;

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchDarkWeb(query: string): Promise<DarkSearchResult[]> {
  const q = String(query || "").trim().slice(0, 200);
  if (!q) return [];
  const cacheKey = q.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.results;

  try {
    // Step 1: homepage — session cookie + rotating hidden token.
    const home = await fetch("https://ahmia.fi/", {
      headers: { "user-agent": BROWSER_UA },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!home.ok) return [];
    const getSetCookie = (home.headers as any).getSetCookie as (() => string[]) | undefined;
    const rawCookies: string[] = typeof getSetCookie === "function"
      ? getSetCookie.call(home.headers)
      : [home.headers.get("set-cookie") || ""];
    const cookieHeader = rawCookies.map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
    const homeHtml = await home.text();
    const token = homeHtml.match(/<input type="hidden" name="([a-z0-9]{4,16})" value="([a-z0-9]{4,16})"/i);
    if (!token) return [];

    // Step 2: the search itself.
    const searchUrl = `https://ahmia.fi/search/?q=${encodeURIComponent(q)}&${encodeURIComponent(token[1])}=${encodeURIComponent(token[2])}`;
    const response = await fetch(searchUrl, {
      headers: { "user-agent": BROWSER_UA, ...(cookieHeader ? { cookie: cookieHeader } : {}) },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return [];
    const html = await response.text();

    const results: DarkSearchResult[] = [];
    const itemPattern = /<li class="result"[^>]*>([\s\S]*?)<\/li>/g;
    let item: RegExpExecArray | null;
    while ((item = itemPattern.exec(html)) && results.length < MAX_RESULTS) {
      const block = item[1];
      const link = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!link) continue;
      let realUrl = "";
      try {
        const redirectParam = new URL(link[1], "https://ahmia.fi").searchParams.get("redirect_url");
        realUrl = redirectParam || link[1];
      } catch {
        realUrl = link[1];
      }
      if (!/\.onion/i.test(realUrl)) continue;
      const title = stripTags(link[2]).slice(0, 160);
      if (!title) continue;
      const paragraph = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      const snippet = paragraph ? stripTags(paragraph[1]).slice(0, 260) : "";
      results.push({ title, url: realUrl.slice(0, 300), snippet });
    }

    cache.set(cacheKey, { at: Date.now(), results });
    return results;
  } catch {
    return [];
  }
}

// Compact, prompt-ready rendering. Deliberately NOT markdown link cards
// (no ### headings, no [title](url) syntax) so a quoted result can never
// be mistaken for raw search output by downstream guards.
export function formatDarkResults(results: DarkSearchResult[]): string {
  return results
    .map((result, index) => `${index + 1}) ${result.title}\nالرابط: ${result.url}${result.snippet ? `\nالوصف: ${result.snippet}` : ""}`)
    .join("\n\n");
}
