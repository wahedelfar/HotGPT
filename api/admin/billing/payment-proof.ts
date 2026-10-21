import { requireAdmin } from "../../../server/_core/vercelAuth.js";
import * as db from "../../../server/db.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const id = Number(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "invalid_payment_id" });
  try {
    const proof = await db.getPaymentProofById(id);
    if (!proof) return res.status(404).json({ error: "payment_not_found" });
    return res.status(200).json(proof);
  } catch (error) {
    console.error("[Admin] Payment proof failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "payment_proof_unavailable" });
  }
}
