import { createAdminCookie, clearAdminCookie, loginAdmin, readAdminSession, changeAdminPassword } from "../../server/_core/adminSession.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const action = typeof req.query?.action === "string" ? req.query.action : "";
  if (action === "me") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    const session = await readAdminSession(req);
    return res.status(session ? 200 : 401).json(session ? { authenticated: true, email: session.email } : { authenticated: false });
  }
  if (action === "logout") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    res.setHeader("Set-Cookie", clearAdminCookie());
    return res.status(200).json({ success: true });
  }
  if (action === "login") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    try {
      const session = await loginAdmin(email, password);
      if (!session) return res.status(401).json({ error: "invalid_credentials" });
      res.setHeader("Set-Cookie", createAdminCookie(session));
      return res.status(200).json({ success: true, email: session.email });
    } catch (error) {
      console.error("[AdminAuth] Login failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "admin_auth_unavailable" });
    }
  }
  if (action === "password") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const session = await readAdminSession(req);
    if (!session) return res.status(401).json({ error: "admin_login_required" });
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    try {
      await changeAdminPassword(currentPassword, newPassword);
      res.setHeader("Set-Cookie", "hotgpt_admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
      return res.status(200).json({ success: true, reLoginRequired: true });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "password_change_failed" });
    }
  }
  return res.status(404).json({ error: "unknown_admin_auth_action" });
}
