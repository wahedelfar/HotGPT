import { Facebook } from "lucide-react";
import { useAppLanguage } from "@/contexts/LanguageContext";

// Facebook follow pill shown under the header (side) on all public pages except Home.
export default function FbFollow() {
  const { language } = useAppLanguage();
  const ar = language === "ar";
  return (
    <a
      href="https://www.facebook.com/hotgpt"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        background: "#1877F2",
        color: "#fff",
        fontWeight: 800,
        fontSize: 13,
        padding: "7px 14px",
        borderRadius: 999,
        textDecoration: "none",
        lineHeight: 1.4,
      }}
    >
      <Facebook size={15} />
      {ar ? "تابعنا على فيسبوك" : "Follow us on Facebook"}
    </a>
  );
}
