import { requireAdmin } from "../../../server/_core/vercelAuth";
import * as db from "../../../server/db";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  try { return res.status(200).json({ users: await db.listWalletUsers() }); }
  catch (error) {
    console.error("[Admin] User list failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "admin_data_unavailable" });
  }
}
