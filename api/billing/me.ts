import { requireMember } from "../../server/_core/vercelAuth";
import * as db from "../../server/db";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
  const user = await requireMember(req, res);
  if (!user) return;
  try {
    return res.status(200).json({ email: user.email, name: user.name, ...(await db.getWallet(user.id)) });
  } catch (error) {
    console.error("[Billing] Wallet lookup failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "billing_unavailable" });
  }
}
