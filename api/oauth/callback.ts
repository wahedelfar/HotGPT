import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "../../shared/const";
import { parse } from "cookie";
import { sdk } from "../../server/_core/sdk";
import * as db from "../../server/db";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state) return res.status(400).json({ error: "code_and_state_required" });

  const decoded = decodeOAuthState(state);
  const cookies = parse(req.headers.cookie ?? "");
  if (!decoded.nonce || decoded.nonce !== cookies[OAUTH_STATE_COOKIE]) {
    return res.status(403).json({ error: "invalid_oauth_state" });
  }

  try {
    const tokenResponse = await sdk.exchangeCodeForToken(code, state);
    const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
    if (!userInfo.openId) return res.status(400).json({ error: "open_id_missing" });

    await db.upsertUser({
      openId: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: new Date(),
    });
    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });
    res.setHeader("Set-Cookie", [
      `${COOKIE_NAME}=${sessionToken}; Path=/; Max-Age=${Math.floor(ONE_YEAR_MS / 1000)}; HttpOnly; Secure; SameSite=None`,
      `${OAUTH_STATE_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=None`,
    ]);
    return res.redirect(302, "/");
  } catch (error) {
    console.error("[OAuth] Vercel callback failed", error instanceof Error ? error.message : "unknown");
    return res.status(500).json({ error: "oauth_callback_failed" });
  }
}
