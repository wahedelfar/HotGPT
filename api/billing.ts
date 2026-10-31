import { publicPlatformScript } from "../server/_core/publicConfig.ts";
import { requireMember } from "../server/_core/vercelAuth.ts";
import * as db from "../server/supabaseBilling.ts";
import { usdForEgp } from "../server/fxRate.ts";

export const PACKAGES: Record<number, number> = { 100: 100, 500: 300, 800: 500, 1000: 700 };

// --- PayPal Checkout (Orders API), merged into this function on 2026-10-27:
// the Hobby plan allows at most 12 serverless functions per deployment, so
// PayPal cannot live in its own api file. Prices live ONLY on the server;
// packs are EGP-priced and PayPal charges the USD equivalent at today's
// live rate (see server/fxRate.ts), rounded up to the next whole dollar.
// Fulfillment rule: credit exactly once, inside the same request that
// receives a fresh CAPTURE success from PayPal; PayPal rejects a second
// capture of the same order, so double-crediting is impossible.
function paypalBase() {
  return process.env.PAYPAL_MODE === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}
function paypalCreds() {
  const id = process.env.PAYPAL_CLIENT_ID || "";
  const secret = process.env.PAYPAL_CLIENT_SECRET || "";
  if (!id || !secret) throw new Error("paypal_not_configured");
  return { id, secret };
}
async function paypalAccessToken(): Promise<string> {
  const { id, secret } = paypalCreds();
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok || !payload.access_token) throw new Error("paypal_auth_failed");
  return String(payload.access_token);
}
async function paypalApi(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${paypalBase()}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({} as any));
  return { ok: response.ok, status: response.status, payload };
}
function paypalError(res: any, error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "paypal_not_configured") return res.status(503).json({ error: "paypal_not_configured" });
  console.error("[PayPal] Handler failed", code || "unknown");
  return res.status(502).json({ error: "paypal_unavailable" });
}


// --- PayPal webhook (action "paypal-webhook"): PayPal POSTs capture
// refunds, reversals and dispute events to this function's URL
// (https://hotgpt.pro/api/billing?action=paypal-webhook). No member
// session exists on these calls — authenticity comes from PayPal's
// verify-webhook-signature API, checked before anything is stored or
// processed. Purpose (Wahid, 2026-10-28): foreign buyers can dispute
// or charge back AFTER receiving tokens; the webhook claws the tokens
// back automatically and keeps a full audit trail in
// paypal_webhook_events. Requires PAYPAL_WEBHOOK_ID in the environment
// and the paypal_webhook_events table (rollout SQL).
function paypalHeader(req: any, name: string) {
  const value = req.headers?.[name];
  return typeof value === "string" ? value : "";
}
function extractCaptureId(event: any): string {
  const resource = event?.resource || {};
  const related = resource?.supplementary_data?.related_ids || {};
  if (typeof related.capture_id === "string" && related.capture_id) return related.capture_id;
  if (event?.event_type === "PAYMENT.CAPTURE.REVERSED" || event?.event_type === "PAYMENT.CAPTURE.DENIED") {
    return typeof resource.id === "string" ? resource.id : "";
  }
  if (Array.isArray(resource.links)) {
    for (const link of resource.links) {
      const match = String(link?.href || "").match(/\/captures\/([A-Z0-9]+)/i);
      if (match) return match[1];
    }
  }
  const disputed = resource?.disputed_transactions?.[0];
  if (typeof disputed?.seller_transaction_id === "string") return disputed.seller_transaction_id;
  return "";
}
function extractOrderId(event: any): string {
  const related = event?.resource?.supplementary_data?.related_ids || {};
  return typeof related.order_id === "string" ? related.order_id : "";
}
async function handlePaypalWebhook(req: any, res: any) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const webhookId = process.env.PAYPAL_WEBHOOK_ID || "";
  if (!webhookId) {
    console.error("[PayPal Webhook] PAYPAL_WEBHOOK_ID is not configured");
    return res.status(503).json({ error: "paypal_webhook_not_configured" });
  }
  let event: any = null;
  try {
    event = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
  } catch { event = null; }
  if (!event?.id || !event?.event_type) return res.status(400).json({ error: "invalid_event" });
  // 1) Verify the transmission really came from PayPal.
  let verified = false;
  try {
    const token = await paypalAccessToken();
    const { ok, payload } = await paypalApi(token, "/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: JSON.stringify({
        auth_algo: paypalHeader(req, "paypal-auth-algo"),
        cert_url: paypalHeader(req, "paypal-cert-url"),
        transmission_id: paypalHeader(req, "paypal-transmission-id"),
        transmission_sig: paypalHeader(req, "paypal-transmission-sig"),
        transmission_time: paypalHeader(req, "paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: event,
      }),
    });
    verified = ok && payload?.verification_status === "SUCCESS";
  } catch (error) {
    console.error("[PayPal Webhook] Verification call failed", error instanceof Error ? error.message : "unknown");
    return res.status(500).json({ error: "verification_unavailable" });
  }
  if (!verified) {
    console.error("[PayPal Webhook] Signature rejected for event", String(event.id));
    return res.status(401).json({ error: "invalid_signature" });
  }
  // 2) Store first (idempotent on event id). If the store fails the
  // rollout SQL has not run — answer 500 so PayPal retries later.
  const captureId = extractCaptureId(event);
  const orderId = extractOrderId(event);
  const resourceId = captureId || (typeof event.resource?.id === "string" ? event.resource.id : null);
  let inserted = false;
  try {
    inserted = await db.recordPaypalWebhookEvent({
      eventId: String(event.id), eventType: String(event.event_type),
      resourceId, payload: event,
    });
  } catch (error) {
    console.error("[PayPal Webhook] Event store failed", error instanceof Error ? error.message : "unknown");
    return res.status(500).json({ error: "webhook_store_failed" });
  }
  if (!inserted) return res.status(200).json({ received: true, duplicate: true });
  // 3) Process. Failures here are logged and noted on the stored event;
  // the endpoint still answers 200 so PayPal does not retry-storm —
  // the stored payload is the audit and can be replayed by hand.
  let note = "recorded_only";
  let matchedUserId: string | null = null;
  let tokensDeducted = 0;
  try {
    const type = String(event.event_type);
    if (type === "PAYMENT.CAPTURE.REFUNDED" || type === "PAYMENT.CAPTURE.REVERSED" || type === "PAYMENT.CAPTURE.DENIED") {
      if (!captureId) {
        note = "clawback_skipped_no_capture_id";
      } else if (await db.findProcessedClawback(captureId)) {
        note = "clawback_skipped_already_processed";
      } else {
        const pack = await db.findPaypalPackPurchase(captureId);
        if (pack) {
          let due = pack.packageTokens;
          if (type === "PAYMENT.CAPTURE.REFUNDED" && pack.amountUsd > 0) {
            const refunded = Number(event?.resource?.amount?.value);
            if (Number.isFinite(refunded) && refunded > 0 && refunded < pack.amountUsd) {
              due = Math.floor(pack.packageTokens * (refunded / pack.amountUsd));
            }
          }
          const result = await db.clawbackTokens(pack.userId, due);
          matchedUserId = pack.userId;
          tokensDeducted = result.deducted;
          note = result.deducted >= due
            ? `clawback_pack_full:${due}`
            : `clawback_pack_partial:due=${due},deducted=${result.deducted},balance_left=${result.balance}`;
        } else if (orderId) {
          const spins = await db.findLuckySpinsByPaypalOrder(orderId);
          if (spins.length > 0) {
            matchedUserId = spins[0].userId;
            const won = spins.reduce((sum, s) => sum + (s.spun ? s.prizeTokens : 0), 0);
            let voided = 0;
            for (const spin of spins) {
              if (!spin.spun && spin.status === "approved") {
                await db.voidLuckySpin(spin.id).catch(() => {});
                voided++;
              }
            }
            const result = won > 0
              ? await db.clawbackTokens(matchedUserId, won)
              : { deducted: 0, balance: 0 };
            tokensDeducted = result.deducted;
            note = `clawback_lucky:won=${won},deducted=${result.deducted},spins_voided=${voided}`;
          } else {
            note = "clawback_unmatched_purchase";
          }
        } else {
          note = "clawback_unmatched_purchase";
        }
      }
    } else if (type === "CUSTOMER.DISPUTE.CREATED") {
      // Flag only — PayPal has not moved money yet, and the dispute can
      // still be won with the audit trail (payment_requests + ledger).
      const pack = captureId ? await db.findPaypalPackPurchase(captureId) : null;
      matchedUserId = pack?.userId ?? null;
      note = pack ? "dispute_opened_flagged" : "dispute_opened_unmatched";
    } else if (type === "CUSTOMER.DISPUTE.RESOLVED") {
      const pack = captureId ? await db.findPaypalPackPurchase(captureId) : null;
      matchedUserId = pack?.userId ?? null;
      const outcome = String(event?.resource?.dispute_outcome?.outcome_code || "unknown");
      note = `dispute_resolved:${outcome}`;
    }
  } catch (error) {
    console.error("[PayPal Webhook] Processing failed for event", String(event.id), error instanceof Error ? error.message : "unknown");
    note = "processing_error";
  }
  await db.updatePaypalWebhookEvent(String(event.id), { matchedUserId, tokensDeducted, note }).catch(() => {});
  return res.status(200).json({ received: true });
}

// --- Telegram payment gateway (v1): every manual payment submission is
// forwarded to the admin's Telegram chat (@HOT_GPTPaybot) with the proof
// photo and approve / reject buttons, and the buttons' callbacks land
// back here as action "telegram-webhook" — no new serverless file (the
// 12-function cap). No member session exists on webhook calls;
// authenticity comes from the shared secret Telegram echoes in the
// x-telegram-bot-api-secret-token header (set at setWebhook time).
function telegramPayConfig() {
  const token = process.env.TELEGRAM_PAY_BOT_TOKEN || "";
  const adminChatId = process.env.TELEGRAM_PAY_ADMIN_CHAT_ID || "";
  if (!token || !adminChatId) return null;
  return { token, adminChatId };
}
async function telegramPayApi(method: string, body: FormData | Record<string, unknown>) {
  const cfg = telegramPayConfig();
  if (!cfg) return { ok: false, payload: null as any };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(`https://api.telegram.org/bot${cfg.token}/${method}`, {
    method: "POST",
    body: isForm ? (body as FormData) : JSON.stringify(body),
    headers: isForm ? undefined : { "content-type": "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  return { ok: Boolean((payload as any)?.ok), payload };
}
async function sendTelegramPaymentAlert(args: {
  request: { id: string; email: string; paymentMethod: string; packageTokens: number; amountEgp: number; transferReference: string | null; proofPath: string };
  bridge: string;
}) {
  try {
    const cfg = telegramPayConfig();
    if (!cfg) return;
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
    if (!url || !key) { console.error("[Telegram] Supabase storage not configured for proof fetch"); return; }
    const proofResponse = await fetch(`${url}/storage/v1/object/hotgpt-payment-proofs/${args.request.proofPath}`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!proofResponse.ok) { console.error("[Telegram] Proof fetch failed", proofResponse.status); return; }
    const bytes = await proofResponse.arrayBuffer();
    const bridgeText = args.bridge === "granted" ? "مُنحت (٥ توكين)"
      : args.bridge === "blocked" ? "محظورة"
      : args.bridge === "duplicate" ? "مكررة — عنده جسر قائم" : "لم تُمنح";
    const caption = [
      "طلب دفع جديد — HotGPT",
      `العضو: ${args.request.email}`,
      `الباقة: ${args.request.packageTokens} توكين — ${args.request.amountEgp} جنيه`,
      `الوسيلة: ${args.request.paymentMethod === "instapay" ? "إنستا باي" : "فودافون كاش"}`,
      `رقم العملية: ${args.request.transferReference || "—"}`,
      `هدية الجسر: ${bridgeText}`,
    ].join("\n");
    const form = new FormData();
    form.append("chat_id", cfg.adminChatId);
    form.append("photo", new Blob([bytes]), "proof.jpg");
    form.append("caption", caption);
    form.append("reply_markup", JSON.stringify({
      inline_keyboard: [
        [{ text: "✅ موافقة وإضافة التوكنات", callback_data: `pay:approve:${args.request.id}` }],
        [{ text: "❌ رفض – إثبات غير صحيح", callback_data: `pay:reject_fake:${args.request.id}` }],
        [{ text: "🔁 رفض – صورة غير واضحة", callback_data: `pay:reject_unclear:${args.request.id}` }],
      ],
    }));
    const { ok, payload } = await telegramPayApi("sendPhoto", form);
    if (ok && payload?.result?.message_id) {
      await db.setPaymentRequestTelegramMessageId(args.request.id, Number(payload.result.message_id)).catch(() => {});
    } else {
      console.error("[Telegram] sendPhoto failed", payload?.description || "unknown");
    }
  } catch (error) {
    // The request itself is the record and the admin panel is the
    // reference — a Telegram outage must never fail a submission.
    console.error("[Telegram] Payment alert failed", error instanceof Error ? error.message : "unknown");
  }
}
// --- Telegram-native visitor intake: the flow Wahid designed and ran on
// the getUpdates watcher until the webhook replaced it (Telegram feeds
// updates to one channel only). Ported into this handler with the same
// texts and steps; the one mechanical change is that the handler is
// stateless, so the member writes the registered email and the number
// transferred from in the proof photo's caption instead of sending the
// three items as separate messages. Pack buttons, admin forwarding with
// «تم التفعيل / رفض» signal buttons, and the decision relay to the member
// behave exactly as the watcher did. Signal buttons only NOTIFY the
// member — crediting a native submission still happens in the admin
// panel, as in v1.
const INTAKE_PACKAGES: Record<number, number> = { 100: 100, 500: 300, 800: 500, 1000: 700 };
const INTAKE_PACK_BUTTONS = {
  inline_keyboard: [
    [{ text: "باقة 100 توكين — 100 جنيه", callback_data: "pack:100" }],
    [{ text: "باقة 500 توكين — 300 جنيه", callback_data: "pack:500" }],
    [{ text: "باقة 800 توكين — 500 جنيه", callback_data: "pack:800" }],
    [{ text: "باقة 1000 توكين — 700 جنيه", callback_data: "pack:1000" }],
  ],
};
const INTAKE_ACTIVATE_KEYBOARD = {
  keyboard: [[{ text: "🚀 فعّل باقتي" }]],
  resize_keyboard: true,
  is_persistent: true,
};
const INTAKE_WELCOME_TEXT = [
  "🟥🟨 أهلاً بيك في HotGPT",
  "━━━━━━━━━━━━━━",
  "منصة ذكاء اصطناعي عربية للمطورين والمسوقين وشركات تطوير المواقع — أجوبة بدون قيود على البحث والبرمجة، وبأرخص أسعار بالجنيه المصري.",
  "",
  "🎁 هدية ترحيب: ٥ توكين مجانًا أول ما تنشئ حسابك.",
  "",
  "🌐 زور الموقع وجرّب بنفسك:",
  "https://hotgpt.pro",
  "━━━━━━━━━━━━━━",
  "🔥 HotGPT — بدون قيود على البحث والبرمجة",
].join("\n");
const INTAKE_WELCOME_MARKUP = {
  inline_keyboard: [
    [
      { text: "🌐 زيارة الموقع", url: "https://hotgpt.pro" },
      { text: "✍️ إنشاء حساب مجاني", url: "https://hotgpt.pro/auth?mode=signup" },
    ],
  ],
};
const INTAKE_GATEWAY_TEXT = "أهلاً بك في بوابة دفع HOT GPT الذكية 🔥\nمن فضلك اختر باقتك المراد تفعيلها 👇";
function intakeProofRequestText(packTokens: number) {
  const price = INTAKE_PACKAGES[packTokens];
  return [
    `اخترت باقة ${packTokens} توكين — ${price} جنيه ✔`,
    "",
    "حوّل مبلغ الباقة إلى:",
    "📱 فودافون كاش: 01063537686",
    "💳 إنستاباي: wahedelfar@instapay",
    "https://ipn.eg/S/wahedelfar/instapay/4LnUCo",
    "",
    "وبعد التحويل، ابعت هنا اسكرين التحويل — يكون واضح — واكتب في تعليقه:",
    "١. الإيميل المسجل به في الموقع",
    "٢. الرقم المحول منه",
    "لسرعة المراجعة وإضافة الباقة لحسابك ⚡",
    "",
    "⚠️ مهم: الاسكرين لازم يكون كاملًا ويبان فيه رقم العملية وتاريخها بوضوح — من غيرهم الطلب بيتحول للمراجعة اليدوية وبتستغرق من ١٠ ل ٣٠ دقيقة.",
    "",
    "ولو ناقص حاجة في التعليق هنقولك عليها.",
  ].join("\n");
}
async function intakeSend(chatId: string | number, text: string, replyMarkup?: unknown, parseMode?: string) {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (replyMarkup) body.reply_markup = replyMarkup;
  if (parseMode) body.parse_mode = parseMode;
  return telegramPayApi("sendMessage", body).catch(() => ({ ok: false, payload: null as any }));
}
async function handleTelegramIntakeMessage(update: any) {
  const cfg = telegramPayConfig();
  if (!cfg) return;
  const msg = update?.message;
  const chat = msg?.chat;
  if (!chat || chat.type !== "private") return;
  const chatId = String(chat.id);
  if (chatId === cfg.adminChatId) return;
  const who = msg?.from || {};
  const text = typeof msg?.text === "string" ? msg.text.trim() : "";
  const caption = typeof msg?.caption === "string" ? msg.caption : "";

  if (text === "/start") {
    await intakeSend(chatId, INTAKE_WELCOME_TEXT, INTAKE_WELCOME_MARKUP);
    await intakeSend(chatId, INTAKE_GATEWAY_TEXT, INTAKE_PACK_BUTTONS);
    return;
  }
  if (text.includes("فعّل باقتي")) {
    await intakeSend(chatId, INTAKE_GATEWAY_TEXT, INTAKE_PACK_BUTTONS);
    return;
  }

  if (Array.isArray(msg?.photo) && msg.photo.length) {
    const fileId = String(msg.photo[msg.photo.length - 1]?.file_id || "");
    const emailMatch = caption.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    const email = emailMatch ? emailMatch[0].toLowerCase() : "";
    const phoneMatch = caption.replace(/\s+/g, "").match(/\+?2?01\d{9}/);
    const instapayMatch = caption.match(/\S+@instapay/i);
    const sender = phoneMatch ? phoneMatch[0] : instapayMatch ? instapayMatch[0] : "";
    const packMatch = caption.match(/\b(1000|800|500|100)\b/);
    const pack = packMatch ? Number(packMatch[1]) : 0;
    const missing: string[] = [];
    if (!email) missing.push("الإيميل المسجل به");
    if (!sender) missing.push("الرقم المحول منه");
    if (missing.length) {
      await intakeSend(chatId, `وصلت الصورة ✔\nفاضل: ${missing.join("، ")}\nاكتبهم في تعليق على الاسكرين وابعت الصورة تاني — ولو عايز تبدأ من الأول اختار باقتك 👇`, INTAKE_PACK_BUTTONS);
      return;
    }
    const name = String(who.first_name || "").trim();
    const memberLine = name + (who.username ? ` (@${who.username})` : "");
    const adminCaption = [
      "🔔 طلب تفعيل جديد من البوت",
      pack ? `الباقة: ${pack} توكين — ${INTAKE_PACKAGES[pack]} جنيه` : "الباقة: غير مذكورة في التعليق — المبلغ باين في الصورة",
      `الإيميل: ${email}`,
      `الرقم المحول منه: ${sender}`,
      `العضو: ${memberLine}`,
      `شات العضو: ${chatId}`,
    ].join("\n");
    const sent = await telegramPayApi("sendPhoto", {
      chat_id: cfg.adminChatId,
      photo: fileId,
      caption: adminCaption,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ تم التفعيل", callback_data: `ok:${chatId}` },
            { text: "❌ رفض الطلب", callback_data: `no:${chatId}` },
          ],
        ],
      },
    }).catch(() => ({ ok: false, payload: null as any }));
    if (!sent.ok) {
      await intakeSend(chatId, "حصلت مشكلة أثناء إرسال طلبك — من فضلك حاول تبعت الاسكرين تاني بعد دقيقة.");
      return;
    }
    await intakeSend(
      chatId,
      "شكرًا لحضرتك 🙏\nدقيقة هراجع التحويل، ويمكنك العودة للموقع من <a href=\"https://hotgpt.pro\">هنا</a> واستخدام الهدية.\nوستصلك الباقة حالًا ⚡",
      INTAKE_ACTIVATE_KEYBOARD,
      "HTML",
    );
    return;
  }

  if (text) {
    const hasEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text) && !text.toLowerCase().includes("@instapay");
    const compact = text.replace(/\s+/g, "");
    const hasSender = /^\+?2?01\d{9}$/.test(compact) || text.toLowerCase().includes("@instapay");
    if (hasEmail || hasSender) {
      await intakeSend(chatId, "تمام ✔\nفاضل اسكرين التحويل — ابعته هنا واكتب في تعليقه الإيميل المسجل به والرقم المحول منه.");
      return;
    }
  }
  await intakeSend(chatId, INTAKE_GATEWAY_TEXT, INTAKE_PACK_BUTTONS);
}

async function handleTelegramWebhook(req: any, res: any) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const secret = process.env.TELEGRAM_PAY_WEBHOOK_SECRET || "";
  if (!secret) {
    console.error("[Telegram Webhook] TELEGRAM_PAY_WEBHOOK_SECRET is not configured");
    return res.status(503).json({ error: "telegram_webhook_not_configured" });
  }
  const given = typeof req.headers?.["x-telegram-bot-api-secret-token"] === "string" ? req.headers["x-telegram-bot-api-secret-token"] : "";
  if (given !== secret) return res.status(401).json({ error: "invalid_secret" });
  let update: any = null;
  try {
    update = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
  } catch { update = null; }
  if (update?.message) {
    await handleTelegramIntakeMessage(update).catch((error) => {
      console.error("[Telegram Webhook] Intake failed", error instanceof Error ? error.message : "unknown");
    });
    return res.status(200).json({ ok: true });
  }
  const callback = update?.callback_query;
  if (!callback) return res.status(200).json({ ok: true });
  const cfg = telegramPayConfig();
  const chatId = String(callback?.message?.chat?.id ?? "");
  const messageId = Number(callback?.message?.message_id || 0);
  const answer = async (text: string, alert = false) => {
    await telegramPayApi("answerCallbackQuery", { callback_query_id: String(callback.id), text, show_alert: alert }).catch(() => {});
  };
  const data = String(callback.data || "");
  if (data.startsWith("pack:")) {
    // Visitor intake: pack selection from the member's own chat.
    const pack = Number(data.slice(5));
    if (INTAKE_PACKAGES[pack]) {
      await answer(`اخترت باقة ${pack} توكين`);
      await intakeSend(chatId, intakeProofRequestText(pack));
    } else {
      await answer("");
    }
    return res.status(200).json({ ok: true });
  }
  if (!cfg || chatId !== cfg.adminChatId) {
    console.error("[Telegram Webhook] Callback from unexpected chat", chatId || "unknown");
    await answer("غير مصرّح", true);
    return res.status(200).json({ ok: true });
  }
  const signal = data.match(/^(ok|no):(\d+)$/);
  if (signal) {
    // Visitor-intake signal buttons: notify the member of the admin's
    // decision (crediting itself stays in the admin panel, as in v1).
    const memberChat = signal[2];
    const approved = signal[1] === "ok";
    if (approved) {
      await intakeSend(memberChat, "🎉 تم تفعيل باقتك بنجاح!\nالتوكنات اتضافت لحسابك على الموقع — افتح حسابك وهتلاقي رصيدك الجديد.\nhttps://hotgpt.pro");
      await answer("تم إبلاغ العضو بالتفعيل");
    } else {
      await intakeSend(memberChat, "تعذّر تفعيل طلبك هذه المرة.\nمن فضلك تأكد أن اسكرين التحويل واضح، وأن الإيميل هو المسجل به في الموقع، وأعد المحاولة — أو ادفع من صفحة الدفع في الموقع:\nhttps://hotgpt.pro");
      await answer("تم إبلاغ العضو بالرفض");
    }
    if (messageId) {
      await telegramPayApi("editMessageReplyMarkup", {
        chat_id: cfg.adminChatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
      }).catch(() => {});
      await telegramPayApi("sendMessage", {
        chat_id: cfg.adminChatId,
        text: approved ? "✔ تم التفعيل — طلب من البوت" : "✖ مرفوض — طلب من البوت",
        reply_to_message_id: messageId,
      }).catch(() => {});
    }
    return res.status(200).json({ ok: true });
  }
  const match = data.match(/^pay:(approve|reject_fake|reject_unclear):([0-9a-f-]{36})$/i);
  if (!match) {
    await answer("بيانات غير صالحة", true);
    return res.status(200).json({ ok: true });
  }
  const decision = match[1] as "approve" | "reject_fake" | "reject_unclear";
  const paymentId = match[2];
  try {
    const result = await db.reviewPaymentRequestShared({ paymentId, decision, source: "telegram", reviewer: "telegram-admin" });
    const answerText = decision === "approve" ? "تمت الموافقة ✔" : decision === "reject_fake" ? "تم الرفض ❌" : "تم الرفض 🔁";
    await answer(answerText);
    const time = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" });
    const resultLine = decision === "approve"
      ? `تمت الموافقة ✔ أُضيفت ${result.packageTokens} توكين — ${time}`
      : decision === "reject_fake"
        ? "تم الرفض ❌ إثبات غير صحيح — سُحبت هدية الجسر وحُظر العضو منها"
        : "تم الرفض 🔁 صورة غير واضحة — العضو يقدر يعيد الإرسال";
    const originalCaption = typeof callback?.message?.caption === "string" ? callback.message.caption : "";
    if (messageId) {
      await telegramPayApi("editMessageCaption", {
        chat_id: cfg.adminChatId, message_id: messageId,
        caption: originalCaption ? `${originalCaption}\n${resultLine}` : resultLine,
        reply_markup: { inline_keyboard: [] },
      }).catch(() => {});
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown";
    if (code === "payment_already_reviewed") {
      await answer("الطلب ده اتحسم قبل كده");
      if (messageId) {
        await telegramPayApi("editMessageReplyMarkup", {
          chat_id: cfg.adminChatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
        }).catch(() => {});
      }
    } else if (code === "payment_not_found") {
      await answer("الطلب غير موجود", true);
    } else {
      console.error("[Telegram Webhook] Review failed", code);
    }
  }
  return res.status(200).json({ ok: true });
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  const action = typeof req.query?.action === "string" ? req.query.action : "";
  if (action === "platform-config") {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(publicPlatformScript());
  }
  if (action === "paypal-webhook") return await handlePaypalWebhook(req, res);
  if (action === "telegram-webhook") return await handleTelegramWebhook(req, res);
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
    const packagesUsd = await Promise.all(Object.entries(PACKAGES).map(async ([tokens, priceEgp]) => {
      const { usd } = await usdForEgp(priceEgp);
      return { tokens: Number(tokens), priceUsd: usd };
    }));
    const { rate: usdEgpRate } = await usdForEgp(100);
    return res.status(200).json({
      vodafoneCashNumber: "01063537686",
      vodafoneCashUrl: "https://vf.eg/vfcash?id=mt&qrId=G0gO2O",
      instapayAddress: "wahedelfar@instapay",
      instapayUrl: "https://ipn.eg/S/wahedelfar/instapay/4LnUCo",
      paypalPaymentUrl: process.env.PAYPAL_PAYMENT_URL ?? "",
      paypalClientId: process.env.PAYPAL_CLIENT_ID ?? "",
      packages: [{ tokens: 100, priceEgp: 100 }, { tokens: 500, priceEgp: 300 }, { tokens: 800, priceEgp: 500 }, { tokens: 1000, priceEgp: 700 }],
      packagesUsd,
      usdEgpRate,
      freeAnswers: 0, welcomeGiftTokens: 5, creditsPerAnswer: 1,
    });
  }
  if (action === "me") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    try {
      let wallet = await db.getWallet(user.id);
      // Referral reward lands here: the first wallet read after the member's
      // first approved purchase credits both sides (server-verified,
      // exactly once). Fully best-effort — it must never break billing.
      try {
        const claim = await db.claimReferralReward(user.id);
        if (claim.credited) wallet = await db.getWallet(user.id);
      } catch { /* referral storage not ready yet */ }
      return res.status(200).json({ email: user.email, name: user.name, ...wallet });
    }
    catch (error) {
      console.error("[Billing] Wallet lookup failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "billing_unavailable" });
    }
  }
  if (action === "requests") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    try { return res.status(200).json({ requests: await db.listUserPaymentRequests(user.id) }); }
    catch (error) {
      console.error("[Billing] User payment requests failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "payment_requests_unavailable" });
    }
  }
  if (action === "referral-info") {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    await db.claimReferralReward(user.id).catch(() => null);
    const overview = await db.getReferralOverview(user.id);
    return res.status(200).json({ ready: Boolean(overview.code), rewardTokens: db.REFERRAL_REWARD_TOKENS, ...overview });
  }
  if (action === "referral-attach") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    const result = await db.attachReferral(user.id, String((req.body ?? {}).code || ""));
    return res.status(200).json({ result });
  }
  if (action === "referral-claim") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    const result = await db.claimReferralReward(user.id);
    return res.status(200).json(result);
  }
  if (action === "payment") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    const body = req.body ?? {};
    const tokens = Number(body.packageTokens);
    const method = body.paymentMethod;
    const screenshotData = body.screenshotData;
    if (!PACKAGES[tokens] || !["vodafone_cash", "instapay"].includes(method)) return res.status(400).json({ error: "invalid_package_or_method" });
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
      // Bridge gift + Telegram admin alert: both best-effort, neither may
      // ever fail the submission itself.
      let bridge = "none";
      try {
        bridge = await db.grantBridgeGiftIfEligible(request.id, user.id);
      } catch (error) {
        console.error("[Billing] Bridge gift failed", error instanceof Error ? error.message : "unknown");
      }
      const full = await db.getPaymentRequestById(request.id).catch(() => null);
      if (full) await sendTelegramPaymentAlert({ request: full, bridge });
      return res.status(201).json({ success: true, requestId: request.id, status: request.status, bridge });
    } catch (error) {
      const code = error instanceof Error ? error.message : "unknown";
      console.error("[Billing] Payment submission failed", code);
      const known = ["invalid_screenshot", "screenshot_too_large", "proof_upload_failed", "payment_insert_failed", "supabase_server_not_configured"];
      return res.status(code === "invalid_screenshot" || code === "screenshot_too_large" ? 400 : 503).json({ error: known.includes(code) ? code : "payment_submission_failed" });
    }
  }
  if (action === "payment-notify") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    const requestId = String((req.body ?? {}).requestId || "");
    const notify = (req.body ?? {}).notify;
    if (!/^[0-9a-f-]{36}$/i.test(requestId) || typeof notify !== "boolean") return res.status(400).json({ error: "invalid_notify_request" });
    try {
      const updated = await db.setNotifyOnApproval(user.id, requestId, notify);
      if (!updated) return res.status(409).json({ error: "request_not_pending_or_not_owned" });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[Billing] Notify preference failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "notify_unavailable" });
    }
  }
  if (action === "notice-seen") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    const requestId = String((req.body ?? {}).requestId || "");
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) return res.status(400).json({ error: "invalid_request_id" });
    try {
      await db.markApprovalNoticeSeen(user.id, requestId);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[Billing] Notice-seen failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: "notice_unavailable" });
    }
  }
  if (action === "paypal-create") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    try {
      const tokens = Number(req.body?.packageTokens);
      const priceEgp = PACKAGES[tokens];
      if (!priceEgp) return res.status(400).json({ error: "invalid_package" });
      const { usd } = await usdForEgp(priceEgp);
      const value = usd.toFixed(2);
      const token = await paypalAccessToken();
      const { ok, payload } = await paypalApi(token, "/v2/checkout/orders", {
        method: "POST",
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            amount: { currency_code: "USD", value },
            custom_id: `${user.id}|${tokens}`,
            description: `HotGPT token pack — ${tokens} tokens`,
          }],
          application_context: { brand_name: "HotGPT", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
        }),
      });
      if (!ok || !payload.id) {
        console.error("[PayPal] Order create failed", payload?.name || payload?.message || "unknown");
        return res.status(502).json({ error: "paypal_create_failed" });
      }
      return res.status(201).json({ orderId: String(payload.id) });
    } catch (error) { return paypalError(res, error); }
  }
  if (action === "paypal-capture") {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method_not_allowed" }); }
    const user = await requireMember(req, res);
    if (!user) return;
    try {
      const orderId = String(req.body?.orderId || "");
      if (!/^[A-Z0-9]{10,32}$/i.test(orderId)) return res.status(400).json({ error: "invalid_order" });
      const token = await paypalAccessToken();
      const { ok, status, payload } = await paypalApi(token, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", body: "{}" });
      if (!ok) {
        // A repeat capture lands here (PayPal: ORDER_ALREADY_CAPTURED).
        // Never credit twice — the first capture already fulfilled.
        console.error("[PayPal] Capture rejected", status, payload?.name || "unknown");
        return res.status(409).json({ error: "capture_rejected" });
      }
      const unit = payload?.purchase_units?.[0];
      const capture = unit?.payments?.captures?.[0];
      const customId = String(unit?.custom_id || "");
      const [buyerId, tokensText] = customId.split("|");
      const tokens = Number(tokensText);
      const priceEgp = PACKAGES[tokens];
      const expectedNow = priceEgp ? (await usdForEgp(priceEgp)).usd : NaN;
      const paid = Number(capture?.amount?.value);
      const orderAmount = String(unit?.amount?.value ?? "");
      // The buyer can never change the order amount (PayPal enforces it);
      // we still require the capture to equal our order amount exactly and
      // to sit within $1 of today's computed equivalent (rate tick safety).
      const verified = payload?.status === "COMPLETED"
        && capture?.status === "COMPLETED"
        && buyerId === user.id
        && priceEgp !== undefined
        && capture?.amount?.currency_code === "USD"
        && capture?.amount?.value === orderAmount
        && Number.isFinite(paid)
        && Math.abs(paid - expectedNow) <= 1;
      if (!verified) {
        console.error("[PayPal] Capture verification failed for order", orderId);
        return res.status(422).json({ error: "verification_failed" });
      }
      const tokenBalance = await db.creditPurchasedTokens(user.id, tokens, {
        email: user.email!,
        captureId: String(capture.id),
        amountUsd: orderAmount,
      });
      return res.status(200).json({ success: true, tokensAdded: tokens, tokenBalance });
    } catch (error) { return paypalError(res, error); }
  }
  return res.status(404).json({ error: "unknown_billing_action" });
}
