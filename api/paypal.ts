import { requireMember } from "../server/_core/vercelAuth.ts";
import * as db from "../server/supabaseBilling.ts";
import { PACKAGES } from "./billing.ts";
import { usdForEgp } from "../server/fxRate.ts";

// PayPal Checkout (Orders API) with automatic token fulfillment.
// Prices live ONLY on the server; the browser never names an amount.
// Packs are EGP-priced (Arab audience first); PayPal charges the USD
// equivalent at today's live rate, rounded up to the next whole dollar.
// Fulfillment rule: credit exactly once, inside the same request that
// receives a fresh CAPTURE success from PayPal. PayPal itself rejects a
// second capture of the same order, so double-crediting through this
// endpoint is impossible. The capture is verified field by field
// (status, amount, currency, buyer) before any token moves.


function paypalBase() {
  return process.env.PAYPAL_MODE === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

function paypalCreds() {
  const id = process.env.PAYPAL_CLIENT_ID || "";
  const secret = process.env.PAYPAL_CLIENT_SECRET || "";
  if (!id || !secret) throw new Error("paypal_not_configured");
  return { id, secret };
}

async function accessToken(): Promise<string> {
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

async function paypal(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${paypalBase()}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({} as any));
  return { ok: response.ok, status: response.status, payload };
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const action = typeof req.query?.action === "string" ? req.query.action : "";
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const user = await requireMember(req, res);
  if (!user) return;
  try {
    if (action === "create") {
      const tokens = Number(req.body?.packageTokens);
      const priceEgp = PACKAGES[tokens];
      if (!priceEgp) return res.status(400).json({ error: "invalid_package" });
      const { usd } = await usdForEgp(priceEgp);
      const value = usd.toFixed(2);
      const token = await accessToken();
      const { ok, payload } = await paypal(token, "/v2/checkout/orders", {
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
    }
    if (action === "capture") {
      const orderId = String(req.body?.orderId || "");
      if (!/^[A-Z0-9]{10,32}$/i.test(orderId)) return res.status(400).json({ error: "invalid_order" });
      const token = await accessToken();
      const { ok, status, payload } = await paypal(token, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", body: "{}" });
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
      const expected = orderAmount;
      if (!verified) {
        console.error("[PayPal] Capture verification failed for order", orderId);
        return res.status(422).json({ error: "verification_failed" });
      }
      const tokenBalance = await db.creditPurchasedTokens(user.id, tokens, {
        email: user.email!,
        captureId: String(capture.id),
        amountUsd: expected,
      });
      return res.status(200).json({ success: true, tokensAdded: tokens, tokenBalance });
    }
    return res.status(404).json({ error: "unknown_paypal_action" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "paypal_not_configured") return res.status(503).json({ error: "paypal_not_configured" });
    console.error("[PayPal] Handler failed", code || "unknown");
    return res.status(502).json({ error: "paypal_unavailable" });
  }
}
