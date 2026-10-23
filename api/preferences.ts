export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const token = String(req.headers?.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: "login_required" });
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  if (!url || !publicKey || !serviceKey) return res.status(503).json({ error: "preferences_unavailable" });

  try {
    const authResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publicKey, authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!authResponse.ok) return res.status(401).json({ error: "login_required" });
    const user = await authResponse.json() as any;
    if (!user?.id) return res.status(401).json({ error: "login_required" });

    const rest = async (path: string, init: RequestInit = {}) => {
      const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json",
          ...Object.fromEntries(new Headers(init.headers).entries()),
        },
        cache: "no-store",
      });
      const raw = await response.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
      if (!response.ok) {
        console.error("[Preferences] Supabase REST error", response.status, typeof data === "object" ? data?.code || data?.message : "request_failed");
        throw new Error("preferences_unavailable");
      }
      return data;
    };

    if (req.method === "GET") {
      const rows = await rest(`user_preferences?user_id=eq.${encodeURIComponent(user.id)}&select=theme,response_style,custom_instructions,language,updated_at&limit=1`);
      const row = rows?.[0];
      return res.status(200).json({ preferences: row ? {
        theme: row.theme, style: row.response_style, instructions: row.custom_instructions || "",
        language: row.language === "en" ? "en" : "ar", updatedAt: row.updated_at,
      } : null });
    }

    const body = req.body || {};
    const theme = body.theme === "light" ? "light" : "dark";
    const style = ["professional", "concise", "friendly", "detailed"].includes(body.style) ? body.style : "professional";
    const instructions = typeof body.instructions === "string" ? body.instructions.slice(0, 2000) : "";
    const language = body.language === "en" ? "en" : "ar";
    const rows = await rest("user_preferences?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        user_id: user.id, theme, response_style: style, custom_instructions: instructions,
        language, updated_at: new Date().toISOString(),
      }),
    });
    const row = rows?.[0];
    return res.status(200).json({ success: true, preferences: {
      theme, style, instructions, language, updatedAt: row?.updated_at || new Date().toISOString(),
    } });
  } catch (error) {
    console.error("[Preferences] Request failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "preferences_unavailable" });
  }
}
