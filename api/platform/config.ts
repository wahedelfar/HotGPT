/**
 * Runtime public configuration endpoint.
 *
 * Keep this handler self-contained: Vercel's Node ESM runtime was failing to
 * resolve the shared TypeScript helper in the deployed function bundle.
 * These values are public browser credentials (project URL + publishable key),
 * never service-role secrets.
 */
export default function handler(_req: any, res: any) {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://ujtvgdaslpevoaraweid.supabase.co"
  ).replace(/\\/+$/, "");

  const supabaseAnonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "sb_publishable_q7zVDMzUpuycE4HccxN47Q_hu41dzIn";

  const config = {
    projectId: process.env.MANUS_PROJECT_ID || "",
    oauthPortalUrl: "",
    apiUrl: process.env.MANUS_API_URL || "",
    apiBrowserKey: process.env.MANUS_API_BROWSER_KEY || "",
    supabaseUrl,
    supabaseAnonKey,
  };

  const script = `window.__MANUS_CONFIG__=${JSON.stringify(config).replaceAll("<", "\\u003c")};`;
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(script);
}
