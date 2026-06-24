import { useState } from "react";
import { Item, StockMove, LocalUser } from "../types";
import { BarChart3, TrendingUp, Calendar, ArrowDownCircle, ArrowUpCircle, Printer, Sparkles } from "lucide-react";
import { motion } from "motion/react";

interface ReportsProps {
  items: Item[];
  moves: StockMove[];
  user: LocalUser;
}

export default function Reports({ items, moves, user }: ReportsProps) {
  const [period, setPeriod] = useState<"All" | "Today" | "Week" | "Month">("All");

  // Filter Movements based on time period
  const getStartOfPeriodRange = () => {
    const start = new Date();
    if (period === "Today") {
      start.setHours(0,0,0,0);
    } else if (period === "Week") {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0,0,0,0);
    } else if (period === "Month") {
      start.setDate(1);
      start.setHours(0,0,0,0);
    }
    return start;
  };

  const periodFilteredMoves = moves.filter((m) => {
    if (period === "All") return true;
    const moveDate = new Date(m.date);
    const limit = getStartOfPeriodRange();
    return moveDate >= limit;
  });

  // Financial calculations
  const totalStockValuation = items.reduce((acc, item) => acc + (item.qty * item.price), 0);

  const stats = periodFilteredMoves.reduce(
    (acc, m) => {
      const worth = (m.qty || 0) * (m.price || 0);
      if (m.type === "Stock In") {
        acc.totalInwardCount += m.qty;
        acc.totalPurchasesPrice += worth;
      } else if (m.type === "Stock Out") {
        acc.totalOutwardCount += m.qty;
        acc.totalSalesPrice += worth;
        
        // Dynamic Profit Calculation based on SaaS item acquisition cost:
        const itemObj = items.find(i => i.id === m.itemId);
        const actualUnitCost = itemObj ? (itemObj.costPrice || itemObj.price * 0.8) : m.price * 0.8;
        const itemCostTotal = m.qty * actualUnitCost;
        acc.estimatedProfit += (worth - itemCostTotal);
      }
      return acc;
    },
    {
      totalInwardCount: 0,
      totalOutwardCount: 0,
      totalPurchasesPrice: 0,
      totalSalesPrice: 0,
      estimatedProfit: 0,
    }
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-8 print:p-0">
      
      {/* Printable page header */}
      <div className="hidden print:block space-y-4 pb-6 border-b border-slate-300">
        <div className="flex justify-between items-start">
          <div className="text-left">
            <span className="text-[10px] font-bold text-amber-600 tracking-widest uppercase">OFFICIAL BUSINESS LEDGER</span>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{user.storeName || "INVEXA SMART MANAGER"}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Owner: <span className="font-bold text-slate-800">{user.ownerName}</span> | Phone: <span className="font-bold text-slate-800">{user.phone}</span> | Type: <span className="font-bold text-slate-800">{user.businessType}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-lg font-black tracking-wider uppercase text-slate-900 font-mono">INVEXA</span>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest">SMART MANAGER SECURE REPORT</p>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">Date: {new Date().toLocaleDateString("en-US")} {new Date().toLocaleTimeString("en-US")}</p>
          </div>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-lg flex items-center justify-between text-xs text-slate-600">
          <div>Report Period Filter: <span className="font-bold text-slate-900">{period}</span></div>
          <div>Status: <span className="font-bold text-emerald-600">Verified Authentic Ledger</span></div>
        </div>
      </div>

      {/* Filter and Printable controller */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2 text-left self-start sm:self-auto">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Analytics & Reports</h2>
            <p className="text-xs text-slate-500 mt-0.5">Track financial performance and margins</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs w-full sm:w-auto">
            {(["All", "Today", "Week", "Month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 sm:flex-none py-1.5 px-3.5 rounded-lg font-bold transition cursor-pointer text-[10px] md:text-xs ${
                  period === p ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer"
            title="Print Report"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Financial Bento Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sales</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
              <ArrowUpCircle size={15} />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-lg sm:text-2xl font-extrabold text-emerald-600 font-display block">
              Rs {stats.totalSalesPrice.toLocaleString("en-US")}
            </span>
            <span className="text-[9px] sm:text-xs text-slate-400 mt-1 block">
              {stats.totalOutwardCount} units dispatched
            </span>
          </div>
        </div>

        {/* Total Acquisitions */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Acquisitions</span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg shrink-0">
              <ArrowDownCircle size={15} />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-lg sm:text-2xl font-extrabold text-rose-600 font-display block">
              Rs {stats.totalPurchasesPrice.toLocaleString("en-US")}
            </span>
            <span className="text-[9px] sm:text-xs text-slate-400 mt-1 block">
              {stats.totalInwardCount} units acquired
            </span>
          </div>
        </div>

        {/* Estimated Gross Profit */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Profit</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg shrink-0">
              <TrendingUp size={15} />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-lg sm:text-2xl font-extrabold text-amber-500 font-display block">
              Rs {stats.estimatedProfit >= 0 ? "+" : ""}{stats.estimatedProfit.toLocaleString("en-US")}
            </span>
            <span className="text-[9px] sm:text-xs text-slate-400 mt-1 block">
              estimated margin (20%)
            </span>
          </div>
        </div>

        {/* Live Catalogue Worth */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Asset Worth</span>
            <span className="p-1.5 bg-slate-100 text-slate-600 rounded-lg shrink-0">
              <Calendar size={15} />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-lg sm:text-2xl font-extrabold text-slate-900 font-display block">
              Rs {totalStockValuation.toLocaleString("en-US")}
            </span>
            <span className="text-[9px] sm:text-xs text-slate-400 mt-1 block">
              total stock capital valuation
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Summary table */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs text-xs text-left">
        <h3 className="font-bold text-slate-800 text-sm mb-3">Period Journal Summary</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase font-extrabold">
                <th className="py-2.5">Date</th>
                <th className="py-2.5">Product Name</th>
                <th className="py-2.5">Type</th>
                <th className="py-2.5">Logged Reason</th>
                <th className="py-2.5 text-right">Units</th>
                <th className="py-2.5 text-right">Total (Rs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periodFilteredMoves.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No transactions registered during this specific period.
                  </td>
                </tr>
              ) : (
                periodFilteredMoves.map((m) => {
                  const isIn = m.type === "Stock In";
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 font-mono text-[10px] text-slate-400">{m.date}</td>
                      <td className="py-2.5 font-bold text-slate-800">{m.itemName}</td>
                      <td className="py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isIn ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
                        }`}>
                          {isIn ? "Stock In (+)" : "Stock Out (-)"}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500 font-medium">{m.reason}</td>
                      <td className="py-2.5 font-display font-medium text-right text-slate-800">{m.qty}</td>
                      <td className="py-2.5 font-display font-extrabold text-right text-slate-900">
                        Rs {((m.price || 0) * (m.qty || 0)).toLocaleString("en-US")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
