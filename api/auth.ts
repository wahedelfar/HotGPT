import { getSupabaseUser } from "../server/supabaseBilling.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const authorization = String(req.headers?.authorization || "");
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: "login_required" });
  try {
    const user = await getSupabaseUser(token);
    if (!user) return res.status(401).json({ error: "login_required" });
    return res.status(200).json(user);
  } catch (error) {
    console.error("[Auth] Current user lookup failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "auth_unavailable" });
  }
}
