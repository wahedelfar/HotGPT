import { requireAdmin } from "../../server/_core/vercelAuth.ts";

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
  const admin = await requireAdmin(req, res); if (!admin) return;
  const action = String(req.query?.action || ""), id = String(req.query?.id || "");
  try {
    if (action === "list" && req.method === "GET") {
      const orders = await request("hotlucky_orders?select=id,email,user_id,payment_method,currency,amount_minor,status,proof_path,prize_label,prize_code,reward_issued,consolation_awarded,created_at,hotlucky_daily_gifts(prize_code,prize_label,issued_at)&order=created_at.desc&limit=500");
      const result = await Promise.all((orders || []).map(async (o: any) => {
        let proof_url: string | null = null;
        if (o.proof_path) {
          const signed = await fetch(supabaseUrl() + "/storage/v1/object/sign/hotgpt-payment-proofs/" + o.proof_path, { method: "POST", headers: { apikey: serviceKey(), authorization: "Bearer " + serviceKey(), "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 300 }) });
          if (signed.ok) { const body = await signed.json(); proof_url = supabaseUrl() + "/storage/v1" + body.signedURL; }
        }
        const gift = Array.isArray(o.hotlucky_daily_gifts) ? o.hotlucky_daily_gifts[0] : null;\n        return { ...o, prize_code: gift?.prize_code || o.prize_code, prize_label: gift?.prize_label || o.prize_label, reward_issued: Boolean(o.reward_issued || gift?.issued_at), proof_url, amount_label: o.currency === "USD" ? "$" + (o.amount_minor / 100) : (o.amount_minor / 100) + " جنيه" };
      }));
      return res.status(200).json({ orders: result });
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "invalid_order_id" });
    if (action === "approve" && req.method === "POST") {
      const result = await request("rpc/hotlucky_approve_order", { method: "POST", body: JSON.stringify({ p_order_id: id, p_admin: admin.email || "admin" }) });
      return res.status(200).json({ success: true, order: result });
    }
    if (action === "reject" && req.method === "POST") {
      const rows = await request("hotlucky_orders?id=eq." + id + "&status=eq.pending&select=id", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: admin.email || "admin" }) });
      if (!rows?.length) return res.status(409).json({ error: "already_processed" });
      return res.status(200).json({ success: true });
    }
    if (action === "consolation" && req.method === "POST") {\n      const result = await request("rpc/hotlucky_award_consolation", { method: "POST", body: JSON.stringify({ p_order_id: id, p_admin: admin.email || "admin" }) });\n      return res.status(200).json({ success: true, result });\n    }\n    if (action === "award" && req.method === "POST") {
      const result = await request("rpc/hotlucky_award_tokens", { method: "POST", body: JSON.stringify({ p_order_id: id, p_admin: admin.email || "admin" }) });
      return res.status(200).json({ success: true, result });
    }
    return res.status(404).json({ error: "unknown_action" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("already_processed")) return res.status(409).json({ error: "already_processed" });
    if (message.includes("not_ready")) return res.status(409).json({ error: "reward_not_ready" });\n    if (message.includes("not_approved")) return res.status(409).json({ error: "order_not_approved" });
    if (message.includes("subscription_reward_requires_subscription_integration")) return res.status(409).json({ error: "subscription_reward_requires_subscription_integration" });
    console.error("[Admin HotLucky]", message || "unknown");
    return res.status(503).json({ error: "hotlucky_unavailable" });
  }
}
