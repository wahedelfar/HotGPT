import { readAdminSession } from "./adminSession.ts";
import { getSupabaseUser } from "../supabaseBilling.ts";

export async function requireMember(req: any, res: any) {
  const authorization = String(req.headers?.authorization || "");
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) {
    res.status(401).json({ error: "login_required" });
    return null;
  }
  try {
    const user = await getSupabaseUser(bearer);
    if (!user) {
      res.status(401).json({ error: "login_required" });
      return null;
    }
    return user;
  } catch (error) {
    console.error("[Auth] Supabase verification failed", error instanceof Error ? error.message : "unknown");
    res.status(503).json({ error: "auth_unavailable" });
    return null;
  }
}

export async function requireAdmin(req: any, res: any) {
  const adminSession = await readAdminSession(req);
  if (adminSession) return { id: "admin-session", email: adminSession.email, name: "Administrator", role: "admin" as const };
  const user = await requireMember(req, res);
  if (!user) return null;
  const allowlist = (process.env.HOTGPT_ADMIN_EMAILS ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (user.role !== "admin" && !allowlist.includes(user.email.toLowerCase())) {
    res.status(403).json({ error: "admin_required" });
    return null;
  }
  return user;
}
