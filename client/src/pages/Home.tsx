import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  FolderOpen,
  ImagePlus,
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
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";

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
  { icon: "✦", label: "اكتب لي خطة واضحة لمشروع جديد" },
  { icon: "⌘", label: "حلّل هذا المفهوم بطريقة مبسطة" },
  { icon: "◌", label: "ساعدني في تحسين الكود" },
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
    <div className="brand-mark" aria-label="NexaChat">
      <span className="brand-mark-icon">
        <span />
      </span>
      {!compact && (
        <span className="brand-wordmark">
          Nexa<span>Chat</span>
        </span>
      )}
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
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSettings: () => void;
  onGuide: () => void;
  activeView: string;
  onClose?: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand-row">
          <BrandMark />
          <button
            className="icon-button mobile-only"
            onClick={onClose}
            aria-label="إغلاق القائمة"
          >
            <X size={18} />
          </button>
        </div>
        <Button className="new-chat-button" onClick={onNew}>
          <Plus size={16} /> محادثة جديدة{" "}
          <span className="new-chat-shortcut">N</span>
        </Button>
      </div>

      <div className="sidebar-search">
        <Search size={15} />
        <input
          aria-label="البحث في المحادثات"
          placeholder="البحث في المحادثات"
        />
        <span className="search-shortcut">⌘ K</span>
      </div>

      <nav className="sidebar-nav" aria-label="التنقل الرئيسي">
        <button
          className={activeView === "chat" ? "nav-item active" : "nav-item"}
          onClick={onNew}
        >
          <MessageSquare size={16} /> المحادثات
        </button>
        <button
          className={activeView === "files" ? "nav-item active" : "nav-item"}
          onClick={onGuide}
        >
          <FolderOpen size={16} /> الملفات
        </button>
        <button
          className={activeView === "settings" ? "nav-item active" : "nav-item"}
          onClick={onSettings}
        >
          <Settings size={16} /> الإعدادات
        </button>
      </nav>

      <div className="conversation-list-wrap">
        <div className="list-heading">
          <span>الأخيرة</span>
          <button className="tiny-button" aria-label="خيارات السجل">
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
            مساحة هادئة
            <br />
            <strong>لأفكار أكبر</strong>
          </p>
          <ArrowUp size={13} />
        </div>
        <button className="profile-row">
          <span className="profile-avatar">م</span>
          <span>
            <strong>مستخدم Nexa</strong>
            <small>الحساب الشخصي</small>
          </span>
          <ChevronDown size={15} />
        </button>
      </div>
    </aside>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.notice) {
    return (
      <div className="provider-notice">
        <div className="notice-icon">
          <Sparkles size={16} />
        </div>
        <div>
          <strong>تم استلام رسالتك</strong>
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
        {message.role === "user" ? "م" : <Sparkles size={15} />}
      </div>
      <div className="message-body">
        <div className="message-meta">
          <strong>{message.role === "user" ? "أنت" : "Nexa"}</strong>
          <span>{message.timestamp}</span>
        </div>
        <div className="message-content">
          <Streamdown>{message.content}</Streamdown>
        </div>
      </div>
    </div>
  );
}

function Welcome({ onStarter }: { onStarter: (text: string) => void }) {
  return (
    <div className="welcome-state">
      <div className="welcome-orbit">
        <div className="orbit-ring ring-one" />
        <div className="orbit-ring ring-two" />
        <div className="welcome-glyph">
          <Sparkles size={25} />
        </div>
      </div>
      <p className="eyebrow">NEXA / مساحة العمل</p>
      <h1>
        ما الذي تريد <span>إنجازه</span> اليوم؟
      </h1>
      <p className="welcome-copy">
        مساحتك الذكية للتفكير، الكتابة، وصناعة الخطوة التالية.
      </p>
      <div className="starter-grid">
        {starters.map(starter => (
          <button
            className="starter-card"
            key={starter.label}
            onClick={() => onStarter(starter.label)}
          >
            <span className="starter-icon">{starter.icon}</span>
            <span>{starter.label}</span>
            <ArrowUp size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="settings-panel content-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">الإعدادات</p>
          <h1>مساحتك، بطريقتك</h1>
          <p>تحكم في تفاصيل التجربة التي تناسبك.</p>
        </div>
        <button
          className="icon-button"
          onClick={onBack}
          aria-label="العودة للمحادثة"
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
            <h3>المظهر</h3>
            <p>واجهة داكنة هادئة للقراءة والتركيز لفترة أطول.</p>
            <span className="setting-status">
              <Check size={14} /> الوضع الداكن مفعّل
            </span>
          </div>
          <Button variant="outline">مفعّل</Button>
        </section>
        <section className="settings-card">
          <div className="settings-card-icon cyan">
            <Sparkles size={18} />
          </div>
          <div>
            <h3>اللغة والاتجاه</h3>
            <p>
              العربية هي لغة الواجهة الأساسية مع دعم كامل للكتابة من اليمين.
            </p>
            <span className="setting-status">
              <Check size={14} /> العربية · RTL
            </span>
          </div>
          <Button variant="outline">العربية</Button>
        </section>
        <section className="settings-card">
          <div className="settings-card-icon lime">
            <Check size={18} />
          </div>
          <div>
            <h3>تجربة الكتابة</h3>
            <p>اختصارات بسيطة تجعل الانتقال من الفكرة إلى الرسالة أسرع.</p>
            <span className="setting-status">
              Enter للإرسال · Shift + Enter لسطر جديد
            </span>
          </div>
          <Button variant="outline">تعديل</Button>
        </section>
      </div>
      <div className="settings-quote">
        <Sparkles size={17} />
        <span>
          صممت NexaChat لتبقى الفكرة في المقدمة، وكل ما عداها في الخلفية.
        </span>
      </div>
    </div>
  );
}

function GuidePanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="content-panel guide-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">الملفات</p>
          <h1>كل ما تحتاجه، في مكان واحد</h1>
          <p>احتفظ بالمراجع والمستندات التي تعمل عليها بجوار محادثاتك.</p>
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
        <h3>أضف أول ملف لك</h3>
        <p>اسحب مستنداتك إلى هنا أو اخترها من جهازك.</p>
        <Button variant="outline">
          <Paperclip size={15} /> اختيار ملف
        </Button>
      </div>
    </div>
  );
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [activeConversation, setActiveConversation] = useState<string | null>(
    null
  );
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [isRestored, setIsRestored] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [extended, setExtended] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("hotgpt.chat.v1");
      if (saved) {
        const data = JSON.parse(saved) as {
          conversations?: Conversation[];
          messagesByConversation?: Record<string, ChatMessage[]>;
          activeConversation?: string | null;
        };
        const restoredConversations = Array.isArray(data.conversations) ? data.conversations : [];
        setConversations(restoredConversations);
        const activeId = data.activeConversation && restoredConversations.some(item => item.id === data.activeConversation)
          ? data.activeConversation
          : null;
        setActiveConversation(activeId);
        setMessages(activeId ? data.messagesByConversation?.[activeId] ?? [] : []);
      }
    } catch {
      localStorage.removeItem("hotgpt.chat.v1");
    } finally {
      setIsRestored(true);
      textareaRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!isRestored) return;
    try {
      const saved = localStorage.getItem("hotgpt.chat.v1");
      const data = saved ? JSON.parse(saved) as { messagesByConversation?: Record<string, ChatMessage[]> } : {};
      const messagesByConversation = data.messagesByConversation ?? {};
      if (activeConversation) messagesByConversation[activeConversation] = messages;
      localStorage.setItem("hotgpt.chat.v1", JSON.stringify({
        conversations,
        messagesByConversation,
        activeConversation,
      }));
    } catch {
      setRequestError("تعذر حفظ سجل المحادثات في هذا المتصفح. تحقق من مساحة التخزين المتاحة.");
    }
  }, [isRestored, conversations, messages, activeConversation]);

  const title = useMemo(
    () =>
      activeConversation
        ? (conversations.find(item => item.id === activeConversation)?.title ??
          "محادثة جديدة")
        : "محادثة جديدة",
    [activeConversation, conversations]
  );
  const startNew = () => {
    setActiveConversation(null);
    setMessages([]);
    setDraft("");
    setActiveView("chat");
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };
  const sendMessage = async (value = draft) => {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;

    setActiveView("chat");
    setDraft("");
    setRequestError(null);
    setIsSending(true);

    const conversationId = activeConversation ?? crypto.randomUUID();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: formatTime(),
    };
    const requestMessages = [...messages, userMessage].map(message => ({
      role: message.role,
      content: message.content,
    }));

    setActiveConversation(conversationId);
    setMessages([...messages, userMessage]);
    if (!activeConversation) {
      setConversations(current => [{
        id: conversationId,
        title: trimmed.slice(0, 28),
        preview: trimmed.slice(0, 32),
        date: "الآن",
      }, ...current]);
    } else {
      setConversations(current => current.map(item => item.id === conversationId
        ? { ...item, preview: trimmed.slice(0, 32), date: "الآن" }
        : item));
    }

    try {
      const response = await fetch("/api/model/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages, extended }),
        signal: AbortSignal.timeout(65000),
      });
      const payload = await response.json().catch(() => ({})) as {
        content?: string;
        error?: string;
      };
      if (!response.ok || typeof payload.content !== "string" || !payload.content.trim()) {
        const errors: Record<string, string> = {
          provider_not_configured: "لم يتم إعداد مزود الذكاء الاصطناعي على الخادم بعد. أضف إعدادات النموذج في Vercel.",
          messages_required: "الرسالة فارغة أو غير صالحة.",
          invalid_messages: "تعذر إرسال المحادثة بسبب تنسيق الرسائل.",
          rate_limited: "تم إرسال طلبات كثيرة خلال وقت قصير. انتظر دقيقة ثم حاول مجددًا.",
          provider_timeout: "استغرق النموذج وقتًا أطول من المتوقع. حاول مرة أخرى.",
          provider_request_failed: "تعذر الاتصال بالنموذج حاليًا. حاول مرة أخرى بعد قليل.",
        };
        throw new Error(errors[payload.error ?? ""] ?? "تعذر الحصول على رد من النموذج. حاول مرة أخرى.");
      }
      setMessages(current => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.content!,
        timestamp: formatTime(),
      }]);
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
    if (file) setAttachment(file.name);
  };

  return (
    <div className="app-shell" dir="rtl">
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
            try {
              const saved = localStorage.getItem("hotgpt.chat.v1");
              const data = saved ? JSON.parse(saved) as { messagesByConversation?: Record<string, ChatMessage[]> } : {};
              setMessages(data.messagesByConversation?.[id] ?? []);
            } catch {
              setMessages([]);
            }
            setRequestError(null);
            setActiveView("chat");
            setSidebarOpen(false);
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
        />
      </div>
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu size={19} />
            </button>
            <div>
              <span className="topbar-kicker">
                مساحة العمل /{" "}
                {activeView === "chat"
                  ? "المحادثات"
                  : activeView === "settings"
                    ? "الإعدادات"
                    : "الملفات"}
              </span>
              <h2>
                {activeView === "chat"
                  ? title
                  : activeView === "settings"
                    ? "الإعدادات"
                    : "الملفات"}
              </h2>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="الإشعارات">
              <Bell size={17} />
            </button>
            <button className="icon-button" aria-label="المساعدة">
              <CircleHelp size={17} />
            </button>
            <button className="topbar-avatar" aria-label="الحساب الشخصي">
              م
            </button>
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
                      <span>يجهز الرد...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {requestError && <div role="alert" className="provider-notice"><div className="notice-icon"><CircleHelp size={16} /></div><div><strong>تعذر إكمال الطلب</strong><p>{requestError}</p></div><button className="icon-button" onClick={() => setRequestError(null)} aria-label="إخفاء رسالة الخطأ"><X size={15} /></button></div>}
            <div className="composer-area">
              <div
                className={
                  attachment ? "attachment-chip" : "attachment-chip hidden"
                }
              >
                <FileText size={14} />
                <span>{attachment}</span>
                <button
                  onClick={() => setAttachment(null)}
                  aria-label="إزالة الملف"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="composer">
                <div className="composer-tools">
                  <label className="composer-icon" aria-label="إرفاق ملف">
                    <Paperclip size={18} />
                    <input
                      type="file"
                      hidden
                      onChange={handleFile}
                      accept=".pdf,.txt,.md,.csv"
                    />
                  </label>
                  <button className="composer-icon" aria-label="توليد صورة">
                    <ImagePlus size={18} />
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب رسالتك هنا..."
                  rows={1}
                />
                <button
                  className={draft.trim() ? "send-button ready" : "send-button"}
                  onClick={() => void sendMessage()}
                  disabled={!draft.trim() || isSending}
                  aria-label="إرسال الرسالة"
                >
                  <Send size={17} />
                </button>
              </div>
              <div className="composer-footer">
                <span>Enter للإرسال · Shift + Enter لسطر جديد</span>
                <button
                  className={
                    extended ? "extended-toggle active" : "extended-toggle"
                  }
                  onClick={() => setExtended(value => !value)}
                >
                  <Sparkles size={14} /> استجابة موسعة{" "}
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
  );
}
