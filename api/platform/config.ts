import type { VercelRequest, VercelResponse } from "@vercel/node";
import { publicPlatformScript } from "../../server/_core/publicConfig";

/**
 * Public, runtime configuration for the browser.
 * Only publishable Supabase values are serialized; service-role secrets are never exposed.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).send(publicPlatformScript());
}
