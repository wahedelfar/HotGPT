import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type AppLanguage = "ar" | "en";
// Auto-detection (owner request, 2026-11-01): on visits where the member has
// never manually toggled, the language follows the visitor's country —
// Arabic for Arab countries, English elsewhere. A manual toggle is stored
// as source "manual" and always wins afterwards.
const ARAB_COUNTRIES = new Set(["EG", "SA", "AE", "KW", "QA", "BH", "OM", "JO", "LB", "SY", "IQ", "YE", "PS", "SD", "LY", "TN", "DZ", "MA", "MR", "SO", "DJ", "KM"]);
type LanguageContextValue = { language: AppLanguage; toggleLanguage: () => void; country: string | null };
const LanguageContext = createContext<LanguageContextValue>({ language: "ar", toggleLanguage: () => {}, country: null });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") return "ar";
    return localStorage.getItem("hotgpt-language") === "en" ? "en" : "ar";
  });
  const [country, setCountry] = useState<string | null>(null);
  const toggleLanguage = useCallback(() => {
    try { localStorage.setItem("hotgpt-language-source", "manual"); } catch { /* storage unavailable */ }
    setLanguage(value => value === "ar" ? "en" : "ar");
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("hotgpt-language-source") === "manual") return;
    let cancelled = false;
    (async () => {
      let next: AppLanguage | null = null;
      try {
        const response = await fetch("/api/billing?action=geo");
        const data = response.ok ? await response.json() : null;
        const country = String(data?.country || "").toUpperCase();
        if (country) setCountry(country);
        if (country) next = ARAB_COUNTRIES.has(country) ? "ar" : "en";
      } catch { /* geo unavailable — fall back to the browser language */ }
      if (!next) next = (navigator.language || "").toLowerCase().startsWith("ar") ? "ar" : "en";
      if (cancelled) return;
      try { localStorage.setItem("hotgpt-language-source", "auto"); } catch { /* ignore */ }
      setLanguage(next);
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    localStorage.setItem("hotgpt-language", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    window.dispatchEvent(new CustomEvent("hotgpt-language-change", { detail: language }));
  }, [language]);
  return <LanguageContext.Provider value={{ language, toggleLanguage, country }}>{children}</LanguageContext.Provider>;
}
export function useAppLanguage() { return useContext(LanguageContext); }
// Audience for value-framing copy (owner rule, 2026-11-02): gift and referral
// announcements are phrased in EGP only for the Egyptian Arabic audience;
// other Arabic audiences get token/use wording, English gets token wording.
// An unknown country falls back to the Egypt wording in Arabic (the site's
// primary audience) — manual language toggles never trigger the geo fetch,
// so country stays null for those visitors.
export function useAudience() {
  const { language, country } = useAppLanguage();
  const egEgp = language === "ar" && (country === null || country === "EG");
  return { language, country, egEgp };
}

const dictionary: Record<string, string> = {
  "العودة إلى HotGPT": "Back to HotGPT",
  "مرحبًا بعودتك": "Welcome back",
  "أنشئ حسابك": "Create your account",
  "سجّل الدخول لحفظ محادثاتك ومتابعة رصيدك من أي جهاز.": "Sign in to save your conversations and track your balance from any device.",
  "الاسم": "Name",
  "اسمك": "Your name",
  "البريد الإلكتروني": "Email address",
  "كلمة المرور": "Password",
  "إخفاء كلمة المرور": "Hide password",
  "إظهار كلمة المرور": "Show password",
  "8 أحرف على الأقل": "At least 8 characters",
  "جارٍ التنفيذ...": "Processing...",
  "تسجيل الدخول": "Sign in",
  "إنشاء الحساب": "Create account",
  "ليس لديك حساب؟": "Don't have an account?",
  "لديك حساب بالفعل؟": "Already have an account?",
  "إنشاء حساب جديد": "Create a new account",
  "تم إنشاء حسابك! 🎉 أرسلنا رابط تأكيد إلى بريدك الإلكتروني — افتح الرسالة واضغط الرابط لتفعيل حسابك والدخول مباشرة.": "Account created! 🎉 We sent a confirmation link to your email — open the message and tap the link to activate your account and sign in instantly.",
  "حسابك لسه مش مفعّل — فعّل حسابك من رسالة التأكيد اللي وصلتك على بريدك الإلكتروني، وبعدها سجّل دخولك عادي.": "Your account isn't activated yet — please confirm your email using the confirmation message we sent you, then sign in.",
  "إعادة إرسال رسالة التأكيد": "Resend confirmation email",
  "الرابط اللي فتحته انتهى أو استُخدم من قبل. لو كنت بتفعّل حسابك جرّب تسجيل الدخول عادي، ولو كنت بتعيّن كلمة مرور جديدة اطلب رابطًا جديدًا من «نسيت كلمة المرور؟».": "The link you opened has expired or was already used. If you were activating your account, just sign in; if you were resetting your password, request a new one from the Forgot your password link.",
  "تم إرسال رسالة تأكيد جديدة — راجع بريدك الإلكتروني.": "A new confirmation email has been sent — check your inbox.",
  "نسيت كلمة المرور؟": "Forgot your password?",
  "اكتب بريدك الإلكتروني أولًا، ثم اضغط «نسيت كلمة المرور؟» مرة أخرى.": "Enter your email first, then tap Forgot your password again.",
  "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني — افتح الرسالة واضغط الرابط لتعيين كلمة مرور جديدة.": "Password reset link sent to your email — open the message and tap the link to set a new password.",
  "كلمة المرور الجديدة": "New password",
  "تأكيد كلمة المرور الجديدة": "Confirm new password",
  "إرسال": "Submit",
  "كلمتا المرور غير متطابقتين.": "The two passwords do not match.",
  "كلمة المرور يجب أن تكون 8 أحرف على الأقل، وتحتوي على حرف كبير ورقم ورمز.": "Password must be at least 8 characters and include an uppercase letter, a number and a symbol.",
  "كلمة المرور الجديدة هي نفس كلمة المرور الحالية — اختر كلمة مرور مختلفة عن الحالية.": "Your new password is the same as your current one — choose a different password.",
  "تم تعيين كلمة المرور الجديدة بنجاح.": "Your new password has been set.",
  "تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.": "Could not complete the request. Check your details and try again.",
  "إعدادات Supabase العامة غير متاحة في هذه النسخة.": "Public Supabase configuration is unavailable in this build.",
  "هذا البريد مسجل بالفعل. استخدم تسجيل الدخول.": "This email is already registered. Please sign in.",
  "البريد الإلكتروني أو كلمة المرور غير صحيحة.": "Incorrect email or password.",
  "كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل مع أرقام.": "Password is too weak. Use at least 8 characters including numbers.",
  "محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.": "Too many attempts. Wait a moment and try again.",
  "تم استلام الحساب لكن لم تُنشأ جلسة دخول. راجع إعداد تأكيد البريد في Supabase.": "The account was created but no session was started. Check email-confirmation settings in Supabase.",
  "الاشتراك ورصيد الاشتراك": "Subscription & subscription balance",
  "نموذج Default يخصم 1 من الرصيد، ونموذج Beast يخصم 5 للمرحلة ويحتاج إلى رصيد مدفوع. تحليل الملفات يخصم 3 من الرصيد.": "Default uses 1 from your balance, Beast uses 5 per stage and needs a paid balance, and file analysis uses 3 from your balance.",
  "البداية": "Starter",
  "الأكثر توازنًا": "Best value",
  "الأكبر": "Largest",
  "رصيد": "balance",
  "جنيه": "EGP",
  "طريقة الدفع": "Payment method",
  "فودافون كاش": "Vodafone Cash",
  "حوّل قيمة اشتراكك إلى الرقم أعلاه.": "Transfer your subscription amount to the number above.",
  "استخدم رابط الدفع الرسمي ثم ارفع صورة الإثبات.": "Use the official payment link, then upload proof.",
  "فتح رابط PayPal": "Open PayPal link",
  "رابط PayPal لم يُضف بعد": "PayPal link has not been configured yet",
  "إثبات الدفع": "Payment proof",
  "اختر الاشتراك الذي دفعت قيمته": "Select the subscription you paid for",
  "صورة التحويل (PNG/JPG/WebP، حتى 700KB)": "Transfer image (PNG/JPG/WebP, up to 700 KB)",
  "معاينة إثبات الدفع": "Payment proof preview",
  "جارٍ إرسال الطلب...": "Submitting request...",
  "إرسال إثبات الدفع للمراجعة": "Submit payment proof for review",
  "إدارة الأعضاء والرصيد": "Manage members and balance",
  "ضبط الرصيد مباشرة بالبريد المسجل ومراجعة إثباتات الدفع.": "Adjust balances by registered email and review payment proofs.",
  "تحديث البيانات": "Refresh data",
  "تعيين رصيد عضو يدويًا": "Manually set member balance",
  "القيمة هنا هي الرصيد النهائي، وليست إضافة على الرصيد الحالي.": "This sets the final balance; it does not add to the current balance.",
  "البريد الإلكتروني المسجل": "Registered email",
  "عدد الرصيد": "Balance amount",
  "جارٍ الحفظ...": "Saving...",
  "حفظ الرصيد": "Save balance",
  "طلبات الدفع وإثباتات التحويل": "Payment requests and transfer proofs",
  "جارٍ تحميل البيانات...": "Loading data...",
  "لا توجد طلبات دفع حتى الآن.": "There are no payment requests yet.",
  "قيد المراجعة": "Pending review",
  "تمت الموافقة": "Approved",
  "مرفوض": "Rejected",
  "عرض صورة إثبات الدفع": "View payment proof",
  "جارٍ تحميل الصورة...": "Loading image...",
  "موافقة وإضافة الرصيد": "Approve and add balance",
  "رفض الطلب": "Reject request",
  "الأعضاء المسجلون": "Registered members",
  "العضو": "Member",
  "الدور": "Role",
  "إجابات مجانية مستخدمة": "Free answers used",
  "الرصيد المدفوع": "Paid balance",
  "تاريخ التسجيل": "Registration date",
  "بدون اسم": "No name",
  "لا يوجد بريد": "No email",
  "تسجيل دخول الإدارة": "Admin sign in",
  "دخول مستقل عن تسجيل دخول أعضاء الموقع.": "Separate from regular member sign-in.",
  "دخول لوحة الإدارة": "Open admin dashboard",
  "جارٍ التحقق من جلسة الإدارة...": "Checking admin session...",
  "تغيير كلمة المرور": "Change password",
  "تسجيل الخروج": "Sign out",
  "تغيير كلمة مرور الإدارة": "Change admin password",
  "كلمة المرور الحالية": "Current password",
  "كلمة المرور الجديدة (10 أحرف على الأقل)": "New password (at least 10 characters)",
  "حفظ كلمة المرور": "Save password",
  "إلغاء": "Cancel",
  "← العودة إلى HotGPT": "← Back to HotGPT",
  "HOTGPT WALLET": "HOTGPT WALLET",
  "HOTGPT ADMIN": "HOTGPT ADMIN",
  "تعذر تحميل بيانات الاشتراك. أعد المحاولة.": "Could not load the subscription data. Please try again.",
  "ارفع صورة PNG أو JPG أو WebP فقط.": "Upload a PNG, JPG, or WebP image only.",
  "حجم الصورة يجب ألا يتجاوز 700 كيلوبايت. قلّل حجم الصورة ثم أعد المحاولة.": "The image must be 700 KB or smaller. Compress it and try again.",
  "تعذر قراءة الصورة. حاول بصورة أخرى.": "Could not read the image. Try another one.",
  "اختر اشتراكك وارفع صورة إثبات الدفع أولًا.": "Choose your subscription and upload your payment proof first.",
  "يجب تسجيل الدخول قبل إرسال إثبات الدفع. سجّل الدخول ثم حاول مجددًا.": "Sign in before submitting payment proof, then try again.",
  "تعذر التحقق من الحساب حاليًا. أعد المحاولة بعد قليل.": "Could not verify your account right now. Try again shortly.",
  "الصورة غير صالحة أو تتجاوز 700 كيلوبايت.": "The image is invalid or exceeds 700 KB.",
  "تعذر حفظ صورة الإثبات في التخزين. أعد المحاولة، وإذا تكرر الخطأ تواصل مع الإدارة.": "Could not save the proof image. Try again; contact support if the issue continues.",
  "صورتك وصلتنا وطلبك متسجل عندنا — حصل بس تأخير لحظي في إتمامه. ارفع الصورة مرة كمان من غير ما تحوّل تاني وهيتم التفعيل خلال دقائق، والدعم الفني معاك ٢٤ ساعة لأي مشكلة.": "Your image reached us and your request is recorded — there was just a momentary delay completing it. Upload the image once more without paying again and activation will happen within minutes; support is with you 24/7 for any problem.",
  "اختر اشتراكًا وطريقة دفع صحيحة.": "Choose a valid subscription and payment method.",
  "تعذر إرسال طلب الدفع. تحقق من اتصالك وحاول مرة أخرى.": "Could not submit the payment request. Check your connection and try again.",
  "تم إرسال إثبات الدفع للمراجعة. سيُضاف رصيد اشتراكك بعد موافقة الإدارة.": "Payment proof submitted for review. Your subscription balance will be added after admin approval.",
  "للتأكيد السريع يمكنك إرسال صورة التحويل إلى رقم فودافون كاش نفسه. ارفع الصورة هنا أيضًا حتى تظهر في لوحة الإدارة.": "For faster confirmation, you can send the transfer image to the Vodafone Cash number. Upload it here too so it appears in the admin dashboard.",
  "اشتراكك المختار: ": "Your selected plan: ",
  " مقابل ": " for ",
  " جنيه.": " EGP.",
  "مقابل ": " for ",
  "Default: 1 من الرصيد · Beast: 5 من الرصيد للمرحلة · تحليل الملف: 3 من الرصيد": "Default: 1 from balance · Beast: 5 from balance per stage · File analysis: 3 from balance",
  "لخص الملف المرفق": "Summarize the attached file",
  "الدخول للوحة يتطلب حساب مسؤول (admin). اضبط HOTGPT_ADMIN_EMAILS في Vercel أو امنح حسابك دور admin.": "Admin access is required. Configure HOTGPT_ADMIN_EMAILS in Vercel or grant your account the admin role.",
  "تعذر تحميل بيانات الإدارة أو قاعدة البيانات.": "Could not load admin or database data.",
  "حدث خطأ أثناء تحميل اللوحة.": "An error occurred while loading the dashboard.",
  "أدخل بريدًا صحيحًا ورصيدًا صحيحًا لا يقل عن صفر.": "Enter a valid email and a non-negative whole-number balance.",
  "لا يوجد عضو بهذا البريد المسجل.": "No member is registered with that email.",
  "تعذر تعديل الرصيد.": "Could not update the balance.",
  "فشل تعديل الرصيد.": "Failed to update the balance.",
  "تمت مراجعة الطلب بالفعل.": "This payment request has already been reviewed.",
  "تعذرت مراجعة طلب الدفع.": "Could not review the payment request.",
  "تم رفض طلب الدفع.": "Payment request rejected.",
  "هل تريد ": "Do you want to ",
  " للطلب #": " for request #",
  "؟": "?",
  "تعذر تحميل صورة إثبات الدفع.": "Could not load the payment proof image.",
  "تعذر تحميل الصورة.": "Could not load the image.",
  "تم تغيير كلمة المرور. سجّل الدخول مجددًا.": "Password changed. Please sign in again.",
  "قاعدة البيانات أو إعدادات الجلسة غير جاهزة. يلزم تطبيق الترحيل وضبط إعدادات Vercel.": "The database or session settings are not ready. Apply the migration and configure Vercel settings.",
  "البريد أو كلمة المرور غير صحيحين.": "Incorrect email or password.",
  "تعذر تسجيل الدخول.": "Could not sign in.",
  "تعذر تغيير كلمة المرور.": "Could not change the password.",
  "تم ضبط رصيد ": "Set the balance for ",
  " إلى ": " to ",
  " رصيد.": " balance.",
  "تمت الموافقة وإضافة ": "Approved and added ",
  "الموافقة وإضافة الرصيد": "Approve and add balance",
};
function translate(value: string) { return dictionary[value] ?? value; }

function translateTree(node: React.ReactNode): React.ReactNode {
  if (typeof node === "string") return translate(node);
  if (Array.isArray(node)) return node.map((item, index) => <React.Fragment key={index}>{translateTree(item)}</React.Fragment>);
  if (!React.isValidElement(node)) return node;
  const props = node.props as Record<string, unknown>;
  const nextProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === "children") nextProps.children = translateTree(value as React.ReactNode);
    else if (typeof value === "string" && ["placeholder", "aria-label", "title", "alt"].includes(key)) nextProps[key] = translate(value);
    else nextProps[key] = value;
  }
  return React.cloneElement(node as React.ReactElement<any>, nextProps);
}
export function LocalizedText({ children }: { children: React.ReactNode }) {
  const { language } = useAppLanguage();
  return language === "en" ? <>{translateTree(children)}</> : <>{children}</>;
}
export function LanguageFlag({ lang }: { lang: "ar" | "en" }) {
  if (lang === "en") {
    return (
      <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" style={{ borderRadius: 3, display: "block", flex: "0 0 auto" }}>
        <rect width="20" height="14" fill="#ffffff" />
        {[0, 2.15, 4.31, 6.46, 8.62, 10.77, 12.92].map(y => (
          <rect key={y} y={y} width="20" height="1.08" fill="#B31942" />
        ))}
        <rect width="9.5" height="7.55" fill="#0A3161" />
        {[1.6, 4.75, 7.9].map(cx => [1.7, 3.8, 5.9].map(cy => (
          <circle key={cx + "-" + cy} cx={cx} cy={cy} r="0.62" fill="#ffffff" />
        )))}
      </svg>
    );
  }
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" style={{ borderRadius: 3, display: "block", flex: "0 0 auto" }}>
      <rect width="20" height="4.67" fill="#CE2B37" />
      <rect y="4.67" width="20" height="4.67" fill="#ffffff" />
      <rect y="9.33" width="20" height="4.67" fill="#000000" />
      <path d="M10 5.1 L10.9 6.6 L13.2 5.9 L11.9 7.6 L12.6 9.4 L10.7 8.5 L10.7 9.9 L9.3 9.9 L9.3 8.5 L7.4 9.4 L8.1 7.6 L6.8 5.9 L9.1 6.6 Z" fill="#C09300" />
    </svg>
  );
}

export function LanguageToggle({ inline = false }: { inline?: boolean }) {
  const { language, toggleLanguage } = useAppLanguage();
  return <button type="button" onClick={toggleLanguage} aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"} title={language === "ar" ? "Switch to English" : "التبديل إلى العربية"} className={(inline ? "" : "fixed right-4 top-4 z-50 ") + "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#10151d] text-white shadow-lg"}>
    <LanguageFlag lang={language === "ar" ? "en" : "ar"} />
  </button>;
}
