import { createAdminCookie, loginAdmin } from "../../../server/_core/adminSession.js";
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
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
