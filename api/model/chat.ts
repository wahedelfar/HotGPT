
import { inflateSync } from "node:zlib";

function decodePdfLiteral(value: string): string {
  const unescaped = value.replace(/\\\\([nrtbf()\\\\])/g, (_match, char: string) => {
    const map: Record<string, string> = { n: "\\n", r: "\\r", t: "\\t", b: "\\b", f: "\\f", "(": "(", ")": ")", "\\\\": "\\\\" };
    return map[char] ?? char;
  }).replace(/\\\\([0-7]{1,3})/g, (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)));
  return unescaped;
}

function decodePdfHex(hex: string): string {
  const clean = hex.replace(/\\s/g, "");
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
  const operator = /\\(((?:\\\\.|[^\\\\)])*)\\)\\s*Tj|\\[((?:.|\\n)*?)\\]\\s*TJ|<([\\da-fA-F\\s]+)>\\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = operator.exec(source))) {
    if (match[1] !== undefined) parts.push(decodePdfLiteral(match[1]));
    else if (match[2] !== undefined) {
      const tokens = /\\(((?:\\\\.|[^\\\\)])*)\\)|<([\\da-fA-F\\s]+)>/g;
      let token: RegExpExecArray | null;
      while ((token = tokens.exec(match[2]))) parts.push(token[1] !== undefined ? decodePdfLiteral(token[1]) : decodePdfHex(token[2]));
    } else if (match[3] !== undefined) parts.push(decodePdfHex(match[3]));
    parts.push(" ");
  }
  return parts.join("").replace(/[ \\t]+/g, " ").replace(/\\n{3,}/g, "\\n\\n").trim();
}

function extractPdfText(base64: string): string {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > 3 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("invalid_pdf");
  const raw = bytes.toString("latin1");
  const chunks: string[] = [];
  const streamPattern = /<<(.*?)>>\\s*stream\\r?\\n([\\s\\S]*?)\\r?\\nendstream/g;
  let stream: RegExpExecArray | null;
  while ((stream = streamPattern.exec(raw))) {
    let content = stream[2];
    if (/\\/FlateDecode/.test(stream[1])) {
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
  return chunks.join("\\n").slice(0, 60000).trim();
}

type ChatMessage = { role: "user" | "assistant"; content: string };

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

async function consumeCredit(userId: string): Promise<"free" | "paid" | null> {
  const result = await supabaseRest("rpc/hotgpt_consume_answer_credit", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId }),
  });
  return result === "free" || result === "paid" ? result : null;
}

async function refundCredit(userId: string, kind: "free" | "paid") {
  await supabaseRest("rpc/hotgpt_refund_answer_credit", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId, p_kind: kind }),
  });
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

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const baseUrl = (process.env.NEXA_PROVIDER_BASE_URL || "").trim().replace(/\/+$/, "");
  const apiKey = process.env.NEXA_PROVIDER_API_KEY || "";
  const model = (process.env.NEXA_PROVIDER_MODEL || "").trim();

  if (!baseUrl || !apiKey || !model) {
    return res.status(503).json({ error: "provider_not_configured" });
  }

  const body = req.body ?? {};
  const messages = body.messages;
  const attachment = body.attachment;
  const extended = body.extended === true;
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return res.status(400).json({ error: "invalid_conversation_id" });

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > 40 ||
    messages[messages.length - 1]?.role !== "user" ||
    !messages.every((m: any) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0 &&
      m.content.length <= 20000
    ) ||
    messages.reduce((sum: number, m: ChatMessage) => sum + m.content.length, 0) > 80000
  ) {
    return res.status(400).json({ error: "invalid_messages" });
  }

  let attachmentText = "";\n  if (attachment !== undefined && attachment !== null) {\n    if (!attachment || typeof attachment.name !== "string" || typeof attachment.data !== "string" || attachment.data.length > 4_200_000) return res.status(400).json({ error: "invalid_attachment" });\n    const name = attachment.name.toLowerCase();\n    try {\n      if (attachment.encoding === "text" && /\\.(txt|md|csv|json)$/.test(name)) attachmentText = attachment.data.slice(0, 60000).trim();\n      else if (attachment.encoding === "base64" && (name.endsWith(".pdf") || attachment.type === "application/pdf")) attachmentText = extractPdfText(attachment.data);\n      else return res.status(400).json({ error: "unsupported_attachment" });\n    } catch (error) {\n      console.error("[Chat] Attachment extraction failed", error instanceof Error ? error.message : "unknown");\n      return res.status(400).json({ error: "attachment_read_failed" });\n    }\n    if (!attachmentText) return res.status(422).json({ error: "attachment_no_text", message: "لم أتمكن من استخراج نص من الملف. إذا كان PDF ممسوحًا ضوئيًا كصورة، فسيحتاج إلى OCR." });\n  }\n\n  let endpoint: URL;
  try {
    endpoint = new URL(baseUrl + "/chat/completions");
  } catch {
    return res.status(500).json({ error: "provider_invalid_base_url" });
  }
  if (endpoint.protocol !== "https:") return res.status(500).json({ error: "provider_https_required" });

  const user = await requireUser(req, res);
  if (!user) return;

  let credit: "free" | "paid" | null = null;
  try {
    credit = await consumeCredit(user.id);
  } catch (error) {
    console.error("[Billing] Credit reservation failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "billing_unavailable" });
  }
  if (!credit) {
    let wallet = null;
    try { wallet = await getWallet(user.id); } catch {}
    return res.status(402).json({ error: "insufficient_credits", wallet });
  }

  try {
    await saveMessage(user.id, conversationId, "user", messages[messages.length - 1].content);
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: attachmentText ? messages.map((message: ChatMessage, index: number) => index === messages.length - 1 ? { ...message, content: `${message.content}\\n\\nمحتوى الملف المرفق (${String(attachment.name).slice(0, 120)}):\\n${attachmentText}` } : message) : messages, max_tokens: extended ? 4096 : 2048, temperature: 0.7 }),
      signal: AbortSignal.timeout(60000),
    });

    const payload: any = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("[DadGPT] Provider returned HTTP", upstream.status);
      try { await refundCredit(user.id, credit); } catch (error) { console.error("[Billing] Credit refund failed", error instanceof Error ? error.message : "unknown"); }
      return res.status(502).json({ error: "provider_request_failed" });
    }

    const raw = payload?.choices?.[0]?.message?.content;
    const content = typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((part: any) => typeof part?.text === "string" ? part.text : "").join("")
        : "";
    if (!content.trim()) {
      try { await refundCredit(user.id, credit); } catch (error) { console.error("[Billing] Credit refund failed", error instanceof Error ? error.message : "unknown"); }
      return res.status(502).json({ error: "provider_empty_response" });
    }

    await saveMessage(user.id, conversationId, "assistant", content.trim());
    let wallet = null;
    try { wallet = await getWallet(user.id); } catch { /* Do not charge twice if the answer was persisted. */ }
    return res.status(200).json({ content: content.trim(), wallet, conversationId });
  } catch (error: any) {
    try { await refundCredit(user.id, credit); } catch (refundError) {
      console.error("[Billing] Credit refund failed", refundError instanceof Error ? refundError.message : "unknown");
    }
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    console.error("[Chat] Request failed", error instanceof Error ? error.message : "unknown");
    return res.status(timeout ? 504 : 502).json({
      error: timeout ? "provider_timeout" : "chat_request_failed",
    });
  }
}
