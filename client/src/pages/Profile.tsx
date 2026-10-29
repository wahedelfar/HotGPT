import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { authFetch } from "@/lib/auth";
import { LanguageToggle, LocalizedText, useAppLanguage } from "@/contexts/LanguageContext";
import { Coins, Gift, ArrowRight, ArrowLeft, Crown } from "lucide-react";

type Prize = { label: string; code?: string; date?: string };
type Wallet = { tokenBalance?: number };

export default function ProfilePage() {
  const auth = useAuth();
  const { language } = useAppLanguage();
  const t = (ar: string, en: string) => (language === "ar" ? ar : en);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) { setLoading(false); return; }
    let cancelled = false;
    async function load() {
      try {
        const [walletResponse, prizeResponse] = await Promise.all([
          authFetch("/api/billing?action=me", { cache: "no-store" }),
          authFetch("/api/lucky?action=status", { cache: "no-store" }),
        ]);
        if (walletResponse.ok) {
          const data = await walletResponse.json();
          if (!cancelled) setWallet(data);
        }
        if (prizeResponse.ok) {
          const data = await prizeResponse.json();
          const items = Array.isArray(data.prizes) ? data.prizes as Prize[] : (data.prize?.label ? [data.prize as Prize] : []);
          if (!cancelled) setPrizes(items.filter(item => Boolean(item?.label)));
        }
      } finally { if (!cancelled) setLoading(false); }
    }
    void load().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auth.loading, auth.isAuthenticated, auth.user?.id]);

  return (
    <LocalizedText>
    <main dir={language === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#090909] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-white">{language === "ar" ? <ArrowRight size={16}/> : <ArrowLeft size={16}/>} {t("العودة إلى HotGPT", "Back to HotGPT")}</a>
          <LanguageToggle inline />
        </div>
        <header className="my-8 rounded-3xl border border-amber-200/30 bg-gradient-to-br from-amber-200/10 to-transparent p-6 sm:p-9">
          <p className="text-xs font-bold tracking-widest text-amber-200">HOTGPT · PROFILE</p>
          <h1 className="mt-3 text-3xl font-black">{t("حسابي وجوائزي", "My account & prizes")}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">{t("تظهر هنا جميع جوائز HotLucky المسجلة في حسابك مع تاريخ كل جائزة.", "All your recorded HotLucky prizes appear here, with the date of each prize.")}</p>
        </header>
        {!auth.loading && !auth.isAuthenticated ? (
          <section className="rounded-2xl border border-white/10 bg-white/[.03] p-6">
            <p>{t("سجّل الدخول لعرض رصيدك وجوائز HotLucky.", "Sign in to view your balance and your HotLucky prizes.")}</p>
            <a href="/auth?mode=login" className="mt-4 inline-flex rounded-xl bg-amber-200 px-4 py-3 font-bold text-black">{t("تسجيل الدخول", "Sign in")}</a>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <p className="text-sm text-slate-400">{t("البريد الإلكتروني", "Email")}</p>
              <p className="mt-1 break-all font-bold">{auth.user?.email || "—"}</p>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200/20 bg-black/20 p-4">
                <Coins className="text-amber-200" size={24}/>
                <div><p className="text-xs text-slate-400">{t("رصيد التوكنز الحالي", "Current token balance")}</p><p className="text-2xl font-black text-amber-200">{loading ? "…" : Number(wallet?.tokenBalance || 0).toLocaleString("en-US")}</p></div>
              </div>
            </section>
            <section className="mt-5 rounded-2xl border border-amber-200/35 bg-amber-200/[.06] p-5">
              <div className="flex items-center gap-3"><Gift className="text-amber-200" size={24}/><h2 className="text-xl font-black">{t("جوائزي من HotLucky", "My HotLucky prizes")}</h2></div>
              {loading ? <p className="mt-4 text-sm text-slate-400">{t("جارٍ تحميل الجوائز…", "Loading prizes…")}</p> : prizes.length ? (
                <div className="mt-4 space-y-3">
                  {prizes.map((item, index) => (
                    <article key={item.code || item.date || index} className="rounded-xl border border-amber-200/25 bg-black/25 p-4">
                      <p className="text-sm font-bold text-amber-200">{t("🎉 مبروك، كسبت", "🎉 Congratulations, you won")} {item.label}!</p>
                      {item.code && <p dir="ltr" className="mt-3 inline-block rounded-lg border border-white/10 px-3 py-2 font-mono text-sm">{item.code}</p>}
                      {item.date && <p className="mt-3 text-xs text-slate-400">{t("تاريخ الهدية:", "Prize date:")} {new Date(item.date).toLocaleString(language === "ar" ? "ar-EG" : "en-US", { timeZone: "Africa/Cairo" })}</p>}
                    </article>
                  ))}
                </div>
              ) : <p className="mt-4 text-sm leading-7 text-slate-400">{t("لا توجد جوائز مسجلة في حسابك حتى الآن.", "No prizes recorded in your account yet.")}</p>}
              <a href="/hotlucky" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-200 to-amber-500 px-4 py-3 font-bold text-black"><Crown size={17}/> {t("زيارة HotLucky", "Visit HotLucky")}</a>
            </section>
          </>
        )}
      </div>
    </main>
    </LocalizedText>
  );
}
