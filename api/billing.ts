import { requireMember } from "../server/_core/vercelAuth.ts";
import * as db from "../server/supabaseBilling.ts";

const PACKAGES: Record<number, number> = { 500: 300, 800: 500, 1000: 700 };

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const action = typeof req.query?.action === "string" ? req.query.action : "";
  if (action === "auth") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    const token = String(req.headers?.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return res.status(401).json({ error: "login_required" });
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
    if (!url || !key) return res.status(503).json({ error: "auth_unavailable" });
    try {
      const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` }, cache: "no-store" });
      if (response.status === 401 || response.status === 403) return res.status(401).json({ error: "login_required" });
      if (!response.ok) { console.error("[Auth] Supabase user endpoint returned", response.status); return res.status(503).json({ error: "auth_unavailable" }); }
      const user = await response.json() as any;
      if (!user?.id || !user?.email) return res.status(401).json({ error: "login_required" });
      return res.status(200).json({ id: String(user.id), email: String(user.email).toLowerCase(), name: user.user_metadata?.display_name || user.user_metadata?.full_name || "", role: "user" });
    } catch (error) {
      console.error("[Auth] Current user lookup failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "auth_unavailable" });
    }
  }
  if (action === "config") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    return res.status(200).json({
      vodafoneCashNumber: "01063537686",
      paypalPaymentUrl: process.env.PAYPAL_PAYMENT_URL ?? "",
      packages: [{ tokens: 500, priceEgp: 300 }, { tokens: 800, priceEgp: 500 }, { tokens: 1000, priceEgp: 700 }],
      freeAnswers: 2, creditsPerAnswer: 1,
    });
  }
  if (action === "me") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    try { return res.status(200).json({ email: user.email, name: user.name, ...(await db.getWallet(user.id)) }); }
    catch (error) {
      console.error("[Billing] Wallet lookup failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "billing_unavailable" });
    }
  }
  if (action === "payment") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    const body = req.body ?? {};
    const tokens = Number(body.packageTokens);
    const method = body.paymentMethod;
    const screenshotData = body.screenshotData;
    if (!PACKAGES[tokens] || !["vodafone_cash", "paypal"].includes(method)) return res.status(400).json({ error: "invalid_package_or_method" });
    if (typeof screenshotData !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(screenshotData) || screenshotData.length > 1_000_000) {
      return res.status(400).json({ error: "invalid_screenshot" });
    }
    try {
      const request = await db.submitPaymentRequest({
        userId: user.id, email: user.email!, paymentMethod: method,
        packageTokens: tokens, amountEgp: PACKAGES[tokens],
        transferReference: typeof body.transferReference === "string" ? body.transferReference.slice(0, 200) : "",
        screenshotData,
      });
      return res.status(201).json({ success: true, requestId: request.id, status: request.status });
    } catch (error) {
      console.error("[Billing] Payment submission failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "payment_submission_failed" });
    }
  }
  return res.status(404).json({ error: "unknown_billing_action" });
}
