import chatHandler from "./model/chat";

/**
 * Dedicated Dark Web API entry point.
 * It deliberately forces Dark Web mode and disables generic web-search mode,
 * so generic search instructions can never override the specialist prompt.
 */
export default async function darkWebHandler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const modes = body.modes && typeof body.modes === "object" ? body.modes : {};
  req.body = {
    ...body,
    modes: {
      ...modes,
      webSearch: false,
      darkWeb: true,
    },
  };

  return chatHandler(req, res);
}
