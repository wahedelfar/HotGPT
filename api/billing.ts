import { requireMember } from "../server/_core/vercelAuth.ts";
import * as db from "../server/supabaseBilling.ts";

const PACKAGES: Record<number, number> = { 500: 300, 800: 500, 1000: 700 };

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const action = typeof req.query?.action === "string" ? req.query.action : "";
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
