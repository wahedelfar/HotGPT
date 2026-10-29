import { useEffect, useMemo, useState } from "react";
import { LanguageToggle } from "@/contexts/LanguageContext";

// AdminLucky — aligned with the spin-game restructure (2026-10-27).
// New tickets (base_tokens = 50): one ticket = one spin; approving grants
// the SPIN (the prize comes from the server-side draw, credited directly
// by the spin itself). Legacy pack orders (base_tokens = 100) keep their
// original buttons and RPC flows.

type Order = {
  id: string; email: string; payment_method: string; status: string;
  currency?: string; amount_minor?: number; amount_label?: string;
  base_tokens?: number; spun_at?: string | null; paypal_auto?: boolean;
  proof_url?: string; prize_label?: string; prize_key?: string; prize_code?: string;
  reward_issued?: boolean; consolation_awarded?: boolean; created_at: string;
};

const METHOD_LABELS: Record<string, string> = { vodafone_cash: "فودافون كاش", instapay: "انستا باي", paypal: "PayPal" };
const STATUS_LABELS: Record<string, string> = { pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض", awaiting_payment: "بانتظار إتمام PayPal" };

function prizeTokens(o: Order): number {
  if (o.prize_key && /^t\d+$/.test(o.prize_key)) return Number(o.prize_key.slice(1));
  if (o.prize_key && /^tokens_\d+$/.test(o.prize_key)) return Number(o.prize_key.replace("tokens_", ""));
  const m = String(o.prize_label || "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}

export default function AdminLuckyPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/admin/lucky?action=list", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error("هذه الصفحة للمسؤولين فقط أو تعذر تحميل الطلبات.");
      setOrders(d.orders || []); setMessage("");
    } catch (e) { setMessage(e instanceof Error ? e.message : "حدث خطأ."); }
  }
  useEffect(() => { void load(); }, []);
  async function action(order: Order, actionName: "approve" | "reject" | "award" | "consolation") {
    if (!window.confirm("تأكيد الإجراء لهذا الطلب؟")) return;
    setBusy(order.id);
    try {
      const r = await fetch("/api/admin/lucky?action=" + actionName + "&id=" + encodeURIComponent(order.id), { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error("تعذر تنفيذ الإجراء.");
      setMessage(d.order?.prize_code ? "تم التأكيد. كود الهدية: " + d.order.prize_code : "تم تنفيذ الإجراء.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "حدث خطأ."); }
    finally { setBusy(""); }
  }
  const shown = orders.filter(o => o.email.toLowerCase().includes(filter.trim().toLowerCase()));
  const totals = useMemo(() => {
    const t = { pendingManual: 0, approvedTickets: 0, egpIn: 0, usdIn: 0, spinsPlayed: 0, tokensOut: 0 };
    for (const o of orders) {
      if (o.status === "pending") t.pendingManual++;
      if (o.status === "approved" && Number(o.base_tokens) === 50) t.approvedTickets++;
      if (o.status === "approved" && o.currency === "EGP") t.egpIn += (Number(o.amount_minor) || 0) / 100;
      if (o.status === "approved" && o.currency === "USD") t.usdIn += (Number(o.amount_minor) || 0) / 100;
      if (o.spun_at) { t.spinsPlayed++; t.tokensOut += prizeTokens(o); }
    }
    return t;
  }, [orders]);
  const spinsLog = useMemo(() => orders.filter(o => !!o.spun_at).slice(0, 30), [orders]);
  const isNewTicket = (o: Order) => Number(o.base_tokens) === 50;

  return <main dir="rtl" className="min-h-screen bg-[#080b10] px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-7xl"><LanguageToggle />
    <a href="/" className="text-sm text-cyan-300">العودة إلى HotGPT</a>
    <div className="mt-6 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black">إدارة HotLucky 🎰</h1><a href="/admin" className="rounded-xl border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">إدارة الأعضاء والتوكينات ←</a></div>
    <p className="mt-2 text-sm text-slate-400">التذكرة الجديدة = لفة واحدة (50 جنيه). الاعتماد يمنح اللفة، والجائزة بتتحدد بسحب الخادم وتتضاف للرصيد لحظة اللف. طلبات الباقة القديمة (100) شغالة بقواعدها الأصلية.</p>
    {message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">{message}</p>}
    <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {[
        { label: "طلبات يدوية معلّقة", value: totals.pendingManual },
        { label: "تذاكر معتمدة (جديدة)", value: totals.approvedTickets },
        { label: "دخل جنيه (معتمد)", value: totals.egpIn + " جنيه" },
        { label: "دخل PayPal (معتمد)", value: "$" + totals.usdIn },
        { label: "لفات اتلعبت", value: totals.spinsPlayed },
        { label: "توكينات خرجت جوائز", value: totals.tokensOut },
      ].map(c => <div key={c.label} className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="text-xs text-slate-400">{c.label}</p><p className="mt-1 text-xl font-black text-amber-200">{c.value}</p></div>)}
    </section>
    <div className="mt-5 flex gap-2"><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="بحث بالبريد" className="w-full rounded-xl border border-white/10 bg-white/5 p-3 md:max-w-md" /><button onClick={() => void load()} className="rounded-xl border border-white/20 px-4">تحديث</button></div>
    <div className="mt-5 space-y-4">{shown.map(o => <article key={o.id} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-5 md:grid-cols-[1fr_240px]">
      <div>
        <h2 className="font-bold">{o.email}</h2>
        <p className="mt-1 text-sm text-slate-400">
          <span className="text-slate-200">{METHOD_LABELS[o.payment_method] || o.payment_method}</span>
          {" · "}{o.amount_label || ""}
          {" · "}<span className={o.status === "pending" ? "text-amber-200" : o.status === "approved" ? "text-emerald-300" : "text-slate-400"}>{STATUS_LABELS[o.status] || o.status}</span>
          {isNewTicket(o) ? <span className="mr-2 rounded-full border border-amber-200/30 bg-amber-200/10 px-2 py-0.5 text-[11px] text-amber-200">تذكرة لفة 🎰</span> : <span className="mr-2 rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-slate-400">باقة قديمة</span>}
          {o.paypal_auto && <span className="mr-2 rounded-full border border-sky-300/30 bg-sky-300/10 px-2 py-0.5 text-[11px] text-sky-200">دفع تلقائي موثّق</span>}
        </p>
        {o.spun_at ? <p className="mt-3 text-sm text-slate-300">🎰 لُعبت في {new Date(o.spun_at).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })} — الجائزة: <strong className="text-amber-200">{o.prize_label}</strong>{isNewTicket(o) ? " (أُضيفت للرصيد تلقائيًا)" : ""}</p>
          : o.prize_label ? <><p className="mt-3 text-lg font-bold text-cyan-200">{o.prize_label}</p>{o.prize_code && <p dir="ltr" className="mt-1 font-mono">{o.prize_code}</p>}</> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {o.status === "pending" && <>{isNewTicket(o)
            ? <button disabled={!!busy} onClick={() => void action(o, "approve")} className="rounded-xl bg-emerald-300 px-4 py-2 font-bold text-slate-950">اعتماد التذكرة 🎰 (منح لفة)</button>
            : <button disabled={!!busy} onClick={() => void action(o, "approve")} className="rounded-xl bg-emerald-300 px-4 py-2 font-bold text-slate-950">تأكيد التحويل + 100 توكين</button>}
            <button disabled={!!busy} onClick={() => void action(o, "reject")} className="rounded-xl border border-red-300/30 px-4 py-2 text-red-200">رفض</button></>}
          {!isNewTicket(o) && o.status === "approved" && o.prize_label && !o.reward_issued && ["tokens_50", "tokens_100", "tokens_200", "tokens_500"].includes(o.prize_key || "") && <button disabled={!!busy} onClick={() => void action(o, "award")} className="rounded-xl bg-cyan-300 px-4 py-2 font-bold text-slate-950">إضافة الهدية لحساب العضو</button>}
          {!isNewTicket(o) && o.status === "approved" && o.prize_label && !o.reward_issued && !["tokens_50", "tokens_100", "tokens_200", "tokens_500"].includes(o.prize_key || "") && <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-200">هذه الهدية تشمل اشتراك Pro/Ultra؛ لن تُعلَّم كمصروفة حتى يتم ربطها بنظام الاشتراكات الفعلي.</p>}
          {!isNewTicket(o) && o.status === "approved" && !o.consolation_awarded && <button disabled={!!busy} onClick={() => void action(o, "consolation")} className="rounded-xl border border-amber-300/30 px-4 py-2 text-amber-200">هدية ترضية 10 توكن</button>}
          {o.reward_issued && !isNewTicket(o) && <span className="text-sm text-emerald-200">أضيفت الهدية للحساب</span>}
          {o.consolation_awarded && <span className="text-sm text-amber-200">تم صرف هدية الترضية</span>}
        </div>
      </div>
      <div>{o.paypal_auto
        ? <div className="flex h-full min-h-32 items-center justify-center rounded-xl border border-sky-300/25 bg-sky-300/5 p-6 text-center text-sm text-sky-200">دفع PayPal تلقائي<br />موثّق من PayPal نفسه ✓<br /><span className="mt-1 text-xs text-slate-400">لا توجد صورة إثبات</span></div>
        : o.proof_url ? <a href={o.proof_url} target="_blank" rel="noreferrer"><img src={o.proof_url} alt="إثبات التحويل" className="max-h-56 w-full rounded-xl bg-black/30 object-contain" /></a>
        : <div className="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-slate-500">صورة الإثبات غير متاحة</div>}
      </div>
    </article>)}{shown.length === 0 && <p className="rounded-xl border border-white/10 p-5 text-slate-400">لا توجد طلبات.</p>}</div>

    <section className="mt-10">
      <h2 className="text-xl font-black">🎰 سجل اللفات الأخيرة</h2>
      {spinsLog.length ? <div className="mt-4 space-y-2">{spinsLog.map(o => <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[.02] px-4 py-3 text-sm"><span>{o.email}</span><span className="font-bold text-amber-200">{o.prize_label}</span><span className="text-xs text-slate-500">{o.spun_at ? new Date(o.spun_at).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" }) : ""}</span></div>)}</div>
        : <p className="mt-3 rounded-xl border border-white/10 p-4 text-sm text-slate-500">لا توجد لفات مسجلة بعد.</p>}
    </section>
  </div></main>;
}
