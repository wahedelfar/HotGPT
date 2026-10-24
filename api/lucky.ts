import { requireMember } from "../server/_core/vercelAuth.ts";

const supabaseUrl = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const action = String(req.query?.action || "");
  const member = await requireMember(req, res);
  if (!member) return;
  const url = supabaseUrl(), key = serviceKey();
  if (!url || !key) return res.status(503).json({ error: "service_unavailable" });
  const headers = { apikey: key, authorization: "Bearer " + key, "content-type": "application/json" };

  if (action === "submit") {
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
    const upload = await fetch(url + "/storage/v1/object/hotgpt-payment-proofs/" + path, { method: "POST", headers: { ...headers, "content-type": "image/" + match[1], "x-upsert": "false" }, body: bytes });
    if (!upload.ok) return res.status(503).json({ error: "proof_upload_failed" });
    const row = { user_id: member.id, email, payment_method: method, amount_minor: method === "paypal" ? 200 : 10000, currency: method === "paypal" ? "USD" : "EGP", base_tokens: 100, proof_path: path, status: "pending" };
    const created = await fetch(url + "/rest/v1/hotlucky_orders?select=id,status,created_at", { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (!created.ok) return res.status(503).json({ error: "order_create_failed" });
    const rows = await created.json();
    return res.status(201).json({ success: true, order: rows?.[0] || null });
  }
  return res.status(404).json({ error: "unknown_action" });
}
