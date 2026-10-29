import { ArrowRight, ShieldCheck, Coins, Gift, Users, Clock3 } from "lucide-react";
import { LanguageToggle } from "@/contexts/LanguageContext";

// HotLucky terms — rewritten for the spin game (2026-10-27). Section 8
// (user liability) is kept verbatim: it is the site-wide clause.
export default function LuckyTermsPage() {
  return <main dir="rtl" className="min-h-screen bg-[#090909] px-4 py-8 text-white sm:px-6">
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <a href="/hotlucky" className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-white"><ArrowRight size={16} /> العودة إلى HotLucky</a>
        <LanguageToggle inline />
      </div>
      <header className="my-8 rounded-3xl border border-amber-200/35 bg-gradient-to-br from-amber-200/10 to-transparent p-6 sm:p-9">
        <div className="flex items-center gap-3 text-amber-200"><ShieldCheck size={26} /><span className="text-xs font-bold tracking-widest">HOTLUCKY · TERMS</span></div>
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">الشروط والأحكام — لعبة HotLucky</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">يرجى قراءة الشروط قبل شراء أي تذكرة لفة أو إرسال إثبات الدفع.</p>
      </header>
      <div className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Coins className="text-amber-200" size={20} /> 1. التذكرة والسعر</h2><p className="mt-3 text-sm leading-7 text-slate-300">تذكرة اللفة هي منتج رقمي يمنح صاحبه حق تنفيذ لفة واحدة في لعبة HotLucky. سعر التذكرة 50 جنيهًا مصريًا عبر Vodafone Cash أو InstaPay (دفع يدوي يخضع لمراجعة الإدارة)، أو عبر PayPal في باقات مجمعة فقط: لفتان مقابل 2 دولار أمريكي أو خمس لفات مقابل 5 دولارات أمريكية (دفع موثّق تلقائيًا). لا تُباع لفات PayPal منفردة بسبب رسوم المعالجة الثابتة. التذكرة المعتمدة لا تنتهي صلاحيتها ويمكن لعبها في أي وقت.</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Gift className="text-amber-200" size={20} /> 2. الجوائز والاحتمالات المعلنة</h2><p className="mt-3 text-sm leading-7 text-slate-300">كل لفة تمنح جائزة توكنات رقمية واحدة من الجدول التالي، وتُضاف الجائزة مباشرة إلى رصيد حساب اللاعب لحظة تنفيذ اللفة:</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead><tr className="bg-white/[.05] text-slate-300"><th className="p-3 text-right font-bold">الجائزة</th><th className="p-3 text-right font-bold">الاحتمال</th><th className="p-3 text-right font-bold">القيمة مقابل التذكرة</th></tr></thead>
              <tbody className="text-slate-300">
                <tr className="border-t border-white/10"><td className="p-3">25 توكن</td><td className="p-3">38%</td><td className="p-3">نصف القيمة</td></tr>
                <tr className="border-t border-white/10"><td className="p-3">50 توكن</td><td className="p-3">39%</td><td className="p-3">القيمة كاملة</td></tr>
                <tr className="border-t border-white/10"><td className="p-3">75 توكن</td><td className="p-3">13%</td><td className="p-3">مرة ونصف</td></tr>
                <tr className="border-t border-white/10"><td className="p-3">100 توكن</td><td className="p-3">10%</td><td className="p-3">ضعف القيمة</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-300">مجموع الاحتمالات 100%، ومتوسط العائد الحسابي 48.75 توكن لكل لفة. لا توجد نتيجة صفرية: الحد الأدنى لأي لفة هو 25 توكن. الجوائز توكنات رقمية داخل منصة HotGPT فقط، وليست نقودًا ولا يمكن استبدالها أو تحويلها إلى نقد أو إلى أي وسيلة دفع.</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Users className="text-amber-200" size={20} /> 3. الأهلية والعمر</h2><p className="mt-3 text-sm leading-7 text-slate-300">اللعبة مخصصة للأشخاص الذين تبلغ أعمارهم 18 عامًا فأكثر. بشراء التذكرة، يقر المستخدم بأنه بالغ ومخوّل باستخدام وسيلة الدفع التي يستعملها، وأن البريد الإلكتروني المقدم مرتبط بحسابه في HotGPT. اللعبة قائمة على الحظ في حدود الجدول المعلن، وقرار الشراء واللعب قرار المستخدم وحده.</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="text-lg font-bold">4. الدفع والاعتماد والاسترداد</h2><p className="mt-3 text-sm leading-7 text-slate-300">في الدفع اليدوي، صورة التحويل مستند للمراجعة البشرية ولا تؤكد الدفع تلقائيًا؛ لا تُعتمد التذكرة إلا بعد تحقق الإدارة من المعاملة، ويجب أن تكون الصورة صحيحة وواضحة وغير معدلة بطريقة مضللة. إذا رفضت الإدارة طلبًا رغم استلام التحويل فعليًا، يُردّ المبلغ إلى وسيلة الدفع نفسها أو يُحتسب توكنات بالاتفاق مع المستخدم. في دفع PayPal، تُعتمد التذاكر تلقائيًا بعد تحقق الخادم من اكتمال الدفع لدى PayPal ومطابقته. التذاكر المعتمدة التي لم تُلعب بعد قابلة للاسترداد القيمي بطلب للإدارة ما لم تكن ناتجة عن دفع متنازع عليه؛ أما اللفة المنفذة فنتيجتها نهائية ولا تُسترد قيمتها.</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Clock3 className="text-amber-200" size={20} /> 5. تنفيذ اللفة وسجل الجوائز</h2><p className="mt-3 text-sm leading-7 text-slate-300">يُنفَّذ السحب على خادم المنصة لحظة ضغط زر اللف، ونتيجته نهائية وتُسجَّل في حساب اللاعب وفي سجل الجوائز العام (مع إخفاء جزء من البريد الإلكتروني). لكل تذكرة لفة واحدة فقط؛ لا يمكن إعادة اللف لنفس التذكرة بسبب تكرار النقر أو إعادة تحميل الصفحة أو انقطاع الاتصال — إذا انقطع الاتصال أثناء اللف، تُراجع النتيجة المسجلة في قسم «جوائزي» فهي المرجع.</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="text-lg font-bold">6. منع إساءة الاستخدام وسلامة الحساب</h2><p className="mt-3 text-sm leading-7 text-slate-300">يُمنع شراء التذاكر بوسائل دفع مسروقة أو بحسابات مخترقة أو عبر إثباتات مزورة. تحتفظ المنصة بحق تجميد التذاكر والجوائز المرتبطة بأي اشتباه احتيال حتى انتهاء التحقق، وإلغائها عند ثبوت المخالفة. تحتفظ الخدمة بسجلات المعاملة والمراجعة والسحب لأغراض التدقيق ومنع التكرار.</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="text-lg font-bold">7. توضيح قانوني</h2><p className="mt-3 text-sm leading-7 text-slate-300">هذه الصفحة تصف آلية اللعبة كما تعرضها الخدمة، ولا تمثل ضمانًا بأن البرنامج متوافق مع جميع القوانين أو شروط مزودي الدفع في كل دولة. على المستخدم مراجعة الشروط المحلية ذات الصلة، بما فيها القواعد المنظمة لألعاب الحظ الترويجية في بلده. تحتفظ المنصة بحق تعديل أسعار التذاكر أو جدول الجوائز مستقبلًا، على أن تسري التعديلات على التذاكر المشتراة بعد نشرها فقط ولا تمس التذاكر المعتمدة قبلها.</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="text-lg font-bold">8. مسؤولية الاستخدام</h2><p className="mt-3 text-sm leading-7 text-slate-300">تنطبق هذه المادة على جميع خدمات HotGPT وباقاتها. تُقدَّم الخدمة كما هي، كأداة ذكاء اصطناعي عامة، والمستخدم وحده مسؤول قانونيًا عن كل طلب يرسله وعن أي استخدام أو نشر أو تنفيذ لمخرجات الخدمة، ولا تتحمل المنصة أي مسؤولية عن استخدام يخالف قوانين بلد المستخدم. استمرارك في الاستخدام يعني قبولك بهذا البند.</p></section>
      </div>
      <p className="mt-8 text-center text-xs leading-6 text-slate-500">آخر تحديث: 27 أكتوبر 2026 · <a href="/hotlucky" className="text-amber-200 underline">العودة إلى صفحة الجوائز</a></p>
    </div>
  </main>;
}
