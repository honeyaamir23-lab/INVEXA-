import { useState, useRef, useEffect } from "react";
import { Item, StockMove, ChatMessage } from "../types";
import { Send, Sparkles, X, Bot, User, RefreshCw, AlertCircle, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { dbService } from "../db";

interface ChatBotProps {
  items: Item[];
  moves: StockMove[];
  isOnline: boolean;
}

export default function ChatBot({ items, moves, isOnline }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-msg",
      role: "assistant",
      text: "Hello! I am your INVEXA ASSISTANT. I can instantly analyze your total asset valuation, calculate profit margins, and review high-level trends. How can I assist your business today?",
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

  // Auto-expand textarea vertically as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  // Click outside to minimize popup logic
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isOpen) return;
      
      // If click falls outside both the chatbot pop-up and the toggle FAB button, close the chat
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

  // Generate real-time store context for our Gemini API
  const getContext = () => {
    const list = items.map(
      (i) => `- ${i.name} (SKU: ${i.sku || "N/A"}): ${i.qty} ${i.unit} (Price: Rs ${i.price}, Cost: Rs ${i.costPrice || i.price * 0.8}, Margin: ${(i.price - (i.costPrice || i.price * 0.8))} PKR, category: ${i.category}, supplier: ${i.supplier || "None"}, brand: ${i.brand || "None"}, location: ${i.location || "None"}, expiry: ${i.expiryDate || "None"})`
    ).join("\n");
    const lowStock = items.filter((i) => i.qty > 0 && i.qty <= i.minQty).map((i) => `${i.name} (SKU: ${i.sku || "N/A"})`).join(", ");
    const outOfStock = items.filter((i) => i.qty <= 0).map((i) => i.name).join(", ");
    const totalWorth = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const totalAcquisitionCost = items.reduce((sum, i) => sum + i.qty * (i.costPrice || i.price * 0.8), 0);

    const recentTx = moves
      .slice(0, 4)
      .map((m) => `- ${m.itemName}: ${m.type === "Stock In" ? "+" : "-"}${m.qty} (date: ${m.date}, reason: ${m.reason})`)
      .join("\n");

    return `
Total stock selling valuation: Rs ${totalWorth.toLocaleString("en-US")}
Total stock acquisition cost: Rs ${totalAcquisitionCost.toLocaleString("en-US")}
Total clean estimated markup value: Rs ${(totalWorth - totalAcquisitionCost).toLocaleString("en-US")}
Total registered SKU count: ${items.length}

Current Item Inventory Catalog:
${list || "No active inventory records listed."}

Low Stock Products (needs reorders):
${lowStock || "All products are at safe operating stock thresholds."}

Out of Stock Products (urgent):
${outOfStock || "No products are completely out of stock."}

Recent Activity Logs:
${recentTx || "No stock movements recorded in the ledger recently."}
`;
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    setError(null);
    if (!customText) setInput("");

    // Add user message to stack
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const inventoryContext = getContext();
      
      const baseUrl = dbService.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          inventoryContext,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "The server failed to respond.");
      }

      // Add assistant response
      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        role: "assistant",
        text: data.reply,
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "A connection error occurred. Please verify your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  // Precompiled suggestion pills
  const suggestions = [
    "What is the total valuation & profit margin?",
    "Which products are low in stock?",
    "How can I grow my business profit?",
  ];

  return (
    <div>
      {/* WhatsApp-Style Sleek Floating Circle Button */}
      <motion.button
        id="chatbot-toggle-button"
        ref={fabBtnRef}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-[84px] right-5 h-12 w-12 rounded-full flex items-center justify-center shadow-2xl transition z-50 cursor-pointer border-2 border-white ${
          isOnline ? "bg-[#25D366] hover:bg-[#20ba5a]" : "bg-slate-400 hover:bg-slate-500"
        }`}
        title={isOnline ? "Ask Gemini Assistant" : "Gemini Assistant (Offline)"}
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={22} className="fill-white/10" />}
        {!isOpen && (
          <span className={`absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[7px] text-white font-extrabold border border-white ${
            isOnline ? "bg-amber-500 animate-pulse" : "bg-slate-500"
          }`}>
            {isOnline ? "AI" : "OFF"}
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
            className="fixed bottom-[148px] right-5 left-5 md:left-auto md:w-[330px] bg-white overflow-hidden rounded-2xl shadow-2xl border border-slate-200 h-[410px] flex flex-col z-50"
          >
            {/* Header resembles premium assistant look */}
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 bg-[#25D366] text-white rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold">
                  AI
                </div>
                <div>
                  <h3 className="font-extrabold text-[11px] md:text-xs">INVEXA ASSISTANT</h3>
                  <p className="text-[8px] text-[#25D366] font-semibold flex items-center gap-1">
                    <span className="h-1 w-1 bg-[#25D366] rounded-full animate-ping shrink-0" />
                    <span>Gemini Live Support</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer duration-150"
              >
                <X size={16} />
              </button>
            </div>

            {/* Chat Messages */}
            <div
              ref={scrollRef}
              className="flex-grow p-3 overflow-y-auto space-y-2.5 bg-slate-50 text-slate-800"
            >
              {messages.map((m) => {
                const isAssistant = m.role === "assistant" || m.role === "model";
                return (
                  <div
                    key={m.id}
                    className={`flex gap-2 max-w-[88%] ${
                      isAssistant ? "mr-auto text-left" : "ml-auto flex-row-reverse text-right"
                    }`}
                  >
                    {/* Avatars */}
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 shadow-xs border ${
                        isAssistant ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-neutral-800 text-neutral-100 border-neutral-700"
                      }`}
                    >
                      {isAssistant ? <Bot size={11} /> : <User size={11} />}
                    </div>

                    {/* Chat Bubble */}
                    <div className="space-y-0.5">
                      <div
                        className={`p-2.5 rounded-2xl text-[11px] leading-relaxed font-medium ${
                          isAssistant
                            ? "bg-white text-slate-800 rounded-tl-none border border-slate-200/50 shadow-2xs"
                            : "bg-[#25D366] text-white rounded-tr-none text-left shadow-2xs"
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

              {/* Loader */}
              {loading && (
                <div className="flex gap-2 max-w-[80%] mr-auto text-left">
                  <div className="h-6 w-6 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center animate-spin border border-emerald-100">
                    <RefreshCw size={10} />
                  </div>
                  <div className="p-2.5 bg-white text-slate-400 rounded-2xl rounded-tl-none border border-slate-100 text-[11px] shadow-3xs italic">
                    Analyzing store metrics...
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="p-2.5 bg-rose-50 text-rose-800 rounded-2xl border border-rose-100 text-[11px] flex gap-2 items-start shadow-inner">
                  <AlertCircle size={12} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error:</span> {error}
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions Drawer Pills */}
            {messages.length < 4 && !loading && (
              <div className="px-2.5 py-1.5 bg-slate-50 overflow-x-auto whitespace-nowrap flex gap-1.5 border-t border-slate-100 shrink-0 scrollbar-none">
                {suggestions.map((s, index) => (
                  <button
                    key={index}
                    onClick={() => handleSendMessage(s)}
                    className="inline-block py-1 px-2.5 bg-white hover:bg-emerald-50 text-[#128C7E] border border-slate-200 hover:border-[#25D366] rounded-full text-[9px] font-bold duration-150 cursor-pointer shadow-3xs shrink-0"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Footer Input Bar */}
            {!isOnline ? (
              <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-center gap-1.5 shrink-0 text-slate-500 font-bold text-[10px]">
                <AlertCircle size={12} className="text-amber-500 shrink-0" />
                <span>🔌 AI Chatbot is offline. Reconnect to resume.</span>
              </div>
            ) : (
              <div className="p-2 border-t border-slate-100 bg-white flex items-end gap-2 shrink-0">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder="Ask about inventory, value..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={loading}
                  className="flex-grow px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#25D366] rounded-xl text-[11px] duration-150 text-slate-900 resize-none max-h-[120px] overflow-y-auto scrollbar-none"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={loading || !input.trim()}
                  className="h-8 w-8 bg-[#25D366] hover:bg-[#20ba5a] disabled:opacity-40 text-white rounded-lg flex items-center justify-center transition duration-150 shrink-0 cursor-pointer shadow-md self-end"
                >
                  <Send size={13} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
