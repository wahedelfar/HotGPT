import { requireMember } from "../server/_core/vercelAuth.ts";
import * as db from "../server/supabaseBilling.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireMember(req, res);
  if (!user) return;
  try {
    if (req.method === "GET") {
      const id = typeof req.query?.id === "string" ? req.query.id : "";
      if (id && !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "invalid_conversation_id" });
      if (id) {
        const conversation = await db.getConversation(user.id, id);
        if (!conversation) return res.status(404).json({ error: "conversation_not_found" });
        return res.status(200).json(conversation);
      }
      return res.status(200).json({ conversations: await db.listConversations(user.id) });
    }
    if (req.method === "POST") {
      const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "محادثة جديدة";
      const conversation = await db.createConversation(user.id, title || "محادثة جديدة");
      return res.status(201).json({ conversation });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (error) {
    console.error("[Conversations] Request failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "conversations_unavailable" });
  }
}
