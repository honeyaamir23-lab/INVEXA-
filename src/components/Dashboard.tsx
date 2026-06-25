import React, { useState } from "react";
import { Item, StockMove, LocalUser } from "../types";
import { AlertCircle, ArrowUpRight, ArrowDownLeft, RefreshCw, Send, Database, LogOut, Settings, Plus, X, User as UserIcon, Calendar, Briefcase, Check, Copy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { dbService } from "../db";

interface DashboardProps {
  items: Item[];
  moves: StockMove[];
  onNavigateToTab: (tab: string) => void;
  onEditItem: (item: Item) => void;
  isDbConnected: boolean;
  onLogout: () => void;
  onUpdateUser: (updatedUser: LocalUser) => void;
}

export default function Dashboard({ items, moves, onNavigateToTab, onEditItem, isDbConnected, onLogout, onUpdateUser }: DashboardProps) {
  // Calculations
  const stats = {
    totalItems: items.length,
    stockValue: items.reduce((acc, item) => acc + (item.qty * item.price), 0),
    lowStock: items.filter(item => item.qty > 0 && item.qty <= item.minQty).length,
    outOfStock: items.filter(item => item.qty <= 0).length,
  };

  const needsAttentionItems = items.filter(item => item.qty <= item.minQty);
  
  // Sort movements by createdAt desc, take top 4
  const recentMoves = [...moves]
    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  // Today's date nicely formatted in English
  const today = new Date();
  const formattedDateEn = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Generate WhatsApp message to order low stock items
  const getWhatsAppLink = (item: Item) => {
    const text = `Hello! We immediately require the following stock replenishment for our shop:
Item: ${item.name}
Current Quantity: ${item.qty} ${item.unit}
Recommended Reorder Qty: ${item.reorderQty} ${item.unit}
Please prepare this delivery at your earliest convenience. Thank you!`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  // Load user workspace configuration dynamically
  const rawUser = localStorage.getItem("store_user");
  let storeTitle = "My Store Dashboard";
  let storeCat = "Enterprise Workspace";
  let ownerName = "Manager";
  let phone = "";
  let pinCode = "";
  let currentUid = "";
  let currentEmail = "";

  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser);
      storeTitle = parsed.storeName || storeTitle;
      storeCat = parsed.businessType || storeCat;
      ownerName = parsed.ownerName || ownerName;
      phone = parsed.phone || phone;
      pinCode = parsed.pinCode || parsed.pin_code || "";
      currentUid = parsed.uid || "";
      currentEmail = parsed.email || "";
    } catch(e) {}
  }

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };
  
  // Profile edit states
  const [editStoreName, setEditStoreName] = useState(storeTitle);
  const [editOwnerName, setEditOwnerName] = useState(ownerName);
  const [editBusinessType, setEditBusinessType] = useState(storeCat);
  const [editPin, setEditPin] = useState(pinCode);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStoreName.trim() || !editOwnerName.trim() || editPin.length !== 4) {
      return;
    }

    const updatedUser: LocalUser = {
      uid: currentUid || "saas-user-" + Math.random().toString(36).substring(2, 9),
      email: currentEmail || `${phone}@invexa.com`,
      ownerName: editOwnerName.trim(),
      phone: phone,
      storeName: editStoreName.trim(),
      businessType: editBusinessType,
      pinCode: editPin,
    };

    // Save globally and locally
    await dbService.saveUserWorkspace(updatedUser);
    onUpdateUser(updatedUser);
    setIsProfileModalOpen(false);
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-8 text-left">
      {/* Top Welcome Title Card - Premium Mobile-First Branded Business Card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#0b0f19] via-[#071621] to-[#03070d] text-white rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-2xl border border-emerald-500/20 relative overflow-hidden"
      >
        {/* Soft glowing ambient backgrounds */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500 rounded-full filter blur-[110px] opacity-25 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-amber-500 rounded-full filter blur-[90px] opacity-15" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10 w-full">
          <div className="flex items-center gap-4">
            {/* Branded Icon Container */}
            <div className="h-14 w-14 bg-gradient-to-tr from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-amber-500/10 border border-white/10 shrink-0 relative">
              <span>🏬</span>
            </div>

            <div className="space-y-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-black font-display tracking-tight leading-tight text-white flex items-center gap-2">
                <span className="truncate">{storeTitle}</span>
                <span className="text-emerald-400 text-sm md:text-base">✨</span>
              </h1>

              {/* Premium Meta Information Grid */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
                <span className="flex items-center gap-1.5 text-slate-300 text-[10px] font-semibold">
                  <Briefcase size={11} className="text-emerald-400" />
                  <span>{storeCat}</span>
                </span>
                <span className="text-slate-600 text-xs hidden sm:inline">•</span>
                <span className="flex items-center gap-1.5 text-slate-300 text-[10px] font-semibold">
                  <UserIcon size={11} className="text-amber-400" />
                  <span>{ownerName}</span>
                </span>
                <span className="text-slate-600 text-xs hidden sm:inline">•</span>
                <span className="flex items-center gap-1.5 text-slate-400 text-[10px] font-medium font-mono">
                  <Calendar size={11} className="text-slate-500" />
                  <span>{formattedDateEn}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Premium Quick Utilities Panel */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0">
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-wider cursor-pointer transition shadow-md ${
                isDbConnected 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" 
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
              }`}
              title="Supabase Cloud Connection Status & Setup"
            >
              <Database size={12} className={isDbConnected ? "text-emerald-400" : "text-amber-400"} />
              <span>{isDbConnected ? "Supabase: Connected" : "Supabase: Setup Needed"}</span>
            </button>

            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-black text-[10px] uppercase tracking-wider rounded-xl cursor-pointer transition shadow-md"
              title="Edit Store Profile Details"
            >
              <Settings size={12} className="text-amber-400" />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      </motion.div>
      {/* Analytics Widgets Grid (2x2 on mobile, perfectly responsive) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Items */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs hover:shadow-sm cursor-pointer transition flex flex-col justify-between"
          onClick={() => onNavigateToTab("items")}
          id="stat-total-items"
        >
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Items</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 font-display">
              {stats.totalItems}
            </div>
          </div>
          <span className="text-[9px] sm:text-xs text-slate-400 mt-2 block">registered in inventory</span>
        </motion.div>

        {/* Stock Value */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs hover:shadow-sm cursor-pointer transition flex flex-col justify-between"
          onClick={() => onNavigateToTab("reports")}
          id="stat-stock-value"
        >
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Stock Value</span>
            <div className="text-lg sm:text-2xl font-extrabold text-emerald-600 mt-1 font-display truncate">
              Rs {stats.stockValue.toLocaleString("en-US")}
            </div>
          </div>
          <span className="text-[9px] sm:text-xs text-slate-400 mt-2 block">total capital asset</span>
        </motion.div>

        {/* Low Stock */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs hover:shadow-sm cursor-pointer transition flex flex-col justify-between"
          onClick={() => onNavigateToTab("items")}
          id="stat-low-stock"
        >
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Low Stock</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-500 mt-1 font-display">
              {stats.lowStock}
            </div>
          </div>
          <span className="text-[9px] sm:text-xs text-slate-400 mt-2 block">needs critical reorder</span>
        </motion.div>

        {/* Out of Stock */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs hover:shadow-sm cursor-pointer transition flex flex-col justify-between"
          onClick={() => onNavigateToTab("items")}
          id="stat-out-of-stock"
        >
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Out of Stock</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-500 mt-1 font-display">
              {stats.outOfStock}
            </div>
          </div>
          <span className="text-[9px] sm:text-xs text-slate-400 mt-2 block">requires immediate action</span>
        </motion.div>
      </div>

      {/* Needs Attention Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <span className="p-1 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                <AlertCircle size={15} />
              </span>
              <span>Needs Replenishing / Attention</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-mono font-semibold">
              Warning items ({needsAttentionItems.length})
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4 shadow-xs">
            {needsAttentionItems.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <div className="text-3xl">🎉</div>
                <h3 className="font-semibold text-slate-800 text-xs sm:text-sm">All inventory is at safe levels!</h3>
                <p className="text-slate-500 text-[11px]">No products are currently low or out of stock.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {needsAttentionItems.map((item) => {
                  const percent = Math.min((item.qty / (item.minQty || 1)) * 100, 100);
                  const isCritical = item.qty === 0;

                  return (
                    <div 
                      key={item.id} 
                      className={`p-3.5 rounded-xl border transition duration-150 ${
                        isCritical 
                        ? "bg-rose-50/10 border-rose-100/60 hover:bg-rose-50/20" 
                        : "bg-amber-50/10 border-amber-100/60 hover:bg-amber-50/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{item.name}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Min Alert limit: {item.minQty} {item.unit} | Suggested: {item.reorderQty} {item.unit}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-sm font-bold block font-display ${isCritical ? "text-rose-600" : "text-amber-600"}`}>
                            {item.qty} {item.unit}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Rs {item.price}/unit</span>
                        </div>
                      </div>

                      {/* Stock Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>Stock Level</span>
                          <span>{percent.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-300 ${isCritical ? "bg-rose-500" : "bg-amber-500"}`} 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2 justify-end">
                        <a 
                          href={getWhatsAppLink(item)}
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-[10px] duration-150 shadow-xs"
                          id={`needs-attention-whatsapp-${item.id}`}
                        >
                          <Send size={11} />
                          <span>WhatsApp Order</span>
                        </a>
                        <button
                          onClick={() => onEditItem(item)}
                          className="py-1 px-2.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-semibold rounded-lg text-[10px] duration-150 shadow-xs cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Stock Movements List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <span className="p-1 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                <RefreshCw size={15} />
              </span>
              <span>Recent Activity</span>
            </h2>
            <button 
              onClick={() => onNavigateToTab("moves")} 
              className="text-[10px] text-emerald-600 hover:underline font-bold cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4 shadow-xs">
            {recentMoves.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No stock movements logged yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentMoves.map((m) => {
                  const isIn = m.type === "Stock In";
                  return (
                    <div 
                      key={m.id} 
                      className="p-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/60 rounded-xl flex items-center justify-between transition duration-150 gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${isIn ? "bg-emerald-50 text-emerald-600" : "bg-rose-50/70 text-rose-600"}`}>
                          {isIn ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 text-xs block truncate">{m.itemName}</span>
                          <span className="text-slate-400 font-mono text-[9px] block mt-0.5 truncate">{m.date} · {m.reason}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-display font-extrabold text-xs block ${isIn ? "text-emerald-600" : "text-rose-600"}`}>
                          {isIn ? "+" : "-"}{m.qty}
                        </span>
                        <span className="text-[9px] text-slate-400 block">{m.type === "Stock In" ? "In" : "Out"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute inset-0 bg-[#0A192F]/65 backdrop-blur-xs"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative z-10 border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Settings className="text-[#0A192F]" size={18} />
                  <h3 className="font-display font-black text-slate-900 text-xs uppercase tracking-wider">
                    Edit Business Profile
                  </h3>
                </div>
                <button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-slate-500 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                    Store / Business Name
                  </label>
                  <input
                    type="text"
                    value={editStoreName}
                    onChange={(e) => setEditStoreName(e.target.value)}
                    required
                    className="w-full h-11 px-4 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl duration-150 text-slate-900 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                    Owner Name
                  </label>
                  <input
                    type="text"
                    value={editOwnerName}
                    onChange={(e) => setEditOwnerName(e.target.value)}
                    required
                    className="w-full h-11 px-4 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl duration-150 text-slate-900 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                    Business Type
                  </label>
                  <select
                    value={editBusinessType}
                    onChange={(e) => setEditBusinessType(e.target.value)}
                    className="w-full h-11 px-4 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl duration-150 text-slate-900 focus:outline-none font-bold"
                  >
                    <option value="Wholesaler">Wholesaler / Trader</option>
                    <option value="Factory">Factory / Manufacturer</option>
                    <option value="Retailer">Retailer / Shop</option>
                    <option value="Supermarket">Supermarket / Mart</option>
                    <option value="Cafe">Hotel / Cafe</option>
                    <option value="Other">Other Business</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                    4-Digit Secure PIN
                  </label>
                  <input
                    type="password"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ""))}
                    maxLength={4}
                    required
                    className="w-full h-11 text-center text-sm tracking-[0.5em] bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl duration-150 text-slate-900 focus:outline-none font-black font-mono"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full h-11 bg-[#0A192F] hover:bg-[#112240] text-amber-400 font-extrabold rounded-xl duration-200 shadow-md cursor-pointer text-[11px] uppercase tracking-wider border border-amber-400/10"
                  >
                    Save & Sync Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supabase Connection Setup Modal */}
      <AnimatePresence>
        {isSupabaseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSupabaseModalOpen(false)}
              className="absolute inset-0 bg-[#0A192F]/65 backdrop-blur-xs"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl relative z-10 border border-slate-100 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="text-emerald-600 animate-pulse" size={18} />
                  <h3 className="font-display font-black text-slate-900 text-xs uppercase tracking-wider">
                    Supabase Cloud Sync Setup Guide
                  </h3>
                </div>
                <button
                  onClick={() => setIsSupabaseModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status Badge */}
              <div className={`p-3.5 rounded-2xl mb-4 border flex items-center gap-3 ${
                isDbConnected 
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                  : "bg-amber-50 border-amber-100 text-amber-800"
              }`}>
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isDbConnected ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
                <div className="text-xs">
                  <span className="font-extrabold block">
                    {isDbConnected ? "Supabase Connected! (کامیابی سے منسلک ہے)" : "Supabase Connection Offline (منسلک نہیں ہے)"}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {isDbConnected 
                      ? "Your actual cloud database is fully linked. All listings are safely synchronized in real time!"
                      : "Currently operating in offline LocalStorage fallback mode. All data is safe on this device."}
                  </p>
                </div>
              </div>

              {/* Urdu Instruction Box */}
              <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3 text-right">
                <span className="text-[10px] font-extrabold text-emerald-600 block tracking-wider uppercase">اردو رہنمائی (Urdu Guide)</span>
                <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                  اپنے سپا بیس پروجیکٹ کو اس ایپ کے ساتھ منسلک کرنے کے لیے درج ذیل معلومات فراہم کریں اور ٹیبلز بنائیں۔
                </p>
                
                <div className="space-y-2 text-xs text-slate-600 font-medium">
                  <div>
                    <span className="font-black text-slate-800">1. کریڈنشلز کی کنفیگریشن:</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      اپنے AI Studio کے **Secrets panel** میں دو ویریبلز شامل کریں:
                    </p>
                    <div className="bg-slate-100/85 p-2 rounded-xl text-left font-mono text-[10px] text-slate-700 space-y-1 mt-1 border border-slate-200">
                      <div>VITE_SUPABASE_URL = &quot;YOUR_PROJECT_URL&quot;</div>
                      <div>VITE_SUPABASE_ANON_KEY = &quot;YOUR_ANON_PUBLIC_KEY&quot;</div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <span className="font-black text-slate-800">2. ڈیٹا بیس ٹیبلز کا سیٹ اپ:</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      اپنے Supabase کے **SQL Editor** میں جا کر نیچے دیا گیا SQL اسکرپٹ رن کریں تاکہ دونوں ضروری ٹیبلز خودکار طور پر بن جائیں:
                    </p>
                  </div>
                </div>
              </div>

              {/* SQL Schema Copy Section */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Required SQL Script</span>
                  <button
                    onClick={() => copyToClipboard(
`-- 1. Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  qty NUMERIC DEFAULT 0,
  unit TEXT,
  min_qty NUMERIC DEFAULT 0,
  reorder_qty NUMERIC DEFAULT 0,
  price NUMERIC DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  category TEXT,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  supplier TEXT,
  brand TEXT,
  location TEXT,
  sku TEXT,
  expiry_date TEXT
);

-- Enable RLS and create policy for public access
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access for inventory" ON inventory FOR ALL USING (true);

-- 2. Create stock_moves table
CREATE TABLE IF NOT EXISTS stock_moves (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_id TEXT REFERENCES inventory(id) ON DELETE CASCADE,
  item_name TEXT,
  qty NUMERIC DEFAULT 0,
  type TEXT,
  reason TEXT,
  date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and create policy for public access
ALTER TABLE stock_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access for stock_moves" ON stock_moves FOR ALL USING (true);`,
                      "sql"
                    )}
                    className="flex items-center gap-1.5 py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold duration-150 cursor-pointer"
                  >
                    {copiedText === "sql" ? (
                      <>
                        <Check size={11} className="text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-slate-900 text-amber-400 p-3.5 rounded-2xl font-mono text-[9px] overflow-x-auto max-h-[180px] text-left border border-slate-850 shadow-inner">
                  <pre>{`-- 1. Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  qty NUMERIC DEFAULT 0,
  unit TEXT,
  min_qty NUMERIC DEFAULT 0,
  reorder_qty NUMERIC DEFAULT 0,
  price NUMERIC DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  category TEXT,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  supplier TEXT,
  brand TEXT,
  location TEXT,
  sku TEXT,
  expiry_date TEXT
);

-- Enable RLS and create policy for public access
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access for inventory" ON inventory FOR ALL USING (true);

-- 2. Create stock_moves table
CREATE TABLE IF NOT EXISTS stock_moves (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_id TEXT REFERENCES inventory(id) ON DELETE CASCADE,
  item_name TEXT,
  qty NUMERIC DEFAULT 0,
  type TEXT,
  reason TEXT,
  date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and create policy for public access
ALTER TABLE stock_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access for stock_moves" ON stock_moves FOR ALL USING (true);`}</pre>
                </div>
              </div>

              {/* Close Button */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => setIsSupabaseModalOpen(false)}
                  className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl duration-150 cursor-pointer text-[11px] uppercase tracking-wider"
                >
                  Close setup panel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
