import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowUp,
  Coins,
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
  Wand,
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
  Lock,
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { authFetch } from "@/lib/auth";

type Language = "ar" | "en";
const LanguageContext = createContext<{ language: Language; toggleLanguage: () => void }>({ language: "ar", toggleLanguage: () => {} });
function useLanguage() { return useContext(LanguageContext); }
function tr(language: Language, ar: string, en: string) { return language === "ar" ? ar : en; }

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  notice?: boolean;
  continuationAvailable?: boolean;
};

type Conversation = {
  id: string;
  title: string;
  preview: string;
  date: string;
};

const starters = [
  { icon: Shield, label: "VULN_SCAN", description: "افحص الكود بحثًا عن الثغرات الأمنية", prompt: "راجع الكود الذي سأرسله بحثًا عن الثغرات الأمنية، واشرح المخاطر وطرق الإصلاح الدفاعية." },
  { icon: Wifi, label: "NET_RECON", description: "تحليل الشبكات والأصول المصرح بفحصها", prompt: "ساعدني في إعداد خطة آمنة لجرد أصول شبكتي المصرح لي بإدارتها والتحقق من إعداداتها." },
  { icon: Cpu, label: "CODE_LAB", description: "تحليل الكود والتعلم العملي", prompt: "ساعدني في تحليل الكود وتحسينه مع شرح الحل خطوة بخطوة." },
  { icon: Lock, label: "CRYPTO_OPS", description: "التشفير والتجزئة وأفضل الممارسات", prompt: "اشرح لي أفضل الممارسات لتطبيق التشفير وتجزئة كلمات المرور بأمان." },
];

const initialConversations: Conversation[] = [];

function formatTime() {
  return new Intl.DateTimeFormat("ar", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

const ANSWER_SIGNOFF = "هل تكتفي بهذه الإجابة؟ أم تريد تحليلًا أعمق؟ HotGPT دائمًا في خدمتك";

function normalizeAssistantContent(content: string) {
  const withoutOldNotice = content
    .replace(/\n*\s*>?\s*توقف التوليد قبل اكتمال الإجابة؛ راجع المحتوى أعلاه قبل استخدامه\.?/g, "")
    .replace(/\n*\s*>?\s*توقف الاتصال قبل اكتمال الإجابة؛ راجع المحتوى أعلاه قبل استخدامه\.?/g, "")
    .trim();
  if (!withoutOldNotice) return "";
  return withoutOldNotice.includes(ANSWER_SIGNOFF)
    ? withoutOldNotice
    : `${withoutOldNotice}\\n\\n---\\n${ANSWER_SIGNOFF}`;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  const { language } = useLanguage();
  return (
    <div className="brand-mark" aria-label={language === "ar" ? "بدون قيود" : "No Limits"}>
      <img
        className="brand-logo-img"
        src={language === "ar" ? "/brand-ar.svg" : "/brand-en.svg"}
        alt={language === "ar" ? "بدون قيود" : "No Limits"}
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
  onNew,
  onSettings,
  onGuide,
  activeView,
  onClose,
  displayName,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onSettings: () => void;
  onGuide: () => void;
  activeView: string;
  onClose?: () => void;
  displayName: string;
}) {
  const { language } = useLanguage();
  const [openConversationMenu, setOpenConversationMenu] = useState<string | null>(null);
  return (
    <aside className="sidebar">
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
          className={activeView === "files" ? "nav-item active" : "nav-item"}
          onClick={onGuide}
        >
          <FolderOpen size={16} /> {tr(language, "الملفات", "Files")}
        </button>
        <button
          className={activeView === "settings" ? "nav-item active" : "nav-item"}
          onClick={onSettings}
        >
          <Settings size={16} /> {tr(language, "الإعدادات", "Settings")}
        </button>
      </nav>

      <div className="conversation-list-wrap">
        <div className="list-heading">
          <span>{tr(language, "الأخيرة", "Recent")}</span>
          <button className="tiny-button" aria-label={tr(language, "خيارات السجل", "History options")}>
            <MoreHorizontal size={15} />
          </button>
        </div>
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
            {tr(language, "مساحة هادئة", "A calmer space")}
            <br />
            <strong>{tr(language, "لأفكار أكبر", "for bigger ideas")}</strong>
          </p>
          <ArrowUp size={13} />
        </div>
        <button className="profile-row">
          <span className="profile-avatar">{displayName.trim().charAt(0).toLocaleUpperCase("ar-EG") || "م"}</span>
          <span>
            <strong>{displayName}</strong>
            <small>{tr(language, "الحساب الشخصي", "Personal account")}</small>
          </span>
          <ChevronDown size={15} />
        </button>
      </div>
    </aside>
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

function MessageBubble({ message, onContinue }: { message: ChatMessage; onContinue?: () => void }) {
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
          {message.role === "assistant" && /## نتائج البحث|## نتائج البحث الموسع/.test(message.content) ? <SearchResultCards content={message.content} language={language} /> : <RenderedMessageContent content={message.content} language={language} />}
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
            <button type="button" className="message-continue-button" onClick={onContinue} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "7px 12px", borderRadius: 10, border: "1px solid #C9A227", background: "rgba(201,162,39,0.10)", color: "#FBBF24", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <ChevronDown size={14} />
              <span>{tr(language, "أكمل الشرح", "Continue explanation")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Welcome({ onStarter }: { onStarter: (text: string) => void }) {
  const { language } = useLanguage();
  const [hotLuckyBannerVisible, setHotLuckyBannerVisible] = useState(false);
  useEffect(() => { try { const until = Number(localStorage.getItem("hotlucky-banner-dismissed-until") || 0); setHotLuckyBannerVisible(Date.now() >= until); } catch { setHotLuckyBannerVisible(true); } }, []);
  const dismissHotLuckyBanner = () => { try { localStorage.setItem("hotlucky-banner-dismissed-until", String(Date.now() + 24 * 60 * 60 * 1000)); } catch {} setHotLuckyBannerVisible(false); };
  return (
    <div className="welcome-state hotgpt-welcome">
      {hotLuckyBannerVisible && (
        <div className="hotlucky-slim-banner" dir={language === "ar" ? "rtl" : "ltr"} role="region" aria-label="HotLucky">
          <button type="button" className="hotlucky-slim-close" onClick={dismissHotLuckyBanner} aria-label={tr(language, "إخفاء العرض لمدة 24 ساعة", "Dismiss for 24 hours")}>×</button>
          <span className="hotlucky-slim-copy">
            <span className="hotlucky-slim-desktop">{tr(language, "🎁 HotLucky — ادفع بعد موافقة الإدارة واستلم كود توكن عشوائي", "🎁 HotLucky — an approved payment unlocks a random token code")}</span>
            <span className="hotlucky-slim-mobile">{tr(language, "🎁 HotLucky — اكسب توكنات بكود عشوائي", "🎁 HotLucky — random token codes after approval")}</span>
          </span>
          <a className="hotlucky-slim-cta" href="/hotlucky">{tr(language, "ادخل لصفحة الجوائز ›", "Prizes ›")}</a>
        </div>
      )}
      <div className="welcome-orbit hotgpt-orbit brand-welcome-orbit" aria-hidden="true">
        <BrandMark compact />
      </div>
      <p className="eyebrow">HOTGPT · AI WORKSPACE</p>
      <h1>Hot<span>GPT</span></h1>
      <p className="welcome-copy">{tr(language, "ماذا يمكنني مساعدتك فيه اليوم؟", "What can I help you with today?")}<br />{tr(language, "مساعدك الذكي للبرمجة والتحليل والأمن الرقمي.", "Your AI assistant for coding, analysis, and digital security.")}</p>
      <div className="starter-grid hotgpt-starter-grid">
        {starters.map(starter => {
          const Icon = starter.icon;
          return (
            <button className="starter-card hotgpt-starter-card" key={starter.label} onClick={() => onStarter(language === "ar" ? starter.prompt : ({ VULN_SCAN: "Review the code I provide for security vulnerabilities, explain the risks, and recommend defensive fixes.", NET_RECON: "Help me safely inventory and verify the configuration of network assets I am authorized to manage.", CODE_LAB: "Help me analyze and improve code, explaining the solution step by step.", CRYPTO_OPS: "Explain best practices for implementing encryption and securely hashing passwords." } as Record<string, string>)[starter.label])}>
              <span className="starter-icon hotgpt-starter-icon"><Icon size={22} /></span>
              <span className="starter-copy">
                <strong>{starter.label}</strong>
                <small>{language === "ar" ? starter.description : ({ VULN_SCAN: "Audit code for vulnerabilities and security flaws.", NET_RECON: "Map authorized networks and assets.", CODE_LAB: "Analyze code and learn hands-on.", CRYPTO_OPS: "Encryption, hashing, and best practices." } as Record<string, string>)[starter.label]}</small>
              </span>
            </button>
          );
        })}
      </div>
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
          <h1>{tr(language, "مساحتك، بطريقتك", "Your space, your way")}</h1>
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
          <h1>{tr(language, "كل ما تحتاجه، في مكان واحد", "Everything you need, in one place")}</h1>
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
    if (ogTitle) ogTitle.content = language === "ar" ? "HotGPT — بدون قيود" : "HotGPT — No Limits";
    const pageTitle = language === "ar" ? "HotGPT — بدون قيود" : "HotGPT — No Limits";
    document.title = pageTitle;
  }, [language]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
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
    setShowWelcomeModal(false);
    try {
      if (sessionStorage.getItem("hotgpt-visitor-popup-dismissed") !== "1") setShowAuthGateModal(true);
    } catch {
      setShowAuthGateModal(true);
    }
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [extended, setExtended] = useState(false);
  const [writingAssist, setWritingAssist] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [darkWebEnabled, setDarkWebEnabled] = useState(false);
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

  useEffect(() => {
    if (!auth.loading && auth.isAuthenticated && freeAnswersRemaining <= 0 && walletBalance <= 0 && !freePopupSeen) {
      setShowFreeUsagePopup(true);
      setFreePopupSeen(true);
      try { sessionStorage.setItem("hotgpt-free-usage-popup-seen", "1"); } catch {}
    }
  }, [auth.loading, auth.isAuthenticated, freeAnswersRemaining, walletBalance, freePopupSeen]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) { setWalletBalance(0); return; }
    let cancelled = false;
    void authFetch("/api/billing?action=me", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const wallet = await response.json();
      if (!cancelled) {
        const balance = Math.max(0, Number(wallet.tokenBalance) || 0);
        setWalletBalance(balance);
        setFreeAnswersRemaining(Math.max(0, Number(wallet.freeAnswersRemaining) || 0));
        try { localStorage.setItem("hotgpt-token-balance", String(balance)); } catch {}
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [auth.loading, auth.isAuthenticated, auth.user?.id]);

  useEffect(() => {
    try { localStorage.setItem("hotgpt-token-balance", String(Math.max(0, walletBalance))); } catch {}
  }, [walletBalance]);

  useEffect(() => {
    if (auth.loading) return;
    let cancelled = false;
    setActiveConversation(null);
    setMessages([]);
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
        content: item.role === "assistant" ? normalizeAssistantContent(String(item.content)) : String(item.content),
        timestamp: item.createdAt ? new Date(item.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "",
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
  const sendMessage = async (value = draft) => {
    const trimmed = value.trim() || (attachment ? `لخص الملف المرفق "${attachment.name}" واذكر أهم النقاط.` : "");
    if (!trimmed || isSending) return;
    if (auth.isAuthenticated && freeAnswersRemaining <= 0 && walletBalance <= 0) {
      if (!freePopupSeen) {
        setShowFreeUsagePopup(true);
        setFreePopupSeen(true);
        try { sessionStorage.setItem("hotgpt-free-usage-popup-seen", "1"); } catch {}
      }
      setRequestError(null);
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
          mode: darkWebEnabled ? "darkweb" : (webSearchEnabled || selectedModel === "dadgpt-beast") ? "Beast pro" : "default",
          modes: { writingAssist, webSearch: webSearchEnabled, darkWeb: darkWebEnabled },
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
        continuationAvailable?: boolean;
        billing?: { cost: number; tier: string; labelAr: string; labelEn: string } | null;
      };
      let streamedAssistantId: string | null = null;
      if (response.ok && response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
        streamedAssistantId = crypto.randomUUID();
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
                  streamedText = "";
                  setMessages(current => current.map(message => message.id === streamedAssistantId ? { ...message, content: "" } : message));
                } else if (event.type === "delta" && typeof event.content === "string") {
                  setIsSearchingWeb(false);
                  setHasStartedStreaming(true);
                  streamedText += event.content;
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
            payload.content = `${streamedText}\n\n> توقف الاتصال قبل اكتمال الإجابة؛ راجع المحتوى أعلاه قبل استخدامه.`;
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
          insufficient_credits: attachment ? "تحليل الملفات يحتاج إلى 3 توكينات. رصيدك غير كافٍ؛ اختر باقة مناسبة." : webSearchEnabled ? "البحث المتقدم يحتاج إلى 5 توكينات لكل عملية. رصيدك غير كافٍ؛ اختر باقة مناسبة." : darkWebEnabled ? "تبدأ تكلفة الدارك ويب من 3 توكينات، وقد تصل إلى 9 حسب طول الإجابة وعمقها. رصيدك غير كافٍ؛ اختر باقة مناسبة." : selectedModel === "dadgpt-beast" ? "تتراوح تكلفة Beast Pro بين 3 و9 توكينات حسب طول الإجابة وعمقها. اشترِ باقة مناسبة." : "لقد نفذ رصيدك المجاني. اختر باقتك من هنا",
          billing_unavailable: "تعذر التحقق من رصيدك حاليًا. حاول بعد قليل.",
          conversations_unavailable: "تعذر حفظ المحادثة في قاعدة البيانات.",
        };
        throw new Error(errors[payload.error ?? ""] ?? "تعذر الحصول على رد من النموذج. حاول مرة أخرى.");
      }
      if (typeof payload.wallet?.tokenBalance === "number") setWalletBalance(payload.wallet.tokenBalance);
      if (typeof payload.wallet?.freeAnswersRemaining === "number") setFreeAnswersRemaining(Math.max(0, payload.wallet.freeAnswersRemaining));
      const finalAssistantContent = normalizeAssistantContent(payload.content!);
      setMessages(current => streamedAssistantId
        ? current.map(message => message.id === streamedAssistantId
          ? { ...message, content: finalAssistantContent, timestamp: formatTime(), continuationAvailable: payload.continuationAvailable === true }
          : message)
        : [...current, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: finalAssistantContent,
            timestamp: formatTime(),
            continuationAvailable: payload.continuationAvailable === true,
          }]);
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
      setIsSending(false);
    }
  };
  const requireProFeature = (feature: "search" | "darkweb" | "beast") => {
    const featureName = feature === "search"
      ? tr(language, "البحث على الإنترنت", "Internet Search")
      : feature === "darkweb"
        ? tr(language, "وضع الدارك ويب", "Dark Web mode")
        : "Beast Pro";
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
    if (feature === "search") setWebSearchEnabled(value => !value);
    else setDarkWebEnabled(value => !value);
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
    <style>{`.visitor-modal-backdrop,.post-login-welcome-backdrop{background:rgba(0,0,0,.72)!important;backdrop-filter:blur(5px)}.visitor-modal-card,.post-login-welcome-card{background:#000000!important;border:1px solid #555!important;color:#FFFFFF!important}.visitor-modal-card .welcome-modal-close,.post-login-welcome-card .welcome-modal-close{left:12px!important;right:auto!important;color:#FFFFFF!important}.visitor-modal-card .welcome-modal-lead,.post-login-welcome-card .welcome-modal-lead{color:#FFFFFF!important}.visitor-modal-card .welcome-modal-cta{display:block;text-align:center;margin-top:10px}.visitor-modal-card .visitor-signup-cta{background:transparent!important;border:1px solid #C9A227!important;color:#FFFFFF!important}.post-login-welcome-actions{display:flex;flex-direction:column;gap:10px;margin-top:22px}.post-login-welcome-actions a{display:block;border-radius:12px;padding:13px 16px;text-align:center;font-weight:900;text-decoration:none}.post-login-rewards-cta{background:#FBBF24!important;color:#1A0505!important}.post-login-plans-cta{background:#DC2626!important;color:#FFFFFF!important}html[data-theme="blood"] .visitor-modal-card,html[data-theme="blood"] .post-login-welcome-card{background:#1A0505!important;border-color:#C9A227!important;color:#FFFFFF!important}html[data-theme="blood"] .visitor-modal-card .welcome-modal-eyebrow,html[data-theme="blood"] .post-login-welcome-card .welcome-modal-eyebrow,html[data-theme="blood"] .visitor-modal-card h2,html[data-theme="blood"] .post-login-welcome-card h2{color:#FBBF24!important}html[data-theme="blood"] .visitor-modal-card .welcome-modal-close,html[data-theme="blood"] .post-login-welcome-card .welcome-modal-close{background:#2B0000!important;border-color:#C9A227!important;color:#FFFFFF!important}html[data-theme="dark"] .visitor-modal-card .welcome-modal-eyebrow,html[data-theme="dark"] .post-login-welcome-card .welcome-modal-eyebrow,html[data-theme="dark"] .visitor-modal-card h2,html[data-theme="dark"] .post-login-welcome-card h2{color:#FBBF24!important}html[data-theme="dark"] .visitor-modal-card .welcome-modal-close,html[data-theme="dark"] .post-login-welcome-card .welcome-modal-close{background:#111111!important;border-color:#555!important;color:#FFFFFF!important}html[data-theme="dark"] .visitor-modal-card .welcome-modal-cta{background:#DC2626!important;color:#FFFFFF!important}html[data-theme="dark"] .visitor-modal-card .visitor-signup-cta{background:#111111!important;border-color:#C9A227!important;color:#FFFFFF!important}`}</style>
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
.new-chat-button{background:#FF1E2E!important;color:#FFFFFF!important;border:1px solid #FF1E2E!important;box-shadow:0 5px 18px rgba(255,30,46,.18)!important}
.new-chat-button:hover{background:#d91427!important;color:#FFFFFF!important}
.new-chat-shortcut{color:#FFFFFF!important;border-color:rgba(255,255,255,.45)!important}
html[data-theme="dark"] .new-chat-button{background:#222222!important;color:#FFFFFF!important;border-color:#444!important;box-shadow:none!important}
html[data-theme="dark"] .new-chat-button:hover{background:#333!important}
.mobile-menu-button,.mobile-only.icon-button{color:#FFFFFF!important}html[data-theme="blood"] .appearance-theme-option.selected{border-color:#FF1E2E;box-shadow:inset 0 0 0 1px #FF1E2E}html[data-theme="blood"] header{background:#2B0000!important;color:#FFFFFF!important}html[data-theme="dark"] header{background:#000000!important;color:#FFFFFF!important}
.composer-mode-row{display:flex!important;flex-wrap:nowrap!important;gap:6px!important;padding:6px 10px!important;overflow:visible!important}
.composer-mode-row>.composer-mode{flex:1 1 0!important;min-width:0!important;max-width:none!important;padding-inline:4px!important;font-size:12px!important;white-space:nowrap!important;justify-content:center}
.composer-mode.beast-mode{padding-inline:4px!important}.composer-mode.beast-mode>span:first-child{font-size:12px!important}
@media(max-width:520px){.composer-mode-row{flex-wrap:nowrap!important;gap:6px!important;padding:6px 10px!important;overflow:visible!important}.composer-mode-row>.composer-mode{flex:1 1 0!important;min-width:0!important;padding-inline:3px!important;font-size:12px!important}.composer-mode.beast-mode{padding-inline:3px!important}.composer-mode.beast-mode>span:first-child{font-size:12px!important}}`}</style>
      <div className="app-shell" dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
      <style>{`html[data-theme="light"],html[data-theme="light"] body,html[data-theme="light"] #root{background:#2B0000!important;color:#fff!important}html[data-theme="light"] .app-shell,html[data-theme="light"] .main-shell,html[data-theme="light"] .chat-workspace,html[data-theme="light"] main{background:#2B0000!important;color:#fff!important}html[data-theme="light"] .sidebar-drawer,html[data-theme="light"] .sidebar,html[data-theme="light"] .settings-card,html[data-theme="light"] .content-panel,html[data-theme="light"] .composer,html[data-theme="light"] .message-content{background-color:#3D0005!important;color:#fff!important;border-color:#6B1018!important}html[data-theme="light"] h1,html[data-theme="light"] h2,html[data-theme="light"] h3,html[data-theme="light"] p,html[data-theme="light"] label,html[data-theme="light"] small,html[data-theme="light"] strong,html[data-theme="light"] span,html[data-theme="light"] .nav-item,html[data-theme="light"] .conversation-item,html[data-theme="light"] .profile-row,html[data-theme="light"] .setting-status{color:#fff}html[data-theme="light"] input,html[data-theme="light"] textarea,html[data-theme="light"] select{background:#400000!important;color:#fff!important;border-color:#76202A!important}html[data-theme="light"] input::placeholder,html[data-theme="light"] textarea::placeholder{color:#E7BFC3!important}html[data-theme="light"] .new-chat-button,html[data-theme="light"] .send-button.ready,html[data-theme="light"] .hotlucky-slim-cta{background:#FF1E2E!important;color:#fff!important;border-color:#FF1E2E!important}.extended-toggle.active,.extended-toggle.active>svg{color:#22C55E!important}.extended-toggle.active .toggle-track{background:#166534!important}.extended-toggle.active .toggle-track span{background:#22C55E!important}.extended-cost-label{color:#22C55E!important;font-size:10px;white-space:nowrap}.darkweb-mode{padding:6px 12px!important}.composer-mode-row{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;overflow-x:visible!important;gap:8px!important;padding-inline:6px!important;justify-content:flex-start!important}.composer-mode-row>.composer-mode{flex:0 0 auto!important}html[data-theme="light"] .composer-mode{padding-inline:12px!important}`}</style>
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
                content: item.role === "assistant" ? normalizeAssistantContent(String(item.content)) : String(item.content),
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
              <span aria-hidden="true">{language === "ar" ? "🇺🇸" : "🇸🇦"}</span>
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
                onClick={() => { window.location.href = "/auth?mode=login"; }}>W</button>
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
                <Welcome
                  onStarter={text => {
                    setDraft(text);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                />
              ) : (
                <div className="messages-list">
                  {isSearchingWeb && (
                    <div className="search-progress-notice" role="status" aria-live="polite">
                      <Search size={15} />
                      <span>{tr(language, "جاري البحث في أحدث المصادر الموثوقة...", "Searching trusted sources...")}</span>
                    </div>
                  )}
                  {messages.map(message => (
                    <MessageBubble
                      message={message}
                      key={message.id}
                      onContinue={message.role === "assistant" && message.continuationAvailable && !isSending
                        ? () => {
                            setMessages(current => current.map(item => item.id === message.id ? { ...item, continuationAvailable: false } : item));
                            void sendMessage(tr(language, "أكمل الشرح من حيث توقفت دون تكرار ما سبق.", "Continue the explanation from where you stopped without repeating previous content."));
                          }
                        : undefined}
                    />
                  ))}
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
                      <span>{tr(language, "يجهز الرد...", "Preparing a response...")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {requestError && <div role="alert" className="provider-notice"><div className="notice-icon"><CircleHelp size={16} /></div><div><strong>{tr(language, "تعذر إكمال الطلب", "Could not complete request")}</strong><p>{requestError === "لقد نفذ رصيدك المجاني. اختر باقتك من هنا" ? <>لقد نفذ رصيدك المجاني. اختر باقتك من <a href="/billing" className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200">هنا</a></> : requestError}</p>{(requestError.includes("المشتركين في الباقات المدفوعة") || requestError.includes("paid-plan members") || requestError.includes("Beast Pro") || requestError.includes("الباقات المدفوعة")) && <a href="/billing" className="mt-2 inline-flex font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200">{tr(language, "عرض الباقات والاشتراك", "View plans and subscribe")}</a>}</div><button className="icon-button" onClick={() => setRequestError(null)} aria-label={tr(language, "إخفاء رسالة الخطأ", "Dismiss error")}><X size={15} /></button></div>}
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
                  placeholder={tr(language, "اكتب رسالتك هنا...", "Message HotGPT...")}
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
                <div className="composer-mode-row" role="group" aria-label={tr(language, "أوضاع المحادثة", "Chat modes")}>
                  <button type="button" className={writingAssist ? "composer-mode active" : "composer-mode"} onClick={() => setWritingAssist(value => !value)} aria-pressed={writingAssist} title={tr(language, "محسن الطلب", "Prompt enhancer")}>
                    <Wand size={18} /><span className="sr-only">{tr(language, "مساعد الكتابة", "Writing assistant")}</span>
                  </button>
                  <button type="button" className={webSearchEnabled ? "composer-mode pro-mode active" : "composer-mode pro-mode"} onClick={() => toggleProMode("search")} aria-pressed={webSearchEnabled} title={tr(language, "البحث المتقدم مفعّل", "Advanced search enabled")}>
                    <Globe size={18} /><span>PRO</span>
                  </button>
                  <button type="button" className={darkWebEnabled ? "composer-mode darkweb-mode active" : "composer-mode darkweb-mode"} onClick={() => toggleProMode("darkweb")} aria-pressed={darkWebEnabled} title="تتبع تسريبات الدارك ويب - Breaches & Ransomware" aria-label="Dark" style={{ color: "#DC2626", ...(darkWebEnabled ? { borderColor: "#DC2626", background: "rgba(220,38,38,.12)", boxShadow: "0 0 10px rgba(220,38,38,.28)" } : {}) }}>
                    <Skull size={16} /><span className="darkweb-mode-label">Dark</span>
                  </button>
                  <button type="button" className={selectedModel === "dadgpt-beast" ? "composer-mode pro-mode active beast-mode" : "composer-mode pro-mode beast-mode"} onClick={() => {
                    if (selectedModel === "dadgpt-beast") { setSelectedModel("dadgpt-default"); return; }
                    if (!requireProFeature("beast")) return;
                    if (walletBalance < 3) { setRequestError(tr(language, "تحتاج إلى 3 توكينات على الأقل لتشغيل Beast Pro. تُحسب التكلفة النهائية حسب طول الإجابة وعمقها (3 أو 5 أو 9 توكينات).", "At least 3 tokens are required for Beast Pro. Final cost depends on answer length and depth (3, 5, or 9 tokens).")); return; }
                    setRequestError(null); setSelectedModel("dadgpt-beast");
                  }} aria-pressed={selectedModel === "dadgpt-beast"} title={tr(language, "Beast Pro", "Beast Pro")}>
                    <span>Beast</span><span>PRO</span>
                  </button>
                </div>
              </div>
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
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
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