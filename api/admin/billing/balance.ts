import { requireAdmin } from "../../../server/_core/vercelAuth.ts";
import * as db from "../../../server/db.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const admin = await requireAdmin(req, res);
  if (!admin) return;
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
