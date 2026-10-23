import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signIn, signUp } from "@/lib/auth";
import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";

function messageFor(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    supabase_public_config_missing: "إعدادات Supabase العامة غير متاحة في هذه النسخة.",
    email_already_registered: "هذا البريد مسجل بالفعل. استخدم تسجيل الدخول.",
    invalid_credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    password_too_weak: "كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل مع أرقام.",
    auth_rate_limited: "محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.",
    auth_session_missing: "تم استلام الحساب لكن لم تُنشأ جلسة دخول. راجع إعداد تأكيد البريد في Supabase.",
  };
  return messages[code] || "تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.";
}

export default function AuthPage() {
  const { language } = useAppLanguage();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice(""); setSuccess(false);
    try {
      if (mode === "signup") {
        const result = await signUp(email, password, name);
        if (result.confirmationRequired) {
          setSuccess(true);
          setNotice("تم إنشاء الحساب. إذا طلب Supabase تأكيد البريد، افتح رسالة التأكيد؛ سيُستعاد تسجيل الدخول تلقائيًا عند الرجوع إلى الموقع.");
          return;
        }
      } else {
        await signIn(email, password);
      }
      window.location.replace("/");
    } catch (error) {
      setNotice(messageFor(error));
    } finally {
      setBusy(false);
    }
  }

  return <LocalizedText><main dir={language === "ar" ? "rtl" : "ltr"} className="flex min-h-screen items-center justify-center bg-[#080b10] px-4 py-10 text-white">
    <LanguageToggle />
    <div className="w-full max-w-md">
      <a href="/" className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"><ArrowLeft size={16} /> العودة إلى HotGPT</a>
      <form onSubmit={submit} className="mt-6 rounded-3xl border border-white/10 bg-white/[.04] p-6 shadow-2xl sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><Sparkles size={22} /></div>
        <p className="mt-6 text-xs font-bold tracking-[.25em] text-cyan-300">HOTGPT ACCOUNT</p>
        <h1 className="mt-2 text-2xl font-bold">{mode === "login" ? "مرحبًا بعودتك" : "أنشئ حسابك"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">سجّل الدخول لحفظ محادثاتك ومتابعة رصيدك من أي جهاز.</p>
        {mode === "signup" && <label className="mt-6 block text-sm">الاسم
          <span className="relative mt-2 block"><UserRound className="absolute right-3 top-3.5 text-slate-500" size={17} /><input autoComplete="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pr-10 pl-3 outline-none focus:border-cyan-300" placeholder="اسمك" /></span>
        </label>}
        <label className="mt-5 block text-sm">البريد الإلكتروني
          <span className="relative mt-2 block"><Mail className="absolute right-3 top-3.5 text-slate-500" size={17} /><input type="email" autoComplete="email" required maxLength={320} value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pr-10 pl-3 outline-none focus:border-cyan-300" placeholder="name@example.com" /></span>
        </label>
        <label className="mt-5 block text-sm">كلمة المرور
          <span className="relative mt-2 block"><LockKeyhole className="absolute right-3 top-3.5 text-slate-500" size={17} /><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pr-10 pl-11 outline-none focus:border-cyan-300" placeholder="8 أحرف على الأقل" /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute left-3 top-3.5 text-slate-500" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
        </label>
        {notice && <p role="status" className={`mt-4 rounded-xl border p-3 text-sm leading-6 ${success ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-red-400/20 bg-red-400/10 text-red-200"}`}>{notice}</p>}
        <Button type="submit" disabled={busy} className="mt-6 w-full">{busy ? "جارٍ التنفيذ..." : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}</Button>
        <p className="mt-5 text-center text-sm text-slate-400">{mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"} <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setNotice(""); setSuccess(false); }} className="font-semibold text-cyan-300 hover:text-cyan-200">{mode === "login" ? "إنشاء حساب جديد" : "تسجيل الدخول"}</button></p>
      </form>
    </div>
  </main></LocalizedText>;
}
