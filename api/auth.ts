export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
  const token = String(req.headers?.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: "login_required" });
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) return res.status(503).json({ error: "auth_unavailable" });
  try {
    const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` }, cache: "no-store" });
    if (response.status === 401 || response.status === 403) return res.status(401).json({ error: "login_required" });
    if (!response.ok) { console.error("[Auth] Supabase user endpoint returned", response.status); return res.status(503).json({ error: "auth_unavailable" }); }
    const user = await response.json() as any;
    if (!user?.id || !user?.email) return res.status(401).json({ error: "login_required" });
    return res.status(200).json({ id: String(user.id), email: String(user.email).toLowerCase(), name: user.user_metadata?.display_name || user.user_metadata?.full_name || "", role: "user" });
  } catch (error) {
    console.error("[Auth] Current user lookup failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "auth_unavailable" });
  }
}
