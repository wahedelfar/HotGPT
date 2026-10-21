import { changeAdminPassword, readAdminSession, createAdminCookie } from "../../../server/_core/adminSession.ts";
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const session = await readAdminSession(req);
  if (!session) return res.status(401).json({ error: "admin_login_required" });
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  try {
    await changeAdminPassword(currentPassword, newPassword);
    // Password update invalidates old sessions; require fresh login.
    res.setHeader("Set-Cookie", `hotgpt_admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    return res.status(200).json({ success: true, reLoginRequired: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "password_change_failed" });
  }
}
