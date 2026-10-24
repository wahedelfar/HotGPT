import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/auth";
import { Check, Copy, Gift, ShieldCheck, Clock3, Users, Upload, Coins, Sparkles } from "lucide-react";

type Prize = { label: string; chance: string; icon: string; detail: string };
const prizes: Prize[] = [
  { label: "50 توكن إضافي", chance: "40%", icon: "🪙", detail: "رصيد رقمي" },
  { label: "100 توكن إضافي", chance: "25%", icon: "💰", detail: "رصيد رقمي" },
  { label: "200 توكن إضافي", chance: "15%", icon: "💎", detail: "رصيد رقمي" },
  { label: "Pro لمدة 7 أيام", chance: "10%", icon: "⚡", detail: "ميزة اشتراك — عند تفعيل التكامل" },
  { label: "Pro لمدة 30 يومًا", chance: "5%", icon: "👑", detail: "ميزة اشتراك — عند تفعيل التكامل" },
  { label: "500 توكن إضافي", chance: "3%", icon: "🏆", detail: "رصيد رقمي" },
  { label: "Ultra لمدة 30 يومًا", chance: "1.5%", icon: "🌟", detail: "ميزة اشتراك — عند تفعيل التكامل" },
  { label: "1000 توكن + Ultra", chance: "0.5%", icon: "🎁", detail: "رصيد رقمي + ميزة اشتراك" },
];
type Winner = { member: string; prize: string; date?: string };

function getNextRound() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === "hour")?.value || 0);
  const minute = Number(parts.find(p => p.type === "minute")?.value || 0);
  const target = new Date(now.getTime());
  target.setSeconds(0, 0);
  target.setMinutes(target.getMinutes() + (hour < 19 || (hour === 19 && minute === 0) ? 0 : 0));
  // Calculate 19:00 in Egypt timezone by walking to the next matching local time.
  for (let i = 0; i < 48 * 60; i++) {
    const check = new Date(now.getTime() + i * 60_000);
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(check);
    if (Number(p.find(x => x.type === "hour")?.value) === 19 && Number(p.find(x => x.type === "minute")?.value) === 0 && check.getTime() > now.getTime()) return check;
  }
  return target;
}
function countdownText(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds };
}

export default function LuckyPage() {
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"vodafone_cash" | "paypal">("vodafone_cash");
  const [proof, setProof] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [eligible, setEligible] = useState(false);
  const [gift, setGift] = useState("");
  const [giftCode, setGiftCode] = useState("");
  const [paypalUrl, setPaypalUrl] = useState("");
  const [winners, setWinners] = useState<Winner[]>([]);
  const [participants, setParticipants] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const target = useMemo(() => getNextRound(), []);
  const remaining = countdownText(target.getTime() - now);

  async function refreshStatus() {
    try {
      const response = await authFetch("/api/lucky?action=status", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setEligible(Boolean(data.eligible));
      if (typeof data.email === "string") setEmail(data.email);
      if (data.prize?.label) { setGift(data.prize.label); setGiftCode(data.prize.code || ""); }
    } catch {}
  }
  async function loadParticipants() {
    try {
      const r = await fetch("/api/lucky?action=stats", { cache: "no-store" });
      if (r.ok) { const d = await r.json(); if (Number.isFinite(d.participants)) setParticipants(d.participants); }
    } catch {}
  }
  useEffect(() => {
    void refreshStatus();
    void loadParticipants();
    fetch("/api/lucky?action=config", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => setPaypalUrl(typeof data?.paypalPaymentUrl === "string" ? data.paypalPaymentUrl : "")).catch(() => {});
    fetch("/api/lucky?action=transparency", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => setWinners(Array.isArray(data?.winners) ? data.winners : [])).catch(() => {});
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => { void refreshStatus(); void loadParticipants(); }, 30000);
    return () => { window.clearInterval(timer); window.clearInterval(refresh); };
  }, []);

  async function copyNumber() {
    try { await navigator.clipboard.writeText("01063537686"); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setMessage("تعذر النسخ تلقائيًا؛ انسخ الرقم يدويًا: 01063537686"); }
  }
  function readProof(file?: File) {
    setMessage(""); setFileName("");
    if (!file) { setProof(""); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 700_000) {
      setProof(""); setMessage("اختر صورة PNG أو JPG أو WebP بحجم لا يتجاوز 700 كيلوبايت."); return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setProof(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setMessage("تعذرت قراءة الصورة. جرّب ملفًا آخر.");
    reader.readAsDataURL(file);
  }
  async function submit() {
    if (!email.trim() || !proof) { setMessage("تأكد من البريد المرتبط بحسابك واختر صورة إثبات التحويل."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await authFetch("/api/lucky?action=submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), paymentMethod: method, screenshotData: proof }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errors: Record<string,string> = {
          login_required: "سجّل الدخول إلى حساب HotGPT أولًا.",
          paypal_not_configured: "الدفع عبر PayPal قريبًا. اختر فودافون كاش حاليًا.",
          invalid_screenshot: "صيغة الصورة أو حجمها غير صالح.",
          order_create_failed: "تعذر تسجيل الطلب. لم يتم تأكيد الدفع؛ حاول مجددًا لاحقًا.",
        };
        throw new Error(errors[data.error] || "تعذر إرسال الطلب. تحقق من الاتصال وحاول مجددًا.");
      }
      setMessage("تم إرسال إثبات الدفع للمراجعة. بعد تأكيد التحويل، يُضاف المنتج الأساسي (100 توكن) إلى حسابك وتتاح لك الهدية المجانية.");
      setProof(""); setFileName(""); void refreshStatus(); void loadParticipants();
    } catch (error) { setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع."); }
    finally { setBusy(false); }
  }
  async function revealGift() {
    setBusy(true); setMessage("");
    try {
      const response = await authFetch("/api/lucky?action=spin", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error === "spin_not_available" ? "الهدية ستتاح بعد تأكيد الدفع للباقة." : "تعذر تسجيل الهدية. أعد المحاولة.");
      setGift(data.prize?.label || "تم تسجيل هديتك"); setGiftCode(data.prize?.code || ""); setEligible(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "حدث خطأ."); }
    finally { setBusy(false); }
  }

  return <main dir="rtl" className="min-h-screen overflow-hidden bg-[#090909] px-4 pb-14 pt-5 text-white sm:px-6">
    <style>{`
      .hl-gold{color:#f7cf65}.hl-border{border:1px solid rgba(244,194,76,.42)}.hl-card{border:1px solid rgba(244,194,76,.42);background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));border-radius:18px;box-shadow:inset 0 1px rgba(255,255,255,.035)}
      .hl-cta{background:linear-gradient(135deg,#ffe69a,#e5a927);color:#171006;box-shadow:0 8px 28px rgba(226,169,39,.16)}
      .hl-cta:disabled{opacity:.5;cursor:not-allowed}.hl-muted{color:#b7b3a8}.hl-field{width:100%;border:1px solid #494237;border-radius:12px;background:#11100d;padding:12px 14px;color:#fff;outline:none}.hl-field:focus{border-color:#f7cf65}
    `}</style>
    <div className="mx-auto max-w-6xl">
      <nav className="flex items-center justify-between gap-3 border-b border-amber-100/10 pb-4">
        <a href="/" className="text-sm text-amber-100/80 hover:text-white">← العودة إلى HotGPT</a>
        <a href="/lucky-terms" className="text-sm text-amber-200 underline underline-offset-4">الشروط والأحكام</a>
      </nav>
      <header className="py-9 text-center sm:py-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-300/10 px-4 py-2 text-xs font-bold tracking-wide text-amber-200"><Sparkles size={15}/> HOTLUCKY · باقة + هدية ترويجية</div>
        <h1 className="text-3xl font-black leading-tight sm:text-5xl">صندوق قسائم الحظ الكبرى <span className="hl-gold">| HotLucky</span></h1>
        <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-200 sm:text-lg">اشترِ باقة HotLucky بسعر 100 جنيه؛ تحصل على 100 توكن أساسي بعد تأكيد الدفع، ثم يمكنك فتح هديتك الرقمية المجانية المضمونة وفق الشروط المعلنة.</p>
        <div className="mx-auto mt-7 max-w-4xl rounded-2xl border border-amber-300/35 bg-[#14110a] px-4 py-5 sm:px-8">
          <p className="text-sm font-semibold text-amber-100/90">موعد الجولة اليومية: 7 مساءً بتوقيت مصر</p>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-4" aria-label="الوقت المتبقي للجولة">
            {([{n:remaining.days,l:"أيام"},{n:remaining.hours,l:"ساعة"},{n:remaining.minutes,l:"دقيقة"},{n:remaining.seconds,l:"ثانية"}]).map(x=><div key={x.l} className="rounded-xl border border-amber-200/20 bg-black/40 px-1 py-3 sm:py-4"><div className="text-2xl font-black tabular-nums text-amber-200 sm:text-4xl">{String(x.n).padStart(2,"0")}</div><div className="mt-1 text-xs text-slate-400">{x.l}</div></div>)}
          </div>
          <p className="mt-4 text-sm text-slate-300">جارٍ الانضمام للجولة · العدّاد حتى الساعة 7:00 مساءً بتوقيت مصر</p>
        </div>
        <div className="mx-auto mt-5 grid max-w-4xl gap-3 text-right sm:grid-cols-3">
          <div className="hl-card p-4"><p className="text-sm text-slate-400">رسوم الباقة</p><p className="mt-1 text-2xl font-black hl-gold">100 جنيه</p></div>
          <div className="hl-card p-4"><p className="text-sm text-slate-400">الهدية الترويجية</p><p className="mt-1 text-2xl font-black">مشمولة مجانًا</p></div>
          <div className="hl-card p-4"><p className="text-sm text-slate-400">الإجمالي</p><p className="mt-1 text-2xl font-black hl-gold">100 جنيه</p></div>
        </div>
        <p className="mx-auto mt-4 max-w-4xl text-xs leading-6 text-slate-400">لا يُخصم أي مبلغ آليًا من المحفظة. يراجع المسؤول إثبات التحويل يدويًا؛ وبعد التأكيد تُضاف 100 توكن إلى حسابك وتتاح الهدية المجانية.</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm text-slate-300"><Users size={16} className="hl-gold"/>{participants === null ? "جارٍ تحميل عدد المشاركين..." : `${participants} مشتركين حتى الآن في هذه الجولة`}</div>
      </header>

      <section className="mt-4">
        <div className="text-center"><h2 className="text-2xl font-black sm:text-3xl">🏆 جوائز الاشتراكات والرصيد المتاحة</h2><p className="mt-2 text-sm hl-gold">8 فئات هدايا رقمية معلنة 🎁</p><p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-slate-300">هدية رقمية إضافية مضمونة لكل طلب مؤهل، وفق احتمالات معلنة ومجموعها 100%. الجوائز توكنز رقمية أو مزايا اشتراك رقمية، وليست مبالغ نقدية.</p></div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {prizes.map((p,i)=><article key={p.label} className="hl-card flex min-h-40 flex-col items-center justify-center p-4 text-center transition duration-200 hover:-translate-y-1 hover:border-amber-200/80">
            <div className="text-4xl" aria-hidden="true">{p.icon}</div><h3 className="mt-3 text-sm font-extrabold leading-6 sm:text-base">{p.label}</h3><span className="mt-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-xs font-bold text-amber-200">{p.chance}</span><p className="mt-2 text-[11px] leading-5 text-slate-500">{p.detail}</p>
          </article>)}
        </div>
        <p className="mt-4 text-center text-xs leading-6 text-slate-500">توزيع الجوائز يُنفذ على الخادم ويُحفظ في سجل الحساب. مزايا Pro وUltra لا تُعتبر مفعلة حتى يدعمها نظام الاشتراكات الفعلي.</p>
      </section>

      <section className="mt-12">
        <div className="text-center"><h2 className="text-2xl font-black sm:text-3xl">💡 كيف تعمل الباقة؟ (3 خطوات بسيطة)</h2><p className="mt-2 text-sm text-amber-200">واضحة، موثقة، والمنتج الأساسي مضمون</p></div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[{n:"01",icon:"💳",title:"حوّل قيمة الباقة",desc:"حوّل 100 جنيه عبر فودافون كاش 01063537686، أو ادفع 2 دولار عبر PayPal عند إتاحة الرابط الرسمي."},{n:"02",icon:"📩",title:"أرسل إثبات الدفع",desc:"استخدم بريد حساب HotGPT وارفع صورة التحويل. تراجع الإدارة الإثبات قبل اعتماد الطلب."},{n:"03",icon:"🎁",title:"استلم المنتج وافتح الهدية",desc:"بعد تأكيد الدفع، تضاف 100 توكن أولًا إلى حسابك، ثم يمكنك كشف الهدية الرقمية المجانية مرة واحدة."}].map(s=><article key={s.n} className="hl-card p-5"><div className="flex items-center justify-between"><span className="text-xs font-black tracking-widest hl-gold">STEP {s.n}</span><span className="text-3xl">{s.icon}</span></div><h3 className="mt-4 text-lg font-extrabold">{s.title}</h3><p className="mt-2 text-sm leading-7 text-slate-400">{s.desc}</p></article>)}
        </div>
      </section>

      <section id="payment" className="mt-12 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <div className="hl-card p-5 sm:p-7">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-amber-200/10 p-3 text-amber-200"><Upload size={22}/></div><div><h2 className="text-xl font-black">الدفع وإرسال الإثبات</h2><p className="mt-1 text-sm text-slate-400">المنتج الأساسي: 100 توكن بعد اعتماد الدفع</p></div></div>
          <div className="mt-5 rounded-2xl border border-amber-200/20 bg-black/25 p-4"><div className="flex items-center justify-between gap-2"><span className="text-sm text-slate-400">Vodafone Cash</span><button type="button" onClick={()=>void copyNumber()} className="inline-flex items-center gap-2 rounded-lg border border-amber-200/30 px-3 py-2 text-xs text-amber-200">{copied?<Check size={14}/>:<Copy size={14}/>} {copied?"تم النسخ":"نسخ الرقم"}</button></div><p dir="ltr" className="mt-2 text-3xl font-black tracking-wider hl-gold">01063537686</p><p className="mt-2 text-xs leading-5 text-slate-500">حوّل 100 جنيه، ثم ارفع صورة إثبات التحويل في النموذج.</p></div>
          {paypalUrl ? <a href={paypalUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-between rounded-xl border border-amber-200/25 p-4 text-sm hover:bg-amber-200/5"><span>الدفع عبر PayPal · 2 USD</span><span className="hl-gold">فتح رابط الدفع ↗</span></a> : <a href="#" onClick={e=>e.preventDefault()} aria-disabled="true" className="mt-3 flex items-center justify-between rounded-xl border border-white/10 p-4 text-sm text-slate-400"><span>PayPal · 2 USD</span><span>الدفع عبر PayPal قريبًا</span></a>}
          <label className="mt-5 block text-sm font-semibold">البريد الإلكتروني لحسابك<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="hl-field mt-2" autoComplete="email"/></label>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2"><button type="button" onClick={()=>setMethod("vodafone_cash")} className={`rounded-xl border p-3 text-sm font-bold ${method==="vodafone_cash"?"border-amber-200 bg-amber-200/10 text-amber-100":"border-white/10 text-slate-300"}`}>فودافون كاش · 100 جنيه</button><button type="button" disabled={!paypalUrl} onClick={()=>setMethod("paypal")} className={`rounded-xl border p-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${method==="paypal"?"border-amber-200 bg-amber-200/10 text-amber-100":"border-white/10 text-slate-300"}`}>PayPal · 2 دولار</button></div>
          <label className="mt-4 block text-sm font-semibold">صورة إثبات التحويل<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>readProof(e.target.files?.[0])} className="mt-2 block w-full text-sm text-slate-400 file:ml-3 file:rounded-lg file:border-0 file:bg-amber-200 file:px-4 file:py-2 file:font-bold file:text-black"/></label>
          {fileName&&<p className="mt-2 text-xs text-amber-100">الملف المختار: {fileName}</p>}
          <button type="button" disabled={busy} onClick={()=>void submit()} className="hl-cta mt-5 w-full rounded-xl px-5 py-3.5 font-black">{busy?"جارٍ المعالجة…":"إرسال إثبات الدفع"}</button>
          {message&&<p role="status" className="mt-4 rounded-xl border border-amber-100/15 bg-black/25 p-3 text-sm leading-6 text-slate-200">{message}</p>}
          {eligible&&<button type="button" disabled={busy} onClick={()=>void revealGift()} className="hl-cta mt-4 w-full rounded-xl px-5 py-3.5 font-black"><Gift className="ml-2 inline" size={18}/> كشف الهدية المجانية المضمونة</button>}
          {gift&&<div className="mt-5 rounded-2xl border border-amber-200/45 bg-amber-200/[.08] p-5 text-center"><p className="text-sm text-amber-200">مبروك، هديتك المسجلة!</p><p className="mt-2 text-2xl font-black">{gift}</p>{giftCode&&<p dir="ltr" className="mt-3 inline-block rounded-lg border border-amber-100/20 bg-black/30 px-4 py-2 font-mono text-sm text-amber-200">{giftCode}</p>}<p className="mt-3 text-xs text-slate-400">تعرض هذه الرسالة بناءً على الهدية المسجلة في قاعدة البيانات.</p></div>}
          <p className="mt-4 text-xs leading-6 text-slate-500">صورة التحويل مستند للمراجعة البشرية فقط ولا تعني تأكيد الدفع تلقائيًا.</p>
        </div>
        <aside className="space-y-5">
          <div className="hl-card p-5"><div className="flex items-center gap-3"><ShieldCheck className="hl-gold" size={22}/><h2 className="text-lg font-black">شروط مختصرة وواضحة</h2></div><ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300"><li>• المشاركة للبالغين بعمر 18 عامًا فأكثر.</li><li>• المنتج الأساسي 100 توكن، ويُضاف بعد تأكيد الدفع حتى إن لم تُفتح الهدية بعد.</li><li>• الهدية الترويجية رقمية ومضمونة للطلب المؤهل، وليست جائزة نقدية.</li><li>• لكل طلب مؤهل هدية واحدة؛ لا يمكن تكرار الكشف بإعادة تحميل الصفحة.</li></ul><a href="/lucky-terms" className="mt-4 inline-block text-sm font-bold text-amber-200 underline underline-offset-4">قراءة الشروط والأحكام كاملة</a></div>
          <div className="hl-card p-5"><div className="flex items-center gap-3"><Users className="hl-gold" size={22}/><h2 className="text-lg font-black">آخر الهدايا المسجلة</h2></div>{winners.length?<div className="mt-4 space-y-3">{winners.map((w,i)=><div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 p-3"><div><p className="text-sm font-semibold">{w.member}</p>{w.date&&<p className="mt-1 text-[11px] text-slate-500">{new Date(w.date).toLocaleString("ar-EG",{timeZone:"Africa/Cairo"})}</p>}</div><span className="text-left text-xs font-bold text-amber-200">{w.prize}</span></div>)}</div>:<p className="mt-3 text-sm leading-6 text-slate-500">ستظهر الهدايا الحقيقية هنا بعد تسجيلها في قاعدة البيانات. لا تُعرض نتائج وهمية.</p>}</div>
          <div className="hl-card p-5"><div className="flex items-center gap-3"><Clock3 className="hl-gold" size={22}/><h2 className="text-lg font-black">موعد الجولة اليومية</h2></div><p className="mt-2 text-sm leading-7 text-slate-300">7 مساءً بتوقيت مصر (Africa/Cairo). يعتمد التوقيت المرجعي على الخادم، وليس ساعة جهاز المستخدم.</p><div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4"><Coins className="hl-gold" size={21}/><div><p className="font-bold">هدية ترضية: 10 توكن</p><p className="mt-1 text-xs leading-5 text-slate-500">تخضع للأهلية والتسجيل الإداري مرة واحدة للطلب؛ راجع الحالة في لوحة الإدارة.</p></div></div></div>
        </aside>
      </section>
      <footer className="mt-12 border-t border-amber-100/10 pt-6 text-center text-xs leading-6 text-slate-500">HotLucky منتج رقمي ترويجي. لا تُمنح مكافآت نقدية. <a className="text-amber-200 underline" href="/lucky-terms">الشروط والأحكام</a> · <a className="text-amber-200 underline" href="/">HotGPT</a></footer>
    </div>
  </main>;
}
