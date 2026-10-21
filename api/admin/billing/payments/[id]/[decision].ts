import { requireAdmin } from "../../../../../server/_core/vercelAuth.ts";
import * as db from "../../../../../server/supabaseBilling.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const id = String(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id || "");
  const decision = Array.isArray(req.query.decision) ? req.query.decision[0] : req.query.decision;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["approve", "reject"].includes(decision)) return res.status(400).json({ error: "invalid_payment_decision" });
  try {
    const payment = await db.reviewPaymentRequest(id, decision === "approve", admin.email ?? "admin");
    return res.status(200).json({ success: true, payment: { id: payment.id, status: payment.status } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "payment_not_found") return res.status(404).json({ error: "payment_not_found" });
    if (message === "payment_already_reviewed") return res.status(409).json({ error: "payment_already_reviewed" });
    console.error("[Admin] Payment review failed", message);
    return res.status(503).json({ error: "payment_review_failed" });
  }
}
