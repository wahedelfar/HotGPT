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

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const action = typeof req.query?.action === "string" ? req.query.action : "";
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
      console.error("[Billing] Payment submission failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "payment_submission_failed" });
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
