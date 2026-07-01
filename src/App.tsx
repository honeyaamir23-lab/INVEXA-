import { useState, useEffect, useRef } from "react";
import { Item, StockMove, LocalUser, InventoryItem, initialInventory } from "./types";
import { dbService } from "./db";

// Sub Components
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Items from "./components/Items";
import StockMoves from "./components/StockMoves";
import Reports from "./components/Reports";
import InvexaAIManager from "./components/InvexaAIManager";

// UI / Animation
import { motion, AnimatePresence } from "motion/react";
import { 
  Home, 
  Package, 
  RefreshCw, 
  BarChart3, 
  LogOut, 
  User as UserIcon,
  Loader2,
  Database,
  ShieldCheck,
  Bot
} from "lucide-react";

const generateId = () => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

export default function App() {
  const isLoggingOutRef = useRef(false);
  const [user, setUser] = useState<LocalUser | null>(() => {
    const saved = localStorage.getItem("store_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  
  // Shared edit state between dashboard / items modal
  const [activeEditItem, setActiveEditItem] = useState<Item | null>(null);

  // Load items and moves on startup / user login & subscribe to real-time updates
  useEffect(() => {
    if (!user) {
      setItems([]);
      setMoves([]);
      return;
    }

    setAuthLoading(true);
    let isSubscribed = true;

    // Fetch initial data first
    Promise.all([
      dbService.getItems(user.uid),
      dbService.getStockMoves(user.uid)
    ]).then(([savedItems, savedMoves]) => {
      if (!isSubscribed) return;
      if (savedItems.length === 0) {
        const mappedItems: Item[] = initialInventory.map(inv => ({
          ...inv,
          qty: inv.quantity,
          unit: inv.id === "snack-item-1" ? "Bags" : "Pcs",
          minQty: inv.id === "snack-item-1" ? 5 : inv.id === "snack-item-2" ? 200 : 100,
          reorderQty: inv.id === "snack-item-1" ? 20 : inv.id === "snack-item-2" ? 1000 : 500,
          costPrice: inv.id === "snack-item-1" ? 2800 : inv.id === "snack-item-2" ? 10 : 40,
          userId: user.uid,
          createdAt: new Date().toISOString()
        }));
        setItems(mappedItems);
        dbService.saveItems(user.uid, mappedItems);
      } else {
        setItems(savedItems);
      }
      setMoves(savedMoves);
    }).catch(err => {
      console.error("Failed to load user workspace data:", err);
    }).finally(() => {
      if (isSubscribed) {
        setAuthLoading(false);
      }
    });

    // Subscribe to real-time changes
    const unsubscribeItems = dbService.subscribeItems(user.uid, (syncedItems) => {
      if (isSubscribed) {
        setItems(syncedItems);
      }
    });

    const unsubscribeMoves = dbService.subscribeStockMoves(user.uid, (syncedMoves) => {
      if (isSubscribed) {
        setMoves(syncedMoves);
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribeItems();
      unsubscribeMoves();
    };
  }, [user?.uid]);

  // Tab navigation handler
  const handleNavigateTab = (tabName: string) => {
    setActiveTab(tabName);
  };

  // Actions of local database: Add inventory items
  const handleAddItem = async (itemData: Omit<Item, "id" | "userId" | "createdAt">) => {
    if (!user) return;
    const newItem: Item = {
      ...itemData,
      id: generateId(),
      userId: user.uid,
      createdAt: new Date().toISOString(),
      quantity: itemData.qty !== undefined ? itemData.qty : 0,
    };

    // Immediate Local State Update for Zero-Latency responsiveness
    const updated = [...items, newItem];
    setItems(updated);
    await dbService.addItem(newItem);
  };

  // Actions of local database: Modify/update inventory items
  const handleUpdateItem = async (itemId: string, updates: Partial<Item>) => {
    if (!user) return;
    const processedUpdates = { ...updates };
    if (updates.qty !== undefined) {
      processedUpdates.quantity = updates.qty;
    }

    const updated = items.map((item) => (item.id === itemId ? { ...item, ...processedUpdates } : item));
    setItems(updated);
    await dbService.updateItem(itemId, processedUpdates);
  };

  // Actions of local database: delete inventory items
  const handleDeleteItem = async (itemId: string) => {
    if (!user) return;
    
    // Immediate Local State Update
    const updatedMoves = moves.filter((m) => m.itemId !== itemId);
    const updatedItems = items.filter((item) => item.id !== itemId);
    
    setMoves(updatedMoves);
    setItems(updatedItems);

    await dbService.deleteItem(itemId);
    
    // Also prune moves for this item in database atomically
    const movesToDelete = moves.filter((m) => m.itemId === itemId);
    await Promise.all(movesToDelete.map(m => dbService.deleteStockMove(m.id)));
  };

  // Actions of local database: Book atomic Stock movements + auto updates Item stocks via backend API
  const handleAddMovement = async (moveData: Omit<StockMove, "id" | "userId" | "createdAt">) => {
    if (!user) return;
    
    try {
      const response = await fetch("/api/stock-move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          ...moveData
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "سرور پر سٹاک کی بکنگ ناکام رہی۔");
      }

      const result = await response.json();
      if (result.autoTriggered) {
        console.log(`Recipe automation triggered: ${result.recipeName}`);
      }
    } catch (err: any) {
      alert(`سٹاک بکنگ میں خرابی: ${err.message}`);
      throw err;
    }
  };

  const handleLogout = () => {
    isLoggingOutRef.current = true;
    setUser(null);
    setItems([]);
    setMoves([]);
    localStorage.removeItem("store_user");
    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 150);
  };

  // Loading view
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center animate-pulse">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mx-auto" />
          <p className="text-slate-500 font-medium text-xs font-mono">Loading local secure vault...</p>
        </div>
      </div>
    );
  }

  // Trigger edit details page directly
  const triggerEditItemFromDashboard = (item: Item) => {
    setActiveEditItem(item);
    handleNavigateTab("items");
  };

  return (
    <div className="h-screen w-screen bg-neutral-50/50 text-slate-800 selection:bg-emerald-100 flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="login-screen-view"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="h-full w-full overflow-y-auto"
          >
            <Login 
              onLoginSuccess={async (loggedInUser) => {
                const savedItems = await dbService.getItems(loggedInUser.uid);
                const savedMoves = await dbService.getStockMoves(loggedInUser.uid);
                setItems(savedItems);
                setMoves(savedMoves);
                setUser(loggedInUser);
                setActiveTab("dashboard");
              }} 
            />
          </motion.div>
        ) : (
          <motion.div
            key="app-workspace-view"
            initial={{ opacity: 0, scale: 1.02, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -12 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            className="h-full w-full flex flex-col overflow-hidden"
          >
            {/* Upper Navigation Header Bar */}
            <header className="sticky top-0 bg-white/85 backdrop-blur-md border-b border-slate-100 z-40 px-4 py-3 shrink-0 print:hidden shadow-xs">
              <div className="max-w-5xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏬</span>
                  <span className="font-display font-extrabold text-[#111111] text-md tracking-tight">
                    {user.storeName || "INVEXA SMART MANAGER"}
                  </span>
                </div>

                {/* User Profile Action Details */}
                <div className="flex items-center gap-3">
                  {/* Offline Mode Indicator Badge */}
                  <div 
                    className="flex items-center text-xs"
                    title="All your data is saved securely on this device"
                  >
                    <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-3 py-1 font-extrabold text-[10px] shadow-3xs">
                      <ShieldCheck size={12} className="text-emerald-600" />
                      <span>Local Secure Vault</span>
                    </span>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100/70 p-1.5 rounded-full px-3 border border-slate-200/50">
                    <UserIcon size={12} className="text-emerald-600" />
                    <span className="truncate max-w-[120px] font-bold text-slate-700">{user.storeName || "Merchant"}</span>
                    <span className="text-slate-300">|</span>
                    <span className="truncate max-w-[120px] text-slate-500 font-mono">{user.email}</span>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-full transition cursor-pointer"
                    title="Sign Out"
                    id="header-logout-btn"
                  >
                    <LogOut size={15} />
                  </button>
                </div>
              </div>
            </header>

            {/* Main Tab Area Viewports */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {activeTab === "dashboard" && (
                    <Dashboard
                      items={items}
                      moves={moves}
                      onNavigateToTab={handleNavigateTab}
                      onEditItem={triggerEditItemFromDashboard}
                      isDbConnected={true}
                      onLogout={handleLogout}
                      onUpdateUser={setUser}
                    />
                  )}
                  {activeTab === "items" && (
                    <Items
                      user={user}
                      items={items}
                      onAddItem={handleAddItem}
                      onUpdateItem={handleUpdateItem}
                      onDeleteItem={handleDeleteItem}
                      activeEditItem={activeEditItem}
                      setActiveEditItem={setActiveEditItem}
                    />
                  )}
                  {activeTab === "moves" && (
                    <StockMoves
                      items={items}
                      moves={moves}
                      onAddMovement={handleAddMovement}
                    />
                  )}
                  {activeTab === "reports" && (
                    <Reports
                      items={items}
                      moves={moves}
                      user={user}
                    />
                  )}
                  {activeTab === "production" && (
                    <InvexaAIManager
                      items={items}
                      stockMoves={moves}
                      user={user}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Sticky Bottom Navigation Tabs styled exactly for native high performance mobile phone rendering */}
            <nav className="bg-white border-t border-slate-100 shadow-xl py-3.5 px-4 z-40 print:hidden shrink-0">
              <div className="max-w-md mx-auto grid grid-cols-5 gap-1.5">
                {/* Dashboard */}
                <button
                  onClick={() => handleNavigateTab("dashboard")}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
                    activeTab === "dashboard" 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black shadow-lg shadow-emerald-600/15 scale-[1.03]" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                  id="nav-tab-dashboard"
                >
                  <Home size={16} />
                  <span className="text-[9px] font-bold tracking-tight">Dashboard</span>
                </button>

                {/* Items */}
                <button
                  onClick={() => handleNavigateTab("items")}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
                    activeTab === "items" 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black shadow-lg shadow-emerald-600/15 scale-[1.03]" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                  id="nav-tab-items"
                >
                  <Package size={16} />
                  <span className="text-[9px] font-bold tracking-tight">Inventory</span>
                </button>

                {/* Production tab renamed to Invexa AI Manager */}
                <button
                  onClick={() => handleNavigateTab("production")}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
                    activeTab === "production" 
                      ? "bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-black shadow-lg shadow-purple-600/15 scale-[1.03]" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                  id="nav-tab-production"
                >
                  <Bot size={16} />
                  <span className="text-[9px] font-bold tracking-tight">AI Manager</span>
                </button>

                {/* Stock Moves */}
                <button
                  onClick={() => handleNavigateTab("moves")}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
                    activeTab === "moves" 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black shadow-lg shadow-emerald-600/15 scale-[1.03]" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                  id="nav-tab-moves"
                >
                  <RefreshCw size={16} />
                  <span className="text-[9px] font-bold tracking-tight">Ledger</span>
                </button>

                {/* Reports */}
                <button
                  onClick={() => handleNavigateTab("reports")}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
                    activeTab === "reports" 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black shadow-lg shadow-emerald-600/15 scale-[1.03]" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                  id="nav-tab-reports"
                >
                  <BarChart3 size={16} />
                  <span className="text-[9px] font-bold tracking-tight">Reports</span>
                </button>
              </div>
            </nav>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
