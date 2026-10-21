import { sdk } from "./sdk.js";
import { readAdminSession } from "./adminSession";

export async function requireMember(req: any, res: any) {
  try {
    const user = await sdk.authenticateRequest(req as any);
    if (!user || user.id < 1 || !user.email) {
      res.status(401).json({ error: "login_required" });
      return null;
    }
    return user;
  } catch {
    res.status(401).json({ error: "login_required" });
    return null;
  }
}

export async function requireAdmin(req: any, res: any) {
  const adminSession = await readAdminSession(req);
  if (adminSession) return { id: 0, email: adminSession.email, name: "Administrator", role: "admin" as const };
  const user = await requireMember(req, res);
  if (!user) return null;
  const allowlist = (process.env.HOTGPT_ADMIN_EMAILS ?? "")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (user.role !== "admin" && !(user.email && allowlist.includes(user.email.toLowerCase()))) {
    res.status(403).json({ error: "admin_required" });
    return null;
  }
  return user;
}
