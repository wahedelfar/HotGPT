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

  let endpoint: URL;
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
      body: JSON.stringify({ model, messages, max_tokens: extended ? 4096 : 2048, temperature: 0.7 }),
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
