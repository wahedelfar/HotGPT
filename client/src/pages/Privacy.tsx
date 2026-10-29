import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";
import { Eye } from "lucide-react";

// Privacy Policy — DRAFT for owner approval (2026-10-27). Statements
// mirror the product's actual data flows: Supabase (accounts/data),
// OpenRouter (inference), Vercel (hosting), PayPal (payments).
// Generated images are NOT stored — stated explicitly per owner rule.

type Section = { h: [string, string]; p: [string, string] };
const SECTIONS: Section[] = [
  {
    h: ["١. البيانات التي نجمعها", "1. Data we collect"],
    p: [
      "بيانات الحساب (البريد الإلكتروني وبيانات الدخول عبر مزود المصادقة)، محادثاتك ورسائلك التي تنشئها داخل الخدمة، سجلات المحفظة والطلبات، وصور إثبات التحويل التي ترفعها عند الدفع اليدوي. لا نطلب ولا نجمع بيانات بطاقات الدفع — مدفوعات البطاقات تتم لدى PayPal مباشرة.",
      "Account data (email and sign-in data via the authentication provider), the conversations and messages you create in the service, wallet and order records, and the transfer-proof screenshots you upload for manual payments. We never request or collect payment-card data — card payments are processed by PayPal directly.",
    ],
  },
  {
    h: ["٢. كيف تُستخدم البيانات", "2. How data is used"],
    p: [
      "تُستخدم البيانات لتشغيل الخدمة فقط: تنفيذ طلباتك، احتساب التوكنات وإضافتها، مراجعة المدفوعات واعتمادها، ومنع إساءة الاستخدام والتحايل. لا نبيع بيانات المستخدمين ولا نستخدم محادثاتك في إعلانات.",
      "Data is used solely to operate the service: executing your requests, metering and crediting tokens, reviewing and approving payments, and preventing abuse and fraud. We do not sell user data and do not use your conversations for advertising.",
    ],
  },
  {
    h: ["٣. المعالجون الخارجيون", "3. Third-party processors"],
    p: [
      "تعتمد الخدمة على معالجين محددين: Supabase (قاعدة البيانات والمصادقة)، OpenRouter (تُرسل طلباتك إلى مزودي نماذج الذكاء الاصطناعي لتوليد الإجابات)، Vercel (الاستضافة وتقديم الموقع)، وPayPal (معالجة المدفوعات الإلكترونية). يقتصر ما يصل لكل معالج على ما يلزم مهمته.",
      "The service relies on specific processors: Supabase (database and authentication), OpenRouter (your prompts are sent to AI model providers to generate answers), Vercel (hosting and delivery), and PayPal (electronic payment processing). Each processor receives only what its task requires.",
    ],
  },
  {
    h: ["٤. الصور المولّدة", "4. Generated images"],
    p: [
      "الصور التي تولّدها داخل المحادثة لا تُخزَّن على خوادمنا إطلاقًا؛ تظهر داخل جلستك فقط وتُفقد عند تسجيل الخروج أو تحديث الجلسة. احفظ أي صورة تهمك على جهازك فور توليدها.",
      "Images you generate in chat are never stored on our servers; they appear within your session only and are lost on sign-out or session refresh. Save any image you need to your own device as soon as it is generated.",
    ],
  },
  {
    h: ["٥. إثباتات الدفع", "5. Payment proofs"],
    p: [
      "صور إثبات التحويل المرفوعة للمراجعة اليدوية تُحفظ فقط حتى صدور قرار الاعتماد أو الرفض، ثم تُحذف من التخزين. تبقى بيانات المعاملة الأساسية (المبلغ والحالة والتوقيت) ضمن سجلات الطلبات للمحاسبة ومنع التحايل.",
      "Transfer-proof screenshots uploaded for manual review are kept only until the approval or rejection decision, and are then deleted from storage. Core transaction data (amount, status, timestamps) remains in order records for accounting and fraud prevention.",
    ],
  },
  {
    h: ["٦. التخزين المحلي", "6. Local storage"],
    p: [
      "يخزّن المتصفح محليًا تفضيلاتك (اللغة والمظهر) وتأكيد السن وبيانات جلسة الدخول. لا نستخدم أدوات تتبع إعلانية.",
      "Your browser stores your preferences locally (language and theme), the age confirmation, and sign-in session data. We use no advertising trackers.",
    ],
  },
  {
    h: ["٧. حقوقك", "7. Your rights"],
    p: [
      "يمكنك طلب الاطلاع على بيانات حسابك أو تصحيحها أو حذف الحساب نهائيًا عبر hotgpt.pro@gmail.com. الحذف يزيل المحادثات وسجل المحفظة، مع الاحتفاظ فقط بسجلات المعاملات المالية التي يفرض الاحتفاظ بها لأغراض المحاسبة ومنع الاحتيال.",
      "You may request access to your account data, its correction, or full account deletion via hotgpt.pro@gmail.com. Deletion removes conversations and wallet history, retaining only the financial transaction records that must be kept for accounting and fraud-prevention purposes.",
    ],
  },
  {
    h: ["٨. الأمان والاحتفاظ", "8. Security and retention"],
    p: [
      "نطبق إجراءات معقولة لحماية البيانات (اتصالات مشفرة، وصول مقيد بقواعد صلاحيات على مستوى الصفوف). تُحفظ المحادثات ما دام الحساب نشطًا؛ ويمكن للمستخدم حذف محادثاته بنفسه في أي وقت من داخل الخدمة.",
      "We apply reasonable safeguards (encrypted connections, access restricted by row-level security rules). Conversations are retained while the account is active, and users can delete their own conversations at any time from within the service.",
    ],
  },
];

export default function PrivacyPage() {
  const { language } = useAppLanguage();
  const t = (ar: string, en: string) => (language === "ar" ? ar : en);
  return (
    <LocalizedText>
      <main dir={language === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#090909] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <a href="/" className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-white">{t("← العودة إلى HotGPT", "← Back to HotGPT")}</a>
            <LanguageToggle inline />
          </div>
          <header className="my-8 rounded-3xl border border-amber-200/35 bg-gradient-to-br from-amber-200/10 to-transparent p-6 sm:p-9">
            <div className="flex items-center gap-3 text-amber-200"><Eye size={26} /><span className="text-xs font-bold tracking-widest">HOTGPT · PRIVACY</span></div>
            <h1 className="mt-4 text-3xl font-black sm:text-4xl">{t("سياسة الخصوصية", "Privacy Policy")}</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">{t("بصراحة وباختصار: ما الذي يُجمع، ولماذا، وأين يذهب.", "Plainly and briefly: what is collected, why, and where it goes.")}</p>
          </header>
          <div className="space-y-4">
            {SECTIONS.map((s, i) => (
              <section key={i} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                <h2 className="text-lg font-bold">{language === "ar" ? s.h[0] : s.h[1]}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">{language === "ar" ? s.p[0] : s.p[1]}</p>
              </section>
            ))}
          </div>
          <footer className="mt-8 text-center text-xs text-slate-500">
            <a className="text-amber-200 underline" href="/terms">{t("الشروط والأحكام", "Terms of Service")}</a>{" · "}
            <a className="text-amber-200 underline" href="/refund">{t("سياسة الاسترداد", "Refund Policy")}</a>{" · "}
            <a className="text-amber-200 underline" href="/lucky-terms">{t("شروط HotLucky", "HotLucky Terms")}</a>{" · "}
            <a className="text-amber-200 underline" href="/faq">{t("الأسئلة الشائعة", "FAQ")}</a>
          </footer>
        </div>
      </main>
    </LocalizedText>
  );
}
