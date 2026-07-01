import React, { useState, useEffect } from "react";
import { Item, LocalUser } from "../types";
import { Plus, Search, Trash2, Edit3, Send, Grid, Tag, Layers, Calendar, Barcode, MapPin, Truck, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ItemsProps {
  items: Item[];
  user: LocalUser;
  onAddItem: (item: Omit<Item, "id" | "userId" | "createdAt">) => Promise<void>;
  onUpdateItem: (id: string, updates: Partial<Item>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  activeEditItem: Item | null;
  setActiveEditItem: (item: Item | null) => void;
}

export default function Items({
  items,
  user,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  activeEditItem,
  setActiveEditItem,
}: ItemsProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>(() => {
    return localStorage.getItem("selected_category_filter") || "all";
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Categories list State
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem(`store_categories_${user.uid}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return ["خام مال (Raw Materials)", "درمیانی پروڈکٹ (Intermediate Products)", "پیکنگ میٹریل (Packing Materials)", "تیار مال (Finished Goods)", "General Goods"];
  });

  // Reload categories if user changes
  useEffect(() => {
    const filterFromStorage = localStorage.getItem("selected_category_filter");
    if (filterFromStorage) {
      setSelectedCategoryFilter(filterFromStorage);
    }
    
    const saved = localStorage.getItem(`store_categories_${user.uid}`);
    if (saved) {
      try {
        setCategories(JSON.parse(saved));
        return;
      } catch (e) {}
    }
    setCategories(["خام مال (Raw Materials)", "درمیانی پروڈکٹ (Intermediate Products)", "پیکنگ میٹریل (Packing Materials)", "تیار مال (Finished Goods)", "General Goods"]);
  }, [user.uid]);

  // Save categories
  useEffect(() => {
    if (categories.length > 0) {
      localStorage.setItem(`store_categories_${user.uid}`, JSON.stringify(categories));
    }
  }, [categories, user.uid]);

  // Form State
  const [name, setName] = useState("");
  const [qty, setQty] = useState(0);
  const [unit, setUnit] = useState("Pcs");
  const [minQty, setMinQty] = useState(10);
  const [reorderQty, setReorderQty] = useState(50);
  const [price, setPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [category, setCategory] = useState("General Goods");
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [showNewCategoryField, setShowNewCategoryField] = useState(false);
  
  // New Enterprise parameters
  const [supplier, setSupplier] = useState("");
  const [brand, setBrand] = useState("");
  const [location, setLocation] = useState("");
  const [sku, setSku] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Reset Form helper
  const resetForm = () => {
    setName("");
    setQty(0);
    setUnit("Pcs");
    setMinQty(10);
    setReorderQty(50);
    setPrice(0);
    setCostPrice(0);
    setCategory(categories[0] || "General Goods");
    setNewCategoryInput("");
    setShowNewCategoryField(false);
    setSupplier("");
    setBrand("");
    setLocation("");
    setSku("");
    setExpiryDate("");
    setActiveEditItem(null);
  };

  // Open Modal for Create Mode
  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Open Modal for Edit Mode
  const openEditModal = (item: Item) => {
    setName(item.name);
    setQty(item.qty);
    setUnit(item.unit);
    setMinQty(item.minQty);
    setReorderQty(item.reorderQty);
    setPrice(item.price);
    setCostPrice(item.costPrice || 0);
    setCategory(item.category || "General Goods");
    setNewCategoryInput("");
    setShowNewCategoryField(false);
    setSupplier(item.supplier || "");
    setBrand(item.brand || "");
    setLocation(item.location || "");
    setSku(item.sku || "");
    setExpiryDate(item.expiryDate || "");
    
    setActiveEditItem(item);
    setIsModalOpen(true);
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      // Determine final category to assign
      let finalCategory = category;
      if (showNewCategoryField && newCategoryInput.trim()) {
        const parsedCat = newCategoryInput.trim();
        if (!categories.includes(parsedCat)) {
          setCategories((prev) => [...prev, parsedCat]);
        }
        finalCategory = parsedCat;
      }

      const itemPayload = {
        name: name.trim(),
        qty: Number(qty),
        unit,
        minQty: Number(minQty),
        reorderQty: Number(reorderQty),
        price: Number(price),
        costPrice: Number(costPrice),
        category: finalCategory,
        supplier: supplier.trim() || undefined,
        brand: brand.trim() || undefined,
        location: location.trim() || undefined,
        sku: sku.trim() || undefined,
        expiryDate: expiryDate ? expiryDate : undefined,
      };

      if (activeEditItem) {
        // Edit Mode
        await onUpdateItem(activeEditItem.id, itemPayload);
      } else {
        // Create Mode
        await onAddItem(itemPayload as any);
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Items
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          (item.sku && item.sku.toLowerCase().includes(search.toLowerCase())) ||
                          (item.brand && item.brand.toLowerCase().includes(search.toLowerCase()));
    
    if (!matchesSearch) return false;

    // Filter by Category
    if (selectedCategoryFilter !== "all" && item.category !== selectedCategoryFilter) {
      return false;
    }

    // Filter by Stock Status
    if (filter === "low") {
      return item.qty > 0 && item.qty <= item.minQty;
    }
    if (filter === "out") {
      return item.qty <= 0;
    }
    return true;
  });

  // Generate WhatsApp message to order stock
  const getWhatsAppLink = (item: Item) => {
    const text = `Hello! We require the following stock items immediately for our store:
Item Name: ${item.name}
SKU / Code: ${item.sku || "N/A"}
Current Stock Balance: ${item.qty} ${item.unit}
Suggested Reorder Lot Size: ${item.reorderQty} ${item.unit}
Preferred Supplier Details: ${item.supplier || "N/A"}

Please prepare and dispatch this batch at your earliest convenience. Thank you!`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  // Open activeEditItem modal automatically if configured externally from Dashboard
  if (activeEditItem && !isModalOpen) {
    openEditModal(activeEditItem);
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-20 relative">
      
      {/* Top Search, Category Select and Primary Action Buttons */}
      <div className="bg-white rounded-3xl border border-slate-150 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search Input */}
          <div className="flex-grow relative">
            <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search by name, SKU/barcode, or manufacturer brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-850 rounded-2xl text-xs transition placeholder-slate-400"
            />
          </div>

          <div className="flex gap-2 shrink-0">
            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => {
                setSelectedCategoryFilter(e.target.value);
                localStorage.setItem("selected_category_filter", e.target.value);
              }}
              className="px-3.5 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-2xl text-xs font-bold outline-none text-slate-700 cursor-pointer"
            >
              <option value="all">📁 All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  📁 {c}
                </option>
              ))}
            </select>

            {/* Large Add Item Button */}
            <button
              onClick={openAddModal}
              className="flex items-center justify-center gap-2 py-3 px-5 bg-slate-900 hover:bg-slate-850 text-white font-extrabold rounded-2xl transition duration-150 cursor-pointer text-xs shadow-md"
              id="add-item-button-top"
            >
              <Plus size={16} />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Filter Tab Status Labels */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
          <button
            onClick={() => setFilter("all")}
            className={`py-1.5 px-4 rounded-xl text-[11px] font-bold transition cursor-pointer ${
              filter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-150 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Inventory ({items.length})
          </button>
          <button
            onClick={() => setFilter("low")}
            className={`py-1.5 px-4 rounded-xl text-[11px] font-bold transition cursor-pointer ${
              filter === "low"
                ? "bg-amber-100 text-amber-800 border border-amber-200"
                : "bg-slate-150 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Low Stock ({items.filter((i) => i.qty > 0 && i.qty <= i.minQty).length})
          </button>
          <button
            onClick={() => setFilter("out")}
            className={`py-1.5 px-4 rounded-xl text-[11px] font-bold transition cursor-pointer ${
              filter === "out"
                ? "bg-rose-100 text-rose-800 border border-rose-200"
                : "bg-slate-150 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Out of Stock ({items.filter((i) => i.qty <= 0).length})
          </button>
        </div>
      </div>

      {/* Grid of Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full bg-white rounded-3xl border border-dashed border-slate-250 p-12 text-center text-slate-400 text-xs shadow-inner">
            {search || selectedCategoryFilter !== "all" 
              ? "No items match your active search filters." 
              : "No registered items in this category. Click 'Add Product' to insert detailed inventory entries."}
          </div>
        ) : (
          filteredItems.map((item) => {
            const isOut = item.qty <= 0;
            const isLow = !isOut && item.qty <= item.minQty;
            const percent = isOut ? 0 : Math.min((item.qty / (item.minQty || 1)) * 100, 100);

            // Compute margin percentage and value safely
            const markupVal = item.price - (item.costPrice || 0);
            const marginPct = item.price > 0 ? Math.round((markupVal / item.price) * 100) : 0;

            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                key={item.id}
                className={`bg-white rounded-3xl border p-4 sm:p-5 shadow-xs transition duration-150 hover:shadow-md flex flex-col justify-between ${
                  isOut 
                    ? "border-rose-200 bg-rose-50/10" 
                    : isLow 
                    ? "border-amber-200 bg-amber-50/10" 
                    : "border-slate-150"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2.5">
                    <div className="min-w-0 flex-1 text-left">
                      {/* Product Category badge */}
                      <span className="inline-flex items-center gap-1 text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mb-1">
                        <Grid size={8} />
                        {item.category || "General Stocks"}
                      </span>
                      
                      <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                        {item.name}
                      </h3>
                      
                      {item.brand && (
                        <p className="text-[10px] text-slate-500 font-medium">
                          Brand: <span className="font-bold text-slate-700">{item.brand}</span>
                        </p>
                      )}
                    </div>
                    
                    {/* Quantity view */}
                    <div className="text-right shrink-0">
                      <div className="text-xl font-black text-slate-900 font-display">
                        {item.qty} <span className="text-xs font-normal text-slate-500 lowercase">{item.unit}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        Min warning: {item.minQty}
                      </span>
                    </div>
                  </div>

                  {/* Stock Bar Visualization */}
                  <div className="mt-3">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          isOut ? "bg-rose-500" : isLow ? "bg-amber-500" : "bg-emerald-500"
                        }`} 
                        style={{ width: `${isOut ? 0 : Math.max(percent, 7)}%` }}
                      />
                    </div>
                  </div>

                  {/* Advanced SaaS Parameters (Cost, Profit Margin, Supplier, Shelf Location, SKU, Expiry) */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-4 pt-3.5 border-t border-slate-100 text-left text-[11px]">
                    
                    {/* Expiry Date */}
                    {item.expiryDate && (
                      <div className="flex items-center gap-1.5 text-slate-500 truncate col-span-2">
                        <Calendar size={12} className="text-rose-500 shrink-0" />
                        <span>Expiry Date: <span className="font-bold text-rose-600">{item.expiryDate}</span></span>
                      </div>
                    )}

                    {/* Cost and Selling Prices */}
                    <div className="space-y-0.5 bg-slate-50/55 p-1.5 rounded-lg border border-slate-200/50">
                      <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-tight">Acquisition Cost</span>
                      <span className="font-bold text-slate-850 font-mono">Rs {item.costPrice ? item.costPrice.toLocaleString("en-US") : "0"}</span>
                    </div>

                    <div className="space-y-0.5 bg-slate-50/55 p-1.5 rounded-lg border border-slate-200/50">
                      <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-tight">Selling Rate</span>
                      <span className="font-extrabold text-slate-900 font-mono">Rs {item.price.toLocaleString("en-US")}</span>
                    </div>

                    {/* Margin Info */}
                    <div className="col-span-2 flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1 font-semibold">
                        <Layers size={11} className="text-emerald-600" />
                        Est. Markup Profit Margin: 
                      </span>
                      <span className={`font-bold font-mono px-1.5 py-0.5 rounded ${markupVal > 0 ? "text-emerald-700 bg-emerald-50" : "text-slate-500 bg-slate-100"}`}>
                        Rs {markupVal} ({marginPct}%)
                      </span>
                    </div>

                    {/* Warehouse Slot and SKU */}
                    {item.sku && (
                      <div className="flex items-center gap-1.5 text-slate-500 truncate text-[10px] pt-1">
                        <Barcode size={12} className="text-slate-400 shrink-0" />
                        <span className="font-mono">SKU: <span className="font-bold text-slate-700">{item.sku}</span></span>
                      </div>
                    )}

                    {item.location && (
                      <div className="flex items-center gap-1.5 text-slate-500 truncate text-[10px] pt-1">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span>Shelf: <span className="font-bold text-slate-755">{item.location}</span></span>
                      </div>
                    )}

                    {/* Supplier details info */}
                    {item.supplier && (
                      <div className="col-span-2 flex items-center gap-1.5 text-slate-500 truncate text-[10px] pt-1 border-t border-dashed border-slate-100 mt-1">
                        <Truck size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">Supplier: <span className="font-bold text-slate-700">{item.supplier}</span></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operations Actions bar */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                      title="Edit Item details"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (deleteConfirmId === item.id) {
                          onDeleteItem(item.id);
                          setDeleteConfirmId(null);
                        } else {
                          setDeleteConfirmId(item.id);
                          setTimeout(() => {
                            setDeleteConfirmId((curr) => curr === item.id ? null : curr);
                          }, 3000);
                        }
                      }}
                      className={`p-2 transition-all duration-200 rounded-xl cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0 ${
                        deleteConfirmId === item.id
                          ? "bg-rose-600 text-white shadow-xs px-2.5 animate-pulse"
                          : "text-rose-450 hover:text-rose-600 hover:bg-rose-50"
                      }`}
                      title={deleteConfirmId === item.id ? "Click again to confirm delete" : "Delete Product"}
                    >
                      <Trash2 size={13} />
                      {deleteConfirmId === item.id && <span className="text-[9px] font-sans">Confirm?</span>}
                    </button>
                  </div>

                  <a
                    href={getWhatsAppLink(item)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 py-2 px-3.5 bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold rounded-xl text-[10px] duration-150 shadow-xs shrink-0"
                    id={`items-page-whatsapp-${item.id}`}
                  >
                    <Send size={11} />
                    <span>WhatsApp Order</span>
                  </a>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Large Black Float Add Button (FAB) only loaded in this inventory tab view */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={openAddModal}
        className="fixed bottom-24 right-5 h-14 w-14 bg-black text-white rounded-full flex items-center justify-center shadow-2xl transition z-30 cursor-pointer border-2 border-white"
        id="fab-add-item"
        title="Add New Inventory Product"
      >
        <Plus size={28} />
      </motion.button>

      {/* Add / Edit product SaaS detail Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-2xs">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-105"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-sm sm:text-base font-black font-display flex items-center gap-1.5">
                    <span>🏬</span>
                    <span>{activeEditItem ? "Edit Product Metrics" : "Add Enterprise Product"}</span>
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Configure deep catalog specifications</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white h-7 w-7 rounded-full flex items-center justify-center bg-slate-800 text-xs font-bold cursor-pointer transition"
                >
                  ✕
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[80vh] space-y-4 text-xs text-left">
                
                {/* Product Name */}
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">PRODUCT / MATERIA NAME *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pure Cotton Fabric, Premium Wheat Grains, Electric Motors"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-bold text-slate-900"
                  />
                </div>

                {/* Categories & Custom Dynamism */}
                <div className="space-y-2 bg-slate-50/50 p-3 rounded-2xl border border-slate-150">
                  <div className="flex justify-between items-center">
                    <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">Product Category Section</label>
                    <button
                      type="button"
                      onClick={() => setShowNewCategoryField(!showNewCategoryField)}
                      className="text-[10px] text-emerald-650 font-extrabold text-emerald-600 hover:underline cursor-pointer"
                    >
                      {showNewCategoryField ? "Choose Existing" : "➕ Create Custom Category"}
                    </button>
                  </div>

                  {!showNewCategoryField ? (
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 focus:outline-none rounded-xl font-bold"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          📁 {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Type new category (e.g. Leather Goods, Metals)"
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-emerald-300 focus:outline-none rounded-xl font-bold"
                      />
                      <p className="text-[9px] text-slate-400">This category will persist in your custom workspace sections.</p>
                    </div>
                  )}
                </div>

                {/* Quantity and units */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">CURRENT STOCK</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 100"
                      value={qty}
                      onChange={(e) => setQty(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-display font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">Unit Measure</label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-bold"
                    >
                      <option value="Pcs">Pieces (Pcs)</option>
                      <option value="Kg">Kilogram (Kg)</option>
                      <option value="Ltr">Liters (Ltr)</option>
                      <option value="Mtr">Meters (Mtr)</option>
                      <option value="Bag">Bags (Bag)</option>
                      <option value="Box">Boxes (Box)</option>
                      <option value="Yards">Yards</option>
                      <option value="Dozen">Dozen</option>
                    </select>
                  </div>
                </div>

                {/* Financial Rates - Cost Price and Sale Price */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50/20 border border-emerald-100 rounded-2xl">
                  <div className="space-y-1">
                    <label className="font-extrabold text-emerald-800 block uppercase tracking-wider text-[9px]">Cost Price (Rs) *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="Purchase value"
                      value={costPrice}
                      onChange={(e) => setCostPrice(Number(e.target.value))}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none font-display font-medium text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[9px]">Sale Price (Rs) *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="Retail rate"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none font-display font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Supplier and Brand/Manufacturer */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">Brand / Manufacturer</label>
                    <input
                      type="text"
                      placeholder="e.g. Saffron Mills"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">Default Supplier</label>
                    <input
                      type="text"
                      placeholder="e.g. Al-Burhan Distributor"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Store Warehouse Location Rack and barcode sku */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">Warehouse Location / Shelf</label>
                    <input
                      type="text"
                      placeholder="e.g. Rack D-9"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">SKU / Barcode ID</label>
                    <input
                      type="text"
                      placeholder="e.g. COT-9012"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Expiry Date & Reorder Parameters */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">Expiry Date (if applicable)</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">Min Warn Quant limit</label>
                    <input
                      type="number"
                      min="1"
                      value={minQty}
                      onChange={(e) => setMinQty(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[10px]">Suggested Reorder Volume size</label>
                  <input
                    type="number"
                    min="1"
                    value={reorderQty}
                    onChange={(e) => setReorderQty(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                  />
                </div>

                {/* Actions */}
                <div className="pt-3.5 flex gap-2 justify-end border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 font-extrabold rounded-xl duration-150 cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="py-2.5 px-5 bg-slate-900 hover:bg-slate-850 text-white font-black rounded-xl duration-150 shrink-0 cursor-pointer shadow-sm disabled:opacity-50 text-xs"
                  >
                    {submitting ? "Saving record..." : "Save Product Details"}
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
