import { useState, useRef, useEffect, useCallback, memo } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import ninaAvatar from "@/assets/nina-avatar.png";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  accessToken: string;
  courseId: string;
  activeLessonId?: string;
  studentName: string;
  lang?: "pt" | "en";
}

const NinaChatWidget = memo(function NinaChatWidget({ accessToken, courseId, activeLessonId, studentName, lang = "pt" }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = lang === "en" ? {
    placeholder: "Ask Nina anything...",
    greeting: `Hey ${studentName}! 👋 I'm Nina 🐆, your mentor. Ask me anything about the course!`,
    errorMsg: "Oops, something went wrong. Try again!",
    title: "Nina 🐆",
    subtitle: "Your AI Mentor",
  } : {
    placeholder: "Pergunte qualquer coisa para a Nina...",
    greeting: `Oi ${studentName}! 👋 Sou a Nina 🐆, sua mentora. Me pergunte qualquer coisa sobre o curso!`,
    errorMsg: "Ops, algo deu errado. Tente novamente!",
    title: "Nina 🐆",
    subtitle: "Sua Mentora IA",
  };

  useEffect(() => {
    if (open && !hasGreeted) {
      setMessages([{ role: "assistant", content: t.greeting }]);
      setHasGreeted(true);
    }
  }, [open, hasGreeted, t.greeting]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("nina-chat", {
        body: {
          message: text,
          conversation_history: newMessages.filter(m => m !== newMessages[0] || m.role === "user"),
          course_id: courseId,
          lesson_id: activeLessonId,
          access_token: accessToken,
        },
      });

      if (error || !data?.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: t.errorMsg }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: t.errorMsg }]);
    }
    setLoading(false);
  }, [input, loading, messages, courseId, activeLessonId, accessToken]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105 overflow-hidden border-2"
            style={{
              borderColor: "hsl(220,15%,20%)",
              boxShadow: "0 2px 12px hsla(0,0%,0%,0.3)",
            }}
          >
            <img src={ninaAvatar} alt="Nina" className="w-full h-full object-cover" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border overflow-hidden flex flex-col"
            style={{
              background: "hsl(220 18% 10%)",
              borderColor: "hsl(220 15% 16%)",
              height: "min(520px, calc(100vh - 6rem))",
              boxShadow: "0 8px 40px hsla(0,0%,0%,0.5)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "hsl(220 15% 14%)", background: "hsl(220 18% 8%)" }}>
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: "hsl(145,65%,42%)" }}>
                <img src={ninaAvatar} alt="Nina" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm leading-tight">{t.title}</p>
                <p className="text-[10px]" style={{ color: "hsl(145,65%,50%)" }}>{t.subtitle}</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[hsl(220,16%,18%)]">
                <X className="w-4 h-4" style={{ color: "hsl(0,0%,50%)" }} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(220,15%,20%) transparent" }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user" ? "rounded-br-md" : "rounded-bl-md"
                    }`}
                    style={{
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, hsl(145,65%,42%), hsl(160,70%,36%))"
                        : "hsl(220 18% 14%)",
                      color: msg.role === "user" ? "white" : "hsl(0,0%,85%)",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-md" style={{ background: "hsl(220 18% 14%)" }}>
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "hsl(145,65%,42%)", animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "hsl(145,65%,42%)", animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "hsl(145,65%,42%)", animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t" style={{ borderColor: "hsl(220 15% 14%)", background: "hsl(220 18% 8%)" }}>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "hsl(220 18% 14%)" }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.placeholder}
                  disabled={loading}
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[hsl(220,10%,40%)]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                  style={{ backgroundImage: "linear-gradient(135deg, hsl(145,65%,42%), hsl(160,70%,36%))" }}
                >
                  {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export default NinaChatWidget;
