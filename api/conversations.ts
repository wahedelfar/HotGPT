export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const authorization = String(req.headers?.authorization || "");
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "login_required" });

  let url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  while (url.endsWith("/")) url = url.slice(0, -1);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  // Server-side auth verification can use the service key as the apikey fallback
  // when the project has only the service key configured. The user JWT remains
  // the bearer token, and the service key is never returned to the client.
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    serviceKey;

  if (!url || !publicKey || !serviceKey) {
    console.error("[Conversations] Supabase server configuration is incomplete", { hasUrl: !!url, hasPublicKey: !!publicKey, hasServiceKey: !!serviceKey });
    return res.status(503).json({ error: "conversations_unavailable", detail: "supabase_server_not_configured" });
  }

  try {
    const authResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publicKey, authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!authResponse.ok) return res.status(401).json({ error: "login_required" });
    const user = await authResponse.json() as any;
    if (!user?.id) return res.status(401).json({ error: "login_required" });

    const rest = async (path: string, init: RequestInit = {}) => {
      const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
          "content-type": "application/json",
          ...Object.fromEntries(new Headers(init.headers).entries()),
        },
        cache: "no-store",
      });
      const body = await response.text();
      let data: any = null;
      try { data = body ? JSON.parse(body) : null; } catch { data = body; }
      if (!response.ok) {
        const code = typeof data === "object" ? data?.code || data?.message : "request_failed";
        console.error("[Conversations] Supabase REST error", response.status, code);
        throw new Error(`supabase_rest_${response.status}`);
      }
      return data;
    };

    if (req.method === "GET") {
      const id = typeof req.query?.id === "string" ? req.query.id : "";
      if (id && !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "invalid_conversation_id" });
      if (id) {
        const rows = await rest(`conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,title,created_at,updated_at&limit=1`);
        const row = rows?.[0];
        if (!row) return res.status(404).json({ error: "conversation_not_found" });
        const messages = await rest(`messages?conversation_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,role,content,created_at,is_complete,part_count,last_finish_reason&order=created_at.asc&limit=500`);
        return res.status(200).json({
          conversation: { id: String(row.id), title: String(row.title || "محادثة جديدة"), createdAt: row.created_at, updatedAt: row.updated_at },
          messages: (messages || []).filter((m: any) => String(m.content ?? "").trim().length > 0).map((m: any) => ({ id: String(m.id), role: m.role, content: String(m.content), createdAt: m.created_at, is_complete: m.is_complete ?? true, part_count: Number(m.part_count || 1), last_finish_reason: m.last_finish_reason ?? null })),
        });
      }
      const rows = await rest(`conversations?user_id=eq.${encodeURIComponent(user.id)}&select=id,title,created_at,updated_at&order=updated_at.desc&limit=100`);
      const conversations = await Promise.all((rows || []).map(async (row: any) => {
        let preview = "";
        try {
          const messages = await rest(`messages?conversation_id=eq.${encodeURIComponent(row.id)}&user_id=eq.${encodeURIComponent(user.id)}&select=content&order=created_at.desc&limit=1`);
          preview = String(messages?.[0]?.content || "");
        } catch { /* Keep the conversation list usable if a preview cannot be loaded. */ }
        return { id: String(row.id), title: String(row.title || "محادثة جديدة"), preview, date: row.updated_at || row.created_at };
      }));
      return res.status(200).json({ conversations });
    }

    if (req.method === "DELETE") {
      // Bulk delete (sidebar "delete all conversations"): every message
      // and conversation owned by the caller. Scoped strictly to the
      // authenticated user id, like every other branch in this handler.
      if (req.query?.all === "1") {
        await rest(`messages?user_id=eq.${encodeURIComponent(user.id)}`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        });
        await rest(`conversations?user_id=eq.${encodeURIComponent(user.id)}`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        });
        return res.status(200).json({ success: true, all: true });
      }

      const id = typeof req.query?.id === "string" ? req.query.id : "";
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "invalid_conversation_id" });

      // Verify ownership before deleting either messages or the conversation.
      const owned = await rest(`conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
      if (!owned?.length) return res.status(404).json({ error: "conversation_not_found" });

      await rest(`messages?conversation_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      await rest(`conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      return res.status(200).json({ success: true, id });
    }

    if (req.method === "POST") {
      const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "محادثة جديدة";
      const rows = await rest("conversations?select=id,title,created_at,updated_at", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ user_id: user.id, title: title || "محادثة جديدة" }),
      });
      const row = rows?.[0];
      if (!row) throw new Error("conversation_create_failed");
      return res.status(201).json({ conversation: { id: String(row.id), title: String(row.title), createdAt: row.created_at, updatedAt: row.updated_at } });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (error) {
    console.error("[Conversations] Request failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "conversations_unavailable" });
  }
}
