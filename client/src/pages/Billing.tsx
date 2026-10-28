import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth";
import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";

type PackageOption = { tokens: number; priceEgp: number };
type PaymentRequest = { id: string; paymentMethod: "vodafone_cash" | "instapay" | "paypal"; packageTokens: number; amountEgp: number; status: string; createdAt: string; reviewedAt?: string | null };
type BillingConfig = {
  vodafoneCashNumber: string;
  vodafoneCashUrl?: string;
  instapayAddress?: string;
  instapayUrl?: string;
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

export default function BillingPage() {
  const { language } = useAppLanguage();
  const t = (ar: string, en: string) => (language === "ar" ? ar : en);
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [account, setAccount] = useState<{ email: string; tokenBalance: number; welcomeGiftGranted?: boolean } | null>(null);
  const [packageTokens, setPackageTokens] = useState(500);
  const [paymentMethod, setPaymentMethod] = useState<"vodafone_cash" | "instapay" | "paypal">("vodafone_cash");
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [screenshotData, setScreenshotData] = useState("");
  const [message, setMessage] = useState("");
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
  useEffect(() => { void load().catch(() => setMessage(t("تعذر تحميل بيانات الباقات. أعد المحاولة.", "Could not load the pack data. Please try again."))); }, []);

  const packages = config?.packages ?? [{ tokens: 100, priceEgp: 100 }, { tokens: 500, priceEgp: 300 }, { tokens: 800, priceEgp: 500 }, { tokens: 1000, priceEgp: 700 }];
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
    if (paymentMethod === "paypal") { setMessage(t("الدفع بـ PayPal يتم من زرار PayPal مباشرة — وتُضاف التوكينات تلقائيًا فور تأكيد الدفع.", "PayPal payment happens through the PayPal button itself — tokens are added automatically as soon as the payment is confirmed.")); return; }
    if (!selected || !screenshotData) { setMessage(t("اختر الباقة وارفع صورة إثبات الدفع أولًا.", "Choose a pack and upload your payment proof first.")); return; }
    setBusy(true); setMessage("");
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
        if (payload.error === "invalid_screenshot") throw new Error(t("الصورة غير صالحة أو تتجاوز 700 كيلوبايت.", "The image is invalid or larger than 700 KB."));
        if (payload.error === "proof_upload_failed") throw new Error(t("تعذر حفظ صورة الإثبات في التخزين. أعد المحاولة، وإذا تكرر الخطأ تواصل مع الإدارة.", "Could not save the proof image. Try again, and if it repeats, contact support."));
        if (payload.error === "payment_insert_failed") throw new Error(t("تم رفع الصورة لكن تعذر تسجيل طلب الدفع. لا تعِد التحويل؛ أعد إرسال الطلب أو تواصل مع الإدارة.", "The image was uploaded but the payment request could not be recorded. Do NOT transfer again; resend the request or contact support."));
        if (payload.error === "invalid_package_or_method") throw new Error(t("اختر باقة وطريقة دفع صحيحتين.", "Choose a valid pack and payment method."));
        throw new Error(t("تعذر إرسال طلب الدفع. تحقق من اتصالك وحاول مرة أخرى.", "Could not send the payment request. Check your connection and try again."));
      }
      setMessage(t("تم إرسال إثبات الدفع للمراجعة. ستُضاف التوكينات بعد موافقة الإدارة.", "Your payment proof was sent for review. Tokens are added after admin approval."));
      setScreenshotData("");
      void load().catch(() => {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("حدث خطأ غير متوقع.", "An unexpected error occurred."));
    } finally { setBusy(false); }
  }


  const selectedUsd = (config?.packagesUsd ?? []).find(item => item.tokens === packageTokens);
  const [copiedKey, setCopiedKey] = useState("");
  const statusLabel = (status: string) => ({ pending: t("قيد المراجعة", "Under review"), approved: t("تم الاعتماد", "Approved"), rejected: t("مرفوض", "Rejected") }[status] ?? t("غير معروف", "Unknown"));
  const methodLabel = (method: PaymentRequest["paymentMethod"]) => method === "vodafone_cash" ? t("فودافون كاش", "Vodafone Cash") : method === "instapay" ? t("إنستا باي", "InstaPay") : "PayPal";
  const formatRequestDate = (value: string) => { try { return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; } };
  async function copyValue(key: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopiedKey(key); setTimeout(() => setCopiedKey(""), 2000); } catch {}
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
            setMessage(language === "ar" ? `تم الدفع بنجاح وأُضيف ${payload.tokensAdded} توكين إلى رصيدك. رصيدك الآن ${payload.tokenBalance} توكين.` : `Payment successful — ${payload.tokensAdded} tokens were added to your balance. Your balance is now ${payload.tokenBalance} tokens.`);
            void load().catch(() => {});
          } catch {
            setMessage(language === "ar" ? "وصل دفعك إلى PayPal لكن تعذّر تأكيد الإضافة تلقائيًا. لا تعِد الدفع — تواصل مع الإدارة وسيُضاف رصيدك." : "Your payment reached PayPal but the automatic credit could not be confirmed. Do NOT pay again — contact support and your balance will be added.");
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
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold tracking-[.25em] text-amber-400">HOTGPT WALLET</p><h1 className="mt-2 text-3xl font-bold">{t("الباقات ورصيد التوكينات", "Packs & token balance")}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{t("كل فعل بسعر ثابت تعرفه قبل ما تبدأ — مفيش فواتير مفاجئة. وعضويتك بدأت بهدية ترحيب: 5 توكينات وصلت رصيدك تلقائيًا عند أول دخول.", "Every action has one flat price you know before you start — no surprise bills. And your membership began with a welcome gift: 5 tokens landed in your balance automatically on your first visit.")}</p></div>
        {account && <div className="rounded-2xl border border-[#C9A227]/50 bg-black/30 p-4 text-sm"><div className="text-slate-400">{account.email}</div><div className="mt-1 text-lg font-bold text-amber-400">{account.tokenBalance} {t("توكين", "tokens")}</div>{account.welcomeGiftGranted && <div className="mt-1 text-xs font-bold text-amber-300">{t("🎁 أُضيفت هدية الترحيب (5 توكينات) إلى رصيدك", "🎁 The welcome gift (5 tokens) was added to your balance")}</div>}</div>}
      </div>
      <section className="mt-8 rounded-2xl border border-[#C9A227]/50 bg-[#1A0505] p-5 md:p-7">
        <h2 className="text-xl font-bold">{t("عائلة HotGPT — أسعار الأفعال", "The HotGPT family — action prices")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-amber-400/20 bg-black/30 p-4"><div className="font-bold">{t("HotGPT — الافتراضي اليومي", "HotGPT — the everyday default")}</div><p className="mt-1 text-sm text-slate-400">{t("رسالة:", "Message:")} <strong className="text-amber-400">{t("1 توكين", "1 token")}</strong> · {t("تحليل ملف مرفق:", "Attached-file analysis:")} <strong className="text-amber-400">{t("3 توكينات", "3 tokens")}</strong></p></div>
          <div className="rounded-xl border border-amber-400/20 bg-black/30 p-4"><div className="font-bold">{t("HotGPT الوحش PRO", "HotGPT Alwahsh PRO")}</div><p className="mt-1 text-sm text-slate-400">{t("للتحليل العميق والبرمجة والأمن الرقمي:", "For deep analysis, programming and digital security:")} <strong className="text-amber-400">{t("5 توكينات للمرحلة", "5 tokens per stage")}</strong>{t("، وأكمل بقية التقرير بمرحلة ثانية بنفس السعر.", ", and continue the rest of the report with a second stage at the same price.")}</p></div>
          <div className="rounded-xl border border-amber-400/20 bg-black/30 p-4"><div className="font-bold">HotGPT Dark</div><p className="mt-1 text-sm text-slate-400">{t("لاستخبارات الويب المظلم والتهديدات:", "For dark-web and threat intelligence:")} <strong className="text-amber-400">{t("5 توكينات للمرحلة", "5 tokens per stage")}</strong>.</p></div>
          <div className="rounded-xl border border-amber-400/20 bg-black/30 p-4"><div className="font-bold">{t("بحث الويب المباشر", "Live web search")}</div><p className="mt-1 text-sm text-slate-400">{t("عملية بحث كاملة بإجابة واحدة:", "A complete search in one answer:")} <strong className="text-amber-400">{t("5 توكينات", "5 tokens")}</strong> {t("(البحث الموسّع العميق بالمراحل).", "(extended deep research runs in stages).")}</p></div>
          <div className="rounded-xl border border-amber-400/20 bg-black/30 p-4"><div className="font-bold">{t("توليد الصور", "Image generation")}</div><p className="mt-1 text-sm text-slate-400">{t("صورة واحدة:", "One image:")} <strong className="text-amber-400">{t("5 توكينات", "5 tokens")}</strong> {t("— احفظها على جهازك بعد توليدها.", "— save it to your device after generating it.")}</p></div>
          <div className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-4"><div className="font-bold text-amber-300">{t("🎁 هدية الترحيب", "🎁 Welcome gift")}</div><p className="mt-1 text-sm text-slate-400">{t("كل عضو جديد:", "Every new member:")} <strong className="text-amber-300">{t("5 توكينات هدية", "5 free tokens")}</strong> {t("مرة واحدة — جرّب بيهم أي وضع، حتى الوحش PRO أو صورة.", "once — try any mode with them, even Alwahsh PRO or an image.")}</p></div>
        </div>
      </section>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {packages.map(item => {
          const perToken = item.priceEgp / item.tokens;
          const saving = Math.max(0, Math.round((1 - perToken) * 100));
          const usd = (config?.packagesUsd ?? []).find(p => p.tokens === item.tokens);
          const label = item.tokens === 100 ? t("باقة البداية", "Starter") : item.tokens === 500 ? t("الأساسية", "Basic") : item.tokens === 800 ? t("الأكثر طلبًا", "Most popular") : t("الأكبر", "Largest");
          const isPopular = item.tokens === 800;
          return (
          <button key={item.tokens} onClick={() => setPackageTokens(item.tokens)} className={`relative rounded-2xl border p-6 text-start transition ${packageTokens === item.tokens ? "border-amber-400 bg-amber-400/10" : isPopular ? "border-amber-300/60 bg-amber-300/[.06] hover:border-amber-300" : "border-white/10 bg-white/[.03] hover:border-amber-400/50"}`}>
            {isPopular && <span className="absolute -top-3 start-4 rounded-full bg-amber-400 px-3 py-0.5 text-[11px] font-black text-black shadow">{t("الأكثر طلبًا ⭐", "Most popular ⭐")}</span>}
            <div className="text-sm text-slate-400">{label}</div>
            <div className="mt-3 text-3xl font-bold">{item.tokens.toLocaleString("en-US")} <span className="text-base font-normal text-amber-400">{t("توكين", "tokens")}</span></div>
            <div className="mt-2 text-xl font-semibold">{item.priceEgp} {t("جنيه", "EGP")}{usd && <span className="text-sm font-normal text-slate-400"> · {t(`أو ما يعادل $${usd.priceUsd} بـ PayPal`, `or the equivalent of $${usd.priceUsd} via PayPal`)}</span>}</div>
            <div className="mt-2 text-xs text-slate-400">{t(`التوكين ≈ ${perToken.toFixed(2)} جنيه`, `≈ ${perToken.toFixed(2)} EGP per token`)}{saving > 0 ? t(` · أوفر ${saving}% من السعر الأساسي (1 جنيه)`, ` · save ${saving}% vs the base rate (1 EGP)`) : t(" · بالسعر الأساسي", " · at the base rate")}</div>
            <div className="mt-3 text-xs leading-5 text-slate-400">{t(`تكفي تقريبًا: ${item.tokens.toLocaleString("en-US")} رسالة افتراضية · أو ${Math.floor(item.tokens / 5)} مرحلة وحش/Dark · أو ${Math.floor(item.tokens / 5)} صورة`, `Covers roughly: ${item.tokens.toLocaleString("en-US")} default messages · or ${Math.floor(item.tokens / 5)} Beast/Dark stages · or ${Math.floor(item.tokens / 5)} images`)}</div>
          </button>
          );
        })}
      </div>
      <section className="mt-8 rounded-2xl border border-[#C9A227]/50 bg-[#1A0505] p-5 md:p-7">
        <h2 className="text-xl font-bold">{t("طريقة الدفع", "Payment method")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button onClick={() => setPaymentMethod("vodafone_cash")} className={`rounded-xl border p-4 text-start transition ${paymentMethod === "vodafone_cash" ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e60000] text-sm font-black text-white">VF</span><span><strong className="block">{t("فودافون كاش", "Vodafone Cash")}</strong><span className="text-xs text-slate-400">{t("جنيه مصري · تحويل من محفظتك", "EGP · transfer from your wallet")}</span></span></span>
          </button>
          <button onClick={() => setPaymentMethod("instapay")} className={`rounded-xl border p-4 text-start transition ${paymentMethod === "instapay" ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1d4ed8] text-sm font-black text-white">IP</span><span><strong className="block">{t("انستا باي", "InstaPay")}</strong><span className="text-xs text-slate-400">{t("جنيه مصري · تحويل بنكي لحظي", "EGP · instant bank transfer")}</span></span></span>
          </button>
          <button onClick={() => setPaymentMethod("paypal")} className={`rounded-xl border p-4 text-start transition ${paymentMethod === "paypal" ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#012169] text-sm font-black italic text-white">P</span><span><strong className="block">PayPal</strong><span className="text-xs text-slate-400">{t("دولار أمريكي · إضافة فورية تلقائية", "USD · instant automatic credit")}</span></span></span>
          </button>
        </div>
        {paymentMethod === "vodafone_cash" && <div className="mt-5">
          <a href={config?.vodafoneCashUrl ?? "https://vf.eg/vfcash?id=mt&qrId=G0gO2O"} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#e60000] px-5 py-3.5 text-center font-black text-white transition hover:brightness-110">{t("ادفع الآن — يفتح تطبيق فودافون كاش ↗", "Pay now — opens the Vodafone Cash app ↗")}</a>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">{t("أو حوّل يدويًا إلى الرقم:", "Or transfer manually to:")}</span><strong dir="ltr" className="text-base tracking-wide">{config?.vodafoneCashNumber ?? "01063537686"}</strong><button type="button" onClick={() => void copyValue("vf", config?.vodafoneCashNumber ?? "01063537686")} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "vf" ? t("تم النسخ ✓", "Copied ✓") : t("نسخ الرقم", "Copy number")}</button></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">{t(`حوّل قيمة الباقة المختارة بالظبط (${selected?.priceEgp ?? "—"} جنيه) ثم ارفع صورة الإثبات بالأسفل.`, `Transfer the exact price of the selected pack (${selected?.priceEgp ?? "—"} EGP), then upload the proof image below.`)}</p>
        </div>}
        {paymentMethod === "instapay" && <div className="mt-5">
          <a href={config?.instapayUrl ?? "https://ipn.eg/S/wahedelfar1/instapay/5hwGuZ"} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#1d4ed8] px-5 py-3.5 text-center font-black text-white transition hover:brightness-110">{t("ادفع الآن — يفتح تطبيق انستا باي ↗", "Pay now — opens the InstaPay app ↗")}</a>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">{t("أو حوّل يدويًا إلى العنوان:", "Or transfer manually to:")}</span><strong dir="ltr" className="text-base tracking-wide">{config?.instapayAddress ?? "wahedelfar1@instapay"}</strong><button type="button" onClick={() => void copyValue("ip", config?.instapayAddress ?? "wahedelfar1@instapay")} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "ip" ? t("تم النسخ ✓", "Copied ✓") : t("نسخ العنوان", "Copy address")}</button></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">{t(`حوّل قيمة الباقة المختارة بالظبط (${selected?.priceEgp ?? "—"} جنيه) ثم ارفع صورة الإثبات بالأسفل.`, `Transfer the exact price of the selected pack (${selected?.priceEgp ?? "—"} EGP), then upload the proof image below.`)}</p>
        </div>}
        {paymentMethod === "paypal" && <div className="mt-5">
          <p className="text-sm leading-6 text-slate-300">{t("الباقة المختارة:", "Selected pack:")} <strong>{t(`${packageTokens.toLocaleString("en-US")} توكين مقابل ما يعادل $${selectedUsd?.priceUsd ?? "—"} بسعر صرف اليوم`, `${packageTokens.toLocaleString("en-US")} tokens for the equivalent of $${selectedUsd?.priceUsd ?? "—"} at today's exchange rate`)}</strong> — {t("تُضاف التوكينات إلى رصيدك", "tokens are added to your balance")} <strong className="text-amber-400">{t("تلقائيًا وفورًا", "automatically and instantly")}</strong> {t("بعد تأكيد PayPal للدفع، من غير إثبات ولا انتظار مراجعة.", "once PayPal confirms the payment — no proof upload, no review wait.")}</p>
          {config?.paypalClientId ? <div id="paypal-buttons-container" className="relative mt-4 min-h-[110px] rounded-xl bg-white/[.02] p-3"><span className="pointer-events-none absolute inset-x-0 top-4 text-center text-xs text-slate-500">{t("جارٍ تحميل أزرار PayPal…", "Loading PayPal buttons…")}</span></div> : <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/5 p-3 text-sm text-amber-200">{t("دفع PayPal بيتم تفعيله الآن — جرّب بعد قليل أو اختر وسيلة دفع مصرية.", "PayPal payment is being activated — try again shortly or choose an Egyptian payment method.")}</p>}
        </div>}
        {paymentMethod !== "paypal" && <div className="mt-7 border-t border-white/10 pt-6">
          <h3 className="text-lg font-bold">{t("إثبات الدفع", "Payment proof")}</h3>
          <p className="mt-2 text-sm text-slate-400">{t(`الباقة المختارة: ${packageTokens} توكين مقابل ${selected?.priceEgp ?? "—"} جنيه عبر ${paymentMethod === "vodafone_cash" ? "فودافون كاش" : "انستا باي"}.`, `Selected pack: ${packageTokens} tokens for ${selected?.priceEgp ?? "—"} EGP via ${paymentMethod === "vodafone_cash" ? "Vodafone Cash" : "InstaPay"}.`)}</p>
          <label className="mt-4 block text-sm">{t("صورة التحويل (PNG/JPG/WebP — تُصغَّر تلقائيًا قبل الرفع)", "Transfer screenshot (PNG/JPG/WebP — auto-resized before upload)")}<input className="mt-2 block w-full text-sm text-slate-300 file:me-3 file:rounded-lg file:border-0 file:bg-amber-400 file:text-[#1A0505] file:font-bold file:px-3 file:py-2" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void handleScreenshot(event.target.files?.[0])} /></label>
          {screenshotData && <img src={screenshotData} alt={t("معاينة إثبات الدفع", "Payment proof preview")} className="mt-4 max-h-48 rounded-xl border border-white/10 object-contain" />}
          <Button className="mt-5 h-12 w-full bg-[#FBBF24] font-black text-[#1A0505] hover:bg-[#FBBF24]" style={{ backgroundColor: "#FBBF24", color: "#1A0505" }} disabled={busy || !screenshotData} onClick={() => void submitPayment()}>{busy ? t("جارٍ إرسال الطلب...", "Sending your request...") : t("إرسال إثبات الدفع للمراجعة", "Send payment proof for review")}</Button>
          <p className="mt-3 text-xs leading-5 text-slate-500">{t("للتأكيد السريع يمكنك أيضًا إرسال صورة التحويل عبر", "For faster confirmation you can also send the transfer screenshot via")} <a className="text-amber-400 underline" href="https://wa.me/201063537686" target="_blank" rel="noreferrer">WhatsApp</a>.</p>
        </div>}
        {message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{message}</p>}
      </section>
      {account && <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-[.2em] text-amber-400">PAYMENT ACTIVITY</p><h2 className="mt-2 text-xl font-bold">{t("طلبات الدفع الأخيرة", "Recent payment requests")}</h2></div><button type="button" onClick={() => void load().catch(() => {})} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10">{t("تحديث الحالة", "Refresh status")}</button></div>
        {requests.length === 0 ? <p className="mt-4 text-sm text-slate-500">{t("لا توجد طلبات دفع سابقة.", "No previous payment requests.")}</p> : <div className="mt-4 space-y-3">{requests.map(request => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4"><div><div className="font-bold">{request.packageTokens.toLocaleString("en-US")} {t("توكين", "tokens")} · {request.amountEgp} {t("جنيه", "EGP")}</div><div className="mt-1 text-xs text-slate-500">{methodLabel(request.paymentMethod)} · #{request.id.slice(0, 8)} · {formatRequestDate(request.createdAt)}</div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${request.status === "approved" ? "bg-emerald-400/15 text-emerald-300" : request.status === "rejected" ? "bg-red-400/15 text-red-300" : "bg-amber-400/15 text-amber-200"}`}>{statusLabel(request.status)}</span></div>)}</div>}
      </section>}
      <footer className="mt-10 pb-4 text-center text-xs leading-6 text-slate-500">
        <p className="text-sm font-black tracking-wide text-slate-300">{t("HotGPT — نماذج حرة للمطورين والباحثين · حرية الإنترنت", "HotGPT — free models for developers & researchers · Internet freedom")}</p>
        <p className="mx-auto mt-2 max-w-2xl">{t("باستخدامك HotGPT وشرائك أي باقة، أنت وحدك المسؤول قانونيًا عن طلباتك وعن أي استخدام لمخرجات الخدمة، وليست المنصة. التفاصيل في", "By using HotGPT and buying any pack, you alone are legally responsible for your requests and for any use of the service's outputs — not the platform. Details in the")} <a className="text-amber-400 underline" href="/lucky-terms">{t("الشروط والأحكام", "Terms & Conditions")}</a>.</p>
      </footer>
    </div>
  </main></LocalizedText>;
}
