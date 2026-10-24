import chatHandler from "./model/chat";

/**
 * Dedicated Dark Web API entry point.
 * Dark Web keeps its own server-side instructions and must never fall back to
 * showing raw search cards as if they were a specialist analysis.
 */
export default async function darkWebHandler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const modes = body.modes && typeof body.modes === "object" ? body.modes : {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastMessage = messages.length ? messages[messages.length - 1] : null;

  // Reinforce the CTI output contract in this route only. Do not change the
  // user's query or the generic Search route's instructions.
  req.body = {
    ...body,
    modes: {
      ...modes,
      webSearch: false,
      darkWeb: true,
    },
    preferences: {
      ...(body.preferences && typeof body.preferences === "object" ? body.preferences : {}),
      instructions: [
        typeof body.preferences?.instructions === "string" ? body.preferences.instructions : "",
        "Dark Web CTI mode: answer the user's actual question in Arabic. For current incidents, provide a concise analyst summary followed by a Markdown table with columns الشركة/الهدف | التاريخ | الوصف المؤكد أو الادعاء | الجهة المزعومة | المصدر. Include only results directly relevant to cyber breaches, ransomware disclosures, threat actors, or defensive CTI. Exclude social-media chatter, generic news, videos, and unrelated pages. Deduplicate results, distinguish verified reporting from criminal claims, and cite source URLs. Never output raw search cards, search-result snippets as a substitute for analysis, internal notes, or speculative incidents. If the sources are not relevant or cannot support an answer, say that current relevant evidence could not be verified; do not fabricate findings. Do not provide instructions to buy stolen data, access criminal marketplaces, or obtain unauthorized access."
      ].filter(Boolean).join("\n\n").slice(0, 4000),
    },
  };

  const rawSearchOutput = (value: unknown) => {
    if (typeof value !== "string") return false;
    return /##\s*نتائج البحث المباشر|تعذر تلخيص النتائج عبر النموذج|###\s*\d+\.\s*\[[^\]]+\]\(https?:\/\/|عدد المصادر:\s*\d+/i.test(value);
  };
  const safeFailure = "تعذّر إنشاء تحليل استخبارات تهديدات موثوق من نتائج البحث الحالية، لذلك لم أعرض بطاقات البحث الخام على أنها إجابة. أعد المحاولة بعد قليل.";
  const originalJson = typeof res.json === "function" ? res.json.bind(res) : null;
  if (originalJson) {
    res.json = (payload: any) => {
      if (payload && typeof payload.content === "string" && rawSearchOutput(payload.content)) {
        payload = { ...payload, content: safeFailure, searchSynthesisFailed: true };
      }
      return originalJson(payload);
    };
  }

  const originalWrite = typeof res.write === "function" ? res.write.bind(res) : null;
  if (originalWrite) {
    res.write = (chunk: any, ...args: any[]) => {
      if (typeof chunk !== "string" && !Buffer.isBuffer(chunk)) return originalWrite(chunk, ...args);
      const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
      // Dark Web streaming emits no model deltas; its final SSE event contains
      // the completed answer. Replace raw-card fallbacks before they reach UI.
      const match = text.match(/data:\s*(\{.*\})\s*(?:\r?\n)/s);
      if (match) {
        try {
          const event = JSON.parse(match[1]);
          if (event?.type === "done" && rawSearchOutput(event.content)) {
            event.content = safeFailure;
            event.searchSynthesisFailed = true;
            const replaced = text.replace(match[1], JSON.stringify(event));
            return originalWrite(replaced, ...args);
          }
        } catch { /* Forward non-JSON stream frames unchanged. */ }
      }
      return originalWrite(chunk, ...args);
    };
  }

  return chatHandler(req, res);
}
