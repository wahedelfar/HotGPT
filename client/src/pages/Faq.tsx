import { useEffect } from "react";
import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";

type FAQItem = { qAr: string; qEn: string; aAr: string; aEn: string };

const FAQ_ITEMS: FAQItem[] = [
  {
    qAr: "ما هو HotGPT؟",
    qEn: "What is HotGPT?",
    aAr: "HotGPT مساحة عمل ذكاء اصطناعي عربية للمطورين والباحثين: مساعدة في البرمجة وتحليل الكود، وأوضاع متخصصة في اختبار الاختراق وفحص الثغرات، وبحث ويب مباشر وبحث في الدارك ويب، وتوليد صور، وتقارير فحص أمان وSEO للروابط — بدون قيود على البحث والبرمجة، وبواجهة عربية وإنجليزية.",
    aEn: "HotGPT is an Arabic AI workspace for developers and researchers: programming and code-analysis help, specialized modes for penetration testing and vulnerability scanning, live web search and dark-web search, image generation, and security and SEO audit reports for URLs — with no limits on research and programming, in an Arabic and English interface.",
  },
  {
    qAr: "كم تبلغ أسعار HotGPT؟",
    qEn: "How much does HotGPT cost?",
    aAr: "الأسعار بالتوكن ومعروفة قبل ما تبعت: الرسالة العادية 1 توكن، وتحليل الملفات 3، والبحث على الويب 5، والصورة 5، وتقارير فحص الأمان والـ SEO بسعر 20 توكن للتقرير. الباقات: 100 توكن بـ 100 جنيه، و500 بـ 300، و800 بـ 500، و1000 بـ 700. وكل حساب جديد له هدية ترحيب 5 توكن.",
    aEn: "Pricing is in tokens and shown before you send: a normal message is 1 token, file analysis 3, web search 5, an image 5, and security or SEO audit reports are 20 tokens per report. Packs: 100 tokens for 100 EGP, 500 for 300, 800 for 500, and 1000 for 700. Every new account gets a 5-token welcome gift.",
  },
  {
    qAr: "كيف أدفع في HotGPT؟",
    qEn: "How can I pay on HotGPT?",
    aAr: "تقدر تدفع بفودافون كاش أو InstaPay أو PayPal. المدفوعات اليدوية بتتراجع ويتضاف الرصيد بعد التأكيد، ومدفوعات PayPal بتتضاف تلقائيًا فورًا.",
    aEn: "You can pay with Vodafone Cash, InstaPay, or PayPal. Manual payments are reviewed and credited after confirmation; PayPal payments are credited automatically and instantly.",
  },
  {
    qAr: "ما الفرق بين فحص الثغرات واختبار الاختراق؟",
    qEn: "What is the difference between a vulnerability scan and a penetration test?",
    aAr: "فحص الثغرات بحث آلي أو تحليلي عن نقاط ضعف معروفة في نظام أو موقع (إعدادات ناقصة، برمجيات قديمة، هيدرز أمان غائبة) من غير استغلال فعلي. اختبار الاختراق خطوة أعمق: خبير بيحاول يستغل الثغرات فعليًا زي المهاجم الحقيقي ليثبت حجم الخطر. الفحص بيوريك الخريطة، والاختبار بيوريك مين يقدر يدخل فعلًا.",
    aEn: "A vulnerability scan searches a system or website for known weaknesses (missing settings, outdated software, absent security headers) without actually exploiting them. A penetration test goes deeper: an expert tries to exploit the flaws like a real attacker to prove the actual risk. The scan shows you the map; the test shows you who can really get in.",
  },
  {
    qAr: "كيف أفحص أمان موقعي؟",
    qEn: "How can I check my website's security?",
    aAr: "ابدأ بالأساسيات اللي بتتفش من بره: هيدرز الأمان (CSP وX-Frame-Options وغيرها)، شهادة TLS وصلاحيتها، سجلات SPF وDMARC للبريد، والملفات الحساسة المكشوفة. خدمة فحص الأمان في HotGPT بتعمل الفحص ده كله من رابط موقعك وبتطلع تقريرًا بالدرجة والأدلة وخطوات الإصلاح، بسعر 20 توكن.",
    aEn: "Start with what can be seen from outside: security headers (CSP, X-Frame-Options and others), your TLS certificate and its validity, SPF and DMARC email records, and exposed sensitive files. HotGPT's security scan runs all of these checks from your site's URL and produces a report with a score, evidence and fix steps, for 20 tokens.",
  },
  {
    qAr: "كيف أبدأ تعلم الأمن السيبراني واختبار الاختراق؟",
    qEn: "How do I start learning cybersecurity and penetration testing?",
    aAr: "ابدأ بأساسيات الشبكات وأنظمة التشغيل (خصوصًا لينكس)، وبعدين لغة برمجة زي بايثون، وبعدين مفاهيم الويب وكيف بيشتغل HTTP. اتدرب فقط على بيئات مخصصة للتدريب ومواقع تملكها أو مصرح لك بفحصها، وكمل بقراءة تقارير ثغرات حقيقية. وجود مساعد ذكاء اصطناعي متخصص بيسرّع التعلم لأنه بيشرح لك الكود والثغرة وانت بتجرب.",
    aEn: "Start with networking and operating-system basics (especially Linux), then a language like Python, then how the web and HTTP work. Practice only in dedicated training environments and on systems you own or are authorized to test, and keep reading real vulnerability reports. A specialized AI assistant speeds up learning because it explains code and vulnerabilities while you practice.",
  },
  {
    qAr: "هل اختبار الاختراق قانوني؟",
    qEn: "Is penetration testing legal?",
    aAr: "اختبار الاختراق الأخلاقي قانوني لما يتعمل على أنظمة تملكها أو معاك تصريح مكتوب من صاحبها، وده شغل رسمي بتوظفه الشركات لحماية نفسها. فحص أو مهاجمة أي نظام من غير تصريح جريمة إلكترونية في أغلب الدول ومنها مصر. أدوات HotGPT للأغراض الدفاعية والبحثية فقط، على المواقع التي تملكها أو مصرح لك بفحصها.",
    aEn: "Ethical penetration testing is legal when done on systems you own or have written permission to test — it is an official job companies hire for to protect themselves. Scanning or attacking any system without permission is a cybercrime in most countries, including Egypt. HotGPT's tools are for defensive and research purposes only, on websites you own or are authorized to test.",
  },
  {
    qAr: "كيف أحمي موقعي من الاختراق؟",
    qEn: "How do I protect my website from hacking?",
    aAr: "حدّث كل حاجة باستمرار، فعّل هيدرز الأمان، استخدم كلمات مرور قوية ومصادقة ثنائية لحسابات الإدارة، اعزل الأسرار والمفاتيح عن الكود، راقب الملفات المكشوفة وسجلات الدخول، واعمل فحص أمان دوري عشان تكتشف الثغرات قبل غيرك. أغلب الاختراقات بتدخل من إعدادات مهملة مش من عبقرية المهاجم.",
    aEn: "Keep everything updated, enable security headers, use strong passwords and two-factor authentication for admin accounts, keep secrets and keys out of your code, watch for exposed files and login logs, and run periodic security scans to find flaws before others do. Most breaches walk in through neglected settings, not attacker genius.",
  },
  {
    qAr: "لماذا لا يظهر موقعي في نتائج جوجل؟",
    qEn: "Why doesn't my website appear on Google?",
    aAr: "الأسباب الشائعة: مفيش وصف تعريفي (meta description) مناسب، أو مفيش عناوين منظمة وبيانات منظمة (schema)، أو محتوى الصفحة قليل، أو سرعة الموقع بطيئة، أو مفيش روابط داخلية وخارجية للموقع. فحص الـ SEO في HotGPT بيراجع العناصر دي من رابط موقعك ويديك تقريرًا بالنتيجة والأدلة وقائمة تنفيذ بالأولوية، بسعر 20 توكن.",
    aEn: "Common reasons: a missing or weak meta description, no structured headings or schema data, thin page content, a slow site, or no internal and external links. HotGPT's SEO audit checks all of these from your site's URL and gives you a report with a score, evidence and a prioritized action list, for 20 tokens.",
  },
  {
    qAr: "ما هو الدارك ويب؟ وهل تصفحه قانوني؟",
    qEn: "What is the dark web, and is browsing it legal?",
    aAr: "الدارك ويب جزء من الإنترنت مش بيوصله المتصفح العادي وبيحتاج أدوات زي متصفح Tor، وبيستضيف منتديات وخدمات بعضها بحثي ومشروع وبعضها غير قانوني. مجرد التصفح مش جريمة في أغلب الدول، لكن التعامل مع الخدمات غير القانونية جريمة. وضع البحث المباشر في HotGPT بيبحث في فهارس الدارك ويب العامة لأغراض البحث والتحليل الأمني.",
    aEn: "The dark web is a part of the internet that normal browsers cannot reach and that needs tools like the Tor Browser; it hosts forums and services, some of them research-oriented and legitimate, others illegal. Browsing itself is not a crime in most countries, but using illegal services is. HotGPT's live search mode searches public dark-web indexes for security research and analysis.",
  },
  {
    qAr: "كيف يساعدني الذكاء الاصطناعي في البرمجة؟",
    qEn: "How can AI help me with programming?",
    aAr: "بيكتب كود وبيشرحه، بيصلح الأخطاء ويفسر رسايلها، بيحلل ملفات ومشاريع كاملة، بيقترح بنية وتصميم، وبيكتب اختبارات وتوثيق. الفرق بين أداة عامة وأداة متخصصة إن المتخصصة فاهمة سياق المطورين والباحثين وبتجاوب بعمق تقني من غير ما تلف حوالين السؤال.",
    aEn: "It writes and explains code, fixes bugs and interprets their errors, analyzes files and whole projects, suggests architecture and design, and writes tests and documentation. The difference between a general tool and a specialized one is that the specialized tool understands the developer and researcher context and answers with technical depth instead of circling the question.",
  },
  {
    qAr: "كيف أختار أداة ذكاء اصطناعي للبرمجة والأمن السيبراني؟",
    qEn: "How do I choose an AI tool for programming and cybersecurity?",
    aAr: "قارن بخمسة معايير: التخصص في مجالك بدل العمومية، دعم لغتك (خصوصًا العربي)، شفافية الأسعار قبل الاستخدام، قوة النماذج المستخدمة في المهام الصعبة، وسياسة الخصوصية لبياناتك وكودك. HotGPT مبني حوالين المعايير دي للمطورين والباحثين العرب.",
    aEn: "Compare on five criteria: specialization in your field instead of generality, support for your language (especially Arabic), transparent pricing before you use it, the strength of the models behind hard tasks, and the privacy policy for your data and code. HotGPT is built around these criteria for Arab developers and researchers.",
  },
  {
    qAr: "هل محادثاتي وبياناتي خاصة في HotGPT؟",
    qEn: "Are my conversations and data private on HotGPT?",
    aAr: "أيوه. محادثاتك محفوظة جوه حسابك ومش بتظهر لحد تاني، والصور اللي بتتولد مش بتتخزن على السيرفر (بتظهر في جلستك بس، فاحفظها على جهازك). تفاصيل أكتر في سياسة الخصوصية المنشورة على الموقع.",
    aEn: "Yes. Your conversations are stored inside your account and are not shown to anyone else, and generated images are not stored on the server (they appear in your session only, so save them to your device). More detail is in the privacy policy published on the site.",
  },
  {
    qAr: "ما هي باقة HotLucky؟",
    qEn: "What is the HotLucky pack?",
    aAr: "باقة HotLucky: بـ 50 جنيه خد من 25 لـ 100 رسالة — تشتري الباقة وتلف العجلة، وأقل حاجة هتاخدها 25 توكن، مفيش خسارة. الجوائز بتتضاف لرصيدك فورًا وتقدر تستخدمها في أي وضع أو خدمة في الموقع.",
    aEn: "The HotLucky pack: for 50 EGP you get between 25 and 100 messages — buy the pack and spin the wheel; the least you can get is 25 tokens, there is no losing outcome. Prizes are added to your balance instantly and can be used in any mode or service on the site.",
  },
];

function linkedAnswer(text: string, language: "ar" | "en") {
  const labels = language === "ar"
    ? [
        ["حساب جديد", "/auth"],
        ["الباقات", "/billing"],
        ["سياسة الخصوصية", "/privacy"],
        ["الجوائز", "/rewards"],
      ]
    : [
        ["new account", "/auth"],
        ["Packs", "/billing"],
        ["privacy policy", "/privacy"],
        ["Prizes", "/rewards"],
      ];
  const matches = labels
    .map(([label, href]) => ({ label, href, index: text.indexOf(label) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  if (!matches.length) return text;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.index < cursor) continue;
    nodes.push(text.slice(cursor, match.index));
    nodes.push(<a key={match.href} href={match.href} className="text-amber-200 underline hover:text-white">{match.label}</a>);
    cursor = match.index + match.label.length;
  }
  nodes.push(text.slice(cursor));
  return nodes;
}

export default function FaqPage() {
  const { language } = useAppLanguage();
  const items = FAQ_ITEMS.map((item) => ({
    question: language === "ar" ? item.qAr : item.qEn,
    answer: language === "ar" ? item.aAr : item.aEn,
  }));

  useEffect(() => {
    const existing = document.querySelector('script[data-hotgpt-faq-schema="true"]');
    existing?.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.hotgptFaqSchema = "true";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [language]);

  return (
    <LocalizedText>
      <main dir={language === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#090909] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <a href="/" className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-white">
              {language === "ar" ? "← العودة إلى HotGPT" : "← Back to HotGPT"}
            </a>
            <LanguageToggle inline />
          </div>
          <header className="my-8 rounded-3xl border border-amber-200/35 bg-gradient-to-br from-amber-200/10 to-transparent p-6 sm:p-9">
            <h1 className="text-3xl font-black sm:text-4xl">{language === "ar" ? "الأسئلة الشائعة" : "Frequently Asked Questions"}</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {language === "ar"
                ? "إجابات مباشرة عن أسئلة الأمن السيبراني واختبار الاختراق وفحص الثغرات والبرمجة، وعن خدمات HotGPT وأسعاره."
                : "Direct answers about cybersecurity, penetration testing, vulnerability scanning and programming — and about HotGPT's services and pricing."}
            </p>
          </header>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item, index) => (
              <section key={item.qEn} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
                <h2 className="text-lg font-bold">{language === "ar" ? item.qAr : item.qEn}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {linkedAnswer(language === "ar" ? item.aAr : item.aEn, language)}
                </p>
              </section>
            ))}
          </div>
        </div>
      </main>
    </LocalizedText>
  );
}
