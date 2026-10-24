import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  billingLabel?: string;
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

function MessageBubble({ message }: { message: ChatMessage }) {
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
          {message.billingLabel && <div className="message-billing-note" role="status">{message.billingLabel}</div>}
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
        </div>
      </div>
    </div>
  );
}

function Welcome({ onStarter }: { onStarter: (text: string) => void }) {
  const { language } = useLanguage();
  return (
    <div className="welcome-state hotgpt-welcome">
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
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    typeof window !== "undefined" && localStorage.getItem("hotgpt-theme") === "light" ? "light" : "dark"
  );
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
    localStorage.setItem("hotgpt-theme", theme);
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
        const nextTheme = preferences.theme === "light" ? "light" : "dark";
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
        <section className="settings-card">
          <div className="settings-card-icon purple">{theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}</div>
          <div>
            <h3>{tr(language, "المظهر", "Appearance")}</h3>
            <p>{tr(language, "اختر الوضع الداكن الافتراضي أو الوضع الفاتح.", "Choose the default dark theme or a light theme.")}</p>
            <span className="setting-status">{theme === "dark" ? tr(language, "الوضع الداكن", "Dark mode") : tr(language, "الوضع الفاتح", "Light mode")}</span>
          </div>
          <Button variant="outline" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? tr(language, "تفعيل الفاتح", "Use light") : tr(language, "تفعيل الداكن", "Use dark")}</Button>
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
        const theme = preferences.theme === "light" ? "light" : "dark";
        const style = ["professional", "concise", "friendly", "detailed"].includes(preferences.style) ? preferences.style : "professional";
        const instructions = typeof preferences.instructions === "string" ? preferences.instructions.slice(0, 2000) : "";
        const nextLanguage = preferences.language === "en" ? "en" : "ar";
        localStorage.setItem("hotgpt-theme", theme);
        localStorage.setItem("hotgpt-response-style", style);
        localStorage.setItem("hotgpt-custom-instructions", instructions);
        localStorage.setItem("hotgpt-language", nextLanguage);
        document.documentElement.dataset.theme = theme;
        if (nextLanguage !== language) setLanguage(nextLanguage);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [auth.loading, auth.isAuthenticated, auth.user?.id]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("hotgpt-theme") === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = savedTheme;
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
    setShowWelcomeModal(!auth.isAuthenticated);
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
  const [walletBalance, setWalletBalance] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (auth.loading || !auth.isAuthenticated) { setWalletBalance(0); return; }
    let cancelled = false;
    void authFetch("/api/billing?action=me", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const wallet = await response.json();
      if (!cancelled) setWalletBalance(Number(wallet.tokenBalance) || 0);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [auth.loading, auth.isAuthenticated, auth.user?.id]);

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

  const startNew = () => {
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
          insufficient_credits: attachment ? "تحليل الملفات يحتاج إلى 3 توكينات. رصيدك غير كافٍ؛ اختر باقة مناسبة." : (webSearchEnabled || darkWebEnabled) ? "تبدأ تكلفة البحث والدارك ويب من 3 توكينات، وقد تصل إلى 9 حسب طول الإجابة وعمقها. رصيدك غير كافٍ؛ اختر باقة مناسبة." : selectedModel === "dadgpt-beast" ? "تتراوح تكلفة Beast Pro بين 3 و9 توكينات حسب طول الإجابة وعمقها. اشترِ باقة مناسبة." : "لقد نفذ رصيدك المجاني. اختر باقتك من هنا",
          billing_unavailable: "تعذر التحقق من رصيدك حاليًا. حاول بعد قليل.",
          conversations_unavailable: "تعذر حفظ المحادثة في قاعدة البيانات.",
        };
        throw new Error(errors[payload.error ?? ""] ?? "تعذر الحصول على رد من النموذج. حاول مرة أخرى.");
      }
      if (typeof payload.wallet?.tokenBalance === "number") setWalletBalance(payload.wallet.tokenBalance);
      setMessages(current => streamedAssistantId
        ? current.map(message => message.id === streamedAssistantId
          ? { ...message, content: payload.content!, timestamp: formatTime(), billingLabel: payload.billing ? tr(language, `تم خصم ${payload.billing.cost} توكن - ${payload.billing.labelAr}`, `Deducted ${payload.billing.cost} tokens - ${payload.billing.labelEn}`) : undefined }
          : message)
        : [...current, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: payload.content!,
            timestamp: formatTime(),
            billingLabel: payload.billing ? tr(language, `تم خصم ${payload.billing.cost} توكن - ${payload.billing.labelAr}`, `Deducted ${payload.billing.cost} tokens - ${payload.billing.labelEn}`) : undefined,
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

    // Web search uses live clearnet results; Dark Web mode is a specialist
    // instruction mode and must not imply that those results came from Tor/onion sites.
    if (feature === "search" && !webSearchEnabled && darkWebEnabled) {
      setRequestError(tr(
        language,
        "لا يمكن تفعيل البحث المتقدم مع وضع الدارك ويب في الوقت نفسه. أوقف وضع الدارك ويب أولًا أو ألغِ البحث المتقدم للحصول على إجابة أدق.",
        "Advanced web search cannot be enabled together with Dark Web mode. Turn off Dark Web mode first to avoid mixing clearnet results with Dark Web analysis."
      ));
      return;
    }
    if (feature === "darkweb" && !darkWebEnabled && webSearchEnabled) {
      setRequestError(tr(
        language,
        "لا يمكن تفعيل وضع الدارك ويب مع البحث المتقدم في الوقت نفسه. أوقف البحث المتقدم أولًا لتجنب الخلط بين نتائج الإنترنت العادي وتحليل الدارك ويب.",
        "Dark Web mode cannot be enabled together with Advanced web search. Turn off Advanced web search first to avoid mixing clearnet results with Dark Web analysis."
      ));
      return;
    }

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
    <div className="app-shell" dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
      <div
        className={sidebarOpen ? "mobile-scrim visible" : "mobile-scrim"}
        onClick={() => setSidebarOpen(false)}
      />
      <div className={sidebarOpen ? "sidebar-drawer open" : "sidebar-drawer"}>
        <Sidebar
          conversations={conversations}
          activeId={activeConversation}
          onSelect={id => {
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
                content: String(item.content),
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
            {auth.isAuthenticated && (
              <a href="/billing" className="token-balance" aria-label={tr(language, `الرصيد: ${walletBalance} توكن`, `Balance: ${walletBalance} tokens`)}>
                <Coins size={20} />
                <span>{walletBalance}</span>
              </a>
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
                      <button role="menuitem" className="profile-menu-item profile-menu-logout" onClick={() => { setProfileMenuOpen(false); void auth.logout().catch(() => {}); }}><LogOut size={19} /> <span>{tr(language, "تسجيل الخروج", "Sign out")}</span></button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="auth-entry-actions">
                <a href="/auth?mode=login" className="auth-entry-login">{tr(language, "تسجيل الدخول", "Log in")}</a>
                <a href="/auth?mode=signup" className="auth-entry-signup">{tr(language, "سجل الآن", "Sign up")}</a>
              </div>
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
                  {messages.map(message => (
                    <MessageBubble message={message} key={message.id} />
                  ))}
                  {isSending && webSearchEnabled && (
                    <div className="search-skeleton-grid" aria-label={tr(language, "جارٍ تحميل نتائج البحث", "Loading search results")} aria-live="polite">
                      {Array.from({ length: 3 }, (_, index) => <div className="search-skeleton-card" key={index}><i /><i /><i /></div>)}
                    </div>
                  )}
                  {isSending && (
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
              {(writingAssist || webSearchEnabled || darkWebEnabled || selectedModel === "dadgpt-beast") && (
                <div className="active-mode-notice" role="status" aria-live="polite">
                  <span className="active-mode-indicator" />
                  <span>
                    {[
                      writingAssist ? tr(language, "تم تفعيل محسن الطلب", "Prompt enhancer enabled") : "",
                      webSearchEnabled ? tr(language, "تم تفعيل البحث المتقدم", "Advanced search enabled") : "",
                      darkWebEnabled ? tr(language, "تم تفعيل وضع الدارك ويب", "Dark Web mode enabled") : "",
                      selectedModel === "dadgpt-beast" ? tr(language, "تم تفعيل نموذج Beast Pro", "Beast Pro model enabled") : "",
                    ].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
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
                  <button type="button" className={webSearchEnabled ? "composer-mode pro-mode active" : "composer-mode pro-mode"} onClick={() => toggleProMode("search")} aria-pressed={webSearchEnabled} title={tr(language, "البحث المتقدم — PRO", "Advanced search — PRO")}>
                    <Globe size={18} /><span>PRO</span>
                  </button>
                  <button type="button" className={darkWebEnabled ? "composer-mode active" : "composer-mode"} onClick={() => toggleProMode("darkweb")} aria-pressed={darkWebEnabled} title={tr(language, "وضع الدارك ويب", "Dark Web mode")}>
                    <Shield size={18} /><span className="sr-only">{tr(language, "وضع الدارك ويب", "Dark Web mode")}</span>
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
                  <Sparkles size={14} /> {tr(language, "استجابة موسعة", "Extended response")}{" "}
                  <span className="toggle-track">
                    <span />
                  </span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
      {showAuthGateModal && !auth.loading && !auth.isAuthenticated && (
        <div className="welcome-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowAuthGateModal(false); }}>
          <section className="welcome-modal auth-required-modal" role="dialog" aria-modal="true" aria-labelledby="auth-required-title" dir={language === "ar" ? "rtl" : "ltr"}>
            <button type="button" className="welcome-modal-close" onClick={() => setShowAuthGateModal(false)} aria-label={tr(language, "إغلاق", "Close")}><X size={19} /></button>
            <div className="welcome-modal-brand"><BrandMark compact /></div>
            <p className="welcome-modal-eyebrow">HOTGPT · AI WORKSPACE</p>
            <h2 id="auth-required-title">{tr(language, "يلزم تسجيل الدخول", "Sign in required")}</h2>
            <p className="welcome-modal-lead">{tr(language, "يرجى تسجيل الدخول أو إنشاء حساب للاستفادة من هذه الخاصية ومتابعة محادثاتك.", "Please log in or create an account to use this feature and keep your conversations.")}</p>
            <a href="/auth?mode=login" className="welcome-modal-cta">{tr(language, "تسجيل الدخول", "Log in")}</a>
            <p className="welcome-modal-login">{tr(language, "ليس لديك حساب؟", "Don't have an account?")} <a href="/auth?mode=signup">{tr(language, "إنشاء حساب مجاني", "Create a free account")}</a></p>
          </section>
        </div>
      )}
      {showWelcomeModal && !auth.loading && !auth.isAuthenticated && (
        <div className="welcome-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowWelcomeModal(false); }}>
          <section className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title" dir={language === "ar" ? "rtl" : "ltr"}>
            <button type="button" className="welcome-modal-close" onClick={() => setShowWelcomeModal(false)} aria-label={tr(language, "إغلاق", "Close")}><X size={19} /></button>
            <div className="welcome-modal-brand"><BrandMark compact /></div>
            <p className="welcome-modal-eyebrow">HOTGPT · AI WORKSPACE</p>
            <h2 id="welcome-modal-title">{tr(language, "مرحبًا بك في HotGPT", "Welcome to HotGPT")}</h2>
            <p className="welcome-modal-lead">{tr(language, "حيث الحرية المطلقة وذكاء اصطناعي متقدم.", "Where freedom meets advanced artificial intelligence.")}</p>
            <div className="welcome-modal-features">
              <span>{tr(language, "بحث شامل على الشبكة", "Comprehensive web search")}</span>
              <span>{tr(language, "خبير بعالم الدارك ويب", "Dark web expertise")}</span>
              <span>{tr(language, "أدوات الاختراق والأمن السيبراني", "Cybersecurity and penetration-testing tools")}</span>
            </div>
            <p className="welcome-modal-free">{tr(language, "التسجيل مجاني ويمكنك تجربة نماذجنا المتقدمة.", "Registration is free. Try our advanced models.")}</p>
            <a href="/auth?mode=signup" className="welcome-modal-cta">{tr(language, "سجل الآن", "Sign up now")}</a>
            <p className="welcome-modal-login">{tr(language, "لديك حساب بالفعل؟", "Already have an account?")} <a href="/auth?mode=login">{tr(language, "تسجيل الدخول", "Log in")}</a></p>
          </section>
        </div>
      )}
    </div>
    </LanguageContext.Provider>
  );
}