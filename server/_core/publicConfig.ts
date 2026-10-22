// Only browser-safe values are exposed. Secret/service-role keys must never be serialized.
export function publicPlatformConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    // Retained for the optional Maps integration; never used for authentication.
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? "",
    // Support common Vercel/Supabase variable names across projects.
    supabaseUrl: (
      env.SUPABASE_URL ||
      env.NEXT_PUBLIC_SUPABASE_URL ||
      env.VITE_SUPABASE_URL ||
      ""
    ).replace(/\/+$/, ""),
    supabaseAnonKey:
      env.SUPABASE_ANON_KEY ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      env.VITE_SUPABASE_ANON_KEY ||
      env.SUPABASE_PUBLISHABLE_KEY ||
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      "",
  };
}

export function publicPlatformScript(env: NodeJS.ProcessEnv = process.env): string {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json};`;
}
