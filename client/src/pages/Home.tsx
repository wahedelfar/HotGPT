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
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Upload,
  Terminal,
  Shield,
  Wifi,
  Cpu,
  Lock,
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
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
  return (
    <div className="brand-mark" aria-label="HotGPT">
      <span className="brand-mark-icon">
        <Terminal size={compact ? 15 : 17} />
      </span>
      {!compact && <span className="brand-wordmark">Hot<span>GPT</span></span>}
    </div>
  );
}

function Sidebar({
  conversations,
  activeId,
  onSelect,
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
  onNew: () => void;
  onSettings: () => void;
  onGuide: () => void;
  activeView: string;
  onClose?: () => void;
  displayName: string;
}) {
  const { language } = useLanguage();
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
            <button
              key={conversation.id}
              className={
                activeId === conversation.id
                  ? "conversation-item selected"
                  : "conversation-item"
              }
              onClick={() => onSelect(conversation.id)}
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);
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
        <div className="message-content">
          <Streamdown>{message.content}</Streamdown>
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
      <div className="welcome-orbit hotgpt-orbit">
        <div className="welcome-glyph hotgpt-glyph"><Terminal size={29} /></div>
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
  const { language } = useLanguage();
  return (
    <div className="settings-panel content-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{tr(language, "الإعدادات", "Settings")}</p>
          <h1>{tr(language, "مساحتك، بطريقتك", "Your space, your way")}</h1>
          <p>{tr(language, "تحكم في تفاصيل التجربة التي تناسبك.", "Customize the experience to fit you.")}</p>
        </div>
        <button
          className="icon-button"
          onClick={onBack}
          aria-label={tr(language, "العودة للمحادثة", "Back to chat")}
        >
          <X size={18} />
        </button>
      </div>
      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-icon purple">
            <Moon size={18} />
          </div>
          <div>
            <h3>{tr(language, "المظهر", "Appearance")}</h3>
            <p>{tr(language, "واجهة داكنة هادئة للقراءة والتركيز لفترة أطول.", "A calm dark interface for reading and focus.")}</p>
            <span className="setting-status">
              <Check size={14} /> {tr(language, "الوضع الداكن مفعّل", "Dark mode enabled")}
            </span>
          </div>
          <Button variant="outline">{tr(language, "مفعّل", "Enabled")}</Button>
        </section>
        <section className="settings-card">
          <div className="settings-card-icon cyan">
            <Sparkles size={18} />
          </div>
          <div>
            <h3>{tr(language, "اللغة والاتجاه", "Language & direction")}</h3>
            <p>
              {tr(language, "العربية هي لغة الواجهة الأساسية مع دعم كامل للكتابة من اليمين.", "Switch between Arabic RTL and English LTR across the interface.")}
            </p>
            <span className="setting-status">
              <Check size={14} /> {language === "ar" ? "العربية · RTL" : "English · LTR"}
            </span>
          </div>
          <Button variant="outline">{language === "ar" ? "العربية" : "English"}</Button>
        </section>
        <section className="settings-card">
          <div className="settings-card-icon lime">
            <Check size={18} />
          </div>
          <div>
            <h3>{tr(language, "تجربة الكتابة", "Writing experience")}</h3>
            <p>{tr(language, "اختصارات بسيطة تجعل الانتقال من الفكرة إلى الرسالة أسرع.", "Simple shortcuts help you turn ideas into messages faster.")}</p>
            <span className="setting-status">
              {tr(language, "Enter للإرسال · Shift + Enter لسطر جديد", "Enter to send · Shift + Enter for a new line")}
            </span>
          </div>
          <Button variant="outline">{tr(language, "تعديل", "Edit")}</Button>
        </section>
      </div>
      <div className="settings-quote">
        <Sparkles size={17} />
        <span>
          {tr(language, "صممت HotGPT لتبقى الفكرة في المقدمة، وكل ما عداها في الخلفية.", "HotGPT keeps your ideas in focus and everything else in the background.")}
        </span>
      </div>
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
    localStorage.setItem("hotgpt-language", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [activeConversation, setActiveConversation] = useState<string | null>(
    null
  );
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [extended, setExtended] = useState(false);
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

      const requestMessages = [...messages, userMessage].slice(-40).map(message => ({
        role: message.role,
        content: message.content,
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
        body: JSON.stringify({ messages: requestMessages, extended, model: selectedModel, requestId: crypto.randomUUID(), conversationId, attachment: filePayload }),
        signal: AbortSignal.timeout(65000),
      });
      const payload = await response.json().catch(() => ({})) as {
        content?: string;
        error?: string;
        wallet?: { tokenBalance?: number } | null;
      };
      if (!response.ok || typeof payload.content !== "string" || !payload.content.trim()) {
        const errors: Record<string, string> = {
          provider_not_configured: "لم يتم إعداد مزود الذكاء الاصطناعي على الخادم بعد. أضف إعدادات النموذج في Vercel.",
          messages_required: "الرسالة فارغة أو غير صالحة.",
          invalid_messages: "تعذر إرسال المحادثة بسبب تنسيق الرسائل.",
          invalid_conversation_id: "المحادثة غير صالحة. أنشئ محادثة جديدة وحاول مرة أخرى.",
          rate_limited: "تم إرسال طلبات كثيرة خلال وقت قصير. انتظر دقيقة ثم حاول مجددًا.",
          provider_timeout: "استغرق النموذج وقتًا أطول من المتوقع. حاول مرة أخرى.",
          provider_request_failed: "تعذر الاتصال بالنموذج حاليًا. حاول مرة أخرى بعد قليل.",
          invalid_attachment: "تعذر إرسال الملف. تأكد أن حجمه لا يتجاوز 10 ميجابايت.",
          unsupported_attachment: "نوع الملف غير مدعوم. استخدم PDF أو TXT أو MD أو CSV أو JSON.",
          file_too_large: "حجم الملف يجب ألا يتجاوز 10 ميجابايت.", upload_unavailable: "تعذر رفع الملف إلى التخزين. حاول مرة أخرى.",
          attachment_read_failed: "تعذر قراءة الملف. جرّب حفظه مرة أخرى ثم ارفعه.",
          attachment_no_text: "لم أتمكن من استخراج نص من الملف. إذا كان PDF ممسوحًا ضوئيًا كصورة، فسيحتاج إلى OCR.",
          login_required: "انتهت جلسة الدخول. سجّل الدخول ثم حاول مجددًا.",
          insufficient_credits: attachment ? "تحليل الملفات يحتاج إلى 3 توكينات. رصيدك غير كافٍ؛ اختر باقة مناسبة." : selectedModel === "dadgpt-beast" ? "نموذج Beast يحتاج إلى توكينين مدفوعين على الأقل. اشترِ باقة أو اختر Default." : "لقد نفذ رصيدك المجاني. اختر باقتك من هنا",
          billing_unavailable: "تعذر التحقق من رصيدك حاليًا. حاول بعد قليل.",
          conversations_unavailable: "تعذر حفظ المحادثة في قاعدة البيانات.",
        };
        throw new Error(errors[payload.error ?? ""] ?? "تعذر الحصول على رد من النموذج. حاول مرة أخرى.");
      }
      if (typeof payload.wallet?.tokenBalance === "number") setWalletBalance(payload.wallet.tokenBalance);
      setMessages(current => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.content!,
        timestamp: formatTime(),
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
            <a href="/billing" className="token-balance" aria-label={tr(language, `الرصيد: ${walletBalance} توكن`, `Balance: ${walletBalance} tokens`)}>
              <Coins size={20} />
              <span>{walletBalance}</span>
            </a>
            <button className="language-button" type="button" onClick={toggleLanguage} aria-label={tr(language, "التبديل إلى الإنجليزية", "Switch to Arabic")} title={tr(language, "English", "العربية")}>
              <span aria-hidden="true">{language === "ar" ? "🇺🇸" : "🇸🇦"}</span>
            </button>
            <div className="profile-menu-wrap">
              <button
                className="topbar-avatar profile-menu-trigger"
                aria-label={tr(language, "الحساب الشخصي", "Account menu")}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                title={auth.user?.name || auth.user?.email || tr(language, "الحساب الشخصي", "Account menu")}
                onClick={() => auth.isAuthenticated ? setProfileMenuOpen(open => !open) : startLogin()}
              >
                {(auth.user?.name || auth.user?.email || "مستخدم HotGPT").trim().charAt(0).toLocaleUpperCase("ar-EG") || "م"}
              </button>
              {profileMenuOpen && auth.isAuthenticated && (
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
            {requestError && <div role="alert" className="provider-notice"><div className="notice-icon"><CircleHelp size={16} /></div><div><strong>{tr(language, "تعذر إكمال الطلب", "Could not complete request")}</strong><p>{requestError === "لقد نفذ رصيدك المجاني. اختر باقتك من هنا" ? <>لقد نفذ رصيدك المجاني. اختر باقتك من <a href="/billing" className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200">هنا</a></> : requestError}</p></div><button className="icon-button" onClick={() => setRequestError(null)} aria-label={tr(language, "إخفاء رسالة الخطأ", "Dismiss error")}><X size={15} /></button></div>}
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
                  <label className="composer-icon" aria-label={tr(language, "إرفاق ملف", "Attach file")}>
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
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2 px-1 text-xs text-slate-400">
                <label htmlFor="hotgpt-model">{tr(language, "النموذج", "Model")}</label>
                <select id="hotgpt-model" value={selectedModel} onChange={event => setSelectedModel(event.target.value as "dadgpt-default" | "dadgpt-beast")} className="rounded-lg border border-white/10 bg-[#101722] px-3 py-2 text-sm text-white outline-none focus:border-cyan-300">
                  <option value="dadgpt-default">Default — {tr(language, "مجاني", "Free")}</option>
                  <option value="dadgpt-beast" disabled={walletBalance < 2}>Beast — {tr(language, "مدفوع", "Paid")}</option>
                </select>
                {selectedModel === "dadgpt-beast" && <span>{tr(language, "ميزة مدفوعة: يُخصم توكينان لكل إجابة ناجحة.", "Paid feature: 2 tokens are charged per successful answer.")}</span>}
                {attachment && <span>{tr(language, "تحليل الملف يخصم 3 توكينات.", "File analysis costs 3 tokens.")}</span>}
              </div>
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
    </div>
    </LanguageContext.Provider>
  );
}
