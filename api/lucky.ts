import { requireMember } from "../server/_core/vercelAuth.ts";

// HotLucky — restructured 2026-10-27 as a spin game (Wahid's design, odds
// tuned by Muse and approved by him):
//   One ticket = one spin. Ticket price: 50 EGP via the manual methods
//   (Vodafone Cash / InstaPay, proof + admin review) or PayPal bundles
//   (2 spins / $2, 5 spins / $5 — sold in bundles because PayPal's fixed
//   fee would eat ~half of a $1 payment). Prizes are tokens, credited
//   DIRECTLY to the wallet by the spin: 25 (38%) / 50 (39%) / 75 (13%) /
//   100 (10%). There is no zero prize — the minimum returns half the
//   stake. Expected value 48.75 tokens per 50-token stake.
//   The pre-restructure pack system (base_tokens = 100, prize codes) was
//   removed entirely on 2026-10-27 at the owner's request — the site had
//   no other users, so nothing legacy remains in the member flow.

const SPIN_PRICE_EGP_MINOR = 5000;
const TICKET_BASE_TOKENS = 50;
const PRIZES: Array<{ tokens: number; weight: number }> = [
  { tokens: 25, weight: 38 },
  { tokens: 50, weight: 39 },
  { tokens: 75, weight: 13 },
  { tokens: 100, weight: 10 },
];
const PAYPAL_BUNDLES: Record<number, string> = { 2: "2.00", 5: "5.00" };
const VODAFONE_CASH_NUMBER = "01063537686";
const VODAFONE_CASH_URL = "https://vf.eg/vfcash?id=mt&qrId=G0gO2O";
const INSTAPAY_ADDRESS = "wahedelfar@instapay";
const INSTAPAY_URL = "https://ipn.eg/S/wahedelfar/instapay/4LnUCo";

const supabaseUrl = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
async function request(path: string, init: RequestInit = {}) {
  const url = supabaseUrl(), key = serviceKey();
  if (!url || !key) throw new Error("service_unavailable");
  const r = await fetch(url + "/rest/v1/" + path, { ...init, headers: { apikey: key, authorization: "Bearer " + key, "content-type": "application/json", ...Object.fromEntries(new Headers(init.headers).entries()) }, cache: "no-store" });
  const text = await r.text(); let data: any = null; try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error(typeof data?.message === "string" ? data.message : "database_request_failed");
  return data;
}

// Same wallet-credit pattern as server/supabaseBilling.ts (read balance,
// PATCH balance + tokens). Called only after the ticket has been claimed
// by the spin, and the claim is rolled back if the credit fails.
async function creditWalletTokens(userId: string, tokens: number): Promise<number> {
  const rows = await request(`wallets?user_id=eq.${encodeURIComponent(userId)}&select=token_balance&limit=1`);
  if (!rows?.[0]) throw new Error("wallet_not_found");
  const newBalance = Number(rows[0].token_balance) + tokens;
  const updated = await request(`wallets?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ token_balance: newBalance, updated_at: new Date().toISOString() }),
  });
  return Array.isArray(updated) && updated[0] ? Number(updated[0].token_balance) : newBalance;
}

function drawPrizeTokens(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const roll = (buf[0] / 4294967296) * 100;
  let acc = 0;
  for (const prize of PRIZES) { acc += prize.weight; if (roll < acc) return prize.tokens; }
  return PRIZES[PRIZES.length - 1].tokens;
}

// --- PayPal Checkout (Orders API), mirrored from api/billing.ts. Bundle
// prices are fixed USD on the server; fulfillment grants the spin tickets
// exactly once (rows flip awaiting_payment -> approved a single time).
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
      authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
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
  console.error("[HotLucky PayPal] Handler failed", code || "unknown");
  return res.status(502).json({ error: "paypal_unavailable" });
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const action = String(req.query?.action || "");
  if (action === "config" && req.method === "GET") {
    return res.status(200).json({
      vodafoneCashNumber: VODAFONE_CASH_NUMBER,
      vodafoneCashUrl: VODAFONE_CASH_URL,
      instapayAddress: INSTAPAY_ADDRESS,
      instapayUrl: INSTAPAY_URL,
      spinPriceEgp: SPIN_PRICE_EGP_MINOR / 100,
      paypalClientId: process.env.PAYPAL_CLIENT_ID || null,
      paypalEnabled: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
      paypalBundles: Object.entries(PAYPAL_BUNDLES).map(([spins, usd]) => ({ spins: Number(spins), usd })),
    });
  }
  if (action === "stats" && req.method === "GET") {
    try {
      const url = supabaseUrl(), key = serviceKey();
      if (!url || !key) return res.status(503).json({ error: "stats_unavailable" });
      const r = await fetch(url + "/rest/v1/hotlucky_orders?select=id&status=in.(pending,approved)", {
        headers: {
          apikey: key,
          authorization: "Bearer " + key,
          Prefer: "count=exact",
          Range: "0-0",
        },
        cache: "no-store",
      });
      if (!r.ok) return res.status(503).json({ error: "stats_unavailable" });
      const range = r.headers.get("content-range") || "";
      const match = range.match(/\/(\d+)$/);
      if (!match) return res.status(503).json({ error: "stats_unavailable" });
      return res.status(200).json({ participants: Number(match[1]) });
    } catch {
      return res.status(503).json({ error: "stats_unavailable" });
    }
  }
  if (action === "transparency" && req.method === "GET") {
    try {
      const url = supabaseUrl(), key = serviceKey();
      if (!url || !key) return res.status(503).json({ error: "service_unavailable" });
      const r = await fetch(url + "/rest/v1/hotlucky_daily_gifts?select=id,prize_label,created_at,hotlucky_orders(email)&order=created_at.desc&limit=5", { headers: { apikey: key, authorization: "Bearer " + key }, cache: "no-store" });
      if (!r.ok) return res.status(503).json({ error: "transparency_unavailable" });
      const rows = await r.json();
      const winners = (rows || []).map((row: any) => {
        const order = Array.isArray(row.hotlucky_orders) ? row.hotlucky_orders[0] : row.hotlucky_orders;
        const email = String(order?.email || "عضو HotGPT");
        const parts = email.split("@");
        const masked = parts.length === 2 ? parts[0].slice(0, 2) + "***@" + parts[1] : "عضو HotGPT";
        return { prize: row.prize_label, date: row.created_at, member: masked };
      });
      return res.status(200).json({ winners });
    } catch { return res.status(503).json({ error: "transparency_unavailable" }); }
  }
  const member = await requireMember(req, res); if (!member) return;
  const url = supabaseUrl(), key = serviceKey();
  if (!url || !key) return res.status(503).json({ error: "service_unavailable" });
  try {
    if (action === "status" && req.method === "GET") {
      const orders = await request("hotlucky_orders?user_id=eq." + encodeURIComponent(member.id) + "&select=id,status,base_tokens,prize_key,prize_label,spun_at&order=created_at.desc&limit=500");
      const list = orders || [];
      const spinCredits = list.filter((o: any) => o.status === "approved" && !o.spun_at && Number(o.base_tokens) === TICKET_BASE_TOKENS).length;
      const pendingTickets = list.filter((o: any) => o.status === "pending" || o.status === "awaiting_payment").length;
      const prizes = list.filter((o: any) => !!o.prize_label && !!o.spun_at).map((o: any) => {
        const isNewSpin = typeof o.prize_key === "string" && /^t\d+$/.test(o.prize_key);
        return {
          label: String(o.prize_label),
          tokens: isNewSpin ? Number(o.prize_key.slice(1)) : undefined,
          credited: isNewSpin,
          date: o.spun_at || null,
        };
      });
      return res.status(200).json({ spinCredits, pendingTickets, eligible: spinCredits > 0, email: member.email || "", prize: prizes[0] || null, prizes });
    }
    if (action === "spin" && req.method === "POST") {
      const readyRows = await request("hotlucky_orders?user_id=eq." + encodeURIComponent(member.id) + "&status=eq.approved&spun_at=is.null&base_tokens=eq." + TICKET_BASE_TOKENS + "&select=id,base_tokens&order=created_at.asc&limit=1");
      const ticket = readyRows?.[0];
      if (!ticket) return res.status(409).json({ error: "spin_not_available" });
      const tokens = drawPrizeTokens();
      const label = tokens + " توكن";
      const claimed = await request("hotlucky_orders?id=eq." + encodeURIComponent(ticket.id) + "&status=eq.approved&spun_at=is.null&select=id", {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ prize_key: "t" + tokens, prize_label: label, spun_at: new Date().toISOString(), reward_issued: true }),
      });
      if (!claimed?.length) return res.status(409).json({ error: "spin_not_available" });
      let newBalance: number;
      try {
        newBalance = await creditWalletTokens(member.id, tokens);
      } catch (creditError) {
        // Never leave a ticket marked spun without its prize: roll back.
        try {
          await request("hotlucky_orders?id=eq." + encodeURIComponent(ticket.id) + "&select=id", {
            method: "PATCH", headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ prize_key: null, prize_label: null, spun_at: null, reward_issued: false }),
          });
        } catch {}
        throw creditError;
      }
      // Public transparency feed (best-effort; the order row is the record).
      try {
        await request("hotlucky_daily_gifts", {
          method: "POST", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ order_id: ticket.id, prize_label: label }),
        });
      } catch {}
      const remaining = await request("hotlucky_orders?user_id=eq." + encodeURIComponent(member.id) + "&status=eq.approved&spun_at=is.null&select=id&limit=500").catch(() => null);
      return res.status(200).json({ success: true, prize: { tokens, label, key: "t" + tokens }, tokenBalance: newBalance, spinCredits: Array.isArray(remaining) ? remaining.length : undefined });
    }
    if (action === "paypal-create" && req.method === "POST") {
      try {
        const spins = Number(req.body?.spins);
        const total = PAYPAL_BUNDLES[spins];
        if (!total) return res.status(400).json({ error: "invalid_bundle" });
        const token = await paypalAccessToken();
        const { ok, payload } = await paypalApi(token, "/v2/checkout/orders", {
          method: "POST",
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [{
              amount: { currency_code: "USD", value: total },
              custom_id: member.id,
              description: `HotLucky — ${spins} spin tickets`,
            }],
            application_context: { brand_name: "HotGPT", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
          }),
        });
        if (!ok || !payload.id) {
          console.error("[HotLucky PayPal] Order create failed", payload?.name || payload?.message || "unknown");
          return res.status(502).json({ error: "paypal_create_failed" });
        }
        const orderId = String(payload.id);
        const rows = Array.from({ length: spins }, () => ({
          user_id: member.id, email: String(member.email || "").toLowerCase(), payment_method: "paypal",
          amount_minor: Math.round(Number(total) * 100), currency: "USD", base_tokens: TICKET_BASE_TOKENS,
          proof_path: "paypal:" + orderId, status: "awaiting_payment",
        }));
        await request("hotlucky_orders", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rows) });
        return res.status(201).json({ orderId });
      } catch (error) { return paypalError(res, error); }
    }
    if (action === "paypal-capture" && req.method === "POST") {
      try {
        const orderId = String(req.body?.orderId || "");
        if (!/^[A-Z0-9]{10,32}$/i.test(orderId)) return res.status(400).json({ error: "invalid_order" });
        const rows = await request("hotlucky_orders?proof_path=eq." + encodeURIComponent("paypal:" + orderId) + "&user_id=eq." + encodeURIComponent(member.id) + "&select=id,status");
        if (!rows?.length) return res.status(404).json({ error: "order_not_found" });
        if (rows.every((r: any) => r.status === "approved")) return res.status(200).json({ success: true, spins: rows.length, alreadyGranted: true });
        const token = await paypalAccessToken();
        let payload: any = null;
        const cap = await paypalApi(token, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", body: "{}" });
        if (cap.ok) payload = cap.payload;
        else {
          // Repeat capture (or an earlier capture whose approval step did
          // not finish): read the order back and verify from its capture.
          const got = await paypalApi(token, `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
          if (!got.ok) {
            console.error("[HotLucky PayPal] Capture rejected", cap.status, cap.payload?.name || "unknown");
            return res.status(409).json({ error: "capture_rejected" });
          }
          payload = got.payload;
        }
        const unit = payload?.purchase_units?.[0];
        const capture = unit?.payments?.captures?.[0];
        const expected = rows.length.toFixed(2);
        const verified = payload?.status === "COMPLETED"
          && capture?.status === "COMPLETED"
          && String(unit?.custom_id || "") === member.id
          && capture?.amount?.currency_code === "USD"
          && capture?.amount?.value === expected;
        if (!verified) {
          console.error("[HotLucky PayPal] Capture verification failed for order", orderId);
          return res.status(422).json({ error: "verification_failed" });
        }
        const granted = await request("hotlucky_orders?proof_path=eq." + encodeURIComponent("paypal:" + orderId) + "&user_id=eq." + encodeURIComponent(member.id) + "&status=eq.awaiting_payment&select=id", {
          method: "PATCH", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: "paypal-auto" }),
        });
        return res.status(200).json({ success: true, spins: granted?.length ?? rows.length });
      } catch (error) { return paypalError(res, error); }
    }
    if (action !== "submit" || req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const method = req.body?.paymentMethod;
    const dataUrl = typeof req.body?.screenshotData === "string" ? req.body.screenshotData : "";
    if (!email || email !== member.email.toLowerCase() || !["vodafone_cash", "instapay"].includes(method)) return res.status(400).json({ error: "invalid_order" });
    const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(400).json({ error: "invalid_screenshot" });
    const bytes = Uint8Array.from(atob(match[2]), (c: string) => c.charCodeAt(0));
    if (bytes.byteLength > 700_000) return res.status(400).json({ error: "invalid_screenshot" });
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const path = member.id + "/" + crypto.randomUUID() + "." + ext;
    const headers = { apikey: key, authorization: "Bearer " + key, "content-type": "application/json" };
    const upload = await fetch(url + "/storage/v1/object/hotgpt-payment-proofs/" + path, { method: "POST", headers: { ...headers, "content-type": "image/" + match[1], "x-upsert": "false" }, body: bytes });
    if (!upload.ok) return res.status(503).json({ error: "proof_upload_failed" });
    const row = { user_id: member.id, email, payment_method: method, amount_minor: SPIN_PRICE_EGP_MINOR, currency: "EGP", base_tokens: TICKET_BASE_TOKENS, proof_path: path, status: "pending" };
    const created = await fetch(url + "/rest/v1/hotlucky_orders?select=id,status,created_at", { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (!created.ok) return res.status(503).json({ error: "order_create_failed" });
    const createdRows = await created.json();
    return res.status(201).json({ success: true, order: createdRows?.[0] || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("spin_not_available")) return res.status(409).json({ error: "spin_not_available" });
    console.error("[HotLucky]", message || "unknown");
    return res.status(503).json({ error: "hotlucky_unavailable" });
  }
}
