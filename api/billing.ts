import { publicPlatformScript } from "../server/_core/publicConfig.ts";
import { requireMember } from "../server/_core/vercelAuth.ts";
import * as db from "../server/supabaseBilling.ts";
import { usdForEgp } from "../server/fxRate.ts";

export const PACKAGES: Record<number, number> = { 100: 100, 500: 300, 800: 500, 1000: 700 };

// --- PayPal Checkout (Orders API), merged into this function on 2026-10-27:
// the Hobby plan allows at most 12 serverless functions per deployment, so
// PayPal cannot live in its own api file. Prices live ONLY on the server;
// packs are EGP-priced and PayPal charges the USD equivalent at today's
// live rate (see server/fxRate.ts), rounded up to the next whole dollar.
// Fulfillment rule: credit exactly once, inside the same request that
// receives a fresh CAPTURE success from PayPal; PayPal rejects a second
// capture of the same order, so double-crediting is impossible.
function paypalBase() {
  return process.env.PAYPAL_MODE === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}
function paypalCreds() {
  const id = process.env.PAYPAL_CLIENT_ID || "";
  const secret = process.env.PAYPAL_CLIENT_SECRET || "";
  if (!id || !secret) throw new Error("paypal_not_configured");
  return { id, secret };
}
async function paypalAccessToken(): Promise<string> {
  const { id, secret } = paypalCreds();
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok || !payload.access_token) throw new Error("paypal_auth_failed");
  return String(payload.access_token);
}
async function paypalApi(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${paypalBase()}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({} as any));
  return { ok: response.ok, status: response.status, payload };
}
function paypalError(res: any, error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "paypal_not_configured") return res.status(503).json({ error: "paypal_not_configured" });
  console.error("[PayPal] Handler failed", code || "unknown");
  return res.status(502).json({ error: "paypal_unavailable" });
}


// --- PayPal webhook (action "paypal-webhook"): PayPal POSTs capture
// refunds, reversals and dispute events to this function's URL
// (https://hotgpt.pro/api/billing?action=paypal-webhook). No member
// session exists on these calls — authenticity comes from PayPal's
// verify-webhook-signature API, checked before anything is stored or
// processed. Purpose (Wahid, 2026-10-28): foreign buyers can dispute
// or charge back AFTER receiving tokens; the webhook claws the tokens
// back automatically and keeps a full audit trail in
// paypal_webhook_events. Requires PAYPAL_WEBHOOK_ID in the environment
// and the paypal_webhook_events table (rollout SQL).
function paypalHeader(req: any, name: string) {
  const value = req.headers?.[name];
  return typeof value === "string" ? value : "";
}
function extractCaptureId(event: any): string {
  const resource = event?.resource || {};
  const related = resource?.supplementary_data?.related_ids || {};
  if (typeof related.capture_id === "string" && related.capture_id) return related.capture_id;
  if (event?.event_type === "PAYMENT.CAPTURE.REVERSED" || event?.event_type === "PAYMENT.CAPTURE.DENIED") {
    return typeof resource.id === "string" ? resource.id : "";
  }
  if (Array.isArray(resource.links)) {
    for (const link of resource.links) {
      const match = String(link?.href || "").match(/\/captures\/([A-Z0-9]+)/i);
      if (match) return match[1];
    }
  }
  const disputed = resource?.disputed_transactions?.[0];
  if (typeof disputed?.seller_transaction_id === "string") return disputed.seller_transaction_id;
  return "";
}
function extractOrderId(event: any): string {
  const related = event?.resource?.supplementary_data?.related_ids || {};
  return typeof related.order_id === "string" ? related.order_id : "";
}
async function handlePaypalWebhook(req: any, res: any) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const webhookId = process.env.PAYPAL_WEBHOOK_ID || "";
  if (!webhookId) {
    console.error("[PayPal Webhook] PAYPAL_WEBHOOK_ID is not configured");
    return res.status(503).json({ error: "paypal_webhook_not_configured" });
  }
  let event: any = null;
  try {
    event = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
  } catch { event = null; }
  if (!event?.id || !event?.event_type) return res.status(400).json({ error: "invalid_event" });
  // 1) Verify the transmission really came from PayPal.
  let verified = false;
  try {
    const token = await paypalAccessToken();
    const { ok, payload } = await paypalApi(token, "/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: JSON.stringify({
        auth_algo: paypalHeader(req, "paypal-auth-algo"),
        cert_url: paypalHeader(req, "paypal-cert-url"),
        transmission_id: paypalHeader(req, "paypal-transmission-id"),
        transmission_sig: paypalHeader(req, "paypal-transmission-sig"),
        transmission_time: paypalHeader(req, "paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: event,
      }),
    });
    verified = ok && payload?.verification_status === "SUCCESS";
  } catch (error) {
    console.error("[PayPal Webhook] Verification call failed", error instanceof Error ? error.message : "unknown");
    return res.status(500).json({ error: "verification_unavailable" });
  }
  if (!verified) {
    console.error("[PayPal Webhook] Signature rejected for event", String(event.id));
    return res.status(401).json({ error: "invalid_signature" });
  }
  // 2) Store first (idempotent on event id). If the store fails the
  // rollout SQL has not run — answer 500 so PayPal retries later.
  const captureId = extractCaptureId(event);
  const orderId = extractOrderId(event);
  const resourceId = captureId || (typeof event.resource?.id === "string" ? event.resource.id : null);
  let inserted = false;
  try {
    inserted = await db.recordPaypalWebhookEvent({
      eventId: String(event.id), eventType: String(event.event_type),
      resourceId, payload: event,
    });
  } catch (error) {
    console.error("[PayPal Webhook] Event store failed", error instanceof Error ? error.message : "unknown");
    return res.status(500).json({ error: "webhook_store_failed" });
  }
  if (!inserted) return res.status(200).json({ received: true, duplicate: true });
  // 3) Process. Failures here are logged and noted on the stored event;
  // the endpoint still answers 200 so PayPal does not retry-storm —
  // the stored payload is the audit and can be replayed by hand.
  let note = "recorded_only";
  let matchedUserId: string | null = null;
  let tokensDeducted = 0;
  try {
    const type = String(event.event_type);
    if (type === "PAYMENT.CAPTURE.REFUNDED" || type === "PAYMENT.CAPTURE.REVERSED" || type === "PAYMENT.CAPTURE.DENIED") {
      if (!captureId) {
        note = "clawback_skipped_no_capture_id";
      } else if (await db.findProcessedClawback(captureId)) {
        note = "clawback_skipped_already_processed";
      } else {
        const pack = await db.findPaypalPackPurchase(captureId);
        if (pack) {
          let due = pack.packageTokens;
          if (type === "PAYMENT.CAPTURE.REFUNDED" && pack.amountUsd > 0) {
            const refunded = Number(event?.resource?.amount?.value);
            if (Number.isFinite(refunded) && refunded > 0 && refunded < pack.amountUsd) {
              due = Math.floor(pack.packageTokens * (refunded / pack.amountUsd));
            }
          }
          const result = await db.clawbackTokens(pack.userId, due);
          matchedUserId = pack.userId;
          tokensDeducted = result.deducted;
          note = result.deducted >= due
            ? `clawback_pack_full:${due}`
            : `clawback_pack_partial:due=${due},deducted=${result.deducted},balance_left=${result.balance}`;
        } else if (orderId) {
          const spins = await db.findLuckySpinsByPaypalOrder(orderId);
          if (spins.length > 0) {
            matchedUserId = spins[0].userId;
            const won = spins.reduce((sum: number, s: { spun: boolean; prizeTokens: number }) => sum + (s.spun ? s.prizeTokens : 0), 0);
            let voided = 0;
            for (const spin of spins) {
              if (!spin.spun && spin.status === "approved") {
                await db.voidLuckySpin(spin.id).catch(() => {});
                voided++;
              }
            }
            const result = won > 0
              ? await db.clawbackTokens(matchedUserId ?? "", won)
              : { deducted: 0, balance: 0 };
            tokensDeducted = result.deducted;
            note = `clawback_lucky:won=${won},deducted=${result.deducted},spins_voided=${voided}`;
          } else {
            note = "clawback_unmatched_purchase";
          }
        } else {
          note = "clawback_unmatched_purchase";
        }
      }
    } else if (type === "CUSTOMER.DISPUTE.CREATED") {
      // Flag only — PayPal has not moved money yet, and the dispute can
      // still be won with the audit trail (payment_requests + ledger).
      const pack = captureId ? await db.findPaypalPackPurchase(captureId) : null;
      matchedUserId = pack?.userId ?? null;
      note = pack ? "dispute_opened_flagged" : "dispute_opened_unmatched";
    } else if (type === "CUSTOMER.DISPUTE.RESOLVED") {
      const pack = captureId ? await db.findPaypalPackPurchase(captureId) : null;
      matchedUserId = pack?.userId ?? null;
      const outcome = String(event?.resource?.dispute_outcome?.outcome_code || "unknown");
      note = `dispute_resolved:${outcome}`;
    }
  } catch (error) {
    console.error("[PayPal Webhook] Processing failed for event", String(event.id), error instanceof Error ? error.message : "unknown");
    note = "processing_error";
  }
  await db.updatePaypalWebhookEvent(String(event.id), { matchedUserId, tokensDeducted, note }).catch(() => {});
  return res.status(200).json({ received: true });
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const action = typeof req.query?.action === "string" ? req.query.action : "";
  if (action === "platform-config") {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(publicPlatformScript());
  }
  if (action === "paypal-webhook") return await handlePaypalWebhook(req, res);
  if (action === "auth") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    const token = String(req.headers?.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return res.status(401).json({ error: "login_required" });
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
    if (!url || !key) return res.status(503).json({ error: "auth_unavailable" });
    try {
      const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` }, cache: "no-store" });
      if (response.status === 401 || response.status === 403) return res.status(401).json({ error: "login_required" });
      if (!response.ok) { console.error("[Auth] Supabase user endpoint returned", response.status); return res.status(503).json({ error: "auth_unavailable" }); }
      const user = await response.json() as any;
      if (!user?.id || !user?.email) return res.status(401).json({ error: "login_required" });
      return res.status(200).json({ id: String(user.id), email: String(user.email).toLowerCase(), name: user.user_metadata?.display_name || user.user_metadata?.full_name || "", role: "user" });
    } catch (error) {
      console.error("[Auth] Current user lookup failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "auth_unavailable" });
    }
  }
  if (action === "config") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    const packagesUsd = await Promise.all(Object.entries(PACKAGES).map(async ([tokens, priceEgp]) => {
      const { usd } = await usdForEgp(priceEgp);
      return { tokens: Number(tokens), priceUsd: usd };
    }));
    const { rate: usdEgpRate } = await usdForEgp(100);
    return res.status(200).json({
      vodafoneCashNumber: "01063537686",
      vodafoneCashUrl: "https://vf.eg/vfcash?id=mt&qrId=G0gO2O",
      instapayAddress: "wahedelfar1@instapay",
      instapayUrl: "https://ipn.eg/S/wahedelfar1/instapay/5hwGuZ",
      paypalPaymentUrl: process.env.PAYPAL_PAYMENT_URL ?? "",
      paypalClientId: process.env.PAYPAL_CLIENT_ID ?? "",
      packages: [{ tokens: 100, priceEgp: 100 }, { tokens: 500, priceEgp: 300 }, { tokens: 800, priceEgp: 500 }, { tokens: 1000, priceEgp: 700 }],
      packagesUsd,
      usdEgpRate,
      freeAnswers: 0, welcomeGiftTokens: 5, creditsPerAnswer: 1,
    });
  }
  if (action === "me") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    try { return res.status(200).json({ email: user.email, name: user.name, ...(await db.getWallet(user.id)) }); }
    catch (error) {
      console.error("[Billing] Wallet lookup failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "billing_unavailable" });
    }
  }
  if (action === "requests") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    try { return res.status(200).json({ requests: await db.listUserPaymentRequests(user.id) }); }
    catch (error) {
      console.error("[Billing] User payment requests failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "payment_requests_unavailable" });
    }
  }
  if (action === "payment") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    const body = req.body ?? {};
    const tokens = Number(body.packageTokens);
    const method = body.paymentMethod;
    const screenshotData = body.screenshotData;
    if (!PACKAGES[tokens] || !["vodafone_cash", "instapay"].includes(method)) return res.status(400).json({ error: "invalid_package_or_method" });
    if (typeof screenshotData !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(screenshotData) || screenshotData.length > 1_000_000) {
      return res.status(400).json({ error: "invalid_screenshot" });
    }
    try {
      const request = await db.submitPaymentRequest({
        userId: user.id, email: user.email!, paymentMethod: method,
        packageTokens: tokens, amountEgp: PACKAGES[tokens],
        transferReference: typeof body.transferReference === "string" ? body.transferReference.slice(0, 200) : "",
        screenshotData,
      });
      return res.status(201).json({ success: true, requestId: request.id, status: request.status });
    } catch (error) {
      const code = error instanceof Error ? error.message : "unknown";
      console.error("[Billing] Payment submission failed", code);
      const known = ["invalid_screenshot", "screenshot_too_large", "proof_upload_failed", "payment_insert_failed", "supabase_server_not_configured"];
      return res.status(code === "invalid_screenshot" || code === "screenshot_too_large" ? 400 : 503).json({ error: known.includes(code) ? code : "payment_submission_failed" });
    }
  }
  if (action === "paypal-create") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    try {
      const tokens = Number(req.body?.packageTokens);
      const priceEgp = PACKAGES[tokens];
      if (!priceEgp) return res.status(400).json({ error: "invalid_package" });
      const { usd } = await usdForEgp(priceEgp);
      const value = usd.toFixed(2);
      const token = await paypalAccessToken();
      const { ok, payload } = await paypalApi(token, "/v2/checkout/orders", {
        method: "POST",
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            amount: { currency_code: "USD", value },
            custom_id: `${user.id}|${tokens}`,
            description: `HotGPT token pack — ${tokens} tokens`,
          }],
          application_context: { brand_name: "HotGPT", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
        }),
      });
      if (!ok || !payload.id) {
        console.error("[PayPal] Order create failed", payload?.name || payload?.message || "unknown");
        return res.status(502).json({ error: "paypal_create_failed" });
      }
      return res.status(201).json({ orderId: String(payload.id) });
    } catch (error) { return paypalError(res, error); }
  }
  if (action === "paypal-capture") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    try {
      const orderId = String(req.body?.orderId || "");
      if (!/^[A-Z0-9]{10,32}$/i.test(orderId)) return res.status(400).json({ error: "invalid_order" });
      const token = await paypalAccessToken();
      const { ok, status, payload } = await paypalApi(token, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", body: "{}" });
      if (!ok) {
        // A repeat capture lands here (PayPal: ORDER_ALREADY_CAPTURED).
        // Never credit twice — the first capture already fulfilled.
        console.error("[PayPal] Capture rejected", status, payload?.name || "unknown");
        return res.status(409).json({ error: "capture_rejected" });
      }
      const unit = payload?.purchase_units?.[0];
      const capture = unit?.payments?.captures?.[0];
      const customId = String(unit?.custom_id || "");
      const [buyerId, tokensText] = customId.split("|");
      const tokens = Number(tokensText);
      const priceEgp = PACKAGES[tokens];
      const expectedNow = priceEgp ? (await usdForEgp(priceEgp)).usd : NaN;
      const paid = Number(capture?.amount?.value);
      const orderAmount = String(unit?.amount?.value ?? "");
      // The buyer can never change the order amount (PayPal enforces it);
      // we still require the capture to equal our order amount exactly and
      // to sit within $1 of today's computed equivalent (rate tick safety).
      const verified = payload?.status === "COMPLETED"
        && capture?.status === "COMPLETED"
        && buyerId === user.id
        && priceEgp !== undefined
        && capture?.amount?.currency_code === "USD"
        && capture?.amount?.value === orderAmount
        && Number.isFinite(paid)
        && Math.abs(paid - expectedNow) <= 1;
      if (!verified) {
        console.error("[PayPal] Capture verification failed for order", orderId);
        return res.status(422).json({ error: "verification_failed" });
      }
      const tokenBalance = await db.creditPurchasedTokens(user.id, tokens, {
        email: user.email!,
        captureId: String(capture.id),
        amountUsd: orderAmount,
      });
      return res.status(200).json({ success: true, tokensAdded: tokens, tokenBalance });
    } catch (error) { return paypalError(res, error); }
  }
  return res.status(404).json({ error: "unknown_billing_action" });
}
