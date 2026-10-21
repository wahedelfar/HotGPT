import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { adminCredentials } from "../../drizzle/schema.js";

export const ADMIN_COOKIE = "hotgpt_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;
const adminEmail = () => (process.env.HOTGPT_ADMIN_EMAILS || "").split(",")[0].trim().toLowerCase();
const secret = () => process.env.ADMIN_SESSION_SECRET || "";

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function sign(value: string) {
  const key = secret();
  if (!key) throw new Error("ADMIN_SESSION_SECRET or MANUS_JWT_SECRET must be configured");
  return createHmac("sha256", key).update(value).digest("base64url");
}
export async function loginAdmin(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();
  if (email !== adminEmail() || !password) return false;
  const database = await getDb();
  if (!database) throw new Error("Database is not available");
  let rows = await database.select().from(adminCredentials).where(eq(adminCredentials.email, email)).limit(1);
  if (!rows.length) {
    const initial = process.env.ADMIN_INITIAL_PASSWORD;
    if (!initial || initial.length < 10) throw new Error("ADMIN_INITIAL_PASSWORD must be set to at least 10 characters before first admin login");
    if (password !== initial) return false;
    try {
      await database.insert(adminCredentials).values({ email, passwordHash: hashPassword(initial) });
    } catch {
      // Another concurrent first login may have initialized the row.
    }
    rows = await database.select().from(adminCredentials).where(eq(adminCredentials.email, email)).limit(1);
  }
  const row = rows[0];
  if (!row || !verifyPassword(password, row.passwordHash)) return false;
  return { email, updatedAt: new Date(row.updatedAt).getTime() };
}
export function createAdminCookie(session: { email: string; updatedAt: number }) {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  return `${ADMIN_COOKIE}=${value}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}
export function clearAdminCookie() {
  return `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
export async function readAdminSession(req: any) {
  try {
    const token = parse(req.headers.cookie || "")[ADMIN_COOKIE];
    if (!token) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !secret()) return null;
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.email !== adminEmail() || session.exp < Date.now() / 1000) return null;
    const database = await getDb();
    if (!database) return null;
    const rows = await database.select().from(adminCredentials).where(eq(adminCredentials.email, session.email)).limit(1);
    if (!rows[0] || new Date(rows[0].updatedAt).getTime() !== session.updatedAt) return null;
    return { email: session.email, role: "admin" as const };
  } catch {
    return null;
  }
}
export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  const email = adminEmail();
  if (newPassword.length < 10) throw new Error("كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل.");
  const database = await getDb();
  if (!database) throw new Error("Database is not available");
  const rows = await database.select().from(adminCredentials).where(eq(adminCredentials.email, email)).limit(1);
  const row = rows[0];
  if (!row || !verifyPassword(currentPassword, row.passwordHash)) throw new Error("كلمة المرور الحالية غير صحيحة.");
  await database.update(adminCredentials).set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() }).where(eq(adminCredentials.email, email));
}
