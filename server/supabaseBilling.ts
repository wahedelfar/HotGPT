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
  // Proof fingerprint for the auto-approval duplicate check (build part D):
  // computed from the exact uploaded bytes, before storage.
  const proofHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const path = `${input.userId}/${crypto.randomUUID()}.${ext}`;
  const { url, key } = config();
  const upload = await fetch(`${url}/storage/v1/object/hotgpt-payment-proofs/${path}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": `image/${match[1]}`, "x-upsert": "false" },
    body: bytes,
  });
  if (!upload.ok) {
    const detail = await upload.text().catch(() => "");
    console.error("[Billing] Proof upload failed", upload.status, detail.slice(0, 300));
    throw new Error("proof_upload_failed");
  }
  try {
    const rows = await rest("payment_requests?select=id,status,proof_path", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: input.userId, email: input.email.toLowerCase(), payment_method: input.paymentMethod,
        package_tokens: input.packageTokens, amount_egp: input.amountEgp,
        transfer_reference: input.transferReference?.trim() || null, proof_path: path, status: "pending",
        proof_hash: proofHash,
      }),
    });
    const inserted = rows?.[0] || (() => { throw new Error("payment_insert_failed"); })();
    return { id: inserted.id, status: inserted.status, proofPath: inserted.proof_path };
  } catch (error) {
    await fetch(`${url}/storage/v1/object/hotgpt-payment-proofs/${path}`, {
      method: "DELETE", headers: { apikey: key, authorization: `Bearer ${key}` },
    }).catch(cleanupError => console.error("[Billing] Orphan proof cleanup failed", cleanupError instanceof Error ? cleanupError.message : "unknown"));
    if (error instanceof Error && error.message === "payment_insert_failed") throw error;
    throw new Error("payment_insert_failed");
  }
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
  const rows = await rest("payment_requests?select=id,user_id,email,payment_method,package_tokens,amount_egp,transfer_reference,status,created_at,reviewed_at,reviewed_by,bridge_status,review_source,notify_on_approval,auto_check,auto_reference&order=created_at.desc&limit=200");
  return (rows || []).map((row: any) => ({
    id: row.id, userId: row.user_id, email: row.email, paymentMethod: row.payment_method,
    packageTokens: Number(row.package_tokens), amountEgp: Number(row.amount_egp),
    transferReference: row.transfer_reference, status: row.status, createdAt: row.created_at,
    reviewedAt: row.reviewed_at, reviewedBy: row.reviewed_by,
    bridgeStatus: row.bridge_status, reviewSource: row.review_source,
    notifyOnApproval: row.notify_on_approval, autoCheck: row.auto_check, autoReference: row.auto_reference,
  }));
}

export async function recordFunnelEvent(input: { userId: string; name: string; path: string; metadata: Record<string, unknown> }) {
  await rest("analytics_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: input.userId, event_name: input.name, path: input.path || null, metadata: input.metadata }),
  });
}

export async function listUserPaymentRequests(userId: string) {
  const rows = await rest(`payment_requests?user_id=eq.${encodeURIComponent(userId)}&select=id,payment_method,package_tokens,amount_egp,status,created_at,reviewed_at,notify_on_approval,approval_notice_seen_at,bridge_status,member_notice_text&order=created_at.desc&limit=20`);
  return (rows || []).map((row: any) => ({
    id: String(row.id), paymentMethod: row.payment_method,
    packageTokens: Number(row.package_tokens), amountEgp: Number(row.amount_egp),
    status: String(row.status), createdAt: row.created_at, reviewedAt: row.reviewed_at,
    notifyOnApproval: row.notify_on_approval, approvalNoticeSeenAt: row.approval_notice_seen_at,
    bridgeStatus: row.bridge_status, memberNoticeText: row.member_notice_text,
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

export async function deletePaymentRequest(paymentId: string) {
  const rows = await rest(`payment_requests?id=eq.${encodeURIComponent(paymentId)}&select=id,proof_path&limit=1`);
  if (!rows?.[0]) return false;
  const proofPath = rows[0].proof_path;
  await rest(`payment_requests?id=eq.${encodeURIComponent(paymentId)}`, {
    method: "DELETE", headers: { Prefer: "return=minimal" },
  });
  // Best-effort: remove the uploaded proof image too, so deleted requests do
  // not leave orphaned files accumulating in the proofs bucket. PayPal audit
  // rows carry the "paypal-auto" marker instead of an uploaded file path.
  if (proofPath && proofPath !== "paypal-auto") {
    try {
      const { url, key } = config();
      await fetch(`${url}/storage/v1/object/hotgpt-payment-proofs/${proofPath}`, {
        method: "DELETE", headers: { apikey: key, authorization: `Bearer ${key}` },
      });
    } catch { /* the row is already deleted; a leftover file can be cleaned manually */ }
  }
  return true;
}

export async function reviewPaymentRequest(paymentId: string, approve: boolean, reviewedBy: string) {
  return await rest("rpc/hotgpt_review_payment", {
    method: "POST",
    body: JSON.stringify({ p_payment_id: paymentId, p_approve: approve, p_reviewer: reviewedBy }),
  });
}

// --- Telegram payment gateway (v1): the 5-token bridge gift granted the
// moment a manual payment request is submitted, and the single shared
// review entry point used by the admin panel, the Telegram admin buttons
// and (later) the auto-approval checker. The hotgpt_review_payment RPC
// stays the untouchable core: it alone flips the status and credits the
// pack, exactly once, under its row lock. Everything below wraps it.
export const BRIDGE_GIFT_TOKENS = 5;

export async function getPaymentRequestById(requestId: string) {
  const rows = await rest(`payment_requests?id=eq.${encodeURIComponent(requestId)}&select=id,user_id,email,payment_method,package_tokens,amount_egp,transfer_reference,proof_path,status,bridge_status,proof_hash,auto_reference,auto_check,telegram_message_id,notify_on_approval&limit=1`);
  const row = rows?.[0];
  if (!row) return null;
  return {
    id: String(row.id), userId: String(row.user_id), email: row.email, paymentMethod: row.payment_method,
    packageTokens: Number(row.package_tokens), amountEgp: Number(row.amount_egp),
    transferReference: row.transfer_reference, proofPath: row.proof_path, status: String(row.status),
    bridgeStatus: String(row.bridge_status || "none"), proofHash: row.proof_hash,
    autoReference: row.auto_reference, autoCheck: row.auto_check,
    telegramMessageId: row.telegram_message_id, notifyOnApproval: row.notify_on_approval,
  };
}

export async function grantBridgeGiftIfEligible(requestId: string, userId: string): Promise<"granted" | "blocked" | "duplicate" | "none"> {
  const patchIfNone = async (bridgeStatus: string) => {
    await rest(`payment_requests?id=eq.${encodeURIComponent(requestId)}&bridge_status=eq.none`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ bridge_status: bridgeStatus }),
    });
  };
  const wallets = await rest(`wallets?user_id=eq.${encodeURIComponent(userId)}&select=token_balance,bridge_blocked&limit=1`);
  const wallet = wallets?.[0];
  if (!wallet) return "none";
  if (wallet.bridge_blocked === true) {
    await patchIfNone("blocked");
    return "blocked";
  }
  const existing = await rest(`payment_requests?user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&bridge_status=eq.granted&id=neq.${encodeURIComponent(requestId)}&select=id&limit=1`);
  if (existing?.[0]) {
    await patchIfNone("duplicate");
    return "duplicate";
  }
  // Atomic claim, mirroring the welcome-gift pattern: the PATCH only
  // matches while this request still has bridge_status 'none'.
  const claimed = await rest(`payment_requests?id=eq.${encodeURIComponent(requestId)}&status=eq.pending&bridge_status=eq.none`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ bridge_status: "granted" }),
  });
  if (!Array.isArray(claimed) || claimed.length === 0) return "none";
  // Oldest pending granted request wins: if an earlier one exists, this
  // claim raced in second and steps back to 'duplicate'.
  const grantedRows = await rest(`payment_requests?user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&bridge_status=eq.granted&select=id,created_at&order=created_at.asc`);
  const oldest = grantedRows?.[0];
  if (oldest && String(oldest.id) !== String(requestId)) {
    await rest(`payment_requests?id=eq.${encodeURIComponent(requestId)}&bridge_status=eq.granted`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ bridge_status: "duplicate" }),
    });
    return "duplicate";
  }
  const credited = await addTokensGuarded(userId, BRIDGE_GIFT_TOKENS);
  if (!credited) {
    await rest(`payment_requests?id=eq.${encodeURIComponent(requestId)}&bridge_status=eq.granted`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ bridge_status: "none" }),
    });
    console.error("[Billing] Bridge gift credit failed for request", requestId);
    return "none";
  }
  try {
    await recordFunnelEvent({
      userId, name: "bridge_gift", path: "/api/billing?action=payment",
      metadata: { payment_request_id: requestId, tokens: BRIDGE_GIFT_TOKENS },
    });
  } catch (error) {
    console.error("[Billing] Bridge gift audit failed", error instanceof Error ? error.message : "unknown");
  }
  return "granted";
}

export async function reviewPaymentRequestShared(input: {
  paymentId: string;
  decision: "approve" | "reject_fake" | "reject_unclear";
  source: "panel" | "telegram" | "auto";
  reviewer: string;
}) {
  // The steps after the RPC are sequential, not one transaction. The
  // RPC's row lock guarantees the status flip + pack credit happen
  // exactly once, and the clawback below is guarded by the row still
  // reading bridge_status 'granted', so a retry can never double-claw.
  const before = await getPaymentRequestById(input.paymentId);
  if (!before) throw new Error("payment_not_found");
  if (before.status !== "pending") throw new Error("payment_already_reviewed");
  try {
    await reviewPaymentRequest(input.paymentId, input.decision === "approve", input.reviewer);
  } catch (error) {
    // If a human decided the request between our read and the RPC, the
    // RPC's own guard fired; surface that as already-reviewed, not a 503.
    const after = await getPaymentRequestById(input.paymentId).catch(() => null);
    if (after && after.status !== "pending") throw new Error("payment_already_reviewed");
    throw error;
  }
  const row = await getPaymentRequestById(input.paymentId);
  if (!row) throw new Error("payment_not_found");
  await rest(`payment_requests?id=eq.${encodeURIComponent(input.paymentId)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ review_source: input.source }),
  });
  let bridgeStatus = row.bridgeStatus;
  if (input.decision === "reject_fake") {
    await rest(`wallets?user_id=eq.${encodeURIComponent(row.userId)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ bridge_blocked: true, updated_at: new Date().toISOString() }),
    });
    if (row.bridgeStatus === "granted") {
      const { deducted } = await clawbackTokens(row.userId, BRIDGE_GIFT_TOKENS);
      if (deducted > 0) {
        await rest(`payment_requests?id=eq.${encodeURIComponent(input.paymentId)}&bridge_status=eq.granted`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ bridge_status: "clawed_back" }),
        });
        bridgeStatus = "clawed_back";
        try {
          await recordFunnelEvent({
            userId: row.userId, name: "bridge_clawback", path: "/api/billing?action=payment",
            metadata: { payment_request_id: input.paymentId, tokens: deducted },
          });
        } catch (error) {
          console.error("[Billing] Bridge clawback audit failed", error instanceof Error ? error.message : "unknown");
        }
      }
    }
  }
  return { id: row.id, status: row.status, packageTokens: row.packageTokens, bridgeStatus };
}

export async function setPaymentRequestTelegramMessageId(requestId: string, messageId: number) {
  await rest(`payment_requests?id=eq.${encodeURIComponent(requestId)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ telegram_message_id: messageId }),
  });
}

export async function setNotifyOnApproval(userId: string, requestId: string, value: boolean): Promise<boolean> {
  const updated = await rest(`payment_requests?id=eq.${encodeURIComponent(requestId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.pending`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ notify_on_approval: value }),
  });
  return Array.isArray(updated) && updated.length > 0;
}

export async function markApprovalNoticeSeen(userId: string, requestId: string) {
  await rest(`payment_requests?id=eq.${encodeURIComponent(requestId)}&user_id=eq.${encodeURIComponent(userId)}&approval_notice_seen_at=is.null`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ approval_notice_seen_at: new Date().toISOString() }),
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

// --- Referral program (added 2026-10-29): a member's code invites a friend;
// when the friend completes their FIRST pack purchase (an approved payment
// request or an approved HotLucky order), both wallets are credited 25
// tokens exactly once. Storage: referral_codes (one code per member) and
// referrals (one row per referred member; rewarded_at is the exactly-once
// claim flag). Every function degrades quietly while the tables do not
// exist yet, so billing keeps working before the rollout SQL runs.
export const REFERRAL_REWARD_TOKENS = 25;
const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomReferralCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += REFERRAL_CODE_ALPHABET[Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length)];
  return code;
}

async function addTokensGuarded(userId: string, tokens: number): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const rows = await rest(`wallets?user_id=eq.${encodeURIComponent(userId)}&select=token_balance&limit=1`);
    if (!rows?.[0]) return false;
    const balance = Number(rows[0].token_balance);
    const updated = await rest(`wallets?user_id=eq.${encodeURIComponent(userId)}&token_balance=eq.${balance}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ token_balance: balance + tokens, updated_at: new Date().toISOString() }),
    });
    if (Array.isArray(updated) && updated.length > 0) return true;
  }
  return false;
}

export async function getOrCreateReferralCode(userId: string): Promise<string | null> {
  try {
    const rows = await rest(`referral_codes?user_id=eq.${encodeURIComponent(userId)}&select=code&limit=1`);
    if (rows?.[0]?.code) return String(rows[0].code);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomReferralCode();
      try {
        await rest("referral_codes", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: userId, code }) });
        return code;
      } catch {
        const again = await rest(`referral_codes?user_id=eq.${encodeURIComponent(userId)}&select=code&limit=1`).catch(() => null);
        if (again?.[0]?.code) return String(again[0].code);
      }
    }
    return null;
  } catch { return null; }
}

export async function attachReferral(referredId: string, rawCode: string): Promise<"attached" | "already" | "self" | "invalid" | "unavailable"> {
  const code = String(rawCode || "").trim().toUpperCase().slice(0, 16);
  if (!/^[A-Z0-9]{6,12}$/.test(code)) return "invalid";
  try {
    const owners = await rest(`referral_codes?code=eq.${encodeURIComponent(code)}&select=user_id&limit=1`);
    const referrerId = owners?.[0]?.user_id ? String(owners[0].user_id) : "";
    if (!referrerId) return "invalid";
    if (referrerId === referredId) return "self";
    const existing = await rest(`referrals?referred_id=eq.${encodeURIComponent(referredId)}&select=id&limit=1`);
    if (existing?.[0]) return "already";
    try {
      await rest("referrals", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ referrer_id: referrerId, referred_id: referredId }) });
      return "attached";
    } catch {
      const after = await rest(`referrals?referred_id=eq.${encodeURIComponent(referredId)}&select=id&limit=1`).catch(() => null);
      return after?.[0] ? "already" : "unavailable";
    }
  } catch { return "unavailable"; }
}

export async function getReferralOverview(userId: string) {
  const code = await getOrCreateReferralCode(userId);
  let invited = 0;
  let rewarded = 0;
  let myStatus: "none" | "pending" | "rewarded" = "none";
  try {
    const mine = await rest(`referrals?referrer_id=eq.${encodeURIComponent(userId)}&select=id,rewarded_at&limit=500`);
    invited = Array.isArray(mine) ? mine.length : 0;
    rewarded = (mine || []).filter((r: any) => r.rewarded_at).length;
    const incoming = await rest(`referrals?referred_id=eq.${encodeURIComponent(userId)}&select=rewarded_at&limit=1`);
    if (incoming?.[0]) myStatus = incoming[0].rewarded_at ? "rewarded" : "pending";
  } catch { /* referral tables not ready yet */ }
  return { code, invited, rewarded, earnedTokens: rewarded * REFERRAL_REWARD_TOKENS, myStatus };
}

export async function claimReferralReward(userId: string): Promise<{ credited: boolean; reason: string }> {
  try {
    const rows = await rest(`referrals?referred_id=eq.${encodeURIComponent(userId)}&select=id,referrer_id,rewarded_at&limit=1`);
    const row = rows?.[0];
    if (!row) return { credited: false, reason: "no_referral" };
    if (row.rewarded_at) return { credited: false, reason: "already_rewarded" };
    // First-purchase gate: an approved pack payment (manual review or
    // PayPal, both land in payment_requests) or an approved HotLucky order.
    // Signup alone never pays out — that is the anti-farming rule.
    const packs = await rest(`payment_requests?user_id=eq.${encodeURIComponent(userId)}&status=eq.approved&select=id&limit=1`);
    let purchased = Array.isArray(packs) && packs.length > 0;
    if (!purchased) {
      const lucky = await rest(`hotlucky_orders?user_id=eq.${encodeURIComponent(userId)}&status=eq.approved&select=id&limit=1`).catch(() => null);
      purchased = Array.isArray(lucky) && lucky.length > 0;
    }
    if (!purchased) return { credited: false, reason: "no_purchase_yet" };
    // Exactly-once: the guarded transition only matches while unrewarded.
    const claimed = await rest(`referrals?id=eq.${encodeURIComponent(row.id)}&rewarded_at=is.null`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ rewarded_at: new Date().toISOString() }),
    });
    if (!Array.isArray(claimed) || claimed.length === 0) return { credited: false, reason: "already_rewarded" };
    const friendOk = await addTokensGuarded(userId, REFERRAL_REWARD_TOKENS);
    const referrerOk = await addTokensGuarded(String(row.referrer_id), REFERRAL_REWARD_TOKENS);
    if (!friendOk || !referrerOk) console.error("[Referral] Reward flag set but a wallet credit failed", { friendOk, referrerOk });
    return { credited: true, reason: "credited" };
  } catch (error) {
    console.error("[Referral] Claim failed", error instanceof Error ? error.message : "unknown");
    return { credited: false, reason: "unavailable" };
  }
}
