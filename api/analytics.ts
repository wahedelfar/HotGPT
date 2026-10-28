import { requireMember } from "../server/_core/vercelAuth.ts";
import { recordFunnelEvent } from "../server/supabaseBilling.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const user = await requireMember(req, res);
  if (!user) return;
  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : "";
  const metadata = req.body?.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata) ? req.body.metadata : {};
  const path = typeof req.body?.path === "string" ? req.body.path.slice(0, 200) : "";
  if (!/^[a-z][a-z0-9_.-]{1,79}$/.test(name)) return res.status(400).json({ error: "invalid_event" });
  try {
    await recordFunnelEvent({ userId: user.id, name, path, metadata });
    return res.status(204).end();
  } catch (error) {
    console.error("[Analytics] Event recording failed", error instanceof Error ? error.message : "unknown");
    return res.status(204).end();
  }
}
