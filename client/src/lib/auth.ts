export type HotGPTUser = { id: string; email: string; name: string; role: "admin" | "user" };
export type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type?: string;
  user?: { id: string; email?: string; user_metadata?: Record<string, unknown> };
};

const STORAGE_KEY = "hotgpt.supabase.session";

function publicConfig() {
  const config = window.__MANUS_CONFIG__;
  const url = (config?.supabaseUrl || "").replace(/\/+$/, "");
  const key = config?.supabaseAnonKey || "";
  if (!url || !key) throw new Error("supabase_public_config_missing");
  return { url, key };
}

export function readSession(): StoredSession | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as StoredSession;
    return session?.access_token && session?.refresh_token ? session : null;
  } catch {
    return null;
  }
}

function saveSession(payload: any): StoredSession | null {
  if (!payload?.access_token || !payload?.refresh_token) return null;
  const session: StoredSession = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
    token_type: payload.token_type || "bearer",
    user: payload.user,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

async function authRequest(path: string, body: Record<string, unknown>, accessToken?: string) {
  const { url, key } = publicConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(payload.msg || payload.message || payload.error_description || payload.error || "");
    if (/already registered|already exists/i.test(message)) throw new Error("email_already_registered");
    if (/invalid login credentials/i.test(message)) throw new Error("invalid_credentials");
    if (/password.*(weak|short|least)/i.test(message)) throw new Error("password_too_weak");
    if (/rate limit|too many requests/i.test(message)) throw new Error("auth_rate_limited");
    throw new Error(message || "auth_request_failed");
  }
  return payload;
}

export async function signUp(email: string, password: string, displayName: string) {
  const payload = await authRequest("signup", {
    email: email.trim().toLowerCase(),
    password,
    data: { display_name: displayName.trim() },
    gotrue_meta_security: {},
  });
  const session = saveSession(payload);
  return { session, confirmationRequired: !session };
}

export async function signIn(email: string, password: string) {
  const payload = await authRequest("token?grant_type=password", {
    email: email.trim().toLowerCase(),
    password,
  });
  const session = saveSession(payload);
  if (!session) throw new Error("auth_session_missing");
  return session;
}

export async function signOut() {
  const session = readSession();
  try {
    if (session?.access_token) await authRequest("logout", {}, session.access_token);
  } finally {
    clearSession();
  }
}

export async function getAccessToken(): Promise<string | null> {
  const session = readSession();
  if (!session) return null;
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session.access_token;
  try {
    const payload = await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
    const next = saveSession(payload);
    return next?.access_token ?? null;
  } catch {
    clearSession();
    return null;
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers, credentials: "same-origin", cache: init.cache ?? "no-store" });
}
