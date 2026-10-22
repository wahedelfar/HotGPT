import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";

export const ADMIN_COOKIE = "hotgpt_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;
const adminEmail = () => (process.env.HOTGPT_ADMIN_EMAILS || "").split(",")[0].trim().toLowerCase();
const secret = () => process.env.ADMIN_SESSION_SECRET || "";
const supabaseUrl = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

type AdminCredential = { email: string; password_hash: string; updated_at: string };

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function verifyPassword(password: string, stored: string) {
  try {
    const [salt, expectedHex] = stored.split(":");
    if (!salt || !expectedHex) return false;
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
function sign(value: string) {
  const key = secret();
  if (!key) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return createHmac("sha256", key).update(value).digest("base64url");
}

async function credentialRequest(path: string, init: RequestInit = {}) {
  const url = supabaseUrl();
  const key = serviceKey();
  if (!url || !key) throw new Error("Supabase server credentials are not configured");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
    cache: "no-store",
  });
  const body = await response.text();
  let payload: any = null;
  try { payload = body ? JSON.parse(body) : null; } catch { payload = body; }
  if (!response.ok) {
    console.error("[AdminAuth] Supabase credential storage failed", response.status,
      typeof payload === "object" ? payload?.code || payload?.message || "request_failed" : "request_failed");
    throw new Error("Admin credential storage is unavailable");
  }
  return payload;
}

async function getCredential(email: string): Promise<AdminCredential | null> {
  const rows = await credentialRequest(
    `admin_credentials?email=eq.${encodeURIComponent(email)}&select=email,password_hash,updated_at&limit=1`,
  );
  return rows?.[0] ?? null;
}

export async function loginAdmin(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();
  if (!email || email !== adminEmail() || !password) return false;
  if (!secret()) throw new Error("ADMIN_SESSION_SECRET is not configured");

  let row = await getCredential(email);
  if (!row) {
    const initial = process.env.ADMIN_INITIAL_PASSWORD || "";
    if (!initial || password !== initial) return false;
    await credentialRequest("admin_credentials?on_conflict=email", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ email, password_hash: hashPassword(initial), updated_at: new Date().toISOString() }),
    });
    row = await getCredential(email);
  }
  if (!row || !verifyPassword(password, row.password_hash)) return false;
  return { email, updatedAt: new Date(row.updated_at).getTime() };
}

export function createAdminCookie(session: { email: string; updatedAt: number }) {
  const payload = Buffer.from(JSON.stringify({
    ...session,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  })).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  return `${ADMIN_COOKIE}=${value}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearAdminCookie() {
  return `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function readAdminSession(req: any) {
  try {
    const token = parse(req.headers.cookie || "")[ADMIN_COOKIE];
    if (!token || !secret()) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.email !== adminEmail() || session.exp < Date.now() / 1000) return null;
    const row = await getCredential(session.email);
    if (!row || new Date(row.updated_at).getTime() !== Number(session.updatedAt)) return null;
    return { email: session.email, role: "admin" as const };
  } catch {
    return null;
  }
}

export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  const email = adminEmail();
  if (!email) throw new Error("HOTGPT_ADMIN_EMAILS is not configured");
  if (newPassword.length < 10) throw new Error("كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل.");
  const row = await getCredential(email);
  if (!row || !verifyPassword(currentPassword, row.password_hash)) {
    throw new Error("كلمة المرور الحالية غير صحيحة.");
  }
  const updatedAt = new Date().toISOString();
  const updated = await credentialRequest(
    `admin_credentials?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ password_hash: hashPassword(newPassword), updated_at: updatedAt }),
    },
  );
  if (!updated?.[0]) throw new Error("تعذر حفظ كلمة المرور الجديدة.");
}
