import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readSession, signIn, signInWithGoogle, signUp } from "@/lib/auth";
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
  const [mode, setMode] = useState<"login" | "signup">(() => new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login");
  // Invite code shown on the form: from this link's ?ref= first, else the
  // code stored when an invite link was opened earlier. Always the code
  // from the visitor's own link — never a fixed value.
  const [inviteCode] = useState(() => {
    try {
      const fromUrl = (new URLSearchParams(window.location.search).get("ref") || "").trim().toUpperCase();
      if (/^[A-Za-z0-9]{6,12}$/.test(fromUrl)) return fromUrl;
      const stored = (localStorage.getItem("hotgpt-ref-code") || "").trim().toUpperCase();
      return /^[A-Za-z0-9]{6,12}$/.test(stored) ? stored : "";
    } catch { return ""; }
  });
  const [recoveryAccessToken] = useState(() => { const hash = new URLSearchParams(window.location.hash.replace(/^#/, "")); return hash.get("type") === "recovery" ? hash.get("access_token") || "" : ""; });
  const [recoveryRefreshToken] = useState(() => { const hash = new URLSearchParams(window.location.hash.replace(/^#/, "")); return hash.get("type") === "recovery" ? hash.get("refresh_token") || "" : ""; });
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [recoveryMode] = useState(() => { const hash = new URLSearchParams(window.location.hash.replace(/^#/, "")); return hash.get("type") === "recovery" && Boolean(hash.get("access_token")); });
  // Google OAuth return: signInWithGoogle() marked sessionStorage before
  // leaving. On return, main.tsx's consumeAuthRedirect has already stored
  // any session from the hash — here we only hand off to "/" on success,
  // or surface the failure in the notice below. Recovery hashes are not
  // OAuth returns and are left to the recovery flow above.
  const [oauthReturn] = useState(() => {
    try {
      const pending = sessionStorage.getItem("hotgpt-oauth-pending") === "1";
      if (pending) sessionStorage.removeItem("hotgpt-oauth-pending");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const failed = pending && Boolean(hash.get("error") || hash.get("error_description"));
      if (failed) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      } else if (pending && readSession()) {
        window.location.replace("/");
      }
      return { failed };
    } catch { return { failed: false }; }
  });
  const [forgotPasswordBusy, setForgotPasswordBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(() => {
    try {
      if (sessionStorage.getItem("hotgpt-auth-link-notice") === "expired") {
        sessionStorage.removeItem("hotgpt-auth-link-notice");
        return "الرابط اللي فتحته انتهى أو استُخدم من قبل. لو كنت بتفعّل حسابك جرّب تسجيل الدخول عادي، ولو كنت بتعيّن كلمة مرور جديدة اطلب رابطًا جديدًا من «نسيت كلمة المرور؟».";
      }
    } catch {}
    if (oauthReturn.failed) return "اتلغى تسجيل الدخول بـ Google أو حصلت مشكلة أثناءه — جرّب تاني أو ادخل بالإيميل وكلمة المرور.";
    return "";
  });
  const [success, setSuccess] = useState(false);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);

  async function requestPasswordReset() {
    if (!email.trim()) { setSuccess(false); setNotice("اكتب بريدك الإلكتروني أولًا، ثم اضغط «نسيت كلمة المرور؟» مرة أخرى."); return; }
    setForgotPasswordBusy(true); setNotice(""); setSuccess(false);
    try {
      const config = window.__MANUS_CONFIG__;
      const url = (config?.supabaseUrl || "").replace(/\/+$/, "");
      const key = config?.supabaseAnonKey || "";
      if (!url || !key) throw new Error("supabase_public_config_missing");
      const response = await fetch(`${url}/auth/v1/recover`, {
        method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), redirect_to: window.location.origin + "/auth" }), cache: "no-store",
      });
      if (!response.ok) throw new Error("auth_request_failed");
      setSuccess(true);
      setNotice("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني — افتح الرسالة واضغط الرابط لتعيين كلمة مرور جديدة.");
    } catch { setSuccess(false); setNotice("تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى."); }
    finally { setForgotPasswordBusy(false); }
  }

  async function submitPasswordRecovery(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(""); setSuccess(false);
    try {
      if (newPassword !== confirmNewPassword) { setNotice("كلمتا المرور غير متطابقتين."); return; }
      const config = window.__MANUS_CONFIG__;
      const url = (config?.supabaseUrl || "").replace(/\/+$/, "");
      const key = config?.supabaseAnonKey || "";
      if (!url || !key || !recoveryAccessToken) throw new Error("auth_request_failed");
      const response = await fetch(`${url}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: key, "Content-Type": "application/json", Authorization: `Bearer ${recoveryAccessToken}` },
        body: JSON.stringify({ password: newPassword }), cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errCode = String(payload.code || payload.error_code || "");
        const errMsg = String(payload.msg || payload.error_description || payload.message || "");
        if (errCode === "same_password" || /different from the old/i.test(errMsg)) {
          setNotice("كلمة المرور الجديدة هي نفس كلمة المرور الحالية — اختر كلمة مرور مختلفة عن الحالية.");
        } else if (errCode === "weak_password") {
          setNotice("كلمة المرور يجب أن تكون 8 أحرف على الأقل، وتحتوي على حرف كبير ورقم ورمز.");
        } else {
          setNotice(errMsg || "تعذّر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.");
        }
        return;
      }
      if (recoveryRefreshToken) {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const expiresAt = Number(hash.get("expires_at") || (Math.floor(Date.now() / 1000) + Number(hash.get("expires_in") || 3600)));
        localStorage.setItem("hotgpt.supabase.session", JSON.stringify({ access_token: recoveryAccessToken, refresh_token: recoveryRefreshToken, expires_at: expiresAt, token_type: hash.get("token_type") || "bearer", user: payload }));
      }
      setSuccess(true); setNotice("تم تعيين كلمة المرور الجديدة بنجاح.");
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      window.setTimeout(() => window.location.replace("/"), 1200);
    } catch { setSuccess(false); setNotice("تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى."); }
    finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    if (recoveryMode) { await submitPasswordRecovery(event); return; }
    event.preventDefault();
    setBusy(true); setNotice(""); setSuccess(false); setEmailConfirmationRequired(false);
    try {
      if (mode === "signup") {
        const result = await signUp(email, password, name);
        if (result.confirmationRequired) {
          setSuccess(true);
          setNotice("تم إنشاء حسابك! 🎉 أرسلنا رابط تأكيد إلى بريدك الإلكتروني — افتح الرسالة واضغط الرابط لتفعيل حسابك والدخول مباشرة.");
          return;
        }
      } else {
        await signIn(email, password);
      }
      try { sessionStorage.setItem("hotgpt-welcome-pending", "1"); } catch {}
      window.location.replace("/");
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : String(error ?? "");
      if (mode === "login" && /email not confirmed|email_not_confirmed/i.test(errorCode)) {
        setEmailConfirmationRequired(true);
        setNotice("حسابك لسه مش مفعّل — فعّل حسابك من رسالة التأكيد اللي وصلتك على بريدك الإلكتروني، وبعدها سجّل دخولك عادي.");
      } else {
        setNotice(messageFor(error));
      }
    } finally {
      setBusy(false);
    }
  }


  async function resendConfirmation() {
    setResendingConfirmation(true);
    try {
      const config = window.__MANUS_CONFIG__;
      const url = (config?.supabaseUrl || "").replace(/\/+$/, "");
      const key = config?.supabaseAnonKey || "";
      if (!url || !key) throw new Error("supabase_public_config_missing");
      const response = await fetch(`${url}/auth/v1/resend`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "signup", email: email.trim().toLowerCase() }),
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(String(payload.msg || payload.message || payload.error_description || payload.error || "auth_request_failed"));
      }
      setSuccess(true);
      setNotice("تم إرسال رسالة تأكيد جديدة — راجع بريدك الإلكتروني.");
    } catch {
      setSuccess(false);
      setNotice("تعذر إعادة إرسال رسالة التأكيد. حاول مرة أخرى.");
    } finally {
      setResendingConfirmation(false);
    }
  }

  return <LocalizedText><main dir={language === "ar" ? "rtl" : "ltr"} className="flex min-h-screen items-center justify-center bg-[#080b10] px-4 py-10 text-white">
    <LanguageToggle />
    <a href="/" aria-label={language === "ar" ? "العودة إلى الرئيسية" : "Back to home"} className="fixed left-4 top-4 z-30 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#11151b]/95 px-4 py-2 text-sm text-amber-300 shadow-lg backdrop-blur hover:bg-white/10"><span aria-hidden="true">⌂</span><span>{language === "ar" ? "الرئيسية" : "Home"}</span></a>
    <div className="w-full max-w-md">
      <form onSubmit={submit} className="mt-6 rounded-3xl border border-[#C9A227] bg-[#1A0505] p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          <img src="/brand/logo.png" alt="HotGPT" className="mx-auto h-20 w-20 object-contain" />
          <p className="mt-3 text-4xl font-black tracking-wide text-amber-400">HotGPT</p>
        </div>
        <h1 className="mt-2 text-2xl font-bold">{mode === "login" ? "مرحبًا بعودتك" : "أنشئ حسابك"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{mode === "login" ? "سجّل الدخول لحفظ محادثاتك ومتابعة رصيدك من أي جهاز." : "أنشئ حسابك لحفظ محادثاتك ومتابعة رصيدك من أي جهاز."}</p>
        {!recoveryMode && <>
          <button type="button" onClick={() => signInWithGoogle()} className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white font-bold text-[#1A0505] shadow hover:bg-slate-100">
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
            {language === "ar" ? (mode === "login" ? "تسجيل الدخول بـ Google" : "إنشاء حساب بـ Google") : "Continue with Google"}
          </button>
          {mode === "login" && <p className="mt-3 text-center text-[12.5px] leading-5 text-slate-400">{language === "ar" ? "لو عندك حساب عندنا بالإيميل وكلمة المرور، ادخل بيه هو عشان رصيدك ومحادثاتك يفضلوا معاك." : "Already have an email & password account with us? Sign in with it to keep your balance and chats."}</p>}
          <div className="mt-5 flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-white/10" /><span className="text-xs text-slate-500">{language === "ar" ? "أو بالإيميل" : "or with email"}</span><span className="h-px flex-1 bg-white/10" /></div>
        </>}
        {!recoveryMode && inviteCode && (
          <div className="mt-5 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4 text-start">
            <p className="text-sm font-bold text-amber-200">{language === "ar" ? <>حضرتك وصلت عن طريق كود الدعوة: <code dir="ltr" className="font-black text-amber-300">{inviteCode}</code></> : <>You arrived via an invite code: <code dir="ltr" className="font-black text-amber-300">{inviteCode}</code></>}</p>
            <p className="mt-1.5 text-sm leading-7 text-amber-100/90">{language === "ar" ? "أهلا بيك في موقعنا. استمتع بـ٥ محادثات مجانية، ولتفعيل جائزة الإحالة ليك ولصاحبك اشترك في أي باقة في الموقع" : "Welcome to our site. Enjoy 5 free conversations, and to activate the referral reward for you and your friend, subscribe to any plan on the site."}</p>
          </div>
        )}
        {!recoveryMode && mode === "signup" && <label className="mt-6 block text-sm">الاسم
          <span className="relative mt-2 block"><UserRound className="absolute right-3 top-3.5 text-amber-400/60" size={17} /><input autoComplete="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border-amber-400/25 bg-black/40 text-amber-200 placeholder:text-amber-200/40 caret-amber-400 outline-none focus:border-amber-400 py-3 pr-10 pl-3" placeholder="اسمك" /></span>
        </label>}
        {!recoveryMode && <label className="mt-5 block text-sm">البريد الإلكتروني
          <span className="relative mt-2 block"><Mail className="absolute right-3 top-3.5 text-amber-400/60" size={17} /><input type="email" autoComplete="email" required maxLength={320} value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border-amber-400/25 bg-black/40 text-amber-200 placeholder:text-amber-200/40 caret-amber-400 outline-none focus:border-amber-400 py-3 pr-10 pl-3" placeholder="name@example.com" /></span>
        </label>}
        {!recoveryMode && mode === "signup" && <p className="mt-5 text-[11.5px] leading-4 text-amber-200/85">{language === "ar" ? "لضمان قوتها: 8 أحرف على الأقل، مع رقم وحرف كبير ورمز." : "Strong password: 8+ chars incl. a number, uppercase & symbol."}</p>}
        {!recoveryMode && <label className={mode === "signup" ? "mt-2 block text-sm" : "mt-5 block text-sm"}>كلمة المرور
          <span className="relative mt-2 block"><LockKeyhole className="absolute right-3 top-3.5 text-amber-400/60" size={17} /><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border-amber-400/25 bg-black/40 text-amber-200 placeholder:text-amber-200/40 caret-amber-400 outline-none focus:border-amber-400 py-3 pr-10 pl-11" placeholder="8 أحرف على الأقل" /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute left-3 top-3.5 text-amber-400/60" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
        </label>}
        {!recoveryMode && <button type="button" onClick={requestPasswordReset} disabled={forgotPasswordBusy} className="mt-2 text-sm text-amber-400 hover:text-amber-300 disabled:opacity-50">{forgotPasswordBusy ? "جارٍ التنفيذ..." : "نسيت كلمة المرور؟"}</button>}
        {recoveryMode && <>
          <label className="mt-5 block text-sm">كلمة المرور الجديدة<input type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-2 w-full rounded-xl border-amber-400/25 bg-black/40 px-3 py-3 text-amber-200 placeholder:text-amber-200/40 caret-amber-400 outline-none focus:border-amber-400" /></label>
          <label className="mt-5 block text-sm">تأكيد كلمة المرور الجديدة<input type="password" autoComplete="new-password" required minLength={8} value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} className="mt-2 w-full rounded-xl border-amber-400/25 bg-black/40 px-3 py-3 text-amber-200 placeholder:text-amber-200/40 caret-amber-400 outline-none focus:border-amber-400" /></label>
        </>}
        {notice && <p role="status" className={`mt-4 rounded-xl border p-3 text-sm leading-6 ${success ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-red-400/20 bg-red-400/10 text-red-200"}`}>{notice}</p>}
        {emailConfirmationRequired && <button type="button" onClick={resendConfirmation} disabled={resendingConfirmation} className="mt-3 w-full text-sm font-semibold text-amber-400 hover:text-amber-300 disabled:opacity-50">{resendingConfirmation ? "جارٍ إرسال رسالة التأكيد..." : "إعادة إرسال رسالة التأكيد"}</button>}
        <Button type="submit" disabled={busy} className="mt-6 h-12 w-full flex items-center justify-center bg-[#FBBF24] font-black text-[#1A0505] hover:bg-[#FBBF24]" style={{ backgroundColor: "#FBBF24", color: "#1A0505" }}>{busy ? "جارٍ التنفيذ..." : recoveryMode ? "إرسال" : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}</Button>
        {!recoveryMode && <p className="mt-5 text-center text-sm text-slate-400">{mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"} <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setNotice(""); setSuccess(false); setEmailConfirmationRequired(false); }} className="font-semibold text-amber-400 hover:text-amber-300">{mode === "login" ? "إنشاء حساب جديد" : "تسجيل الدخول"}</button></p>}
      </form>
    </div>
  </main></LocalizedText>;
}
