import { requireMember } from "../../server/_core/vercelAuth.ts";
import * as db from "../../server/db.ts";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const baseUrl = (process.env.NEXA_PROVIDER_BASE_URL || "").trim().replace(/\/+$/, "");
  const apiKey = process.env.NEXA_PROVIDER_API_KEY || "";
  const model = (process.env.NEXA_PROVIDER_MODEL || "").trim();

  if (!baseUrl || !apiKey || !model) {
    return res.status(503).json({ error: "provider_not_configured" });
  }

  const body = req.body ?? {};
  const messages = body.messages;
  const extended = body.extended === true;

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > 40 ||
    !messages.every((m: any) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0 &&
      m.content.length <= 20000
    ) ||
    messages.reduce((sum: number, m: ChatMessage) => sum + m.content.length, 0) > 80000
  ) {
    return res.status(400).json({ error: "invalid_messages" });
  }

  let endpoint: URL;
  try {
    endpoint = new URL(baseUrl + "/chat/completions");
  } catch {
    return res.status(500).json({ error: "provider_invalid_base_url" });
  }

  if (endpoint.protocol !== "https:") {
    return res.status(500).json({ error: "provider_https_required" });
  }

  const user = await requireMember(req, res);
  if (!user) return;
  let credit: "free" | "paid" | null = null;
  try {
    credit = await db.consumeAnswerCredit(user.id);
  } catch (error) {
    console.error("[Billing] Credit reservation failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "billing_unavailable" });
  }
  if (!credit) {
    let wallet = null;
    try { wallet = await db.getWallet(user.id); } catch {}
    return res.status(402).json({ error: "insufficient_credits", wallet });
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: extended ? 4096 : 2048,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const payload: any = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("[DadGPT] Provider returned HTTP", upstream.status);
      await db.refundAnswerCredit(user.id, credit);
      return res.status(502).json({ error: "provider_request_failed" });
    }

    const raw = payload?.choices?.[0]?.message?.content;
    const content = typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((part: any) => typeof part?.text === "string" ? part.text : "").join("")
        : "";

    if (!content.trim()) {
      await db.refundAnswerCredit(user.id, credit);
      return res.status(502).json({ error: "provider_empty_response" });
    }

    const wallet = await db.getWallet(user.id);
    return res.status(200).json({ content: content.trim(), wallet });
  } catch (error: any) {
    if (credit) await db.refundAnswerCredit(user.id, credit);
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return res.status(timeout ? 504 : 502).json({
      error: timeout ? "provider_timeout" : "provider_request_failed",
    });
  }
}
