import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth";
import { trackFunnelEvent } from "@/lib/analytics";
import { LanguageFlag, LanguageToggle, LocalizedText, useAppLanguage, useAudience } from "@/contexts/LanguageContext";
import FbFollow, { BlogFollow, SmolBadge } from "@/components/FbFollow";

type PackageOption = { tokens: number; priceEgp: number };
type PaymentRequest = { id: string; paymentMethod: "vodafone_cash" | "instapay" | "paypal" | "binance_pay" | "bybit_pay"; packageTokens: number; amountEgp: number; status: string; createdAt: string; reviewedAt?: string | null; notifyOnApproval?: boolean; approvalNoticeSeenAt?: string | null; memberNoticeText?: string | null; test?: boolean };
type BillingConfig = {
  vodafoneCashNumber: string;
  vodafoneCashUrl?: string;
  instapayAddress?: string;
  instapayUrl?: string;
  binancePayId?: string;
  binanceUsdtAddress?: string;
  bybitUid?: string;
  bybitUsdtAddress?: string;
  paypalClientId?: string;
  packagesUsd?: { tokens: number; priceUsd: number }[];
  paypalPaymentUrl: string;
  packages: PackageOption[];
  freeAnswers: number;
  welcomeGiftTokens?: number;
  creditsPerAnswer: number;
};

// Load the PayPal SDK exactly once per client id and hand every caller the
// same promise. The previous version checked only whether the <script> tag
// existed: if it existed but was still downloading, rendering was attempted
// immediately, window.paypal was still undefined, and nothing ever retried —
// the buttons silently appeared late or not at all.
let paypalSdkPromise: Promise<any> | null = null;
let paypalSdkForClientId = "";
function loadPaypalSdk(clientId: string): Promise<any> {
  const w = window as any;
  if (w.paypal?.Buttons) return Promise.resolve(w.paypal);
  if (paypalSdkPromise && paypalSdkForClientId === clientId) return paypalSdkPromise;
  paypalSdkForClientId = clientId;
  paypalSdkPromise = new Promise((resolve) => {
    const finish = () => resolve((window as any).paypal ?? null);
    const existing = document.querySelector('script[data-paypal-sdk="1"]') as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).paypal?.Buttons) finish();
      else { existing.addEventListener("load", finish); existing.addEventListener("error", () => resolve(null)); }
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    script.dataset.paypalSdk = "1";
    script.async = true;
    script.onload = finish;
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
  return paypalSdkPromise;
}

const PACK_CAPACITY_AR: Record<number, string> = {
  100: "100 محادثة - 20 صورة - 10 صور CGI - 5 مواقع - 5 استخراج عملاء - 10 أبحاث موجّهة",
  500: "500 محادثة - 100 صورة - 50 صورة CGI - 25 موقع - 25 استخراج عملاء - 50 بحث موجّه",
  800: "800 محادثة - 160 صورة - 80 صورة CGI - 40 موقع - 40 استخراج عملاء - 80 بحث موجّه",
  1000: "1000 محادثة - 200 صورة - 100 صورة CGI - 50 موقع - 50 استخراج عملاء - 100 بحث موجّه",
};
const PACK_CAPACITY_EN: Record<number, string> = {
  100: "100 chats - 20 images - 10 CGI images - 5 websites - 5 lead extractions - 10 guided searches",
  500: "500 chats - 100 images - 50 CGI images - 25 websites - 25 lead extractions - 50 guided searches",
  800: "800 chats - 160 images - 80 CGI images - 40 websites - 40 lead extractions - 80 guided searches",
  1000: "1000 chats - 200 images - 100 CGI images - 50 websites - 50 lead extractions - 100 guided searches",
};

export default function BillingPage() {
  const { language } = useAppLanguage();
  const { egEgp } = useAudience();
  const t = (ar: string, en: string) => (language === "ar" ? ar : en);
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [account, setAccount] = useState<{ email: string; tokenBalance: number; welcomeGiftGranted?: boolean } | null>(null);
  const [packageTokens, setPackageTokens] = useState(500);
  const [paymentMethod, setPaymentMethod] = useState<"vodafone_cash" | "instapay" | "paypal" | "binance_pay" | "bybit_pay">("vodafone_cash");
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [publicRequests, setPublicRequests] = useState<PaymentRequest[]>([]);
  const [screenshotData, setScreenshotData] = useState("");
  const [message, setMessage] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<{ requestId: string; bridge: string } | null>(null);
  const [notifyChoice, setNotifyChoice] = useState(false);
  // Deep link from the low-balance offer: /billing?pack=100 preselects that pack.
  useEffect(() => {
    try {
      const pack = Number(new URLSearchParams(window.location.search).get("pack"));
      if ([100, 500, 800, 1000].includes(pack)) setPackageTokens(pack);
    } catch {}
  }, []);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [configResponse, accountResponse] = await Promise.all([
      fetch("/api/billing?action=config", { cache: "no-store" }),
      authFetch("/api/billing?action=me", { cache: "no-store" }),
    ]);
    if (configResponse.ok) setConfig(await configResponse.json());
    if (accountResponse.ok) {
      setAccount(await accountResponse.json());
      const requestResponse = await authFetch("/api/billing?action=requests", { cache: "no-store" });
      if (requestResponse.ok) {
        const payload = await requestResponse.json().catch(() => ({}));
        setRequests(Array.isArray(payload.requests) ? payload.requests : []);
      }
    } else setAccount(null);
  }
  useEffect(() => { trackFunnelEvent({ name: "billing_view" }); void load().catch(() => setMessage(t("تعذر تحميل بيانات الاشتراك. أعد المحاولة.", "Could not load the subscription data. Please try again."))); }, []);
  useEffect(() => { fetch("/api/billing?action=public-requests").then(r => (r.ok ? r.json() : null)).then(d => { if (Array.isArray(d?.requests)) setPublicRequests(d.requests); }).catch(() => {}); }, []);

  const packages = config?.packages ?? [{ tokens: 100, priceEgp: 100 }, { tokens: 500, priceEgp: 300 }, { tokens: 800, priceEgp: 440 }, { tokens: 1000, priceEgp: 500 }];
  const selected = packages.find(item => item.tokens === packageTokens);
  async function handleScreenshot(file?: File) {
    setMessage("");
    if (!file) { setScreenshotData(""); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage(t("ارفع صورة PNG أو JPG أو WebP فقط.", "Upload a PNG, JPG or WebP image only.")); return;
    }
    if (file.size > 15_000_000) {
      setMessage(t("حجم الصورة أكبر من اللازم (الحد 15 ميجابايت).", "The image is too large (15 MB max).")); return;
    }
    // Capacity guardrail (2026-10-27): proof screenshots are downscaled
    // in the browser to ~200 KB before upload, so free-tier storage is
    // not eaten by multi-MB phone screenshots. The server's 700 KB cap
    // stays as the outer guard; the canvas output always fits it.
    try {
      const bitmap = await createImageBitmap(file);
      const render = (maxDim: number, quality: number): string => {
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no-2d-context");
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", quality);
      };
      let dataUrl = render(1280, 0.82);
      if (dataUrl.length > 280_000) dataUrl = render(1024, 0.68);
      if (dataUrl.length > 900_000) throw new Error("still-too-large");
      setScreenshotData(dataUrl);
    } catch {
      // Fallback: the original raw path with the 700 KB rule.
      if (file.size > 700_000) {
        setMessage(t("حجم الصورة يجب ألا يتجاوز 700 كيلوبايت. قلّل حجم الصورة ثم أعد المحاولة.", "The image must not exceed 700 KB. Reduce its size and try again.")); return;
      }
      const reader = new FileReader();
      reader.onload = () => setScreenshotData(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => setMessage(t("تعذر قراءة الصورة. حاول بصورة أخرى.", "Could not read the image. Try another one."));
      reader.readAsDataURL(file);
    }
  }

  async function submitPayment() {
    if (paymentMethod === "paypal") { setMessage(t("الدفع بـ PayPal يتم من زرار PayPal مباشرة — ويُضاف رصيد اشتراكك تلقائيًا وفورًا فور تأكيد الدفع.", "PayPal payment happens through the PayPal button itself — your subscription balance is added automatically and instantly once the payment is confirmed.")); return; }
    if (!selected || !screenshotData) { setMessage(t("اختر اشتراكك وارفع صورة إثبات الدفع أولًا.", "Choose your subscription and upload your payment proof first.")); return; }
    setBusy(true); setMessage(""); setPaymentSuccess(false);
    trackFunnelEvent({ name: "manual_payment_submit_started", metadata: { packageTokens, paymentMethod } });
    try {
      const response = await authFetch("/api/billing?action=payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageTokens, paymentMethod, screenshotData }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.error === "login_required") { setMessage(t("يجب تسجيل الدخول قبل إرسال إثبات الدفع. سجّل الدخول ثم حاول مجددًا.", "You must log in before sending payment proof. Log in and try again.")); return; }
        if (payload.error === "auth_unavailable" || payload.error === "billing_unavailable") { throw new Error(t("تعذر التحقق من الحساب حاليًا. أعد المحاولة بعد قليل.", "We could not verify your account right now. Try again shortly.")); }
        if (payload.error === "invalid_screenshot") throw new Error(t("الصورة دي مش مناسبة — جرّب صورة أوضح (PNG أو JPG وحجمها أقل من 700 كيلوبايت)، والدعم الفني معاك ٢٤ ساعة لو احتجت مساعدة.", "This image is not suitable — try a clearer one (PNG or JPG, under 700 KB), and support is with you 24/7 if you need help."));
        if (payload.error === "screenshot_too_large") throw new Error(t("حجم صورة الإثبات كبير. اختر الصورة مرة أخرى ليتم تصغيرها تلقائيًا.", "The proof image is too large. Choose it again so it can be resized automatically."));
        if (payload.error === "proof_upload_failed") throw new Error(t("تعذر حفظ صورة الإثبات في التخزين. أعد المحاولة، وإذا تكرر الخطأ تواصل مع الإدارة.", "Could not save the proof image. Try again, and if it repeats, contact support."));
        if (payload.error === "payment_insert_failed") throw new Error(t("صورتك وصلتنا وطلبك متسجل عندنا — حصل بس تأخير لحظي في إتمامه. ارفع الصورة مرة كمان من غير ما تحوّل تاني وهيتم التفعيل خلال دقائق، والدعم الفني معاك ٢٤ ساعة لأي مشكلة.", "Your image reached us and your request is recorded — there was just a momentary delay completing it. Upload the image once more without paying again and activation will happen within minutes; support is with you 24/7 for any problem."));
        if (payload.error === "supabase_server_not_configured" || payload.error === "payment_submission_failed") throw new Error(t("حصل تأخير لحظي في التسجيل. جرّب الإرسال مرة كمان بعد ثواني وهيتم التفعيل خلال دقائق، والدعم الفني معاك ٢٤ ساعة لأي مشكلة.", "There was a momentary recording delay. Try sending once more in a few seconds and activation will happen within minutes; support is with you 24/7 for any problem."));
        if (payload.error === "invalid_package_or_method") throw new Error(t("اختر اشتراكًا وطريقة دفع صحيحة.", "Choose a valid subscription and payment method."));
        throw new Error(t("تعذر إرسال طلب الدفع. تحقق من اتصالك وحاول مرة أخرى.", "Could not send the payment request. Check your connection and try again."));
      }
      setLastSubmission({ requestId: String(payload.requestId || ""), bridge: String(payload.bridge || "none") });
      setNotifyChoice(false);
      setMessage(""); setPaymentSuccess(true);
      trackFunnelEvent({ name: "manual_payment_proof_submitted", metadata: { packageTokens, paymentMethod } });
      setScreenshotData("");
      void load().catch(() => {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("حدث خطأ غير متوقع.", "An unexpected error occurred."));
    } finally { setBusy(false); }
  }


  const selectedUsd = (config?.packagesUsd ?? []).find(item => item.tokens === packageTokens);
  const [copiedKey, setCopiedKey] = useState("");
  const usdFor = (tokens: number) => (config?.packagesUsd ?? []).find(p => p.tokens === tokens)?.priceUsd;
  const priceLabel = (tokens: number, priceEgp: number) => (language === "en" && usdFor(tokens) != null ? `$${usdFor(tokens)}` : `${priceEgp} ${t("جنيه", "EGP")}`);
  const statusLabel = (status: string) => ({ pending: t("قيد المراجعة", "Under review"), approved: t("تم الاعتماد", "Approved"), rejected: t("مرفوض", "Rejected") }[status] ?? t("غير معروف", "Unknown"));
  const methodLabel = (method: PaymentRequest["paymentMethod"]) => method === "vodafone_cash" ? t("فودافون كاش", "Vodafone Cash") : method === "instapay" ? t("إنستا باي", "InstaPay") : method === "binance_pay" ? "Binance Pay" : method === "bybit_pay" ? "Bybit Pay" : "PayPal";
  const payCategory = paymentMethod === "paypal" ? "usd" : paymentMethod === "binance_pay" || paymentMethod === "bybit_pay" ? "crypto" : "egp";
  const selectCategory = (cat: "usd" | "egp" | "crypto") => { if (cat === "usd") setPaymentMethod("paypal"); else if (cat === "egp") { if (paymentMethod !== "vodafone_cash" && paymentMethod !== "instapay") setPaymentMethod("vodafone_cash"); } else if (paymentMethod !== "binance_pay" && paymentMethod !== "bybit_pay") setPaymentMethod("binance_pay"); };
  const formatRequestDate = (value: string) => { try { return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; } };
  async function copyValue(key: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopiedKey(key); setTimeout(() => setCopiedKey(""), 2000); } catch {}
  }

  async function toggleNotify() {
    if (!lastSubmission?.requestId) return;
    const next = !notifyChoice;
    setNotifyChoice(next);
    try {
      const response = await authFetch("/api/billing?action=payment-notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: lastSubmission.requestId, notify: next }),
      });
      if (!response.ok) throw new Error("notify_failed");
    } catch {
      setNotifyChoice(!next);
      setMessage(t("تعذر حفظ اختيار التنبيه. حاول مرة أخرى.", "Could not save your notification choice. Try again."));
    }
  }

  async function dismissApprovalNotice(requestId: string) {
    try {
      await authFetch("/api/billing?action=notice-seen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
    } catch {}
    void load().catch(() => {});
  }

  // PayPal Buttons: the browser only starts and approves the order; our
  // server creates it, captures it, verifies it and credits the tokens.
  // The SDK promise is shared, so switching packs or language re-renders
  // instantly once the SDK has loaded a single time.
  useEffect(() => {
    if (paymentMethod !== "paypal" || !config?.paypalClientId) return;
    let alive = true;
    void loadPaypalSdk(config.paypalClientId).then((paypal) => {
      if (!alive || !paypal?.Buttons) return;
      const container = document.getElementById("paypal-buttons-container");
      if (!container) return;
      container.innerHTML = "";
      paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "pill", label: "pay" },
        createOrder: async () => {
          const response = await authFetch("/api/billing?action=paypal-create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageTokens }) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.orderId) throw new Error("create_failed");
          return payload.orderId;
        },
        onApprove: async (data: any) => {
          setBusy(true); setMessage("");
          try {
            const response = await authFetch("/api/billing?action=paypal-capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: data.orderID }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) throw new Error("capture_failed");
            setMessage(language === "ar" ? `تم الدفع بنجاح واتفعّل اشتراكك — أُضيف الرصيد لحسابك، ورصيد اشتراكك الآن ${payload.tokenBalance}.` : `Payment successful — your subscription is active and the balance was added to your account. Your subscription balance is now ${payload.tokenBalance}.`);
            void load().catch(() => {});
          } catch {
            setMessage(language === "ar" ? "دفعك وصلنا — رصيدك هيتضاف لحسابك خلال دقائق. ولأي مشكلة، الدعم الفني معاك ٢٤ ساعة." : "Your payment reached us — your balance will be added to your account within minutes. And for any problem, support is with you 24/7.");
          } finally { setBusy(false); }
        },
        onError: () => setMessage(language === "ar" ? "حدث خطأ في PayPal. حاول مرة أخرى أو اختر وسيلة دفع أخرى." : "Something went wrong with PayPal. Try again or choose another payment method."),
      }).render("#paypal-buttons-container");
    });
    return () => { alive = false; };
  }, [paymentMethod, config?.paypalClientId, packageTokens, language]);

  return <LocalizedText><main dir={language === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#080b10] px-4 py-8 text-white sm:px-8">
    <LanguageToggle />
    <a href="/" aria-label={language === "ar" ? "العودة إلى الرئيسية" : "Back to home"} className="fixed left-4 top-4 z-30 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#11151b]/95 px-4 py-2 text-sm text-amber-300 shadow-lg backdrop-blur hover:bg-white/10"><span aria-hidden="true">⌂</span><span>{language === "ar" ? "الرئيسية" : "Home"}</span></a>
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 text-center">
        <img src="/brand/logo.png" alt="HotGPT" className="mx-auto h-24 w-24 object-contain" />
        <p className="mt-3 text-5xl font-black tracking-wide text-amber-400">HotGPT</p>
        <p className="mt-2 text-sm font-bold text-amber-200">{t("منصة عربية بدون قيود على البحث والبرمجة", "No limits on research & programming")}</p>
      </div>
      <div className="mb-6 flex justify-end gap-2"><FbFollow /><BlogFollow /><SmolBadge /></div>
      <div className="mt-2 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-center text-base font-bold leading-7 text-amber-200">
        {t("لأي مشكلة أو صعوبة في الدفع: الدعم الفني معاك ٢٤ ساعة — تواصل معاه ", "For any problem or difficulty while paying: technical support is with you 24/7 — contact it ")}<a href="https://t.me/HOTGPTPro" target="_blank" rel="noreferrer" className="text-amber-300 underline decoration-2 underline-offset-4 hover:text-amber-200">{t("من هنا", "here")}</a>{t(" وسيتم حلها فورًا.", " and it will be resolved immediately.")}
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold tracking-[.25em] text-amber-400">HOTGPT SUBSCRIPTION</p><h1 className="mt-2 text-3xl font-bold">{t("اشتراكك الشهري", "Your monthly subscription")}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{t("اشتراك شهري واحد يفتح لك كل الأدوات: سعر كل خدمة ثابت ومعروف قبل ما تبدأ — مفيش فواتير مفاجئة. واشتراكك بدأ بهدية ترحيب وصلت رصيدك تلقائيًا عند أول دخول.", "One monthly subscription unlocks every tool: each service has one flat price you know before you start — no surprise bills. And your subscription began with a welcome gift that landed in your balance automatically on your first visit.")}</p></div>
        {account && <div className="rounded-2xl border border-[#C9A227]/50 bg-black/30 p-4 text-sm"><div className="text-slate-400">{account.email}</div><div className="mt-1 text-lg font-bold text-amber-400">{t("رصيد اشتراكك", "Subscription balance")}: {account.tokenBalance}</div>{account.welcomeGiftGranted && <div className="mt-1 text-xs font-bold text-amber-300">{language === "en" ? "🎁 The welcome gift was added to your subscription balance" : egEgp ? "🎁 أُضيفت هدية الترحيب إلى رصيد اشتراكك" : "🎁 أُضيفت هدية الترحيب إلى رصيد اشتراكك"}</div>}</div>}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href="/models" className="inline-block rounded-lg border border-amber-400/50 px-4 py-2 text-sm font-bold text-amber-300 transition hover:bg-amber-400/10">{t("اعرف نماذجنا", "Meet our models")}</a>
        <a href="/payment-guide" className="inline-block rounded-lg border border-amber-400/50 px-4 py-2 text-sm font-bold text-amber-300 transition hover:bg-amber-400/10">{t("وسائل الدفع وطريقة الاشتراك", "Payment methods & how to subscribe")}</a>
      </div>
      <section className="mt-4 rounded-2xl border border-[#C9A227]/50 bg-[#1A0505] p-5 md:p-7">
        <h2 className="text-xl font-bold">{t("مقارنة سريعة — أي اشتراك شهري يناسبك؟", "Quick comparison — which monthly plan fits you?")}</h2>
        <div className="mt-4 divide-y divide-white/5">
          <div className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="font-bold">{t("اشتراك البداية", "Starter plan")} — {priceLabel(100, 100)} {t("شهريًا", "per month")}</span><span className="text-sm text-slate-400">{t("الأرخص", "The cheapest")}</span></div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="font-bold">{t("الاشتراك الأساسي", "Basic plan")} — {priceLabel(500, 300)} {t("شهريًا", "per month")}</span><span className="text-sm font-bold text-amber-300">{t("الأكثر توفيرًا", "Best value")}</span></div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="font-bold">{t("الاشتراك الأكبر", "Larger plan")} — {priceLabel(800, 440)} {t("شهريًا", "per month")}</span><span className="text-sm text-slate-400">{t("للمستخدم النشط", "For the active user")}</span></div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="font-bold">{t("الاشتراك الشامل", "Full plan")} — {priceLabel(1000, 500)} {t("شهريًا", "per month")}</span><span className="text-sm text-slate-400">{t("للاستخدام المستمر", "For continuous use")}</span></div>
        </div>
      </section>
      <p className="mt-10 text-sm font-bold text-amber-300">{t("اضغط على كارت الاشتراك المناسب لك", "Tap the subscription card that suits you")}</p>
      <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-center text-base font-bold leading-7 text-amber-200">{t("اشتراك شهري بسيط: يمكنك إعادة الشحن والتجديد في أي وقت — كل شحنة جديدة تبدأ شهرك الجديد من يوم الشحن، والرصيد الجديد يُضاف على رصيدك الحالي. اشتراك يبدأ من 100 جنيه في الشهر.", "A simple monthly subscription: top up and renew at any time — every new recharge starts your new month from the recharge day, and the new balance is added on top of your current balance. Plans start at the 100 EGP monthly plan.")}</div>
      <a href="/hotlucky" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/60 bg-amber-400/[.07] p-5 transition hover:border-amber-300">
        <span><strong className="block text-lg">{t("باقة HotLucky", "HotLucky pack")}</strong><span className="mt-1 block text-sm text-slate-300">{t("بـ 50 جنيه خد من 25 لـ 100 رسالة", "For $1, get 25 to 100 messages")}</span></span>
        <span className="rounded-lg bg-[#FBBF24] px-4 py-2 text-sm font-black text-[#1A0505]">{t("ادخل لصفحة الجوائز", "Go to the prizes page")}</span>
      </a>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {packages.map(item => {
          const saving = Math.max(0, Math.round((1 - item.priceEgp / item.tokens) * 100));
          const usd = (config?.packagesUsd ?? []).find(p => p.tokens === item.tokens);
          const label = item.tokens === 100 ? t("اشتراك البداية", "Starter plan") : item.tokens === 500 ? t("الاشتراك الأساسي", "Basic plan") : item.tokens === 800 ? t("الأكثر طلبًا", "Most popular") : t("الاشتراك الأكبر", "Largest plan");
          const isPopular = item.tokens === 800;
          return (
          <button key={item.tokens} onClick={() => { setPackageTokens(item.tokens); trackFunnelEvent({ name: "package_selected", metadata: { packageTokens: item.tokens, priceEgp: item.priceEgp } }); document.getElementById("payment-methods")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={`relative rounded-2xl border p-6 text-start transition ${packageTokens === item.tokens ? "border-amber-400 bg-amber-400/10" : isPopular ? "border-amber-300/60 bg-amber-300/[.06] hover:border-amber-300" : "border-white/10 bg-white/[.03] hover:border-amber-400/50"}`}>
            {isPopular && <span className="absolute -top-3 start-4 rounded-full bg-amber-400 px-3 py-0.5 text-[11px] font-black text-black shadow">{t("الأكثر طلبًا ⭐", "Most popular ⭐")}</span>}
            <div className="text-sm text-slate-400">{label}</div>
            <div className="mt-3 text-3xl font-bold">{priceLabel(item.tokens, item.priceEgp)} <span className="text-base font-normal text-amber-400">{t("شهريًا", "per month")}</span></div>
            <div className="mt-2 text-sm font-normal text-slate-400">{usd ? <span>{language === "en" ? t(`أو ${item.priceEgp} جنيه بفودافون كاش أو انستا باي`, `or ${item.priceEgp} EGP via Vodafone Cash or InstaPay`) : t(`أو ما يعادل $${usd.priceUsd} بـ PayPal`, `or the equivalent of $${usd.priceUsd} via PayPal`)}</span> : <span>{t("اشتراك شهري — جدد واشحن في أي وقت", "Monthly plan — renew and top up anytime")}</span>}</div>
            <div className="mt-2 text-xs text-slate-400">{saving > 0 ? t(`قيمة أكبر: أوفر ${saving}% مقارنة باشتراك البداية`, `Better value: save ${saving}% vs the starter plan`) : t("اشتراك البداية — نقطة انطلاقك", "The starter plan — your starting point")}</div>
            {(PACK_CAPACITY_AR[item.tokens] || PACK_CAPACITY_EN[item.tokens]) && <div className="mt-3 text-xs leading-5 text-slate-400">{t(`تكفي: ${PACK_CAPACITY_AR[item.tokens] ?? ""}`, `Covers: ${PACK_CAPACITY_EN[item.tokens] ?? ""}`)}</div>}
            {item.tokens === 500 && <div className="mt-3 rounded-lg bg-amber-400/15 px-3 py-2 text-xs font-bold text-amber-300">{t("الأفضل للمطورين الذين يستخدمون الموقع أسبوعيًا", "Best for developers who use the site weekly")}</div>}
          </button>
          );
        })}
      </div>
      <section id="payment-methods" className="mt-8 scroll-mt-6 rounded-2xl border border-[#C9A227]/50 bg-[#1A0505] p-5 md:p-7">
        <h2 className="text-xl font-bold">{t("طريقة الدفع", "Payment method")}</h2>
        <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/5 p-3 text-sm leading-6 text-amber-200">{t("ملحوظة مهمة: سواء دفعت بفودافون كاش أو إنستا باي أو Binance أو Bybit، التفعيل بيتم بعد ما تبعت اسكرين شوت للتحويل يظهر فيها الرقم اللي حوّلت عليه والمبلغ ووقت التحويل — ابعت الإثبات بعد التحويل على طول واشتراكك هيتفعّل خلال دقائق.", "Important: whether you pay by Vodafone Cash, InstaPay, Binance or Bybit, activation happens after you send a transfer screenshot clearly showing the number, ID or address you paid to, the amount and the transfer time — send the proof right after paying and your subscription will be activated within minutes.")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => selectCategory("usd")} className={`rounded-xl border p-4 text-start transition ${payCategory === "usd" ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <strong className="block">{t("الدفع بالدولار", "Pay in USD")}</strong><span className="mt-1 block text-xs text-slate-400">Visa · Mastercard · PayPal</span>
          </button>
          <button type="button" onClick={() => selectCategory("egp")} className={`rounded-xl border p-4 text-start transition ${payCategory === "egp" ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <strong className="block">{t("الدفع بالجنيه المصري", "Pay in EGP")}</strong><span className="mt-1 block text-xs text-slate-400">{t("فودافون كاش · انستا باي", "Vodafone Cash · InstaPay")}</span>
          </button>
          <button type="button" onClick={() => selectCategory("crypto")} className={`rounded-xl border p-4 text-start transition ${payCategory === "crypto" ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <strong className="block">{t("الدفع بالعملات المشفرة", "Pay with crypto")}</strong><span className="mt-1 block text-xs text-slate-400">Binance · Bybit (USDT)</span>
          </button>
        </div>
        {payCategory === "usd" && <div className="mt-3 grid gap-3">
          <button onClick={() => setPaymentMethod("paypal")} className={`rounded-xl border p-4 text-start transition ${paymentMethod === "paypal" ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#012169] text-sm font-black italic text-white">P</span><span><strong className="block">PayPal</strong><span className="text-xs text-slate-400">{t("دولار أمريكي · إضافة فورية تلقائية", "USD · instant automatic credit")}</span></span><span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-300"><span aria-hidden="true">🌐</span><span className="rounded bg-white px-1.5 py-px text-[9px] font-black italic tracking-wide text-[#1a1f71]">VISA</span><span className="flex items-center" aria-hidden="true"><span className="h-3.5 w-3.5 rounded-full bg-[#eb001b]/90"></span><span className="-ms-1.5 h-3.5 w-3.5 rounded-full bg-[#f79e1b]/90"></span></span>Mastercard</span></span>
          </button>
        </div>}
        {payCategory === "egp" && <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button onClick={() => setPaymentMethod("vodafone_cash")} className={`rounded-xl border p-4 text-start transition ${paymentMethod === "vodafone_cash" ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e60000] text-sm font-black text-white">VF</span><span><strong className="block">{t("فودافون كاش", "Vodafone Cash")}</strong><span className="text-xs text-slate-400">{t("جنيه مصري · تحويل من محفظتك", "EGP · transfer from your wallet")}</span></span><span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-300/90"><LanguageFlag lang="ar" />{t("خاص بالمصريين فقط", "Egyptians only")}</span></span>
          </button>
          <button onClick={() => setPaymentMethod("instapay")} className={`rounded-xl border p-4 text-start transition ${paymentMethod === "instapay" ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1d4ed8] text-sm font-black text-white">IP</span><span><strong className="block">{t("انستا باي", "InstaPay")}</strong><span className="text-xs text-slate-400">{t("جنيه مصري · تحويل بنكي لحظي", "EGP · instant bank transfer")}</span></span><span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-300/90"><LanguageFlag lang="ar" />{t("خاص بالمصريين فقط", "Egyptians only")}</span></span>
          </button>
        </div>}
        {payCategory === "crypto" && <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button onClick={() => setPaymentMethod("binance_pay")} className={`rounded-xl border p-4 text-start transition ${paymentMethod === "binance_pay" ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0B90B] text-sm font-black text-black">₮</span><span><strong className="block">Binance Pay</strong><span className="text-xs text-slate-400">{t("USDT · تحويل فوري داخل التطبيق", "USDT · instant in-app transfer")}</span></span><span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-300/90"><span aria-hidden="true">🌍</span>{t("لمستخدمي Binance", "For Binance users")}</span></span>
          </button>
          <button onClick={() => setPaymentMethod("bybit_pay")} className={`rounded-xl border p-4 text-start transition ${paymentMethod === "bybit_pay" ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#17181E] text-sm font-black text-[#F7A600]">B</span><span><strong className="block">Bybit Pay</strong><span className="text-xs text-slate-400">{t("USDT · تحويل فوري داخل التطبيق", "USDT · instant in-app transfer")}</span></span><span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-300/90"><span aria-hidden="true">🌍</span>{t("لمستخدمي Bybit", "For Bybit users")}</span></span>
          </button>
        </div>}
        {paymentMethod === "vodafone_cash" && <div className="mt-5">
          <a href={config?.vodafoneCashUrl ?? "https://vf.eg/vfcash?id=mt&qrId=G0gO2O"} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#e60000] px-5 py-3.5 text-center font-black text-white transition hover:brightness-110">{t("ادفع الآن — يفتح تطبيق فودافون كاش ↗", "Pay now — opens the Vodafone Cash app ↗")}</a>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">{t("أو اطلب كود التحويل الجاهز من موبايلك:", "Or dial the ready transfer code from your phone:")}</span><strong dir="ltr" className="text-base tracking-wide">*9*7*•••••••••••*{selected?.priceEgp ?? "—"}#</strong><button type="button" onClick={() => void copyValue("ussd", `*9*7*${config?.vodafoneCashNumber ?? "01063537686"}*${selected?.priceEgp ?? ""}#`)} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "ussd" ? t("تم النسخ ✓", "Copied ✓") : t("نسخ الكود", "Copy code")}</button></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">{t(`حوّل قيمة اشتراكك المختار بالظبط (${selected?.priceEgp ?? "—"} جنيه) ثم ارفع صورة الإثبات بالأسفل — والتفعيل بيتم خلال دقائق من وصول الإثبات.`, `Transfer the exact price of your selected subscription (${selected?.priceEgp ?? "—"} EGP), then upload the proof image below — activation happens within minutes of your proof arriving.`)}</p>
        </div>}
        {paymentMethod === "instapay" && <div className="mt-5">
          <a href={config?.instapayUrl ?? "https://ipn.eg/S/wahedelfar/instapay/4LnUCo"} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#1d4ed8] px-5 py-3.5 text-center font-black text-white transition hover:brightness-110">{t("ادفع الآن — يفتح تطبيق انستا باي ↗", "Pay now — opens the InstaPay app ↗")}</a>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">{t("أو حوّل يدويًا إلى العنوان:", "Or transfer manually to:")}</span><strong dir="ltr" className="text-base tracking-wide">{config?.instapayAddress ?? "wahedelfar@instapay"}</strong><button type="button" onClick={() => void copyValue("ip", config?.instapayAddress ?? "wahedelfar@instapay")} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "ip" ? t("تم النسخ ✓", "Copied ✓") : t("نسخ العنوان", "Copy address")}</button></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">{t(`حوّل قيمة اشتراكك المختار بالظبط (${selected?.priceEgp ?? "—"} جنيه) ثم ارفع صورة الإثبات بالأسفل — والتفعيل بيتم خلال دقائق من وصول الإثبات.`, `Transfer the exact price of your selected subscription (${selected?.priceEgp ?? "—"} EGP), then upload the proof image below — activation happens within minutes of your proof arriving.`)}</p>
        </div>}
        {paymentMethod === "binance_pay" && <div className="mt-5">
          <div className="block rounded-xl bg-[#F0B90B] px-5 py-3.5 text-center font-black text-black">{t(`ادفع ${selectedUsd?.priceUsd ?? "—"} USDT على شبكة TRON (TRC20)`, `Pay ${selectedUsd?.priceUsd ?? "—"} USDT on the TRON (TRC20) network`)}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">{t("إلى عنوان الإيداع — من أي منصة أو محفظة عملات:", "To this deposit address — from any exchange or crypto wallet:")}</span><strong dir="ltr" className="break-all text-base tracking-wide">{config?.binanceUsdtAddress ?? "TY4Lq6zYv3xCuyUp2q9M6A2rX6woXHfnZR"}</strong><button type="button" onClick={() => void copyValue("binance-trc20", config?.binanceUsdtAddress ?? "TY4Lq6zYv3xCuyUp2q9M6A2rX6woXHfnZR")} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "binance-trc20" ? t("تم النسخ ✓", "Copied ✓") : t("نسخ العنوان", "Copy address")}</button></div>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">{t("أو من داخل تطبيق Binance مباشرة بالـ Pay ID — فوري وبدون رسوم:", "Or directly inside the Binance app via Pay ID — instant and fee-free:")}</span><strong dir="ltr" className="text-base tracking-wide">{config?.binancePayId ?? "1024827539"}</strong><button type="button" onClick={() => void copyValue("binance", config?.binancePayId ?? "1024827539")} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "binance" ? t("تم النسخ ✓", "Copied ✓") : t("نسخ الـ ID", "Copy ID")}</button></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">{t(`حوّل قيمة اشتراكك المختار بالظبط (${selectedUsd?.priceUsd ?? "—"} USDT) ثم ارفع صورة الإثبات بالأسفل — والتفعيل بيتم خلال دقائق من وصول الإثبات.`, `Send the exact price of your selected subscription (${selectedUsd?.priceUsd ?? "—"} USDT), then upload the proof image below — activation happens within minutes of your proof arriving.`)}</p>
        </div>}
        {paymentMethod === "bybit_pay" && <div className="mt-5">
          <div className="block rounded-xl bg-[#F7A600] px-5 py-3.5 text-center font-black text-black">{t(`ادفع ${selectedUsd?.priceUsd ?? "—"} USDT على شبكة TRON (TRC20)`, `Pay ${selectedUsd?.priceUsd ?? "—"} USDT on the TRON (TRC20) network`)}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">{t("إلى عنوان الإيداع — من أي منصة أو محفظة عملات:", "To this deposit address — from any exchange or crypto wallet:")}</span><strong dir="ltr" className="break-all text-base tracking-wide">{config?.bybitUsdtAddress || "—"}</strong><button type="button" onClick={() => void copyValue("bybit-trc20", config?.bybitUsdtAddress || "")} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "bybit-trc20" ? t("تم النسخ ✓", "Copied ✓") : t("نسخ العنوان", "Copy address")}</button></div>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">{t("أو من داخل تطبيق Bybit مباشرة بالـ UID — فوري وبدون رسوم:", "Or directly inside the Bybit app via UID — instant and fee-free:")}</span><strong dir="ltr" className="text-base tracking-wide">{config?.bybitUid || "—"}</strong><button type="button" onClick={() => void copyValue("bybit", config?.bybitUid || "")} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "bybit" ? t("تم النسخ ✓", "Copied ✓") : t("نسخ الـ ID", "Copy ID")}</button></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">{t(`حوّل قيمة اشتراكك المختار بالظبط (${selectedUsd?.priceUsd ?? "—"} USDT) ثم ارفع صورة الإثبات بالأسفل — والتفعيل بيتم خلال دقائق من وصول الإثبات.`, `Send the exact price of your selected subscription (${selectedUsd?.priceUsd ?? "—"} USDT), then upload the proof image below — activation happens within minutes of your proof arriving.`)}</p>
        </div>}
        {paymentMethod === "paypal" && <div className="mt-5">
          <p className="text-sm leading-6 text-slate-300">{t("اشتراكك المختار:", "Your selected plan:")} <strong>{t(`مقابل ما يعادل $${selectedUsd?.priceUsd ?? "—"} بسعر صرف اليوم`, `for the equivalent of $${selectedUsd?.priceUsd ?? "—"} at today's exchange rate`)}</strong> — {t("يُضاف رصيد اشتراكك", "your subscription balance is added")} <strong className="text-amber-400">{t("تلقائيًا وفورًا", "automatically and instantly")}</strong> {t("بعد تأكيد PayPal للدفع، من غير إثبات ولا انتظار مراجعة.", "once PayPal confirms the payment — no proof upload, no review wait.")}</p>
          {config?.paypalClientId ? <div id="paypal-buttons-container" className="relative mt-4 min-h-[110px] rounded-xl bg-white/[.02] p-3"><span className="pointer-events-none absolute inset-x-0 top-4 text-center text-xs text-slate-500">{t("جارٍ تحميل أزرار PayPal…", "Loading PayPal buttons…")}</span></div> : <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/5 p-3 text-sm text-amber-200">{t("دفع PayPal بيتم تفعيله الآن — جرّب بعد قليل أو اختر وسيلة دفع مصرية.", "PayPal payment is being activated — try again shortly or choose an Egyptian payment method.")}</p>}
        </div>}
        {paymentMethod !== "paypal" && <div className="mt-7 border-t border-white/10 pt-6">
          <h3 className="text-lg font-bold">{t("إثبات الدفع", "Payment proof")} <span className="text-sm font-normal text-slate-400">{t("اسكرين شوت", "screenshot")}</span></h3>
          <p className="mt-2 text-sm text-slate-400">{t(`اشتراكك المختار: ${paymentMethod === "binance_pay" || paymentMethod === "bybit_pay" ? `${selectedUsd?.priceUsd ?? "—"} USDT` : `${selected?.priceEgp ?? "—"} جنيه`} عبر ${paymentMethod === "vodafone_cash" ? "فودافون كاش" : paymentMethod === "instapay" ? "انستا باي" : paymentMethod === "binance_pay" ? "Binance Pay" : "Bybit Pay"}.`, `Your selected plan: ${paymentMethod === "binance_pay" || paymentMethod === "bybit_pay" ? `${selectedUsd?.priceUsd ?? "—"} USDT` : `${selected?.priceEgp ?? "—"} EGP`} via ${paymentMethod === "vodafone_cash" ? "Vodafone Cash" : paymentMethod === "instapay" ? "InstaPay" : paymentMethod === "binance_pay" ? "Binance Pay" : "Bybit Pay"}.`)}</p>
          <label className="mt-4 block text-sm">{t("صورة التحويل (PNG/JPG/WebP)", "Transfer screenshot (PNG/JPG/WebP)")}<input className="mt-2 block w-full text-sm text-slate-300 file:me-3 file:rounded-lg file:border-0 file:bg-amber-400 file:text-[#1A0505] file:font-bold file:px-3 file:py-2" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void handleScreenshot(event.target.files?.[0])} /></label>
          {screenshotData && <img src={screenshotData} alt={t("معاينة إثبات الدفع", "Payment proof preview")} className="mt-4 max-h-48 rounded-xl border border-white/10 object-contain" />}
          <Button className="mt-5 h-12 w-full bg-[#FBBF24] font-black text-[#1A0505] hover:bg-[#FBBF24]" style={{ backgroundColor: "#FBBF24", color: "#1A0505" }} disabled={busy || !screenshotData} onClick={() => void submitPayment()}>{busy ? t("جارٍ إرسال الطلب...", "Sending your request...") : t("إرسال إثبات الدفع للمراجعة", "Send payment proof for review")}</Button>
        </div>}
        {message ? <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{message}</p> : paymentSuccess && lastSubmission && <div role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
          <p>{t("تم استلام طلبك وهو الآن قيد المراجعة، وسيتم التفعيل خلال دقائق", "Your request has been received and is now under review — it will be activated within minutes.")}</p>
          {lastSubmission.bridge === "granted" && <p className="mt-2 font-bold text-amber-300">{t("ليك هدية اشتراك: تمت إضافة رصيد هدية لحسابك — اشتغل بيهم دلوقتي، وطلبك هيتفعّل خلال دقائق", "You have a subscription gift: a gift balance has been added to your account — use them right now, and your request will be activated within minutes")}</p>}
          <div className="mt-3 flex flex-wrap gap-3">
            <a href="/" className="inline-flex items-center justify-center rounded-lg bg-[#FBBF24] px-4 py-2 text-sm font-black text-[#1A0505]">{t("العودة للرئيسية", "Back to home")}</a>
            <button type="button" aria-pressed={notifyChoice} onClick={() => void toggleNotify()} className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-bold ${notifyChoice ? "border-amber-400 bg-amber-400/15 text-amber-300" : "border-white/15 text-slate-300 hover:bg-white/10"}`}>{t("نبّهني بعد الموافقة", "Notify me after approval")}</button>
          </div>
        </div>}
      </section>
      {publicRequests.length > 0 && <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-5 md:p-7">
        <p className="text-xs font-bold tracking-[.2em] text-amber-400">PLATFORM ACTIVITY</p>
        <h2 className="mt-2 text-xl font-bold">{t("أحدث عمليات الدفع على المنصة", "Latest payment activity on the platform")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{t("عمليات مرت بنظام الدفع والمراجعة عندنا زي ما هي: اللي إثباته سليم اتفعّل، واللي إثباته مش سليم اترفض.", "Operations shown exactly as they passed through our payment and review system: valid proof was activated, faulty proof was rejected.")}</p>
        <div className="mt-4 space-y-3">{publicRequests.map(request => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4"><div><div className="font-bold">{t("اشتراك شهري", "Monthly subscription")} · {request.amountEgp} {t("جنيه", "EGP")}</div><div className="mt-1 text-xs text-slate-500">{methodLabel(request.paymentMethod)} · #{request.id.slice(0, 8)} · {formatRequestDate(request.createdAt)}</div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${request.status === "approved" ? "bg-emerald-400/15 text-emerald-300" : request.status === "rejected" ? "bg-red-400/15 text-red-300" : "bg-amber-400/15 text-amber-200"}`}>{statusLabel(request.status)}</span></div>)}</div>
        {publicRequests.some(request => request.test) && <p className="mt-3 text-center text-[11px] text-slate-500">{t("تجريبي", "Test operations")}</p>}
      </section>}
      {account && <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-[.2em] text-amber-400">PAYMENT ACTIVITY</p><h2 className="mt-2 text-xl font-bold">{t("طلبات الدفع الأخيرة", "Recent payment requests")}</h2></div><button type="button" onClick={() => void load().catch(() => {})} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10">{t("تحديث الحالة", "Refresh status")}</button></div>
        {(() => { const notice = requests.find(r => r.status === "approved" && r.notifyOnApproval && !r.approvalNoticeSeenAt); return notice ? <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#C9A227]/50 bg-[#1A0505] p-4 text-sm"><span>{t(`تمت الموافقة على طلبك واتفعّل اشتراكك وأُضيف الرصيد لحسابك. بالتوفيق!`, `Your request was approved, your subscription is active and the balance was added to your account.`)}</span><button type="button" onClick={() => void dismissApprovalNotice(notice.id)} className="rounded-lg bg-[#FBBF24] px-3 py-1.5 text-xs font-black text-[#1A0505]">{t("تمام", "Got it")}</button></div> : null; })()}
        {requests.length === 0 ? <p className="mt-4 text-sm text-slate-500">{t("لا توجد طلبات دفع سابقة.", "No previous payment requests.")}</p> : <div className="mt-4 space-y-3">{requests.map(request => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4"><div><div className="font-bold">{t("اشتراك شهري", "Monthly subscription")} · {request.amountEgp} {t("جنيه", "EGP")}</div><div className="mt-1 text-xs text-slate-500">{methodLabel(request.paymentMethod)} · #{request.id.slice(0, 8)} · {formatRequestDate(request.createdAt)}</div>{request.status === "pending" && request.memberNoticeText && <p className="mt-2 text-xs font-bold text-amber-300">{request.memberNoticeText}</p>}</div><span className={`rounded-full px-3 py-1 text-xs font-bold ${request.status === "approved" ? "bg-emerald-400/15 text-emerald-300" : request.status === "rejected" ? "bg-red-400/15 text-red-300" : "bg-amber-400/15 text-amber-200"}`}>{statusLabel(request.status)}</span></div>)}</div>}
      </section>}
      <footer className="mt-10 pb-4 text-center text-xs leading-6 text-slate-500">
        <p className="text-sm font-black tracking-wide text-slate-300">{t("HotGPT — نماذج حرة للمطورين والمسوقين وشركات تطوير المواقع · حرية الإنترنت", "HotGPT — free models for developers, marketers & web development companies · Internet freedom")}</p>
        <p className="mx-auto mt-2 max-w-2xl">{t("باستخدامك HotGPT واشتراكك في أي خطة، أنت وحدك المسؤول قانونيًا عن طلباتك وعن أي استخدام لمخرجات الخدمة، وليست المنصة. التفاصيل في", "By using HotGPT and subscribing to any plan, you alone are legally responsible for your requests and for any use of the service's outputs — not the platform. Details in the")} <a className="text-amber-400 underline" href="/lucky-terms">{t("الشروط والأحكام", "Terms & Conditions")}</a>.</p>
        <p className="mt-2"><a className="text-amber-400 underline" href="https://hot-gpt.blogspot.com" target="_blank" rel="noopener noreferrer">{t("مدونة HotGPT", "HotGPT Blog")}</a></p>
      </footer>
      <a href="https://t.me/HOTGPTPro" target="_blank" rel="noreferrer" aria-label={t("الدعم الفني على تليجرام", "Technical support on Telegram")} className="fixed bottom-5 start-5 z-40 flex items-center gap-2 rounded-full border border-amber-300/40 bg-[#1A0505]/95 px-4 py-2.5 shadow-lg shadow-black/50 backdrop-blur transition hover:border-amber-300 hover:bg-[#2B0000]">
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-amber-400" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
        <span className="text-sm font-black text-amber-300">{t("الدعم الفني", "Support")}</span>
      </a>
    </div>
  </main></LocalizedText>;
}
