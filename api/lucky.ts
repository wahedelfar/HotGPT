import { requireMember } from "../server/_core/vercelAuth.ts";

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
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const action = String(req.query?.action || "");
  if (action === "config" && req.method === "GET") {
    let paypalPaymentUrl: string | null = null;
    try {
      const configured = String(process.env.HOTLUCKY_PAYPAL_URL || "").trim();
      if (configured) {
        const parsed = new URL(configured);
        if (parsed.protocol === "https:") paypalPaymentUrl = parsed.toString();
      }
    } catch {}
    return res.status(200).json({ paypalPaymentUrl, vodafoneCashNumber: "01063537686" });
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
      const orders = await request("hotlucky_orders?user_id=eq." + encodeURIComponent(member.id) + "&select=id,status,prize_key,prize_label,prize_code,spun_at,token_code_used,reward_issued,hotlucky_daily_gifts(prize_code,prize_label,created_at)&order=created_at.desc&limit=500");
      const ready = (orders || []).find((o: any) => o.status === "approved" && !o.spun_at);
      const prizes = (orders || []).filter((o: any) => !!o.prize_label).map((o: any) => {
        const gift = Array.isArray(o.hotlucky_daily_gifts) ? o.hotlucky_daily_gifts[0] : o.hotlucky_daily_gifts;
        return { label: String(o.prize_label), code: o.prize_code ? String(o.prize_code) : gift?.prize_code ? String(gift.prize_code) : undefined, used: Boolean(o.token_code_used || o.reward_issued), date: o.spun_at || gift?.created_at || null };
      });
      return res.status(200).json({ eligible: !!ready, email: member.email || "", prize: prizes[0] || null, prizes });
    }
    if (action === "redeem" && req.method === "POST") {
      const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
      if (!/^HOT-[A-F0-9]{6}$/.test(code)) return res.status(400).json({ error: "invalid_token_code" });
      const result = await request("rpc/hotlucky_redeem_token_code", {
        method: "POST",
        body: JSON.stringify({ p_user_id: member.id, p_email: String(member.email || "").toLowerCase(), p_code: code }),
      });
      return res.status(200).json(result);
    }
    if (action === "spin" && req.method === "POST") {
      const result = await request("rpc/hotlucky_spin", { method: "POST", body: JSON.stringify({ p_user_id: member.id }) });
      return res.status(200).json({ success: true, prize: { label: result.prize_label, code: result.prize_code, key: result.prize_key } });
    }
    if (action !== "submit" || req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const method = req.body?.paymentMethod;
    const dataUrl = typeof req.body?.screenshotData === "string" ? req.body.screenshotData : "";
    if (!email || email !== member.email.toLowerCase() || !["vodafone_cash", "paypal"].includes(method)) return res.status(400).json({ error: "invalid_order" });
    if (method === "paypal" && !process.env.HOTLUCKY_PAYPAL_URL) return res.status(503).json({ error: "paypal_not_configured" });
    const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(400).json({ error: "invalid_screenshot" });
    const bytes = Uint8Array.from(atob(match[2]), (c: string) => c.charCodeAt(0));
    if (bytes.byteLength > 700_000) return res.status(400).json({ error: "invalid_screenshot" });
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const path = member.id + "/" + crypto.randomUUID() + "." + ext;
    const headers = { apikey: key, authorization: "Bearer " + key, "content-type": "application/json" };
    const upload = await fetch(url + "/storage/v1/object/hotgpt-payment-proofs/" + path, { method: "POST", headers: { ...headers, "content-type": "image/" + match[1], "x-upsert": "false" }, body: bytes });
    if (!upload.ok) return res.status(503).json({ error: "proof_upload_failed" });
    const row = { user_id: member.id, email, payment_method: method, amount_minor: method === "paypal" ? 200 : 10000, currency: method === "paypal" ? "USD" : "EGP", base_tokens: 100, proof_path: path, status: "pending" };
    const created = await fetch(url + "/rest/v1/hotlucky_orders?select=id,status,created_at", { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (!created.ok) return res.status(503).json({ error: "order_create_failed" });
    const rows = await created.json();
    return res.status(201).json({ success: true, order: rows?.[0] || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("spin_not_available")) return res.status(409).json({ error: "spin_not_available" });
    if (message.includes("token_code_used")) return res.status(409).json({ error: "token_code_used" });
    if (message.includes("token_code_not_found")) return res.status(404).json({ error: "token_code_not_found" });
    console.error("[HotLucky]", message || "unknown");
    return res.status(503).json({ error: "hotlucky_unavailable" });
  }
}
