import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";

const gifts = [
  { label: "50 توكين إضافي", chance: "40%" },
  { label: "100 توكين إضافي", chance: "25%" },
  { label: "200 توكين إضافي", chance: "15%" },
  { label: "Pro لمدة 7 أيام", chance: "10%" },
  { label: "Pro لمدة 30 يومًا", chance: "5%" },
  { label: "500 توكين إضافي", chance: "3%" },
  { label: "Ultra لمدة 30 يومًا", chance: "1.5%" },
  { label: "1000 توكين + Ultra", chance: "0.5%" },
];

export default function LuckyPage() {
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"vodafone_cash" | "paypal">("vodafone_cash");
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [eligible, setEligible] = useState(false);
  const [gift, setGift] = useState("");
  const [giftCode, setGiftCode] = useState("");
  const [paypalUrl, setPaypalUrl] = useState("");
  const [winners, setWinners] = useState<Array<{member:string;prize:string;date:string}>>([]);

  async function refreshStatus() {
    try {
      const response = await authFetch("/api/lucky?action=status", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setEligible(Boolean(data.eligible));
      if (data.prize?.label) { setGift(data.prize.label); setGiftCode(data.prize.code || ""); }
    } catch {}
  }
  useEffect(() => {
    void refreshStatus();
    fetch("/api/lucky?action=config", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => setPaypalUrl(typeof data?.paypalPaymentUrl === "string" ? data.paypalPaymentUrl : "")).catch(() => {});
    fetch("/api/lucky?action=transparency", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => setWinners(Array.isArray(data?.winners) ? data.winners : [])).catch(() => {});
  }, []);

  function readProof(file?: File) {
    setMessage("");
    if (!file) { setProof(""); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 700_000) {
      setMessage("ارفع صورة PNG أو JPG أو WebP بحجم لا يتجاوز 700 كيلوبايت."); return;
    }
    const reader = new FileReader();
    reader.onload = () => setProof(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setMessage("تعذرت قراءة الصورة.");
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!email.trim() || !proof) { setMessage("أدخل بريد حسابك وارفع صورة إثبات التحويل."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await authFetch("/api/lucky?action=submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), paymentMethod: method, screenshotData: proof }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error === "login_required" ? "سجّل الدخول بنفس البريد المرتبط بحساب HotGPT أولًا." : "تعذر إرسال الطلب. تحقق من تسجيل الدخول ثم أعد المحاولة.");
      setMessage("تم إرسال الإثبات للمراجعة. بعد تأكيد الإدارة ستُضاف 100 توكين ويُفتح لك لفّ الهدية المجانية.");
      setProof("");
      void refreshStatus();
    } catch (error) { setMessage(error instanceof Error ? error.message : "حدث خطأ."); }
    finally { setBusy(false); }
  }

  async function spin() {
    setBusy(true); setMessage("");
    try {
      const response = await authFetch("/api/lucky?action=spin", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error === "spin_not_available" ? "لا توجد جولة متاحة لهذا الحساب حتى الآن." : "تعذر تنفيذ الهدية. أعد المحاولة.");
      setGift(data.prize?.label || "تم تسجيل الهدية");
      setGiftCode(data.prize?.code || "");
      setEligible(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "حدث خطأ."); }
    finally { setBusy(false); }
  }

  return <main dir="rtl" className="min-h-screen overflow-hidden bg-[#080b10] px-4 py-8 text-white sm:px-6">
    <div className="mx-auto max-w-5xl">
      <a href="/" className="inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-cyan-200">العودة إلى HotGPT</a>
      <header className="py-10 text-center">
        <div className="mx-auto mb-4 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-bold tracking-widest text-cyan-200">HOTLUCKY · BONUS WHEEL</div>
        <h1 className="text-4xl font-black sm:text-6xl">باقة Hot<span className="text-cyan-300">Lucky</span></h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-300">100 توكين أساسي مضمون + لفّة هدية إضافية مجانية بعد تأكيد الدفع. كل مشارك مؤهل يحصل على هدية واحدة وفق الاحتمالات المعلنة.</p>
        <div className="mx-auto mt-8 flex h-56 w-56 items-center justify-center rounded-full border-[10px] border-cyan-300/70 bg-[conic-gradient(#22d3ee_0_40%,#0e7490_40%_65%,#164e63_65%_80%,#155e75_80%_90%,#334155_90%_100%)] p-4 shadow-[0_0_70px_#0891b244]">
          <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full border border-white/20 bg-[#080b10] text-center"><span className="text-4xl">✦</span><span className="mt-2 font-black">هدية مضمونة</span><span className="text-xs text-slate-400">بعد تأكيد الدفع</span></div>
        </div>
      </header>
      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-cyan-300/25 bg-white/[.035] p-6">
          <p className="text-sm text-cyan-200">الباقة الأساسية</p><div className="mt-2 text-4xl font-black">100 <span className="text-lg font-semibold">توكين</span></div>
          <div className="mt-4 text-2xl font-bold">100 جنيه مصري <span className="text-sm text-slate-400">أو 2 دولار</span></div>
          <p className="mt-2 text-sm leading-6 text-slate-400">المنتج الأساسي معروف وثابت قبل الشراء. الهدية الإضافية مجانية ولا تستبدل الباقة الأساسية.</p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-sm text-slate-300">فودافون كاش</p><p dir="ltr" className="mt-1 text-2xl font-bold tracking-wider text-white">01063537686</p><p className="mt-4 text-sm text-slate-300">PayPal</p>{paypalUrl?<a href={paypalUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-bold text-cyan-200 underline">فتح رابط دفع PayPal الرسمي · 2 دولار</a>:<p className="mt-1 text-sm text-amber-200">غير متاح حتى إضافة HOTLUCKY_PAYPAL_URL في إعدادات Vercel.</p>}</div>
          <label className="mt-5 block text-sm text-slate-300">البريد المرتبط بحساب HotGPT<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300" /></label>
          <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={()=>setMethod("vodafone_cash")} className={`rounded-xl border p-3 text-sm ${method==="vodafone_cash"?"border-cyan-300 bg-cyan-300/10":"border-white/10"}`}>فودافون كاش · 100 جنيه</button><button disabled={!paypalUrl} onClick={()=>setMethod("paypal")} className={`rounded-xl border p-3 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${method==="paypal"?"border-cyan-300 bg-cyan-300/10":"border-white/10"}`}>PayPal · 2 دولار</button></div>
          <label className="mt-4 block text-sm text-slate-300">صورة إثبات التحويل<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>readProof(e.target.files?.[0])} className="mt-2 block w-full text-sm text-slate-400 file:ml-3 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-4 file:py-2 file:font-bold file:text-slate-950" /></label>
          <button disabled={busy} onClick={()=>void submit()} className="mt-5 w-full rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{busy?"جارٍ الإرسال…":"إرسال إثبات الدفع"}</button>
          {message&&<p role="status" className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-200">{message}</p>}
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[.025] p-6"><h2 className="text-2xl font-black">احتمالات الهدايا المعلنة</h2><p className="mt-2 text-sm leading-6 text-slate-400">مجموع الاحتمالات 100%. يتم تحديد الهدية على الخادم مرة واحدة لكل طلب مؤهل.</p>
          <div className="mt-5 space-y-3">{gifts.map((item,i)=><div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 p-3"><span className="text-sm">{item.label}</span><span className="shrink-0 rounded-lg bg-cyan-300/10 px-3 py-1 text-sm font-bold text-cyan-200">{item.chance}</span></div>)}</div>
          <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4 text-sm leading-6 text-emerald-100">شفافية: تأكيد التحويل ومراجعة الإثبات يتمان بواسطة الإدارة. لا يتم اعتبار صورة التحويل وحدها دليلًا نهائيًا على الدفع.</div>
          {eligible&&<button disabled={busy} onClick={()=>void spin()} className="mt-5 w-full rounded-xl bg-emerald-300 p-3 font-black text-slate-950">لفّ عجلة الهدية المجانية</button>}
          {gift&&<div className="mt-5 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-5 text-center"><p className="text-sm text-cyan-200">مبروك! هديتك</p><p className="mt-2 text-2xl font-black">{gift}</p>{giftCode&&<p dir="ltr" className="mt-2 font-mono text-sm text-cyan-200">{giftCode}</p>}<p className="mt-2 text-xs text-slate-400">تُضاف الجوائز إلى الحساب بعد مراجعتها من الإدارة.</p></div>}
          <div className="mt-5 border-t border-white/10 pt-4"><p className="text-sm font-bold text-slate-200">آخر الهدايا المسجلة</p>{winners.length?<div className="mt-3 space-y-2">{winners.map((winner,i)=><div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-black/20 p-3 text-xs"><span>{winner.member}</span><span className="text-cyan-200">{winner.prize}</span></div>)}</div>:<p className="mt-2 text-xs text-slate-500">ستظهر النتائج الحقيقية هنا بعد أول هدية مسجلة.</p>}<p className="mt-3 text-xs leading-6 text-slate-500">موعد الجولة اليومية المقترح: 7 مساءً بتوقيت مصر. تُعرض النتائج المسجلة فقط مع إخفاء البريد الإلكتروني.</p></div>
        </div>
      </section>
    </div>
  </main>;
}
