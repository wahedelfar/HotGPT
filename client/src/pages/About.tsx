import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";

type Section = { hAr: string; hEn: string; bAr: string; bEn: string };

const SECTIONS: Section[] = [
  {
    hAr: "ما هو HotGPT؟",
    hEn: "What is HotGPT?",
    bAr: "HotGPT مساحة عمل ذكاء اصطناعي متكاملة للمطورين والمسوقين وشركات تطوير المواقع: محادثات ذكية، كتابة وتصحيح أكواد، تحليل ملفات، توليد صور وCGI، فحص أمني وSEO للمواقع، بحث حي، واستخراج بيانات عملاء — كل الأدوات في مكان واحد، بواجهة كاملة بالعربي والإنجليزي وبدون قيود على البحث والبرمجة.",
    bEn: "HotGPT is a complete AI workspace for developers, marketers and web development companies: smart chat, code writing and debugging, file analysis, image and CGI generation, website security and SEO audits, live search, and customer lead extraction — every tool in one place, with a full Arabic and English interface and no limits on research and programming.",
  },
  {
    hAr: "ماذا نقدم؟",
    hEn: "What do we offer?",
    bAr: "عائلة نماذج لكل مهمة: النموذج الافتراضي للشغل اليومي، والوحش PRO للمهام العميقة، وDark وDark Live للبحث المتخصص، ومحترف فحص الأمان الذي يحوّل رابط أي موقع إلى تقرير أمني بالأدلة وخطوات الإصلاح، ومحترف الـ SEO الذي يبني تقرير نمو بخطة تنفيذ، وأداة استخراج العملاء التي تجمع بيانات شركات حقيقية من خرائط جوجل، وتوليد الصور والـ CGI.",
    bEn: "A model family for every job: the default model for daily work, the Beast PRO for deep tasks, Dark and Dark Live for specialized research, the Security Scan Pro that turns any site URL into an evidence-based security report with fix steps, the SEO Pro that builds a growth report with an action plan, the lead-extraction tool that collects real business data from Google Maps, and image and CGI generation.",
  },
  {
    hAr: "لمن صُنع HotGPT؟",
    hEn: "Who is HotGPT made for?",
    bAr: "صُنع لمن يبنون أنفسهم مهنيًا: مطورون ومسوقون وشركات تطوير مواقع يحتاجون أدوات قوية بلا اشتراكات أجنبية غالية وبلا فيزا للدفع بالدولار. لذلك أسعارنا بالجنيه المصري، والدفع بفودافون كاش وإنستاباي وPayPal، وباقاتنا تبدأ من 100 جنيه — أرخص اشتراك في مصر.",
    bEn: "It is made for people building themselves professionally: developers, marketers and web development companies who need powerful tools without expensive foreign subscriptions or a Visa for dollar payments. That is why our pricing is in Egyptian pounds, payment is by Vodafone Cash, InstaPay and PayPal, and our packs start at 100 EGP — the cheapest subscription in Egypt.",
  },
  {
    hAr: "وعدنا لك",
    hEn: "Our promise",
    bAr: "ثلاث قواعد لا تتغير: الأسعار ثابتة ومعروفة قبل ما تبعت أي طلب، فلا مفاجآت في رصيدك أبدًا. وتقاريرنا مبنية على بيانات حقيقية نجمعها وقت الفحص، من غير أي رقم مخترع. وكل عضو يخرج من عندنا بمعلومة حقيقية تنفعه حتى لو لم يشترك — لأن اللي بيتعلم عندنا النهاردة بيرجع لنا بكرة.",
    bEn: "Three rules that never change: prices are flat and known before you send anything, so your balance never holds a surprise. Our reports are built on real data collected at scan time, with no invented numbers. And every member leaves with real knowledge that helps them even if they never subscribe — because whoever learns with us today comes back tomorrow.",
  },
  {
    hAr: "تواصل معنا",
    hEn: "Contact us",
    bAr: "الدعم الفني: hotgpt.pro@gmail.com — الإدارة: wawavip@proton.me. سجّل حسابك وخد هدية الترحيب: 5 محادثات مجانية، وجرّب بنفسك قبل ما تدفع أي حاجة.",
    bEn: "Technical support: hotgpt.pro@gmail.com — Administration: wawavip@proton.me. Create your account and claim the welcome gift: 5 free conversations, and try everything yourself before paying anything.",
  },
];

export default function AboutPage() {
  const { language } = useAppLanguage();
  const ar = language === "ar";
  return (
    <LocalizedText>
      <main dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-[#090909] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <a href="/" className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-white">
              {ar ? "← العودة إلى HotGPT" : "← Back to HotGPT"}
            </a>
            <LanguageToggle inline />
          </div>
          <header className="my-8 rounded-3xl border border-amber-200/35 bg-gradient-to-br from-amber-200/10 to-transparent p-6 sm:p-9">
            <h1 className="text-3xl font-black sm:text-4xl">{ar ? "من نحن" : "About Us"}</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {ar
                ? "ذكاء اصطناعي للمطورين والمسوقين وشركات تطوير المواقع — أدوات احترافية بسعر مصري ودفع محلي، ووعد واحد: معلومة حقيقية لكل عضو."
                : "AI for developers, marketers and web development companies — professional tools at an Egyptian price with local payment, and one promise: real knowledge for every member."}
            </p>
          </header>
          <div className="space-y-4">
            {SECTIONS.map((section) => (
              <section key={section.hEn} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                <h2 className="text-lg font-bold">{ar ? section.hAr : section.hEn}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">{ar ? section.bAr : section.bEn}</p>
              </section>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a
              href="/auth?mode=signup"
              className="inline-block rounded-xl bg-gradient-to-l from-amber-300 to-amber-500 px-8 py-3 text-base font-black text-[#1A0505] hover:brightness-110"
            >
              {ar ? "ابدأ مجانًا — ٥ محادثات هدية" : "Start free — 5 free conversations"}
            </a>
          </div>
        </div>
      </main>
    </LocalizedText>
  );
}
