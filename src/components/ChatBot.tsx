import React, { useState, useRef, useEffect } from "react";
import { Item } from "../types";
import { MessageSquare, X, Send, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ChatBotProps {
  inventory: Item[];
  stockMoves?: any[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  isError?: boolean;
}

const generateId = () => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

export default function ChatBot({ inventory, stockMoves }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      text: "السلام علیکم! میں ولید فوڈز (Waleed Foods) کا سمارٹ انوینٹری اسسٹنٹ ہوں۔ میں سٹاک لیول چیک کرنے، آئٹم کی قیمتیں جاننے اور انوینٹری کی معلومات فراہم کرنے میں آپ کی مدد کر سکتا ہوں۔ میں آپ کی کیا مدد کروں؟",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message to UI
    const newUserMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      text: userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setMessages((prev) => [...prev, newUserMsg]);
    setIsTyping(true);

    try {
      // Gather last 10 messages to keep accurate conversation history/memory
      const recentMessages = [...messages, newUserMsg].slice(-10);

      // Precise JSON payload format including memory and live db context
      const payload = {
        messages: recentMessages.map(m => ({ role: m.role, text: m.text })),
        inventoryContext: JSON.stringify(inventory),
        movesContext: stockMoves ? JSON.stringify(stockMoves) : ""
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("سسٹم عارضی طور پر جواب دینے سے قاصر ہے۔");
      }

      const data = await response.json();

      if (data.status === "error" || !data.reply) {
        throw new Error(data.reply || "سسٹم عارضی طور پر جواب دینے سے قاصر ہے۔");
      }

      // Append backend response on success
      const botReplyMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, botReplyMsg]);

    } catch (err: any) {
      console.error("ChatBot backend connection error:", err);
      const errMsg = err.message || "سسٹم عارضی طور پر جواب دینے سے قاصر ہے۔";
      
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        text: errMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isError: true
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans print:hidden">
      <AnimatePresence>
        {!isOpen ? (
          /* Floating Action Toggle Button */
          <motion.button
            key="chat-toggle"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => setIsOpen(true)}
            id="chatbot-toggle-button"
            className="h-14 w-14 rounded-full bg-[#0A192F] hover:bg-[#112240] text-amber-400 flex items-center justify-center shadow-2xl border border-amber-400/20 cursor-pointer relative group"
            title="Waleed Foods Inventory Assistant"
          >
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
            <MessageSquare size={24} className="group-hover:rotate-6 duration-200" />
          </motion.button>
        ) : (
          /* Chat Window Panel */
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, y: 35, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 280, damping: 25 }}
            className="w-[360px] sm:w-[410px] h-[550px] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
          >
            {/* Header: Waleed Foods Branding */}
            <div className="bg-gradient-to-r from-[#0b0f19] to-[#03070d] text-white p-4 flex items-center justify-between border-b border-amber-400/15 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-amber-500 rounded-xl flex items-center justify-center text-xl shadow-md border border-white/10 shrink-0">
                  🏬
                </div>
                <div>
                  <h3 className="font-display font-black text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span>Waleed Foods Assistant</span>
                    <Sparkles size={11} className="text-amber-300 animate-pulse" />
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-bold">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>سٹاک اسسٹنٹ آن لائن (Online)</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                id="chatbot-close-button"
                className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition cursor-pointer"
                title="Minimize Chat"
              >
                <X size={16} />
              </button>
            </div>

            {/* Message Area */}
            <div 
              id="chatbot-messages"
              className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50"
            >
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"} items-end gap-2`}
                  >
                    {!isUser && (
                      <div className="h-7 w-7 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center text-xs font-bold shrink-0 shadow-xs border border-amber-400/20">
                        W
                      </div>
                    )}
                    <div className="flex flex-col max-w-[80%]">
                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed font-medium shadow-2xs whitespace-pre-line ${
                          isUser
                            ? "bg-[#0A192F] text-amber-400 rounded-br-none border border-amber-400/10 text-right"
                            : msg.isError
                            ? "bg-rose-50 border border-rose-100 text-rose-800 rounded-bl-none flex items-start gap-2 text-left"
                            : "bg-white border border-slate-100 text-slate-800 rounded-bl-none text-left"
                        }`}
                      >
                        {msg.isError && <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />}
                        <span>{msg.text}</span>
                      </div>
                      <span className={`text-[9px] text-slate-400 font-bold font-mono mt-1 ${isUser ? "text-right" : "text-left"}`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Typing/Stock Checking Indicator */}
              {isTyping && (
                <div className="flex justify-start items-end gap-2">
                  <div className="h-7 w-7 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                    W
                  </div>
                  <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-bl-none flex items-center gap-2.5 shadow-2xs">
                    <Loader2 size={13} className="text-emerald-600 animate-spin" />
                    <span className="text-[11px] font-bold text-slate-500 animate-pulse font-mono uppercase tracking-wider">
                      Checking Stock...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="سٹاک کے بارے میں پوچھیں... (e.g. Maida stock)"
                disabled={isTyping}
                id="chatbot-input"
                className="flex-1 h-11 px-4 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl duration-150 text-slate-900 focus:outline-none placeholder:text-slate-400 text-right font-medium"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                id="chatbot-send-button"
                className="h-11 w-11 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-amber-400 disabled:opacity-40 flex items-center justify-center transition shrink-0 cursor-pointer shadow-sm"
                title="Send message"
              >
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
