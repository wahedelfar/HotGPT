import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Languages } from "lucide-react";

export type AppLanguage = "ar" | "en";
type LanguageContextValue = { language: AppLanguage; toggleLanguage: () => void };
const LanguageContext = createContext<LanguageContextValue>({ language: "ar", toggleLanguage: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") return "ar";
    return localStorage.getItem("hotgpt-language") === "en" ? "en" : "ar";
  });
  const toggleLanguage = useCallback(() => setLanguage(value => value === "ar" ? "en" : "ar"), []);
  useEffect(() => {
    localStorage.setItem("hotgpt-language", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    window.dispatchEvent(new CustomEvent("hotgpt-language-change", { detail: language }));
  }, [language]);
  return <LanguageContext.Provider value={{ language, toggleLanguage }}>{children}</LanguageContext.Provider>;
}
export function useAppLanguage() { return useContext(LanguageContext); }

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
  "تم إنشاء الحساب. إذا طلب Supabase تأكيد البريد، افتح رسالة التأكيد؛ سيُستعاد تسجيل الدخول تلقائيًا عند الرجوع إلى الموقع.": "Account created. If Supabase requests email confirmation, open the confirmation email; your session will be restored when you return.",
  "تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.": "Could not complete the request. Check your details and try again.",
  "إعدادات Supabase العامة غير متاحة في هذه النسخة.": "Public Supabase configuration is unavailable in this build.",
  "هذا البريد مسجل بالفعل. استخدم تسجيل الدخول.": "This email is already registered. Please sign in.",
  "البريد الإلكتروني أو كلمة المرور غير صحيحة.": "Incorrect email or password.",
  "كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل مع أرقام.": "Password is too weak. Use at least 8 characters including numbers.",
  "محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.": "Too many attempts. Wait a moment and try again.",
  "تم استلام الحساب لكن لم تُنشأ جلسة دخول. راجع إعداد تأكيد البريد في Supabase.": "The account was created but no session was started. Check email-confirmation settings in Supabase.",
  "الباقات ورصيد التوكينات": "Plans & token balance",
  "نموذج Default يخصم توكينًا واحدًا، ونموذج Beast يخصم توكينين ويحتاج إلى رصيد مدفوع. تحليل الملفات يخصم 3 توكينات. لديك إجابتان مجانيتان للرسائل العادية.": "Default uses 1 token, Beast uses 2 paid tokens, and file analysis uses 3 tokens. You get two free answers for regular messages.",
  "البداية": "Starter",
  "الأكثر توازنًا": "Best value",
  "الأكبر": "Largest",
  "توكين": "tokens",
  "جنيه": "EGP",
  "طريقة الدفع": "Payment method",
  "فودافون كاش": "Vodafone Cash",
  "حوّل قيمة الباقة إلى الرقم أعلاه.": "Transfer the package amount to the number above.",
  "استخدم رابط الدفع الرسمي ثم ارفع صورة الإثبات.": "Use the official payment link, then upload proof.",
  "فتح رابط PayPal": "Open PayPal link",
  "رابط PayPal لم يُضف بعد": "PayPal link has not been configured yet",
  "إثبات الدفع": "Payment proof",
  "اختر الباقة التي دفعت قيمتها": "Select the package you paid for",
  "صورة التحويل (PNG/JPG/WebP، حتى 700KB)": "Transfer image (PNG/JPG/WebP, up to 700 KB)",
  "معاينة إثبات الدفع": "Payment proof preview",
  "جارٍ إرسال الطلب...": "Submitting request...",
  "إرسال إثبات الدفع للمراجعة": "Submit payment proof for review",
  "إدارة الأعضاء والتوكينات": "Manage members and tokens",
  "ضبط الرصيد مباشرة بالبريد المسجل ومراجعة إثباتات الدفع.": "Adjust balances by registered email and review payment proofs.",
  "تحديث البيانات": "Refresh data",
  "تعيين رصيد عضو يدويًا": "Manually set member balance",
  "القيمة هنا هي الرصيد النهائي، وليست إضافة على الرصيد الحالي.": "This sets the final balance; it does not add to the current balance.",
  "البريد الإلكتروني المسجل": "Registered email",
  "عدد التوكينات": "Token amount",
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
  "موافقة وإضافة التوكينات": "Approve and add tokens",
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
  "تعذر تحميل بيانات الباقات. أعد المحاولة.": "Could not load plan details. Please try again.",
  "ارفع صورة PNG أو JPG أو WebP فقط.": "Upload a PNG, JPG, or WebP image only.",
  "حجم الصورة يجب ألا يتجاوز 700 كيلوبايت. قلّل حجم الصورة ثم أعد المحاولة.": "The image must be 700 KB or smaller. Compress it and try again.",
  "تعذر قراءة الصورة. حاول بصورة أخرى.": "Could not read the image. Try another one.",
  "اختر الباقة وارفع صورة إثبات الدفع أولًا.": "Choose a plan and upload payment proof first.",
  "يجب تسجيل الدخول قبل إرسال إثبات الدفع. سجّل الدخول ثم حاول مجددًا.": "Sign in before submitting payment proof, then try again.",
  "تعذر التحقق من الحساب حاليًا. أعد المحاولة بعد قليل.": "Could not verify your account right now. Try again shortly.",
  "الصورة غير صالحة أو تتجاوز 700 كيلوبايت.": "The image is invalid or exceeds 700 KB.",
  "تعذر حفظ صورة الإثبات في التخزين. أعد المحاولة، وإذا تكرر الخطأ تواصل مع الإدارة.": "Could not save the proof image. Try again; contact support if the issue continues.",
  "تم رفع الصورة لكن تعذر تسجيل طلب الدفع. لا تعِد التحويل؛ أعد إرسال الطلب أو تواصل مع الإدارة.": "The image uploaded, but the payment request could not be recorded. Do not transfer again; retry the request or contact support.",
  "اختر باقة وطريقة دفع صحيحتين.": "Choose a valid plan and payment method.",
  "تعذر إرسال طلب الدفع. تحقق من اتصالك وحاول مرة أخرى.": "Could not submit the payment request. Check your connection and try again.",
  "تم إرسال إثبات الدفع للمراجعة. ستُضاف التوكينات بعد موافقة الإدارة.": "Payment proof submitted for review. Tokens will be added after admin approval.",
  "للتأكيد السريع يمكنك إرسال صورة التحويل إلى رقم فودافون كاش نفسه. ارفع الصورة هنا أيضًا حتى تظهر في لوحة الإدارة.": "For faster confirmation, you can send the transfer image to the Vodafone Cash number. Upload it here too so it appears in the admin dashboard.",
  "الباقة المختارة: ": "Selected plan: ",
  " مقابل ": " for ",
  " جنيه.": " EGP.",
  "توكين مقابل ": " tokens for ",
  "Default: 1 توكين · Beast: 2 توكين · تحليل الملف: 3 توكينات": "Default: 1 token · Beast: 2 tokens · File analysis: 3 tokens",
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
  " توكين.": " tokens.",
  "تمت الموافقة وإضافة ": "Approved and added ",
  "الموافقة وإضافة التوكينات": "Approve and add tokens",
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
export function LanguageToggle() {
  const { language, toggleLanguage } = useAppLanguage();
  return <button type="button" onClick={toggleLanguage} aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"} title={language === "ar" ? "Switch to English" : "التبديل إلى العربية"} className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#10151d] px-3 py-2 text-sm text-white shadow-lg">
    <span aria-hidden="true">{language === "ar" ? "🇺🇸" : "🇸🇦"}</span><Languages size={16} /><span>{language === "ar" ? "English" : "العربية"}</span>
  </button>;
}
