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
  const url = supabaseUrl();
  const publicKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    serviceKey();

  // Validate the Supabase session with the public key. A missing service-role
  // key must not make a valid user appear logged out in the client.
  if (!url || !publicKey || !accessToken) throw new Error("supabase_auth_not_configured");
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publicKey, authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const user = await response.json() as any;
  if (!user?.id || !user?.email) return null;

  // Profile enrichment is optional; do not discard a valid auth session when
  // the service-role key or the profiles table is unavailable in Preview.
  let profile: any = null;
  if (serviceKey()) {
    try {
      const profiles = await rest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,display_name,role&limit=1`);
      profile = profiles?.[0] || null;
    } catch (error) {
      console.error("[Auth] Profile enrichment failed", error instanceof Error ? error.message : "unknown");
    }
  }

  return {
    id: String(user.id),
    email: String(user.email).toLowerCase(),
    name: profile?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || "",
    role: profile?.role === "admin" ? "admin" as const : "user" as const,
  };
}

export async function getWallet(userId: string) {
  const rows = await rest(`wallets?user_id=eq.${encodeURIComponent(userId)}&select=free_answers_used,token_balance,welcome_gift_claimed&limit=1`);
  if (!rows?.[0]) throw new Error("wallet_not_found");
  const row = rows[0];
  let tokenBalance = Number(row.token_balance);
  let welcomeGiftGranted = false;
  // Welcome gift (product decision, 2026-10-26): every wallet claims 5 gift
  // tokens exactly once, on its first wallet read. The claim is atomic — the
  // PATCH only matches while welcome_gift_claimed is still false, so racing
  // requests can never grant it twice. This replaces the retired 2-free-
  // answers allowance (free answers are disabled in the chat handler).
  // Requires the wallets.welcome_gift_claimed column (see the rollout SQL).
  if (row.welcome_gift_claimed === false) {
    try {
      const claimed = await rest(`wallets?user_id=eq.${encodeURIComponent(userId)}&welcome_gift_claimed=eq.false`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ token_balance: tokenBalance + 5, welcome_gift_claimed: true, updated_at: new Date().toISOString() }),
      });
      if (Array.isArray(claimed) && claimed.length > 0) {
        tokenBalance = Number(claimed[0].token_balance);
        welcomeGiftGranted = true;
      } else {
        // A concurrent request claimed the gift first. Re-read the balance so
        // this response never reports the pre-gift balance (otherwise the UI
        // shows the welcome message with a balance missing the 5 tokens
        // until the next manual page refresh).
        const fresh = await rest(`wallets?user_id=eq.${encodeURIComponent(userId)}&select=token_balance&limit=1`);
        if (fresh?.[0]) tokenBalance = Number(fresh[0].token_balance);
      }
    } catch (error) {
      console.error("[Billing] Welcome gift claim failed", error instanceof Error ? error.message : "unknown");
    }
  }
  return { freeAnswersUsed: Number(row.free_answers_used), tokenBalance, freeAnswersRemaining: 0, welcomeGiftGranted };
}

export async function consumeAnswerCredit(userId: string): Promise<"free" | "paid" | null> {
  const result = await rest("rpc/hotgpt_consume_answer_credit", { method: "POST", body: JSON.stringify({ p_user_id: userId }) });
  return result === "free" || result === "paid" ? result : null;
}

export async function refundAnswerCredit(userId: string, kind: "free" | "paid") {
  await rest("rpc/hotgpt_refund_answer_credit", { method: "POST", body: JSON.stringify({ p_user_id: userId, p_kind: kind }) });
}

export async function submitPaymentRequest(input: {
  userId: string; email: string; paymentMethod: "vodafone_cash" | "instapay" | "paypal";
  packageTokens: number; amountEgp: number; transferReference?: string; screenshotData: string;
}) {
  const match = input.screenshotData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("invalid_screenshot");
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  if (bytes.byteLength > 1_200_000) throw new Error("screenshot_too_large");
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
  const profiles = await rest("profiles?select=id,email,display_name,role,created_at&order=created_at.desc&limit=500");
  if (!profiles?.length) return [];
  const ids = profiles.map((row: any) => String(row.id));
  const wallets = await rest(`wallets?user_id=in.(${ids.join(",")})&select=user_id,free_answers_used,token_balance`);
  const walletByUser = new Map((wallets || []).map((row: any) => [String(row.user_id), row]));
  return profiles.map((row: any) => {
    const wallet: any = walletByUser.get(String(row.id));
    return {
      id: String(row.id), name: row.display_name, email: row.email, role: row.role,
      tokenBalance: Number(wallet?.token_balance || 0),
      freeAnswersUsed: Number(wallet?.free_answers_used || 0), createdAt: row.created_at,
    };
  });
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

export async function creditPurchasedTokens(userId: string, tokens: number, audit: { email: string; captureId: string; amountUsd: string }) {
  const rows = await rest(`wallets?user_id=eq.${encodeURIComponent(userId)}&select=token_balance&limit=1`);
  if (!rows?.[0]) throw new Error("wallet_not_found");
  const newBalance = Number(rows[0].token_balance) + tokens;
  const updated = await rest(`wallets?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ token_balance: newBalance, updated_at: new Date().toISOString() }),
  });
  // Admin visibility: record the automatic purchase next to the manual
  // payment requests (real USD amount and capture id ride in the reference).
  // Best-effort only — a logging failure must never block paid tokens.
  try {
    await rest("payment_requests", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: userId, email: audit.email.toLowerCase(), payment_method: "paypal",
        package_tokens: tokens, amount_egp: 0,
        transfer_reference: `paypal:${audit.captureId}:$${audit.amountUsd}`,
        proof_path: "paypal-auto", status: "approved",
      }),
    });
  } catch (error) {
    console.error("[Billing] PayPal audit record failed", error instanceof Error ? error.message : "unknown");
  }
  return Array.isArray(updated) && updated[0] ? Number(updated[0].token_balance) : newBalance;
}

// --- PayPal webhook support (added with the paypal-webhook action in
// api/billing.ts): event audit store, purchase matching and the token
// clawback used when PayPal refunds or reverses a capture. All access
// goes through the service-role REST adapter above.

export async function recordPaypalWebhookEvent(input: {
  eventId: string; eventType: string; resourceId: string | null; payload: unknown;
}): Promise<boolean> {
  // Insert-first idempotency: the unique event_id plus ignore-duplicates
  // makes PayPal's at-least-once redeliveries return an empty array here.
  const rows = await rest("paypal_webhook_events", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      event_id: input.eventId, event_type: input.eventType,
      resource_id: input.resourceId, payload: input.payload,
    }),
  });
  return Array.isArray(rows) && rows.length > 0;
}

export async function updatePaypalWebhookEvent(eventId: string, patch: {
  matchedUserId?: string | null; tokensDeducted?: number; note?: string;
}) {
  await rest(`paypal_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      matched_user_id: patch.matchedUserId ?? null,
      tokens_deducted: patch.tokensDeducted ?? 0,
      note: patch.note ?? null,
    }),
  });
}

export async function findProcessedClawback(resourceId: string) {
  const rows = await rest(`paypal_webhook_events?resource_id=eq.${encodeURIComponent(resourceId)}&tokens_deducted=gt.0&select=event_id,tokens_deducted&limit=1`);
  return rows?.[0] || null;
}

export async function findPaypalPackPurchase(captureId: string) {
  // Billing-pack purchases are audited in payment_requests by
  // creditPurchasedTokens with transfer_reference "paypal:<captureId>:$<usd>".
  const rows = await rest(`payment_requests?payment_method=eq.paypal&transfer_reference=like.${encodeURIComponent(`paypal:${captureId}:*`)}&select=id,user_id,package_tokens,transfer_reference&limit=1`);
  const row = rows?.[0];
  if (!row) return null;
  const usd = Number(String(row.transfer_reference).split(":$")[1]);
  return {
    id: String(row.id), userId: String(row.user_id),
    packageTokens: Number(row.package_tokens),
    amountUsd: Number.isFinite(usd) ? usd : 0,
  };
}

export async function clawbackTokens(userId: string, maxTokens: number): Promise<{ deducted: number; balance: number }> {
  // Guarded debit in the house pattern: read, then PATCH only if the
  // balance is still the value we read; retry a couple of times on a
  // race. Never drives the balance negative — a buyer who already spent
  // the tokens loses what is left, and the shortfall stays visible in
  // the webhook event note for the admin.
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await rest(`wallets?user_id=eq.${encodeURIComponent(userId)}&select=token_balance&limit=1`);
    if (!rows?.[0]) throw new Error("wallet_not_found");
    const balance = Number(rows[0].token_balance);
    const want = Math.min(balance, Math.max(0, Math.floor(maxTokens)));
    if (want <= 0) return { deducted: 0, balance };
    const updated = await rest(`wallets?user_id=eq.${encodeURIComponent(userId)}&token_balance=eq.${balance}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ token_balance: balance - want, updated_at: new Date().toISOString() }),
    });
    if (Array.isArray(updated) && updated.length > 0) {
      return { deducted: want, balance: Number(updated[0].token_balance) };
    }
  }
  throw new Error("clawback_race");
}

export async function findLuckySpinsByPaypalOrder(orderId: string) {
  // HotLucky PayPal bundles store one row per spin with
  // proof_path "paypal:<orderId>"; a completed spin carries
  // prize_key "t<tokens>" and a spun_at timestamp.
  const rows = await rest(`hotlucky_orders?proof_path=eq.${encodeURIComponent(`paypal:${orderId}`)}&select=id,user_id,prize_key,spun_at,status&limit=50`);
  return (rows || []).map((row: any) => ({
    id: String(row.id), userId: String(row.user_id),
    prizeTokens: typeof row.prize_key === "string" && /^t\d+$/.test(row.prize_key) ? Number(row.prize_key.slice(1)) : 0,
    spun: !!row.spun_at, status: String(row.status || ""),
  }));
}

export async function voidLuckySpin(spinId: string) {
  // Guarded: only a still-unspun, still-approved spin can be voided.
  await rest(`hotlucky_orders?id=eq.${encodeURIComponent(spinId)}&status=eq.approved&spun_at=is.null`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "voided" }),
  });
}
