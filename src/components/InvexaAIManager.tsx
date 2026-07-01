import { useState, useEffect, useRef } from "react";
import { Item, StockMove, LocalUser } from "../types";
import { 
  Bot, 
  Cpu, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  DollarSign, 
  UserCheck, 
  RefreshCw, 
  Play, 
  Send, 
  Sparkles, 
  ShieldAlert, 
  Printer, 
  CheckCircle, 
  Shield, 
  AlertCircle,
  Folder,
  ChevronDown 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InvexaAIManagerProps {
  items: Item[];
  stockMoves: StockMove[];
  user: LocalUser;
}

// Simple lightweight high-fidelity markdown converter
function MarkdownText({ text }: { text: string }) {
  if (!text) return null;
  
  const lines = text.split("\n");
  
  return (
    <div className="space-y-2 text-slate-700 leading-relaxed font-sans text-sm">
      {lines.map((line, idx) => {
        let cleanLine = line.trim();
        
        // Horizontal rule
        if (cleanLine === "---") {
          return <hr key={idx} className="my-4 border-slate-200" />;
        }
        
        // Headers
        if (cleanLine.startsWith("###")) {
          const content = cleanLine.replace(/^###\s*/, "");
          return <h4 key={idx} className="text-base font-extrabold text-slate-900 mt-4 mb-2 flex items-center gap-2 border-b border-slate-100 pb-1">{content}</h4>;
        }
        if (cleanLine.startsWith("####")) {
          const content = cleanLine.replace(/^####\s*/, "");
          return <h5 key={idx} className="text-sm font-bold text-slate-800 mt-3 mb-1">{content}</h5>;
        }
        if (cleanLine.startsWith("**") && cleanLine.endsWith("**")) {
          const content = cleanLine.replace(/^\*\*\s*/, "").replace(/\s*\*\*$/, "");
          return <p key={idx} className="font-extrabold text-slate-900 mt-2">{content}</p>;
        }

        // List items
        if (cleanLine.startsWith("-") || cleanLine.startsWith("*")) {
          let content = cleanLine.replace(/^[-*]\s*/, "");
          // Simple bold formatting replacement inside list item
          const parts = content.split("**");
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-emerald-500 mt-1.5 shrink-0 select-none">●</span>
              <span>
                {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-extrabold text-slate-900">{part}</strong> : part)}
              </span>
            </div>
          );
        }

        if (cleanLine === "") {
          return <div key={idx} className="h-2" />;
        }

        // Standard paragraph with possible **bold** markdown parsing
        const parts = line.split("**");
        return (
          <p key={idx}>
            {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-extrabold text-slate-900">{part}</strong> : part)}
          </p>
        );
      })}
    </div>
  );
}

export default function InvexaAIManager({ items, stockMoves, user }: InvexaAIManagerProps) {
  // SaaS Multi-tenant state scoping
  const [activeRole, setActiveRole] = useState<"Admin" | "Manager" | "Employee">("Admin");
  const [diagnosticReport, setDiagnosticReport] = useState<string>("");
  const [loadingDiagnostic, setLoadingDiagnostic] = useState<boolean>(false);
  const [selectedReportType, setSelectedReportType] = useState<string>("daily");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState<boolean>(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState<boolean>(false);
  
  // Interactive Memory Chatbot state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    { 
      sender: "ai", 
      text: "السلام علیکم! میں ہوں Invexa AI Manager۔ آپ کا چوبیس گھنٹے فعال بزنس اسسٹنٹ۔ میں آپ کی لائیو انوینٹری، آؤٹ آف سٹاک آئٹمز، ایکسپائری اور مالیاتی ریکارڈ کا چوبیس گھنٹے آڈٹ کر سکتا ہوں۔ مجھ سے کوئی بھی سوال پوچھیں!" 
    }
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Trigger initial diagnostics and notifications
  useEffect(() => {
    fetchDiagnostics();
    fetchNotifications();
  }, [activeRole, items, stockMoves]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const fetchDiagnostics = async () => {
    setLoadingDiagnostic(true);
    try {
      const res = await fetch("/api/ai-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          action: "diagnose",
          role: activeRole
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnosticReport(data.reply);
      } else {
        console.error("AI Manager diagnostics request failed.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDiagnostic(false);
    }
  };

  const fetchNotifications = async () => {
    setLoadingAlerts(true);
    try {
      const res = await fetch("/api/ai-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          action: "notifications",
          role: activeRole
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.notifications || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const handleGenerateReport = async (type: string) => {
    setSelectedReportType(type);
    setLoadingDiagnostic(true);
    try {
      const res = await fetch("/api/ai-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          action: "report",
          role: activeRole,
          reportType: type
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnosticReport(data.reply);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDiagnostic(false);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || chatInput;
    if (!textToSend.trim()) return;

    if (!customText) setChatInput("");
    
    const newUserMsg = { sender: "user" as const, text: textToSend };
    setChatMessages(prev => [...prev, newUserMsg]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          action: "chat",
          role: activeRole,
          message: textToSend
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { sender: "ai", text: data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { sender: "ai", text: "معذرت، سسٹم عارضی طور پر جواب دینے سے قاصر ہے۔" }]);
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { sender: "ai", text: "کنکشن کا مسئلہ پیش آیا۔ براہ کرم دوبارہ کوشش کریں۔" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const suggestedQueries = [
    "Is any product currently low or out of stock?",
    "Give me a low stock alert summary report.",
    "Show me this month's net sales audit.",
    "What are your premium reorder suggestions?"
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6" id="ai-manager-root">
      
      {/* Compact Upper Status Panel */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4 shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Cpu size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight font-display">Invexa AI Manager</h2>
              <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[9px] font-black rounded-full px-2 py-0.5 border border-emerald-500/20">
                <span className="h-1 w-1 rounded-full bg-emerald-500 animate-ping"></span>
                LIVE AGENT
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              رئیل ٹائم انوینٹری آڈٹ، لائیو الرٹس اور فنانشل بزنس اسسٹنٹ۔
            </p>
          </div>
        </div>

        {/* Real-time Multi-Tenant SaaS Role Switcher - Compact */}
        <div className="bg-slate-800/40 border border-slate-700/50 px-3 py-2 rounded-xl flex items-center gap-3">
          <span className="text-[10px] text-slate-400 font-bold hidden md:inline">
            SaaS Role Gate:
          </span>
          <div className="flex gap-1">
            {(["Admin", "Manager", "Employee"] as const).map(role => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`py-1 px-2 rounded-md text-[10px] font-extrabold tracking-tight transition-all cursor-pointer ${
                  activeRole === role 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Collapsible Executive AI CEO Analytics & Alerts Folder */}
      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-xs">
        <button
          onClick={() => setIsAnalyticsOpen(!isAnalyticsOpen)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 transition text-left cursor-pointer border-b border-slate-100"
        >
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Folder size={18} />
            </span>
            <div className="text-left">
              <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm tracking-tight uppercase">
                📁 Invexa AI CEO Insights & Executive Reports Folder
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                Click to expand live business diagnostics, custom daily/weekly audits, and stock exception logs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
              isAnalyticsOpen ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800 animate-pulse"
            }`}>
              {isAnalyticsOpen ? "Open Folder" : "Locked / Click to Read"}
            </span>
            <ChevronDown 
              size={18} 
              className={`text-slate-400 transition-transform duration-200 ${isAnalyticsOpen ? "rotate-180" : ""}`} 
            />
          </div>
        </button>

        <AnimatePresence>
          {isAnalyticsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden bg-slate-50/30"
            >
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Executive Analytics Trigger Panel */}
                <div className="bg-white rounded-2xl p-5 shadow-3xs border border-slate-100 flex flex-col space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={18} className="text-indigo-600" />
                      <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Executive Business Diagnostics & Reports</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => window.print()}
                        className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-lg transition"
                        title="Print Report"
                      >
                        <Printer size={15} />
                      </button>
                      <button 
                        onClick={fetchDiagnostics}
                        className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-lg transition"
                        title="Refresh Data"
                      >
                        <RefreshCw size={14} className={loadingDiagnostic ? "animate-spin" : ""} />
                      </button>
                    </div>
                  </div>

                  {/* Quick Report Generation Tabs */}
                  <div className="flex gap-2 bg-slate-50 p-1 rounded-xl shrink-0">
                    <button
                      onClick={() => handleGenerateReport("daily")}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                        selectedReportType === "daily" 
                          ? "bg-white text-slate-900 shadow-3xs" 
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Daily Summary
                    </button>
                    <button
                      onClick={() => handleGenerateReport("weekly")}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                        selectedReportType === "weekly" 
                          ? "bg-white text-slate-900 shadow-3xs" 
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Weekly Audit
                    </button>
                    <button
                      onClick={() => handleGenerateReport("monthly")}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                        selectedReportType === "monthly" 
                          ? "bg-white text-slate-900 shadow-3xs" 
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Monthly Profit
                    </button>
                  </div>

                  {/* Diagnostics Report Terminal */}
                  <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 relative min-h-[220px] flex-1 overflow-y-auto">
                    {loadingDiagnostic ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75 backdrop-blur-3xs rounded-xl z-10">
                        <LoaderIcon className="text-indigo-600 mb-2" />
                        <p className="text-xs text-slate-500 font-bold animate-pulse">
                          Querying live database, comparing stock states...
                        </p>
                      </div>
                    ) : null}

                    {diagnosticReport ? (
                      <MarkdownText text={diagnosticReport} />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 h-full py-12">
                        <Bot size={40} className="stroke-1 text-slate-300 mb-2" />
                        <p className="text-xs text-slate-500 font-bold">Select a tab above to execute dynamic analysis</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Real-time Alerts Panel */}
                <div className="bg-white rounded-2xl p-5 shadow-3xs border border-slate-100 flex flex-col space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
                      Security Center & Real-time Stock Exception Alerts
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-[220px]">
                    {alerts.length === 0 ? (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                        <CheckCircle size={20} className="text-emerald-500 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-800">All Systems Stable! ✅</p>
                          <p className="text-[10px] text-emerald-600 mt-0.5">
                            No critical alerts, expiring items, or low stock threshold warnings logged.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {alerts.map((alert, i) => (
                          <div 
                            key={alert.id || i}
                            className={`flex gap-3 p-3 rounded-xl border transition-all text-left ${
                              alert.type === "danger" 
                                ? "bg-rose-50 border-rose-100 text-rose-800" 
                                : alert.type === "warning"
                                ? "bg-amber-50 border-amber-100 text-amber-800"
                                : "bg-indigo-50 border-indigo-100 text-indigo-800"
                            }`}
                          >
                            {alert.type === "danger" ? (
                              <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                            ) : alert.type === "warning" ? (
                              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircle size={18} className="text-indigo-500 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <h4 className="text-xs font-extrabold">{alert.title}</h4>
                              <p className="text-[10px] text-slate-600 mt-0.5">{alert.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Memory-Scoped Interactive Chat with continuous database stream */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[700px] w-full max-w-5xl mx-auto">
        
        {/* Chat Header */}
        <div className="bg-slate-950 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-emerald-400" />
            <div>
              <h3 className="text-xs font-bold font-sans">بزنس کونسلر اسسٹنٹ (AI Chat)</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Tenant: {user.storeName || "Waleed Foods"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] bg-slate-800 px-2.5 py-1 rounded-full text-slate-400 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Active State
          </div>
        </div>

        {/* Chat Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f0f2f5]">
          <AnimatePresence initial={false}>
            {chatMessages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-2xs ${
                    msg.sender === "user" 
                      ? "bg-emerald-600 text-white rounded-br-none" 
                      : "bg-white text-slate-800 border border-slate-200/50 rounded-bl-none leading-relaxed text-left"
                  }`}
                >
                  {msg.sender === "ai" ? (
                    <MarkdownText text={msg.text} />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}
                </div>
              </motion.div>
            ))}
            {chatLoading && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none p-3 shadow-3xs flex items-center gap-2">
                  <LoaderIcon className="text-emerald-500 animate-spin" />
                  <span className="text-[11px] text-slate-500 animate-pulse font-bold">Invexa مینیجر جواب لکھ رہا ہے...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={chatBottomRef} />
        </div>

        {/* Quick suggested queries list */}
        <div className="p-3 border-t border-slate-100 bg-white shrink-0">
          <p className="text-[10px] text-slate-500 font-bold mb-1.5 px-1.5 text-left">Quick Prompts (Click to edit in input):</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedQueries.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setChatInput(q)}
                className="text-[11px] bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 py-1.5 px-2.5 rounded-xl transition duration-150 text-left font-bold cursor-pointer border border-slate-200/50 hover:border-emerald-200"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Input field - Full-Screen WhatsApp Style editor */}
        <div className="p-3 border-t border-slate-150 bg-[#f0f2f5] shrink-0">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-2 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition shadow-2xs flex flex-col">
              {chatInput && (
                <div className="flex justify-between items-center text-[10px] text-slate-400 pb-1 mb-1 border-b border-slate-100">
                  <span className="font-sans font-semibold text-emerald-600">Draft Editor (Edit before sending)</span>
                  <button 
                    type="button" 
                    onClick={() => setChatInput("")} 
                    className="text-rose-500 hover:text-rose-700 font-bold"
                  >
                    Clear
                  </button>
                </div>
              )}
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Invexa مینیجر سے اردو میں سوال پوچھیں..."
                rows={2}
                className="w-full text-xs text-slate-800 bg-transparent border-0 focus:outline-hidden focus:ring-0 resize-none font-sans min-h-[44px] leading-relaxed text-left"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
            </div>
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-full transition-all cursor-pointer shrink-0 disabled:bg-slate-300 disabled:text-slate-500 shadow-md flex items-center justify-center h-11 w-11"
              title="Send"
            >
              <Send size={16} className="translate-x-[-1px]" />
            </button>
          </form>
          <p className="text-[9px] text-slate-400 text-center mt-1 font-sans">
            Press <b>Enter</b> to send. Press <b>Shift + Enter</b> for a new line.
          </p>
        </div>

      </div>

    </div>
  );
}

// Inline lightweight spinning loader icon
function LoaderIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg 
      className={className} 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
