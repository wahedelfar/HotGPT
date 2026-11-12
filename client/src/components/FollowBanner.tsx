import { useState } from "react";
import { useLocation } from "wouter";
import { useAppLanguage } from "../contexts/LanguageContext";

const DISMISS_KEY = "hotgpt-follow-banner-dismissed";

// Slim Follow Store promo bar shown at the top of every routed page except
// the homepage ("/"). The chat workspace ("/chat/:id") is not the homepage,
// so the bar shows there too; App.tsx mounts it inside a flex column so it
// takes its natural height and never squeezes the page content.
// Copy is split into segments so that on narrow screens only the middle
// list truncates — the hook («من ٥٠ جنيه») and the CTA never clip.
export default function FollowBanner() {
  const [location] = useLocation();
  const { language } = useAppLanguage();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (location === "/" || dismissed) return null;

  const ar = language === "ar";
  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable — hide for this mount anyway */
    }
    setDismissed(true);
  };

  return (
    <div
      className="relative z-40 flex shrink-0 items-center justify-center gap-2 border-b border-[#C9A227]/40 bg-[#1A0505] px-2 py-2"
      role="region"
      aria-label={ar ? "متجر المتابعين" : "Follow Store"}
    >
      <p className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap text-[11px] font-bold text-white sm:text-[12.5px]">
        <span className="shrink-0">{ar ? "زوّد صفحاتك" : "Grow your pages"}</span>
        <span className="min-w-0 truncate font-semibold text-slate-300">
          {ar ? "— متابعين ولايكات ومشاهدات" : "— followers, likes & views"}
        </span>
        <span className="shrink-0 font-black text-[#FBBF24]">
          {ar ? "من ٥٠ جنيه" : "from EGP 50"}
        </span>
      </p>
      <a
        href="/follow"
        className="shrink-0 rounded-md bg-[#FBBF24] px-2.5 py-1 text-[11px] font-black text-[#1A0505] sm:text-[12px]"
      >
        {ar ? "افتح المتجر" : "Open the store"}
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label={ar ? "إغلاق" : "Dismiss"}
        className="shrink-0 px-1 text-[12px] leading-none text-white/45 transition hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
