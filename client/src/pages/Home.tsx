import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowUp,
  Coins,
  Bot,
  HelpCircle,
  LogOut,
  Crown,
  CreditCard,
  Check,
  Copy,
  ChevronDown,
  CircleHelp,
  FileText,
  FolderOpen,
  Globe,
  Menu,
  MessageSquare,
  Moon,
  Sun,
  MoreHorizontal,
  Trash2,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Upload,
  Terminal,
  SlidersHorizontal,
  Shield,
  Skull,
  Wifi,
  Cpu,
  Crosshair,
  Radar,
  Radio,
  TrendingUp,
  Users,
  Image as ImageIcon,
  Lock,
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { authFetch } from "@/lib/auth";
import { trackFunnelEvent } from "@/lib/analytics";

type Language = "ar" | "en";
const LanguageContext = createContext<{ language: Language; toggleLanguage: () => void }>({ language: "ar", toggleLanguage: () => {} });
function useLanguage() { return useContext(LanguageContext); }
function tr(language: Language, ar: string, en: string) { return language === "ar" ? ar : en; }

type LeadBusiness = {
  name: string;
  phone?: string;
  address?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  placeId?: string;
  lat?: number;
  lng?: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  notice?: boolean;
  continuationAvailable?: boolean;
  isComplete?: boolean; partCount?: number; lastFinishReason?: string | null;
  continuationDisabled?: boolean; continuationLabel?: string;
  imageUrl?: string;
  leadsData?: LeadBusiness[];
  leadsQuery?: string;
  leadsOffset?: number;
  leadsMoreDisabled?: boolean;
};

type Conversation = {
  id: string;
  title: string;
  preview: string;
  date: string;
};

// Welcome starter cards (redesigned 2026-10-27): each card loads a strong,
// direct task brief AND switches the composer to the mode that executes
// it best — the security cards run on الوحش PRO, the dark-web card opens
// Dark mode. CRYPTO_OPS retired; crypto work lives inside CODE_LAB.
type StarterMode = "beast" | "dark";
const starters: Array<{
  icon: typeof Shield;
  label: string;
  description: string;
  descriptionEn: string;
  prompt: string;
  promptEn: string;
  mode: StarterMode;
}> = [
  {
    icon: Crosshair,
    label: "VULN_HUNT",
    description: "مراجعة كود واكتشاف الثغرات — مع الإصلاح",
    descriptionEn: "Code review & vulnerability hunting — with fixes",
    prompt: "راجع الكود الذي سأرسله بحثًا عن ثغرات أمنية وأخطاء منطقية، رتّب النتائج حسب الخطورة، ثم أعطني إصلاحات عملية وكودًا مصححًا.",
    promptEn: "Review the code I send for security weaknesses and logic bugs, rank the findings by severity, then give practical fixes and corrected code.",
    mode: "beast",
  },
  {
    icon: Radar,
    label: "NET_RECON",
    description: "مراجعة إعدادات أمان موقعك وتقوية الحماية",
    descriptionEn: "Review your site's security settings & harden them",
    prompt: "أريد مراجعة دفاعية لإعدادات موقعي. أعطني قائمة تحقق لهيدرز الأمان وTLS وSPF وDMARC والملفات المكشوفة، مع طريقة إصلاح كل نقطة.",
    promptEn: "Give me a defensive review checklist for my website: security headers, TLS, SPF, DMARC, and exposed files, with a practical fix for each item.",
    mode: "beast",
  },
  {
    icon: Terminal,
    label: "CODE_LAB",
    description: "إصلاح خطأ برمجي وإضافة اختبار يثبّته",
    descriptionEn: "Fix a bug and add a test that locks it in",
    prompt: "سأرسل لك خطأ برمجيًا أو جزءًا من كود. اشرح سبب المشكلة، ثم اكتب الحل الكامل القابل للتشغيل وأضف اختبارًا بسيطًا للتأكد منه.",
    promptEn: "I will send a programming error or code snippet. Explain the root cause, provide a complete working fix, and add a small test to verify it.",
    mode: "beast",
  },
  {
    icon: Skull,
    label: "DARK_WEB",
    description: "استخبارات الدارك ويب والتسريبات والأسواق",
    descriptionEn: "Dark-web intel, leaks & markets",
    prompt: "ادّيني الصورة الاستخباراتية الكاملة عن أي موضوع في الدارك ويب: أسواق ومنتديات وتسريبات وفاعلو تهديد، بمصادر وتحليل معمق.",
    promptEn: "Give me the full intelligence picture on any dark-web topic: markets, forums, leaks, and threat actors, with sources and deep analysis.",
    mode: "dark",
  },
];

const initialConversations: Conversation[] = [];

function formatTime() {
  return new Intl.DateTimeFormat("ar", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}


function BrandMark({ compact = false }: { compact?: boolean }) {
  const { language } = useLanguage();
  return (
    <div className="brand-mark" aria-label={language === "ar" ? "للمطورين والباحثين" : "For Developers & Researchers"}>
      <img
        className="brand-logo-img"
        src="/brand/logo.png"
        alt={language === "ar" ? "للمطورين والباحثين" : "For Developers & Researchers"}
        draggable={false}
      />
      {!compact && <span className="brand-wordmark">Hot<span>GPT</span></span>}
    </div>
  );
}

function Sidebar({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onDeleteAll,
  onNew,
  onSettings,
  onGuide,
  activeView,
  onClose,
  displayName,
  email,
  walletBalance,
  onLogout,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onNew: () => void;
  onSettings: () => void;
  onGuide: () => void;
  activeView: string;
  onClose?: () => void;
  displayName: string;
  email: string;
  walletBalance: number;
  onLogout: () => void;
}) {
  const { language } = useLanguage();
  const [openConversationMenu, setOpenConversationMenu] = useState<string | null>(null);
  const [historyMenuOpen, setHistoryMenuOpen] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);
  return (
    <aside className="sidebar">
      <style>{`
.sidebar{border-inline-end:1px solid rgba(255,255,255,.07)}
.sidebar .new-chat-button{border-radius:12px!important;font-weight:800;letter-spacing:.2px;box-shadow:0 6px 18px rgba(220,38,38,.25)}
.sidebar-search input{border-radius:10px!important}
.sidebar .nav-item{border-radius:10px;padding:9px 12px;font-weight:600;transition:background .15s ease,color .15s ease}
.sidebar .nav-item:hover{background:rgba(255,255,255,.06)}
.sidebar .nav-item.active{background:rgba(220,38,38,.16);color:#fff;font-weight:800}
.sidebar .list-heading{font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;opacity:.75}
.sidebar .tiny-button{border-radius:8px;transition:background .15s ease}
.sidebar .tiny-button:hover{background:rgba(255,255,255,.08)}
.sidebar .conversation-list{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent}
.sidebar .conversation-list::-webkit-scrollbar{width:6px}
.sidebar .conversation-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:99px}
.sidebar .conversation-item{border-radius:10px;transition:background .15s ease}
.sidebar .conversation-item:hover{background:rgba(255,255,255,.05)}
.sidebar .conversation-item.selected{background:rgba(255,255,255,.09)}
.sidebar .rewards-sidebar-link{display:flex;align-items:center;gap:8px;margin:10px 12px 0;padding:10px 12px;border-radius:10px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.22);color:#FBBF24;font-weight:800;text-decoration:none;transition:background .15s ease}
.sidebar .rewards-sidebar-link:hover{background:rgba(251,191,36,.14)}
.sidebar .sidebar-note{opacity:.8}
.sidebar .profile-row{border-radius:12px;width:100%;transition:background .15s ease}
.sidebar .profile-row:hover{background:rgba(255,255,255,.06)}
.sidebar .profile-avatar{background:linear-gradient(135deg,#DC2626,#F59E0B)!important;color:#fff!important;font-weight:900}
.sidebar-profile-wrap{position:relative;width:100%}
.sidebar-profile-menu{top:auto!important;bottom:calc(100% + 8px);inset-inline:0;width:100%;min-width:0}
      `}</style>
      <div className="sidebar-top">
        <div className="sidebar-brand-row">
          <BrandMark />
          <button
            className="icon-button mobile-only"
            onClick={onClose}
            aria-label={tr(language, "إغلاق القائمة", "Close menu")}
          >
            <X size={18} />
          </button>
        </div>
        <Button className="new-chat-button" onClick={onNew}>
          <Plus size={16} /> {tr(language, "محادثة جديدة", "New chat")}{" "}
          <span className="new-chat-shortcut">N</span>
        </Button>
      </div>

      <div className="sidebar-search">
        <Search size={15} />
        <input
          aria-label={tr(language, "البحث في المحادثات", "Search conversations")}
          placeholder={tr(language, "البحث في المحادثات", "Search conversations")}
        />
        <span className="search-shortcut">⌘ K</span>
      </div>

      <nav className="sidebar-nav" aria-label={tr(language, "التنقل الرئيسي", "Main navigation")}>
        <button
          className={activeView === "chat" ? "nav-item active" : "nav-item"}
          onClick={onNew}
        >
          <MessageSquare size={16} /> {tr(language, "المحادثات", "Chats")}
        </button>
        <button
          className={activeView === "settings" ? "nav-item active" : "nav-item"}
          onClick={onSettings}
        >
          <Settings size={16} /> {tr(language, "الإعدادات", "Settings")}
        </button>
        <a className="nav-item" href="/models" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
          <Bot size={16} /> {tr(language, "النماذج", "Models")}
        </a>
        <a className="nav-item" href="/billing" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
          <CreditCard size={16} /> {tr(language, "الباقات", "Packs")}
        </a>
        <a className="nav-item" href="/faq" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
          <HelpCircle size={16} /> {tr(language, "الأسئلة الشائعة", "FAQ")}
        </a>
      </nav>

      <div className="conversation-list-wrap">
        <div className="list-heading">
          <span>{tr(language, "الأخيرة", "Recent")}</span>
          <button
            type="button"
            className="tiny-button"
            aria-label={tr(language, "خيارات السجل", "History options")}
            aria-expanded={historyMenuOpen}
            onClick={() => setHistoryMenuOpen(value => !value)}
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
        {historyMenuOpen && conversations.length > 0 && (
          <button
            type="button"
            className="conversation-delete-action"
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", background: "transparent", border: "none", cursor: "pointer", color: "#f87171", fontSize: 13, textAlign: "start" }}
            onClick={() => {
              setHistoryMenuOpen(false);
              const confirmed = window.confirm(tr(language, "هل تريد مسح كل المحادثات نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.", "Delete ALL conversations permanently? This cannot be undone."));
              if (confirmed) onDeleteAll();
            }}
          >
            <Trash2 size={14} />
            {tr(language, "مسح كل المحادثات", "Delete all conversations")}
          </button>
        )}
        <div className="conversation-list">
          {conversations.map(conversation => (
            <div className="conversation-row-wrap" key={conversation.id}>
              <button
                type="button"
                className={
                  activeId === conversation.id
                    ? "conversation-item selected"
                    : "conversation-item"
                }
                onClick={() => { setOpenConversationMenu(null); onSelect(conversation.id); }}
              >
                <span className="conversation-icon">
                  <MessageSquare size={14} />
                </span>
                <span className="conversation-copy">
                  <strong>{conversation.title}</strong>
                  <small>{conversation.preview}</small>
                </span>
                <span className="conversation-date">{conversation.date}</span>
              </button>
              <div className="conversation-actions">
                <button
                  type="button"
                  className="conversation-more-button"
                  aria-label={tr(language, "خيارات المحادثة", "Conversation options")}
                  aria-haspopup="menu"
                  aria-expanded={openConversationMenu === conversation.id}
                  title={tr(language, "خيارات المحادثة", "Conversation options")}
                  onClick={() => setOpenConversationMenu(current => current === conversation.id ? null : conversation.id)}
                >
                  <MoreHorizontal size={16} />
                </button>
                {openConversationMenu === conversation.id && (
                  <div className="conversation-context-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="conversation-delete-action"
                      onClick={() => {
                        setOpenConversationMenu(null);
                        const confirmed = window.confirm(tr(language, "هل تريد حذف هذه المحادثة نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.", "Delete this conversation permanently? This cannot be undone."));
                        if (confirmed) onDelete(conversation.id);
                      }}
                    >
                      <Trash2 size={14} />
                      {tr(language, "حذف المحادثة", "Delete conversation")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <a href="/rewards" className="rewards-sidebar-link">🎁 <span>{tr(language, "صفحة الجوائز", "Rewards")}</span></a>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span className="note-mark">
            <Sparkles size={14} />
          </span>
          <p>
            {tr(language, "برمجة • اختبار اختراق • فحص ثغرات", "Programming • Pentesting • Vuln Scanning")}
            <br />
            <strong>{tr(language, "للمطورين والباحثين", "FOR DEVELOPERS & RESEARCHERS")}</strong>
          </p>
          <ArrowUp size={13} />
        </div>
        <div className="profile-menu-wrap sidebar-profile-wrap">
          {sidebarProfileOpen && (
            <>
              <button className="profile-menu-backdrop" aria-label={tr(language, "إغلاق قائمة الحساب", "Close account menu")} onClick={() => setSidebarProfileOpen(false)} />
              <div className="profile-menu sidebar-profile-menu" role="menu">
                <div className="profile-menu-identity">
                  <strong>{displayName}</strong>
                  <span>{email}</span>
                  <a href="/billing" className="profile-token-badge"><Coins size={17} /> {walletBalance} {tr(language, "توكن", "tokens")}</a>
                </div>
                <a role="menuitem" href="/billing" className="profile-menu-item"><CreditCard size={19} /> <span>{tr(language, "الفوترة والباقات", "Billing & plans")}</span></a>
                <a role="menuitem" href="/rewards" className="profile-menu-item"><Sparkles size={19} /> <span>{tr(language, "صفحة الجوائز", "Rewards")}</span></a>
                <button role="menuitem" className="profile-menu-item" onClick={() => { setSidebarProfileOpen(false); onSettings(); }}><Settings size={19} /> <span>{tr(language, "الإعدادات", "Settings")}</span></button>
                <button role="menuitem" className="profile-menu-item profile-menu-logout" onClick={onLogout}><LogOut size={19} /> <span>{tr(language, "تسجيل الخروج", "Sign out")}</span></button>
              </div>
            </>
          )}
          <button type="button" className="profile-row" aria-expanded={sidebarProfileOpen} aria-haspopup="menu" onClick={() => setSidebarProfileOpen(open => !open)}>
            <span className="profile-avatar">{displayName.trim().charAt(0).toLocaleUpperCase("ar-EG") || "م"}</span>
            <span>
              <strong>{displayName}</strong>
              <small>{email || tr(language, "الحساب الشخصي", "Personal account")}</small>
            </span>
            <ChevronDown size={15} style={{ transform: sidebarProfileOpen ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
          </button>
        </div>
      </div>
    </aside>
  );
}


function LeadCards({ leads, language, startIndex = 0, onMore, moreDisabled = false }: { leads: LeadBusiness[]; language: Language; startIndex?: number; onMore?: () => void; moreDisabled?: boolean }) {
  const withPhone = leads.filter(lead => Boolean(lead.phone)).length;
  return (
    <div className="leads-panel" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="leads-heading">📇 {language === "ar" ? "نتائج استخراج العملاء" : "Lead extraction results"}</div>
      <div className="leads-sub">{language === "ar" ? `تم العثور على ${leads.length} شركة — ${withPhone} منها برقم تليفون منشور.` : `${leads.length} businesses found — ${withPhone} with a published phone number.`}</div>
      {leads.map((lead, index) => (
        <div className="lead-card" key={index}>
          <div className="lead-card-name">{startIndex + index + 1}. {lead.name}</div>
          {lead.phone && (
            <div className="lead-row">
              <span className="lead-row-label">📞 {language === "ar" ? "التليفون" : "Phone"}</span>
              <a className="lead-phone" dir="ltr" href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}>{lead.phone}</a>
            </div>
          )}
          {lead.address && (
            <div className="lead-row">
              <span className="lead-row-label">📍 {language === "ar" ? "العنوان" : "Address"}</span>
              <span className="lead-row-value">{lead.address}</span>
            </div>
          )}
          {typeof lead.rating === "number" && (
            <div className="lead-row">
              <span className="lead-row-label">⭐ {language === "ar" ? "التقييم" : "Rating"}</span>
              <span className="lead-row-value">{lead.rating}{typeof lead.reviews === "number" ? ` (${lead.reviews} ${language === "ar" ? "تقييم" : "reviews"})` : ""}</span>
            </div>
          )}
          {lead.website && (
            <div className="lead-row">
              <span className="lead-row-label">🌐 {language === "ar" ? "الموقع" : "Website"}</span>
              <a className="lead-site" dir="ltr" href={/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer">{lead.website}</a>
            </div>
          )}
        </div>
      ))}
      <div className="leads-foot">{language === "ar" ? "البيانات من خرائط جوجل كما هي منشورة علنًا وقت الاستخراج، وقد تتغير." : "Data from Google Maps as publicly listed at extraction time; it may change."}</div>
      {onMore && (
        <button type="button" onClick={onMore} disabled={moreDisabled} style={{ display: "inline-flex", alignItems: "center", gap: 6, justifySelf: "start", padding: "7px 12px", borderRadius: 10, border: "1px solid #C9A227", background: "rgba(201,162,39,0.10)", color: "#FBBF24", fontSize: 13, fontWeight: 600, cursor: moreDisabled ? "not-allowed" : "pointer", opacity: moreDisabled ? 0.6 : 1 }}>
          <ChevronDown size={14} /><span>{language === "ar" ? "استخراج المزيد" : "Extract more"}</span>
        </button>
      )}
    </div>
  );
}

function SearchResultCards({ content, language }: { content: string; language: Language }) {
  const sections = content.split(/\n(?=###\s+\d+\.)/);
  const items = sections.map(section => {
    const heading = section.match(/^###\s+\d+\.\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)/m);
    if (!heading) return null;
    const snippet = section.slice(heading[0].length).replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1").replace(/\s+/g, " ").trim();
    return { title: heading[1].trim(), url: heading[2].trim(), snippet };
  }).filter((item): item is { title: string; url: string; snippet: string } =>
    Boolean(item && item.title && item.snippet && !/profile image|jordan host|all right reserved/i.test(item.title + " " + item.snippet))
  ).filter((item, index, all) =>
    all.findIndex(other => other.url.replace(/#.*$/, "").replace(/\/$/, "") === item.url.replace(/#.*$/, "").replace(/\/$/, "")) === index
  ).slice(0, 10);

  if (!items.length) return <div className="message-content"><Streamdown>{content}</Streamdown></div>;
  const domain = (value: string) => {
    try {
      const hostname = new URL(value).hostname;
      try { return decodeURIComponent(hostname).replace(/^www\./i, ""); }
      catch { return hostname.replace(/^www\./i, ""); }
    } catch { return ""; }
  };
  const snippetDirection = (value: string) => /[\u0600-\u06FF]/.test(value) ? "rtl" as const : "ltr" as const;
  const card = (item: typeof items[number]) => (
    <a className="search-result-card" key={item.url} href={item.url} target="_blank" rel="noopener noreferrer">
      <div className="search-result-card-top"><strong>{item.title}</strong><span className="search-result-domain" dir="ltr">{domain(item.url)}</span></div>
      <p dir={snippetDirection(item.snippet)}>{item.snippet}</p>
      <span className="search-result-open">{language === "ar" ? "فتح المصدر ↗" : "Open source ↗"}</span>
    </a>
  );
  return <div className="search-results-panel" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="search-results-heading">{language === "ar" ? "أفضل النتائج" : "Top results"}</div>
    <div className="search-results-grid">{items.slice(0, 3).map(card)}</div>
    {items.length > 3 && <>
      <div className="search-results-heading more-results-heading">{language === "ar" ? "مزيد من النتائج" : "More results"}</div>
      <div className="search-results-grid">{items.slice(3).map(card)}</div>
    </>}
  </div>;
}

function CodeBlock({ code, label, language }: { code: string; label: string; language: Language }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.setAttribute("dir", "ltr");
      textarea.style.cssText = "position:fixed;opacity:0;left:-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section className="code-block-shell" dir="ltr" style={{ direction: "ltr", textAlign: "left", unicodeBidi: "isolate", overflowX: "auto", background: "#111", padding: 0, borderRadius: 12 }}>
      <div className="code-block-header" dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate" }}>
        <span className="code-block-language" dir="ltr">{label || "code"}</span>
        <button type="button" className="code-block-copy" onClick={copy} dir="ltr" aria-label={language === "ar" ? "نسخ الكود" : "Copy code"}>
          {copied ? (language === "ar" ? "تم النسخ" : "Copied") : (language === "ar" ? "نسخ الكود" : "Copy code")}
        </button>
      </div>
      <pre dir="ltr" style={{ direction: "ltr", textAlign: "left", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", overflowX: "auto", whiteSpace: "pre", unicodeBidi: "isolate", margin: 0, padding: 16, background: "#111", color: "#fff" }}>
        <code dir="ltr" style={{ direction: "ltr", textAlign: "left", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", overflowX: "auto", whiteSpace: "pre", unicodeBidi: "isolate" }}>{code}</code>
      </pre>
    </section>
  );
}

function RenderedMessageContent({ content, language }: { content: string; language: Language }) {
  // Parse fenced code before handing prose to Streamdown. This guarantees that
  // Arabic comments/newlines remain literal code text inside one stable block.
  const segments: Array<{ type: "text"; value: string } | { type: "code"; value: string; label: string }> = [];
  const fence = /```([^\r\n`]*)\r?\n([\s\S]*?)(?:\r?\n?```|$)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(content)) !== null) {
    if (match.index > cursor) segments.push({ type: "text", value: content.slice(cursor, match.index) });
    segments.push({ type: "code", label: match[1].trim().split(/\s+/)[0] || "code", value: match[2] });
    cursor = fence.lastIndex;
  }
  if (cursor < content.length) segments.push({ type: "text", value: content.slice(cursor) });
  if (!segments.length) return null;

  return <>
    {segments.map((segment, index) => segment.type === "code"
      ? <CodeBlock key={`code-${index}`} code={segment.value} label={segment.label} language={language} />
      : segment.value.trim()
        ? <Streamdown key={`text-${index}`}>{segment.value}</Streamdown>
        : null)}
  </>;
}

function MessageBubble({ message, onContinue, onExtractMore }: { message: ChatMessage; onContinue?: () => void; onExtractMore?: () => void }) {
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = codeContainerRef.current;
    if (!root) return;
    root.querySelectorAll("table").forEach(table => {
      if (table.parentElement?.classList.contains("markdown-table-scroll")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "markdown-table-scroll";
      wrapper.setAttribute("dir", "rtl");
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }, [message.content]);
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = message.content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };
  if (message.notice) {
    return (
      <div className="provider-notice">
        <div className="notice-icon">
          <Sparkles size={16} />
        </div>
        <div>
          <strong>{tr(language, "تم استلام رسالتك", "Message received")}</strong>
          <p>{message.content}</p>
        </div>
      </div>
    );
  }
  return (
    <div
      className={
        message.role === "user"
          ? "message-row user-row"
          : "message-row assistant-row"
      }
    >
      <div
        className={
          message.role === "user"
            ? "message-avatar user-avatar"
            : "message-avatar assistant-avatar"
        }
      >
        {message.role === "user" ? (language === "ar" ? "م" : "U") : <Sparkles size={15} />}
      </div>
      <div className="message-body">
        <div className="message-meta">
          <strong>{message.role === "user" ? tr(language, "أنت", "You") : "HotGPT"}</strong>
          <span>{message.timestamp}</span>
        </div>
        <div className="message-content" ref={codeContainerRef}>
          {message.imageUrl && <img src={message.imageUrl} alt={tr(language, "صورة مولّدة", "Generated image")} style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 8 }} />}
          {message.imageUrl && <div style={{ marginBottom: 8 }}><a href={message.imageUrl} download="hotgpt-image.png" style={{ fontSize: 12, color: "#22d3ee" }}>{tr(language, "⬇ احفظ الصورة على جهازك", "⬇ Save the image to your device")}</a><span style={{ fontSize: 12, opacity: 0.75 }}> — {tr(language, "ستُحذف عند تسجيل خروجك ولا تُحفظ في السجل", "it is deleted when you sign out and is not kept in history")}</span></div>}
          {message.leadsData && message.leadsData.length > 0 ? <LeadCards leads={message.leadsData} language={language} startIndex={message.leadsOffset ?? 0} onMore={onExtractMore} moreDisabled={message.leadsMoreDisabled === true} /> : message.role === "assistant" && /## نتائج البحث|## نتائج البحث الموسع/.test(message.content) ? <SearchResultCards content={message.content} language={language} /> : <RenderedMessageContent content={message.content} language={language} />}
        </div>
        <div className="message-actions">
          <button
            type="button"
            className={`message-copy-button${copied ? " copied" : ""}`}
            onClick={copyMessage}
            aria-label={tr(language, "نسخ الرسالة", "Copy message")}
            title={copied ? tr(language, "تم النسخ", "Copied") : tr(language, "نسخ", "Copy")}
          >
            {copied ? <Check size={13} strokeWidth={1.8} /> : <Copy size={13} strokeWidth={1.8} />}
            <span>{copied ? tr(language, "تم النسخ", "Copied") : tr(language, "نسخ", "Copy")}</span>
          </button>
          {message.role === "assistant" && message.continuationAvailable && onContinue && (
            <button type="button" className="message-continue-button" onClick={onContinue} disabled={message.continuationDisabled || !onContinue} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "7px 12px", borderRadius: 10, border: "1px solid #C9A227", background: "rgba(201,162,39,0.10)", color: "#FBBF24", fontSize: 13, fontWeight: 600, cursor: message.continuationDisabled || !onContinue ? "not-allowed" : "pointer", opacity: message.continuationDisabled || !onContinue ? 0.6 : 1 }}><ChevronDown size={14} /><span>{message.continuationLabel || tr(language, "أكمل الشرح", "Continue explanation")}</span></button>
          )}
        </div>
      </div>
    </div>
  );
}

export function LanguageFlag({ lang }: { lang: "ar" | "en" }) {
  if (lang === "en") {
    return (
      <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" style={{ borderRadius: 3, display: "block", flex: "0 0 auto" }}>
        <rect width="20" height="14" fill="#ffffff" />
        {[0, 2.15, 4.31, 6.46, 8.62, 10.77, 12.92].map(y => (
          <rect key={y} y={y} width="20" height="1.08" fill="#B31942" />
        ))}
        <rect width="9.5" height="7.55" fill="#0A3161" />
        {[1.6, 4.75, 7.9].map(cx => [1.7, 3.8, 5.9].map(cy => (
          <circle key={cx + "-" + cy} cx={cx} cy={cy} r="0.62" fill="#ffffff" />
        )))}
      </svg>
    );
  }
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" style={{ borderRadius: 3, display: "block", flex: "0 0 auto" }}>
      <rect width="20" height="4.67" fill="#CE2B37" />
      <rect y="4.67" width="20" height="4.67" fill="#ffffff" />
      <rect y="9.33" width="20" height="4.67" fill="#000000" />
      <path d="M10 5.1 L10.9 6.6 L13.2 5.9 L11.9 7.6 L12.6 9.4 L10.7 8.5 L10.7 9.9 L9.3 9.9 L9.3 8.5 L7.4 9.4 L8.1 7.6 L6.8 5.9 L9.1 6.6 Z" fill="#C09300" />
    </svg>
  );
}

// Marketing line carried by every popup (Wahid's positioning, 2026-10-27):
// HotGPT is the cheapest home for research & programming models.
function CheapestLine() {
  const { language } = useLanguage();
  return (
    <p style={{ marginTop: 14, padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(251,191,36,.35)", background: "rgba(251,191,36,.07)", color: "#FBBF24", fontSize: 12.5, fontWeight: 800, textAlign: "center", lineHeight: 1.8 }}>
      ⚡ {tr(language, "أرخص موقع لنماذج ذكاء اصطناعي بدون قيود على البحث والبرمجة — القوة الكاملة، بسعر أقل.", "The cheapest AI with no limits on research & programming — full power, lower price.")}
    </p>
  );
}

function Welcome({ onStarter, walletBalance, onScan, onDarkLive, onSeo }: {
  onStarter: (text: string, mode: StarterMode) => void;
  walletBalance: number;
  onScan: () => void;
  onDarkLive: () => void;
  onSeo: () => void;
}) {
  const { language } = useLanguage();
  const [hotLuckyBannerVisible, setHotLuckyBannerVisible] = useState(false);
  useEffect(() => { try { const until = Number(localStorage.getItem("hotlucky-banner-dismissed-until") || 0); setHotLuckyBannerVisible(Date.now() >= until); } catch { setHotLuckyBannerVisible(true); } }, []);
  const dismissHotLuckyBanner = () => { try { localStorage.setItem("hotlucky-banner-dismissed-until", String(Date.now() + 24 * 60 * 60 * 1000)); } catch {} setHotLuckyBannerVisible(false); };
  // Unified welcome grid (Wahid, 2026-10-27): slightly smaller cards,
  // free starters interleaved with Premium services — every row pairs
  // one of each, Premium carries a badge (+ lock under 20 tokens).
  const cardStyle: React.CSSProperties = { minHeight: 56, padding: "9px 11px" };
  const premiumBadge = (
    <span style={{ display: "inline-block", marginInlineStart: 6, padding: "1px 7px", borderRadius: 999, background: "rgba(251,191,36,.16)", border: "1px solid rgba(251,191,36,.55)", color: "#FBBF24", fontSize: 10, fontWeight: 800, verticalAlign: "2px" }}>⭐ {tr(language, "بريميوم", "Premium")}</span>
  );
  const starterCard = (starter: (typeof starters)[number], wide = false) => {
    const Icon = starter.icon;
    return (
      <button type="button" className="starter-card hotgpt-starter-card" key={starter.label} style={wide ? { ...cardStyle, gridColumn: "1 / -1" } : cardStyle} onClick={() => { trackFunnelEvent({ name: "starter_example_clicked", metadata: { label: starter.label } }); onStarter(language === "ar" ? starter.prompt : starter.promptEn, starter.mode); }}>
        <span className="starter-icon hotgpt-starter-icon"><Icon size={19} /></span>
        <span className="starter-copy">
          <strong>{starter.label}</strong>
          <small>{language === "ar" ? starter.description : starter.descriptionEn}</small>
        </span>
      </button>
    );
  };
  const premiumCard = (kind: "scan" | "darklive" | "seo") => {
    const data = {
      scan: { Icon: Radar, label: "URL_SCAN", ar: "فحص أمني حقيقي لأي موقع من رابطه — تقرير ثغرات كامل · 20 توكن للتقرير", en: "A real security scan of any website from its URL — a full vulnerability report · 20 tokens per report", action: onScan },
      darklive: { Icon: Radio, label: "DARK_LIVE", ar: "خدمة مستقلة بمحرك خاص — بحث حي في فهارس الدارك ويب بنتائج وروابط حقيقية", en: "A standalone service with its own engine — live dark-web index search with real results and links", action: onDarkLive },
      seo: { Icon: TrendingUp, label: "SEO_AUDIT", ar: "فحص SEO حقيقي لأي موقع من رابطه — تقرير كامل بخطة نمو عملية · 20 توكن للتقرير", en: "A real SEO audit of any website from its URL — a full report with a practical growth plan · 20 tokens per report", action: onSeo },
    }[kind];
    const PIcon = data.Icon;
    return (
      <button type="button" className="starter-card hotgpt-starter-card premium-card" key={data.label} style={cardStyle} onClick={data.action}>
        <span className="starter-icon hotgpt-starter-icon"><PIcon size={19} /></span>
        <span className="starter-copy">
          <strong>{data.label}{premiumBadge} {walletBalance < 20 && <Lock size={13} style={{ verticalAlign: "-2px" }} />}</strong>
          <small>{tr(language, data.ar, data.en)}</small>
        </span>
      </button>
    );
  };
  return (
    <div className="welcome-state hotgpt-welcome">
      {hotLuckyBannerVisible && (
        <div className="hotlucky-slim-banner" dir={language === "ar" ? "rtl" : "ltr"} role="region" aria-label="HotLucky">
                  <button type="button" className="hotlucky-slim-close" onClick={dismissHotLuckyBanner} aria-label={tr(language, "إخفاء العرض لمدة 24 ساعة", "Dismiss for 24 hours")}>×</button>
          <span className="hotlucky-slim-copy">
            <span className="hotlucky-slim-desktop">{tr(language, "🎁 HotLucky — لفة بـ 50 جنيه: اكسب من 25 لـ 100 توكن", "🎁 HotLucky — spin for 50 EGP: win 25–100 tokens")}</span>
            <span className="hotlucky-slim-mobile">{tr(language, "🎁 HotLucky — لفّ واكسب توكنات", "🎁 HotLucky — spin & win tokens")}</span>
          </span>
          <a className="hotlucky-slim-cta" href="/hotlucky">{tr(language, "ادخل لصفحة الجوائز ›", "Prizes ›")}</a>
        </div>
      )}
      <div className="welcome-orbit hotgpt-orbit brand-welcome-orbit" aria-hidden="true">
        <BrandMark compact />
      </div>
      <p className="eyebrow">HOTGPT · AI WORKSPACE</p>
      <h1>Hot<span>GPT</span></h1>
      <div style={{ maxWidth: 580, margin: "16px auto 0", textAlign: "center", fontFamily: "'IBM Plex Sans Arabic', 'Space Grotesk', sans-serif" }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: "clamp(16px, 2.2vw, 20px)", lineHeight: 2, color: "#FFFFFF" }}>{language === "ar" ? <>نحلّ مشاكل <span style={{ color: "#FBBF24" }}>البرمجة</span> ونراجع <span style={{ color: "#FBBF24" }}>أمان موقعك</span> ونقوّيه بنتائج وتوصيات عملية.</> : <>We solve <span style={{ color: "#FBBF24" }}>coding problems</span> and review and harden <span style={{ color: "#FBBF24" }}>your site's security</span> with practical results and recommendations.</>}</p>
        <p style={{ margin: "4px 0 0", fontWeight: 800, fontSize: "clamp(16px, 2.2vw, 20px)", lineHeight: 2, color: "#FFFFFF" }}>{language === "ar" ? <>ابدأ مجانًا بـ<span style={{ color: "#FBBF24" }}>5 توكنات</span> ثم أكمل بباقة البداية: <span style={{ color: "#FBBF24", whiteSpace: "nowrap" }}>100 توكن</span> مقابل <span style={{ color: "#FBBF24" }}>100 جنيه</span>.</> : <>Start free with <span style={{ color: "#FBBF24" }}>5 tokens</span> then continue with the Starter pack: <span style={{ color: "#FBBF24", whiteSpace: "nowrap" }}>100 tokens</span> for <span style={{ color: "#FBBF24" }}>100 EGP</span>.</>}</p>
      </div>
      <div style={{ textAlign: "center", marginTop: 18 }}>
        <a href="/billing" onClick={() => trackFunnelEvent({ name: "starter_cta_click", metadata: { pack: 100 } })} style={{ display: "inline-block", padding: "11px 28px", borderRadius: 999, background: "linear-gradient(135deg, #F6C453 0%, #E8A020 55%, #B97A0F 100%)", color: "#231300", fontWeight: 800, fontSize: 15, textDecoration: "none", boxShadow: "0 10px 28px rgba(232,160,32,.35), inset 0 1px 0 rgba(255,255,255,.45)" }}>{tr(language, "ابدأ بباقة 100 توكن", "Start with the 100-token pack")}</a>
      </div>
      <p style={{ textAlign: "center", fontSize: 12.5, margin: "12px 0 26px", opacity: 0.9 }}>{tr(language, "الباقة تكفي تقريبًا 100 رسالة عادية أو 20 صورة", "The pack covers roughly 100 regular messages or 20 images")}<br />{tr(language, "الدفع بفودافون كاش وإنستاباي بصورة التحويل فقط.", "Pay by Vodafone Cash or InstaPay with just a transfer screenshot.")}</p>
      <div className="starter-grid hotgpt-starter-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", width: "100%", maxWidth: 720 }}>
        {starterCard(starters[0])}
        {premiumCard("scan")}
        {starterCard(starters[1])}
        {premiumCard("darklive")}
        {starterCard(starters[2])}
        {premiumCard("seo")}
        {starterCard(starters[3], true)}
      </div>
      {walletBalance < 20 && (
        <p style={{ textAlign: "center", fontSize: 12.5, marginTop: 10, opacity: 0.9 }}>
          🔒 {tr(language, "الكروت اللي عليها ⭐ بريميوم تُفتح برصيد 20 توكن أو أكثر —", "Cards marked ⭐ Premium unlock at a balance of 20+ tokens —")}{" "}
          <a href="/billing" style={{ color: "#FBBF24", fontWeight: 800 }}>{tr(language, "اشحن رصيدك", "top up")}</a>{" "}
          {tr(language, "أو", "or")}{" "}
          <a href="/hotlucky" style={{ color: "#FBBF24", fontWeight: 800 }}>{tr(language, "باقة HotLucky: بـ 50 جنيه خد من 25 لـ 100 رسالة", "HotLucky pack: 50 EGP gets you 25 to 100 messages")}</a>
        </p>
      )}
    </div>
  );
}

function SettingsPanel({ onBack }: { onBack: () => void }) {
  const { language, toggleLanguage } = useLanguage();
  const auth = useAuth();
  const [theme, setTheme] = useState<"dark" | "blood">(() => {
    if (typeof window === "undefined") return "blood";
    const saved = localStorage.getItem("hotgpt-theme") || localStorage.getItem("theme");
    return saved === "dark" ? "dark" : "blood";
  });
  const [style, setStyle] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("hotgpt-response-style") || "professional" : "professional"
  );
  const [instructions, setInstructions] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("hotgpt-custom-instructions") || "" : ""
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = "dark";
    localStorage.setItem("hotgpt-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!auth.isAuthenticated || auth.loading) return;
    let cancelled = false;
    setSyncing(true);
    void authFetch("/api/preferences", { method: "GET" })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "preferences_unavailable");
        const preferences = payload.preferences;
        if (!preferences || cancelled) return;
        const nextTheme = (localStorage.getItem("hotgpt-theme") === "dark" || localStorage.getItem("hotgpt-theme") === "blood") ? localStorage.getItem("hotgpt-theme")! : "blood";
        const nextStyle = ["professional", "concise", "friendly", "detailed"].includes(preferences.style) ? preferences.style : "professional";
        const nextInstructions = typeof preferences.instructions === "string" ? preferences.instructions.slice(0, 2000) : "";
        localStorage.setItem("hotgpt-theme", nextTheme);
        localStorage.setItem("hotgpt-response-style", nextStyle);
        localStorage.setItem("hotgpt-custom-instructions", nextInstructions);
        document.documentElement.dataset.theme = nextTheme;
        setTheme(nextTheme);
        setStyle(nextStyle);
        setInstructions(nextInstructions);
        if ((preferences.language === "en") !== (localStorage.getItem("hotgpt-language") === "en")) toggleLanguage();
      })
      .catch(() => { if (!cancelled) setSaveError(tr(language, "تعذر مزامنة التفضيلات من الحساب؛ يمكنك المحاولة عند الحفظ.", "Could not sync preferences from your account; try saving again.")); })
      .finally(() => { if (!cancelled) setSyncing(false); });
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, auth.loading, auth.user?.id]);

  async function savePreferences() {
    setSaveError("");
    localStorage.setItem("hotgpt-theme", theme);
    localStorage.setItem("hotgpt-response-style", style);
    localStorage.setItem("hotgpt-custom-instructions", instructions);
    const languagePreference = localStorage.getItem("hotgpt-language") === "en" ? "en" : "ar";
    window.dispatchEvent(new CustomEvent("hotgpt-preferences-changed"));
    if (auth.isAuthenticated) {
      setSyncing(true);
      try {
        const response = await authFetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme, style, instructions, language: languagePreference }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || "preferences_unavailable");
      } catch {
        setSaveError(tr(language, "تعذر حفظ التفضيلات في الحساب. تحقق من اتصال الخادم ثم أعد المحاولة.", "Could not save preferences to your account. Check the server connection and retry."));
        setSyncing(false);
        return;
      }
      setSyncing(false);
    } else {
      setSaveError(tr(language, "حُفظت التفضيلات على هذا الجهاز فقط. سجّل الدخول لمزامنتها بين أجهزتك.", "Preferences saved on this device only. Sign in to sync them across devices."));
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div className="settings-panel content-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{tr(language, "الإعدادات", "Settings")}</p>
          <h2>{tr(language, "مساحتك، بطريقتك", "Your space, your way")}</h2>
          <p>{tr(language, "خصص المظهر وطريقة رد النموذج لتناسب أسلوبك.", "Personalize the appearance and how the model responds.")}</p>
        </div>
        <button className="icon-button" onClick={onBack} aria-label={tr(language, "العودة للمحادثة", "Back to chat")}><X size={18} /></button>
      </div>

      <div className="settings-grid">
        <section className="settings-card appearance-settings-card">
          <div className="settings-card-icon purple"><Moon size={18} /></div>
          <div className="appearance-settings-copy">
            <h3>{tr(language, "المظهر", "Appearance")}</h3>
            <p>{tr(language, "اختر أحد الوضعين الداكنين.", "Choose one of the two dark themes.")}</p>
            <div className="appearance-theme-options" role="group" aria-label={tr(language, "اختيار المظهر", "Choose appearance")}>
              <button type="button" className={theme === "blood" ? "appearance-theme-option selected" : "appearance-theme-option"} aria-pressed={theme === "blood"} onClick={() => { localStorage.setItem("hotgpt-theme", "blood"); localStorage.setItem("theme", "blood"); document.documentElement.dataset.theme = "blood"; setTheme("blood"); }} title="Blood Mode">
                <strong>Blood Mode</strong><span>{tr(language, "أحمر داكن", "Deep red")}</span>
              </button>
              <button type="button" className={theme === "dark" ? "appearance-theme-option selected" : "appearance-theme-option"} aria-pressed={theme === "dark"} onClick={() => { localStorage.setItem("hotgpt-theme", "dark"); localStorage.setItem("theme", "dark"); document.documentElement.dataset.theme = "dark"; setTheme("dark"); }} title="Dark">
                <strong>Dark</strong><span>{tr(language, "أسود", "Black")}</span>
              </button>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-icon cyan"><Sparkles size={18} /></div>
          <div>
            <h3>{tr(language, "اللغة والاتجاه", "Language & direction")}</h3>
            <p>{tr(language, "غيّر لغة الواجهة واتجاهها بالكامل.", "Change the interface language and direction.")}</p>
            <span className="setting-status">{language === "ar" ? "العربية · RTL" : "English · LTR"}</span>
          </div>
          <Button variant="outline" onClick={toggleLanguage}>{language === "ar" ? "English" : "العربية"}</Button>
        </section>

        <section className="settings-card settings-card-column">
          <div className="settings-card-icon lime"><SlidersHorizontal size={18} /></div>
          <div className="settings-wide-content">
            <h3>{tr(language, "أسلوب رد النموذج", "Response style")}</h3>
            <p>{tr(language, "اختر النبرة المفضلة للردود الجديدة.", "Choose the preferred tone for new responses.")}</p>
            <div className="settings-choice-row">
              {[
                ["professional", tr(language, "احترافي", "Professional")],
                ["concise", tr(language, "مختصر ومباشر", "Concise")],
                ["friendly", tr(language, "ودود", "Friendly")],
                ["detailed", tr(language, "مفصل", "Detailed")],
              ].map(([value, label]) => <button key={value} type="button" className={style === value ? "settings-choice active" : "settings-choice"} onClick={() => setStyle(value)}>{label}</button>)}
            </div>
          </div>
        </section>

        <section className="settings-card settings-card-column">
          <div className="settings-card-icon cyan"><FileText size={18} /></div>
          <div className="settings-wide-content">
            <h3>{tr(language, "تعليماتك للنموذج", "Custom instructions")}</h3>
            <p>{tr(language, "اكتب ما تريد من النموذج مراعاته دائمًا، مثل لغتك المفضلة أو مستوى التفاصيل أو مجال عملك.", "Tell the model what to keep in mind, such as your preferred language, detail level, or area of work.")}</p>
            <textarea className="settings-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={2000} placeholder={tr(language, "مثال: أجب بالعربية، وابدأ بالخلاصة، ثم اذكر خطوات عملية مع أمثلة.", "Example: Start with a concise summary, then give practical steps and examples.")} />
            <small className="settings-counter">{instructions.length}/2000</small>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-icon purple"><Check size={18} /></div>
          <div>
            <h3>{tr(language, "تجربة الكتابة", "Writing experience")}</h3>
            <p>{tr(language, "Enter للإرسال · Shift + Enter لسطر جديد", "Enter to send · Shift + Enter for a new line")}</p>
          </div>
          <span className="setting-status">{tr(language, "مفعّلة", "Enabled")}</span>
        </section>
      </div>
      <div className="settings-actions">
        <Button onClick={savePreferences}>{saved ? tr(language, "تم الحفظ", "Saved") : tr(language, "حفظ التفضيلات", "Save preferences")}</Button>
      </div>
      <div className="settings-quote"><Sparkles size={17} /><span>{syncing ? tr(language, "جارٍ مزامنة تفضيلات الحساب...", "Syncing account preferences...") : auth.isAuthenticated ? tr(language, "تُحفظ تفضيلاتك في حسابك وتُطبّق على الردود الجديدة على أجهزتك.", "Your preferences are saved to your account and applied to new responses across devices.") : tr(language, "تُحفظ محليًا الآن؛ سجّل الدخول لحفظها في حسابك ومزامنتها بين الأجهزة.", "Saved locally for now; sign in to save them to your account and sync across devices.")}</span></div>
      {saveError && <p className="settings-error" role="status">{saveError}</p>}
    </div>
  );
}

function GuidePanel({ onBack }: { onBack: () => void }) {
  const { language } = useLanguage();
  return (
    <div className="content-panel guide-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{tr(language, "الملفات", "Files")}</p>
          <h2>{tr(language, "كل ما تحتاجه، في مكان واحد", "Everything you need, in one place")}</h2>
          <p>{tr(language, "احتفظ بالمراجع والمستندات التي تعمل عليها بجوار محادثاتك.", "Keep your references and documents alongside your conversations.")}</p>
        </div>
        <button
          className="icon-button"
          onClick={onBack}
          aria-label="العودة للمحادثة"
        >
          <X size={18} />
        </button>
      </div>
      <div className="upload-empty">
        <div className="upload-icon">
          <Upload size={23} />
        </div>
        <h3>{tr(language, "أضف أول ملف لك", "Add your first file")}</h3>
        <p>{tr(language, "اسحب مستنداتك إلى هنا أو اخترها من جهازك.", "Drop documents here or choose them from your device.")}</p>
        <Button variant="outline">
          <Paperclip size={15} /> {tr(language, "اختيار ملف", "Choose file")}
        </Button>
      </div>
    </div>
  );
}

export default function Home() {
  const auth = useAuth();
  const [location, setLocation] = useLocation();
  const routeConversationId = (() => { const m = /^\/chat\/([0-9a-f-]{36})\/?$/i.exec(location); return m ? m[1] : null; })();
  const [language, setLanguage] = useState<Language>(() => typeof window !== "undefined" && localStorage.getItem("hotgpt-language") === "en" ? "en" : "ar");
  const toggleLanguage = () => setLanguage(current => current === "ar" ? "en" : "ar");

  useEffect(() => {
    if (auth.loading || !auth.isAuthenticated) return;
    let cancelled = false;
    void authFetch("/api/preferences", { method: "GET" })
      .then(async response => {
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({}));
        const preferences = payload.preferences;
        if (!preferences || cancelled) return;
        // Keep the locally selected theme authoritative; account sync must not reset it.
        const style = ["professional", "concise", "friendly", "detailed"].includes(preferences.style) ? preferences.style : "professional";
        const instructions = typeof preferences.instructions === "string" ? preferences.instructions.slice(0, 2000) : "";
        const nextLanguage = preferences.language === "en" ? "en" : "ar";
        localStorage.setItem("hotgpt-response-style", style);
        localStorage.setItem("hotgpt-custom-instructions", instructions);
        localStorage.setItem("hotgpt-language", nextLanguage);
        if (nextLanguage !== language) setLanguage(nextLanguage);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [auth.loading, auth.isAuthenticated, auth.user?.id]);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") || localStorage.getItem("hotgpt-theme");
    const savedTheme = storedTheme === "dark" ? "dark" : "blood";
    document.documentElement.dataset.theme = savedTheme;
    document.documentElement.style.colorScheme = "dark";
    localStorage.setItem("theme", savedTheme);
    localStorage.setItem("hotgpt-theme", savedTheme);
    localStorage.setItem("hotgpt-language", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    const brandAsset = language === "ar" ? "/brand-ar.svg" : "/brand-en.svg";
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.type = "image/svg+xml";
    favicon.href = brandAsset;
    const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleIcon) appleIcon.href = brandAsset;
    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (ogImage) ogImage.content = new URL(brandAsset, window.location.origin).href;
    const twitterImage = document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]');
    if (twitterImage) twitterImage.content = new URL(brandAsset, window.location.origin).href;
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = language === "ar" ? "HotGPT — للمطورين والباحثين" : "HotGPT — For Developers & Researchers";
    const pageTitle = language === "ar" ? "HotGPT — للمطورين والباحثين" : "HotGPT — For Developers & Researchers";
    document.title = pageTitle;
  }, [language]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomeGiftJustGranted, setWelcomeGiftJustGranted] = useState(false);
  const [showAuthGateModal, setShowAuthGateModal] = useState(false);

  useEffect(() => {
    if (auth.loading) return;
    if (auth.isAuthenticated) {
      setShowAuthGateModal(false);
      try {
        const pending = sessionStorage.getItem("hotgpt-welcome-pending") === "1";
        const alreadyShown = sessionStorage.getItem("hotgpt-welcome-shown") === "1";
        if (pending && !alreadyShown) {
          sessionStorage.setItem("hotgpt-welcome-shown", "1");
          setShowWelcomeModal(true);
        }
        sessionStorage.removeItem("hotgpt-welcome-pending");
      } catch {}
      return;
    }
    // Visitors land on the homepage directly — no registration popup on open.
    // The auth gate modal opens only when a visitor tries to use a tool
    // (see the workspace gate effect below).
    setShowWelcomeModal(false);
    setShowAuthGateModal(false);
  }, [auth.loading, auth.isAuthenticated, auth.user?.id]);

  // Gate interactive workspace features for visitors. Public auth links remain accessible.
  useEffect(() => {
    if (auth.loading || auth.isAuthenticated) return;
    const root = document.querySelector(".app-shell");
    if (!root) return;
    const protectedSelector = [
      ".new-chat-button",
      ".nav-item",
      ".conversation-item",
      ".starter-card",
      ".composer textarea",
      ".composer-icon",
      ".send-button",
      ".composer-mode",
      ".extended-toggle",
      ".topbar-home-brand",
      ".profile-row",
      ".upload-empty button",
    ].join(",");
    const gateClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // Public pages stay open to visitors (sidebar links, packs CTA, rewards):
      // only workspace tools and account actions are gated.
      const anchor = target.closest('a[href^="/"]');
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        const publicPaths = ["/billing", "/models", "/rewards", "/hotlucky", "/faq", "/terms", "/privacy", "/refund", "/lucky-terms"];
        if (publicPaths.some(path => href === path || href.startsWith(path + "?") || href.startsWith(path + "#"))) return;
      }
      const protectedControl = target.closest(protectedSelector);
      if (!protectedControl) return;
      event.preventDefault();
      event.stopPropagation();
      if ("stopImmediatePropagation" in event) event.stopImmediatePropagation();
      setShowWelcomeModal(false);
      setShowAuthGateModal(true);
    };
    root.addEventListener("click", gateClick, true);
    root.addEventListener("focusin", gateClick, true);
    return () => {
      root.removeEventListener("click", gateClick, true);
      root.removeEventListener("focusin", gateClick, true);
    };
  }, [auth.loading, auth.isAuthenticated]);
  const [activeView, setActiveView] = useState("chat");
  const [activeConversation, setActiveConversation] = useState<string | null>(
    null
  );
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<{ totalTokens: number; count: number } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [extended, setExtended] = useState(false);
  const [writingAssist, setWritingAssist] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [darkWebEnabled, setDarkWebEnabled] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  // Premium services (2026-10-27): URL scan mode (the composer draft is
  // the URL; the send path branches like image mode) and the live
  // dark-web search add-on toggle for Dark mode.
  const [scanMode, setScanMode] = useState(false);
  const [seoMode, setSeoMode] = useState(false);
  const [darkLiveMode, setDarkLiveMode] = useState(false);
  const [leadsMode, setLeadsMode] = useState(false);
  // One image icon, two kinds (owner decision, 2026-10-29): the icon
  // opens a small menu — normal image or CGI image. The menu carries
  // names only; image prices live on the /models page.
  const [imageKind, setImageKind] = useState<"normal" | "cgi">("normal");
  const [imageMenuPos, setImageMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const sessionImagesRef = useRef<Map<string, string>>(new Map());
  const sessionLeadsRef = useRef<Map<string, LeadBusiness[][]>>(new Map());
  const sessionLeadSeenRef = useRef<Map<string, string[]>>(new Map());

  // Generated images live only in this session (by design), and any history
  // reload replaces the message objects and drops their imageUrl. Instead of
  // patching each reload path, re-attach session images after every messages
  // change, whichever code path replaced the list.
  useEffect(() => {
    if (sessionImagesRef.current.size === 0 && sessionLeadsRef.current.size === 0) return;
    setMessages(current => {
      let changed = false;
      const batchCursor = new Map<string, number>();
      const offsetByQuery = new Map<string, number>();
      const next = current.map(m => {
        let out = m;
        if (!out.imageUrl && sessionImagesRef.current.size > 0) {
          const match = /«([^»]+)»/.exec(out.content);
          const url = match ? sessionImagesRef.current.get(match[1]) : undefined;
          if (url) { out = { ...out, imageUrl: url }; changed = true; }
        }
        if (out.role === "assistant") {
          const header = /استخراج العملاء — ([^*\n]+)/.exec(out.content);
          if (header) {
            const q = header[1].trim();
            if (!out.leadsData && sessionLeadsRef.current.size > 0) {
              const batches = sessionLeadsRef.current.get(q);
              const cursor = batchCursor.get(q) ?? 0;
              const batch = batches ? batches[cursor] : undefined;
              if (batch && batch.length > 0) {
                out = { ...out, leadsData: batch, leadsQuery: q, leadsOffset: offsetByQuery.get(q) ?? 0 };
                changed = true;
              }
            }
            if (out.leadsData) {
              batchCursor.set(q, (batchCursor.get(q) ?? 0) + 1);
              offsetByQuery.set(q, (offsetByQuery.get(q) ?? 0) + out.leadsData.length);
              if (!out.leadsQuery) { out = { ...out, leadsQuery: q }; changed = true; }
            }
          }
        }
        return out;
      });
      return changed ? next : current;
    });
  }, [messages]);
  const [selectedModel, setSelectedModel] = useState<"dadgpt-default" | "dadgpt-beast">("dadgpt-default");
  const [walletBalance, setWalletBalance] = useState(() => {
    try { return typeof window !== "undefined" ? Math.max(0, Number(localStorage.getItem("hotgpt-token-balance")) || 0) : 0; }
    catch { return 0; }
  });
  const [freeAnswersRemaining, setFreeAnswersRemaining] = useState(2);
  const [showFreeUsagePopup, setShowFreeUsagePopup] = useState(false);
  const [freePopupSeen, setFreePopupSeen] = useState(() => { try { return sessionStorage.getItem("hotgpt-free-usage-popup-seen") === "1"; } catch { return false; } });
  const [hotLuckyPrize, setHotLuckyPrize] = useState<{ label: string; code?: string; date?: string } | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const promptedPrizeCode = useRef<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  // Staged progress for the premium URL reports (scan / SEO): the server
  // builds the whole report before replying, so instead of a silent
  // «يجهز الرد» the waiting bubble walks through the real phases.
  const [reportWait, setReportWait] = useState<"scan" | "seo" | "leads" | null>(null);
  const [reportWaitSecs, setReportWaitSecs] = useState(0);
  useEffect(() => {
    if (!reportWait) { setReportWaitSecs(0); return; }
    const timer = setInterval(() => setReportWaitSecs(secs => secs + 1), 1000);
    return () => clearInterval(timer);
  }, [reportWait]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (auth.loading || !auth.isAuthenticated) { setHotLuckyPrize(null); return; }
    let cancelled = false;
    const loadPrize = async () => {
      try {
        const [prizeResponse, walletResponse] = await Promise.all([
          authFetch("/api/lucky?action=status", { cache: "no-store" }),
          authFetch("/api/billing?action=me", { cache: "no-store" }),
        ]);
        if (walletResponse.ok) {
          const wallet = await walletResponse.json();
          if (!cancelled) {
            const balance = Math.max(0, Number(wallet.tokenBalance) || 0);
            if ((wallet as any).welcomeGiftGranted) { setWelcomeGiftJustGranted(true); setShowWelcomeModal(true); }
            const freeRemaining = Math.max(0, Number(wallet.freeAnswersRemaining) || 0);
            setWalletBalance(balance);
            setFreeAnswersRemaining(freeRemaining);
            try { localStorage.setItem("hotgpt-token-balance", String(balance)); } catch {}
          }
        }
        if (!prizeResponse.ok) return;
        const payload = await prizeResponse.json();
        const prize = payload.prize;
        if (!cancelled && prize?.label) {
          const timestamp = prize.date ? new Date(prize.date).getTime() : 0;
          setHotLuckyPrize(!timestamp || Date.now() - timestamp <= 7 * 24 * 60 * 60 * 1000 ? { label: String(prize.label), code: prize.code ? String(prize.code) : undefined, date: prize.date } : null);
        } else if (!cancelled) setHotLuckyPrize(null);
      } catch {}
    };
    void loadPrize();
    const interval = window.setInterval(() => void loadPrize(), 60_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [auth.loading, auth.isAuthenticated, auth.user?.id]);

  useEffect(() => {
    if (auth.loading || !auth.isAuthenticated || !hotLuckyPrize?.code) return;
    if (promptedPrizeCode.current === hotLuckyPrize.code) return;
    promptedPrizeCode.current = hotLuckyPrize.code;
    try {
      if (localStorage.getItem("hotlucky-win-acknowledged:" + hotLuckyPrize.code) === "1") return;
    } catch {}
    setShowWinModal(true);
  }, [auth.loading, auth.isAuthenticated, auth.user?.id, hotLuckyPrize?.code]);

  // Retired 2026-10-29: the free-usage popup no longer fires at zero balance —
  // the persistent low-balance banner (100-token pack offer) covers that moment.

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) { setWalletBalance(0); return; }
    let cancelled = false;
    void authFetch("/api/billing?action=me", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const wallet = await response.json();
      if (!cancelled) {
        const balance = Math.max(0, Number(wallet.tokenBalance) || 0);
        if ((wallet as any).welcomeGiftGranted) { setWelcomeGiftJustGranted(true); setShowWelcomeModal(true); }
        setWalletBalance(balance);
        setFreeAnswersRemaining(Math.max(0, Number(wallet.freeAnswersRemaining) || 0));
        try { localStorage.setItem("hotgpt-token-balance", String(balance)); } catch {}
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [auth.loading, auth.isAuthenticated, auth.user?.id]);

  // Purchase-approval notice: when an admin approves a top-up request, the
  // member gets one gold in-app notice per approval. Approvals already shown
  // are marked in localStorage (same acknowledge pattern as the HotLucky win
  // modal), so each approval celebrates exactly once.
  useEffect(() => {
    if (auth.loading || !auth.isAuthenticated) return;
    let cancelled = false;
    const checkApprovals = async () => {
      try {
        const response = await authFetch("/api/billing?action=requests", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const payload = await response.json().catch(() => ({}));
        const requests = Array.isArray(payload.requests) ? payload.requests : [];
        const unseen = requests.filter((r: any) => {
          if (!r || r.status !== "approved" || !r.id) return false;
          try { return localStorage.getItem("hotgpt.approval-acknowledged:" + r.id) !== "1"; } catch { return false; }
        });
        if (!unseen.length || cancelled) return;
        for (const r of unseen) { try { localStorage.setItem("hotgpt.approval-acknowledged:" + r.id, "1"); } catch {} }
        const totalTokens = unseen.reduce((sum: number, r: any) => sum + (Number(r.packageTokens) || 0), 0);
        if (!cancelled && totalTokens > 0) setApprovalNotice({ totalTokens, count: unseen.length });
      } catch {}
    };
    void checkApprovals();
    const interval = window.setInterval(() => void checkApprovals(), 60_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [auth.loading, auth.isAuthenticated, auth.user?.id]);

  useEffect(() => {
    if (!approvalNotice) return;
    const timer = window.setTimeout(() => setApprovalNotice(null), 15_000);
    return () => window.clearTimeout(timer);
  }, [approvalNotice]);

  useEffect(() => {
    try { localStorage.setItem("hotgpt-token-balance", String(Math.max(0, walletBalance))); } catch {}
  }, [walletBalance]);

  const lastAuthUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (auth.loading) return;
    let cancelled = false;
    // Only a real user change (sign-in, sign-out, account switch) may clear
    // the visible conversation. Auth re-validations (loading toggles, token
    // refreshes) used to wipe the message list mid-session, which made
    // completed answers "disappear" from the live view until a page refresh.
    const uid = auth.user?.id ?? null;
    const userChanged = lastAuthUserIdRef.current !== uid;
    lastAuthUserIdRef.current = uid;
    if (userChanged) {
      setActiveConversation(null);
      setMessages([]);
    }
    if (!auth.isAuthenticated) {
      setConversations([]);
      try { localStorage.removeItem("hotgpt.chat.v1"); } catch {}
      return;
    }
    void authFetch("/api/conversations").then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "conversations_unavailable");
      if (cancelled) return;
      setConversations((payload.conversations ?? []).map((item: any) => ({
        id: String(item.id),
        title: String(item.title || "محادثة جديدة"),
        preview: String(item.preview || ""),
        date: item.date ? new Date(item.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }) : "",
      })));
    }).catch(error => {
      if (cancelled) return;
      const code = error instanceof Error ? error.message : "";
      const errors: Record<string, string> = {
        login_required: "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.",
        auth_unavailable: "تعذر التحقق من جلسة Supabase. تحقق من إعدادات الخادم.",
        conversations_unavailable: "الخادم لم يتمكن من قراءة المحادثات من قاعدة البيانات. راجع إعداد SUPABASE_SERVICE_ROLE_KEY وسجلات Supabase.",
      };
      setRequestError(errors[code] || "تعذر تحميل محادثاتك المحفوظة.");
    });
    return () => { cancelled = true; };
  }, [auth.loading, auth.isAuthenticated, auth.user?.id]);

  useEffect(() => {
    let id = location.startsWith("/chat/") ? location.slice(6) : "";
    if (id.endsWith("/")) id = id.slice(0, -1);
    // The optimistic in-flight transcript is authoritative while sending. Do not
    // overwrite it with a history fetch triggered by the initial /chat/:id route.
    if (id.length !== 36 || auth.loading || !auth.isAuthenticated || isSending) return;
    let cancelled = false;
    setActiveConversation(id);
    setActiveView("chat");
    void authFetch(`/api/conversations?id=${encodeURIComponent(id)}`).then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok || String(payload.conversation?.id) !== id) {
        setActiveConversation(null);
        setMessages([]);
        setRequestError(tr(language, "المحادثة غير موجودة.", "Conversation not found."));
        return;
      }
      setMessages((payload.messages ?? []).map((item: any) => ({
        id: String(item.id), role: item.role,
        content: String(item.content),
        timestamp: item.createdAt ? new Date(item.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "",
        isComplete: item.is_complete !== false, partCount: Number(item.part_count || 1), lastFinishReason: item.last_finish_reason ?? null,
        continuationAvailable: item.role === "assistant" && item.is_complete === false,
        imageUrl: (() => { const match = /«([^»]+)»/.exec(String(item.content)); return match ? sessionImagesRef.current.get(match[1]) : undefined; })(),
      })));
      setRequestError(null);
    }).catch(() => {
      if (!cancelled) setRequestError(tr(language, "تعذر فتح المحادثة المحفوظة.", "Could not load this conversation."));
    });
    return () => { cancelled = true; };
  }, [location, auth.loading, auth.isAuthenticated, auth.user?.id, isSending]);

  const startNew = () => {
    setLocation("/");
    setActiveConversation(null);
    setMessages([]);
    setDraft("");
    setActiveView("chat");
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };
  const loadConversationMessages = async (id: string): Promise<boolean> => {
    const response = await authFetch(`/api/conversations?id=${encodeURIComponent(id)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || String(payload.conversation?.id) !== id) return false;
    setMessages((payload.messages ?? []).map((item: any) => ({
      id: String(item.id), role: item.role,
      content: String(item.content),
      timestamp: item.createdAt ? new Date(item.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "",
      isComplete: item.is_complete !== false, partCount: Number(item.part_count || 1), lastFinishReason: item.last_finish_reason ?? null,
      continuationAvailable: item.role === "assistant" && item.is_complete === false,
    })));
    return true;
  };

  const sendMessage = async (value = draft) => {
    const trimmed = value.trim() || (attachment ? `لخص الملف المرفق "${attachment.name}" واذكر أهم النقاط.` : "");
    if (!trimmed || isSending) return;
    if (auth.isAuthenticated && freeAnswersRemaining <= 0 && walletBalance <= 0) {
      setRequestError(tr(language, "جرّب HotGPT بـ100 توكن مقابل 100 جنيه — ابدأ بتحليل كودك أو فحص موقعك، والدفع متاح عبر Vodafone Cash وInstaPay.", "Try HotGPT with 100 tokens for 100 EGP — start by analyzing your code or scanning your site, and pay via Vodafone Cash or InstaPay."));
      return;
    }
    if (webSearchEnabled && attachment) {
      setRequestError(tr(language, "افصل الملف المرفق لإجراء بحث مباشر على الإنترنت.", "Remove the attachment to run a direct web search."));
      return;
    }
    if (!auth.isAuthenticated) {
      setRequestError("سجّل الدخول أولًا حتى تُحفظ محادثاتك ويُربط الرصيد بحسابك.");
      window.location.assign("/auth");
      return;
    }

    setActiveView("chat");
    setDraft("");
    setRequestError(null);
    setIsSending(true);
    setIsSearchingWeb(webSearchEnabled);
    setHasStartedStreaming(false);
    setIsThinking(false);
    let conversationId = activeConversation;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: formatTime(),
    };

    try {
      if (!conversationId) {
        const createResponse = await authFetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed.slice(0, 80) }),
        });
        const created = await createResponse.json().catch(() => ({}));
        if (!createResponse.ok || !created.conversation?.id) {
          const errors: Record<string, string> = {
            login_required: "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.",
            auth_unavailable: "تعذر التحقق من جلسة الدخول على الخادم.",
            conversations_unavailable: "تعذر حفظ المحادثة في قاعدة البيانات. تحقق من إعداد SUPABASE_SERVICE_ROLE_KEY وصلاحيات قاعدة البيانات.",
          };
          throw new Error(errors[String(created.error || "")] || `تعذر إنشاء المحادثة (HTTP ${createResponse.status}). رمز الخطأ: ${String(created.error || "unknown")}.`);
        }
        conversationId = String(created.conversation.id);
        setActiveConversation(conversationId);
        setLocation(`/chat/${conversationId}`);
      }

      const requestMessages = [...messages, userMessage].slice(-40).map((message, index, all) => ({
        role: message.role,
        content: writingAssist && index === all.length - 1 && message.role === "user"
          ? (localStorage.getItem("hotgpt-language") === "en"
              ? `Improve and execute the user's request below. First infer the intended outcome, then silently clarify the task into specific actionable requirements. Preserve the user's intent and constraints; do not invent requirements or ask for information that is not necessary. Give the requested result directly, with an appropriate structure and level of detail. User's original request:\n${message.content}`
              : `حسّن فهمك ونفّذ طلب المستخدم التالي: استنتج النتيجة المقصودة، ونظّم المطلوب إلى خطوات ومتطلبات واضحة داخليًا، مع الحفاظ على المعنى والقيود وعدم اختراع متطلبات جديدة أو طرح أسئلة غير ضرورية. قدّم النتيجة المطلوبة مباشرة وبالتنسيق ومستوى التفصيل المناسب. نص المستخدم الأصلي:\n${message.content}`)
          : message.content,
      }));
      setMessages(current => [...current, userMessage]);

      if (imageMode) {
        // Image generation (user feature, 2026-10-25): the server charges a
        // flat 5 tokens and returns the image for this session only; images
        // are not persisted in the database yet.
        try {
          const imageResponse = await authFetch("/api/model/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageMode: true, prompt: trimmed, conversationId, imageKind }) });
          const imagePayload = await imageResponse.json().catch(() => ({}));
          if (!imageResponse.ok || !imagePayload.imageDataUrl) {
            const imageErrors: Record<string, string> = {
              insufficient_credits: imageKind === "cgi" ? tr(language, "رصيدك غير كافٍ لتوليد صورة CGI. اشحن من صفحة الباقات — الأسعار في صفحة النماذج.", "Your balance is not enough for a CGI image. Top up from Plans — prices are on the Models page.") : tr(language, "توليد الصورة يحتاج إلى 5 توكينات. رصيدك غير كافٍ؛ اختر باقة مناسبة.", "Image generation costs 5 tokens. Your balance is not enough."),
              image_generation_failed: tr(language, "تعذر توليد الصورة الآن. لم يُخصم الرصيد؛ حاول مرة أخرى.", "Image generation failed. No charge was made; please try again."),
              image_not_configured: tr(language, "توليد الصور غير مُعدّ على الخادم بعد.", "Image generation is not configured on the server yet."),
              login_required: tr(language, "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.", "Your session expired. Please sign in again."),
            };
            throw new Error(imageErrors[String(imagePayload.error || "")] || tr(language, "تعذر توليد الصورة الآن.", "Image generation failed."));
          }
          sessionImagesRef.current.set(trimmed.slice(0, 200), String(imagePayload.imageDataUrl));
          if (typeof imagePayload.tokenBalance === "number") setWalletBalance(imagePayload.tokenBalance);
          const imageNote = imageKind === "cgi" ? tr(language, `🎨 صورة CGI مولّدة بناءً على وصفك: «${trimmed.slice(0, 200)}»`, `🎨 CGI image generated from your prompt: "${trimmed.slice(0, 200)}"`) : tr(language, `🎨 صورة مولّدة بناءً على وصفك: «${trimmed.slice(0, 200)}»`, `🎨 Image generated from your prompt: "${trimmed.slice(0, 200)}"`);
          setMessages(current => [...current, { id: crypto.randomUUID(), role: "assistant", content: imageNote, timestamp: formatTime(), imageUrl: String(imagePayload.imageDataUrl) }]);
        } catch (imageError) {
          setRequestError(imageError instanceof Error ? imageError.message : tr(language, "تعذر توليد الصورة الآن.", "Image generation failed."));
        } finally {
          setIsSending(false);
          setIsSearchingWeb(false);
          setImageMode(false);
        }
        return;
      }

      if (scanMode) {
        // URL scan (premium, 2026-10-27): the draft is the target URL.
        // The server charges a flat 20 tokens, collects real evidence,
        // and returns the finished report; failures refund in full.
        setReportWait("scan");
        try {
          const scanResponse = await authFetch("/api/model/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scanMode: true, url: trimmed, conversationId }) });
          const scanPayload = await scanResponse.json().catch(() => ({}));
          if (!scanResponse.ok || !scanPayload.content) {
            const scanErrors: Record<string, string> = {
              insufficient_credits: tr(language, "فحص الروابط يحتاج إلى 20 توكن. رصيدك غير كافٍ؛ اشحن أو خد باقة HotLucky.", "URL scanning costs 20 tokens. Your balance is not enough; top up or grab the HotLucky pack."),
              invalid_url: tr(language, "الرابط غير صالح. اكتب رابطًا كاملًا مثل https://example.com — لم يُخصم الرصيد.", "That URL looks invalid. Enter a full URL like https://example.com — nothing was charged."),
              scan_target_not_public: tr(language, "لا يمكن فحص روابط داخلية أو محلية. جرّب موقعًا عامًا — لم يُخصم الرصيد.", "Internal or local addresses cannot be scanned. Try a public website — nothing was charged."),
              scan_target_unreachable: tr(language, "تعذر الوصول إلى هذا الموقع الآن. تأكد من الرابط وحاول مرة أخرى — لم يُخصم الرصيد.", "This website could not be reached. Check the URL and try again — nothing was charged."),
              scan_failed: tr(language, "تعذر إتمام الفحص الآن. تم استرداد الرصيد بالكامل؛ حاول مرة أخرى.", "The scan could not be completed. You were fully refunded; please try again."),
              scan_not_configured: tr(language, "خدمة الفحص غير مُعدّة على الخادم بعد.", "The scan service is not configured on the server yet."),
              login_required: tr(language, "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.", "Your session expired. Please sign in again."),
            };
            throw new Error(scanErrors[String(scanPayload.error || "")] || tr(language, "تعذر إتمام الفحص الآن. لم يُخصم الرصيد.", "The scan failed. Nothing was charged."));
          }
          if (typeof scanPayload.tokenBalance === "number") setWalletBalance(scanPayload.tokenBalance);
          setMessages(current => [...current, { id: crypto.randomUUID(), role: "assistant", content: String(scanPayload.content), timestamp: formatTime() }]);
        } catch (scanError) {
          setRequestError(scanError instanceof Error ? scanError.message : tr(language, "تعذر إتمام الفحص الآن.", "The scan failed."));
        } finally {
          setReportWait(null);
          setIsSending(false);
          setIsSearchingWeb(false);
          setScanMode(false);
        }
        return;
      }

      if (seoMode) {
        // SEO audit (premium, 2026-10-27): the scan's twin — the draft
        // is the target URL, the server charges a flat 20 tokens,
        // collects real on-page/technical evidence, and returns the
        // finished report with a growth plan; failures refund in full.
        setReportWait("seo");
        try {
          const seoResponse = await authFetch("/api/model/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seoMode: true, url: trimmed, conversationId }) });
          const seoPayload = await seoResponse.json().catch(() => ({}));
          if (!seoResponse.ok || !seoPayload.content) {
            const seoErrors: Record<string, string> = {
              invalid_seo_request: tr(language, "أدخل رابط موقع صحيحًا وتأكد من وجود محادثة صالحة، ثم أعد المحاولة.", "Enter a valid website URL and make sure the conversation is valid, then try again."),
              auth_unavailable: tr(language, "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.", "Your session expired. Please sign in again."),
              supabase_server_not_configured: tr(language, "خدمة فحص SEO غير مُعدّة على الخادم بعد.", "The SEO audit service is not configured on the server yet."),
              insufficient_credits: tr(language, "فحص SEO يحتاج إلى 20 توكن. رصيدك غير كافٍ؛ اشحن أو خد باقة HotLucky.", "SEO auditing costs 20 tokens. Your balance is not enough; top up or grab the HotLucky pack."),
              invalid_url: tr(language, "الرابط غير صالح. اكتب رابطًا كاملًا مثل https://example.com — لم يُخصم الرصيد.", "That URL looks invalid. Enter a full URL like https://example.com — nothing was charged."),
              seo_target_not_public: tr(language, "لا يمكن فحص روابط داخلية أو محلية. جرّب موقعًا عامًا — لم يُخصم الرصيد.", "Internal or local addresses cannot be audited. Try a public website — nothing was charged."),
              seo_target_unreachable: tr(language, "تعذر الوصول إلى هذا الموقع الآن. تأكد من الرابط وحاول مرة أخرى — لم يُخصم الرصيد.", "This website could not be reached. Check the URL and try again — nothing was charged."),
              seo_failed: tr(language, "فشل جلب البيانات لطول التقرير، أعد طلبك مرة أخرى ولن يخصم من رصيدك.", "The report was too long to complete. Please retry; your tokens will not be charged."),
              seo_report_length_failed: tr(language, "فشل جلب البيانات لطول التقرير، أعد طلبك مرة أخرى ولن يخصم من رصيدك.", "The report was too long to complete. Please retry; your tokens will not be charged."),
              seo_not_configured: tr(language, "خدمة فحص SEO غير مُعدّة على الخادم بعد.", "The SEO audit service is not configured on the server yet."),
              login_required: tr(language, "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.", "Your session expired. Please sign in again."),
            };
            throw new Error(seoErrors[String(seoPayload.error || "")] || tr(language, "تعذر إتمام فحص SEO الآن. لم يُخصم الرصيد.", "The SEO audit failed. Nothing was charged."));
          }
          if (typeof seoPayload.tokenBalance === "number") setWalletBalance(seoPayload.tokenBalance);
          setMessages(current => [...current, { id: crypto.randomUUID(), role: "assistant", content: String(seoPayload.content), timestamp: formatTime() }]);
        } catch (seoError) {
          setRequestError(seoError instanceof Error ? seoError.message : tr(language, "تعذر إتمام فحص SEO الآن.", "The SEO audit failed."));
        } finally {
          setReportWait(null);
          setIsSending(false);
          setIsSearchingWeb(false);
          setSeoMode(false);
        }
        return;
      }
      if (leadsMode) {
        // Lead extraction (premium, 2026-10-29): the draft is the
        // business type + area. The server charges a flat 20 tokens,
        // runs the Google Maps extraction, and returns up to 30
        // businesses; failures refund in full.
        setReportWait("leads");
        try {
          const leadsResponse = await authFetch("/api/model/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadsMode: true, query: trimmed, conversationId }) });
          const leadsPayload = await leadsResponse.json().catch(() => ({}));
          if (!leadsResponse.ok || !leadsPayload.content) {
            const leadsErrors: Record<string, string> = {
              insufficient_credits: tr(language, "استخراج العملاء يحتاج إلى 20 توكن. رصيدك غير كافٍ؛ اشحن أو خد باقة HotLucky.", "Lead extraction costs 20 tokens. Your balance is not enough; top up or grab the HotLucky pack."),
              invalid_leads_request: tr(language, "اكتب نوع النشاط والمنطقة بشكل أوضح — مثال: مطاعم في مدينة نصر. لم يُخصم الرصيد.", "Describe the business type and area more clearly — e.g. restaurants in Nasr City. Nothing was charged."),
              leads_no_results: tr(language, "لم يتم العثور على شركات مطابقة لبحثك. جرّب منطقة أو نشاطًا مختلفًا — تم استرداد الرصيد بالكامل.", "No matching businesses were found. Try a different area or business type — you were fully refunded."),
              leads_no_more: tr(language, "مفيش نتائج جديدة كفاية للبحث ده — تم استرداد الرصيد بالكامل. جرّب منطقة أو نشاطًا مختلفًا.", "There are not enough new results for this search — you were fully refunded. Try a different area or activity."),
              leads_failed: tr(language, "تعذر إتمام الاستخراج الآن. تم استرداد الرصيد بالكامل؛ حاول مرة أخرى.", "The extraction could not be completed. You were fully refunded; please try again."),
              leads_not_configured: tr(language, "خدمة استخراج العملاء غير مُعدّة على الخادم بعد.", "The lead extraction service is not configured on the server yet."),
              login_required: tr(language, "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.", "Your session expired. Please sign in again."),
            };
            throw new Error(leadsErrors[String(leadsPayload.error || "")] || tr(language, "تعذر إتمام الاستخراج الآن. لم يُخصم الرصيد.", "The extraction failed. Nothing was charged."));
          }
          if (typeof leadsPayload.tokenBalance === "number") setWalletBalance(leadsPayload.tokenBalance);
          const leadsKey = trimmed.replace(/\s+/g, " ").trim().slice(0, 120);
          const leadsBatch: LeadBusiness[] = Array.isArray(leadsPayload.leads) ? leadsPayload.leads : [];
          const priorBatches = sessionLeadsRef.current.get(leadsKey) ?? [];
          const leadsOffset = priorBatches.reduce((n, b) => n + b.length, 0);
          if (leadsBatch.length > 0) {
            sessionLeadsRef.current.set(leadsKey, [...priorBatches, leadsBatch]);
            const seenIds = sessionLeadSeenRef.current.get(leadsKey) ?? [];
            sessionLeadSeenRef.current.set(leadsKey, [...seenIds, ...leadsBatch.map(l => l.placeId).filter((v): v is string => typeof v === "string" && v.length > 0)]);
          }
          setMessages(current => [...current, { id: crypto.randomUUID(), role: "assistant", content: String(leadsPayload.content), timestamp: formatTime(), leadsData: leadsBatch.length > 0 ? leadsBatch : undefined, leadsQuery: leadsKey, leadsOffset }]);
        } catch (leadsError) {
          setRequestError(leadsError instanceof Error ? leadsError.message : tr(language, "تعذر إتمام الاستخراج الآن.", "The extraction failed."));
        } finally {
          setReportWait(null);
          setIsSending(false);
          setIsSearchingWeb(false);
          setLeadsMode(false);
        }
        return;
      }
      setConversations(current => {
        const existing = current.some(item => item.id === conversationId);
        const next: Conversation = {
          id: conversationId!,
          title: activeConversation ? (current.find(item => item.id === conversationId)?.title || trimmed.slice(0, 28)) : trimmed.slice(0, 28),
          preview: trimmed.slice(0, 32),
          date: "الآن",
        };
        return existing ? current.map(item => item.id === conversationId ? { ...item, ...next } : item) : [next, ...current];
      });

      let filePayload: { name: string; type: string; path: string; encoding: "storage" } | undefined;
      if (attachment) {
        if (attachment.size > 10 * 1024 * 1024) throw new Error("حجم الملف يجب ألا يتجاوز 10 ميجابايت.");
        const uploadResponse = await authFetch("/api/model/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: attachment.name, type: attachment.type, size: attachment.size }),
        });
        const upload = await uploadResponse.json().catch(() => ({})) as { uploadUrl?: string; path?: string; contentType?: string; error?: string };
        if (!uploadResponse.ok || !upload.uploadUrl || !upload.path) {
          throw new Error(upload.error === "file_too_large" ? "حجم الملف يجب ألا يتجاوز 10 ميجابايت." : "تعذر تجهيز رفع الملف. حاول مرة أخرى.");
        }
        const uploadBody = new FormData();
        uploadBody.append("cacheControl", "3600");
        uploadBody.append("", attachment);
        const putResponse = await fetch(upload.uploadUrl, {
          method: "PUT",
          body: uploadBody,
        });
        if (!putResponse.ok) throw new Error("تعذر رفع الملف إلى التخزين. حاول مرة أخرى.");
        filePayload = { name: attachment.name, type: upload.contentType || attachment.type || "application/octet-stream", path: upload.path, encoding: "storage" };
      }
      const response = await authFetch("/api/model/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: requestMessages,
          extended,
          model: selectedModel,
          requestId: crypto.randomUUID(),
          conversationId,
          stream: true,
          attachment: filePayload,
          mode: darkLiveMode ? "darklive" : darkWebEnabled ? "darkweb" : (webSearchEnabled || selectedModel === "dadgpt-beast") ? "Beast pro" : "default",
          modes: { writingAssist, webSearch: webSearchEnabled, darkWeb: darkWebEnabled || darkLiveMode },
          livePremium: darkLiveMode,
          preferences: {
            style: localStorage.getItem("hotgpt-response-style") || "professional",
            instructions: (localStorage.getItem("hotgpt-custom-instructions") || "").slice(0, 2000),
            language: localStorage.getItem("hotgpt-language") === "en" ? "en" : "ar",
          },
        }),
        signal: AbortSignal.timeout(120000),
      });
      let payload = {} as {
        content?: string;
        error?: string;
        wallet?: { tokenBalance?: number } | null;
        conversationId?: string;
        partial?: boolean;
        continuationAvailable?: boolean; messageId?: string; is_complete?: boolean; part_count?: number; last_finish_reason?: string | null;
        billing?: { cost: number; tier: string; labelAr: string; labelEn: string } | null;
        liveSearch?: string;
      };
      let streamedAssistantId: string | null = null;
      // Mirror of the streamed bubble, kept outside the stream block so
      // the finally-reload can restore the text if the request died
      // mid-generation and the server never saved the answer (field
      // report, 2026-10-27: the user watched the answer stream in,
      // then the reload erased it and only the question remained).
      let preservedStreamedId: string | null = null;
      let preservedStreamedText = "";
      if (response.ok && response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
        streamedAssistantId = crypto.randomUUID();
        preservedStreamedId = streamedAssistantId;
        let streamedText = "";
        setMessages(current => [...current, { id: streamedAssistantId!, role: "assistant", content: "", timestamp: formatTime() }]);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        let streamError: string | null = null;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true });
            const frames = pending.split(/\r?\n\r?\n/);
            pending = frames.pop() || "";
            for (const frame of frames) {
              const dataLine = frame.split(/\r?\n/).find(line => line.startsWith("data:"));
              if (!dataLine) continue;
              try {
                const event = JSON.parse(dataLine.slice(5).trim());
                if (event.type === "attempt") {
                  // Never erase text already received when a new attempt starts.
                  setIsThinking(false);
                } else if (event.type === "thinking") {
                  setIsThinking(true);
                } else if (event.type === "delta" && typeof event.content === "string") {
                  setIsSearchingWeb(false);
                  setIsThinking(false);
                  setHasStartedStreaming(true);
                  streamedText += event.content;
                  preservedStreamedText = streamedText;
                  setMessages(current => current.map(message => message.id === streamedAssistantId ? { ...message, content: streamedText } : message));
                } else if (event.type === "done") {
                  payload = event;
                } else if (event.type === "error") {
                  streamError = String(event.error || "provider_request_failed");
                  if (!streamedText.trim()) {
                    setMessages(current => current.map(message => message.id === streamedAssistantId ? { ...message, content: "" } : message));
                  }
                }
              } catch { /* Ignore malformed server frames. */ }
            }
          }
        } finally {
          reader.releaseLock();
        }
        if (streamError && !streamedText.trim()) {
          setMessages(current => current.filter(message => message.id !== streamedAssistantId));
          const streamErrors: Record<string, string> = {
            provider_timeout: "استغرق النموذج وقتًا أطول من المتوقع. لم يُخصم الرصيد، حاول مرة أخرى.",
            provider_rate_limited: "النموذج مشغول حاليًا. لم يُخصم الرصيد، حاول بعد قليل.",
            provider_request_failed: "تعذر الاتصال بالنموذج. لم يُخصم الرصيد، حاول مرة أخرى.",
            provider_empty_response: "لم يُرجع النموذج إجابة مكتملة. لم يُخصم الرصيد.",
            insufficient_credits: "الإجابة تحتاج رصيدًا إضافيًا حسب طولها وعمقها. لم يُخصم أي رصيد عن هذه المحاولة؛ اشترِ باقة مناسبة أو جرّب طلبًا أقصر.",
          };
          throw new Error(streamErrors[streamError] || "تعذر إكمال الإجابة. لم يُخصم الرصيد.");
        }
        if (typeof payload.content !== "string" || !payload.content.trim()) {
          if (streamedText.trim()) {
            payload.content = streamedText;
            payload.partial = true;
          } else {
            throw new Error("provider_request_failed");
          }
        }
      } else {
        payload = await response.json().catch(() => ({})) as typeof payload;
      }
      if (!response.ok || typeof payload.content !== "string" || !payload.content.trim()) {
        const errors: Record<string, string> = {
          provider_not_configured: "لم يتم إعداد مزود الذكاء الاصطناعي على الخادم بعد. أضف إعدادات النموذج في Vercel.",
          messages_required: "الرسالة فارغة أو غير صالحة.",
          invalid_messages: "تعذر إرسال المحادثة بسبب تنسيق الرسائل.",
          invalid_conversation_id: "المحادثة غير صالحة. أنشئ محادثة جديدة وحاول مرة أخرى.",
          rate_limited: "تم إرسال طلبات كثيرة خلال وقت قصير. انتظر دقيقة ثم حاول مجددًا.",
          provider_timeout: "استغرق النموذج وقتًا أطول من المتوقع. حاول مرة أخرى.",
          provider_request_failed: "تعذر الاتصال بالنموذج حاليًا. حاول مرة أخرى بعد قليل.",
          pro_required: "هذه الميزة متاحة للمشتركين في الباقات المدفوعة فقط. اشترك لتفعيل الوضع المطلوب.",
          web_search_not_configured: "البحث على الإنترنت غير مُعدّ على الخادم بعد. أضف مفتاح خدمة البحث إلى Vercel.",
          web_search_failed: "تعذر البحث على الإنترنت الآن. حاول مرة أخرى لاحقًا.",
          invalid_attachment: "تعذر إرسال الملف. تأكد أن حجمه لا يتجاوز 10 ميجابايت.",
          unsupported_attachment: "نوع الملف غير مدعوم. استخدم PDF أو TXT أو MD أو CSV أو JSON.",
          file_too_large: "حجم الملف يجب ألا يتجاوز 10 ميجابايت.", upload_unavailable: "تعذر رفع الملف إلى التخزين. حاول مرة أخرى.",
          attachment_read_failed: "تعذر قراءة الملف. جرّب حفظه مرة أخرى ثم ارفعه.",
          attachment_no_text: "لم أتمكن من استخراج نص من الملف. إذا كان PDF ممسوحًا ضوئيًا كصورة، فسيحتاج إلى OCR.",
          login_required: "انتهت جلسة الدخول. سجّل الدخول ثم حاول مجددًا.",
          insufficient_credits: attachment ? "تحليل الملفات يحتاج إلى 3 توكينات. رصيدك غير كافٍ؛ اختر باقة مناسبة." : webSearchEnabled ? "البحث المتقدم يحتاج إلى 5 توكينات لكل عملية. رصيدك غير كافٍ؛ اختر باقة مناسبة." : darkWebEnabled ? "تبدأ تكلفة الدارك ويب من 3 توكينات، وقد تصل إلى 9 حسب طول الإجابة وعمقها. رصيدك غير كافٍ؛ اختر باقة مناسبة." : selectedModel === "dadgpt-beast" ? "تتراوح تكلفة الوحش PRO بين 3 و9 توكينات حسب طول الإجابة وعمقها. اشترِ باقة مناسبة." : "لقد نفذ رصيدك المجاني. اختر باقتك من هنا",
          billing_unavailable: "تعذر التحقق من رصيدك حاليًا. حاول بعد قليل.",
          conversations_unavailable: "تعذر حفظ المحادثة في قاعدة البيانات.",
        };
        throw new Error(errors[payload.error ?? ""] ?? "تعذر الحصول على رد من النموذج. حاول مرة أخرى.");
      }
      if (typeof payload.wallet?.tokenBalance === "number") setWalletBalance(payload.wallet.tokenBalance);
      if (payload.liveSearch === "unavailable") {
        setRequestError(tr(language, "البحث الحي في الدارك ويب لم يُرجع نتائج لهذا الاستعلام — تمت الإجابة من المعرفة العامة ولم يُخصم رسم البحث الحي.", "Live dark-web search returned no results for this query — answered from general knowledge; the live fee was not charged."));
      } else if (payload.liveSearch === "locked") {
        setRequestError(tr(language, "البحث الحي في الدارك ويب يحتاج رصيد 20 توكن أو أكثر.", "Live dark-web search needs a balance of 20+ tokens."));
      }
      if (typeof payload.wallet?.freeAnswersRemaining === "number") setFreeAnswersRemaining(Math.max(0, payload.wallet.freeAnswersRemaining));
      const finalAssistantContent = payload.content!;
      const serverMessageId = payload.messageId || streamedAssistantId || crypto.randomUUID();
      setMessages(current => streamedAssistantId
        ? current.map(message => message.id === streamedAssistantId ? { ...message, id: serverMessageId, content: finalAssistantContent, timestamp: formatTime(), continuationAvailable: payload.is_complete === false || payload.continuationAvailable === true, isComplete: payload.is_complete !== false, partCount: Number(payload.part_count || 1), lastFinishReason: payload.last_finish_reason ?? null } : message)
        : [...current, { id: serverMessageId, role: "assistant", content: finalAssistantContent, timestamp: formatTime(), continuationAvailable: payload.is_complete === false || payload.continuationAvailable === true, isComplete: payload.is_complete !== false, partCount: Number(payload.part_count || 1), lastFinishReason: payload.last_finish_reason ?? null }]);
      setAttachment(null);
      setConversations(current => current.map(item => item.id === conversationId
        ? { ...item, preview: payload.content!.slice(0, 32), date: "الآن" }
        : item));
    } catch (error) {
      const message = error instanceof Error && error.name === "TimeoutError"
        ? "انتهت مهلة الاتصال بالنموذج. حاول مرة أخرى."
        : error instanceof Error
          ? error.message
          : "حدث خطأ غير متوقع أثناء إرسال الرسالة.";
      setRequestError(message);
    } finally {
      setIsSearchingWeb(false);
      setIsThinking(false);
      setIsSending(false);
      // The server saves everything before it signals completion, so reload
      // the authoritative history explicitly: no completed exchange can be
      // lost from the visible list by stale local state again.
      if (conversationId) { try { await loadConversationMessages(conversationId); } catch {} }
      // …unless the request died mid-generation (platform time
      // ceiling): the server's staged row is still empty then, so the
      // reload erases an answer the user already watched stream in.
      // Restore the locally streamed text when the reloaded history
      // does not already carry it.
      if (preservedStreamedId && preservedStreamedText.trim().length >= 40) {
        const keptId = preservedStreamedId;
        const keptText = preservedStreamedText;
        setMessages(current => {
          const alreadyThere = current.some(message => message.role === "assistant" && message.content.trim().length >= 40 && message.content.slice(0, 120) === keptText.slice(0, 120));
          return alreadyThere ? current : [...current, { id: keptId, role: "assistant", content: keptText, timestamp: formatTime() }];
        });
      }
    }
  };
  const extractMoreLeads = async (target: ChatMessage) => {
    if (isSending || !target.leadsQuery || !activeConversation) return;
    const query = target.leadsQuery;
    const excludePlaceIds = sessionLeadSeenRef.current.get(query) ?? [];
    const priorForCenter = sessionLeadsRef.current.get(query) ?? [];
    const coordLeads = priorForCenter.flat().filter(l => typeof l.lat === "number" && typeof l.lng === "number");
    // Anchor on the densest cluster of delivered businesses (a real, busy
    // location), not the plain centroid: an anchor in empty space makes the
    // geo search return nothing.
    let moreCenter: { lat: number; lng: number } | undefined;
    if (coordLeads.length > 0) {
      let best = coordLeads[0];
      let bestCount = -1;
      for (const candidate of coordLeads) {
        const n = coordLeads.filter(o => Math.abs((o.lat ?? 0) - (candidate.lat ?? 0)) <= 0.05 && Math.abs((o.lng ?? 0) - (candidate.lng ?? 0)) <= 0.05).length;
        if (n > bestCount) { bestCount = n; best = candidate; }
      }
      moreCenter = { lat: best.lat ?? 0, lng: best.lng ?? 0 };
    }
    const moreBatch = priorForCenter.length;
    setIsSending(true);
    setIsSearchingWeb(true);
    setReportWait("leads");
    setRequestError(null);
    try {
      const moreResponse = await authFetch("/api/model/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadsMode: true, leadsMore: true, query, conversationId: activeConversation, excludePlaceIds, moreCenter, moreBatch }) });
      const morePayload = await moreResponse.json().catch(() => ({}));
      if (!moreResponse.ok || !morePayload.content) {
        const moreErrors: Record<string, string> = {
          insufficient_credits: tr(language, "استخراج المزيد يحتاج إلى 20 توكن. رصيدك غير كافٍ؛ اشحن أو خد باقة HotLucky.", "Extracting more costs 20 tokens. Your balance is not enough; top up or grab the HotLucky pack."),
          leads_no_more: tr(language, "مفيش نتائج جديدة كفاية للبحث ده — تم استرداد الرصيد بالكامل. جرّب منطقة أو نشاطًا مختلفًا.", "There are not enough new results for this search — you were fully refunded. Try a different area or activity."),
          leads_failed: tr(language, "تعذر إتمام الاستخراج الآن. تم استرداد الرصيد بالكامل؛ حاول مرة أخرى.", "The extraction could not be completed. You were fully refunded; please try again."),
          leads_not_configured: tr(language, "خدمة استخراج العملاء غير مُعدّة على الخادم بعد.", "The lead extraction service is not configured on the server yet."),
          login_required: tr(language, "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.", "Your session expired. Please sign in again."),
        };
        throw new Error(moreErrors[String(morePayload.error || "")] || tr(language, "تعذر إتمام الاستخراج الآن. لم يُخصم الرصيد.", "The extraction failed. Nothing was charged."));
      }
      if (typeof morePayload.tokenBalance === "number") setWalletBalance(morePayload.tokenBalance);
      const batch: LeadBusiness[] = Array.isArray(morePayload.leads) ? morePayload.leads : [];
      const priorBatches = sessionLeadsRef.current.get(query) ?? [];
      const offset = priorBatches.reduce((n, b) => n + b.length, 0);
      if (batch.length > 0) {
        sessionLeadsRef.current.set(query, [...priorBatches, batch]);
        sessionLeadSeenRef.current.set(query, [...excludePlaceIds, ...batch.map(l => l.placeId).filter((v): v is string => typeof v === "string" && v.length > 0)]);
      }
      setMessages(current => [...current, { id: crypto.randomUUID(), role: "assistant", content: String(morePayload.content), timestamp: formatTime(), leadsData: batch.length > 0 ? batch : undefined, leadsQuery: query, leadsOffset: offset }]);
    } catch (moreError) {
      setRequestError(moreError instanceof Error ? moreError.message : tr(language, "تعذر إتمام الاستخراج الآن.", "The extraction failed."));
    } finally {
      setReportWait(null);
      setIsSending(false);
      setIsSearchingWeb(false);
    }
  };

  const continueMessage = async (target: ChatMessage) => {
    const contCost = darkLiveMode || darkWebEnabled || webSearchEnabled || selectedModel === "dadgpt-beast" ? 5 : 1;
    if (isSending || !target.continuationAvailable || walletBalance < contCost) return;
    setIsSending(true); setRequestError(null); setHasStartedStreaming(true);
    setMessages(current => current.map(m => m.id === target.id ? { ...m, continuationDisabled: true, continuationLabel: tr(language, "جارٍ الإكمال...", "Continuing...") } : m));
    try {
      const response = await authFetch("/api/model/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ continueMessageId: target.id, stream: true, mode: darkLiveMode ? "darklive" : darkWebEnabled ? "darkweb" : (webSearchEnabled || selectedModel === "dadgpt-beast") ? "Beast pro" : "default" }), signal: AbortSignal.timeout(120000) });
      if (!response.ok) { const err = await response.json().catch(() => ({})); if (response.status === 402 || err.error === "insufficient_credits") { if (typeof err.user_credits === "number") setWalletBalance(err.user_credits); throw new Error(tr(language, `الرصيد غير كافٍ لإكمال الشرح؛ تحتاج إلى ${contCost} توكن.`, `Not enough credits to continue; ${contCost} credits are required.`)); } throw new Error(String(err.error || "تعذر إكمال الشرح.")); }
      let payload: any = {}, pending = "";
      if (response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
        const reader = response.body.getReader(), decoder = new TextDecoder();
        try { while (true) { const {done,value}=await reader.read(); if(done)break; pending+=decoder.decode(value,{stream:true}); const frames=pending.split(/\r?\n\r?\n/); pending=frames.pop()||""; for(const frame of frames){const line=frame.split(/\r?\n/).find(v=>v.startsWith("data:"));if(!line)continue;let ev:any;try{ev=JSON.parse(line.slice(5).trim())}catch{continue}if(ev.type==="delta"&&typeof ev.content==="string")setMessages(cur=>cur.map(m=>m.id===target.id?{...m,content:String(m.content||"")+ev.content}:m));else if(ev.type==="done")payload=ev;else if(ev.type==="error")throw new Error(String(ev.error||"provider_request_failed"));}} } finally { reader.releaseLock(); }
      } else payload = await response.json().catch(() => ({}));
      if(typeof payload.content!=="string")throw new Error("provider_request_failed");
      setMessages(cur=>cur.map(m=>m.id===target.id?{...m,id:String(payload.messageId||target.id),content:payload.content,continuationAvailable:payload.is_complete===false||payload.continuationAvailable===true,isComplete:payload.is_complete!==false,partCount:Number(payload.part_count||(m.partCount||1)+1),lastFinishReason:payload.last_finish_reason??null,continuationDisabled:false,continuationLabel:undefined}:m));
      if(typeof payload.wallet?.tokenBalance==="number")setWalletBalance(payload.wallet.tokenBalance);else setWalletBalance(v=>Math.max(0,v-5));
    } catch(error) { setRequestError(error instanceof Error?error.message:"تعذر إكمال الشرح."); setMessages(cur=>cur.map(m=>m.id===target.id?{...m,continuationDisabled:false,continuationLabel:undefined}:m)); }
    finally { setIsSending(false); if (activeConversation) { try { await loadConversationMessages(activeConversation); } catch {} } }
  };

  const requireProFeature = (feature: "search" | "darkweb" | "beast") => {
    const featureName = feature === "search"
      ? tr(language, "البحث على الإنترنت", "Internet Search")
      : feature === "darkweb"
        ? tr(language, "وضع الدارك ويب", "Dark Web mode")
        : "الوحش PRO";
    if (walletBalance <= 0) {
      setRequestError(tr(language,
        `يجب الاشتراك من هنا لاستخدام ${featureName}.`,
        `Subscribe here to use ${featureName}.`));
      return false;
    }
    return true;
  };

  const toggleProMode = (feature: "search" | "darkweb") => {
    if (!requireProFeature(feature)) return;

    // Both modes may be enabled; the server gives Dark Web analysis priority.

    setRequestError(null);
    setImageMode(false);
    setScanMode(false);
    setSeoMode(false);
    setLeadsMode(false);
    if (feature === "search") setWebSearchEnabled(value => !value);
    else { setDarkWebEnabled(value => !value); setDarkLiveMode(false); }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };
  const handleLogout = () => {
    setProfileMenuOpen(false);
    // Dismissal is reset so the visitor gate can appear once after logout.
    try {
      sessionStorage.removeItem("hotgpt-visitor-popup-dismissed");
      sessionStorage.removeItem("hotgpt-welcome-pending");
      sessionStorage.removeItem("hotgpt.supabase.session");
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");
      sessionStorage.removeItem("token");
      for (const key of Object.keys(sessionStorage)) {
        if (/^sb-.+-auth-token$/i.test(key) || /^(hotgpt\\.auth\\.token|supabase\\.auth\\.token)$/i.test(key)) sessionStorage.removeItem(key);
      }
    } catch {}
    try {
      localStorage.removeItem("hotgpt.supabase.session");
      localStorage.removeItem("hotgpt.chat.v1");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("token");
      for (const key of Object.keys(localStorage)) {
        if (/^sb-.+-auth-token$/i.test(key) || /^(hotgpt\\.auth\\.token|supabase\\.auth\\.token)$/i.test(key)) localStorage.removeItem(key);
      }
    } catch {}
    // Re-enter the app as a fresh guest state; this removes the account avatar immediately.
    window.location.replace("/");
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) setRequestError("حجم الملف يجب ألا يتجاوز 10 ميجابايت.");
      else if (!/\.(pdf|txt|md|csv|json)$/i.test(file.name)) setRequestError("نوع الملف غير مدعوم. استخدم PDF أو TXT أو MD أو CSV أو JSON.");
      else { setRequestError(null); setAttachment(file); }
    }
    event.target.value = "";
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage }}>
    <style>{`.visitor-modal-backdrop,.post-login-welcome-backdrop{background:rgba(0,0,0,.72)!important;backdrop-filter:blur(5px)}.visitor-modal-card,.post-login-welcome-card{background:#000000!important;border:1px solid #555!important;color:#FFFFFF!important}.visitor-modal-card .welcome-modal-close,.post-login-welcome-card .welcome-modal-close{left:12px!important;right:auto!important;color:#FFFFFF!important}.visitor-modal-card .welcome-modal-lead,.post-login-welcome-card .welcome-modal-lead{color:#FFFFFF!important}.visitor-modal-card .welcome-modal-cta{display:flex;align-items:center;justify-content:center;text-align:center;margin-top:10px;min-height:50px}.visitor-modal-card .visitor-signup-cta{background:transparent!important;border:1px solid #C9A227!important;color:#FFFFFF!important}.post-login-welcome-actions{display:flex;flex-direction:column;gap:10px;margin-top:22px}.post-login-welcome-actions a{display:block;border-radius:12px;padding:13px 16px;text-align:center;font-weight:900;text-decoration:none}.post-login-rewards-cta{background:#FBBF24!important;color:#1A0505!important}.post-login-plans-cta{background:#DC2626!important;color:#FFFFFF!important}html[data-theme="blood"] .visitor-modal-card .welcome-modal-cta{background:#FBBF24!important;color:#1A0505!important;border:1px solid #FBBF24!important}html[data-theme="blood"] .profile-menu{background:#1A0505!important;border-color:#C9A227!important}html[data-theme="blood"] .profile-token-badge{background:rgba(251,191,36,.12)!important;color:#FBBF24!important}html[data-theme="blood"] .rewards-sidebar-link{background:transparent!important;border:1px solid rgba(251,191,36,.45)!important;color:#FBBF24!important}html[data-theme="blood"] .visitor-modal-card,html[data-theme="blood"] .post-login-welcome-card{background:#1A0505!important;border-color:#C9A227!important;color:#FFFFFF!important}html[data-theme="blood"] .visitor-modal-card .welcome-modal-eyebrow,html[data-theme="blood"] .post-login-welcome-card .welcome-modal-eyebrow,html[data-theme="blood"] .visitor-modal-card h2,html[data-theme="blood"] .post-login-welcome-card h2{color:#FBBF24!important}html[data-theme="blood"] .visitor-modal-card .welcome-modal-close,html[data-theme="blood"] .post-login-welcome-card .welcome-modal-close{background:#2B0000!important;border-color:#C9A227!important;color:#FFFFFF!important}html[data-theme="dark"] .visitor-modal-card .welcome-modal-eyebrow,html[data-theme="dark"] .post-login-welcome-card .welcome-modal-eyebrow,html[data-theme="dark"] .visitor-modal-card h2,html[data-theme="dark"] .post-login-welcome-card h2{color:#FBBF24!important}html[data-theme="dark"] .visitor-modal-card .welcome-modal-close,html[data-theme="dark"] .post-login-welcome-card .welcome-modal-close{background:#111111!important;border-color:#555!important;color:#FFFFFF!important}html[data-theme="dark"] .visitor-modal-card .welcome-modal-cta{background:#DC2626!important;color:#FFFFFF!important}html[data-theme="dark"] .visitor-modal-card .visitor-signup-cta{background:#111111!important;border-color:#C9A227!important;color:#FFFFFF!important}`}</style>
      <style>{`html[data-theme="dark"]{--bg:#000000;--card:#111111;--text:#FFFFFF;--accent:#FFFFFF;color-scheme:dark}
html[data-theme="blood"]{--bg:#2B0000;--card:#400000;--text:#FFFFFF;--accent:#FF1E2E;color-scheme:dark}
html[data-theme="dark"] body,html[data-theme="blood"] body,html[data-theme="dark"] #root,html[data-theme="blood"] #root,html[data-theme="dark"] .app-shell,html[data-theme="blood"] .app-shell,html[data-theme="dark"] .main-shell,html[data-theme="blood"] .main-shell,html[data-theme="dark"] .chat-workspace,html[data-theme="blood"] .chat-workspace,html[data-theme="dark"] .sidebar,html[data-theme="blood"] .sidebar,html[data-theme="dark"] .sidebar-drawer,html[data-theme="blood"] .sidebar-drawer,html[data-theme="dark"] main,html[data-theme="blood"] main,html[data-theme="dark"] .settings-view,html[data-theme="blood"] .settings-view{background:var(--bg)!important;color:var(--text)!important}
html[data-theme="dark"] header,html[data-theme="dark"] .settings-card,html[data-theme="blood"] .settings-card,html[data-theme="dark"] .composer,html[data-theme="blood"] .composer,html[data-theme="dark"] .conversation-item,html[data-theme="blood"] .conversation-item,html[data-theme="dark"] .chat-input-wrap,html[data-theme="blood"] .chat-input-wrap{background:var(--card)!important;color:var(--text)!important}
html[data-theme="blood"] .settings-card,html[data-theme="blood"] .settings-card h3,html[data-theme="blood"] .settings-card p,html[data-theme="blood"] .settings-card span,html[data-theme="blood"] .composer textarea,html[data-theme="blood"] .sidebar *,html[data-theme="blood"] .conversation-item *{color:#FFFFFF}
.appearance-settings-card{align-items:flex-start}.appearance-settings-copy{flex:1 1 auto;min-width:0}
.appearance-theme-options{display:flex;flex-flow:row nowrap;gap:10px;width:100%;margin-top:12px}
.appearance-theme-option{display:flex;flex:1 1 0;min-width:0;flex-direction:column;align-items:flex-start;gap:5px;padding:12px;border:1px solid #555;border-radius:10px;background:#111;color:#fff;text-align:start}
.appearance-theme-option strong{color:#fff;font-size:13px;line-height:1.4}.appearance-theme-option span{color:#bbb;font-size:11px;line-height:1.5}
.appearance-theme-option.selected{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
html[data-theme="blood"] .appearance-theme-option{background:#400000;color:#fff}
.new-chat-button{background:#FBBF24!important;color:#1A0505!important;border:1px solid #FBBF24!important;box-shadow:0 5px 18px rgba(251,191,36,.22)!important}
.new-chat-button:hover{background:#F59E0B!important;color:#1A0505!important}
.new-chat-shortcut{color:#FFFFFF!important;border-color:rgba(255,255,255,.45)!important}
html[data-theme="dark"] .new-chat-button{background:#222222!important;color:#FFFFFF!important;border-color:#444!important;box-shadow:none!important}
html[data-theme="dark"] .new-chat-button:hover{background:#333!important}
.mobile-menu-button,.mobile-only.icon-button{color:#FFFFFF!important}html[data-theme="blood"] .appearance-theme-option.selected{border-color:#FF1E2E;box-shadow:inset 0 0 0 1px #FF1E2E}html[data-theme="blood"] header{background:#2B0000!important;color:#FFFFFF!important}html[data-theme="dark"] header{background:#000000!important;color:#FFFFFF!important}
.composer-mode-row{display:flex!important;flex-wrap:nowrap!important;gap:6px!important;padding:6px 10px!important;overflow:visible!important}
.composer-mode-row>.composer-mode{flex:1 1 0!important;min-width:0!important;max-width:none!important;padding-inline:4px!important;font-size:12px!important;white-space:nowrap!important;justify-content:center}
.composer-mode.beast-mode{padding-inline:4px!important}.composer-mode.beast-mode>span:first-child{font-size:12px!important}
@media(max-width:520px){.composer-mode-row{flex-wrap:nowrap!important;gap:6px!important;padding:6px 10px!important;overflow:visible!important}.composer-mode-row>.composer-mode{flex:1 1 0!important;min-width:0!important;padding-inline:3px!important;font-size:12px!important}.composer-mode.beast-mode{padding-inline:3px!important}.composer-mode.beast-mode>span:first-child{font-size:12px!important}}`}</style>
      <div className="app-shell" dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
      <style>{`html[data-theme="light"],html[data-theme="light"] body,html[data-theme="light"] #root{background:#2B0000!important;color:#fff!important}html[data-theme="light"] .app-shell,html[data-theme="light"] .main-shell,html[data-theme="light"] .chat-workspace,html[data-theme="light"] main{background:#2B0000!important;color:#fff!important}html[data-theme="light"] .sidebar-drawer,html[data-theme="light"] .sidebar,html[data-theme="light"] .settings-card,html[data-theme="light"] .content-panel,html[data-theme="light"] .composer,html[data-theme="light"] .message-content{background-color:#3D0005!important;color:#fff!important;border-color:#6B1018!important}html[data-theme="light"] h1,html[data-theme="light"] h2,html[data-theme="light"] h3,html[data-theme="light"] p,html[data-theme="light"] label,html[data-theme="light"] small,html[data-theme="light"] strong,html[data-theme="light"] span,html[data-theme="light"] .nav-item,html[data-theme="light"] .conversation-item,html[data-theme="light"] .profile-row,html[data-theme="light"] .setting-status{color:#fff}html[data-theme="light"] input,html[data-theme="light"] textarea,html[data-theme="light"] select{background:#400000!important;color:#fff!important;border-color:#76202A!important}html[data-theme="light"] input::placeholder,html[data-theme="light"] textarea::placeholder{color:#E7BFC3!important}html[data-theme="light"] .new-chat-button,html[data-theme="light"] .send-button.ready,html[data-theme="light"] .hotlucky-slim-cta{background:#FF1E2E!important;color:#fff!important;border-color:#FF1E2E!important}.extended-toggle.active,.extended-toggle.active>svg{color:#22C55E!important}.extended-toggle.active .toggle-track{background:#166534!important}.extended-toggle.active .toggle-track span{background:#22C55E!important}.extended-cost-label{color:#22C55E!important;font-size:10px;white-space:nowrap}.darkweb-mode{padding:6px 12px!important}.composer-mode-row{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;overflow:visible!important;gap:8px!important;padding-inline:6px!important;justify-content:flex-start!important;scrollbar-width:none!important;-webkit-overflow-scrolling:touch}.composer-mode-row::-webkit-scrollbar{display:none}.composer-mode-row>.composer-mode{flex:1 1 0!important;min-width:0!important}@media (max-width:520px){.composer-mode-row>.composer-mode{padding-inline:9px!important}}html[data-theme="light"] .composer-mode{padding-inline:12px!important}`}</style>
      <div
        className={sidebarOpen ? "mobile-scrim visible" : "mobile-scrim"}
        onClick={() => setSidebarOpen(false)}
      />
      <div className={sidebarOpen ? "sidebar-drawer open" : "sidebar-drawer"}>
        <Sidebar
          conversations={conversations}
          activeId={activeConversation}
          onSelect={id => {
            setLocation(`/chat/${id}`);
            setActiveConversation(id);
            setMessages([]);
            setRequestError(null);
            setActiveView("chat");
            setSidebarOpen(false);
            void authFetch(`/api/conversations?id=${encodeURIComponent(id)}`).then(async response => {
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error("conversation_load_failed");
              if (String(payload.conversation?.id) !== id) return;
              setMessages((payload.messages ?? []).map((item: any) => ({
                id: String(item.id),
                role: item.role,
                content: item.role === "assistant" ? String(item.content) : String(item.content),
                timestamp: item.createdAt ? new Date(item.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "",
              })));
            }).catch(() => setRequestError("تعذر فتح المحادثة المحفوظة. حاول مرة أخرى."));
          }}
          onNew={startNew}
          onDelete={id => {
            void (async () => {
              try {
                setRequestError(null);
                const response = await authFetch(`/api/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) throw new Error(payload.error || "conversation_delete_failed");
                setConversations(current => current.filter(item => item.id !== id));
                if (activeConversation === id) {
                  setActiveConversation(null);
                  setMessages([]);
                  setDraft("");
                  setActiveView("chat");
                }
              } catch {
                setRequestError(tr(language, "تعذر حذف المحادثة. حاول مرة أخرى.", "Could not delete the conversation. Please try again."));
              }
            })();
          }}
          onDeleteAll={() => {
            void (async () => {
              try {
                setRequestError(null);
                const response = await authFetch("/api/conversations?all=1", { method: "DELETE" });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) throw new Error(payload.error || "conversations_delete_all_failed");
                setConversations([]);
                if (activeConversation) {
                  setActiveConversation(null);
                  setMessages([]);
                  setDraft("");
                  setActiveView("chat");
                }
              } catch {
                setRequestError(tr(language, "تعذر مسح المحادثات. حاول مرة أخرى.", "Could not delete the conversations. Please try again."));
              }
            })();
          }}
          onSettings={() => {
            setActiveView("settings");
            setSidebarOpen(false);
          }}
          onGuide={() => {
            setActiveView("files");
            setSidebarOpen(false);
          }}
          activeView={activeView}
          onClose={() => setSidebarOpen(false)}
          displayName={auth.user?.name || auth.user?.email || "مستخدم HotGPT"}
          email={auth.user?.email || ""}
          walletBalance={walletBalance}
          onLogout={handleLogout}
        />
      </div>
      <main className="main-shell">
        <header className="topbar hotgpt-topbar">
          <div className="topbar-brand">
            <button
              className="icon-button mobile-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label={tr(language, "فتح القائمة", "Open menu")}
            >
              <Menu size={22} />
            </button>
            <button className="topbar-home-brand" onClick={startNew} aria-label={tr(language, "HotGPT - محادثة جديدة", "HotGPT - New chat")}>
              <BrandMark />
            </button>
          </div>
          <div className="topbar-actions hotgpt-topbar-actions">
            {walletBalance > 0 && (
              <>
                <a href="/billing" className="token-balance" aria-label={tr(language, `الرصيد: ${walletBalance} توكن`, `Balance: ${walletBalance} tokens`)}>
                  <Coins size={20} /><span>{walletBalance}</span>
                </a>

              </>
            )}
            <button className="language-button" type="button" onClick={toggleLanguage} aria-label={tr(language, "التبديل إلى الإنجليزية", "Switch to Arabic")} title={tr(language, "English", "العربية")}>
              <LanguageFlag lang={language === "ar" ? "en" : "ar"} />
            </button>
            {auth.isAuthenticated ? (              <div className="profile-menu-wrap">
                <button
                  className="topbar-avatar profile-menu-trigger"
                  aria-label={tr(language, "الحساب الشخصي", "Account menu")}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                  title={auth.user?.name || auth.user?.email || tr(language, "الحساب الشخصي", "Account menu")}
                  onClick={() => setProfileMenuOpen(open => !open)}
                >
                  {(auth.user?.name || auth.user?.email || "مستخدم HotGPT").trim().charAt(0).toLocaleUpperCase("ar-EG") || "م"}
                </button>
                {profileMenuOpen && (
                  <>
                    <button className="profile-menu-backdrop" aria-label={tr(language, "إغلاق قائمة الحساب", "Close account menu")} onClick={() => setProfileMenuOpen(false)} />
                    <div className="profile-menu" role="menu">
                      <div className="profile-menu-identity">
                        <strong>{auth.user?.name || tr(language, "المستخدم", "User")}</strong>
                        <span>{auth.user?.email}</span>
                        <a href="/billing" className="profile-token-badge"><Coins size={17} /> {walletBalance} {tr(language, "توكن", "tokens")}</a>

                      </div>
                      <a role="menuitem" href="/billing" className="profile-menu-item"><Crown size={19} /> <span>{tr(language, "الترقية إلى Pro", "Upgrade to Pro")}</span></a>
                      <a role="menuitem" href="/billing" className="profile-menu-item"><CreditCard size={19} /> <span>{tr(language, "الفوترة والباقات", "Billing & plans")}</span></a>
                      <button role="menuitem" className="profile-menu-item" onClick={() => { setProfileMenuOpen(false); setActiveView("settings"); }}><Settings size={19} /> <span>{tr(language, "الإعدادات", "Settings")}</span></button>
                      <button role="menuitem" className="profile-menu-item profile-menu-logout" onClick={handleLogout}><LogOut size={19} /> <span>{tr(language, "تسجيل الخروج", "Sign out")}</span></button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button type="button" className="topbar-avatar profile-menu-trigger cached-profile-trigger"
                aria-label={tr(language, "الحساب", "Account")} title={tr(language, "الحساب", "Account")}
                onClick={() => { window.location.href = "/auth?mode=login"; }}>H</button>
            )}
          </div>
        </header>
        {activeView === "settings" ? (
          <SettingsPanel onBack={() => setActiveView("chat")} />
        ) : activeView === "files" ? (
          <GuidePanel onBack={() => setActiveView("chat")} />
        ) : (
          <section className="chat-workspace">
            <div
              className={
                messages.length
                  ? "messages-scroll has-messages"
                  : "messages-scroll"
              }
            >
              {messages.length === 0 ? (
                routeConversationId && !requestError ? (
                  <div className="welcome-state" role="status" aria-live="polite">
                    <p className="welcome-copy">{tr(language, "جارٍ فتح المحادثة...", "Opening your conversation...")}</p>
                  </div>
                ) : (
                <Welcome
                  walletBalance={walletBalance}
                  onStarter={(text, mode) => {
                    setDraft(text);
                    setImageMode(false);
                    setScanMode(false);
                    setSeoMode(false);
                    if (mode === "beast" && requireProFeature("beast")) {
                      setSelectedModel("dadgpt-beast");
                      setDarkWebEnabled(false);
                      setDarkLiveMode(false);
                    }
                    if (mode === "dark" && requireProFeature("darkweb")) {
                      setDarkWebEnabled(true);
                      setDarkLiveMode(false);
                    }
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  onScan={() => {
                    if (walletBalance < 20) {
                      setRequestError(tr(language, "فحص الروابط خدمة Premium تحتاج رصيد 20 توكن أو أكثر. اشحن من صفحة الباقات أو خد باقة HotLucky.", "URL scanning is a Premium service that needs a balance of 20+ tokens. Top up from Plans or grab the HotLucky pack."));
                      return;
                    }
                    setRequestError(null);
                    setScanMode(true);
                    setSeoMode(false);
                    setImageMode(false);
                    setDraft("");
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  onSeo={() => {
                    if (walletBalance < 20) {
                      setRequestError(tr(language, "فحص SEO خدمة Premium تحتاج رصيد 20 توكن أو أكثر. اشحن من صفحة الباقات أو خد باقة HotLucky.", "SEO auditing is a Premium service that needs a balance of 20+ tokens. Top up from Plans or grab the HotLucky pack."));
                      return;
                    }
                    setRequestError(null);
                    setSeoMode(true);
                    setScanMode(false);
                    setImageMode(false);
                    setDraft("");
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  onDarkLive={() => {
                    if (walletBalance < 20) {
                      setRequestError(tr(language, "البحث الحي في الدارك ويب خدمة Premium تحتاج رصيد 20 توكن أو أكثر. اشحن من صفحة الباقات أو خد باقة HotLucky.", "Live dark-web search is a Premium service that needs a balance of 20+ tokens. Top up from Plans or grab the HotLucky pack."));
                      return;
                    }
                    if (!requireProFeature("darkweb")) return;
                    setRequestError(null);
                    setDarkWebEnabled(false);
                    setDarkLiveMode(true);
                    setImageMode(false);
                    setScanMode(false);
                    setSeoMode(false);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                />
                )
              ) : (
                <div className="messages-list">
                  {isSearchingWeb && (
                    <div className="search-progress-notice" role="status" aria-live="polite">
                      <Search size={15} />
                      <span>{tr(language, "جاري البحث في أحدث المصادر الموثوقة...", "Searching trusted sources...")}</span>
                    </div>
                  )}
                  {messages.map((message,index)=>{const canContinue=message.role==="assistant"&&index===messages.length-1&&message.continuationAvailable===true;const insufficient=walletBalance<(darkLiveMode||darkWebEnabled||webSearchEnabled||selectedModel==="dadgpt-beast"?5:1);return <MessageBubble key={message.id} message={{...message,continuationDisabled:canContinue&&(isSending||insufficient||message.continuationDisabled===true),continuationLabel:canContinue&&insufficient?tr(language,"الرصيد غير كافٍ","Insufficient balance"):message.continuationLabel,leadsMoreDisabled:isSending}} onContinue={canContinue?()=>{void continueMessage(message)}:undefined} onExtractMore={message.leadsData&&message.leadsData.length?()=>{void extractMoreLeads(message)}:undefined}/>;})}
                  {isSending && !hasStartedStreaming && (
                    <div className="typing-row">
                      <div className="message-avatar assistant-avatar">
                        <Sparkles size={15} />
                      </div>
                      <span className="typing-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span>{reportWait ? (reportWaitSecs < 12 ? tr(language, reportWait === "seo" ? "جارٍ فحص الموقع وجمع بيانات SEO..." : reportWait === "leads" ? "جارٍ استخراج بيانات الشركات من خرائط جوجل..." : "جارٍ فحص الموقع وجمع البيانات...", reportWait === "seo" ? "Auditing the site and collecting SEO data..." : reportWait === "leads" ? "Extracting business data from Google Maps..." : "Scanning the site and collecting data...") : reportWaitSecs < 30 ? tr(language, "جارٍ تحليل النتائج...", "Analyzing the results...") : tr(language, "جارٍ كتابة التقرير...", "Writing the report...")) : isThinking ? tr(language, "جارٍ التحليل والتفكير في سؤالك...", "Analyzing your question...") : tr(language, "يجهز الرد...", "Preparing a response...")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {auth.isAuthenticated && walletBalance <= 1 && <div dir={language === "ar" ? "rtl" : "ltr"} role="status" className="mx-auto mb-3 flex w-full max-w-[760px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d4af37]/60 bg-gradient-to-b from-[#3d0505] to-[#1c0000] px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,.45)]"><p className="min-w-0 flex-1 text-sm leading-6 text-[#f5e7c8]">{tr(language, "جرّب HotGPT بـ100 توكن مقابل 100 جنيه — ابدأ بتحليل كودك أو فحص موقعك، والدفع متاح عبر Vodafone Cash وInstaPay.", "Try HotGPT with 100 tokens for 100 EGP — start by analyzing your code or scanning your site, and pay via Vodafone Cash or InstaPay.")}</p><a href="/billing?pack=100" className="shrink-0 rounded-full bg-gradient-to-b from-[#F6C453] via-[#E8A020] to-[#B97A0F] px-5 py-2 text-sm font-black text-[#231300] shadow-[0_8px_22px_rgba(232,160,32,.35)]">{tr(language, "شراء باقة 100 توكن", "Buy the 100-token pack")}</a></div>}
            {approvalNotice && <div dir={language === "ar" ? "rtl" : "ltr"} role="status" className="fixed left-1/2 top-24 z-[70] w-[min(92vw,430px)] -translate-x-1/2 rounded-2xl border border-[#d4af37]/60 bg-gradient-to-b from-[#3d0505] to-[#1c0000] p-4 shadow-[0_18px_50px_rgba(0,0,0,.55)]"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d4af37]/15 text-[#e9c766]"><Coins size={18} /></span><div className="min-w-0 flex-1"><strong className="block text-[15px] text-[#f3d27a]">{tr(language, "تم شحن رصيدك بنجاح", "Your balance was topped up")}</strong><p className="mt-1 text-sm leading-6 text-[#f5e7c8]">{approvalNotice.count > 1 ? tr(language, `تمت الموافقة على ${approvalNotice.count} من طلبات الشحن، وأُضيف مجموع ${approvalNotice.totalTokens.toLocaleString("en-US")} توكين إلى حسابك.`, `${approvalNotice.count} top-up requests were approved — a total of ${approvalNotice.totalTokens.toLocaleString("en-US")} tokens was added to your account.`) : tr(language, `تمت الموافقة على طلب الشحن، وأُضيف ${approvalNotice.totalTokens.toLocaleString("en-US")} توكين إلى حسابك.`, `Your top-up was approved — ${approvalNotice.totalTokens.toLocaleString("en-US")} tokens were added to your account.`)}</p></div><button className="icon-button shrink-0" onClick={() => setApprovalNotice(null)} aria-label={tr(language, "إخفاء التنبيه", "Dismiss notification")}><X size={15} /></button></div></div>}
            {requestError && <div role="alert" className="provider-notice"><div className="notice-icon"><CircleHelp size={16} /></div><div><strong>{tr(language, "تعذر إكمال الطلب", "Could not complete request")}</strong><p>{requestError === "لقد نفذ رصيدك المجاني. اختر باقتك من هنا" ? <>لقد نفذ رصيدك المجاني. اختر باقتك من <a href="/billing" className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200">هنا</a></> : requestError}</p>{(() => { const premiumGate = requestError.includes("Premium") || requestError.includes("HotLucky"); const planGate = requestError.includes("المشتركين في الباقات المدفوعة") || requestError.includes("paid-plan members") || requestError.includes("الوحش PRO") || requestError.includes("الباقات المدفوعة"); if (!premiumGate && !planGate) return null; return (<span className="mt-2 flex flex-wrap gap-x-4 gap-y-1"><a href="/billing" className="inline-flex font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200">{tr(language, "عرض الباقات والاشتراك", "View plans and subscribe")}</a>{premiumGate && <a href="/rewards" className="inline-flex font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200">{tr(language, "صفحة الجوائز", "Rewards page")}</a>}</span>); })()}</div><button className="icon-button" onClick={() => setRequestError(null)} aria-label={tr(language, "إخفاء رسالة الخطأ", "Dismiss error")}><X size={15} /></button></div>}
            <div className="composer-area">
              <div
                className={
                  attachment ? "attachment-chip" : "attachment-chip hidden"
                }
              >
                <FileText size={14} />
                <span>{attachment?.name}</span>
                <button
                  onClick={() => setAttachment(null)}
                  aria-label={tr(language, "إزالة الملف", "Remove file")}
                >
                  <X size={13} />
                </button>
              </div>
              <div className="composer">
                <div className="composer-tools">
                  <label className="composer-icon" aria-label={tr(language, "إرفاق ملف", "Attach file")} title={tr(language, "إرفاق ملف", "Attach file")}>
                    <Paperclip size={18} />
                    <input
                      type="file"
                      hidden
                      onChange={handleFile}
                      accept=".pdf,.txt,.md,.csv,.json"
                    />
                  </label>
                </div>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={leadsMode ? tr(language, "اكتب نوع النشاط والمنطقة… مثال: مطاعم في مدينة نصر", "Type the business type and area… e.g. restaurants in Nasr City") : scanMode ? tr(language, "الصق رابط الموقع هنا (https://example.com)…", "Paste the website URL here (https://example.com)…") : seoMode ? tr(language, "الصق رابط موقعك هنا لفحص SEO (https://example.com)…", "Paste your website URL here for an SEO audit (https://example.com)…") : tr(language, "اكتب رسالتك هنا...", "Message HotGPT...")}
                  rows={1}
                />
                <button
                  className={draft.trim() ? "send-button ready" : "send-button"}
                  onClick={() => void sendMessage()}
                  disabled={(!draft.trim() && !attachment) || isSending}
                  aria-label={tr(language, "إرسال الرسالة", "Send message")}
                >
                  <Send size={17} />
                </button>
                {draft.trim().length >= 12 && !scanMode && !seoMode && !leadsMode && (writingAssist ? (
                  <div className="attachment-cost-note">✨ {tr(language, "محسّن الطلب مفعّل — سيتم تنظيم طلبك قبل الإرسال.", "Prompt enhancer is on — your request will be organized before sending.")} <button type="button" onClick={() => setWritingAssist(false)} style={{ color: "#22d3ee", fontWeight: 700 }}>{tr(language, "إيقاف", "Turn off")}</button></div>
                ) : (
                  <div className="attachment-cost-note"><button type="button" onClick={() => setWritingAssist(true)} style={{ color: "#22d3ee", fontWeight: 700 }}>✨ {tr(language, "حسّن طلبك", "Improve your request")}</button> <span>{tr(language, "— سننظمه ونوضحه قبل الإرسال من غير تغيير معناه.", "— we will organize and clarify it before sending, without changing its meaning.")}</span></div>
                ))}
                <div className="composer-mode-row" role="group" aria-label={tr(language, "أوضاع المحادثة", "Chat modes")}>
                  <button type="button" className={webSearchEnabled ? "composer-mode pro-mode active" : "composer-mode pro-mode"} onClick={() => toggleProMode("search")} aria-pressed={webSearchEnabled} title={tr(language, "البحث المتقدم مفعّل", "Advanced search enabled")}>
                    <Globe size={18} /><span>PRO</span>
                  </button>
                  <button type="button" className={scanMode ? "composer-mode active" : "composer-mode"} onClick={() => { if (scanMode) { setScanMode(false); return; } if (walletBalance < 20) { setRequestError(tr(language, "فحص الروابط خدمة Premium تحتاج رصيد 20 توكن أو أكثر. اشحن من صفحة الباقات أو خد باقة HotLucky.", "URL scanning is a Premium service that needs a balance of 20+ tokens. Top up from Plans or grab the HotLucky pack.")); return; } setRequestError(null); setScanMode(true); setSeoMode(false); setImageMode(false); setLeadsMode(false); setAttachment(null); }} aria-pressed={scanMode} title={tr(language, "فحص رابط — تقرير أمني كامل · 20 توكن", "Scan a URL — full security report · 20 tokens")}>
                    <Radar size={16} /><span>{tr(language, "فحص", "Scan")}</span>
                  </button>
                  <button type="button" className={imageMode ? "composer-mode image-mode active" : "composer-mode image-mode"} onClick={event => { if (imageMode) { setImageMode(false); setImageMenuPos(null); return; } const rect = event.currentTarget.getBoundingClientRect(); setImageMenuPos({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 208)), bottom: window.innerHeight - rect.top + 8 }); }} aria-pressed={imageMode} aria-haspopup="menu" aria-expanded={Boolean(imageMenuPos)} title={tr(language, "توليد صورة", "Generate an image")}>
                    <ImageIcon size={16} /><span>{tr(language, "صورة", "Image")}</span>{imageMode && imageKind === "cgi" && <span style={{ fontSize: 9, fontWeight: 800, color: "#FBBF24", border: "1px solid rgba(251,191,36,.6)", borderRadius: 6, padding: "0 3px", lineHeight: 1.4 }}>CGI</span>}
                  </button>
                  {imageMenuPos && (
                    <>
                      <div onClick={() => setImageMenuPos(null)} style={{ position: "fixed", inset: 0, zIndex: 900 }} />
                      <div role="menu" dir={language === "ar" ? "rtl" : "ltr"} style={{ position: "fixed", left: imageMenuPos.left, bottom: imageMenuPos.bottom, zIndex: 901, minWidth: 200, background: "#1A0505", border: "1px solid rgba(201,162,39,.55)", borderRadius: 12, padding: 6, boxShadow: "0 18px 50px rgba(0,0,0,.55)" }}>
                        <button type="button" role="menuitem" onClick={() => { setImageMenuPos(null); if (walletBalance < 5) { setRequestError(tr(language, "توليد الصورة يحتاج إلى 5 توكينات. رصيدك غير كافٍ؛ اختر باقة مناسبة.", "Image generation costs 5 tokens. Your balance is not enough.")); return; } setRequestError(null); setImageKind("normal"); setImageMode(true); setScanMode(false); setSeoMode(false); setLeadsMode(false); setWebSearchEnabled(false); setDarkWebEnabled(false); setDarkLiveMode(false); setSelectedModel("dadgpt-default"); setAttachment(null); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "start", padding: "9px 10px", borderRadius: 8, color: "#fff", background: "transparent", fontWeight: 700 }}>
                          <ImageIcon size={15} /><span>{tr(language, "صورة عادية", "Normal image")}</span>
                        </button>
                        <button type="button" role="menuitem" onClick={() => { setImageMenuPos(null); if (walletBalance < 10) { setRequestError(tr(language, "رصيدك غير كافٍ لتوليد صورة CGI. اشحن من صفحة الباقات — الأسعار في صفحة النماذج.", "Your balance is not enough for a CGI image. Top up from Plans — prices are on the Models page.")); return; } setRequestError(null); setImageKind("cgi"); setImageMode(true); setScanMode(false); setSeoMode(false); setLeadsMode(false); setWebSearchEnabled(false); setDarkWebEnabled(false); setDarkLiveMode(false); setSelectedModel("dadgpt-default"); setAttachment(null); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "start", padding: "9px 10px", borderRadius: 8, color: "#fff", background: "transparent", fontWeight: 700 }}>
                          <Sparkles size={15} style={{ color: "#FBBF24" }} /><span>{tr(language, "صورة CGI", "CGI image")}</span>
                        </button>
                      </div>
                    </>
                  )}
                  <button type="button" className={selectedModel === "dadgpt-beast" ? "composer-mode pro-mode active beast-mode" : "composer-mode pro-mode beast-mode"} onClick={() => {
                    setImageMode(false); setScanMode(false); setSeoMode(false); setLeadsMode(false);
                    if (selectedModel === "dadgpt-beast") { setSelectedModel("dadgpt-default"); return; }
                    if (!requireProFeature("beast")) return;
                    if (walletBalance < 3) { setRequestError(tr(language, "تحتاج إلى 3 توكينات على الأقل لتشغيل الوحش PRO. تُحسب التكلفة النهائية حسب طول الإجابة وعمقها (3 أو 5 أو 9 توكينات).", "At least 3 tokens are required for الوحش PRO. Final cost depends on answer length and depth (3, 5, or 9 tokens).")); return; }
                    setRequestError(null); setSelectedModel("dadgpt-beast");
                  }} aria-pressed={selectedModel === "dadgpt-beast"} title={tr(language, "الوحش PRO", "الوحش PRO")}>
                    <span>{tr(language, "الوحش", "Beast")}</span><span>PRO</span>
                  </button>
                </div>
                <div className="composer-mode-row" role="group" aria-label={tr(language, "خدمات إضافية", "Additional services")} style={{ marginTop: 6 }}>
                  <button type="button" className={darkWebEnabled ? "composer-mode darkweb-mode active" : "composer-mode darkweb-mode"} onClick={() => toggleProMode("darkweb")} aria-pressed={darkWebEnabled} title="تتبع تسريبات الدارك ويب - Breaches & Ransomware" aria-label="Dark" style={{ color: "#DC2626", ...(darkWebEnabled ? { borderColor: "#DC2626", background: "rgba(220,38,38,.12)", boxShadow: "0 0 10px rgba(220,38,38,.28)" } : {}) }}>
                    <Skull size={16} /><span className="darkweb-mode-label">Dark</span>
                  </button>
                  <button type="button" className={darkLiveMode ? "composer-mode active" : "composer-mode"} onClick={() => { if (darkLiveMode) { setDarkLiveMode(false); return; } if (walletBalance < 20) { setRequestError(tr(language, "دارك لايف خدمة Premium تحتاج رصيد 20 توكن أو أكثر. اشحن من صفحة الباقات أو خد باقة HotLucky.", "Dark Live is a Premium service that needs a balance of 20+ tokens. Top up from Plans or grab the HotLucky pack.")); return; } if (!requireProFeature("darkweb")) return; setRequestError(null); setImageMode(false); setScanMode(false); setSeoMode(false); setLeadsMode(false); setDarkWebEnabled(false); setDarkLiveMode(true); }} aria-pressed={darkLiveMode} title={tr(language, "دارك لايف — بحث حي في فهارس الدارك ويب بنتائج وروابط حقيقية · رسم البحث 5 توكن عند توفر النتائج فقط", "Dark Live — live dark-web index search with real results and links · the 5-token search fee applies only when results are found")} style={{ color: "#FBBF24", ...(darkLiveMode ? { borderColor: "#FBBF24", background: "rgba(251,191,36,.12)", boxShadow: "0 0 10px rgba(251,191,36,.28)" } : {}) }}>
                    <Radio size={16} /><span>{tr(language, "دارك لايف", "Dark Live")}</span>{walletBalance < 20 && <Lock size={12} style={{ opacity: .85 }} />}
                  </button>
                  <button type="button" className={seoMode ? "composer-mode active" : "composer-mode"} onClick={() => { if (seoMode) { setSeoMode(false); return; } if (walletBalance < 20) { setRequestError(tr(language, "فحص SEO خدمة Premium تحتاج رصيد 20 توكن أو أكثر. اشحن من صفحة الباقات أو خد باقة HotLucky.", "SEO auditing is a Premium service that needs a balance of 20+ tokens. Top up from Plans or grab the HotLucky pack.")); return; } setRequestError(null); setSeoMode(true); setScanMode(false); setImageMode(false); setLeadsMode(false); setDarkWebEnabled(false); setDarkLiveMode(false); setAttachment(null); }} aria-pressed={seoMode} title={tr(language, "فحص SEO — تقرير كامل بخطة نمو · 20 توكن", "SEO audit — full report with a growth plan · 20 tokens")} style={{ color: "#22C55E", ...(seoMode ? { borderColor: "#22C55E", background: "rgba(34,197,94,.12)", boxShadow: "0 0 10px rgba(34,197,94,.28)" } : {}) }}>
                    <TrendingUp size={16} /><span>{tr(language, "SEO", "SEO")}</span>{walletBalance < 20 && <Lock size={12} style={{ opacity: .85 }} />}
                  </button>
                  <button type="button" className={leadsMode ? "composer-mode active" : "composer-mode"} onClick={() => { if (leadsMode) { setLeadsMode(false); return; } if (walletBalance < 20) { setRequestError(tr(language, "استخراج العملاء خدمة Premium تحتاج رصيد 20 توكن أو أكثر. اشحن من صفحة الباقات أو خد باقة HotLucky.", "Lead extraction is a Premium service that needs a balance of 20+ tokens. Top up from Plans or grab the HotLucky pack.")); return; } setRequestError(null); setLeadsMode(true); setScanMode(false); setSeoMode(false); setImageMode(false); setDarkWebEnabled(false); setDarkLiveMode(false); setAttachment(null); }} aria-pressed={leadsMode} title={tr(language, "استخراج العملاء — بيانات شركات من خرائط جوجل · 20 توكن", "Lead extraction — business data from Google Maps · 20 tokens")} style={{ color: "#F59E0B", ...(leadsMode ? { borderColor: "#F59E0B", background: "rgba(245,158,11,.12)", boxShadow: "0 0 10px rgba(245,158,11,.28)" } : {}) }}>
                    <Users size={16} /><span style={{ fontSize: 11 }}>{tr(language, "استخراج العملاء", "Extract leads")}</span>{walletBalance < 20 && <Lock size={12} style={{ opacity: .85 }} />}
                  </button>
                </div>
              </div>
              {scanMode && <div className="attachment-cost-note">{tr(language, "🔍 وضع فحص الروابط: الصق رابط الموقع واضغط إرسال — تقرير أمني كامل من بيانات حقيقية مقابل 20 توكن، واسترداد كامل إذا تعذر الفحص. الأداة للأغراض الدفاعية والبحثية فقط على المواقع التي تملكها أو مصرح لك بفحصها.", "🔍 URL scan mode: paste the website URL and press send — a full security report from real collected data for 20 tokens, fully refunded if the scan cannot run. For defensive and research purposes only, on sites you own or are authorized to scan.")}</div>}
              {seoMode && <div className="attachment-cost-note">{tr(language, "📈 وضع فحص SEO: الصق رابط موقعك واضغط إرسال — تقرير SEO كامل بخطة نمو عملية من بيانات حقيقية مقابل 20 توكن، واسترداد كامل إذا تعذر الفحص.", "📈 SEO audit mode: paste your website URL and press send — a full SEO report with a practical growth plan from real collected data for 20 tokens, fully refunded if the audit cannot run.")}</div>}
              {leadsMode && <div className="attachment-cost-note">{tr(language, "📇 وضع استخراج العملاء: اكتب نوع النشاط والمنطقة (مثال: عيادات أسنان في التجمع الخامس) واضغط إرسال — بيانات لحد 30 شركة من خرائط جوجل (الاسم والتليفون والعنوان والموقع والتقييم) مقابل 20 توكن، واسترداد كامل إذا تعذر الاستخراج.", "📇 Lead extraction mode: type the business type and area (e.g. dental clinics in New Cairo) and press send — data for up to 30 businesses from Google Maps (name, phone, address, website, rating) for 20 tokens, fully refunded if the extraction cannot run.")}</div>}
              {(darkWebEnabled || darkLiveMode) && !scanMode && !seoMode && !leadsMode && <div className="attachment-cost-note">{tr(language, "للحصول على أفضل نتيجة يرجى كتابة طلبك باللغه الانجليزية", "For the best result, please write your request in English")}</div>}
              {attachment && <div className="attachment-cost-note">{tr(language, "تحليل الملف يخصم 3 توكينات.", "File analysis costs 3 tokens.")}</div>}
              <div className="composer-footer">
                <span>{tr(language, "Enter للإرسال · Shift + Enter لسطر جديد", "Enter to send · Shift + Enter for a new line")}</span>
                <button
                  className={
                    extended ? "extended-toggle active" : "extended-toggle"
                  }
                  onClick={() => setExtended(value => !value)}
                >
                  <Sparkles size={14} /> {tr(language, "استجابة موسعة", "Extended response")} {extended && <strong className="extended-cost-label">{tr(language, "يستهلك توكن أكتر", "Uses more tokens")}</strong>} 
                  <span className="toggle-track">
                    <span />
                  </span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
      {showWinModal && hotLuckyPrize && auth.isAuthenticated && (
        <div className="welcome-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowWinModal(false); }} style={{zIndex:1200,background:"rgba(0,0,0,.82)",backdropFilter:"blur(7px)"}}>
          <section role="dialog" aria-modal="true" aria-labelledby="hotlucky-win-title" dir={language === "ar" ? "rtl" : "ltr"} style={{position:"relative",width:"min(92vw,460px)",border:"1px solid rgba(247,207,101,.85)",borderRadius:24,padding:"30px 24px",textAlign:"center",color:"#fff",background:"radial-gradient(ellipse at top,rgba(247,207,101,.18),transparent 55%),#0a0a0a",boxShadow:"0 20px 80px rgba(247,207,101,.18)"}}>
            <button type="button" aria-label={tr(language,"إغلاق","Close")} onClick={() => setShowWinModal(false)} style={{position:"absolute",top:12,left:12,width:32,height:32,borderRadius:999,background:"#222",color:"#ddd",border:"1px solid #444",fontSize:20}}>×</button>
            <div aria-hidden="true" style={{fontSize:34,letterSpacing:5,marginBottom:10}}>🎉 ✨ 🎊</div>
            <p style={{color:"#f7cf65",fontSize:11,fontWeight:900,letterSpacing:2}}>HOTLUCKY · WINNER</p>
            <h2 id="hotlucky-win-title" style={{fontSize:25,fontWeight:950,lineHeight:1.5,margin:"12px 0"}}>🎉 مبروك يا بطل!</h2>
            <p style={{fontSize:17,lineHeight:1.9,color:"#f5f5f5"}}>كسبت <strong style={{color:"#f7cf65"}}>{hotLuckyPrize.label}</strong> من HotLucky</p>
            {(/Pro|Ultra/i.test(hotLuckyPrize.label) && hotLuckyPrize.date) && <p style={{fontSize:13,color:"#d5d5d5",marginTop:4}}>ينتهي في {new Date(new Date(hotLuckyPrize.date).getTime() + (/7 أيام|7 ايام/.test(hotLuckyPrize.label) ? 7 : 30) * 86400000).toLocaleDateString("ar-EG",{timeZone:"Africa/Cairo"})}</p>}
            <p style={{marginTop:14,padding:"12px",borderRadius:14,border:"1px solid rgba(247,207,101,.25)",background:"rgba(247,207,101,.06)",color:"#f7cf65",fontSize:15,fontWeight:800}}>رصيدك الآن: {walletBalance.toLocaleString("en-US")} توكن</p>
            <CheapestLine />
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button type="button" onClick={() => { setShowWinModal(false); window.setTimeout(() => { document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(); document.querySelector(".composer")?.scrollIntoView({behavior:"smooth",block:"center"}); },100); }} style={{flex:1,borderRadius:12,padding:"12px 10px",background:"linear-gradient(90deg,#f7cf65,#e8ad28)",color:"#111",fontWeight:900}}>استخدم توكنزك الآن</button>
              <button type="button" onClick={() => { try { localStorage.setItem("hotlucky-win-acknowledged:" + (hotLuckyPrize.code || ""), "1"); } catch {} setShowWinModal(false); }} style={{borderRadius:12,padding:"12px 20px",background:"#292929",border:"1px solid #444",color:"#eee",fontWeight:800}}>شكراً</button>
            </div>
          </section>
        </div>
      )}
      {showAuthGateModal && !auth.loading && !auth.isAuthenticated && (
        <div className="welcome-modal-backdrop visitor-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) { setShowAuthGateModal(false); try { sessionStorage.setItem("hotgpt-visitor-popup-dismissed", "1"); } catch {} } }}>
          <section className="welcome-modal auth-required-modal visitor-modal-card" role="dialog" aria-modal="true" aria-labelledby="visitor-modal-title" dir={language === "ar" ? "rtl" : "ltr"}>
            <button type="button" className="welcome-modal-close" onClick={() => { setShowAuthGateModal(false); try { sessionStorage.setItem("hotgpt-visitor-popup-dismissed", "1"); } catch {} }} aria-label={tr(language, "إغلاق", "Close")}><X size={19} /></button>
            <div className="welcome-modal-brand"><BrandMark compact /></div>
            <p className="welcome-modal-eyebrow">HOTGPT · AI WORKSPACE</p>
            <h2 id="visitor-modal-title">{tr(language, "أهلًا بك في HOT GPT", "Welcome to HOT GPT")}</h2>
            <p className="welcome-modal-lead">{tr(language, "سجّل الدخول أو أنشئ حسابًا للمتابعة.", "Log in or create an account to continue.")}</p>
            <CheapestLine />
            <p style={{ marginTop: 12, textAlign: "center", color: "#FFFFFF", fontSize: 13.5, fontWeight: 800 }}>{tr(language, "✅ التسجيل مجاني — ابدأ بـ 5 توكن هدية ترحيب", "✅ Registration is free — start with 5 welcome tokens")}</p>
            <a href="/auth?mode=login" className="welcome-modal-cta">{tr(language, "تسجيل الدخول", "Log in")}</a>
            <a href="/auth?mode=signup" className="welcome-modal-cta visitor-signup-cta">{tr(language, "إنشاء حساب", "Create account")}</a>
          </section>
        </div>
      )}
      {showFreeUsagePopup && auth.isAuthenticated && (
        <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowFreeUsagePopup(false); }} style={{position:"fixed",inset:0,zIndex:10000,display:"grid",placeItems:"center",padding:20,background:"rgba(0,0,0,.7)"}}>
          <section role="dialog" aria-modal="true" aria-labelledby="free-usage-title" dir={language === "ar" ? "rtl" : "ltr"} style={{position:"relative",width:"min(100%,420px)",padding:"28px 22px 22px",border:"1px solid #C9A227",borderRadius:16,background:"#1A0505",color:"#FFFFFF",boxShadow:"0 24px 80px rgba(0,0,0,.45)",textAlign:"center"}}>
            <button type="button" onClick={() => setShowFreeUsagePopup(false)} aria-label={tr(language,"إغلاق","Close")} style={{position:"absolute",top:10,left:12,color:"#FFFFFF",background:"transparent",fontSize:26,lineHeight:1,padding:4}}>×</button>
            <div style={{fontSize:34,marginBottom:8}}>🌐</div>
            <div style={{fontSize:14,fontWeight:800,color:"#FBBF24",marginBottom:10}}>Free Internet</div>
            <h2 id="free-usage-title" style={{fontSize:21,fontWeight:900,color:"#FBBF24",margin:"0 0 12px"}}>{tr(language,"انتهى استخدامك المجاني","Free usage ended")}</h2>
            <p style={{fontSize:15,lineHeight:1.9,color:"#FFFFFF",margin:"0 0 22px"}}>{tr(language,"للأسف، استخدامك المجاني خلص. بس عندنا مكافآت وهدايا وباقات من أول 100 جنيه.","Sorry, your free usage has ended. But we have rewards, gifts and plans starting from just $2.")}</p>
            <CheapestLine />
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:14}}>
              <a href="/rewards" style={{display:"block",borderRadius:11,padding:"13px 16px",background:"#FBBF24",color:"#1A0505",fontWeight:900,textDecoration:"none"}}>{tr(language,"صفحة الجوائز","Rewards")}</a>
              <a href="/billing" style={{display:"block",borderRadius:11,padding:"13px 16px",background:"#DC2626",color:"#FFFFFF",fontWeight:900,textDecoration:"none"}}>{tr(language,"صفحة الباقات","Plans")}</a>
            </div>
          </section>
        </div>
      )}
      {showWelcomeModal && !auth.loading && auth.isAuthenticated && (
        <div className="welcome-modal-backdrop post-login-welcome-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowWelcomeModal(false); }}>
          <section className="welcome-modal post-login-welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title" dir={language === "ar" ? "rtl" : "ltr"}>
            <button type="button" className="welcome-modal-close" onClick={() => setShowWelcomeModal(false)} aria-label={tr(language, "إغلاق", "Close")}><X size={19} /></button>
            <div className="welcome-modal-brand"><BrandMark compact /></div>
            <p className="welcome-modal-eyebrow">HOTGPT · AI WORKSPACE</p>
            <h2 id="welcome-modal-title">{tr(language, "أهلا بك في الحرية المطلقة HOT GPT", "Welcome to absolute freedom HOT GPT")}</h2>
            {welcomeGiftJustGranted && <p className="welcome-modal-lead">{tr(language, "🎁 ليك 5 توكين هدية وصلت رصيدك — جرّب بيهم أي وضع عندنا، حتى الوحش PRO أو توليد صورة.", "🎁 5 gift tokens just landed in your balance — try any mode with them, even Alwahsh PRO or an image.")}</p>}
            <CheapestLine />
            <div className="post-login-welcome-actions">
              <a href="/rewards" className="post-login-rewards-cta">{tr(language, "🎁 صفحة الجوائز", "🎁 Rewards")}</a>
              <a href="/billing" className="post-login-plans-cta">{tr(language, "💎 صفحة الباقات", "💎 Plans")}</a>
            </div>
          </section>
        </div>
      )}
    </div>
    </LanguageContext.Provider>
  );
}
