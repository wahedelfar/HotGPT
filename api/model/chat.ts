
import { inflateSync } from "node:zlib";

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/g, (_match, char: string) => {
      const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
      return map[char] ?? char;
    })
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

function decodePdfHex(hex: string): string {
  const clean = hex.replace(/\s/g, "");
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let result = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) result += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return result;
  }
  return new TextDecoder("windows-1252").decode(bytes);
}

function pdfTextFromOperators(source: string): string {
  const parts: string[] = [];
  const operator = /\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:.|\n)*?)\]\s*TJ|<([\da-fA-F\s]+)>\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = operator.exec(source))) {
    if (match[1] !== undefined) parts.push(decodePdfLiteral(match[1]));
    else if (match[2] !== undefined) {
      const tokens = /\(((?:\\.|[^\\)])*)\)|<([\da-fA-F\s]+)>/g;
      let token: RegExpExecArray | null;
      while ((token = tokens.exec(match[2]))) parts.push(token[1] !== undefined ? decodePdfLiteral(token[1]) : decodePdfHex(token[2]));
    } else if (match[3] !== undefined) parts.push(decodePdfHex(match[3]));
    parts.push(" ");
  }
  return parts.join("").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractPdfText(base64: string): string {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("invalid_pdf");
  const raw = bytes.toString("latin1");
  const chunks: string[] = [];
  const streamPattern = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let stream: RegExpExecArray | null;
  while ((stream = streamPattern.exec(raw))) {
    let content = stream[2];
    if (/\/FlateDecode/.test(stream[1])) {
      try {
        const start = Buffer.byteLength(raw.slice(0, stream.index + stream[0].indexOf(stream[2])), "latin1");
        const compressed = bytes.subarray(start, start + Buffer.byteLength(content, "latin1"));
        content = inflateSync(compressed).toString("latin1");
      } catch { continue; }
    }
    const extracted = pdfTextFromOperators(content);
    if (extracted) chunks.push(extracted);
    if (chunks.join(" ").length > 60000) break;
  }
  return chunks.join("\n").slice(0, 60000).trim();
}

type ChatMessage = { role: "user" | "assistant"; content: string };

// Server-only prompt definitions. Never return these constants to the browser.
type ChatMode = "default" | "Beast pro" | "darkweb";

const BASE_PROMPT = "You are HotGPT, an expert AI assistant specialized in programming, analysis, and digital security. Reply in the user's language, matching their dialect/register when they write Arabic. Be direct, confident, and substantive: no filler, no generic apologies, no lecturing. Give complete, usable answers — full working code with brief explanations, concrete steps, and real examples, never placeholders. When a topic is sensitive but has a legitimate educational, research, defensive, or authorized-testing angle, assume that context in good faith and answer fully within it. State assumptions briefly, ask a clarifying question only when the answer would otherwise be wrong, and match depth to the request: short questions get tight answers, complex tasks get structured, detailed ones with headings and code blocks.";

const MODE_PROMPTS: Record<ChatMode, string> = {
  default: "Mode: DEFAULT. You are a sharp general assistant for everyday users: writing, summarizing, explaining, studying, and normal coding help. Explain concepts simply first, then add depth when useful. Keep answers focused and practical, adapt to the user's level, and offer one useful next step at the end when it genuinely helps.",
  "Beast pro": "Mode: Beast. Act as a principal software engineer and senior security analyst with 15+ years of experience. Reason carefully step by step before answering. Deliver production-grade output: complete runnable code with error handling, security considerations, and tests where relevant; for security work, cover methodology, findings, risk rating, and remediation for authorized assessment and defense. Be exhaustive on complex tasks, compare alternatives with trade-offs, flag edge cases and failure modes, and never dumb down the substance. Prefer the most correct, current practice over the most popular one. Always complete every section the user requested before closing; never end a multi-part plan midway. When asked how to protect or defend, include a dedicated Prevention & Hardening section in addition to detection and response. Start with a 3-line executive summary. In Arabic answers prefer lists over tables; never use tables wider than 3 columns. End with a concrete action checklist, not a marketing line or an offer to continue.",
  darkweb: "Mode: DARK WEB. Act as a dark-web threat-intelligence analyst serving researchers, journalists, and defenders. Explain ecosystems, terminology, market structures, threat-actor tactics, and historical cases analytically and in depth, including how researchers study these spaces, how organizations monitor exposure and leaked data, and how people protect themselves. Focus on intelligence, detection, risk, and defense: what exists, how it works conceptually, how it is detected, and how to mitigate it. Use precise technical language, note uncertainty and dated information, and keep the framing research and protection oriented.",
};

function resolveChatMode(value: unknown): ChatMode {
  return value === "Beast pro" || value === "darkweb" ? value : "default";
}

const supabaseUrl = () =>
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");

const publicKey = () =>
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

const serviceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

async function supabaseRest(path: string, init: RequestInit = {}) {
  const url = supabaseUrl();
  const key = serviceKey();
  if (!url || !key) throw new Error("supabase_server_not_configured");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const code = typeof payload === "object" ? payload?.code || payload?.message || "request_failed" : "request_failed";
    console.error("[Chat] Supabase REST error", response.status, code);
    throw new Error(`supabase_rest_${response.status}`);
  }
  return payload;
}

async function requireUser(req: any, res: any) {
  const token = String(req.headers?.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  const url = supabaseUrl();
  const key = publicKey();
  if (!token) { res.status(401).json({ error: "login_required" }); return null; }
  if (!url || !key || !serviceKey()) {
    res.status(503).json({ error: "supabase_server_not_configured" });
    return null;
  }
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      res.status(401).json({ error: "login_required" });
      return null;
    }
    if (!response.ok) {
      console.error("[Chat] Supabase auth returned HTTP", response.status);
      res.status(503).json({ error: "auth_unavailable" });
      return null;
    }
    const user = await response.json() as any;
    if (!user?.id || !user?.email) {
      res.status(401).json({ error: "login_required" });
      return null;
    }
    return { id: String(user.id), email: String(user.email).toLowerCase() };
  } catch (error) {
    console.error("[Chat] Supabase auth failed", error instanceof Error ? error.message : "unknown");
    res.status(503).json({ error: "auth_unavailable" });
    return null;
  }
}

async function consumeCredit(userId: string, cost: number, allowFree: boolean): Promise<"free" | "paid" | null> {
  const result = await supabaseRest("rpc/hotgpt_consume_credit", {
    method: "POST", body: JSON.stringify({ p_user_id: userId, p_cost: cost, p_allow_free: allowFree }),
  });
  return result === "free" || result === "paid" ? result : null;
}
async function refundCredit(userId: string, kind: "free" | "paid", cost: number) {
  await supabaseRest("rpc/hotgpt_refund_credit", {
    method: "POST", body: JSON.stringify({ p_user_id: userId, p_kind: kind, p_cost: cost }),
  });
}

async function searchInternet(query: string, darkWebSearch = false): Promise<string> {
  const cleanQuery = query.trim().slice(0, 500);
  if (!cleanQuery) throw new Error("web_search_failed");

  const tavilyKey = (process.env.TAVILY_API_KEY || "").trim();
  const firecrawlKey = (process.env.FIRECRAWL_API_KEY || "").trim();
  console.info("[Search] Configuration", JSON.stringify({
    tavilyConfigured: Boolean(tavilyKey),
    firecrawlConfigured: Boolean(firecrawlKey),
  }));
  if (!tavilyKey && !firecrawlKey) throw new Error("web_search_not_configured");

  type SearchItem = { title: string; url: string; content: string };
  const deepResearch =
    cleanQuery.length > 35 ||
    /\b(compare|comparison|rank|ranking|top\s+\d+|versus|vs\.|research|comprehensive|deep dive|latest news|latest breach|recent breach|data breach|security incident|cyberattack|sources|official sources|analy[sz]e|in depth|defen[cs]e|IAB|initial access|strategy|detailed|deep|complete|full)\b|مقارنة|قارن|ترتيب|رتب|أفضل\s+\d+|افضل\s+\d+|الأفضل|الافضل|بحث شامل|بحث معمق|مصادر|المصادر الرسمية|آخر الأخبار|احدث|أحدث|أحدث اختراق|أحدث تسريب|اختراق حديث|تسريب حديث|تحليل مفصل|دراسة مفصلة|بالتفصيل|حماية|دفاعي|دفاع|استراتيجية|استراتيجي|IAB|Initial Access|أكبر 3|أكبر ثلاثة|تفصيلي|عميق|كامل/i.test(cleanQuery) ||
    /(?:أكبر|أفضل|افضل|top|largest|best)\s*(?:3|٣|three|[3-9]\d*)|(?:[3-9]\d*|[٣٤٥٦٧٨٩]|three|four|five|six|seven|eight|nine)\s*(?:أسواق|اسواق|عناصر|نقاط|أمثلة|امثلة|أسئلة|اسئلة|خطوات|markets|items|points|examples|questions|steps)/i.test(cleanQuery);

  const normalizeItems = (items: any[], maxContent: number): SearchItem[] =>
    items.map((item: any): SearchItem => ({
      title: String(item.title || item.name || "Search result").slice(0, 200),
      url: String(item.url || item.link || "").slice(0, 1000),
      content: String(item.content || item.description || item.snippet || item.markdown || "").slice(0, maxContent),
    })).filter((item) => /^https?:\/\//i.test(item.url) && item.title.trim() && item.content.trim());

  const runTavily = async (): Promise<SearchItem[]> => {
    if (!tavilyKey) return [];
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: cleanQuery,
        search_depth: deepResearch ? "advanced" : "basic",
        max_results: 8,
        include_answer: true,
        time_range: darkWebSearch ? "week" : /(?:سعر|أسعار|الدولار|ذهب|الذهب|عيار|gold|price|usd|exchange rate)/i.test(cleanQuery) ? "day" : undefined,
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) {
      console.warn("[Search] Tavily failed", JSON.stringify({ status: response.status }));
      throw new Error("tavily_http_" + response.status);
    }
    const data = await response.json() as any;
    const items = normalizeItems(Array.isArray(data.results) ? data.results : [], deepResearch ? 2200 : 1500);
    console.info("[Search] Tavily completed", JSON.stringify({ resultCount: items.length, answerAvailable: Boolean(data.answer) }));
    return items;
  };  const runFirecrawlSearch = async (): Promise<SearchItem[]> => {    if (!firecrawlKey) return [];
    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + firecrawlKey },
      body: JSON.stringify({ query: cleanQuery, limit: deepResearch ? 8 : 5, sources: ["web"] }),
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      console.warn("[Search] Firecrawl search failed", JSON.stringify({ status: response.status }));
      throw new Error("firecrawl_search_http_" + response.status);
    }
    const payload = await response.json() as any;
    const items = normalizeItems(Array.isArray(payload.data) ? payload.data : [], deepResearch ? 2200 : 1500);
    console.info("[Search] Firecrawl completed", JSON.stringify({ resultCount: items.length }));
    return items;
  };

  const [tavilyResult, firecrawlResult] = await Promise.allSettled([
    runTavily(),
    runFirecrawlSearch(),
  ]);
  const tavilyItems = tavilyResult.status === "fulfilled" ? tavilyResult.value : [];
  const firecrawlItems = firecrawlResult.status === "fulfilled" ? firecrawlResult.value : [];
  if (tavilyResult.status === "rejected") {
    console.warn("[Search] Tavily unavailable", JSON.stringify({
      reason: tavilyResult.reason instanceof Error ? tavilyResult.reason.message : "unknown",
    }));
  }
  if (firecrawlResult.status === "rejected") {
    console.warn("[Search] Firecrawl unavailable", JSON.stringify({
      reason: firecrawlResult.reason instanceof Error ? firecrawlResult.reason.message : "unknown",
    }));
  }

  // Either provider can independently satisfy search; one outage must not poison the other.
  const merged = [...tavilyItems, ...firecrawlItems];
  const seen = new Set<string>();
  const unique = merged.filter((item) => {
    try {
      const parsed = new URL(item.url);
      parsed.hash = "";
      const key = parsed.toString().replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch {
      return false;
    }
  }).filter((item) =>
    item.title.trim() && item.content.trim() &&
    !/profile image|jordan host|all right reserved/i.test(item.title + " " + item.content)
  ).slice(0, 8);

  if (!unique.length) {
    console.error("[Search] All search sources failed or returned no usable results", JSON.stringify({
      tavilyConfigured: Boolean(tavilyKey),
      firecrawlConfigured: Boolean(firecrawlKey),
      tavilyStatus: tavilyResult.status,
      firecrawlStatus: firecrawlResult.status,
    }));
    throw new Error("web_search_failed");
  }

  console.info("[Search] Search succeeded", JSON.stringify({
    sourceCount: unique.length,
    tavilyCount: tavilyItems.length,
    firecrawlCount: firecrawlItems.length,
    deepResearch,
  }));

  return [
    "## " + (deepResearch ? "نتائج البحث الموسع" : "نتائج البحث"),
    "",
    ...unique.map((item, index) =>
      "### " + (index + 1) + ". [" + item.title.replace(/[\[\]]/g, "") + "](" + item.url + ")\n\n" + item.content.trim()
    ),
    "",
    "عدد المصادر: " + unique.length,
  ].join("\n\n").slice(0, deepResearch ? 14000 : 9000);
}
async function getWallet(userId: string) {
  const rows = await supabaseRest(`wallets?user_id=eq.${encodeURIComponent(userId)}&select=free_answers_used,token_balance&limit=1`);
  if (!rows?.[0]) throw new Error("wallet_not_found");
  return {
    freeAnswersUsed: Number(rows[0].free_answers_used),
    tokenBalance: Number(rows[0].token_balance),
    freeAnswersRemaining: Math.max(0, 2 - Number(rows[0].free_answers_used)),
  };
}

async function createAssistantMessage(userId: string, conversationId: string) {
  const owners = await supabaseRest(`conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`);
  if (!owners?.[0]) throw new Error("conversation_not_found");
  const rows = await supabaseRest("messages?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ conversation_id: conversationId, user_id: userId, role: "assistant", content: "", is_complete: false, part_count: 1, last_finish_reason: null }) });
  if (typeof rows?.[0]?.id !== "string") throw new Error("assistant_message_create_failed");
  return rows[0].id as string;
}
async function updateAssistantMessage(userId: string, messageId: string, patch: Record<string, unknown>) {
  await supabaseRest(`messages?id=eq.${encodeURIComponent(messageId)}&user_id=eq.${encodeURIComponent(userId)}&role=eq.assistant`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
}
async function chargeChatPart(userId: string, messageId: string, partIndex: number) {
  return await supabaseRest("rpc/hotgpt_charge_chat_part", { method: "POST", body: JSON.stringify({ p_user_id: userId, p_message_id: messageId, p_part_index: partIndex, p_cost: 5 }) }) as { charged?: boolean; duplicate?: boolean; insufficient?: boolean; user_credits?: number };
}
async function refundChatPart(userId: string, messageId: string, partIndex: number) {
  return await supabaseRest("rpc/hotgpt_refund_chat_part", { method: "POST", body: JSON.stringify({ p_user_id: userId, p_message_id: messageId, p_part_index: partIndex, p_cost: 5 }) });
}

async function saveMessage(userId: string, conversationId: string, role: "user" | "assistant", content: string) {
  const owners = await supabaseRest(`conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,title&limit=1`);
  const conversation = owners?.[0];
  if (!conversation) throw new Error("conversation_not_found");
  await supabaseRest("messages?select=id", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ conversation_id: conversationId, user_id: userId, role, content }),
  });
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (role === "user" && conversation.title === "محادثة جديدة") patch.title = content.slice(0, 80);
  await supabaseRest(`conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

function sanitizeSearchAnswer(content: string): string {
  const blocked = /(?:إذا كانت المهمة|إذا كان المطلوب قيمة واحدة|ملاحظة للمبرمج|if the task expects|if a single value is required|developer note|internal evaluation value)/i;
  return content.split(/\n+/).filter((line) => !blocked.test(line)).join("\n").replace(/\b(?:Tavily|Firecrawl|OpenRouter|MiMo|CTF|verbatim)\b/gi, "مصادر البحث").replace(/\n{3,}/g, "\n\n").trim();
}

function classifyPremiumAnswer(content: string): { cost: 3 | 5 | 9; tier: "simple" | "deep" | "report"; labelAr: string; labelEn: string } {
  const wordCount = content.trim().split(/\s+/u).filter(Boolean).length;
  const fence = String.fromCharCode(96).repeat(3);
  const codeBlocks = (content.match(new RegExp(fence + "[\\s\\S]*?" + fence, "g")) || []).length;
  const hasTable = /^\s*\|.*\|\s*$/m.test(content) || /\b(compare|comparison|versus)\b|مقارنة|قارن/i.test(content);
  if (wordCount > 2000 || codeBlocks >= 2) return { cost: 9, tier: "report", labelAr: "تقرير طويل شامل", labelEn: "Comprehensive full report" };
  if (wordCount > 8
import { inflateSync } from "node:zlib";

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/g, (_match, char: string) => {
      const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
      return map[char] ?? char;
    })
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

function decodePdfHex(hex: string): string {
  const clean = hex.replace(/\s/g, "");
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let result = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) result += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return result;
  }
  return new TextDecoder("windows-1252").decode(bytes);
}

function pdfTextFromOperators(source: string): string {
  const parts: string[] = [];
  const operator = /\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:.|\n)*?)\]\s*TJ|<([\da-fA-F\s]+)>\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = operator.exec(source))) {
    if (match[1] !== undefined) parts.push(decodePdfLiteral(match[1]));
    else if (match[2] !== undefined) {
      const tokens = /\(((?:\\.|[^\\)])*)\)|<([\da-fA-F\s]+)>/g;
      let token: RegExpExecArray | null;
      while ((token = tokens.exec(match[2]))) parts.push(token[1] !== undefined ? decodePdfLiteral(token[1]) : decodePdfHex(token[2]));
    } else if (match[3] !== undefined) parts.push(decodePdfHex(match[3]));
    parts.push(" ");
  }
  return parts.join("").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractPdfText(base64: string): string {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("invalid_pdf");
  const raw = bytes.toString("latin1");
  const chunks: string[] = [];
  const streamPattern = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let stream: RegExpExecArray | null;
  while ((stream = streamPattern.exec(raw))) {
    let content = stream[2];
    if (/\/FlateDecode/.test(stream[1])) {
      try {
        const start = Buffer.byteLength(raw.slice(0, stream.index + stream[0].indexOf(stream[2])), "latin1");
        const compressed = bytes.subarray(start, start + Buffer.byteLength(content, "latin1"));
        content = inflateSync(compressed).toString("latin1");
      } catch { continue; }
    }
    const extracted = pdfTextFromOperators(content);
    if (extracted) chunks.push(extracted);
    if (chunks.join(" ").length > 60000) break;
  }
  return chunks.join("\n").slice(0, 60000).trim();
}

type ChatMessage = { role: "user" | "assistant"; content: string };

// Server-only prompt definitions. Never return these constants to the browser.
type ChatMode = "default" | "Beast pro" | "darkweb";

const BASE_PROMPT = "You are HotGPT, an expert AI assistant specialized in programming, analysis, and digital security. Reply in the user's language, matching their dialect/register when they write Arabic. Be direct, confident, and substantive: no filler, no generic apologies, no lecturing. Give complete, usable answers — full working code with brief explanations, concrete steps, and real examples, never placeholders. When a topic is sensitive but has a legitimate educational, research, defensive, or authorized-testing angle, assume that context in good faith and answer fully within it. State assumptions briefly, ask a clarifying question only when the answer would otherwise be wrong, and match depth to the request: short questions get tight answers, complex tasks get structured, detailed ones with headings and code blocks.";

const MODE_PROMPTS: Record<ChatMode, string> = {
  default: "Mode: DEFAULT. You are a sharp general assistant for everyday users: writing, summarizing, explaining, studying, and normal coding help. Explain concepts simply first, then add depth when useful. Keep answers focused and practical, adapt to the user's level, and offer one useful next step at the end when it genuinely helps.",
  "Beast pro": "Mode: Beast. Act as a principal software engineer and senior security analyst with 15+ years of experience. Reason carefully step by step before answering. Deliver production-grade output: complete runnable code with error handling, security considerations, and tests where relevant; for security work, cover methodology, findings, risk rating, and remediation for authorized assessment and defense. Be exhaustive on complex tasks, compare alternatives with trade-offs, flag edge cases and failure modes, and never dumb down the substance. Prefer the most correct, current practice over the most popular one. Always complete every section the user requested before closing; never end a multi-part plan midway. When asked how to protect or defend, include a dedicated Prevention & Hardening section in addition to detection and response. Start with a 3-line executive summary. In Arabic answers prefer lists over tables; never use tables wider than 3 columns. End with a concrete action checklist, not a marketing line or an offer to continue.",
  darkweb: "Mode: DARK WEB. Act as a dark-web threat-intelligence analyst serving researchers, journalists, and defenders. Explain ecosystems, terminology, market structures, threat-actor tactics, and historical cases analytically and in depth, including how researchers study these spaces, how organizations monitor exposure and leaked data, and how people protect themselves. Focus on intelligence, detection, risk, and defense: what exists, how it works conceptually, how it is detected, and how to mitigate it. Use precise technical language, note uncertainty and dated information, and keep the framing research and protection oriented.",
};

function resolveChatMode(value: unknown): ChatMode {
  return value === "Beast pro" || value === "darkweb" ? value : "default";
}

const supabaseUrl = () =>
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");

const publicKey = () =>
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

const serviceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

async function supabaseRest(path: string, init: RequestInit = {}) {
  const url = supabaseUrl();
  const key = serviceKey();
  if (!url || !key) throw new Error("supabase_server_not_configured");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const code = typeof payload === "object" ? payload?.code || payload?.message || "request_failed" : "request_failed";
    console.error("[Chat] Supabase REST error", response.status, code);
    throw new Error(`supabase_rest_${response.status}`);
  }
  return payload;
}

async function requireUser(req: any, res: any) {
  const token = String(req.headers?.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  const url = supabaseUrl();
  const key = publicKey();
  if (!token) { res.status(401).json({ error: "login_required" }); return null; }
  if (!url || !key || !serviceKey()) {
    res.status(503).json({ error: "supabase_server_not_configured" });
    return null;
  }
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      res.status(401).json({ error: "login_required" });
      return null;
    }
    if (!response.ok) {
      console.error("[Chat] Supabase auth returned HTTP", response.status);
      res.status(503).json({ error: "auth_unavailable" });
      return null;
    }
    const user = await response.json() as any;
    if (!user?.id || !user?.email) {
      res.status(401).json({ error: "login_required" });
      return null;
    }
    return { id: String(user.id), email: String(user.email).toLowerCase() };
  } catch (error) {
    console.error("[Chat] Supabase auth failed", error instanceof Error ? error.message : "unknown");
    res.status(503).json({ error: "auth_unavailable" });
    return null;
  }
}

async function consumeCredit(userId: string, cost: number, allowFree: boolean): Promise<"free" | "paid" | null> {
  const result = await supabaseRest("rpc/hotgpt_consume_credit", {
    method: "POST", body: JSON.stringify({ p_user_id: userId, p_cost: cost, p_allow_free: allowFree }),
  });
  return result === "free" || result === "paid" ? result : null;
}
async function refundCredit(userId: string, kind: "free" | "paid", cost: number) {
  await supabaseRest("rpc/hotgpt_refund_credit", {
    method: "POST", body: JSON.stringify({ p_user_id: userId, p_kind: kind, p_cost: cost }),
  });
}

async function searchInternet(query: string, darkWebSearch = false): Promise<string> {
  const cleanQuery = query.trim().slice(0, 500);
  if (!cleanQuery) throw new Error("web_search_failed");

  const tavilyKey = (process.env.TAVILY_API_KEY || "").trim();
  const firecrawlKey = (process.env.FIRECRAWL_API_KEY || "").trim();
  console.info("[Search] Configuration", JSON.stringify({
    tavilyConfigured: Boolean(tavilyKey),
    firecrawlConfigured: Boolean(firecrawlKey),
  }));
  if (!tavilyKey && !firecrawlKey) throw new Error("web_search_not_configured");

  type SearchItem = { title: string; url: string; content: string };
  const deepResearch =
    cleanQuery.length > 35 ||
    /\b(compare|comparison|rank|ranking|top\s+\d+|versus|vs\.|research|comprehensive|deep dive|latest news|latest breach|recent breach|data breach|security incident|cyberattack|sources|official sources|analy[sz]e|in depth|defen[cs]e|IAB|initial access|strategy|detailed|deep|complete|full)\b|مقارنة|قارن|ترتيب|رتب|أفضل\s+\d+|افضل\s+\d+|الأفضل|الافضل|بحث شامل|بحث معمق|مصادر|المصادر الرسمية|آخر الأخبار|احدث|أحدث|أحدث اختراق|أحدث تسريب|اختراق حديث|تسريب حديث|تحليل مفصل|دراسة مفصلة|بالتفصيل|حماية|دفاعي|دفاع|استراتيجية|استراتيجي|IAB|Initial Access|أكبر 3|أكبر ثلاثة|تفصيلي|عميق|كامل/i.test(cleanQuery) ||
    /(?:أكبر|أفضل|افضل|top|largest|best)\s*(?:3|٣|three|[3-9]\d*)|(?:[3-9]\d*|[٣٤٥٦٧٨٩]|three|four|five|six|seven|eight|nine)\s*(?:أسواق|اسواق|عناصر|نقاط|أمثلة|امثلة|أسئلة|اسئلة|خطوات|markets|items|points|examples|questions|steps)/i.test(cleanQuery);

  const normalizeItems = (items: any[], maxContent: number): SearchItem[] =>
    items.map((item: any): SearchItem => ({
      title: String(item.title || item.name || "Search result").slice(0, 200),
      url: String(item.url || item.link || "").slice(0, 1000),
      content: String(item.content || item.description || item.snippet || item.markdown || "").slice(0, maxContent),
    })).filter((item) => /^https?:\/\//i.test(item.url) && item.title.trim() && item.content.trim());

  const runTavily = async (): Promise<SearchItem[]> => {
    if (!tavilyKey) return [];
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: cleanQuery,
        search_depth: deepResearch ? "advanced" : "basic",
        max_results: 8,
        include_answer: true,
        time_range: darkWebSearch ? "week" : /(?:سعر|أسعار|الدولار|ذهب|الذهب|عيار|gold|price|usd|exchange rate)/i.test(cleanQuery) ? "day" : undefined,
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) {
      console.warn("[Search] Tavily failed", JSON.stringify({ status: response.status }));
      throw new Error("tavily_http_" + response.status);
    }
    const data = await response.json() as any;
    const items = normalizeItems(Array.isArray(data.results) ? data.results : [], deepResearch ? 2200 : 1500);
    console.info("[Search] Tavily completed", JSON.stringify({ resultCount: items.length, answerAvailable: Boolean(data.answer) }));
    return items;
  };  const runFirecrawlSearch = async (): Promise<SearchItem[]> => {    if (!firecrawlKey) return [];
    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + firecrawlKey },
      body: JSON.stringify({ query: cleanQuery, limit: deepResearch ? 8 : 5, sources: ["web"] }),
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      console.warn("[Search] Firecrawl search failed", JSON.stringify({ status: response.status }));
      throw new Error("firecrawl_search_http_" + response.status);
    }
    const payload = await response.json() as any;
    const items = normalizeItems(Array.isArray(payload.data) ? payload.data : [], deepResearch ? 2200 : 1500);
    console.info("[Search] Firecrawl completed", JSON.stringify({ resultCount: items.length }));
    return items;
  };

  const [tavilyResult, firecrawlResult] = await Promise.allSettled([
    runTavily(),
    runFirecrawlSearch(),
  ]);
  const tavilyItems = tavilyResult.status === "fulfilled" ? tavilyResult.value : [];
  const firecrawlItems = firecrawlResult.status === "fulfilled" ? firecrawlResult.value : [];
  if (tavilyResult.status === "rejected") {
    console.warn("[Search] Tavily unavailable", JSON.stringify({
      reason: tavilyResult.reason instanceof Error ? tavilyResult.reason.message : "unknown",
    }));
  }
  if (firecrawlResult.status === "rejected") {
    console.warn("[Search] Firecrawl unavailable", JSON.stringify({
      reason: firecrawlResult.reason instanceof Error ? firecrawlResult.reason.message : "unknown",
    }));
  }

  // Either provider can independently satisfy search; one outage must not poison the other.
  const merged = [...tavilyItems, ...firecrawlItems];
  const seen = new Set<string>();
  const unique = merged.filter((item) => {
    try {
      const parsed = new URL(item.url);
      parsed.hash = "";
      const key = parsed.toString().replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch {
      return false;
    }
  }).filter((item) =>
    item.title.trim() && item.content.trim() &&
    !/profile image|jordan host|all right reserved/i.test(item.title + " " + item.content)
  ).slice(0, 8);

  if (!unique.length) {
    console.error("[Search] All search sources failed or returned no usable results", JSON.stringify({
      tavilyConfigured: Boolean(tavilyKey),
      firecrawlConfigured: Boolean(firecrawlKey),
      tavilyStatus: tavilyResult.status,
      firecrawlStatus: firecrawlResult.status,
    }));
    throw new Error("web_search_failed");
  }

  console.info("[Search] Search succeeded", JSON.stringify({
    sourceCount: unique.length,
    tavilyCount: tavilyItems.length,
    firecrawlCount: firecrawlItems.length,
    deepResearch,
  }));

  return [
    "## " + (deepResearch ? "نتائج البحث الموسع" : "نتائج البحث"),
    "",
    ...unique.map((item, index) =>
      "### " + (index + 1) + ". [" + item.title.replace(/[\[\]]/g, "") + "](" + item.url + ")\n\n" + item.content.trim()
    ),
    "",
    "عدد المصادر: " + unique.length,
  ].join("\n\n").slice(0, deepResearch ? 14000 : 9000);
}
async function getWallet(userId: string) {
  const rows = await supabaseRest(`wallets?user_id=eq.${encodeURIComponent(userId)}&select=free_answers_used,token_balance&limit=1`);
  if (!rows?.[0]) throw new Error("wallet_not_found");
  return {
    freeAnswersUsed: Number(rows[0].free_answers_used),
    tokenBalance: Number(rows[0].token_balance),
    freeAnswersRemaining: Math.max(0, 2 - Number(rows[0].free_answers_used)),
  };
}

async function createAssistantMessage(userId: string, conversationId: string) {
  const owners = await supabaseRest(`conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`);
  if (!owners?.[0]) throw new Error("conversation_not_found");
  const rows = await supabaseRest("messages?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ conversation_id: conversationId, user_id: userId, role: "assistant", content: "", is_complete: false, part_count: 1, last_finish_reason: null }) });
  if (typeof rows?.[0]?.id !== "string") throw new Error("assistant_message_create_failed");
  return rows[0].id as string;
}
async function updateAssistantMessage(userId: string, messageId: string, patch: Record<string, unknown>) {
  await supabaseRest(`messages?id=eq.${encodeURIComponent(messageId)}&user_id=eq.${encodeURIComponent(userId)}&role=eq.assistant`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
}
async function chargeChatPart(userId: string, messageId: string, partIndex: number) {
  return await supabaseRest("rpc/hotgpt_charge_chat_part", { method: "POST", body: JSON.stringify({ p_user_id: userId, p_message_id: messageId, p_part_index: partIndex, p_cost: 5 }) }) as { charged?: boolean; duplicate?: boolean; insufficient?: boolean; user_credits?: number };
}
async function refundChatPart(userId: string, messageId: string, partIndex: number) {
  return await supabaseRest("rpc/hotgpt_refund_chat_part", { method: "POST", body: JSON.stringify({ p_user_id: userId, p_message_id: messageId, p_part_index: partIndex, p_cost: 5 }) });
}

async function saveMessage(userId: string, conversationId: string, role: "user" | "assistant", content: string) {
  const owners = await supabaseRest(`conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,title&limit=1`);
  const conversation = owners?.[0];
  if (!conversation) throw new Error("conversation_not_found");
  await supabaseRest("messages?select=id", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ conversation_id: conversationId, user_id: userId, role, content }),
  });
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (role === "user" && conversation.title === "محادثة جديدة") patch.title = content.slice(0, 80);
  await supabaseRest(`conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

function sanitizeSearchAnswer(content: string): string {
  const blocked = /(?:إذا كانت المهمة|إذا كان المطلوب قيمة واحدة|ملاحظة للمبرمج|if the task expects|if a single value is required|developer note|internal evaluation value)/i;
  return content.split(/\n+/).filter((line) => !blocked.test(line)).join("\n").replace(/\b(?:Tavily|Firecrawl|OpenRouter|MiMo|CTF|verbatim)\b/gi, "مصادر البحث").replace(/\n{3,}/g, "\n\n").trim();
}

function classifyPremiumAnswer(content: string): { cost: 3 | 5 | 9; tier: "simple" | "deep" | "report"; labelAr: string; labelEn: string } {
  const wordCount = content.trim().split(/\s+/u).filter(Boolean).length;
  const fence = String.fromCharCode(96).repeat(3);
  const codeBlocks = (content.match(new RegExp(fence + "[\\s\\S]*?" + fence, "g")) || []).length;
  const hasTable = /^\s*\|.*\|\s*$/m.test(content) || /\b(compare|comparison|versus)\b|مقارنة|قارن/i.test(content);
  if (wordCount > 2000 || codeBlocks >= 2) return { cost: 9, tier: "report", labelAr: "تقرير طويل شامل", labelEn: "Comprehensive full report" };
 
      streamHeartbeat = setInterval(() => {
        if (!res.writableEnded) res.write(": keep-alive\n\n");
      }, 10000);
    }
    for (const provider of providers) {
      if (streamToClient) writeStreamEvent({ type: "attempt", provider: provider.name });
      console.info("[Chat] Provider attempt started", JSON.stringify({ requestId, provider: provider.name, model: provider.model }));
      let attemptStreamedContent = "";
      const providerStartedAt = Date.now();
      let firstContentAt: number | null = null;
      let attemptReasoningChars = 0;
      let attemptContentType = "";
      let lastThinkingEmitAt = 0;
      const noteReasoningActivity = (piece: unknown) => {
        if (typeof piece !== "string" || !piece) return;
        attemptReasoningChars += piece.length;
        if (streamToClient && Date.now() - lastThinkingEmitAt > 1500) {
          lastThinkingEmitAt = Date.now();
          writeStreamEvent({ type: "thinking" });
        }
      };
      try {
        const upstream = await fetch(provider.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${provider.key}`,
            ...(provider.name === "openrouter-fallback" ? {
              "HTTP-Referer": "https://hot-gpt-ai.vercel.app",
              "X-Title": "HotGPT",
            } : {}),
          },
          body: JSON.stringify({
            model: provider.model,
            messages: outgoingMessages,
            max_tokens: paidStagedRequest ? STAGE_MAX : darkWebEnabled ? 4000 : extended || selectedModel === "dadgpt-beast" ? 4096 : 2048,
            temperature: darkWebEnabled ? 0.2 : 0.7,
            stream: streamToClient,
          }),
          // Streamed staged requests get up to 55s: the Beast provider can spend a
          // long invisible reasoning phase before its first content delta, and the
          // old 28s cap killed those requests outright (log 2026-10-25: attempt
          // started 18:16:52, provider_timeout at exactly 28.02s, zero content).
          // 55s stays below Vercel's 60-second function ceiling.
          signal: AbortSignal.timeout(streamToClient && paidStagedRequest ? 55000 : provider.name === "primary" ? 28000 : 24000),
        });
        // Read the body once as text. Some compatible providers return SSE or
        // non-JSON error pages even when the status is 200; response.json()
        // silently replaced those useful diagnostics with an empty object.
        const contentType = upstream.headers.get("content-type") || "";
        attemptContentType = contentType;
        let responseText = "";
        let payload: any = null;
        let jsonParseFailed = false;
        attemptStreamedContent = "";
        if (streamToClient && upstream.ok && upstream.body && /text\/event-stream/i.test(contentType)) {
          const reader = upstream.body.getReader();
          const decoder = new TextDecoder();
          let pending = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              responseText += chunk;
              pending += chunk;
              const lines = pending.split(/\r?\n/);
              pending = lines.pop() || "";
              for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine.startsWith("data:")) continue;
                const data = trimmedLine.slice(5).trim();
                if (!data || data === "[DONE]") continue;
                try {
                  const event = JSON.parse(data);
                  if (event?.error) { payload = event; continue; }
                  const choice = event?.choices?.[0];
                  noteReasoningActivity(choice?.delta?.reasoning_content ?? choice?.delta?.reasoning);
                  const piece = choice?.delta?.content ?? choice?.message?.content ?? choice?.text;
                  const textPiece = typeof piece === "string" ? piece
                    : Array.isArray(piece) ? piece.map((part: any) => typeof part?.text === "string" ? part.text : "").join("") : "";
                  if (textPiece) {
                    attemptStreamedContent += textPiece;
                    if (firstContentAt === null) firstContentAt = Date.now();
                    writeStreamEvent({ type: "delta", content: textPiece });
                  }
                  if (event && typeof event === "object" && (event.choices || event.error)) payload = event;
                } catch { /* Ignore malformed provider keepalive frames. */ }
              }
            }
            const trailingLine = pending.trim();
            if (trailingLine.startsWith("data:")) {
              const trailingData = trailingLine.slice(5).trim();
              if (trailingData && trailingData !== "[DONE]") {
                try {
                  const event = JSON.parse(trailingData);
                  const choice = event?.choices?.[0];
                  noteReasoningActivity(choice?.delta?.reasoning_content ?? choice?.delta?.reasoning);
                  const piece = choice?.delta?.content ?? choice?.message?.content ?? choice?.text;
                  const textPiece = typeof piece === "string" ? piece
                    : Array.isArray(piece) ? piece.map((part: any) => typeof part?.text === "string" ? part.text : "").join("") : "";
                  if (textPiece) {
                    attemptStreamedContent += textPiece;
                    if (firstContentAt === null) firstContentAt = Date.now();
                    writeStreamEvent({ type: "delta", content: textPiece });
                  }
                  if (event && typeof event === "object" && (event.choices || event.error)) payload = event;
                } catch { /* Ignore an incomplete final provider frame. */ }
              }
            }
          } finally {
            reader.releaseLock();
          }
        } else {
          responseText = await upstream.text();
          try {
            payload = responseText.trim() ? JSON.parse(responseText) : null;
          } catch {
            jsonParseFailed = true;
            for (const line of responseText.split(/\r?\n/)) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith("data:")) continue;
              const data = trimmedLine.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const event = JSON.parse(data);
                const choice = event?.choices?.[0];
                noteReasoningActivity(choice?.delta?.reasoning_content ?? choice?.delta?.reasoning);
                const piece = choice?.delta?.content ?? choice?.message?.content ?? choice?.text;
                if (typeof piece === "string") { attemptStreamedContent += piece; if (firstContentAt === null && piece) firstContentAt = Date.now(); if (piece) writeStreamEvent({ type: "delta", content: piece }); }
                else if (Array.isArray(piece)) { const pieceText = piece.map((part: any) => typeof part?.text === "string" ? part.text : "").join(""); attemptStreamedContent += pieceText; if (firstContentAt === null && pieceText) firstContentAt = Date.now(); if (pieceText) writeStreamEvent({ type: "delta", content: pieceText }); }
                if (event && typeof event === "object" && (event.choices || event.error)) payload = event;
              } catch { /* Ignore malformed provider frames. */ }
            }
          }
        }

        if (!upstream.ok) {
          const providerError = payload?.error;
          lastFailure = upstream.status === 429 ? "provider_rate_limited" : "provider_request_failed";
          console.warn("[Chat] Provider attempt failed", JSON.stringify({
            requestId,
            provider: provider.name,
            status: upstream.status,
            reason: lastFailure,
            contentType,
            bodyLength: responseText.length,
            errorCode: providerError?.code ?? null,
            errorType: providerError?.type ?? null,
          }));
          if (provider.name === "primary") primaryFailed = true;
          continue;
        }

        const choice = payload?.choices?.[0];
        const providerFinishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
        console.info("[Chat] Provider stream metrics", JSON.stringify({ requestId, provider: provider.name, model: provider.model, contentType, firstDeltaMs: firstContentAt === null ? null : firstContentAt - providerStartedAt, totalMs: Date.now() - providerStartedAt, finishReason: providerFinishReason, streamed: /text\/event-stream/i.test(contentType), reasoningChars: attemptReasoningChars, contentChars: attemptStreamedContent.length }));
        const messageContent = choice?.message?.content;
        const usableMessageContent = typeof messageContent === "string" && messageContent.trim()
          ? messageContent
          : Array.isArray(messageContent) && messageContent.length
            ? messageContent
            : undefined;
        const raw = usableMessageContent ?? payload?.output_text ?? (attemptStreamedContent || choice?.delta?.content || choice?.text || "");
        const candidate = typeof raw === "string"
          ? raw
          : Array.isArray(raw)
            ? raw.map((part: any) => typeof part?.text === "string" ? part.text : "").join("")
            : "";
        if (attemptStreamedContent.length > bestPartialContent.length) bestPartialContent = attemptStreamedContent;
        if (!candidate.trim()) {
          lastFailure = "provider_empty_response";
          console.warn("[Chat] Provider returned an empty response", JSON.stringify({
            requestId,
            provider: provider.name,
            status: upstream.status,
            reason: lastFailure,
            contentType,
            bodyLength: responseText.length,
            jsonParseFailed,
            bodyLooksLikeHtml: /<\s*!doctype|<\s*html/i.test(responseText.slice(0, 300)),
            payloadKeys: payload && typeof payload === "object" ? Object.keys(payload).slice(0, 12) : [],
            choiceCount: Array.isArray(payload?.choices) ? payload.choices.length : 0,
            finishReason: choice?.finish_reason ?? null,
            messageKeys: choice?.message && typeof choice.message === "object" ? Object.keys(choice.message).slice(0, 12) : [],
            errorCode: payload?.error?.code ?? null,
            errorType: payload?.error?.type ?? null,          }));
          if (provider.name === "primary") primaryFailed = true;
          continue;
        }        const normalizedCandidate = candidate.trim();
        const darkWebMinimumChars = darkWebEnabled ? 1500 : 600;
        const finishReason = choice?.finish_reason ?? payload?.choices?.[0]?.finish_reason ?? null;
        lastFinishReason = typeof finishReason === "string" ? finishReason : null;
        if (finishReason === "length" && paidStagedRequest) continuationAvailable = true;
        if (darkWebEnabled && ((normalizedCandidate.length < darkWebMinimumChars && !(paidStagedRequest && finishReason === "length")) || (!paidStagedRequest && finishReason === "length"))) {          lastFailure = finishReason === "length" ? "provider_output_truncated" : "provider_response_too_short";
          console.warn("[DarkWeb] Provider response incomplete; trying next provider", JSON.stringify({
            requestId, provider: provider.name, chars: normalizedCandidate.length,
            minimumChars: darkWebMinimumChars, finishReason,
          }));
          if (provider.name === "primary") primaryFailed = true;
          continue;
        }
        // Some upstream safety preflight responses are metadata, not an assistant answer.
        // Never show this marker to the user; treat a marker-only response as a failed attempt and fail over.
        const withoutSafetyMarker = normalizedCandidate.replace(/^User Safety:\s*safe\s*\r?\n?/i, "").trim();
        if (!withoutSafetyMarker || /^User Safety:\s*safe\s*$/i.test(normalizedCandidate)) {
          lastFailure = "provider_non_answer_response";
          console.warn("[Chat] Provider returned a non-answer safety marker", JSON.stringify({ requestId, provider: provider.name, model: provider.model }));
          if (provider.name === "primary") primaryFailed = true;
          continue;
        }
        content = withoutSafetyMarker;
        console.info("[Chat] Provider answered successfully", JSON.stringify({ requestId, provider: provider.name, model: provider.model, fallbackUsed: provider.name !== "primary" }));
        break;
      } catch (providerError) {
        if (attemptStreamedContent.length > bestPartialContent.length) bestPartialContent = attemptStreamedContent;
        lastFailure = providerError instanceof Error && (providerError.name === "TimeoutError" || providerError.name === "AbortError")
          ? "provider_timeout"
          : "provider_request_failed";
        console.warn("[Chat] Provider attempt failed", JSON.stringify({ requestId, provider: provider.name, reason: lastFailure, totalMs: Date.now() - providerStartedAt, firstDeltaMs: firstContentAt === null ? null : firstContentAt - providerStartedAt, contentType: attemptContentType, contentChars: attemptStreamedContent.length, reasoningChars: attemptReasoningChars }));
        if (provider.name === "primary") primaryFailed = true;
      }
    }

    if (!content && streamToClient && bestPartialContent.trim() && !darkWebEnabled) {
      content = bestPartialContent.trim();
      partialResponse = true;
      console.warn("[Chat] Saving partial response after provider failure", JSON.stringify({ requestId, chars: content.length, lastFailure }));
    }
    if (!content && (webSearchEnabled || darkWebEnabled)) {
      console.warn("[Chat] Search synthesis failed; refusing to expose raw search results", JSON.stringify({ requestId, lastFailure }));
    }
    if (!content) {
      console.error("[Chat] All providers failed", JSON.stringify({ requestId, primaryConfigured: Boolean(endpoint && apiKey), secondaryProviderConfigured: false, lastFailure }));
      if (paidStagedRequest && chargeSucceeded && stagedMessageId && chargedPartIndex !== null) {
        try { await refundChatPart(user.id, stagedMessageId, chargedPartIndex); await updateAssistantMessage(user.id, stagedMessageId, { is_complete: true, last_finish_reason: lastFailure }); }
        catch (refundError) { console.error("[Billing] Chat part refund failed", refundError instanceof Error ? refundError.message : "unknown"); }
      }
      if (credit) { try { await refundCredit(user.id, credit, creditCost); } catch (error) { console.error("[Billing] Credit refund failed", error instanceof Error ? error.message : "unknown"); } }
      if (streamToClient) {
        if (streamHeartbeat) clearInterval(streamHeartbeat);
        writeStreamEvent({ type: "error", error: lastFailure });
        return res.end();
      }
      return res.status(lastFailure === "provider_timeout" ? 504 : 502).json({ error: lastFailure });
    }

    // Replace the obsolete truncation warning with the requested consistent sign-off.
    const answerWithoutOldNotice = content
      .replace(/\n*\s*>?\s*توقف التوليد قبل اكتمال الإجابة؛ راجع المحتوى أعلاه قبل استخدامه\.?/g, "")
      .replace(/\n*\s*>?\s*توقف الاتصال قبل اكتمال الإجابة؛ راجع المحتوى أعلاه قبل استخدامه\.?/g, "")
      .trim();
    const finalContent = answerWithoutOldNotice;
    const cleanFinalContent = (webSearchEnabled || darkWebEnabled) ? sanitizeSearchAnswer(finalContent) : finalContent;
    const isComplete = !paidStagedRequest || (!partialResponse && ["stop", "end_turn", "completed", "eos_token"].includes(String(lastFinishReason)));
    const billing: { cost: number; tier: string; labelAr: string; labelEn: string } | null = null;
    if (paidStagedRequest && stagedMessageId) {
      await updateAssistantMessage(user.id, stagedMessageId, { content: cleanFinalContent, created_at: new Date().toISOString(), is_complete: isComplete, part_count: 1, last_finish_reason: lastFinishReason || (partialResponse ? "provider_interrupted" : null) });
      stagedOutputPersisted = true;
    } else {
      await saveMessage(user.id, conversationId, "assistant", cleanFinalContent);
    }
    if ((partialResponse || searchSynthesisFallback) && credit) {
      try { await refundCredit(user.id, credit, creditCost); } catch (error) {
        console.error("[Billing] Failed-generation credit refund failed", JSON.stringify({
          requestId,
          reason: partialResponse ? "partial_response" : "search_synthesis_failed",
          error: error instanceof Error ? error.message : "unknown",
        }));
      }
    }
    let wallet = null;
    try { wallet = await getWallet(user.id); } catch { /* Do not charge twice if the answer was persisted. */ }
    if (streamToClient) {
      if (streamHeartbeat) clearInterval(streamHeartbeat);
      let finalWallet = wallet;
      if (partialResponse) {
        try { finalWallet = await getWallet(user.id); } catch { /* Refresh balance on next load. */ }
      }
      writeStreamEvent({ type: "done", content: cleanFinalContent, wallet: finalWallet, conversationId, partial: partialResponse, continuationAvailable: paidStagedRequest ? !isComplete : continuationAvailable, messageId: stagedMessageId, is_complete: isComplete, part_count: paidStagedRequest ? 1 : undefined, last_finish_reason: lastFinishReason, billing });
      return res.end();
    }
    return res.status(200).json({ content: cleanFinalContent, wallet, conversationId, partial: partialResponse, continuationAvailable: paidStagedRequest ? !isComplete : continuationAvailable, messageId: stagedMessageId, is_complete: isComplete, part_count: paidStagedRequest ? 1 : undefined, last_finish_reason: lastFinishReason, billing, ...((webSearchEnabled || darkWebEnabled) ? { searchMode: webSearchEnabled, darkWebMode: darkWebEnabled } : {}) });
  } catch (error: any) {
    if (paidStagedRequest && chargeSucceeded && stagedMessageId && chargedPartIndex !== null && !stagedOutputPersisted) {
      try { await refundChatPart(user.id, stagedMessageId, chargedPartIndex); await updateAssistantMessage(user.id, stagedMessageId, { is_complete: true, last_finish_reason: "request_failed" }); }
      catch (refundError) { console.error("[Billing] Chat part refund failed", refundError instanceof Error ? refundError.message : "unknown"); }
    }
    if (credit) { try { await refundCredit(user.id, credit, creditCost); } catch (refundError) {
      console.error("[Billing] Credit refund failed", refundError instanceof Error ? refundError.message : "unknown");
    } }
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    console.error("[Chat] Request failed", error instanceof Error ? error.message : "unknown");
    if (res.headersSent) {
      if (streamHeartbeat) clearInterval(streamHeartbeat);
      res.write(`data: ${JSON.stringify({ type: "error", error: timeout ? "provider_timeout" : "chat_request_failed" })}\n\n`);
      return res.end();
    }
    return res.status(timeout ? 504 : 502).json({
      error: timeout ? "provider_timeout" : "chat_request_failed",
    });
  }
}
