import { useEffect, useState } from "react";

type Order = { id: string; email: string; payment_method: string; status: string; proof_url?: string; prize_label?: string; prize_code?: string; reward_issued?: boolean; consolation_awarded?: boolean; created_at: string };

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
      const r = await fetch("/api/admin/lucky?action="+actionName+"&id="+encodeURIComponent(order.id), { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error("تعذر تنفيذ الإجراء.");
      setMessage(d.order?.prize_code ? "تم التأكيد. كود الهدية: "+d.order.prize_code : "تم تنفيذ الإجراء.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "حدث خطأ."); }
    finally { setBusy(""); }
  }
  const shown = orders.filter(o => o.email.toLowerCase().includes(filter.trim().toLowerCase()));
  return <main dir="rtl" className="min-h-screen bg-[#080b10] px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-7xl">
    <a href="/" className="text-sm text-cyan-300">العودة إلى HotGPT</a><h1 className="mt-6 text-3xl font-black">إدارة HotLucky</h1><p className="mt-2 text-sm text-slate-400">راجع إثبات التحويل يدويًا قبل اعتماد الطلب.</p>
    {message&&<p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">{message}</p>}
    <div className="mt-5 flex gap-2"><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="بحث بالبريد" className="w-full rounded-xl border border-white/10 bg-white/5 p-3 md:max-w-md"/><button onClick={()=>void load()} className="rounded-xl border border-white/20 px-4">تحديث</button></div>
    <div className="mt-5 space-y-4">{shown.map(o=><article key={o.id} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-5 md:grid-cols-[1fr_240px]">
      <div><h2 className="font-bold">{o.email}</h2><p className="mt-1 text-sm text-slate-400">{o.payment_method} · {o.status}</p>{o.prize_label&&<p className="mt-3 text-lg font-bold text-cyan-200">{o.prize_label}</p>}{o.prize_code&&<p dir="ltr" className="mt-1 font-mono">{o.prize_code}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{o.status==="pending"&&<><button disabled={!!busy} onClick={()=>void action(o,"approve")} className="rounded-xl bg-emerald-300 px-4 py-2 font-bold text-slate-950">تأكيد التحويل + 100 توكين</button><button disabled={!!busy} onClick={()=>void action(o,"reject")} className="rounded-xl border border-red-300/30 px-4 py-2 text-red-200">رفض</button></>}{o.status==="approved"&&o.prize_label&&!o.reward_issued&&<button disabled={!!busy} onClick={()=>void action(o,"award")} className="rounded-xl bg-cyan-300 px-4 py-2 font-bold text-slate-950">إضافة الهدية لحساب العضو</button>}{o.status==="approved"&&!o.consolation_awarded&&<button disabled={!!busy} onClick={()=>void action(o,"consolation")} className="rounded-xl border border-amber-300/30 px-4 py-2 text-amber-200">هدية ترضية 10 توكن</button>}{o.reward_issued&&<span className="text-sm text-emerald-200">أضيفت الهدية للحساب</span>}{o.consolation_awarded&&<span className="text-sm text-amber-200">تم صرف هدية الترضية</span>}</div></div>
      <div>{o.proof_url?<a href={o.proof_url} target="_blank" rel="noreferrer"><img src={o.proof_url} alt="إثبات التحويل" className="max-h-56 w-full rounded-xl object-contain bg-black/30"/></a>:<div className="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-slate-500">صورة الإثبات غير متاحة</div>}</div>
    </article>)}{shown.length===0&&<p className="rounded-xl border border-white/10 p-5 text-slate-400">لا توجد طلبات.</p>}</div>
  </div></main>;
}
