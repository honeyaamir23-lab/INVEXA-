import { useState, useRef, useEffect } from "react";
import { Item, StockMove, ChatMessage } from "../types";
import { Send, X, Bot, User, RefreshCw, AlertCircle, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { dbService } from "../db";
import { getLocalFallbackResponse } from "../utils/fallbackChat";

interface ChatBotProps {
  items?: Item[];
  moves?: StockMove[];
  isOnline?: boolean;
}

export default function ChatBot({ items: rawItems = [], moves: rawMoves = [], isOnline = false }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedItems, setSyncedItems] = useState<Item[]>([]);
  const [syncedMoves, setSyncedMoves] = useState<StockMove[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-msg",
      role: "assistant",
      text: "Hello! I am your INVEXA ENTERPRISE FINANCIAL AGENT. I have loaded and verified your real-time store database records. How can I assist with your stock valuations, margin analysis, or auditing today?",
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fabBtnRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageCounterRef = useRef(0);

  // Stable ID generator to avoid Math.random() in React keys
  const generateStableId = () => {
    messageCounterRef.current += 1;
    return `stable-msg-${Date.now()}-${messageCounterRef.current}`;
  };

  // Sync inventory data from DatabaseService every time chat is opened
  const syncInventoryData = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const savedUserStr = localStorage.getItem("store_user");
      if (savedUserStr) {
        const parsedUser = JSON.parse(savedUserStr);
        if (parsedUser && parsedUser.uid) {
          const [latestItems, latestMoves] = await Promise.all([
            dbService.getItems(parsedUser.uid),
            dbService.getStockMoves(parsedUser.uid)
          ]);
          setSyncedItems(latestItems || []);
          setSyncedMoves(latestMoves || []);
          console.log("[ChatBot] Successfully synced with live database. Count:", (latestItems || []).length);
        } else {
          setSyncedItems(Array.isArray(rawItems) ? rawItems : []);
          setSyncedMoves(Array.isArray(rawMoves) ? rawMoves : []);
        }
      } else {
        setSyncedItems(Array.isArray(rawItems) ? rawItems : []);
        setSyncedMoves(Array.isArray(rawMoves) ? rawMoves : []);
      }
    } catch (err: any) {
      console.error("[ChatBot] Failed to run Data-Sync:", err);
      setSyncError("Sync failed. Using local state.");
      setSyncedItems(Array.isArray(rawItems) ? rawItems : []);
      setSyncedMoves(Array.isArray(rawMoves) ? rawMoves : []);
    } finally {
      // Clear visual feedback with minor delay
      await new Promise((resolve) => setTimeout(resolve, 600));
      setIsSyncing(false);
    }
  };

  // Sync when open triggers
  useEffect(() => {
    if (isOpen) {
      syncInventoryData();
    }
  }, [isOpen]);

  // Adjust textarea height with zero visual layout shift
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      if (input === "") {
        textarea.style.height = "36px";
      } else {
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
      }
    }
  }, [input]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isSyncing, isOpen]);

  // Minimize on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isOpen) return;
      if (
        chatContainerRef.current &&
        !chatContainerRef.current.contains(event.target as Node) &&
        fabBtnRef.current &&
        !fabBtnRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading || isSyncing) return;

    setError(null);
    if (!customText) setInput("");

    const userMsg: ChatMessage = {
      id: generateStableId(),
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Execute a stateless relative API call directly
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: updatedMessages,
          inventory: syncedItems, // pass the real-time synced inventory payload
        })
      });

      if (!response.ok) {
        let errorMsg = `Server error (Status: ${response.status})`;
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const resData = await response.json();
      if (!resData || typeof resData.reply !== "string") {
        throw new Error("Invalid API response format received from the enterprise server.");
      }

      const assistantMsg: ChatMessage = {
        id: generateStableId(),
        role: "assistant",
        text: resData.reply,
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn("[ChatBot] Enterprise connection error, falling back to seamless client-side calculations:", err?.message || err);
      
      // Calculate local analytical response instantly inside the client browser!
      const fallbackReply = getLocalFallbackResponse(textToSend, syncedItems);

      const assistantMsg: ChatMessage = {
        id: generateStableId(),
        role: "assistant",
        text: fallbackReply,
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "What is the total valuation & profit margin?",
    "Which products are low in stock?",
    "Give me business growth advice",
  ];

  return (
    <div>
      {/* WhatsApp-Style Premium Floating Button */}
      <motion.button
        id="chatbot-toggle-button"
        ref={fabBtnRef}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-[84px] right-5 h-12 w-12 rounded-full flex items-center justify-center shadow-2xl transition z-50 cursor-pointer border-2 border-white bg-slate-900 hover:bg-slate-800 text-white`}
        title="Ask Invexa Financial Agent"
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={22} className="fill-white/10" />}
        {!isOpen && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center text-[7px] text-white font-extrabold border border-white animate-pulse">
            AI
          </span>
        )}
      </motion.button>

      {/* Slide-over Compact Chat Box */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="chatbot-container"
            ref={chatContainerRef}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-[148px] right-5 left-5 md:left-auto md:w-[340px] bg-white overflow-hidden rounded-2xl shadow-2xl border border-slate-200 h-[430px] flex flex-col z-50"
          >
            {/* Header */}
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold">
                  AI
                </div>
                <div>
                  <h3 className="font-extrabold text-[11px] md:text-xs text-left tracking-tight">INVEXA FINANCIAL EXPERT</h3>
                  <p className="text-[8px] text-emerald-400 font-bold flex items-center gap-1 text-left">
                    <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping shrink-0" />
                    <span>Solid Enterprise Agent</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md cursor-pointer duration-150"
              >
                <X size={16} />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-grow flex flex-col min-h-0 bg-slate-50">
              {isSyncing ? (
                <div className="flex-grow flex flex-col items-center justify-center gap-2 bg-slate-50 text-slate-500">
                  <RefreshCw size={24} className="animate-spin text-emerald-600" />
                  <span className="text-xs font-bold tracking-tight">Syncing Inventory...</span>
                </div>
              ) : (
                <>
                  {/* Messages Feed */}
                  <div
                    ref={scrollRef}
                    className="flex-grow p-3 overflow-y-auto space-y-2.5 text-slate-800"
                  >
                    {messages.map((m) => {
                      const isAssistant = m.role === "assistant" || m.role === "model";
                      return (
                        <div
                          key={m.id}
                          className={`flex gap-2 max-w-[90%] ${
                            isAssistant ? "mr-auto text-left" : "ml-auto flex-row-reverse text-right"
                          }`}
                        >
                          <div
                            className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 shadow-xs border ${
                              isAssistant
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-neutral-800 text-neutral-100 border-neutral-700"
                            }`}
                          >
                            {isAssistant ? <Bot size={11} /> : <User size={11} />}
                          </div>

                          <div className="space-y-0.5">
                            <div
                              className={`p-2.5 rounded-2xl text-[11px] leading-relaxed font-medium ${
                                isAssistant
                                  ? "bg-white text-slate-800 rounded-tl-none border border-slate-200/50 shadow-2xs text-left"
                                  : "bg-emerald-600 text-white rounded-tr-none text-left shadow-2xs"
                              }`}
                              style={{ whiteSpace: "pre-wrap" }}
                            >
                              {m.text}
                            </div>
                            <span className="text-[7px] text-slate-400 block px-1 mt-0.5">
                              {m.timestamp}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {loading && (
                      <div className="flex gap-2 max-w-[80%] mr-auto text-left">
                        <div className="h-6 w-6 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center animate-spin border border-emerald-100">
                          <RefreshCw size={10} />
                        </div>
                        <div className="p-2.5 bg-white text-slate-400 rounded-2xl rounded-tl-none border border-slate-200 text-[11px] shadow-3xs italic">
                          Auditing metrics...
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="p-2.5 bg-rose-50 text-rose-800 rounded-2xl border border-rose-100 text-[11px] flex gap-2 items-start shadow-inner">
                        <AlertCircle size={12} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Error:</span> {error}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Suggestions Drawer */}
                  {messages.length < 3 && !loading && (
                    <div className="px-2 py-1.5 bg-slate-100 overflow-x-auto whitespace-nowrap flex gap-1.5 border-t border-slate-200 shrink-0 scrollbar-none">
                      {suggestions.map((s, index) => (
                        <button
                          key={index}
                          onClick={() => handleSendMessage(s)}
                          className="inline-block py-1 px-2.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-500 rounded-full text-[9px] font-bold duration-150 cursor-pointer shadow-3xs shrink-0"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Footer Input Bar */}
                  <div className="p-2 border-t border-slate-200 bg-white flex items-end gap-2 shrink-0">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      placeholder="Ask about inventory, metrics, reorders..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={loading}
                      style={{ height: "36px" }}
                      className="flex-grow px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded-xl text-[11px] duration-150 text-slate-900 resize-none max-h-[100px] overflow-y-auto scrollbar-none"
                    />
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={loading || !input.trim()}
                      className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg flex items-center justify-center transition duration-150 shrink-0 cursor-pointer shadow-md self-end"
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
