import { requireMember } from "../_lib/auth";
import * as db from "../../server/db";

const PACKAGES: Record<number, number> = { 500: 300, 800: 500, 1000: 700 };

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const user = await requireMember(req, res);
  if (!user) return;
  const body = req.body ?? {};
  const tokens = Number(body.packageTokens);
  const method = body.paymentMethod;
  const screenshotData = body.screenshotData;
  if (!PACKAGES[tokens] || !["vodafone_cash", "paypal"].includes(method)) return res.status(400).json({ error: "invalid_package_or_method" });
  if (typeof screenshotData !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(screenshotData) || screenshotData.length > 1_700_000) {
    return res.status(400).json({ error: "invalid_screenshot" });
  }
  try {
    const request = await db.submitPaymentRequest({
      userId: user.id,
      email: user.email!,
      paymentMethod: method,
      packageTokens: tokens,
      amountEgp: PACKAGES[tokens],
      transferReference: typeof body.transferReference === "string" ? body.transferReference.slice(0, 200) : "",
      screenshotData,
    });
    return res.status(201).json({ success: true, requestId: request.id, status: request.status });
  } catch (error) {
    console.error("[Billing] Payment submission failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "payment_submission_failed" });
  }
}
