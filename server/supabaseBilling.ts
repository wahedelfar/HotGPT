/**
 * Server-only Supabase REST adapter. Uses the service-role key exclusively
 * on the server; never import this module into browser code.
 */
const supabaseUrl = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

function config() {
  const url = supabaseUrl();
  const key = serviceKey();
  if (!url || !key) throw new Error("supabase_server_not_configured");
  return { url, key };
}

async function rest(path: string, init: RequestInit = {}) {
  const { url, key } = config();
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
    console.error("[Supabase REST]", response.status, typeof payload === "object" ? payload?.code || payload?.message || "request_failed" : "request_failed");
    throw new Error("supabase_request_failed");
  }
  return payload;
}

export async function getSupabaseUser(accessToken: string) {
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const user = await response.json() as any;
  if (!user?.id || !user?.email) return null;
  const profiles = await rest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,display_name,role&limit=1`);
  const profile = profiles?.[0];
  return {
    id: String(user.id),
    email: String(user.email).toLowerCase(),
    name: profile?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || "",
    role: profile?.role === "admin" ? "admin" as const : "user" as const,
  };
}

export async function getWallet(userId: string) {
  const rows = await rest(`wallets?user_id=eq.${encodeURIComponent(userId)}&select=free_answers_used,token_balance&limit=1`);
  if (!rows?.[0]) throw new Error("wallet_not_found");
  const row = rows[0];
  return { freeAnswersUsed: Number(row.free_answers_used), tokenBalance: Number(row.token_balance), freeAnswersRemaining: Math.max(0, 2 - Number(row.free_answers_used)) };
}

export async function consumeAnswerCredit(userId: string): Promise<"free" | "paid" | null> {
  const result = await rest("rpc/hotgpt_consume_answer_credit", { method: "POST", body: JSON.stringify({ p_user_id: userId }) });
  return result === "free" || result === "paid" ? result : null;
}

export async function refundAnswerCredit(userId: string, kind: "free" | "paid") {
  await rest("rpc/hotgpt_refund_answer_credit", { method: "POST", body: JSON.stringify({ p_user_id: userId, p_kind: kind }) });
}

export async function submitPaymentRequest(input: {
  userId: string; email: string; paymentMethod: "vodafone_cash" | "paypal";
  packageTokens: number; amountEgp: number; transferReference?: string; screenshotData: string;
}) {
  const match = input.screenshotData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("invalid_screenshot");
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const path = `${input.userId}/${crypto.randomUUID()}.${ext}`;
  const { url, key } = config();
  const upload = await fetch(`${url}/storage/v1/object/hotgpt-payment-proofs/${path}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": `image/${match[1]}`, "x-upsert": "false" },
    body: bytes,
  });
  if (!upload.ok) throw new Error("proof_upload_failed");
  const rows = await rest("payment_requests?select=id,status", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: input.userId, email: input.email.toLowerCase(), payment_method: input.paymentMethod,
      package_tokens: input.packageTokens, amount_egp: input.amountEgp,
      transfer_reference: input.transferReference?.trim() || null, proof_path: path, status: "pending",
    }),
  });
  return rows?.[0] || (() => { throw new Error("payment_insert_failed"); })();
}

export async function listWalletUsers() {
  const rows = await rest("profiles?select=id,email,display_name,role,created_at,wallets(free_answers_used,token_balance)&order=created_at.desc&limit=500");
  return (rows || []).map((row: any) => ({
    id: row.id, name: row.display_name, email: row.email, role: row.role,
    tokenBalance: Number(row.wallets?.token_balance || 0),
    freeAnswersUsed: Number(row.wallets?.free_answers_used || 0), createdAt: row.created_at,
  }));
}

export async function setTokenBalanceByEmail(email: string, balance: number) {
  const normalized = email.trim().toLowerCase();
  const rows = await rest(`profiles?email=eq.${encodeURIComponent(normalized)}&select=id,email,display_name&limit=1`);
  const profile = rows?.[0];
  if (!profile) return null;
  const updated = await rest(`wallets?user_id=eq.${encodeURIComponent(profile.id)}`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ token_balance: balance, updated_at: new Date().toISOString() }),
  });
  const wallet = updated?.[0];
  return wallet ? { id: profile.id, name: profile.display_name, email: profile.email, tokenBalance: Number(wallet.token_balance), freeAnswersUsed: Number(wallet.free_answers_used) } : null;
}

export async function listPaymentRequests() {
  const rows = await rest("payment_requests?select=id,user_id,email,payment_method,package_tokens,amount_egp,transfer_reference,status,created_at,reviewed_at,reviewed_by&order=created_at.desc&limit=200");
  return (rows || []).map((row: any) => ({
    id: row.id, userId: row.user_id, email: row.email, paymentMethod: row.payment_method,
    packageTokens: Number(row.package_tokens), amountEgp: Number(row.amount_egp),
    transferReference: row.transfer_reference, status: row.status, createdAt: row.created_at,
    reviewedAt: row.reviewed_at, reviewedBy: row.reviewed_by,
  }));
}

export async function listConversations(userId: string) {
  const rows = await rest(`conversations?user_id=eq.${encodeURIComponent(userId)}&select=id,title,created_at,updated_at,messages(content,created_at)&order=updated_at.desc&limit=100&messages.order=created_at.desc&messages.limit=1`);
  return (rows || []).map((row: any) => ({
    id: String(row.id), title: String(row.title || "محادثة جديدة"),
    preview: String(row.messages?.[0]?.content || ""), date: row.updated_at || row.created_at,
  }));
}

export async function getConversation(userId: string, conversationId: string) {
  const rows = await rest(`conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,title,created_at,updated_at&limit=1`);
  const row = rows?.[0];
  if (!row) return null;
  const messages = await rest(`messages?conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,role,content,created_at&order=created_at.asc&limit=500`);
  return {
    conversation: { id: String(row.id), title: String(row.title || "محادثة جديدة"), createdAt: row.created_at, updatedAt: row.updated_at },
    messages: (messages || []).map((message: any) => ({ id: String(message.id), role: message.role, content: String(message.content), createdAt: message.created_at })),
  };
}

export async function createConversation(userId: string, title: string) {
  const rows = await rest("conversations?select=id,title,created_at,updated_at", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, title: title.slice(0, 120) || "محادثة جديدة" }),
  });
  const row = rows?.[0];
  if (!row) throw new Error("conversation_create_failed");
  return { id: String(row.id), title: String(row.title), createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function saveUserMessage(userId: string, conversationId: string, content: string) {
  const owners = await rest(`conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,title&limit=1`);
  const conversation = owners?.[0];
  if (!conversation) throw new Error("conversation_not_found");
  await rest("messages?select=id", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ conversation_id: conversationId, user_id: userId, role: "user", content }),
  });
  const title = conversation.title === "محادثة جديدة" ? content.slice(0, 80) : conversation.title;
  await rest(`conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ title, updated_at: new Date().toISOString() }),
  });
}

export async function saveAssistantMessage(userId: string, conversationId: string, content: string) {
  const owners = await rest(`conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`);
  if (!owners?.[0]) throw new Error("conversation_not_found");
  await rest("messages?select=id", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ conversation_id: conversationId, user_id: userId, role: "assistant", content }),
  });
  await rest(`conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
}

export async function getPaymentProofById(paymentId: string) {
  const rows = await rest(`payment_requests?id=eq.${encodeURIComponent(paymentId)}&select=id,email,proof_path&limit=1`);
  if (!rows?.[0]) return null;
  const row = rows[0];
  const { url, key } = config();
  const signed = await fetch(`${url}/storage/v1/object/sign/hotgpt-payment-proofs/${row.proof_path}`, {
    method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: 300 }),
  });
  if (!signed.ok) throw new Error("proof_signing_failed");
  const signedData = await signed.json() as any;
  return { id: row.id, email: row.email, proofUrl: `${url}/storage/v1${signedData.signedURL?.startsWith("/") ? "" : "/"}${signedData.signedURL}` };
}

export async function reviewPaymentRequest(paymentId: string, approve: boolean, reviewedBy: string) {
  return await rest("rpc/hotgpt_review_payment", {
    method: "POST",
    body: JSON.stringify({ p_payment_id: paymentId, p_approve: approve, p_reviewer: reviewedBy }),
  });
}
