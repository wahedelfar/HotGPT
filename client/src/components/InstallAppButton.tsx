import { useEffect, useRef, useState } from "react";
import { useAppLanguage } from "@/contexts/LanguageContext";

const INSTALLED_KEY = "hotgpt-pwa-installed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function InstallAppButton() {
  const { language } = useAppLanguage();
  const [visible, setVisible] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    if (isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, "1");
      return;
    }
    if (localStorage.getItem(INSTALLED_KEY) === "1") return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event;
      setVisible(true);
    };
    const onAppInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      deferredPrompt.current = null;
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (!visible) return null;

  const label = language === "en" ? "Install app" : "تثبيت التطبيق";

  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        const promptEvent = deferredPrompt.current;
        if (!promptEvent) { setVisible(false); return; }
        deferredPrompt.current = null;
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice.catch(() => null);
        if (choice && choice.outcome === "accepted") {
          localStorage.setItem(INSTALLED_KEY, "1");
        }
        setVisible(false);
      }}
      style={{
        position: "fixed",
        bottom: "calc(88px + env(safe-area-inset-bottom))",
        insetInlineEnd: "16px",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 14px",
        borderRadius: "999px",
        border: "1px solid rgba(251, 191, 36, 0.55)",
        background: "rgba(21, 21, 25, 0.92)",
        color: "#FBBF24",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 600,
      }}
    >
      <img src="/brand/logo.png" alt="" width={22} height={22} style={{ borderRadius: "6px" }} />
      {label}
    </button>
  );
}
