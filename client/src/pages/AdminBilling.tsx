import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";

type Member = { id: string; name: string | null; email: string | null; role: string; tokenBalance: number; freeAnswersUsed: number; createdAt: string };
type Payment = { id: string; userId: string; email: string; paymentMethod: "vodafone_cash" | "paypal"; packageTokens: number; amountEgp: number; transferReference: string | null; status: "pending" | "approved" | "rejected"; createdAt: string };

function AdminDashboard() {
  const { language } = useAppLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [proofs, setProofs] = useState<Record<string, string>>({});
  const [proofLoadingId, setProofLoadingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [balance, setBalance] = useState("0");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [usersRes, paymentsRes] = await Promise.all([
        fetch("/api/admin/billing?action=users", { cache: "no-store" }),
        fetch("/api/admin/billing?action=payments", { cache: "no-store" }),
      ]);
      if (usersRes.status === 401 || usersRes.status === 403 || paymentsRes.status === 401 || paymentsRes.status === 403) {
        setMessage("الدخول للوحة يتطلب حساب مسؤول (admin). اضبط HOTGPT_ADMIN_EMAILS في Vercel أو امنح حسابك دور admin.");
        return;
      }
      if (!usersRes.ok || !paymentsRes.ok) throw new Error("تعذر تحميل بيانات الإدارة أو قاعدة البيانات.");
      const usersPayload = await usersRes.json();
      const paymentsPayload = await paymentsRes.json();
      setMembers(usersPayload.users ?? []);
      setPayments(paymentsPayload.requests ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ أثناء تحميل اللوحة.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function saveBalance(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(balance);
    if (!email.trim() || !Number.isInteger(parsed) || parsed < 0) { setMessage("أدخل بريدًا صحيحًا ورصيدًا صحيحًا لا يقل عن صفر."); return; }
    setBusyId(-1); setMessage("");
    try {
      const response = await fetch("/api/admin/billing?action=balance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), tokenBalance: parsed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error === "member_not_found" ? "لا يوجد عضو بهذا البريد المسجل." : "تعذر تعديل الرصيد.");
      setMessage(`تم ضبط رصيد ${payload.user.email} إلى ${payload.user.tokenBalance} توكين.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "فشل تعديل الرصيد."); }
    finally { setBusyId(null); }
  }

  async function loadProof(id: string) {
    setProofLoadingId(id);
    try {
      const response = await fetch(`/api/admin/billing?action=proof&id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.proofUrl !== "string") throw new Error("تعذر تحميل صورة إثبات الدفع.");
      setProofs(current => ({ ...current, [id]: payload.proofUrl }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر تحميل الصورة."); }
    finally { setProofLoadingId(null); }
  }

  async function review(payment: Payment, decision: "approve" | "reject") {
    const action = decision === "approve" ? "الموافقة وإضافة التوكينات" : "رفض الطلب";
    if (!window.confirm(`هل تريد ${action} للطلب #${payment.id.slice(0, 8)}؟`)) return;
    setBusyId(payment.id); setMessage("");
    try {
      const response = await fetch(`/api/admin/billing?action=review&id=${encodeURIComponent(payment.id)}&decision=${decision}`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error === "payment_already_reviewed" ? "تمت مراجعة الطلب بالفعل." : "تعذرت مراجعة طلب الدفع.");
      setMessage(decision === "approve" ? `تمت الموافقة وإضافة ${payment.packageTokens} توكين إلى ${payment.email}.` : "تم رفض طلب الدفع.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "فشلت المراجعة."); }
    finally { setBusyId(null); }
  }

  return <LocalizedText><main dir={language === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#080b10] px-4 py-8 text-white sm:px-8">
    <LanguageToggle />
    <div className="mx-auto max-w-7xl">
      <a href="/" className="text-sm text-cyan-300 hover:text-cyan-200">← العودة إلى HotGPT</a>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.25em] text-cyan-300">ADMIN CONSOLE</p><h1 className="mt-2 text-3xl font-bold">إدارة الأعضاء والتوكينات</h1><p className="mt-2 text-sm text-slate-400">ضبط الرصيد مباشرة بالبريد المسجل ومراجعة إثباتات الدفع.</p></div><Button variant="outline" onClick={() => void load()}>تحديث البيانات</Button></div>
      {message && <div role="status" className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">{message}</div>}
      <section className="mt-7 rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <h2 className="text-xl font-bold">تعيين رصيد عضو يدويًا</h2>
        <p className="mt-1 text-sm text-slate-400">القيمة هنا هي الرصيد النهائي، وليست إضافة على الرصيد الحالي.</p>
        <form onSubmit={event => void saveBalance(event)} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="البريد الإلكتروني المسجل" className="rounded-xl border border-white/10 bg-black/30 p-3 outline-none focus:border-cyan-300" />
          <input type="number" min="0" max="10000000" step="1" required value={balance} onChange={event => setBalance(event.target.value)} placeholder="عدد التوكينات" className="rounded-xl border border-white/10 bg-black/30 p-3 outline-none focus:border-cyan-300" />
          <Button type="submit" disabled={busyId === -1}>{busyId === -1 ? "جارٍ الحفظ..." : "حفظ الرصيد"}</Button>
        </form>
      </section>
      <section className="mt-7 rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <h2 className="text-xl font-bold">طلبات الدفع وإثباتات التحويل</h2>
        {loading ? <p className="py-8 text-slate-400">جارٍ تحميل البيانات...</p> : payments.length === 0 ? <p className="py-8 text-slate-400">لا توجد طلبات دفع حتى الآن.</p> :
          <div className="mt-4 grid gap-4 lg:grid-cols-2">{payments.map(payment => <article key={payment.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">طلب #{payment.id.slice(0, 8)} · {payment.packageTokens} توكين</h3><p className="mt-1 text-sm text-slate-400">{payment.email}</p><p className="mt-1 text-sm">{payment.amountEgp} جنيه · {payment.paymentMethod === "vodafone_cash" ? "فودافون كاش" : "PayPal"}</p>{payment.transferReference && <p className="mt-1 text-xs text-slate-400">رقم العملية: {payment.transferReference}</p>}</div><span className={`rounded-full px-3 py-1 text-xs ${payment.status === "pending" ? "bg-amber-300/10 text-amber-200" : payment.status === "approved" ? "bg-emerald-300/10 text-emerald-200" : "bg-red-300/10 text-red-200"}`}>{payment.status === "pending" ? "قيد المراجعة" : payment.status === "approved" ? "تمت الموافقة" : "مرفوض"}</span></div>
            {proofs[payment.id] ? <img src={proofs[payment.id]} alt={`إثبات الدفع للطلب ${payment.id}`} className="mt-4 max-h-80 w-full rounded-lg border border-white/10 bg-black/30 object-contain" /> : <Button variant="outline" className="mt-4" disabled={proofLoadingId === payment.id} onClick={() => void loadProof(payment.id)}>{proofLoadingId === payment.id ? "جارٍ تحميل الصورة..." : "عرض صورة إثبات الدفع"}</Button>}
            {payment.status === "pending" && <div className="mt-4 flex gap-3"><Button disabled={busyId === payment.id} onClick={() => void review(payment, "approve")}>موافقة وإضافة التوكينات</Button><Button variant="outline" disabled={busyId === payment.id} onClick={() => void review(payment, "reject")}>رفض الطلب</Button></div>}
          </article>)}</div>}
      </section>
      <section className="mt-7 rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <h2 className="text-xl font-bold">الأعضاء المسجلون</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-right text-sm"><thead className="text-slate-400"><tr><th className="p-3">العضو</th><th className="p-3">الدور</th><th className="p-3">إجابات مجانية مستخدمة</th><th className="p-3">الرصيد المدفوع</th><th className="p-3">تاريخ التسجيل</th></tr></thead><tbody>{members.map(member => <tr key={member.id} className="border-t border-white/10"><td className="p-3"><div>{member.name || "بدون اسم"}</div><div className="text-xs text-slate-400">{member.email || "لا يوجد بريد"}</div></td><td className="p-3">{member.role}</td><td className="p-3">{member.freeAnswersUsed}/2</td><td className="p-3 font-bold text-cyan-200">{member.tokenBalance}</td><td className="p-3 text-slate-400">{new Date(member.createdAt).toLocaleDateString("ar-EG")}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  </main></LocalizedText>;
}

export default function AdminBillingPage() {
  const { language } = useAppLanguage();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  async function checkSession() {
    try {
      const response = await fetch("/api/admin/auth?action=me", { cache: "no-store" });
      setAuthenticated(response.ok);
    } catch { setAuthenticated(false); }
  }
  useEffect(() => { void checkSession(); }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/auth?action=login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error === "admin_auth_unavailable" ? "قاعدة البيانات أو إعدادات الجلسة غير جاهزة. يلزم تطبيق الترحيل وضبط إعدادات Vercel." : "البريد أو كلمة المرور غير صحيحين.");
      setAuthenticated(true); setPassword(""); setNotice("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر تسجيل الدخول."); }
    finally { setBusy(false); }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/auth?action=password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "تعذر تغيير كلمة المرور.");
      setAuthenticated(false); setCurrentPassword(""); setNewPassword("");
      setNotice("تم تغيير كلمة المرور. سجّل الدخول مجددًا.");
      setShowPasswordForm(false);
    } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر تغيير كلمة المرور."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/admin/auth?action=logout", { method: "POST" });
    setAuthenticated(false);
  }

  if (authenticated === null) return <LocalizedText><main dir={language === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#080b10] p-6 text-white">جارٍ التحقق من جلسة الإدارة...</main></LocalizedText>;
  if (!authenticated) return <LocalizedText><main dir={language === "ar" ? "rtl" : "ltr"} className="flex min-h-screen items-center justify-center bg-[#080b10] px-4 py-10 text-white">
    <LanguageToggle />
    <form onSubmit={login} className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[.04] p-6 shadow-2xl">
      <a href="/" className="text-sm text-cyan-300">← العودة إلى HotGPT</a>
      <p className="mt-7 text-xs font-bold tracking-[.25em] text-cyan-300">HOTGPT ADMIN</p>
      <h1 className="mt-2 text-2xl font-bold">تسجيل دخول الإدارة</h1>
      <p className="mt-2 text-sm text-slate-400">دخول مستقل عن تسجيل دخول أعضاء الموقع.</p>
      <label className="mt-6 block text-sm">البريد الإلكتروني</label>
      <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 outline-none focus:border-cyan-300" />
      <label className="mt-4 block text-sm">كلمة المرور</label>
      <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 outline-none focus:border-cyan-300" />
      {notice && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{notice}</p>}
      <Button type="submit" disabled={busy} className="mt-5 w-full">{busy ? "جارٍ تسجيل الدخول..." : "دخول لوحة الإدارة"}</Button>
    </form>
  </main></LocalizedText>;

  return <LocalizedText><div>
    <div dir={language === "ar" ? "rtl" : "ltr"} className="fixed left-4 top-4 z-20 flex gap-2">
      <Button variant="outline" onClick={() => setShowPasswordForm(v => !v)}>تغيير كلمة المرور</Button>
      <Button variant="outline" onClick={() => void logout()}>تسجيل الخروج</Button>
    </div>
    {showPasswordForm && <form dir={language === "ar" ? "rtl" : "ltr"} onSubmit={changePassword} className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#10151d] p-6 text-white">
        <h2 className="text-xl font-bold">تغيير كلمة مرور الإدارة</h2>
        <label className="mt-4 block text-sm">كلمة المرور الحالية</label>
        <input type="password" required autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3" />
        <label className="mt-4 block text-sm">كلمة المرور الجديدة (10 أحرف على الأقل)</label>
        <input type="password" required minLength={10} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3" />
        {notice && <p className="mt-3 text-sm text-amber-200">{notice}</p>}
        <div className="mt-5 flex gap-2"><Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}</Button><Button type="button" variant="outline" onClick={() => setShowPasswordForm(false)}>إلغاء</Button></div>
      </div>
    </form>}
    <AdminDashboard />
  </div></LocalizedText>;
}
