import { useEffect, useState } from "react";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth";

type PackageOption = { tokens: number; priceEgp: number };
type BillingConfig = {
  vodafoneCashNumber: string;
  paypalPaymentUrl: string;
  packages: PackageOption[];
  freeAnswers: number;
  creditsPerAnswer: number;
};

export default function BillingPage() {
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [account, setAccount] = useState<{ email: string; tokenBalance: number; freeAnswersRemaining: number } | null>(null);
  const [packageTokens, setPackageTokens] = useState(500);
  const [paymentMethod, setPaymentMethod] = useState<"vodafone_cash" | "paypal">("vodafone_cash");
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

  const selected = config?.packages.find(item => item.tokens === packageTokens);
  async function handleScreenshot(file?: File) {
    setMessage("");
    if (!file) { setScreenshotData(""); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage("ارفع صورة PNG أو JPG أو WebP فقط."); return;
    }
    if (file.size > 1_200_000) {
      setMessage("حجم الصورة يجب ألا يتجاوز 1.2 ميجابايت."); return;
    }
    const reader = new FileReader();
    reader.onload = () => setScreenshotData(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setMessage("تعذر قراءة الصورة. حاول بصورة أخرى.");
    reader.readAsDataURL(file);
  }

  async function submitPayment() {
    if (!account) { startLogin(); return; }
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
        if (payload.error === "login_required") { setMessage("انتهت جلسة الدخول. سجّل الدخول ثم أعد إرسال الطلب."); return; }
        throw new Error(payload.error === "invalid_screenshot" ? "الصورة غير صالحة أو حجمها كبير." : "تعذر إرسال طلب الدفع.");
      }
      setMessage("تم إرسال إثبات الدفع للمراجعة. ستُضاف التوكينات بعد موافقة الإدارة.");
      setScreenshotData("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally { setBusy(false); }
  }

  return <main dir="rtl" className="min-h-screen bg-[#080b10] px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-5xl">
      <a href="/" className="text-sm text-cyan-300 hover:text-cyan-200">← العودة إلى HotGPT</a>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold tracking-[.25em] text-cyan-300">HOTGPT WALLET</p><h1 className="mt-2 text-3xl font-bold">الباقات ورصيد التوكينات</h1><p className="mt-2 text-sm text-slate-400">نموذج Default يخصم توكينًا واحدًا، ونموذج Beast يخصم توكينين ويحتاج إلى رصيد مدفوع. تحليل الملفات يخصم 3 توكينات. لديك إجابتان مجانيتان للرسائل العادية.</p></div>
        {account && <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"><div className="text-slate-400">{account.email}</div><div className="mt-1 text-lg font-bold">{account.tokenBalance} توكين مدفوع</div><div className="text-xs text-slate-400">متبقي {account.freeAnswersRemaining} إجابة مجانية</div></div>}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {(config?.packages ?? [{tokens:500,priceEgp:300},{tokens:800,priceEgp:500},{tokens:1000,priceEgp:700}]).map((item, index) =>
          <button key={item.tokens} onClick={() => setPackageTokens(item.tokens)} className={`rounded-2xl border p-6 text-right transition ${packageTokens === item.tokens ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-white/[.03] hover:border-white/25"}`}>
            <div className="text-sm text-slate-400">{index === 0 ? "البداية" : index === 1 ? "الأكثر توازنًا" : "الأكبر"}</div>
            <div className="mt-3 text-3xl font-bold">{item.tokens.toLocaleString("en-US")} <span className="text-base font-normal text-cyan-300">توكين</span></div>
            <div className="mt-2 text-xl font-semibold">{item.priceEgp} جنيه</div>
            <div className="mt-4 text-xs text-slate-400">Default: 1 توكين · Beast: 2 توكين · تحليل الملف: 3 توكينات</div>
          </button>
        )}
      </div>
      <section className="mt-8 grid gap-6 rounded-2xl border border-white/10 bg-white/[.03] p-5 md:grid-cols-2 md:p-7">
        <div>
          <h2 className="text-xl font-bold">طريقة الدفع</h2>
          <div className="mt-4 grid gap-3">
            <button onClick={() => setPaymentMethod("vodafone_cash")} className={`rounded-xl border p-4 text-right ${paymentMethod === "vodafone_cash" ? "border-cyan-300 bg-cyan-300/10" : "border-white/10"}`}><strong>فودافون كاش</strong><p className="mt-1 text-lg" dir="ltr">01063537686</p><p className="mt-1 text-xs text-slate-400">حوّل قيمة الباقة إلى الرقم أعلاه.</p></button>
            <button onClick={() => setPaymentMethod("paypal")} className={`rounded-xl border p-4 text-right ${paymentMethod === "paypal" ? "border-cyan-300 bg-cyan-300/10" : "border-white/10"}`}><strong>PayPal</strong><p className="mt-1 text-xs text-slate-400">استخدم رابط الدفع الرسمي ثم ارفع صورة الإثبات.</p>{config?.paypalPaymentUrl ? <a className="mt-2 inline-block text-cyan-300 underline" href={config.paypalPaymentUrl} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>فتح رابط PayPal</a> : <span className="mt-2 inline-block text-amber-300">رابط PayPal لم يُضف بعد</span>}</button>
          </div>
          <p className="mt-4 text-sm text-slate-400">للتأكيد السريع يمكنك إرسال صورة التحويل إلى رقم فودافون كاش نفسه. ارفع الصورة هنا أيضًا حتى تظهر في لوحة الإدارة.</p>
          <a className="mt-2 inline-block text-cyan-300 underline" href="https://wa.me/201063537686" target="_blank" rel="noreferrer">إرسال صورة التحويل عبر WhatsApp</a>
        </div>
        <div>
          <h2 className="text-xl font-bold">إثبات الدفع</h2>
          <p className="mt-2 text-sm text-slate-400">الباقة المختارة: {packageTokens} توكين مقابل {selected?.priceEgp ?? "—"} جنيه.</p>
          <label className="mt-5 block text-sm">اختر الباقة التي دفعت قيمتها<select value={packageTokens} onChange={event => setPackageTokens(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#101722] p-3 text-white outline-none focus:border-cyan-300">{(config?.packages ?? [{ tokens: 500, priceEgp: 300 }, { tokens: 800, priceEgp: 500 }, { tokens: 1000, priceEgp: 700 }]).map(item => <option key={item.tokens} value={item.tokens}>{item.tokens.toLocaleString("en-US")} توكين — {item.priceEgp} جنيه</option>)}</select></label>
          <label className="mt-4 block text-sm">صورة التحويل (PNG/JPG/WebP، حتى 1.2MB)<input className="mt-2 block w-full text-sm text-slate-300 file:ml-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void handleScreenshot(event.target.files?.[0])} /></label>
          {screenshotData && <img src={screenshotData} alt="معاينة إثبات الدفع" className="mt-4 max-h-48 rounded-xl border border-white/10 object-contain" />}
          <Button className="mt-5 w-full" disabled={busy || !account} onClick={() => void submitPayment()}>{busy ? "جارٍ إرسال الطلب..." : "إرسال إثبات الدفع للمراجعة"}</Button>
          {message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{message}</p>}
        </div>
      </section>
    </div>
  </main>;
}
