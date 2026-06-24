import { useState, useEffect, useRef } from "react";
import { Item, StockMove, LocalUser } from "./types";
import { dbService } from "./db";

// Sub Components
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Items from "./components/Items";
import StockMoves from "./components/StockMoves";
import Reports from "./components/Reports";
import ChatBot from "./components/ChatBot";

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
  Copy,
  Check,
  Upload,
  Download,
  X
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
  const [items, setItems] = useState<Item[]>(() => {
    const savedUser = localStorage.getItem("store_user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        const saved = localStorage.getItem(`store_items_${u.uid}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          const filtered = parsed.filter((item: Item) => !item.id.startsWith("demo-"));
          if (filtered.length !== parsed.length) {
            localStorage.setItem(`store_items_${u.uid}`, JSON.stringify(filtered));
          }
          return filtered;
        }
      } catch (e) {}
    }
    return [];
  });
  const [moves, setMoves] = useState<StockMove[]>(() => {
    const savedUser = localStorage.getItem("store_user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        const saved = localStorage.getItem(`store_moves_${u.uid}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          const filtered = parsed.filter((m: StockMove) => !m.itemId?.startsWith("demo-") && !m.id?.startsWith("move-demo-"));
          if (filtered.length !== parsed.length) {
            localStorage.setItem(`store_moves_${u.uid}`, JSON.stringify(filtered));
          }
          return filtered;
        }
      } catch (e) {}
    }
    return [];
  });
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);
  
  // Shared edit state between dashboard / items modal
  const [activeEditItem, setActiveEditItem] = useState<Item | null>(null);



  // Check Supabase connection status check on startup
  useEffect(() => {
    const checkSupabase = async () => {
      try {
        const connected = await dbService.checkConnection();
        setIsDbConnected(connected);
      } catch (err) {
        setIsDbConnected(false);
      }
    };
    checkSupabase();
  }, [user?.uid]);

  // Sync state with dbService
  useEffect(() => {
    if (user && !isLoggingOutRef.current) {
      dbService.saveItems(user.uid, items);
    }
  }, [items, user?.uid]);

  useEffect(() => {
    if (user && !isLoggingOutRef.current) {
      dbService.saveStockMoves(user.uid, moves);
    }
  }, [moves, user?.uid]);

  // Actions of local database: Add inventory items
  const handleAddItem = async (itemData: Omit<Item, "id" | "userId" | "createdAt">) => {
    if (!user) return;
    const newItem: Item = {
      ...itemData,
      id: generateId(),
      userId: user.uid,
      createdAt: new Date().toISOString(),
    };

    try {
      // Attempt to save directly to Supabase cloud database
      const success = await dbService.addInventoryItem(newItem);
      if (success) {
        console.log("Successfully stored item in Supabase 'inventory' table.");
      } else {
        console.warn("Supabase insert returned false. Saving to secure local browser storage fallback.");
      }
    } catch (err) {
      console.error("Supabase connection failed. Saving to secure local browser storage fallback:", err);
    }

    // Always update local React state (which syncs to localStorage) for resilient offline availability
    setItems((prev) => [...prev, newItem]);
  };

  // Actions of local database: Modify/update inventory items
  const handleUpdateItem = async (itemId: string, updates: Partial<Item>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    );
  };

  // Actions of local database: delete inventory items
  const handleDeleteItem = async (itemId: string) => {
    // Delete stock movements linked to this item to keep reporting integrity
    setMoves((prev) => prev.filter((m) => m.itemId !== itemId));
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Actions of local database: Book atomic Stock movements + auto updates Item stocks
  const handleAddMovement = async (moveData: Omit<StockMove, "id" | "userId" | "createdAt">) => {
    if (!user) return;
    
    const targetItem = items.find((i) => i.id === moveData.itemId);
    if (!targetItem) return;

    const newMove: StockMove = {
      ...moveData,
      id: generateId(),
      userId: user.uid,
      createdAt: new Date().toISOString(),
    };

    // Calculate Adjusted Item Stock Quantities
    const newQty = moveData.type === "Stock In" 
      ? targetItem.qty + moveData.qty 
      : Math.max(0, targetItem.qty - moveData.qty);

    setItems((prev) =>
      prev.map((item) => (item.id === moveData.itemId ? { ...item, qty: newQty } : item))
    );
    setMoves((prev) => [newMove, ...prev]);
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 text-emerald-650 animate-spin mx-auto text-emerald-600" />
          <p className="text-slate-500 font-medium text-xs font-mono">Syncing store catalog offline...</p>
        </div>
      </div>
    );
  }

  // Trigger modal inside Item page directly
  const triggerEditItemFromDashboard = (item: Item) => {
    setActiveEditItem(item);
    setActiveTab("items");
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
                const filteredItems = savedItems.filter((item: Item) => !item.id.startsWith("demo-"));
                const filteredMoves = savedMoves.filter((m: StockMove) => !m.itemId?.startsWith("demo-") && !m.id?.startsWith("move-demo-"));
                setItems(filteredItems);
                setMoves(filteredMoves);
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
                      onNavigateToTab={setActiveTab}
                      onEditItem={triggerEditItemFromDashboard}
                      isDbConnected={isDbConnected}
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
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Sticky Bottom Navigation Tabs styled exactly for native high performance mobile phone rendering */}
            <nav className="bg-white border-t border-slate-100 shadow-xl py-3.5 px-4 z-40 print:hidden shrink-0">
              <div className="max-w-md mx-auto grid grid-cols-4 gap-2">
                {/* Dashboard */}
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
                    activeTab === "dashboard" 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black shadow-lg shadow-emerald-600/15 scale-[1.03]" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                  id="nav-tab-dashboard"
                >
                  <Home size={17} />
                  <span className="text-[10px] font-bold tracking-tight">Dashboard</span>
                </button>

                {/* Items */}
                <button
                  onClick={() => setActiveTab("items")}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
                    activeTab === "items" 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black shadow-lg shadow-emerald-600/15 scale-[1.03]" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                  id="nav-tab-items"
                >
                  <Package size={17} />
                  <span className="text-[10px] font-bold tracking-tight">Inventory</span>
                </button>

                {/* Stock Moves */}
                <button
                  onClick={() => setActiveTab("moves")}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
                    activeTab === "moves" 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black shadow-lg shadow-emerald-600/15 scale-[1.03]" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                  id="nav-tab-moves"
                >
                  <RefreshCw size={17} />
                  <span className="text-[10px] font-bold tracking-tight">Ledger</span>
                </button>

                {/* Reports */}
                <button
                  onClick={() => setActiveTab("reports")}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${
                    activeTab === "reports" 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black shadow-lg shadow-emerald-600/15 scale-[1.03]" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                  id="nav-tab-reports"
                >
                  <BarChart3 size={17} />
                  <span className="text-[10px] font-bold tracking-tight">Reports</span>
                </button>
              </div>
            </nav>

            {/* Interactive Gemini Chat Assistant (Float) */}
            {activeTab === "dashboard" && (
              <div className="print:hidden">
                <ChatBot items={items} moves={moves} />
              </div>
            )}


          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
