import type { ReactNode } from "react";
import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";
import BrandClaim from "@/components/BrandClaim";
import FbFollow, { BlogFollow, SmolBadge , RedditFollow, YoutubeFollow } from "@/components/FbFollow";

const GOLD_LINK = { color: "#F6C453", fontWeight: 700, textDecoration: "underline" } as const;

function Steps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="mt-4 space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-xs font-black text-amber-300">{i + 1}</span>
          <span className="text-sm leading-7 text-slate-300">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function PaymentGuidePage() {
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

          <div className="mt-3 flex justify-end gap-2"><FbFollow /><BlogFollow /><RedditFollow /><YoutubeFollow /><SmolBadge /></div>
          <BrandClaim />
          <header className="my-8 rounded-3xl border border-amber-200/35 bg-gradient-to-br from-amber-200/10 to-transparent p-6 sm:p-9">
            <h1 className="text-3xl font-black sm:text-4xl">{ar ? "وسائل الدفع وطريقة الاشتراك" : "Payment methods & how to subscribe"}</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {ar
                ? "اشتراك HotGPT شهري وبسيط: بتختار اشتراكك، والرصيد بيوصلك وبتستخدمه في كل الأدوات وقت ما تحتاج — ومن غير أي خصم أو تجديد تلقائي، التجديد بإيدك وقت ما تحب. الصفحة دي بتشرح كل وسيلة دفع خطوة بخطوة — من اختيار الاشتراك لحد ما رصيدك يوصلك."
                : "HotGPT is a simple monthly subscription: you choose your plan, the balance lands in your account and you use it across every tool whenever you need — with no automatic charge or renewal; renewing is in your hands whenever you like. This page explains every payment method step by step — from choosing your plan until your balance reaches you."}
            </p>
          </header>

          <div className="space-y-4">
            <Section title={ar ? "الرحلة باختصار — من الدفع لوصول رصيدك" : "The journey in short — from payment to your balance"}>
              <Steps
                steps={
                  ar
                    ? [
                        "اختر اشتراكك المناسب من صفحة الاشتراك.",
                        "حوّل مبلغ اشتراكك بالظبط بالوسيلة اللي تناسبك.",
                        "ارفع صورة إثبات التحويل من صفحة الاشتراك.",
                        "بينزلك رصيد هدية فورًا تستخدمه أثناء المراجعة.",
                        "المراجعة بتتم خلال دقائق.",
                        "رصيد اشتراكك بينزل كامل في حسابك، ويوصلك تنبيه لو فعّلته.",
                      ]
                    : [
                        "Choose the right plan on the subscription page.",
                        "Transfer the exact plan amount with the method that suits you.",
                        "Upload your transfer proof on the subscription page.",
                        "A gift balance lands instantly for you to use during the review.",
                        "The review takes a few minutes.",
                        "Your subscription balance lands in full in your account, with a notice if you enabled it.",
                      ]
                }
              />
              <p className="mt-4 text-sm leading-7 text-slate-400">
                {ar
                  ? "خطوات فودافون كاش وإنستا باي واحدة تقريبًا لأنها دفع يدوي بإثبات، أما PayPal فبيختصر الرحلة كلها لأنه فوري وتلقائي."
                  : "Vodafone Cash and InstaPay follow almost the same steps because they are manual payments with proof, while PayPal skips the whole journey because it is instant and automatic."}
              </p>
            </Section>

            <Section title={ar ? "أولًا: فودافون كاش" : "First: Vodafone Cash"}>
              <Steps
                steps={
                  ar
                    ? [
                        <>افتح <a href="/billing" style={GOLD_LINK}>صفحة الاشتراك</a> واضغط كارت اشتراكك المناسب: اشتراك البداية بـ 100 جنيه، والأساسي بـ 300، والأكبر بـ 440، والشامل بـ 500.</>,
                        <>حوّل مبلغ اشتراكك بالظبط إلى رقم فودافون كاش <bdi style={{ fontWeight: 800, color: "#fff" }}>01063537686</bdi> — من تطبيق فودافون كاش، أو بكود USSD الجاهز اللي بيظهر لك في صفحة الاشتراك بصيغة: <span dir="ltr" style={{ fontWeight: 700, color: "#fff" }}>*9*7*01063537686*المبلغ#</span> (مثال لاشتراك الـ100: <span dir="ltr" style={{ fontWeight: 700, color: "#fff" }}>*9*7*01063537686*100#</span>).</>,
                        "بعد التحويل مباشرة خد اسكرين شوت للإثبات — لازم يظهر فيها بوضوح: الرقم اللي حوّلت عليه، والمبلغ، ووقت التحويل.",
                        <>ارجع لصفحة الاشتراك وارفع صورة الإثبات من قسم فودافون كاش واضغط إرسال. وتقدر تبعتها بدل كده لبوت الدفع على تيليجرام <a href="https://t.me/HOT_GPTPaybot" target="_blank" rel="noreferrer" style={GOLD_LINK}>@HOT_GPTPaybot</a> مع إيميلك المسجل في الموقع ورقم التحويل ورقم اشتراكك في وصف الصورة.</>,
                        "أول ما تبعت الإثبات بينزلك رصيد هدية فورًا تستخدمه على ما المراجعة تخلص.",
                        "المراجعة بتتم خلال دقائق، وأول ما تتوافق بينزل رصيد اشتراكك كاملًا في حسابك — ولو فعّلت «نبّهني بعد الموافقة» من شاشة نجاح الإرسال هيوصلك تنبيه جوه الموقع.",
                      ]
                    : [
                        <>Open the <a href="/billing" style={GOLD_LINK}>billing page</a> and tap the right plan card: the Starter plan for 100 EGP, Basic for 300, Larger for 440, Full for 500.</>,
                        <>Transfer the exact plan amount to Vodafone Cash number <bdi style={{ fontWeight: 800, color: "#fff" }}>01063537686</bdi> — from the Vodafone Cash app, or with the ready USSD code shown on the subscription page: <span dir="ltr" style={{ fontWeight: 700, color: "#fff" }}>*9*7*01063537686*AMOUNT#</span> (for the 100 plan: <span dir="ltr" style={{ fontWeight: 700, color: "#fff" }}>*9*7*01063537686*100#</span>).</>,
                        "Right after transferring, take a screenshot of the proof — it must clearly show: the number you sent to, the amount, and the transfer time.",
                        <>Go back to the subscription page, upload the proof image in the Vodafone Cash section and press send. Or send it instead to the payment bot on Telegram, <a href="https://t.me/HOT_GPTPaybot" target="_blank" rel="noreferrer" style={GOLD_LINK}>@HOT_GPTPaybot</a>, with your registered site email, the sender number and your plan number in the photo caption.</>,
                        "The moment you submit the proof, a gift balance lands instantly for you to use while the review finishes.",
                        "The review takes a few minutes, and once approved your full subscription balance lands in your account — and if you enabled “Notify me after approval” on the success screen, you will get an in-site notice.",
                      ]
                }
              />
            </Section>

            <Section title={ar ? "ثانيًا: إنستا باي InstaPay" : "Second: InstaPay"}>
              <Steps
                steps={
                  ar
                    ? [
                        <>افتح <a href="/billing" style={GOLD_LINK}>صفحة الاشتراك</a> واضغط كارت اشتراكك المناسب (نفس الاشتراكات والأسعار).</>,
                        <>حوّل مبلغ اشتراكك بالظبط إلى عنوان إنستا باي <bdi style={{ fontWeight: 800, color: "#fff" }}>wahedelfar@instapay</bdi> — أو افتح <a href="https://ipn.eg/S/wahedelfar/instapay/4LnUCo" target="_blank" rel="noreferrer" style={GOLD_LINK}>رابط الدفع المباشر</a> وكمّل من تطبيق إنستا باي.</>,
                        "خد اسكرين شوت لنتيجة العملية — لازم يظهر فيها: نجاح العملية، والعنوان اللي حوّلت عليه، والمبلغ.",
                        "ارجع لصفحة الاشتراك وارفع صورة الإثبات من قسم إنستا باي واضغط إرسال (أو ابعتها لبوت الدفع على تيليجرام بنفس الطريقة المشروحة فوق).",
                        "بينزلك رصيد هدية فورًا، والمراجعة خلال دقائق، وبعد الموافقة بينزل رصيد اشتراكك كامل في حسابك.",
                      ]
                    : [
                        <>Open the <a href="/billing" style={GOLD_LINK}>billing page</a> and tap the right plan card (same plans and prices).</>,
                        <>Transfer the exact plan amount to the InstaPay address <bdi style={{ fontWeight: 800, color: "#fff" }}>wahedelfar@instapay</bdi> — or open the <a href="https://ipn.eg/S/wahedelfar/instapay/4LnUCo" target="_blank" rel="noreferrer" style={GOLD_LINK}>direct payment link</a> and continue in the InstaPay app.</>,
                        "Take a screenshot of the result screen — it must show: the operation succeeded, the address you sent to, and the amount.",
                        "Go back to the subscription page, upload the proof image in the InstaPay section and press send (or send it to the Telegram payment bot the same way described above).",
                        "A gift balance lands instantly, the review takes a few minutes, and after approval your subscription balance lands in full in your account.",
                      ]
                }
              />
            </Section>

            <Section title={ar ? "ثالثًا: PayPal — تفعيل فوري" : "Third: PayPal — instant activation"}>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {ar
                  ? "لو معاك كارت بنكي أو حساب PayPal وعايز تفعيل فوري من غير أي خطوات يدوية: اختر PayPal من صفحة الاشتراك وادفع — الأسعار بالدولار الأمريكي وبتظهر كاملة في الوضع الإنجليزي للموقع، والتفعيل بيتم تلقائيًا فور نجاح الدفع، من غير إثبات ولا مراجعة ولا انتظار."
                  : "If you have a bank card or a PayPal account and want instant activation with no manual steps: choose PayPal on the subscription page and pay — prices are in US dollars and are shown in full in the site's English mode, and activation happens automatically the moment the payment succeeds, with no proof, no review and no waiting."}
              </p>
            </Section>

            <Section title={ar ? "إثبات واضح = تفعيل أسرع" : "A clear proof = faster activation"}>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {ar
                  ? "راجع إثباتك قبل ما تبعته وتأكد إن فيه: الرقم أو العنوان اللي حوّلت عليه ظاهر بالكامل، والمبلغ مطابق لمبلغ اشتراكك بالظبط، ووقت التحويل باين، والعملية ناجحة. الإثبات الكامل الواضح بيخلي التفعيل يتم على طول خلال دقائق — خد الصورة كاملة من الأول واشتراكك هيتفعّل فورًا، وليك رصيد هدية تستخدمه من أول لحظة."
                  : "Check your proof before sending and make sure it has: the number or address you sent to shown in full, the amount exactly matching your plan price, the transfer time visible, and the operation successful. A complete, clear proof gets activated right away, within minutes — take the full screenshot from the start and your subscription activates immediately, with a gift balance to use from the very first moment."}
              </p>
            </Section>

            <Section title={ar ? "أسئلة سريعة" : "Quick questions"}>
              <div className="mt-3 space-y-4">
                <div>
                  <h3 className="font-bold">{ar ? "التفعيل بياخد وقت قد إيه؟" : "How long does activation take?"}</h3>
                  <p className="mt-1 text-sm leading-7 text-slate-300">
                    {ar
                      ? "دفع PayPal فوري وتلقائي. فودافون كاش وإنستا باي بيتراجعوا يدويًا وبيتفعلوا عادة خلال دقائق من إرسال إثبات واضح — ورصيد الهدية بيوصلك فورًا وقت الإرسال عشان تستخدم الموقع من غير انتظار."
                      : "PayPal payments are instant and automatic. Vodafone Cash and InstaPay are reviewed manually and are usually activated within minutes of a clear proof — and the gift balance reaches you instantly at submission so you can use the site without waiting."}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold">{ar ? "أشوف حالة طلبي فين؟" : "Where can I see my request status?"}</h3>
                  <p className="mt-1 text-sm leading-7 text-slate-300">
                    {ar
                      ? "من صفحة الاشتراك: قائمة طلباتك وحالة كل طلب (قيد المراجعة / تمت الموافقة / مرفوض)، وتنبيه الموافقة بيظهر لك في نفس الصفحة لو كنت مفعّل التنبيه."
                      : "On the subscription page: your requests list shows each request's status (under review / approved / rejected), and the approval notice appears on the same page if you enabled it."}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold">{ar ? "حوّلت مبلغ غلط أو من رقم تاني؟" : "I sent the wrong amount or from another number?"}</h3>
                  <p className="mt-1 text-sm leading-7 text-slate-300">
                    {ar
                      ? "متقلقش: ارفع الإثبات اللي معاك زي ما هو، وكلّم الدعم الفني برقم العملية وهنظبطها يدويًا."
                      : "Don't worry: upload the proof you have as it is, and contact technical support with the transaction reference and we will sort it out manually."}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold">{ar ? "هل الاشتراك بيجدد أو بيخصم مني تلقائي؟" : "Does the subscription renew or charge me automatically?"}</h3>
                  <p className="mt-1 text-sm leading-7 text-slate-300">
                    {ar
                      ? "لا خصم تلقائي أبدًا. اشتراكك شهري، وبتجدده بنفسك وقت ما تحب — وكل شحنة جديدة بتبدأ شهرك الجديد من يوم الشحن."
                      : "Never an automatic charge. Your plan is monthly, and you renew it yourself whenever you like — every new top-up starts your new month from the recharge day."}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold">{ar ? "إيه سياسة الاسترداد؟" : "What is the refund policy?"}</h3>
                  <p className="mt-1 text-sm leading-7 text-slate-300">
                    {ar ? (
                      <>رصيد اشتراكك اللي لسه ما استخدمتوش تقدر تسترده خلال 7 أيام من الشراء — التفاصيل الكاملة في <a href="/refund" style={GOLD_LINK}>سياسة الاسترداد</a>.</>
                    ) : (
                      <>Your unused subscription balance can be refunded within 7 days of purchase — full details are in the <a href="/refund" style={GOLD_LINK}>refund policy</a>.</>
                    )}
                  </p>
                </div>
              </div>
            </Section>

            <section className="rounded-2xl border border-amber-200/35 bg-gradient-to-br from-amber-200/10 to-transparent p-5">
              <h2 className="text-lg font-bold">{ar ? "واجهتك أي صعوبة في الدفع؟" : "Facing any difficulty while paying?"}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                {ar
                  ? "الدعم الفني معاك ٢٤ ساعة — تواصل معاه وسيتم حلها فورًا، أو راسلنا على support@hotgpt.pro."
                  : "Technical support is with you 24/7 — contact us and it will be resolved immediately, or email us at support@hotgpt.pro."}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href="https://t.me/HOTGPTPro" target="_blank" rel="noreferrer" className="inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-black transition hover:bg-amber-300">
                  {ar ? "الدعم الفني على تيليجرام" : "Support on Telegram"}
                </a>
                <a href="/billing" className="inline-block rounded-lg border border-amber-400/50 px-4 py-2 text-sm font-bold text-amber-300 transition hover:bg-amber-400/10">
                  {ar ? "ابدأ من صفحة الاشتراك" : "Start from the subscription page"}
                </a>
              </div>
            </section>
          </div>
          <p className="mt-8 text-center text-xs text-slate-500"><a className="text-amber-200 underline" href="https://hot-gpt.blogspot.com" target="_blank" rel="noopener noreferrer">{ar ? "مدونة HotGPT" : "HotGPT Blog"}</a></p>
        </div>
      </main>
    </LocalizedText>
  );
}
