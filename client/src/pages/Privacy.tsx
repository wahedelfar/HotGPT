import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";
import BrandClaim from "@/components/BrandClaim";
import FbFollow, { BlogFollow, SmolBadge } from "@/components/FbFollow";
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
      "نجمع فقط ما يلزم لتشغيل الخدمة: (أ) بيانات الحساب — بريدك الإلكتروني وبيانات تسجيل الدخول عبر مزود المصادقة، وعند دخولك عبر Google نتلقى اسمك وبريدك الإلكتروني وصورة ملفك الشخصي ومعرّف حساب Google الخاص بك؛ (ب) بيانات المحتوى — محادثاتك ورسائلك التي تنشئها داخل الخدمة والملفات التي ترفعها للتحليل وطلبات الخدمات التي تنفذها؛ (ج) بيانات المعاملات — سجلات المحفظة والطلبات، وصور إثبات التحويل التي ترفعها عند الدفع اليدوي؛ (د) بيانات تقنية محدودة — نوع المتصفح والجهاز وسجلات الأخطاء اللازمة للأمان ومنع الاحتيال. لا نطلب ولا نجمع بيانات بطاقات الدفع — مدفوعات البطاقات تتم لدى PayPal مباشرة.",
      "We collect only what is needed to operate the service: (a) account data — your email address and sign-in data via the authentication provider, and, when you sign in with Google, we receive your name, email address, profile picture, and Google account ID; (b) content data — the conversations and messages you create in the service, files you upload for analysis, and the service requests you run; (c) transaction data — wallet and order records, and the transfer-proof screenshots you upload for manual payments; (d) limited technical data — browser and device type and error logs needed for security and fraud prevention. We never request or collect payment-card data — card payments are processed by PayPal directly.",
    ],
  },
  {
    h: ["٢. كيف تُستخدم البيانات", "2. How data is used"],
    p: [
      "تُستخدم البيانات لتشغيل الخدمة فقط: إنشاء حسابك وتسجيل دخولك، تنفيذ طلباتك وتوليد الإجابات والخدمات، احتساب التوكنات وإضافتها، مراجعة المدفوعات واعتمادها، الرد على طلبات الدعم، والحفاظ على أمان الخدمة ومنع إساءة الاستخدام والتحايل، والامتثال للالتزامات القانونية. لا نبيع بيانات المستخدمين لأي طرف، ولا نشاركها لأغراض تسويقية أو إعلانية، ولا نستخدم محادثاتك أو بيانات Google الخاصة بك في تدريب نماذج ذكاء اصطناعي.",
      "Data is used solely to operate the service: creating your account and signing you in, executing your requests and generating answers and services, metering and crediting tokens, reviewing and approving payments, responding to support requests, keeping the service secure and preventing abuse and fraud, and meeting legal obligations. We do not sell user data to anyone, do not share it for marketing or advertising purposes, and do not use your conversations or your Google user data to train AI models.",
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
      "يمكنك طلب الاطلاع على بيانات حسابك أو تصحيحها أو حذف الحساب نهائيًا عبر support@hotgpt.pro. الحذف يزيل المحادثات وسجل المحفظة، مع الاحتفاظ فقط بسجلات المعاملات المالية التي يفرض الاحتفاظ بها لأغراض المحاسبة ومنع الاحتيال.",
      "You may request access to your account data, its correction, or full account deletion via support@hotgpt.pro. Deletion removes conversations and wallet history, retaining only the financial transaction records that must be kept for accounting and fraud-prevention purposes.",
    ],
  },
  {
    h: ["٨. الأمان والاحتفاظ", "8. Security and retention"],
    p: [
      "نطبق إجراءات معقولة لحماية البيانات (اتصالات مشفرة، وصول مقيد بقواعد صلاحيات على مستوى الصفوف). تُحفظ المحادثات ما دام الحساب نشطًا؛ ويمكن للمستخدم حذف محادثاته بنفسه في أي وقت من داخل الخدمة.",
      "We apply reasonable safeguards (encrypted connections, access restricted by row-level security rules). Conversations are retained while the account is active, and users can delete their own conversations at any time from within the service.",
    ],
  },
  {
    h: ["٩. تسجيل الدخول عبر Google", "9. Signing in with Google"],
    p: [
      "عند اختيارك تسجيل الدخول عبر Google، نتلقى من Google اسمك وبريدك الإلكتروني وصورة ملفك الشخصي ومعرّف حسابك، ونستخدمها فقط لإنشاء حسابك وتسجيل دخولك والتعرف عليك داخل الخدمة. لا نبيع هذه البيانات ولا نشاركها لأغراض إعلانية، ولا تُستخدم في توليد أي محتوى أو في تدريب نماذج ذكاء اصطناعي، ولا تصل إلى مزودي النماذج. يخضع استخدامنا لبيانات مستخدمي Google لسياسة بيانات مستخدمي خدمات Google API بما فيها متطلبات الاستخدام المحدود (Limited Use). وتُحفظ بيانات حسابك ما دام حسابك نشطًا، وتُحذف عند حذف الحساب وفق قسم «حقوقك» أعلاه. ويمكنك في أي وقت مراجعة وصولنا إلى بيانات Google أو إلغاؤه من إعدادات حساب Google الخاص بك، كما يمكنك طلب حذف بيانات حسابك نهائيًا عبر support@hotgpt.pro.",
      "When you choose to sign in with Google, we receive from Google your name, email address, profile picture, and account ID, and we use them solely to create your account, sign you in, and identify you within the service. We do not sell this data or share it for advertising, and it is never used to generate content or to train AI models, nor is it sent to model providers. Our use of Google user data complies with the Google API Services User Data Policy, including its Limited Use requirements. Your account data is retained while your account is active and is deleted when you delete your account, as described in the 'Your rights' section above. You can review or revoke our access to your Google data at any time from your Google Account settings, and you can request permanent deletion of your account data via support@hotgpt.pro.",
    ],
  },
  {
    h: ["١٠. الامتثال لسياسات Google API", "10. Compliance with Google API policies"],
    p: [
      "يلتزم استخدام HotGPT لبيانات مستخدمي Google — وأي نقل لها إلى تطبيق آخر — بسياسة بيانات مستخدمي خدمات Google API، بما فيها متطلبات الاستخدام المحدود (Limited Use): تُستخدم بيانات Google حصرًا في تسجيل الدخول وإدارة الحساب داخل HotGPT، ولا تُنقل إلى مزودي نماذج الذكاء الاصطناعي، ولا تُستخدم في توليد أي محتوى — بما في ذلك أي محتوى حميمي مولّد بالذكاء الاصطناعي دون موافقة (AI NCII) — ولا في الإعلانات أو في بناء ملفات تعريف للمستخدمين.",
      "HotGPT's use of Google user data, and any transfer of it to another app, complies with the Google API Services User Data Policy, including the Limited Use requirements: Google user data is used exclusively for sign-in and account management within HotGPT; it is never transferred to AI model providers, never used to generate any content — including any AI-generated non-consensual intimate imagery (AI NCII) — and never used for advertising or for building user profiles.",
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
          <div className="mt-3 flex justify-end gap-2"><FbFollow /><BlogFollow /><SmolBadge /></div>
          <BrandClaim />
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
            <a className="text-amber-200 underline" href="/faq">{t("الأسئلة الشائعة", "FAQ")}</a>{" · "}
            <a className="text-amber-200 underline" href="https://hot-gpt.blogspot.com" target="_blank" rel="noopener noreferrer">{t("مدونة HotGPT", "HotGPT Blog")}</a>
          </footer>
        </div>
      </main>
    </LocalizedText>
  );
}
