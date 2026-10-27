import { LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";
import { ShieldCheck } from "lucide-react";

// Site Terms of Service — DRAFT for owner approval (2026-10-27).
// Section 7 carries the site-wide liability clause verbatim, identical
// to LuckyTerms section 8, as the owner established it.

type Section = { h: [string, string]; p: [string, string] };
const SECTIONS: Section[] = [
  {
    h: ["١. الخدمة", "1. The service"],
    p: [
      "HotGPT منصة محادثة بالذكاء الاصطناعي متخصصة في البرمجة والتحليل الأمني والبحث الرقمي، تقدم أوضاعًا متعددة (المساعد الافتراضي، الوحش PRO، Dark، Dark Live، وخدمة فحص الروابط). تُقدَّم الخدمة «كما هي» وقد تتغير خصائصها أو أسعارها مستقبلًا دون أثر رجعي على أرصدة قائمة.",
      "HotGPT is an AI chat platform specialized in programming, security analysis, and digital research, offering several modes (the default assistant, Beast PRO, Dark, Dark Live, and the URL scan service). The service is provided \"as is\"; features and prices may change prospectively, with no retroactive effect on existing balances.",
    ],
  },
  {
    h: ["٢. الحساب والأهلية", "2. Accounts and eligibility"],
    p: [
      "استخدام المنصة مخصص لمن بلغوا ١٨ عامًا فأكثر. المستخدم مسؤول عن سرية بيانات دخوله وعن كل نشاط يتم عبر حسابه، وعن صحة البريد الإلكتروني المسجل به. يحق للإدارة إيقاف أي حساب يثبت إساءته للخدمة أو محاولته التحايل على أنظمة الرصيد والدفع.",
      "The platform is for users aged 18 and over. You are responsible for keeping your login credentials confidential, for all activity under your account, and for the accuracy of your registered email. The administration may suspend any account proven to abuse the service or to circumvent its balance and payment systems.",
    ],
  },
  {
    h: ["٣. التوكنات", "3. Tokens"],
    p: [
      "التوكن هو رصيد رقمي داخلي يُستهلك مقابل الإجراءات داخل المنصة بالأسعار المعلنة قبل التنفيذ (رسالة، بحث، صورة، مرحلة إجابة، تقرير فحص، وغيرها). التوكنات ليست نقودًا، ولا تُحوَّل بين الحسابات، ولا تُستبدل بنقد بأي صورة. هدية الترحيب (٥ توكنات) تُمنح مرة واحدة لكل حساب عند أول استخدام.",
      "A token is an internal digital credit consumed by in-platform actions at the prices published before execution (a message, a search, an image, an answer stage, a scan report, and others). Tokens are not money, are not transferable between accounts, and are never redeemable for cash. The welcome gift (5 tokens) is granted once per account on first use.",
    ],
  },
  {
    h: ["٤. الدفع", "4. Payments"],
    p: [
      "يتم الدفع يدويًا عبر Vodafone Cash أو InstaPay مع مراجعة بشرية لإثبات التحويل، أو تلقائيًا عبر PayPal. إرسال إثبات التحويل لا يعني اعتماد الرصيد؛ الاعتماد يتم بعد تحقق الإدارة من المعاملة أو بعد تأكيد PayPal الآلي. سياسة الاسترداد منشورة في صفحة مستقلة وجزء من هذه الشروط.",
      "Payment is made manually via Vodafone Cash or InstaPay with human review of the transfer proof, or automatically via PayPal. Submitting a proof does not itself credit a balance; crediting happens after the administration verifies the transaction or after PayPal's automated confirmation. The refund policy is published on its own page and forms part of these terms.",
    ],
  },
  {
    h: ["٥. طبيعة المحتوى والاستخدام المسؤول", "5. Nature of content and responsible use"],
    p: [
      "المنصة أداة احترافية موجهة للمبرمجين وباحثي الأمن؛ المحتوى الأمني المتقدم (منهجيات اختبار الاختراق، تحليل الثغرات، استخبارات التهديدات) مقدَّم لأغراض الاختبار المصرّح به والبحث والدفاع. المستخدم وحده يقرر طلباته وكيفية توظيف المخرجات، ويتحمل وحده المسؤولية القانونية الكاملة عن أي استخدام، كما هو مفصّل في مادة المسؤولية أدناه.",
      "The platform is a professional tool aimed at programmers and security researchers; advanced security content (penetration-testing methodology, vulnerability analysis, threat intelligence) is provided for authorized testing, research, and defense. The user alone decides their requests and how outputs are used, and bears sole full legal responsibility for any use, as detailed in the liability section below.",
    ],
  },
  {
    h: ["٦. HotLucky", "6. HotLucky"],
    p: [
      "لعبة HotLucky خدمة ترويجية منفصلة داخل المنصة تحكمها شروطها وأحكامها الخاصة المنشورة في صفحتها، بما فيها الجوائز والاحتمالات المعلنة وسياسة استرداد التذاكر.",
      "HotLucky is a separate promotional service within the platform, governed by its own published terms and conditions, including its prizes, published odds, and ticket refund policy.",
    ],
  },
  {
    h: ["٧. مسؤولية الاستخدام", "7. Liability for use"],
    p: [
      "تنطبق هذه المادة على جميع خدمات HotGPT وباقاتها. تُقدَّم الخدمة كما هي، كأداة ذكاء اصطناعي عامة، والمستخدم وحده مسؤول قانونيًا عن كل طلب يرسله وعن أي استخدام أو نشر أو تنفيذ لمخرجات الخدمة، ولا تتحمل المنصة أي مسؤولية عن استخدام يخالف قوانين بلد المستخدم. استمرارك في الاستخدام يعني قبولك بهذا البند.",
      "This section applies to all HotGPT services and plans. The service is provided as is, as a general AI tool; the user alone is legally responsible for every request they send and for any use, publication, or execution of the service's outputs, and the platform bears no responsibility for any use that violates the laws of the user's country. Your continued use constitutes acceptance of this clause.",
    ],
  },
  {
    h: ["٨. التوفر والدقة", "8. Availability and accuracy"],
    p: [
      "مخرجات الذكاء الاصطناعي قد تحتوي على أخطاء؛ تقع على المستخدم مسؤولية التحقق من أي مخرجات قبل الاعتماد عليها مهنيًا. تبذل الإدارة جهدًا معقولًا لاستمرارية الخدمة دون ضمان انعدام الانقطاع.",
      "AI outputs may contain errors; the user is responsible for verifying any output before relying on it professionally. The administration makes reasonable efforts to keep the service available without guaranteeing uninterrupted operation.",
    ],
  },
  {
    h: ["٩. التعديلات والتواصل", "9. Changes and contact"],
    p: [
      "قد تُحدَّث هذه الشروط عند الحاجة، ويُعد استمرار الاستخدام بعد النشر قبولًا بالتحديث. للتواصل: support@hotgpt.pro",
      "These terms may be updated when needed; continued use after publication constitutes acceptance of the update. Contact: support@hotgpt.pro",
    ],
  },
];

export default function TermsPage() {
  const { language } = useAppLanguage();
  const t = (ar: string, en: string) => (language === "ar" ? ar : en);
  return (
    <LocalizedText>
      <main dir={language === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#090909] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-3xl">
          <a href="/" className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-white">{t("← العودة إلى HotGPT", "← Back to HotGPT")}</a>
          <header className="my-8 rounded-3xl border border-amber-200/35 bg-gradient-to-br from-amber-200/10 to-transparent p-6 sm:p-9">
            <div className="flex items-center gap-3 text-amber-200"><ShieldCheck size={26} /><span className="text-xs font-bold tracking-widest">HOTGPT · TERMS</span></div>
            <h1 className="mt-4 text-3xl font-black sm:text-4xl">{t("الشروط والأحكام", "Terms of Service")}</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">{t("باستخدامك HotGPT فأنت توافق على هذه الشروط بالكامل.", "By using HotGPT you agree to these terms in full.")}</p>
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
            <a className="text-amber-200 underline" href="/privacy">{t("سياسة الخصوصية", "Privacy Policy")}</a>{" · "}
            <a className="text-amber-200 underline" href="/refund">{t("سياسة الاسترداد", "Refund Policy")}</a>{" · "}
            <a className="text-amber-200 underline" href="/lucky-terms">{t("شروط HotLucky", "HotLucky Terms")}</a>
          </footer>
        </div>
      </main>
    </LocalizedText>
  );
}
