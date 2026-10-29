import { requireAdmin } from "../../server/_core/vercelAuth.ts";
import * as db from "../../server/supabaseBilling.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const action = typeof req.query?.action === "string" ? req.query.action : "";
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (action === "users") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    try { return res.status(200).json({ users: await db.listWalletUsers() }); }
    catch (error) {
      console.error("[Admin] User list failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "admin_data_unavailable" });
    }
  }
  if (action === "payments") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    try { return res.status(200).json({ requests: await db.listPaymentRequests() }); }
    catch (error) {
      console.error("[Admin] Payment list failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "payment_list_failed" });
    }
  }
  if (action === "balance") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const balance = Number(req.body?.tokenBalance);
    if (!email || email.length > 320 || !Number.isInteger(balance) || balance < 0 || balance > 10_000_000) return res.status(400).json({ error: "invalid_email_or_balance" });
    try {
      const user = await db.setTokenBalanceByEmail(email, balance);
      if (!user) return res.status(404).json({ error: "member_not_found" });
      return res.status(200).json({ success: true, user });
    } catch (error) {
      console.error("[Admin] Balance update failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "balance_update_failed" });
    }
  }
  if (action === "proof") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    const id = String(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "invalid_payment_id" });
    try {
      const proof = await db.getPaymentProofById(id);
      if (!proof) return res.status(404).json({ error: "payment_not_found" });
      return res.status(200).json(proof);
    } catch (error) {
      console.error("[Admin] Payment proof failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "payment_proof_unavailable" });
    }
  }
  if (action === "review") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
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
  if (action === "delete") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const id = String(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "invalid_payment_id" });
    try {
      const deleted = await db.deletePaymentRequest(id);
      if (!deleted) return res.status(404).json({ error: "payment_not_found" });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[Admin] Payment delete failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "payment_delete_failed" });
    }
  }
  return res.status(404).json({ error: "unknown_admin_billing_action" });
}
