import { useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/auth";
import { Gift, ShieldCheck, Users, Upload, Coins, Sparkles, Ticket } from "lucide-react";

// HotLucky — spin game (restructured 2026-10-27).
// One ticket = one spin. 50 EGP via Vodafone Cash / InstaPay (proof +
// admin approval) or PayPal bundles (2 spins / $2, 5 spins / $5, granted
// automatically). Prizes are tokens credited directly to the wallet:
// 25 (38%) / 50 (39%) / 75 (13%) / 100 (10%) — no zero prize; the minimum
// returns half the stake. Odds are published here and in the terms.

type PrizeInfo = { tokens: number; chance: string; icon: string; detail: string };
const PRIZES: PrizeInfo[] = [
  { tokens: 25, chance: "38%", icon: "🪙", detail: "نصف قيمة التذكرة — أسوأ نتيجة ممكنة" },
  { tokens: 50, chance: "39%", icon: "🎁", detail: "قيمة التذكرة كاملة" },
  { tokens: 75, chance: "13%", icon: "💰", detail: "مرة ونصف قيمة التذكرة" },
  { tokens: 100, chance: "10%", icon: "💎", detail: "ضعف قيمة التذكرة" },
];
type Winner = { member: string; prize: string; date?: string };
type MyPrize = { label: string; tokens?: number; credited?: boolean; date?: string | null };
type LuckyConfig = {
  vodafoneCashNumber: string; vodafoneCashUrl: string;
  instapayAddress: string; instapayUrl: string;
  spinPriceEgp: number; paypalClientId: string | null; paypalEnabled: boolean;
  paypalBundles: Array<{ spins: number; usd: string }>;
};

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


// Prize wheel geometry: each slice's angle IS its published probability
// (38/39/13/10% -> 136.8/140.4/46.8/36 degrees), so the wheel is honest —
// the big slices are the common prizes. The DRAW still happens on the
// server; the wheel only animates to the slice the server picked.
const WHEEL_SLICES = (() => {
  const defs = [
    { tokens: 25, weight: 38, fill: "#6e1423", text: "#ffe9d6" },
    { tokens: 50, weight: 39, fill: "#9a7418", text: "#fff7e0" },
    { tokens: 75, weight: 13, fill: "#2f4858", text: "#e0f2fe" },
    { tokens: 100, weight: 10, fill: "#f7cf65", text: "#171006" },
  ];
  let acc = 0;
  return defs.map(d => { const start = acc; acc += d.weight * 3.6; return { ...d, start, end: acc, mid: start + d.weight * 1.8 }; });
})();
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}
function wedgePath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}
function PrizeWheel({ rotation, spinning }: { rotation: number; spinning: boolean }) {
  const C = 160, R = 150;
  return (
    <div className="relative mx-auto" style={{ width: "min(82vw, 340px)", height: "min(82vw, 340px)" }}>
      <div aria-hidden="true" style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)", zIndex: 3, width: 0, height: 0, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: "24px solid #f7cf65", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.65))" }} />
      <svg viewBox="0 0 320 320" role="img" aria-label="عجلة جوائز HotLucky" style={{ width: "100%", height: "100%", display: "block", transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4.4s cubic-bezier(0.1, 0.7, 0.08, 1)" : "none" }}>
        <circle cx={C} cy={C} r={158} fill="#0d0b06" stroke="#f7cf65" strokeWidth="3" />
        {WHEEL_SLICES.map(sl => {
          const [tx, ty] = polar(C, C, R * 0.7, sl.mid);
          const [sx, sy] = polar(C, C, R * 0.48, sl.mid);
          return (
            <g key={sl.tokens}>
              <path d={wedgePath(C, C, R, sl.start, sl.end)} fill={sl.fill} stroke="#0d0b06" strokeWidth="2" />
              <text x={tx} y={ty} fill={sl.text} fontSize="23" fontWeight="900" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${sl.mid} ${tx} ${ty})`}>{sl.tokens}</text>
              <text x={sx} y={sy} fill={sl.text} opacity="0.85" fontSize="11" fontWeight="700" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${sl.mid} ${sx} ${sy})`}>توكن</text>
            </g>
          );
        })}
        <circle cx={C} cy={C} r={45} fill="#171006" stroke="#f7cf65" strokeWidth="3" />
        <text x={C} y={C - 2} fill="#f7cf65" fontSize="15" fontWeight="900" textAnchor="middle" dominantBaseline="middle">HotLucky</text>
      </svg>
    </div>
  );
}

export default function LuckyPage() {
  const [config, setConfig] = useState<LuckyConfig | null>(null);
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"vodafone_cash" | "instapay" | "paypal">("vodafone_cash");
  const [bundle, setBundle] = useState<number>(2);
  const [proof, setProof] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [spinCredits, setSpinCredits] = useState(0);
  const [pendingTickets, setPendingTickets] = useState(0);
  const [prizes, setPrizes] = useState<MyPrize[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [lastWin, setLastWin] = useState<{ tokens: number; balance?: number } | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [ticketsSold, setTicketsSold] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState("");
  const paypalRenderedFor = useRef<string>("");

  async function refreshStatus() {
    try {
      const response = await authFetch("/api/lucky?action=status", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setSpinCredits(Number(data.spinCredits) || 0);
      setPendingTickets(Number(data.pendingTickets) || 0);
      setPrizes(Array.isArray(data.prizes) ? data.prizes : []);
      if (typeof data.email === "string" && data.email) setEmail(data.email);
    } catch {}
  }
  async function loadStats() {
    try {
      const r = await fetch("/api/lucky?action=stats", { cache: "no-store" });
      if (r.ok) { const d = await r.json(); if (Number.isFinite(d.participants)) setTicketsSold(d.participants); }
    } catch {}
  }
  useEffect(() => {
    void refreshStatus();
    void loadStats();
    fetch("/api/lucky?action=config", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (data) setConfig(data as LuckyConfig); }).catch(() => {});
    fetch("/api/lucky?action=transparency", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => setWinners(Array.isArray(data?.winners) ? data.winners : [])).catch(() => {});
    const refresh = window.setInterval(() => { void refreshStatus(); void loadStats(); }, 30000);
    return () => { window.clearInterval(refresh); };
  }, []);

  // PayPal buttons for the chosen bundle.
  useEffect(() => {
    if (method !== "paypal" || !config?.paypalEnabled || !config.paypalClientId) return;
    const renderKey = config.paypalClientId + "|" + bundle;
    if (paypalRenderedFor.current === renderKey) return;
    let alive = true;
    void loadPaypalSdk(config.paypalClientId).then((paypal) => {
      if (!alive || !paypal?.Buttons) return;
      const container = document.getElementById("hotlucky-paypal-buttons");
      if (!container) return;
      container.innerHTML = "";
      paypalRenderedFor.current = renderKey;
      paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "pill", label: "paypal" },
        createOrder: async () => {
          const response = await authFetch("/api/lucky?action=paypal-create", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spins: bundle }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.orderId) throw new Error(data.error || "paypal_create_failed");
          return data.orderId;
        },
        onApprove: async (data: any) => {
          setBusy(true); setMessage("");
          try {
            const response = await authFetch("/api/lucky?action=paypal-capture", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderID }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "capture_failed");
            setMessage(`تم الدفع بنجاح — أُضيفت ${Number(payload.spins) || bundle} لفة إلى حسابك. العبها من قسم «لفّاتي» بالأعلى!`);
            void refreshStatus(); void loadStats();
          } catch (error) {
            setMessage("تعذر تأكيد دفعة PayPal. لو اتخصم المبلغ فعلًا، لا تكرر الدفع — تواصل مع الإدارة وسيتم التحقق.");
          } finally { setBusy(false); }
        },
        onError: () => { setMessage("حدث خطأ في PayPal. حاول مجددًا أو اختر وسيلة دفع أخرى."); },
      }).render("#hotlucky-paypal-buttons");
    });
    return () => { alive = false; };
  }, [method, bundle, config]);

  async function copyValue(key: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopiedKey(key); window.setTimeout(() => setCopiedKey(""), 1800); }
    catch { setMessage("تعذر النسخ تلقائيًا؛ انسخ القيمة يدويًا: " + value); }
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
        const errors: Record<string, string> = {
          login_required: "سجّل الدخول إلى حساب HotGPT أولًا.",
          invalid_screenshot: "صيغة الصورة أو حجمها غير صالح.",
          invalid_order: "بيانات الطلب غير صحيحة — تأكد أن البريد هو بريد حسابك.",
          order_create_failed: "تعذر تسجيل الطلب. حاول مجددًا لاحقًا.",
        };
        throw new Error(errors[data.error] || "تعذر إرسال الطلب. تحقق من الاتصال وحاول مجددًا.");
      }
      setMessage("تم إرسال إثبات الدفع. بعد موافقة الإدارة هتلاقي اللفة جاهزة في قسم «لفّاتي» — عادةً خلال ساعات.");
      setProof(""); setFileName(""); void refreshStatus(); void loadStats();
    } catch (error) { setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع."); }
    finally { setBusy(false); }
  }
  async function spin() {
    if (spinCredits <= 0 || spinning) return;
    setSpinning(true); setMessage(""); setLastWin(null);
    try {
      // The server draws FIRST; the wheel then animates to the winning
      // slice and the prize is revealed when the wheel stops.
      const response = await authFetch("/api/lucky?action=spin", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error === "spin_not_available" ? "لا توجد لفات جاهزة. لو دفعت يدويًا، انتظر موافقة الإدارة." : "تعذر تنفيذ اللفة. أعد المحاولة.");
      const prizeTokens = Number(data.prize?.tokens) || 0;
      const slice = WHEEL_SLICES.find(x => x.tokens === prizeTokens) || WHEEL_SLICES[0];
      const land = slice.start + (slice.end - slice.start) * (0.3 + Math.random() * 0.4);
      const targetMod = ((360 - land) % 360 + 360) % 360;
      setWheelRotation(prev => {
        const cur = ((prev % 360) + 360) % 360;
        const delta = (targetMod - cur + 360) % 360;
        return prev + 360 * 6 + delta;
      });
      await new Promise(r => setTimeout(r, 4550));
      setLastWin({ tokens: prizeTokens, balance: typeof data.tokenBalance === "number" ? data.tokenBalance : undefined });
      if (typeof data.spinCredits === "number") setSpinCredits(data.spinCredits); else void refreshStatus();
      void loadStats();
    } catch (error) { setMessage(error instanceof Error ? error.message : "حدث خطأ."); }
    finally { setSpinning(false); }
  }

  const price = config?.spinPriceEgp ?? 50;

  return <main dir="rtl" className="min-h-screen overflow-hidden bg-[#090909] px-4 pb-14 pt-5 text-white sm:px-6">
    <style>{`
      .hl-gold{color:#f7cf65}.hl-card{border:1px solid rgba(244,194,76,.42);background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));border-radius:18px;box-shadow:inset 0 1px rgba(255,255,255,.035)}
      .hl-cta{background:linear-gradient(135deg,#ffe69a,#e5a927);color:#171006;box-shadow:0 8px 28px rgba(226,169,39,.16)}
      .hl-cta:disabled{opacity:.5;cursor:not-allowed}.hl-field{width:100%;border:1px solid #494237;border-radius:12px;background:#11100d;padding:12px 14px;color:#fff;outline:none}.hl-field:focus{border-color:#f7cf65}
      @keyframes hl-spin-pulse{0%{transform:scale(1)}50%{transform:scale(1.06) rotate(2deg)}100%{transform:scale(1)}}
      .hl-spinning{animation:hl-spin-pulse .45s ease-in-out infinite}
      @keyframes hl-pop{0%{transform:scale(.7);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
      .hl-pop{animation:hl-pop .45s ease-out}
    `}</style>
    <div className="mx-auto max-w-6xl">
      <nav className="flex items-center justify-between gap-3 border-b border-amber-100/10 pb-4">
        <a href="/" className="text-sm text-amber-100/80 hover:text-white">← العودة إلى HotGPT</a>
        <a href="/lucky-terms" className="text-sm text-amber-200 underline underline-offset-4">الشروط والأحكام</a>
      </nav>

      <header className="py-9 text-center sm:py-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-300/10 px-4 py-2 text-xs font-bold tracking-wide text-amber-200"><Sparkles size={15} /> HOTLUCKY · لعبة لفّات الحظ</div>
        <h1 className="text-3xl font-black leading-tight sm:text-5xl">لفّ واكسب توكنات <span className="hl-gold">| HotLucky</span></h1>
        <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-200 sm:text-lg">اللفة بـ {price} جنيه أو بدولار عبر باقات PayPal. الجوائز من 25 لـ 100 توكن تُضاف لرصيدك فورًا بعد اللفة — <strong className="text-amber-200">ومفيش جائزة صفرية</strong>: أقل نتيجة بترجعلك نص قيمة التذكرة.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm text-slate-300"><Users size={16} className="hl-gold" />{ticketsSold} تذكرة مشاركة حتى الآن</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm text-slate-300"><Coins size={16} className="hl-gold" />متوسط العائد المعلن: 48.75 توكن لكل لفة</span>
        </div>
      </header>

      <section aria-label="الجوائز">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PRIZES.map(p => <article key={p.tokens} className="hl-card flex min-h-40 flex-col items-center justify-center p-4 text-center transition duration-200 hover:-translate-y-1 hover:border-amber-200/80">
            <div className="text-4xl" aria-hidden="true">{p.icon}</div>
            <h3 className="mt-3 text-base font-extrabold leading-6">{p.tokens} توكن</h3>
            <span className="mt-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-xs font-bold text-amber-200">احتمال {p.chance}</span>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">{p.detail}</p>
          </article>)}
        </div>
        <p className="mt-4 text-center text-xs leading-6 text-slate-500">الاحتمالات منشورة بالكامل هنا وفي <a className="text-amber-200 underline" href="/lucky-terms">الشروط والأحكام</a>، ومجموعها 100%. السحب يتم على الخادم ونتيجته نهائية ومسجلة في حسابك.</p>
      </section>

      <section className="hl-card mt-10 p-5 text-center sm:p-8" aria-label="لفاتي">
        <div className="flex items-center justify-center gap-3"><Ticket className="hl-gold" size={24} /><h2 className="text-2xl font-black">لفّاتي</h2></div>
        <p className="mt-3 text-sm leading-7 text-slate-300">عندك <strong className="text-2xl font-black text-amber-200">{spinCredits}</strong> لفة جاهزة{pendingTickets > 0 ? <>، و{pendingTickets} تذكرة في انتظار الاعتماد</> : ""}.</p>
        <div className="relative mt-6">
          <PrizeWheel rotation={wheelRotation} spinning={spinning} />
          <button type="button" disabled={spinCredits <= 0 || spinning} onClick={() => void spin()} aria-label="لفّ العجلة" className="hl-cta" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 78, height: 78, borderRadius: "50%", fontWeight: 900, fontSize: 16, zIndex: 4 }}>
            {spinning ? "…" : "لفّ 🎰"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">دوس على قلب العجلة — هتلف وتقف على جائزتك. أحجام الخانات هي نفس الاحتمالات المعلنة بالظبط.</p>
        {spinCredits <= 0 && !spinning && <p className="mt-3 text-xs text-slate-500">اشتري تذكرة من قسم الدفع بالأسفل — اليدوي بيظهر بعد موافقة الإدارة، و PayPal فوري.</p>}
        {lastWin && <div className="hl-pop mx-auto mt-6 max-w-md rounded-2xl border border-amber-200/50 bg-amber-200/[.09] p-5">
          <p className="text-sm text-amber-200">🎉 مبروك! كسبت</p>
          <p className="mt-1 text-4xl font-black">{lastWin.tokens} توكن</p>
          <p className="mt-2 text-xs text-slate-400">أُضيفت إلى رصيدك فورًا{typeof lastWin.balance === "number" ? ` — رصيدك الآن ${lastWin.balance} توكن` : ""}.</p>
        </div>}
      </section>

      <section className="mt-12">
        <div className="text-center"><h2 className="text-2xl font-black sm:text-3xl">💡 كيف تلعب؟ (3 خطوات)</h2></div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[{ n: "01", icon: "💳", title: "اشتري تذكرة لفة", desc: `حوّل ${price} جنيه عبر فودافون كاش أو انستا باي وارفع الإثبات، أو ادفع عبر PayPal (لفتين $2 أو خمسة $5) وتوصلك اللفات فورًا.` }, { n: "02", icon: "✅", title: "الاعتماد", desc: "الدفع اليدوي بتراجعه الإدارة وبيظهر في «لفّاتي» بعد الموافقة. دفع PayPal موثّق تلقائيًا من غير انتظار." }, { n: "03", icon: "🎰", title: "لفّ واستلم جائزتك", desc: "دوس على قلب العجلة — السحب على الخادم بالاحتمالات المعلنة، والعجلة بتقف على جائزتك وبتنزل في رصيدك في نفس اللحظة." }].map(s => <article key={s.n} className="hl-card p-5"><div className="flex items-center justify-between"><span className="text-xs font-black tracking-widest hl-gold">STEP {s.n}</span><span className="text-3xl">{s.icon}</span></div><h3 className="mt-4 text-lg font-extrabold">{s.title}</h3><p className="mt-2 text-sm leading-7 text-slate-400">{s.desc}</p></article>)}
        </div>
      </section>

      <section id="payment" className="mt-12 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <div className="hl-card p-5 sm:p-7">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-amber-200/10 p-3 text-amber-200"><Upload size={22} /></div><div><h2 className="text-xl font-black">شراء تذكرة لفة — {price} جنيه</h2><p className="mt-1 text-sm text-slate-400">اختر وسيلة الدفع</p></div></div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setMethod("vodafone_cash")} className={`rounded-xl border p-3 text-sm font-bold ${method === "vodafone_cash" ? "border-red-300 bg-red-400/10 text-red-100" : "border-white/10 text-slate-300"}`}>📱 فودافون كاش</button>
            <button type="button" onClick={() => setMethod("instapay")} className={`rounded-xl border p-3 text-sm font-bold ${method === "instapay" ? "border-blue-300 bg-blue-400/10 text-blue-100" : "border-white/10 text-slate-300"}`}>🏦 انستا باي</button>
            <button type="button" disabled={!config?.paypalEnabled} onClick={() => setMethod("paypal")} className={`rounded-xl border p-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${method === "paypal" ? "border-sky-300 bg-sky-400/10 text-sky-100" : "border-white/10 text-slate-300"}`}>💲 PayPal</button>
          </div>

          {method === "vodafone_cash" && <div className="mt-5">
            <a href={config?.vodafoneCashUrl ?? "https://vf.eg/vfcash?id=mt&qrId=G0gO2O"} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#e60000] px-5 py-3.5 text-center font-black text-white transition hover:brightness-110">ادفع الآن — يفتح تطبيق فودافون كاش ↗</a>
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">أو حوّل يدويًا إلى الرقم:</span><strong dir="ltr" className="text-base tracking-wide">{config?.vodafoneCashNumber ?? "01063537686"}</strong><button type="button" onClick={() => void copyValue("vf", config?.vodafoneCashNumber ?? "01063537686")} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "vf" ? "تم النسخ ✓" : "نسخ الرقم"}</button></div>
          </div>}
          {method === "instapay" && <div className="mt-5">
            <a href={config?.instapayUrl ?? "https://ipn.eg/S/wahedelfar1/instapay/5hwGuZ"} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#1d4ed8] px-5 py-3.5 text-center font-black text-white transition hover:brightness-110">ادفع الآن — يفتح تطبيق انستا باي ↗</a>
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span className="text-slate-400">أو حوّل يدويًا إلى العنوان:</span><strong dir="ltr" className="text-base tracking-wide">{config?.instapayAddress ?? "wahedelfar1@instapay"}</strong><button type="button" onClick={() => void copyValue("ip", config?.instapayAddress ?? "wahedelfar1@instapay")} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10">{copiedKey === "ip" ? "تم النسخ ✓" : "نسخ العنوان"}</button></div>
          </div>}

          {method !== "paypal" && <>
            <label className="mt-5 block text-sm font-semibold">البريد الإلكتروني لحسابك<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="hl-field mt-2" autoComplete="email" /></label>
            <label className="mt-4 block text-sm font-semibold">صورة إثبات التحويل<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => readProof(e.target.files?.[0])} className="mt-2 block w-full text-sm text-slate-400 file:ml-3 file:rounded-lg file:border-0 file:bg-amber-200 file:px-4 file:py-2 file:font-bold file:text-black" /></label>
            {fileName && <p className="mt-2 text-xs text-amber-100">الملف المختار: {fileName}</p>}
            <button type="button" disabled={busy} onClick={() => void submit()} className="hl-cta mt-5 w-full rounded-xl px-5 py-3.5 font-black">{busy ? "جارٍ المعالجة…" : `إرسال إثبات الدفع (${price} جنيه)`}</button>
            <p className="mt-3 text-xs leading-6 text-slate-500">صورة التحويل مستند للمراجعة البشرية فقط ولا تعني تأكيد الدفع تلقائيًا. كل تحويل معتمد = تذكرة لفة واحدة.</p>
          </>}

          {method === "paypal" && <div className="mt-5">
            <p className="text-sm font-semibold">اختر الباقة (رسوم PayPal الثابتة خلت اللفة الواحدة غير عملية — الباقات أوفر لك):</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(config?.paypalBundles ?? [{ spins: 2, usd: "2.00" }, { spins: 5, usd: "5.00" }]).map(b => <button key={b.spins} type="button" onClick={() => { setBundle(b.spins); paypalRenderedFor.current = ""; }} className={`rounded-xl border p-3 text-sm font-bold ${bundle === b.spins ? "border-sky-300 bg-sky-400/10 text-sky-100" : "border-white/10 text-slate-300"}`}>{b.spins} لفات · ${Number(b.usd).toFixed(0)}</button>)}
            </div>
            <div id="hotlucky-paypal-buttons" className="mt-4 min-h-[100px]">
              {!config?.paypalEnabled && <p className="text-sm text-slate-500">PayPal غير مفعّل حاليًا.</p>}
            </div>
            <p className="mt-2 text-xs leading-6 text-slate-500">الدفع عبر PayPal موثّق تلقائيًا واللفات بتظهر في «لفّاتي» فور إتمام الدفع.</p>
          </div>}

          {message && <p role="status" className="mt-4 rounded-xl border border-amber-100/15 bg-black/25 p-3 text-sm leading-6 text-slate-200">{message}</p>}
        </div>

        <aside className="space-y-5">
          <div className="hl-card p-5"><div className="flex items-center gap-3"><Gift className="hl-gold" size={22} /><h2 className="text-lg font-black">جوائزي</h2></div>
            {prizes.length ? <div className="mt-4 space-y-3">{prizes.slice(0, 8).map((p, i) => <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 p-3"><div><p className="text-sm font-semibold">{p.label}</p>{p.date && <p className="mt-1 text-[11px] text-slate-500">{new Date(p.date).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}</p>}</div>{p.credited ? <span className="text-xs font-bold text-emerald-300">أُضيفت لرصيدك ✓</span> : null}</div>)}</div> : <p className="mt-3 text-sm leading-6 text-slate-500">لسه معندكش جوائز — أول لفة مستنياك.</p>}
          </div>
          <div className="hl-card p-5"><div className="flex items-center gap-3"><ShieldCheck className="hl-gold" size={22} /><h2 className="text-lg font-black">شروط مختصرة وواضحة</h2></div><ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300"><li>• اللعب للبالغين 18+ فقط.</li><li>• التذكرة = لفة واحدة؛ الجوائز توكنات رقمية تُضاف للرصيد، وليست نقودًا ولا تُستبدل نقدًا.</li><li>• أقل جائزة 25 توكن (نصف القيمة) — لا توجد نتيجة صفرية.</li><li>• السحب يتم على الخادم بالاحتمالات المعلنة ونتيجته نهائية.</li></ul><a href="/lucky-terms" className="mt-4 inline-block text-sm font-bold text-amber-200 underline underline-offset-4">قراءة الشروط والأحكام كاملة</a></div>
          <div className="hl-card p-5"><div className="flex items-center gap-3"><Users className="hl-gold" size={22} /><h2 className="text-lg font-black">آخر الجوائز المسجلة</h2></div>{winners.length ? <div className="mt-4 space-y-3">{winners.map((w, i) => <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 p-3"><div><p className="text-sm font-semibold">{w.member}</p>{w.date && <p className="mt-1 text-[11px] text-slate-500">{new Date(w.date).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}</p>}</div><span className="text-left text-xs font-bold text-amber-200">{w.prize}</span></div>)}</div> : <p className="mt-3 text-sm leading-6 text-slate-500">ستظهر الجوائز الحقيقية هنا بعد تسجيلها. لا تُعرض نتائج وهمية.</p>}</div>
        </aside>
      </section>
      <footer className="mt-12 border-t border-amber-100/10 pt-6 text-center text-xs leading-6 text-slate-500">HotLucky لعبة ترويجية رقمية. الجوائز توكنات داخل المنصة فقط. <a className="text-amber-200 underline" href="/lucky-terms">الشروط والأحكام</a> · <a className="text-amber-200 underline" href="/">HotGPT</a></footer>
    </div>
  </main>;
}
