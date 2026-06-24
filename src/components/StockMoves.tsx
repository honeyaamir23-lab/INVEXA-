import React, { useState } from "react";
import { Item, StockMove } from "../types";
import { Plus, Minus, Calendar, ClipboardList, Info, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface StockMovesProps {
  items: Item[];
  moves: StockMove[];
  onAddMovement: (movement: Omit<StockMove, "id" | "userId" | "createdAt">) => Promise<void>;
}

export default function StockMoves({ items, moves, onAddMovement }: StockMovesProps) {
  const [filterType, setFilterType] = useState<"All" | "Stock In" | "Stock Out">("All");
  const [filterTime, setFilterTime] = useState<"Today" | "Week" | "Month" | "All">("All");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txnType, setTxnType] = useState<"Stock In" | "Stock Out">("Stock In");

  // Form State
  const [selectedItemId, setSelectedItemId] = useState("");
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState<"Purchase" | "Sale" | "Adjustment">("Purchase");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  // Set default reason on type change
  const handleTxnTypeChange = (type: "Stock In" | "Stock Out") => {
    setTxnType(type);
    setReason(type === "Stock In" ? "Purchase" : "Sale");
  };

  // Preset auto-filling price from selected item
  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = items.find(i => i.id === itemId);
    if (item) {
      setPrice(item.price);
    }
  };

  const handleOpenModal = (type: "Stock In" | "Stock Out") => {
    handleTxnTypeChange(type);
    setSelectedItemId(items[0]?.id || "");
    setQty(0);
    setSupplier("");
    setNotes("");
    setDate(new Date().toISOString().split("T")[0]);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || qty <= 0) return;
    const selectedItem = items.find(i => i.id === selectedItemId);
    if (!selectedItem) return;

    setSubmitting(true);
    try {
      await onAddMovement({
        itemId: selectedItemId,
        itemName: selectedItem.name,
        qty,
        type: txnType,
        reason,
        date,
        supplier: txnType === "Stock In" ? supplier : undefined,
        notes: notes.trim() || undefined,
        price,
      });
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Date Filters
  const getStartOfDateRange = () => {
    const start = new Date();
    if (filterTime === "Today") {
      start.setHours(0,0,0,0);
    } else if (filterTime === "Week") {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0,0,0,0);
    } else if (filterTime === "Month") {
      start.setDate(1);
      start.setHours(0,0,0,0);
    }
    return start;
  };

  // Filter Moves
  const filteredMoves = moves.filter((m) => {
    // Type Filter
    if (filterType !== "All" && m.type !== filterType) return false;

    // Time Filter
    if (filterTime !== "All") {
      const moveDate = new Date(m.date);
      const limit = getStartOfDateRange();
      if (moveDate < limit) return false;
    }

    return true;
  }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-20">
      
      {/* Upper quick control panel */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <ClipboardList size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-slate-900">Stock Movements</h2>
              <p className="text-xs text-slate-500 mt-0.5">Log instant inward and outward inventory transactions</p>
            </div>
          </div>

          {/* Action buttons (horizontal, dense, perfectly responsive) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenModal("Stock In")}
              className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-1 py-2 px-3.5 bg-emerald-650 hover:bg-emerald-700 bg-emerald-600 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer border border-emerald-500"
              id="add-stock-in-button"
            >
              <Plus size={14} />
              <span>Stock In (+)</span>
            </button>
            <button
              onClick={() => handleOpenModal("Stock Out")}
              className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-1 py-2 px-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer border border-rose-500"
              id="add-stock-out-button"
            >
              <Minus size={14} />
              <span>Stock Out (-)</span>
            </button>
          </div>
        </div>

        {/* Filter Controls (neatly wrapped, responsive) */}
        <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-left">
          
          {/* Movement Types */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-bold shrink-0">Filter Type:</span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => setFilterType("All")}
                className={`py-1 px-2.5 rounded text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                  filterType === "All" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType("Stock In")}
                className={`py-1 px-2.5 rounded text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                  filterType === "Stock In" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Inward (+)
              </button>
              <button
                onClick={() => setFilterType("Stock Out")}
                className={`py-1 px-2.5 rounded text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                  filterType === "Stock Out" ? "bg-white text-rose-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Outward (-)
              </button>
            </div>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-bold shrink-0">Range:</span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => setFilterTime("Today")}
                className={`py-1 px-2.5 rounded text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                  filterTime === "Today" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setFilterTime("Week")}
                className={`py-1 px-2.5 rounded text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                  filterTime === "Week" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setFilterTime("Month")}
                className={`py-1 px-2.5 rounded text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                  filterTime === "Month" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setFilterTime("All")}
                className={`py-1 px-2.5 rounded text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                  filterTime === "All" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Time
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger list */}
      <div className="space-y-2.5">
        {filteredMoves.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400 text-xs shadow-xs">
            No movements logged under the selected filters.
          </div>
        ) : (
          filteredMoves.map((m) => {
            const isIn = m.type === "Stock In";
            const worth = (m.qty || 0) * (m.price || 0);

            return (
              <motion.div
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                key={m.id}
                className={`bg-white rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-slate-300 shadow-xs ${
                  isIn ? "border-emerald-100 hover:bg-emerald-50/5" : "border-rose-100 hover:bg-rose-50/5"
                }`}
              >
                <div className="flex items-start gap-3 text-left">
                  {/* Decorative Badge */}
                  <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center font-display font-extrabold text-sm ${isIn ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {isIn ? "+" : "-"}{m.qty}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <h3 className="font-bold text-slate-800 text-sm truncate">{m.itemName}</h3>
                    <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
                      <span className="inline-flex items-center gap-0.5 font-mono">
                        <Calendar size={10} />
                        {m.date}
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-slate-500">Reason: {m.reason}</span>
                      {m.supplier && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-1 py-0.5 rounded">
                            Supplier: {m.supplier}
                          </span>
                        </>
                      )}
                    </div>
                    {m.notes && (
                      <p className="text-slate-400 text-[10px] italic mt-1 flex items-center gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100 max-w-sm">
                        <Info size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">Note: {m.notes}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Right hand finance analysis */}
                <div className="text-left sm:text-right flex sm:flex-col justify-between sm:justify-center items-center sm:items-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 shrink-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Total Volume Val</div>
                  <div className="text-sm font-extrabold text-slate-800 font-display mt-0.5">
                    Rs {worth.toLocaleString("en-US")}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono sm:mt-0.5">
                    Rs {m.price} x {m.qty}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Ledger Entry Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-2xs">
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-100"
            >
              {/* Modal Header */}
              <div className={`p-4 text-white flex justify-between items-center ${txnType === "Stock In" ? "bg-emerald-600" : "bg-rose-600"}`}>
                <div>
                  <h2 className="text-base font-bold font-display">
                    {txnType === "Stock In" ? "Stock Inward Log" : "Stock Sale Out Log"}
                  </h2>
                  <p className="text-[10px] text-white/80 mt-0.5">Publish transactions directly to local ledger</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-white hover:text-slate-200 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs text-left">
                
                {/* Select Item */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">SELECT PRODUCT *</label>
                  {items.length === 0 ? (
                    <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-[10px] text-center font-semibold">
                      Your catalog is currently empty. Please add items first!
                    </div>
                  ) : (
                    <select
                      value={selectedItemId}
                      onChange={(e) => handleItemSelect(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
                    >
                      <option value="" disabled>--- Choose An Item ---</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} (Current: {i.qty} {i.unit})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Quantity to adjust */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">ADJUSTED QUANTITY *</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      placeholder="e.g. 15"
                      value={qty || ""}
                      onChange={(e) => setQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none font-display text-slate-900 font-semibold"
                    />
                  </div>

                  {/* Transaction Reason */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">LOG REASON</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none font-medium"
                    >
                      {txnType === "Stock In" ? (
                        <>
                          <option value="Purchase">Purchase (Acquisition)</option>
                          <option value="Adjustment">Adjustment (Inventory Check)</option>
                        </>
                      ) : (
                        <>
                          <option value="Sale">Sale (Outward Order)</option>
                          <option value="Adjustment">Adjustment (Defect/Loss)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Price per Unit */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">TX PRICE (Rs) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={price || ""}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none font-display text-slate-900 font-semibold"
                    />
                  </div>

                  {/* Date of Entry */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">EFFECTIVE DATE</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none font-display text-slate-900"
                    />
                  </div>
                </div>

                {/* Conditional Supplier */}
                {txnType === "Stock In" && (
                  <div className="space-y-1 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                    <label className="font-bold text-emerald-800 block">SUPPLIER NAME</label>
                    <input
                      type="text"
                      placeholder="e.g. Al-Fatah Wholesalers"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-250 border-emerald-200 rounded-lg focus:outline-none text-slate-900"
                    />
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">MEMO / ADDITIONAL NOTES</label>
                  <textarea
                    placeholder="Reference order ID, dispatch agent, or general notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Actions */}
                <div className="pt-3 flex gap-2 justify-end border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 font-bold rounded-lg text-[10px] duration-150 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || items.length === 0}
                    className={`py-1.5 px-4 text-white font-bold rounded-lg text-[10px] duration-150 shrink-0 cursor-pointer shadow-xs disabled:opacity-50 ${
                      txnType === "Stock In" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                    }`}
                  >
                    {submitting ? "Booking..." : "Book Ledger"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
