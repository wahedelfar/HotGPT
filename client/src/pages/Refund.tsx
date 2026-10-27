import { LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";
import { RotateCcw } from "lucide-react";

// Refund Policy — DRAFT for owner approval (2026-10-27). Figures
// marked as proposals (14-day window, 3-business-day review) need the
// owner's explicit confirmation before this page is published.

type Section = { h: [string, string]; p: [string, string] };
const SECTIONS: Section[] = [
  {
    h: ["١. طبيعة المنتج", "1. Nature of the product"],
    p: [
      "التوكنات أرصدة رقمية تُسلَّم فورًا إلى حسابك داخل المنصة وتُستهلك عند تنفيذ الإجراءات. قواعد الاسترداد التالية تفصل بين ما لم يُسلَّم، وما سُلِّم ولم يُستخدم، وما استُخدم فعليًا.",
      "Tokens are digital credits delivered instantly to your in-platform account and consumed as actions are executed. The rules below distinguish between what was never delivered, what was delivered but unused, and what has actually been consumed.",
    ],
  },
  {
    h: ["٢. قبل إضافة الرصيد", "2. Before crediting"],
    p: [
      "أي عملية شراء لم يُعتمد رصيدها بعد (دفعة معلقة أو مرفوضة تقنيًا رغم الخصم) تُرد قيمتها كاملة إلى وسيلة الدفع نفسها فور ثبوت عدم الإضافة.",
      "Any purchase whose balance was never credited (a pending payment, or one technically rejected despite being charged) is refunded in full to the same payment method as soon as non-delivery is confirmed.",
    ],
  },
  {
    h: ["٣. رصيد مُسلَّم ولم يُستخدم", "3. Delivered but unused balance"],
    p: [
      "إذا أُضيف رصيد باقة إلى حسابك ولم يُنفق منه شيء، يمكنك طلب استرداد قيمته إلى وسيلة الدفع نفسها خلال ١٤ يومًا من الشراء. عند الاسترداد يُخصم الرصيد غير المستخدم بالكامل من الحساب.",
      "If a purchased pack was credited to your account and none of it was spent, you may request a refund to the same payment method within 14 days of purchase. On refund, the unused balance is removed from the account in full.",
    ],
  },
  {
    h: ["٤. الرصيد المستخدم", "4. Consumed balance"],
    p: [
      "التوكنات التي استُهلكت فعليًا في إجابات أو عمليات بحث أو صور أو تقارير أو مراحل مكتملة لا تُسترد قيمتها، لأن الخدمة الرقمية المقابلة نُفذت وسُلّمت. إذا فشل إجراء تقنيًا ورغم ذلك خُصم سعره، يُعاد سعره تلقائيًا إلى رصيدك (كما يحدث في تقارير الفحص الفاشلة).",
      "Tokens actually consumed on answers, searches, images, reports, or completed stages are non-refundable, because the corresponding digital service was executed and delivered. If an action fails technically yet its price was charged, the price is automatically returned to your balance (as already happens with failed scan reports).",
    ],
  },
  {
    h: ["٥. HotLucky", "5. HotLucky"],
    p: [
      "تذاكر HotLucky المعتمدة التي لم تُلعب بعد قابلة للاسترداد بطلب إلى الإدارة، ما لم تكن ناتجة عن دفعة متنازع عليها. نتيجة اللفة المنفذة نهائية ولا تُسترد قيمتها — كما هو منصوص في شروط اللعبة.",
      "Approved HotLucky tickets that have not been played yet are refundable on request to the administration, unless they originated from a disputed payment. A played spin's result is final and its value is non-refundable — as stated in the game's terms.",
    ],
  },
  {
    h: ["٦. مدفوعات PayPal", "6. PayPal payments"],
    p: [
      "استردادات PayPal تُنفذ عبر PayPal إلى مصدر التمويل الأصلي، وتخضع مدد المعالجة لسياسات PayPal والبنك المصدر للبطاقة. لا يمكن تحويل استرداد PayPal إلى محفظة محلية أو العكس.",
      "PayPal refunds are issued through PayPal to the original funding source, and processing times follow PayPal's and the card issuer's policies. A PayPal refund cannot be redirected to a local wallet, or vice versa.",
    ],
  },
  {
    h: ["٧. طريقة الطلب", "7. How to request"],
    p: [
      "راسل support@hotgpt.pro من بريد حسابك مع تفاصيل العملية (الوسيلة والمبلغ والتوقيت وصورة الإثبات عند الحاجة). تُراجع الطلبات خلال ٣ أيام عمل كحد أقصى، ويُخطرك فريقنا بالنتيجة وسببها إن رُفض الطلب.",
      "Email support@hotgpt.pro from your account email with the transaction details (method, amount, time, and the proof image if needed). Requests are reviewed within 3 business days at most, and you will be notified of the outcome — and the reason, if a request is declined.",
    ],
  },
];

export default function RefundPage() {
  const { language } = useAppLanguage();
  const t = (ar: string, en: string) => (language === "ar" ? ar : en);
  return (
    <LocalizedText>
      <main dir={language === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#090909] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-3xl">
          <a href="/" className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-white">{t("← العودة إلى HotGPT", "← Back to HotGPT")}</a>
          <header className="my-8 rounded-3xl border border-amber-200/35 bg-gradient-to-br from-amber-200/10 to-transparent p-6 sm:p-9">
            <div className="flex items-center gap-3 text-amber-200"><RotateCcw size={26} /><span className="text-xs font-bold tracking-widest">HOTGPT · REFUNDS</span></div>
            <h1 className="mt-4 text-3xl font-black sm:text-4xl">{t("سياسة الاسترداد", "Refund Policy")}</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">{t("قواعد واضحة قبل أن تدفع: متى يرجع مالك، ومتى لا.", "Clear rules before you pay: when your money comes back, and when it does not.")}</p>
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
            <a className="text-amber-200 underline" href="/privacy">{t("سياسة الخصوصية", "Privacy Policy")}</a>{" · "}
            <a className="text-amber-200 underline" href="/lucky-terms">{t("شروط HotLucky", "HotLucky Terms")}</a>
          </footer>
        </div>
      </main>
    </LocalizedText>
  );
}
