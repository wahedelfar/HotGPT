import { useState } from "react";
import { useAppLanguage } from "@/contexts/LanguageContext";

// +18 age gate (2026-10-27): shown on first visit, remembered for
// ~30 days in localStorage. "Exit" leaves for real (navigates away);
// "Enter" is an explicit 18+ confirmation. Rendered by the app root
// (and by Home as a fallback) — it blocks the UI until confirmed.

const KEY = "hotgpt-age-confirmed-at";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function alreadyConfirmed(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY) || 0);
    return at > 0 && Date.now() - at < THIRTY_DAYS;
  } catch { return false; }
}

export default function AgeGate() {
  const { language } = useAppLanguage();
  const t = (ar: string, en: string) => (language === "ar" ? ar : en);
  const [confirmed, setConfirmed] = useState<boolean>(() => alreadyConfirmed());
  if (confirmed) return null;

  const enter = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
    setConfirmed(true);
  };
  const exit = () => { window.location.replace("https://www.google.com"); };

  return (
    <div dir={language === "ar" ? "rtl" : "ltr"} role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(5,0,0,.92)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ maxWidth: 430, width: "100%", textAlign: "center", background: "linear-gradient(160deg,#1a0505,#0d0d0d)", border: "1px solid rgba(201,162,39,.45)", borderRadius: 22, padding: "30px 24px", color: "#fff", boxShadow: "0 24px 80px rgba(0,0,0,.6)" }}>
        <img src="/brand/logo.png" alt="HotGPT" style={{ width: 84, height: 84, objectFit: "contain", margin: "0 auto 10px", display: "block" }} />
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: "4px 0" }}>HotGPT</h2>
        <p style={{ color: "#f7cf65", fontWeight: 800, fontSize: 14, margin: "2px 0 10px" }}>
          {t("برمجة • اختبار اختراق • فحص ثغرات — بدون قيود", "Programming • Pentesting • Vuln Scanning — NO LIMITS")}
        </p>
        <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.9, margin: "8px 0 4px" }}>
          {t("هذا الموقع مخصص للبالغين فقط (+18). بالدخول أنت تقر أن عمرك ١٨ عامًا أو أكثر، وأنك مسؤول عن استخدامك للمحتوى وفق قوانين بلدك.",
             "This site is for adults only (18+). By entering you confirm that you are at least 18 years old and that you are responsible for your use of the content under your country's laws.")}
        </p>
        <button type="button" onClick={enter}
          style={{ display: "block", width: "100%", marginTop: 16, padding: "13px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#ffe69a,#e5a927)", color: "#171006", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
          {t("أنا أكبر من 18 — دخول", "I am over 18 — Enter")}
        </button>
        <button type="button" onClick={exit}
          style={{ display: "block", width: "100%", marginTop: 10, padding: "11px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,.25)", background: "transparent", color: "#e2e8f0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {t("خروج", "Exit")}
        </button>
        <p style={{ marginTop: 14, fontSize: 12, color: "#94a3b8" }}>
          <a href="/terms" style={{ color: "#f7cf65", textDecoration: "underline" }}>{t("الشروط والأحكام", "Terms")}</a>
          {" · "}
          <a href="/privacy" style={{ color: "#f7cf65", textDecoration: "underline" }}>{t("سياسة الخصوصية", "Privacy")}</a>
        </p>
      </div>
    </div>
  );
}
