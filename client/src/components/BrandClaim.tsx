import { useAppLanguage } from "@/contexts/LanguageContext";

export default function BrandClaim() {
  const { language } = useAppLanguage();
  const ar = language === "ar";
  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ textAlign: "center", margin: "4px 0 20px" }}>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 900, lineHeight: 1.15, color: "#FFFFFF" }}>HotGPT</p>
      <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 700, lineHeight: 1.9, color: "#FBBF24" }}>
        {ar ? "أول منصة مصرية بدون قيود على البحث والبرمجة" : "No limits on research & programming"}
      </p>
    </div>
  );
}
