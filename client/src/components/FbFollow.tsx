import { Facebook, Newspaper } from "lucide-react";
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

// Blog pill paired with FbFollow (banked 2026-11-02, Wahid's order): same pill
// geometry, HotGPT gold identity, sits beside the Facebook pill on the same rows.
export function BlogFollow() {
  const { language } = useAppLanguage();
  const ar = language === "ar";
  return (
    <a
      href="https://hot-gpt.blogspot.com"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        background: "linear-gradient(135deg,#F6C453,#B97A0F)",
        color: "#231600",
        fontWeight: 800,
        fontSize: 13,
        padding: "7px 14px",
        borderRadius: 999,
        textDecoration: "none",
        lineHeight: 1.4,
      }}
    >
      <Newspaper size={15} />
      {ar ? "مدونة HotGPT" : "HotGPT Blog"}
    </a>
  );
}

// Smol Launch featured badge (owner order 2026-11-03): the directory's free
// listing earns its dofollow backlink while this badge is live on the site.
// It sits BESIDE the Facebook and Blog pills (owner: «جمبهم مش تحتهم») at the
// same height as the pills so the row stays even, never below them.
export function SmolBadge() {
  return (
    <a
      href="https://smollaunch.com"
      target="_blank"
      rel="noopener"
      style={{ display: "inline-flex", alignItems: "center", lineHeight: 0 }}
    >
      <img
        src="https://smollaunch.com/badges/featured.svg"
        alt="HOTGPT — Featured on Smol Launch"
        loading="lazy"
        style={{ height: 33, width: "auto" }}
      />
    </a>
  );
}
