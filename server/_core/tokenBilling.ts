import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import * as db from "../db";

const PACKAGES = {
  500: 300,
  800: 500,
  1000: 700,
} as const;
type PackageTokens = keyof typeof PACKAGES;

async function requireUser(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user || user.id < 1 || !user.email) {
      res.status(401).json({ error: "login_required" });
      return null;
    }
    return user;
  } catch {
    res.status(401).json({ error: "login_required" });
    return null;
  }
}

function isAdmin(user: { role?: string; email?: string | null }) {
  const allowlist = (process.env.HOTGPT_ADMIN_EMAILS ?? "")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return user.role === "admin" || Boolean(user.email && allowlist.includes(user.email.toLowerCase()));
}

async function requireAdmin(req: Request, res: Response) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (!isAdmin(user)) {
    res.status(403).json({ error: "admin_required" });
    return null;
  }
  return user;
}

export function registerTokenBillingRoutes(app: Express) {
  app.get("/api/billing/config", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      vodafoneCashNumber: "01063537686",
      paypalPaymentUrl: process.env.PAYPAL_PAYMENT_URL ?? "",
      packages: [
        { tokens: 500, priceEgp: 300 },
        { tokens: 800, priceEgp: 500 },
        { tokens: 1000, priceEgp: 700 },
      ],
      freeAnswers: 2,
      creditsPerAnswer: 1,
    });
  });

  app.get("/api/billing/me", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const wallet = await db.getWallet(user.id);
      res.setHeader("Cache-Control", "no-store");
      res.json({ email: user.email, name: user.name, ...wallet });
    } catch (error) {
      console.error("[Billing] Wallet lookup failed", error instanceof Error ? error.message : "unknown");
      res.status(503).json({ error: "billing_unavailable" });
    }
  });

  app.post("/api/billing/payment", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const body = req.body ?? {};
    const tokens = Number(body.packageTokens) as PackageTokens;
    const method = body.paymentMethod;
    const screenshotData = body.screenshotData;
    const transferReference = typeof body.transferReference === "string" ? body.transferReference.slice(0, 200) : "";
    if (!(tokens in PACKAGES) || !["vodafone_cash", "paypal"].includes(method)) {
      return res.status(400).json({ error: "invalid_package_or_method" });
    }
    if (typeof screenshotData !== "string" ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(screenshotData) ||
        screenshotData.length > 1_700_000) {
      return res.status(400).json({ error: "invalid_screenshot" });
    }
    try {
      const request = await db.submitPaymentRequest({
        userId: user.id,
        email: user.email!,
        paymentMethod: method,
        packageTokens: tokens,
        amountEgp: PACKAGES[tokens],
        transferReference,
        screenshotData,
      });
      return res.status(201).json({ success: true, requestId: request.id, status: request.status });
    } catch (error) {
      console.error("[Billing] Payment submission failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "payment_submission_failed" });
    }
  });

  app.get("/api/admin/billing/users", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ users: await db.listWalletUsers() });
    } catch (error) {
      console.error("[Billing] User list failed", error instanceof Error ? error.message : "unknown");
      res.status(503).json({ error: "admin_data_unavailable" });
    }
  });

  app.post("/api/admin/billing/balance", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const balance = Number(req.body?.tokenBalance);
    if (!email || email.length > 320 || !Number.isInteger(balance) || balance < 0 || balance > 10_000_000) {
      return res.status(400).json({ error: "invalid_email_or_balance" });
    }
    try {
      const user = await db.setTokenBalanceByEmail(email, balance);
      if (!user) return res.status(404).json({ error: "member_not_found" });
      return res.json({ success: true, user });
    } catch (error) {
      console.error("[Billing] Balance update failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "balance_update_failed" });
    }
  });

  app.get("/api/admin/billing/payments", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    try {
      res.setHeader("Cache-Control", "no-store");
      const requests = await db.listPaymentRequests();
      res.json({ requests: requests.map(item => ({ ...item, screenshotData: item.screenshotData })) });
    } catch (error) {
      console.error("[Billing] Payment list failed", error instanceof Error ? error.message : "unknown");
      res.status(503).json({ error: "payment_list_failed" });
    }
  });

  app.post("/api/admin/billing/payments/:id/:decision", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = Number(req.params.id);
    const decision = req.params.decision;
    if (!Number.isInteger(id) || id < 1 || !["approve", "reject"].includes(decision)) {
      return res.status(400).json({ error: "invalid_payment_decision" });
    }
    try {
      const payment = await db.reviewPaymentRequest(id, decision === "approve", admin.email ?? "admin");
      return res.json({ success: true, payment: { id: payment.id, status: payment.status } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      if (message === "Payment request not found") return res.status(404).json({ error: "payment_not_found" });
      if (message === "Payment request already reviewed") return res.status(409).json({ error: "payment_already_reviewed" });
      console.error("[Billing] Payment review failed", message);
      return res.status(503).json({ error: "payment_review_failed" });
    }
  });
}
