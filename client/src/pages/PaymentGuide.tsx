import type { ReactNode } from "react";
import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";
import BrandClaim from "@/components/BrandClaim";
import FbFollow, { BlogFollow } from "@/components/FbFollow";

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

          <div className="mt-3 flex justify-end gap-2"><FbFollow /><BlogFollow /></div>
          <BrandClaim />
          <header className="my-8 rounded-3xl border border-amber-200/35 bg-gradient-to-br from-amber-200/10 to-transparent p-6 sm:p-9">
            <h1 className="text-3xl font-black sm:text-4xl">{ar ? "وسائل الدفع وطريقة الاشتراك" : "Payment methods & how to subscribe"}</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {ar
                ? "مفيش اشتراك شهري ولا تجديد تلقائي في HotGPT: بتشتري باقة توكينات مرة واحدة، والرصيد بيتضاف لمحفظتك وتستخدمه وقت ما تحتاج. الصفحة دي بتشرح كل وسيلة دفع خطوة بخطوة — من اختيار الباقة لحد ما التوكينات توصلك."
                : "There is no monthly subscription or auto-renewal on HotGPT: you buy a token pack once, the balance lands in your wallet, and you use it whenever you need. This page explains every payment method step by step — from choosing a pack until the tokens reach you."}
            </p>
          </header>

          <div className="space-y-4">
            <Section title={ar ? "الرحلة باختصار — من الدفع لوصول التوكينات" : "The journey in short — from payment to tokens"}>
              <Steps
                steps={
                  ar
                    ? [
                        "اختر الباقة المناسبة من صفحة الباقات.",
                        "حوّل مبلغ الباقة بالظبط بالوسيلة اللي تناسبك.",
                        "ارفع صورة إثبات التحويل من صفحة الباقات.",
                        "بينزلك 5 توكين هدية فورًا تستخدمهم أثناء المراجعة.",
                        "المراجعة بتتم خلال دقائق.",
                        "توكينات الباقة بتنزل كاملة في رصيدك، ويوصلك تنبيه لو فعّلته.",
                      ]
                    : [
                        "Choose the right pack on the billing page.",
                        "Transfer the exact pack amount with the method that suits you.",
                        "Upload your transfer proof on the billing page.",
                        "A 5-token gift lands instantly for you to use during the review.",
                        "The review takes a few minutes.",
                        "The pack's tokens land in full in your balance, with a notice if you enabled it.",
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
                        <>افتح <a href="/billing" style={GOLD_LINK}>صفحة الباقات</a> واضغط كارت الباقة المناسبة: 100 توكين بـ 100 جنيه، 500 بـ 300، 800 بـ 500، 1000 بـ 700.</>,
                        <>حوّل مبلغ الباقة بالظبط إلى رقم فودافون كاش <bdi style={{ fontWeight: 800, color: "#fff" }}>01063537686</bdi> — من تطبيق فودافون كاش، أو بكود USSD الجاهز اللي بيظهر لك في صفحة الباقات بصيغة: <span dir="ltr" style={{ fontWeight: 700, color: "#fff" }}>*9*7*01063537686*المبلغ#</span> (مثال لباقة الـ100: <span dir="ltr" style={{ fontWeight: 700, color: "#fff" }}>*9*7*01063537686*100#</span>).</>,
                        "بعد التحويل مباشرة خد اسكرين شوت للإثبات — لازم يظهر فيها بوضوح: الرقم اللي حوّلت عليه، والمبلغ، ووقت التحويل.",
                        <>ارجع لصفحة الباقات وارفع صورة الإثبات من قسم فودافون كاش واضغط إرسال. وتقدر تبعتها بدل كده لبوت الدفع على تيليجرام <a href="https://t.me/HOT_GPTPaybot" target="_blank" rel="noreferrer" style={GOLD_LINK}>@HOT_GPTPaybot</a> مع إيميلك المسجل في الموقع ورقم التحويل ورقم الباقة في وصف الصورة.</>,
                        "أول ما تبعت الإثبات بينزلك 5 توكين هدية فورًا تستخدمهم على ما المراجعة تخلص.",
                        "المراجعة بتتم خلال دقائق، وأول ما تتوافق بينزل مبلغ الباقة كاملًا في رصيدك — ولو فعّلت «نبّهني بعد الموافقة» من شاشة نجاح الإرسال هيوصلك تنبيه جوه الموقع.",
                      ]
                    : [
                        <>Open the <a href="/billing" style={GOLD_LINK}>billing page</a> and tap the right pack card: 100 tokens for 100 EGP, 500 for 300, 800 for 500, 1000 for 700.</>,
                        <>Transfer the exact pack amount to Vodafone Cash number <bdi style={{ fontWeight: 800, color: "#fff" }}>01063537686</bdi> — from the Vodafone Cash app, or with the ready USSD code shown on the billing page: <span dir="ltr" style={{ fontWeight: 700, color: "#fff" }}>*9*7*01063537686*AMOUNT#</span> (for the 100 pack: <span dir="ltr" style={{ fontWeight: 700, color: "#fff" }}>*9*7*01063537686*100#</span>).</>,
                        "Right after transferring, take a screenshot of the proof — it must clearly show: the number you sent to, the amount, and the transfer time.",
                        <>Go back to the billing page, upload the proof image in the Vodafone Cash section and press send. Or send it instead to the payment bot on Telegram, <a href="https://t.me/HOT_GPTPaybot" target="_blank" rel="noreferrer" style={GOLD_LINK}>@HOT_GPTPaybot</a>, with your registered site email, the sender number and the pack number in the photo caption.</>,
                        "The moment you submit the proof, a 5-token gift lands instantly for you to use while the review finishes.",
                        "The review takes a few minutes, and once approved the full pack amount lands in your balance — and if you enabled “Notify me after approval” on the success screen, you will get an in-site notice.",
                      ]
                }
              />
            </Section>

            <Section title={ar ? "ثانيًا: إنستا باي InstaPay" : "Second: InstaPay"}>
              <Steps
                steps={
                  ar
                    ? [
                        <>افتح <a href="/billing" style={GOLD_LINK}>صفحة الباقات</a> واضغط كارت الباقة المناسبة (نفس الباقات والأسعار).</>,
                        <>حوّل مبلغ الباقة بالظبط إلى عنوان إنستا باي <bdi style={{ fontWeight: 800, color: "#fff" }}>wahedelfar@instapay</bdi> — أو افتح <a href="https://ipn.eg/S/wahedelfar/instapay/4LnUCo" target="_blank" rel="noreferrer" style={GOLD_LINK}>رابط الدفع المباشر</a> وكمّل من تطبيق إنستا باي.</>,
                        "خد اسكرين شوت لنتيجة العملية — لازم يظهر فيها: نجاح العملية، والعنوان اللي حوّلت عليه، والمبلغ.",
                        "ارجع لصفحة الباقات وارفع صورة الإثبات من قسم إنستا باي واضغط إرسال (أو ابعتها لبوت الدفع على تيليجرام بنفس الطريقة المشروحة فوق).",
                        "بينزلك 5 توكين هدية فورًا، والمراجعة خلال دقائق، وبعد الموافقة بتنزل توكينات الباقة كاملة في رصيدك.",
                      ]
                    : [
                        <>Open the <a href="/billing" style={GOLD_LINK}>billing page</a> and tap the right pack card (same packs and prices).</>,
                        <>Transfer the exact pack amount to the InstaPay address <bdi style={{ fontWeight: 800, color: "#fff" }}>wahedelfar@instapay</bdi> — or open the <a href="https://ipn.eg/S/wahedelfar/instapay/4LnUCo" target="_blank" rel="noreferrer" style={GOLD_LINK}>direct payment link</a> and continue in the InstaPay app.</>,
                        "Take a screenshot of the result screen — it must show: the operation succeeded, the address you sent to, and the amount.",
                        "Go back to the billing page, upload the proof image in the InstaPay section and press send (or send it to the Telegram payment bot the same way described above).",
                        "A 5-token gift lands instantly, the review takes a few minutes, and after approval the pack's tokens land in full in your balance.",
                      ]
                }
              />
            </Section>

            <Section title={ar ? "ثالثًا: PayPal — تفعيل فوري" : "Third: PayPal — instant activation"}>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {ar
                  ? "لو معاك كارت بنكي أو حساب PayPal وعايز تفعيل فوري من غير أي خطوات يدوية: اختر PayPal من صفحة الباقات وادفع — الأسعار بالدولار الأمريكي وبتظهر كاملة في الوضع الإنجليزي للموقع، والتفعيل بيتم تلقائيًا فور نجاح الدفع، من غير إثبات ولا مراجعة ولا انتظار."
                  : "If you have a bank card or a PayPal account and want instant activation with no manual steps: choose PayPal on the billing page and pay — prices are in US dollars and are shown in full in the site's English mode, and activation happens automatically the moment the payment succeeds, with no proof, no review and no waiting."}
              </p>
            </Section>

            <Section title={ar ? "إثبات واضح = تفعيل أسرع" : "A clear proof = faster activation"}>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {ar
                  ? "راجع إثباتك قبل ما تبعته وتأكد إن فيه: الرقم أو العنوان اللي حوّلت عليه ظاهر بالكامل، والمبلغ مطابق لمبلغ الباقة بالظبط، ووقت التحويل باين، والعملية ناجحة مش مرفوضة. لو الإثبات مقصوص أو ناقص، طلبك بيتحول لمراجعة يدوية أدق (من 10 لـ 30 دقيقة) وممكن نطلب منك صورة أوضح — فخد الصورة كاملة من الأول ووفّر على نفسك الانتظار."
                  : "Check your proof before sending and make sure it has: the number or address you sent to shown in full, the amount exactly matching the pack price, the transfer time visible, and the operation successful — not rejected. A cropped or incomplete proof goes to a closer manual review (10 to 30 minutes) and we may ask you for a clearer photo — so take the full screenshot from the start and save yourself the wait."}
              </p>
            </Section>

            <Section title={ar ? "أسئلة سريعة" : "Quick questions"}>
              <div className="mt-3 space-y-4">
                <div>
                  <h3 className="font-bold">{ar ? "التفعيل بياخد وقت قد إيه؟" : "How long does activation take?"}</h3>
                  <p className="mt-1 text-sm leading-7 text-slate-300">
                    {ar
                      ? "دفع PayPal فوري وتلقائي. فودافون كاش وإنستا باي بيتراجعوا يدويًا وبيتفعلوا عادة خلال دقائق من إرسال إثبات واضح — وهدية الـ5 توكين بتوصلك فورًا وقت الإرسال عشان تستخدم الموقع من غير انتظار."
                      : "PayPal payments are instant and automatic. Vodafone Cash and InstaPay are reviewed manually and are usually activated within minutes of a clear proof — and the 5-token gift reaches you instantly at submission so you can use the site without waiting."}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold">{ar ? "أشوف حالة طلبي فين؟" : "Where can I see my request status?"}</h3>
                  <p className="mt-1 text-sm leading-7 text-slate-300">
                    {ar
                      ? "من صفحة الباقات: قائمة طلباتك وحالة كل طلب (قيد المراجعة / تمت الموافقة / مرفوض)، وتنبيه الموافقة بيظهر لك في نفس الصفحة لو كنت مفعّل التنبيه."
                      : "On the billing page: your requests list shows each request's status (under review / approved / rejected), and the approval notice appears on the same page if you enabled it."}
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
                  <h3 className="font-bold">{ar ? "هل فيه اشتراك شهري أو خصم تلقائي؟" : "Is there a monthly subscription or automatic charge?"}</h3>
                  <p className="mt-1 text-sm leading-7 text-slate-300">
                    {ar
                      ? "لا. باقات التوكينات شراء مرة واحدة من غير أي تجديد أو خصم تلقائي — بتشتري لما تحتاج بس."
                      : "No. Token packs are a one-time purchase with no renewal or automatic charge — you buy only when you need."}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold">{ar ? "إيه سياسة الاسترداد؟" : "What is the refund policy?"}</h3>
                  <p className="mt-1 text-sm leading-7 text-slate-300">
                    {ar ? (
                      <>رصيد الباقة اللي لسه ما استخدمتوش تقدر تسترده خلال 7 أيام من الشراء — التفاصيل الكاملة في <a href="/refund" style={GOLD_LINK}>سياسة الاسترداد</a>.</>
                    ) : (
                      <>Your unused pack balance can be refunded within 7 days of purchase — full details are in the <a href="/refund" style={GOLD_LINK}>refund policy</a>.</>
                    )}
                  </p>
                </div>
              </div>
            </Section>

            <section className="rounded-2xl border border-amber-200/35 bg-gradient-to-br from-amber-200/10 to-transparent p-5">
              <h2 className="text-lg font-bold">{ar ? "واجهتك أي صعوبة في الدفع؟" : "Facing any difficulty while paying?"}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                {ar
                  ? "تواصل مع الدعم الفني وسيتم حلها فورًا — أو راسلنا على hotgpt.pro@gmail.com."
                  : "Contact technical support and it will be resolved immediately — or email us at hotgpt.pro@gmail.com."}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href="https://t.me/HOTGPTPro" target="_blank" rel="noreferrer" className="inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-black transition hover:bg-amber-300">
                  {ar ? "الدعم الفني على تيليجرام" : "Support on Telegram"}
                </a>
                <a href="/billing" className="inline-block rounded-lg border border-amber-400/50 px-4 py-2 text-sm font-bold text-amber-300 transition hover:bg-amber-400/10">
                  {ar ? "ابدأ من صفحة الباقات" : "Start from the billing page"}
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
