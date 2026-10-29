import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";

// Models page (2026-10-29, owner request): a standalone introduction to the
// HotGPT family — separate from the packs page — with a CTA into /billing.
// Copy follows the house rules: HotGPT family names only (never an underlying
// model/provider), flat token prices known upfront, blood/gold theme.

type ModelCard = {
  title: [string, string];
  desc: [string, string];
  price: [string, string];
};

const MODELS: ModelCard[] = [
  {
    title: ["HotGPT — الافتراضي اليومي", "HotGPT — the everyday default"],
    desc: [
      "مساعدك اليومي للبرمجة وكتابة الكود والإجابة عن الأسئلة والتحليل العام — سريع ومباشر ومناسب لشغل كل يوم.",
      "Your everyday assistant for programming, writing code, answering questions and general analysis — fast, direct, and made for daily work.",
    ],
    price: ["رسالة: 1 توكين · تحليل ملف مرفق: 3 توكينات", "Message: 1 token · attached-file analysis: 3 tokens"],
  },
  {
    title: ["HotGPT الوحش PRO", "HotGPT Alwahsh PRO"],
    desc: [
      "أقوى أوضاعنا للتحليل العميق والبرمجة المتقدمة والأمن الرقمي واختبار الاختراق — إجابة مرحلية معمّقة، وتكمل بقية التقرير بمرحلة ثانية بنفس السعر.",
      "Our strongest mode for deep analysis, advanced programming, digital security and penetration testing — a staged in-depth answer, continued with a second stage at the same price.",
    ],
    price: ["5 توكينات للمرحلة", "5 tokens per stage"],
  },
  {
    title: ["HotGPT Dark", "HotGPT Dark"],
    desc: [
      "وضع استخبارات الويب المظلم: أسواق ومنتديات وتسريبات وفاعلو تهديد — صورة استخباراتية كاملة بمصادر وتحليل معمّق.",
      "The dark-web intelligence mode: markets, forums, leaks and threat actors — a full intelligence picture with sources and deep analysis.",
    ],
    price: ["5 توكينات للمرحلة", "5 tokens per stage"],
  },
  {
    title: ["Dark Live — الدارك المباشر", "Dark Live"],
    desc: [
      "خدمة Premium مستقلة بمحرك خاص: بحث حي ومباشر في فهارس الدارك ويب بنتائج وروابط حقيقية وقت حدوثها.",
      "A standalone Premium service with its own engine: live search across dark-web indexes with real results and links as they happen.",
    ],
    price: ["خدمة Premium", "Premium service"],
  },
  {
    title: ["بحث الويب المباشر", "Live web search"],
    desc: [
      "عملية بحث كاملة في الويب بإجابة واحدة مدعومة بالمصادر — والبحث الموسّع العميق يعمل بالمراحل.",
      "A complete web search in a single answer backed by sources — extended deep research runs in stages.",
    ],
    price: ["5 توكينات", "5 tokens"],
  },
  {
    title: ["توليد الصور", "Image generation"],
    desc: [
      "حوّل وصفك المكتوب إلى صورة جاهزة — أو صورة CGI واقعية بأسلوب إعلانات FOOH من وصف قصير. واحفظ صورتك على جهازك بعد توليدها.",
      "Turn your written description into a finished image — or a photorealistic CGI image in the FOOH ad style from a short brief. Save your image to your device after generating it.",
    ],
    price: ["صورة عادية: 5 توكينات · صورة CGI: ‏10 توكينات", "Normal image: 5 tokens · CGI image: 10 tokens"],
  },
  {
    title: ["محترف الـ SEO", "SEO Pro"],
    desc: [
      "تقرير مفصّل لسيو موقعك وتوصيات عملية لتحسين ظهوره في Google.",
      "A detailed SEO report for your site with practical recommendations to improve its visibility on Google.",
    ],
    price: ["تقرير كامل 20 توكين", "Full report, 20 tokens"],
  },
  {
    title: ["محترف فحص الأمان", "Security Scan Pro"],
    desc: [
      "نموذج مخصص لفحص أمان موقعك ودرجة الخطورة وتوصيات لسدّ ثغراته وحمايته.",
      "A dedicated model that scans your site's security, rates the severity, and recommends how to close its vulnerabilities and protect it.",
    ],
    price: ["تقرير كامل 20 توكين", "Full report, 20 tokens"],
  },
  {
    title: ["استخراج العملاء", "Lead extraction"],
    desc: [
      "بيانات شركات حقيقية من خرائط جوجل حسب النشاط والمنطقة: الاسم ورقم التليفون والعنوان والموقع الإلكتروني والتقييم — لحد 30 شركة في الاستخراج الواحد.",
      "Real business data from Google Maps by business type and area: name, phone number, address, website and rating — up to 30 businesses in a single extraction.",
    ],
    price: ["استخراج كامل 20 توكين", "Full extraction, 20 tokens"],
  },
];

export default function ModelsPage() {
  const { language } = useAppLanguage();
  const t = (ar: string, en: string) => (language === "ar" ? ar : en);
  const pick = (pair: [string, string]) => (language === "ar" ? pair[0] : pair[1]);

  return (
    <LocalizedText>
      <main dir={language === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#080b10] px-4 py-8 text-white sm:px-8">
        <LanguageToggle />
        <a href="/" aria-label={t("العودة إلى الرئيسية", "Back to home")} className="fixed left-4 top-4 z-30 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#11151b]/95 px-4 py-2 text-sm text-amber-300 shadow-lg backdrop-blur hover:bg-white/10">
          <span aria-hidden="true">⌂</span>
          <span>{t("الرئيسية", "Home")}</span>
        </a>
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 text-center">
            <img src="/brand/logo.png" alt="HotGPT" className="mx-auto h-24 w-24 object-contain" />
            <p className="mt-3 text-5xl font-black tracking-wide text-amber-400">HotGPT</p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs font-bold tracking-[.25em] text-amber-400">HOTGPT MODELS</p>
            <h1 className="mt-2 text-3xl font-bold">{t("تعرّف على نماذجنا", "Meet our models")}</h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {t(
                "عائلة واحدة من النماذج المتخصصة للمطورين والباحثين — كل نموذج له شغلته وسعره الثابت بالتوكين، تعرفه قبل ما تبدأ.",
                "One family of specialized models for developers and researchers — every model has its job and its flat token price, known before you start."
              )}
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {MODELS.map(model => (
              <div key={model.title[1]} className="rounded-xl border border-amber-400/20 bg-black/30 p-5">
                <div className="font-bold">{pick(model.title)}</div>
                <p className="mt-1 text-sm leading-6 text-slate-400">{pick(model.desc)}</p>
                <p className="mt-2 text-sm">
                  <strong className="text-amber-400">{pick(model.price)}</strong>
                </p>
              </div>
            ))}
          </div>

          <section className="mt-10 rounded-2xl border border-[#C9A227]/50 bg-[#1A0505] p-6 text-center md:p-8">
            <h2 className="text-xl font-bold">{t("جاهز تبدأ؟", "Ready to start?")}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
              {t(
                "التسجيل مجاني وبيبدأ بـ5 توكينات هدية ترحيب — وباقة البداية 100 توكين مقابل 100 جنيه تكفي تقريبًا 100 رسالة أو 20 صورة.",
                "Registration is free and starts with a 5-token welcome gift — and the Starter pack of 100 tokens for 100 EGP covers roughly 100 messages or 20 images."
              )}
            </p>
            <a href="/billing" className="mt-5 inline-block rounded-full bg-gradient-to-b from-[#F6C453] via-[#E8A020] to-[#B97A0F] px-8 py-3 font-black text-[#231300] shadow-[0_10px_28px_rgba(232,160,32,.35)] transition hover:brightness-110">
              {t("عرض الباقات وشحن الرصيد", "See the packs & top up")}
            </a>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
              <a href="/" className="text-amber-300 hover:underline">{t("الرئيسية", "Home")}</a>
              <a href="/rewards" className="text-amber-300 hover:underline">{t("صفحة الجوائز", "Rewards")}</a>
              <a href="/faq" className="text-amber-300 hover:underline">{t("الأسئلة الشائعة", "FAQ")}</a>
            </div>
          </section>
        </div>
      </main>
    </LocalizedText>
  );
}
