import React, { useState } from "react";
import { Item, StockMove } from "../types";
import { AlertCircle, ArrowUpRight, ArrowDownLeft, RefreshCw, Send, Database, LogOut, Settings, Plus, X, User as UserIcon, Calendar, Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DashboardProps {
  items: Item[];
  moves: StockMove[];
  onNavigateToTab: (tab: string) => void;
  onEditItem: (item: Item) => void;
  isDbConnected: boolean;
  onLogout: () => void;
}

export default function Dashboard({ items, moves, onNavigateToTab, onEditItem, isDbConnected, onLogout }: DashboardProps) {
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
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser);
      storeTitle = parsed.storeName || storeTitle;
      storeCat = parsed.businessType || storeCat;
      ownerName = parsed.ownerName || ownerName;
      phone = parsed.phone || phone;
    } catch(e) {}
  }

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

        <div className="flex items-center gap-4 relative z-10 w-full">
          {/* Branded Icon Container */}
          <div className="h-14 w-14 bg-gradient-to-tr from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-amber-500/10 border border-white/10 shrink-0 relative">
            <span>🏬</span>
          </div>

          <div className="space-y-1 flex-1 min-w-0">
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
                <span>{ownerName} ({phone || "Owner"})</span>
              </span>
              <span className="text-slate-600 text-xs hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5 text-slate-400 text-[10px] font-medium font-mono">
                <Calendar size={11} className="text-slate-500" />
                <span>{formattedDateEn}</span>
              </span>
            </div>
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
    </div>
  );
}
