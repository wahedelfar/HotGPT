import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth";
import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";

type PackageOption = { tokens: number; priceEgp: number };
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

export default function BillingPage() {
  const { language } = useAppLanguage();
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [account, setAccount] = useState<{ email: string; tokenBalance: number; welcomeGiftGranted?: boolean } | null>(null);
  const [packageTokens, setPackageTokens] = useState(500);
  const [paymentMethod, setPaymentMethod] = useState<"vodafone_cash" | "instapay" | "paypal">("vodafone_cash");
  const [screenshotData, setScreenshotData] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [configResponse, accountResponse] = await Promise.all([
      fetch("/api/billing?action=config", { cache: "no-store" }),
      authFetch("/api/billing?action=me", { cache: "no-store" }),
    ]);
    if (configResponse.ok) setConfig(await configResponse.json());
    if (accountResponse.ok) setAccount(await accountResponse.json());
    else setAccount(null);
  }
  useEffect(() => { void load().catch(() => setMessage("تعذر تحميل بيانات الباقات. أعد المحاولة.")); }, []);

  const packages = config?.packages ?? [{ tokens: 100, priceEgp: 100 }, { tokens: 500, priceEgp: 300 }, { tokens: 800, priceEgp: 500 }, { tokens: 1000, priceEgp: 700 }];
  const selected = packages.find(item => item.tokens === packageTokens);
  async function handleScreenshot(file?: File) {
    setMessage("");
    if (!file) { setScreenshotData(""); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage("ارفع صورة PNG أو JPG أو WebP فقط."); return;
    }
    if (file.size > 700_000) {
      setMessage("حجم الصورة يجب ألا يتجاوز 700 كيلوبايت. قلّل حجم الصورة ثم أعد المحاولة."); return;
    }
    const reader = new FileReader();
    reader.onload = () => setScreenshotData(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setMessage("تعذر قراءة الصورة. حاول بصورة أخرى.");
    reader.readAsDataURL(file);
  }

  async function submitPayment() {
    if (paymentMethod === "paypal") { setMessage("الدفع بـ PayPal يتم من زرار PayPal مباشرة — وتُضاف التوكينات تلقائيًا فور تأكيد الدفع."); return; }
    if (!selected || !screenshotData) { setMessage("اختر الباقة وارفع صورة إثبات الدفع أولًا."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await authFetch("/api/billing?action=payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageTokens, paymentMethod, screenshotData }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.error === "login_required") { setMessage("يجب تسجيل الدخول قبل إرسال إثبات الدفع. سجّل الدخول ثم حاول مجددًا."); return; }
        if (payload.error === "auth_unavailable" || payload.error === "billing_unavailable") { throw new Error("تعذر التحقق من الحساب حاليًا. أعد المحاولة بعد قليل."); }
        if (payload.error === "invalid_screenshot") throw new Error("الصورة غير صالحة أو تتجاوز 700 كيلوبايت.");
        if (payload.error === "proof_upload_failed") throw new Error("تعذر حفظ صورة الإثبات في التخزين. أعد المحاولة، وإذا تكرر الخطأ تواصل مع الإدارة.");
        if (payload.error === "payment_insert_failed") throw new Error("تم رفع الصورة لكن تعذر تسجيل طلب الدفع. لا تعِد التحويل؛ أعد إرسال الطلب أو تواصل مع الإدارة.");
        if (payload.error === "invalid_package_or_method") throw new Error("اختر باقة وطريقة دفع صحيحتين.");
        throw new Error("تعذر إرسال طلب الدفع. تحقق من اتصالك وحاول مرة أخرى.");
      }
      setMessage("تم إرسال إثبات الدفع للمراجعة. ستُضاف التوكينات بعد موافقة الإدارة.");
      setScreenshotData("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally { setBusy(false); }
  }


  const selectedUsd = (config?.packagesUsd ?? []).find(item => item.tokens === packageTokens);
  const [copiedKey, setCopiedKey] = useState("");
  async function copyValue(key: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopiedKey(key); setTimeout(() => setCopiedKey(""), 2000); } catch {}
  }

  // PayPal Buttons: the browser only starts and approves the order; our
  // server creates it, captures it, verifies it and credits the tokens.
  useEffect(() => {
    if (paymentMethod !== "paypal" || !config?.paypalClientId) return;
    let cancelled = false;
    const renderButtons = () => {
      const w = window as any;
      if (cancelled || !w.paypal?.Buttons) return;
      const container = document.getElementById("paypal-buttons-container");
      if (!container) return;
      container.innerHTML = "";
      w.paypal.Buttons({
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
            setMessage(`تم الدفع بنجاح وأُضيف ${payload.tokensAdded} توكين إلى رصيدك. رصيدك الآن ${payload.tokenBalance} توكين.`);
            void load().catch(() => {});
          } catch {
            setMessage("وصل دفعك إلى PayPal لكن تعذّر تأكيد الإضافة تلقائيًا. لا تعِد الدفع — تواصل مع الإدارة وسيُضاف رصيدك.");
          } finally { setBusy(false); }
        },
        onError: () => setMessage("حدث خطأ في PayPal. حاول مرة أخرى أو اختر وسيلة دفع أخرى."),
      }).render("#paypal-buttons-container");
    };
    if (document.querySelector('script[data-paypal-sdk="1"]')) renderButtons();
    else {
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.paypalClientId)}&currency=USD&intent=capture`;
      script.dataset.paypalSdk = "1";
      script.async = true;
      script.onload = renderButtons;
      document.body.appendChild(script);
    }
    return () => { cancelled = true; const c = document.getElementById("paypal-buttons-container"); if (c) c.innerHTML = ""; };
  }, [paymentMethod, config?.paypalClientId, packageTokens]);

  return <LocalizedText><main dir={language === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#080b10] px-4 py-8 text-white sm:px-8">
    <LanguageToggle />
    <a href="/" aria-label={language === "ar" ? "العودة إلى الرئيسية" : "Back to home"} className="fixed left-4 top-4 z-30 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#11151b]/95 px-4 py-2 text-sm text-cyan-200 shadow-lg backdrop-blur hover:bg-white/10"><span aria-hidden="true">⌂</span><span>{language === "ar" ? "الرئيسية" : "Home"}</span></a>
    <div className="mx-auto max-w-5xl">
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold tracking-[.25em] text-cyan-300">HOTGPT WALLET</p><h1 className="mt-2 text-3xl font-bold">الباقات ورصيد التوكينات</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">كل فعل بسعر ثابت تعرفه قبل ما تبدأ — مفيش فواتير مفاجئة. وعضويتك بدأت بهدية ترحيب: 5 توكينات وصلت رصيدك تلقائيًا عند أول دخول.</p></div>
        {account && <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"><div className="text-slate-400">{account.email}</div><div className="mt-1 text-lg font-bold">{account.tokenBalance} توكين</div>{account.welcomeGiftGranted && <div className="mt-1 text-xs font-bold text-amber-300">🎁 أُضيفت هدية الترحيب (5 توكينات) إلى رصيدك</div>}</div>}
      </div>
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-5 md:p-7">
        <h2 className="text-xl font-bold">عائلة HotGPT — أسعار الأفعال</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="font-bold">HotGPT — الافتراضي اليومي</div><p className="mt-1 text-sm text-slate-400">رسالة: <strong className="text-cyan-300">1 توكين</strong> · تحليل ملف مرفق: <strong className="text-cyan-300">3 توكينات</strong></p></div>
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="font-bold">HotGPT الوحش PRO</div><p className="mt-1 text-sm text-slate-400">للتحليل العميق والبرمجة والأمن الرقمي: <strong className="text-cyan-300">5 توكينات للمرحلة</strong>، وأكمل بقية التقرير بمرحلة ثانية بنفس السعر.</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="font-bold">HotGPT Dark</div><p className="mt-1 text-sm text-slate-400">لاستخبارات الويب المظلم والتهديدات: <strong className="text-cyan-300">5 توكينات للمرحلة</strong>.</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="font-bold">بحث الويب المباشر</div><p className="mt-1 text-sm text-slate-400">عملية بحث كاملة بإجابة واحدة: <strong className="text-cyan-300">5 توكينات</strong> (البحث الموسّع العميق بالمراحل).</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="font-bold">توليد الصور</div><p className="mt-1 text-sm text-slate-400">صورة واحدة: <strong className="text-cyan-300">5 توكينات</strong> — احفظها على جهازك بعد توليدها.</p></div>
          <div className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-4"><div className="font-bold text-amber-300">🎁 هدية الترحيب</div><p className="mt-1 text-sm text-slate-400">كل عضو جديد: <strong className="text-amber-300">5 توكينات هدية</strong> مرة واحدة — جرّب بيهم أي وضع، حتى الوحش PRO أو صورة.</p></div>
        </div>
      </section>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {packages.map(item => {
          const perToken = item.priceEgp / item.tokens;
          const saving = Math.max(0, Math.round((1 - perToken) * 100));
          const usd = (config?.packagesUsd ?? []).find(p => p.tokens === item.tokens);
          const label = item.tokens === 100 ? "باقة البداية" : item.tokens === 500 ? "الأساسية" : item.tokens === 800 ? "الأكثر طلبًا" : "الأكبر";
          const isPopular = item.tokens === 800;
          return (
          <button key={item.tokens} onClick={() => setPackageTokens(item.tokens)} className={`relative rounded-2xl border p-6 text-right transition ${packageTokens === item.tokens ? "border-cyan-300 bg-cyan-300/10" : isPopular ? "border-amber-300/60 bg-amber-300/[.06] hover:border-amber-300" : "border-white/10 bg-white/[.03] hover:border-white/25"}`}>
            {isPopular && <span className="absolute -top-3 right-4 rounded-full bg-amber-400 px-3 py-0.5 text-[11px] font-black text-black shadow">الأكثر طلبًا ⭐</span>}
            <div className="text-sm text-slate-400">{label}</div>
            <div className="mt-3 text-3xl font-bold">{item.tokens.toLocaleString("en-US")} <span className="text-base font-normal text-cyan-300">توكين</span></div>
            <div className="mt-2 text-xl font-semibold">{item.priceEgp} جنيه{usd && <span className="text-sm font-normal text-slate-400"> · أو ما يعادل ${usd.priceUsd} بـ PayPal</span>}</div>
            <div className="mt-2 text-xs text-slate-400">التوكين ≈ {perToken.toFixed(2)} جنيه{saving > 0 ? ` · أوفر ${saving}% من السعر الأساسي (1 جنيه)` : " · بالسعر الأساسي"}</div>
            <div className="mt-3 text-xs leading-5 text-slate-400">تكفي تقريبًا: {item.tokens.toLocaleString("en-US")} رسالة افتراضية · أو {Math.floor(item.tokens / 5)} مرحلة وحش/Dark · أو {Math.floor(item.tokens / 5)} صورة</div>
          </button>
          );
        })}
      </div>
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-5 md:p-7">
        <h2 className="text-xl font-bold">طريقة الدفع</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button onClick={() => setPaymentMethod("vodafone_cash")} className={`rounded-xl border p-4 text-right transition ${paymentMethod === "vodafone_cash" ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e60000] text-sm font-black text-white">VF</span><span><strong className="block">فودافون كاش</strong><span className="text-xs text-slate-400">جنيه مصري · تحويل من محفظتك</span></span></span>
          </button>
          <button onClick={() => setPaymentMethod("instapay")} className={`rounded-xl border p-4 text-right transition ${paymentMethod === "instapay" ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1d4ed8] text-sm font-black text-white">IP</span><span><strong className="block">انستا باي</strong><span className="text-xs text-slate-400">جنيه مصري · تحويل بنكي لحظي</span></span></span>
          </button>
          <button onClick={() => setPaymentMethod("paypal")} className={`rounded-xl border p-4 text-right transition ${paymentMethod === "paypal" ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}>
            <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#012169] text-sm font-black italic text-white">P</span><span><strong className="block">PayPal</strong><span className="text-xs text-slate-400">دولار أمريكي · إضافة فورية تلقائية</span></span></span>
          </button>
        </div>
        {paymentMethod === "vodafone_cash" && <div className="mt-5">
          <a href={config?.vodafoneCashUrl ?? "https://vf.eg/vfcash?id=mt&qrId=G0gO2O"} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#e60000] px-5 py-3.5 text-center font-black text-white transition hover:brightness-110">ادفع الآن — يفتح تطبيق فودافون كاش ↗</a>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">أو حوّل يدويًا إلى الرقم:</span><strong dir="ltr" className="text-base tracking-wide">{config?.vodafoneCashNumber ?? "01063537686"}</strong><button type="button" onClick={() => void copyValue("vf", config?.vodafoneCashNumber ?? "01063537686")} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "vf" ? "تم النسخ ✓" : "نسخ الرقم"}</button></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">حوّل قيمة الباقة المختارة بالظبط ({selected?.priceEgp ?? "—"} جنيه) ثم ارفع صورة الإثبات بالأسفل.</p>
        </div>}
        {paymentMethod === "instapay" && <div className="mt-5">
          <a href={config?.instapayUrl ?? "https://ipn.eg/S/wahedelfar1/instapay/5hwGuZ"} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#1d4ed8] px-5 py-3.5 text-center font-black text-white transition hover:brightness-110">ادفع الآن — يفتح تطبيق انستا باي ↗</a>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">أو حوّل يدويًا إلى العنوان:</span><strong dir="ltr" className="text-base tracking-wide">{config?.instapayAddress ?? "wahedelfar1@instapay"}</strong><button type="button" onClick={() => void copyValue("ip", config?.instapayAddress ?? "wahedelfar1@instapay")} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "ip" ? "تم النسخ ✓" : "نسخ العنوان"}</button></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">حوّل قيمة الباقة المختارة بالظبط ({selected?.priceEgp ?? "—"} جنيه) ثم ارفع صورة الإثبات بالأسفل.</p>
        </div>}
        {paymentMethod === "paypal" && <div className="mt-5">
          <p className="text-sm leading-6 text-slate-300">الباقة المختارة: <strong>{packageTokens.toLocaleString("en-US")} توكين مقابل ما يعادل ${selectedUsd?.priceUsd ?? "—"} بسعر صرف اليوم</strong> — تُضاف التوكينات إلى رصيدك <strong className="text-cyan-300">تلقائيًا وفورًا</strong> بعد تأكيد PayPal للدفع، من غير إثبات ولا انتظار مراجعة.</p>
          {config?.paypalClientId ? <div id="paypal-buttons-container" className="mt-4 min-h-[110px] rounded-xl bg-white/[.02] p-3"></div> : <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/5 p-3 text-sm text-amber-200">دفع PayPal بيتم تفعيله الآن — جرّب بعد قليل أو اختر وسيلة دفع مصرية.</p>}
        </div>}
        {paymentMethod !== "paypal" && <div className="mt-7 border-t border-white/10 pt-6">
          <h3 className="text-lg font-bold">إثبات الدفع</h3>
          <p className="mt-2 text-sm text-slate-400">الباقة المختارة: {packageTokens} توكين مقابل {selected?.priceEgp ?? "—"} جنيه عبر {paymentMethod === "vodafone_cash" ? "فودافون كاش" : "انستا باي"}.</p>
          <label className="mt-4 block text-sm">صورة التحويل (PNG/JPG/WebP، حتى 700KB)<input className="mt-2 block w-full text-sm text-slate-300 file:ml-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void handleScreenshot(event.target.files?.[0])} /></label>
          {screenshotData && <img src={screenshotData} alt="معاينة إثبات الدفع" className="mt-4 max-h-48 rounded-xl border border-white/10 object-contain" />}
          <Button className="mt-5 w-full" disabled={busy || !screenshotData} onClick={() => void submitPayment()}>{busy ? "جارٍ إرسال الطلب..." : "إرسال إثبات الدفع للمراجعة"}</Button>
          <p className="mt-3 text-xs leading-5 text-slate-500">للتأكيد السريع يمكنك أيضًا إرسال صورة التحويل عبر <a className="text-cyan-300 underline" href="https://wa.me/201063537686" target="_blank" rel="noreferrer">WhatsApp</a>.</p>
        </div>}
        {message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{message}</p>}
      </section>
      <footer className="mt-10 pb-4 text-center text-xs leading-6 text-slate-500">
        <p className="text-sm font-black tracking-wide text-slate-300">HotGPT — نماذج حرة بدون قيود · حرية الإنترنت</p>
        <p className="mx-auto mt-2 max-w-2xl">باستخدامك HotGPT وشرائك أي باقة، أنت وحدك المسؤول قانونيًا عن طلباتك وعن أي استخدام لمخرجات الخدمة، وليست المنصة. التفاصيل في <a className="text-cyan-300 underline" href="/lucky-terms">الشروط والأحكام</a>.</p>
      </footer>
    </div>
  </main></LocalizedText>;
}
