import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { LanguageProvider } from "./contexts/LanguageContext";
import AuthPage from "./pages/Auth";
import BillingPage from "./pages/Billing";
import ModelsPage from "./pages/Models";
import AdminBillingPage from "./pages/AdminBilling";
import LuckyPage from "./pages/Lucky";
import ProfilePage from "./pages/Profile";
import AdminLuckyPage from "./pages/AdminLucky";
import LuckyTermsPage from "./pages/LuckyTerms";
import TermsPage from "./pages/Terms";
import PrivacyPage from "./pages/Privacy";
import RefundPage from "./pages/Refund";
import FaqPage from "./pages/Faq";
import AgeGate from "./components/AgeGate";
import InstallAppButton from "@/components/InstallAppButton";


// ONE-LINE DOMAIN SWAP: when the paid domain is connected to Vercel, change
// this origin (and the matching URLs in index.html, robots.txt, sitemap.xml).
const SITE_ORIGIN = "https://hotgpt.pro";

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "HotGPT — ذكاء اصطناعي للمطورين والباحثين | حرية الإنترنت",
    description: "نماذج ذكاء اصطناعي حرة بدون قيود على البحث والبرمجة من برمجتنا: برمجة، تحليل عميق، أمن رقمي، بحث ويب مباشر وتوليد صور. ابدأ بهدية ترحيب 5 توكينات وجرّب الوحش PRO وHotGPT Dark.",
  },
  "/billing": {
    title: "باقات HotGPT — توكينات للمطورين والباحثين",
    description: "باقات توكينات HotGPT تبدأ من 100 جنيه أو 2 دولار عبر PayPal: رسائل وبحث وصور وتحليل عميق بأسعار ثابتة معروفة مسبقًا، ودفع فودافون كاش وانستا باي وPayPal.",
  },
  "/models": {
    title: "نماذج HotGPT — تعرّف على عائلة النماذج | HotGPT",
    description: "تعرّف على نماذج HotGPT: الافتراضي اليومي، الوحش PRO، Dark وDark Live، بحث الويب المباشر، توليد الصور، محترف SEO ومحترف فحص الأمان — كل نموذج بسعر ثابت بالتوكين تعرفه قبل ما تبدأ.",
  },
  "/rewards": {
    title: "HotLucky — 100 توكين بـ 100 جنيه | HotGPT",
    description: "باقة HotLucky من HotGPT: 100 توكين مقابل 100 جنيه — تكفي 100 رسالة أو 10 تقارير وحش كاملة أو 20 صورة. دفع فودافون كاش وانستا باي.",
  },
  "/lucky-terms": {
    title: "الشروط والأحكام | HotGPT",
    description: "شروط وأحكام باقات HotGPT وHotLucky: الأسعار، طرق الدفع، الهدايا، ومسؤولية الاستخدام.",
  },
  "/auth": {
    title: "تسجيل الدخول | HotGPT — للمطورين والباحثين",
    description: "سجّل دخولك إلى HotGPT — ذكاء اصطناعي حر للمطورين والباحثين — برمجة وتحليل وأمن رقمي.",
  },
  "/profile": {
    title: "حسابي | HotGPT",
    description: "ملفك الشخصي ورصيد توكيناتك في HotGPT.",
  },
  "/terms": {
    title: "الشروط والأحكام | HotGPT",
    description: "شروط استخدام HotGPT: الحسابات، التوكنات، الدفع، الاستخدام المسؤول ومسؤولية الاستخدام.",
  },
  "/privacy": {
    title: "سياسة الخصوصية | HotGPT",
    description: "سياسة خصوصية HotGPT: ما البيانات التي تُجمع، وكيف تُستخدم، ومن يعالجها، وحقوقك.",
  },
  "/refund": {
    title: "سياسة الاسترداد | HotGPT",
    description: "سياسة استرداد HotGPT: متى تُرد قيمة الباقات والتذاكر، وكيف تطلب الاسترداد.",
  },
  "/faq": {
    title: "الأسئلة الشائعة | HotGPT",
    description: "إجابات مباشرة عن أسئلة الأمن السيبراني واختبار الاختراق وفحص الثغرات والبرمجة، وعن خدمات HotGPT وأسعاره.",
  },
};

function setMeta(selector: string, attr: string, name: string, value: string) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

// Per-page SEO meta for the SPA: updates title, description, social tags,
// canonical and robots as the route changes (admin stays unindexed).
function PageMeta() {
  const [location] = useLocation();
  useEffect(() => {
    const isAdmin = location.startsWith("/admin");
    const key = location.startsWith("/chat/") ? "/" : location === "/hotlucky" || location === "/lucky.php" ? "/rewards" : location;
    const meta = PAGE_META[key] ?? PAGE_META["/"];
    document.title = isAdmin ? "الإدارة | HotGPT" : meta.title;
    setMeta('meta[name="description"]', "name", "description", meta.description);
    setMeta('meta[property="og:title"]', "property", "og:title", meta.title);
    setMeta('meta[property="og:description"]', "property", "og:description", meta.description);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", meta.title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", meta.description);
    setMeta('meta[name="robots"]', "name", "robots", isAdmin ? "noindex, nofollow" : "index, follow");
    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", SITE_ORIGIN + (location === "/" ? "/" : location));
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <PageMeta />
      <Switch>
      <Route path="/" component={Home} />
      <Route path="/chat/:id" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/models" component={ModelsPage} />
      <Route path="/rewards" component={LuckyPage} />
      <Route path="/hotlucky" component={LuckyPage} />
      <Route path="/lucky.php" component={LuckyPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/lucky-terms" component={LuckyTermsPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/refund" component={RefundPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/admin/lucky.php" component={AdminLuckyPage} />
      <Route path="/admin" component={AdminBillingPage} />
      <Route path="/admin/login" component={AdminBillingPage} />
      <Route path="/admin/billing" component={AdminBillingPage} />
      <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

// Referral capture: an invite link (?ref=CODE) stores the code locally;
// the account binds it after the visitor signs up and logs in (Home does
// the attach call). Last link clicked wins, before signup only.
function ReferralCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[A-Za-z0-9]{6,12}$/.test(ref.trim())) localStorage.setItem("hotgpt-ref-code", ref.trim().toUpperCase());
    } catch { /* storage unavailable */ }
  }, []);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="dark" switchable>
          <TooltipProvider>
            <Toaster />
            <AgeGate />
            <ReferralCapture />
            <Router />
            <InstallAppButton />
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
