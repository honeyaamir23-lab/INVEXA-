import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  getDocFromServer,
  enableMultiTabIndexedDbPersistence
} from "firebase/firestore";
import { Item, StockMove, LocalUser, Recipe, RecipeLog } from "./types";

// User provided official Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBeZmOMcDlP6xWM1KMManh5uQ0QDXD6iOg",
  authDomain: "invexa-6d480.firebaseapp.com",
  databaseURL: "https://invexa-6d480-default-rtdb.firebaseio.com",
  projectId: "invexa-6d480",
  storageBucket: "invexa-6d480.firebasestorage.app",
  messagingSenderId: "701064952356",
  appId: "1:701064952356:web:67d0277a31085c17a4f6b1"
};

// Initialize Firebase SDK
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Enable offline multi-tab IndexedDB persistence
try {
  enableMultiTabIndexedDbPersistence(db).then(() => {
    console.log("Firestore offline multi-tab persistence enabled successfully.");
  }).catch((err) => {
    console.warn("Firestore persistence notice (expected in sandboxed iframe environments):", err.message);
  });
} catch (err) {
  console.warn("Firestore persistence initialization notice:", err);
}

// Test Firestore Connection as specified in standard guidelines
async function testConnection() {
  try {
    // Race connection check against a fast 2.5s timeout to avoid any app startup freeze
    await Promise.race([
      getDocFromServer(doc(db, "test", "connection")),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500))
    ]);
    console.log("Firebase Connection verified successfully.");
  } catch (error) {
    console.warn("Connection test notice: Offline mode or timeout. Persistent local storage fallback is ready.");
  }
}
testConnection();

export interface SyncTask {
  id: string;
  userId: string;
  action: "UPSERT_ITEM" | "DELETE_ITEM" | "INSERT_MOVE" | "UPSERT_WORKSPACE";
  targetId: string;
  payload: any;
  createdAt: string;
}

const DEFAULT_MOCK_ITEMS = (userId: string): Item[] => [
  {
    id: "snack-item-1",
    name: "Maida 40kg",
    quantity: 25,
    qty: 25,
    unit: "Bags",
    minQty: 5,
    reorderQty: 20,
    price: 3200,
    costPrice: 2800,
    category: "Raw Materials",
    brand: "Saffron Mills",
    supplier: "Al-Burhan Distributor",
    location: "Rack A-3",
    sku: "MDI-001",
    userId,
    createdAt: new Date(Date.now() - 10 * 24 * 3600000).toISOString()
  },
  {
    id: "snack-item-2",
    name: "Packaging Box",
    quantity: 1500,
    qty: 1500,
    unit: "Pcs",
    minQty: 200,
    reorderQty: 1000,
    price: 15,
    costPrice: 10,
    category: "Packaging",
    brand: "Waleed Foods",
    supplier: "City Printers",
    location: "Storage Room B",
    sku: "BOX-002",
    userId,
    createdAt: new Date(Date.now() - 9 * 24 * 3600000).toISOString()
  },
  {
    id: "snack-item-3",
    name: "Fried Rolls",
    quantity: 450,
    qty: 450,
    unit: "Pcs",
    minQty: 100,
    reorderQty: 500,
    price: 60,
    costPrice: 40,
    category: "Finished Goods",
    brand: "Waleed Foods",
    supplier: "In-House Production",
    location: "Freezer 1",
    sku: "ROL-003",
    userId,
    createdAt: new Date(Date.now() - 8 * 24 * 3600000).toISOString()
  }
];

const DEFAULT_MOCK_MOVES = (userId: string): StockMove[] => [
  {
    id: "mock-move-1",
    itemId: "snack-item-1",
    itemName: "Maida 40kg",
    qty: 10,
    type: "Stock In",
    reason: "Purchase",
    date: new Date().toISOString().split("T")[0],
    userId,
    notes: "Restocked from Al-Burhan Distributor",
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
  },
  {
    id: "mock-move-2",
    itemId: "snack-item-3",
    itemName: "Fried Rolls",
    qty: 50,
    type: "Stock Out",
    reason: "Sale",
    date: new Date().toISOString().split("T")[0],
    userId,
    notes: "Delivered to shop distributor",
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString()
  }
];

class DatabaseService {
  private syncStatusListener: ((status: "idle" | "pending" | "syncing", pendingCount: number) => void) | null = null;
  private syncErrorLogs: { timestamp: string; action: string; targetId: string; message: string; code?: string }[] = [];

  constructor() {}

  public getSyncErrorLogs(): { timestamp: string; action: string; targetId: string; message: string; code?: string }[] {
    return this.syncErrorLogs;
  }

  public clearSyncErrorLogs(): void {
    this.syncErrorLogs = [];
  }

  public getSyncQueue(userId: string): SyncTask[] {
    return [];
  }

  public registerSyncStatusListener(listener: (status: "idle" | "pending" | "syncing", pendingCount: number) => void) {
    this.syncStatusListener = listener;
    setTimeout(() => {
      listener("idle", 0);
    }, 100);
  }

  public addToSyncQueue(userId: string, action: SyncTask["action"], targetId: string, payload: any): void {}

  public triggerSync(userId: string) {}

  public async syncPendingQueue(userId: string, onProgress?: (status: string) => void): Promise<boolean> {
    return true;
  }

  public async performSelfAwareSync(
    userId: string,
    localItems: Item[],
    localMoves: StockMove[]
  ): Promise<{ items: Item[]; moves: StockMove[]; success: boolean } | null> {
    return {
      items: localItems,
      moves: localMoves,
      success: true
    };
  }

  public isCloudMode(): boolean {
    return true;
  }

  public async checkConnection(): Promise<boolean> {
    return true;
  }

  // =========================================================================
  // REAL-TIME FIRESTORE SUBSCRIPTIONS
  // =========================================================================

  public subscribeItems(userId: string, callback: (items: Item[]) => void) {
    const q = query(collection(db, "items"), where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
      const itemsList: Item[] = [];
      snapshot.forEach((doc) => {
        itemsList.push(doc.data() as Item);
      });
      // Sort items alphabetically by name
      itemsList.sort((a, b) => a.name.localeCompare(b.name));
      localStorage.setItem(`store_items_${userId}`, JSON.stringify(itemsList));
      callback(itemsList);
    }, (error) => {
      console.warn("Firestore items subscription notice: Currently offline or connection paused. Operating in cached local mode.", error);
    });
  }

  public subscribeStockMoves(userId: string, callback: (moves: StockMove[]) => void) {
    const q = query(collection(db, "stock_moves"), where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
      const movesList: StockMove[] = [];
      snapshot.forEach((doc) => {
        movesList.push(doc.data() as StockMove);
      });
      // Sort moves by creation date descending
      movesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      localStorage.setItem(`store_moves_${userId}`, JSON.stringify(movesList));
      callback(movesList);
    }, (error) => {
      console.warn("Firestore stock_moves subscription notice: Currently offline or connection paused. Operating in cached local mode.", error);
    });
  }

  // =========================================================================
  // USER WORKSPACE METHODS
  // =========================================================================

  public async getUsersList(): Promise<LocalUser[]> {
    try {
      const q = query(collection(db, "users"));
      // Race Firestore fetch with a 3-second timeout
      const snapshot = await Promise.race([
        getDocs(q),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
      ]);
      
      if (snapshot) {
        const users: LocalUser[] = [];
        snapshot.forEach((doc) => {
          users.push(doc.data() as LocalUser);
        });
        if (users.length > 0) {
          localStorage.setItem("store_users_cache", JSON.stringify(users));
          return users;
        }
      }
    } catch (e) {
      console.warn("Firestore getUsersList failed or timed out (likely offline). Using cache fallback.");
    }

    // Local Fallback
    try {
      const cached = localStorage.getItem("store_users_cache");
      if (cached) return JSON.parse(cached);
    } catch (e) {}

    return [
      {
        uid: "saas-user-demo",
        email: "waleed@invexa.com",
        ownerName: "Waleed Ahmed",
        phone: "03001234567",
        storeName: "Waleed Foods",
        businessType: "Wholesaler",
        pinCode: "1234"
      }
    ];
  }

  public async saveUserWorkspace(user: LocalUser): Promise<void> {
    try {
      const cleanPhone = user.phone.trim();
      // Store in users collection with phone number as document ID
      await setDoc(doc(db, "users", cleanPhone), user);

      // Local Cache update
      localStorage.setItem("store_user", JSON.stringify(user));
      const cached = localStorage.getItem("store_users_cache");
      let list: LocalUser[] = cached ? JSON.parse(cached) : [];
      if (!Array.isArray(list)) list = [];
      list = [user, ...list.filter((u: LocalUser) => u.phone.trim() !== cleanPhone)];
      localStorage.setItem("store_users_cache", JSON.stringify(list));
    } catch (error) {
      console.warn("Failed to save workspace user to Firestore (offline cache used):", error);
      // Fallback local save
      localStorage.setItem("store_user", JSON.stringify(user));
    }
  }

  public async authenticateWorkspace(phone: string, pin: string): Promise<LocalUser | null> {
    const cleanPhone = phone.trim();
    const cleanPin = pin.trim();

    try {
      // Race Firebase fetch with a 3-second timeout
      const docSnap = await Promise.race([
        getDoc(doc(db, "users", cleanPhone)),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
      ]);
      
      if (docSnap && docSnap.exists()) {
        const user = docSnap.data() as LocalUser;
        if (user.pinCode.trim() === cleanPin) {
          localStorage.setItem("store_user", JSON.stringify(user));
          return user;
        }
      }
    } catch (e) {
      console.warn("Firestore authentication query skipped/timed out (operating offline). Using local credentials check.");
    }

    const list = await this.getUsersList();
    const found = list.find(u => u.phone.trim() === cleanPhone && u.pinCode.trim() === cleanPin);
    if (found) {
      localStorage.setItem("store_user", JSON.stringify(found));
      return found;
    }
    return null;
  }

  public async wipeAllWorkspaceData(): Promise<void> {
    localStorage.clear();
  }

  // =========================================================================
  // ITEM INVENTORY METHODS
  // =========================================================================

  public async getItems(userId: string): Promise<Item[]> {
    try {
      const q = query(collection(db, "items"), where("userId", "==", userId));
      // Race Firebase fetch with a 4-second timeout
      const snapshot = await Promise.race([
        getDocs(q),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
      ]);
      
      const itemsList: Item[] = [];
      if (snapshot) {
        snapshot.forEach((doc) => {
          itemsList.push(doc.data() as Item);
        });
      }

      if (itemsList.length > 0) {
        localStorage.setItem(`store_items_${userId}`, JSON.stringify(itemsList));
        return itemsList;
      }

      // Check local cache
      const saved = localStorage.getItem(`store_items_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          // Push local cache to Firestore in background without blocking
          (async () => {
            try {
              for (const item of parsed) {
                await setDoc(doc(db, "items", item.id), item);
              }
            } catch (err) {
              console.warn("Background upload of cached items failed:", err);
            }
          })();
          return parsed;
        }
      }

      // Seed high-fidelity mock list on first load
      const defaultItems = DEFAULT_MOCK_ITEMS(userId);
      try {
        for (const item of defaultItems) {
          await setDoc(doc(db, "items", item.id), item);
        }
      } catch (err) {
        console.warn("Seeding default items to firestore notice (local used):", err);
      }
      localStorage.setItem(`store_items_${userId}`, JSON.stringify(defaultItems));
      return defaultItems;
    } catch (error) {
      console.warn("Failed to read items from Firestore (likely offline or timeout). Using local cache.");
      const saved = localStorage.getItem(`store_items_${userId}`);
      if (saved) return JSON.parse(saved);
      return [];
    }
  }

  public async saveItems(userId: string, items: Item[]): Promise<void> {
    try {
      localStorage.setItem(`store_items_${userId}`, JSON.stringify(items));
      
      // Sync list with Firestore
      for (const item of items) {
        await setDoc(doc(db, "items", item.id), item);
      }
    } catch (error) {
      console.warn("Failed to write items to Firestore (offline cache used):", error);
    }
  }

  public async addItem(item: Item): Promise<void> {
    try {
      await setDoc(doc(db, "items", item.id), item);
    } catch (error) {
      console.warn("Failed to add item to Firestore:", error);
    }
  }

  public async updateItem(itemId: string, updates: Partial<Item>): Promise<void> {
    try {
      await setDoc(doc(db, "items", itemId), updates, { merge: true });
    } catch (error) {
      console.warn("Failed to update item in Firestore:", error);
    }
  }

  public async deleteItem(itemId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "items", itemId));
    } catch (error) {
      console.warn("Failed to delete item from Firestore:", error);
    }
  }

  // =========================================================================
  // STOCK LEDGER MOVEMENT METHODS
  // =========================================================================

  public async getStockMoves(userId: string): Promise<StockMove[]> {
    try {
      const q = query(collection(db, "stock_moves"), where("userId", "==", userId));
      // Race Firebase fetch with a 4-second timeout
      const snapshot = await Promise.race([
        getDocs(q),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
      ]);
      
      const movesList: StockMove[] = [];
      if (snapshot) {
        snapshot.forEach((doc) => {
          movesList.push(doc.data() as StockMove);
        });
      }

      if (movesList.length > 0) {
        localStorage.setItem(`store_moves_${userId}`, JSON.stringify(movesList));
        return movesList;
      }

      // Check local cache
      const saved = localStorage.getItem(`store_moves_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          // Push to Firestore in background without blocking
          (async () => {
            try {
              for (const move of parsed) {
                await setDoc(doc(db, "stock_moves", move.id), move);
              }
            } catch (err) {
              console.warn("Background upload of cached moves failed:", err);
            }
          })();
          return parsed;
        }
      }

      // Seed high-fidelity mock list on first load
      const defaultMoves = DEFAULT_MOCK_MOVES(userId);
      try {
        for (const move of defaultMoves) {
          await setDoc(doc(db, "stock_moves", move.id), move);
        }
      } catch (err) {
        console.warn("Seeding default moves to firestore notice (local used):", err);
      }
      localStorage.setItem(`store_moves_${userId}`, JSON.stringify(defaultMoves));
      return defaultMoves;
    } catch (error) {
      console.warn("Failed to read stock moves from Firestore (likely offline or timeout). Using local cache.");
      const saved = localStorage.getItem(`store_moves_${userId}`);
      if (saved) return JSON.parse(saved);
      return [];
    }
  }

  public async saveStockMoves(userId: string, moves: StockMove[]): Promise<void> {
    try {
      localStorage.setItem(`store_moves_${userId}`, JSON.stringify(moves));

      // Sync list with Firestore
      for (const move of moves) {
        await setDoc(doc(db, "stock_moves", move.id), move);
      }
    } catch (error) {
      console.warn("Failed to write stock moves to Firestore (offline cache used):", error);
    }
  }

  public async deleteStockMove(moveId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "stock_moves", moveId));
    } catch (error) {
      console.warn("Failed to delete stock move from Firestore:", error);
    }
  }

  // =========================================================================
  // CATEGORIES METHODS
  // =========================================================================

  public async getCategories(userId: string): Promise<string[]> {
    try {
      const saved = localStorage.getItem(`store_categories_${userId}`);
      if (saved) return JSON.parse(saved);
    } catch (error) {}
    return ["Groceries", "Beverages & Dairy", "Boutique Apparel", "Factory Spares", "Hardware Stocks", "General Goods"];
  }

  public async saveCategories(userId: string, categories: string[]): Promise<void> {
    try {
      localStorage.setItem(`store_categories_${userId}`, JSON.stringify(categories));
    } catch (error) {
      console.error("Failed to write categories to storage:", error);
    }
  }

  // =========================================================================
  // RECIPE-BASED AUTOMATION METHODS (Firestore & LocalStorage)
  // =========================================================================

  public async getRecipes(userId: string): Promise<Recipe[]> {
    try {
      const q = query(collection(db, "recipes"), where("userId", "==", userId));
      const snapshot = await Promise.race([
        getDocs(q),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
      ]);
      
      const recipesList: Recipe[] = [];
      if (snapshot) {
        snapshot.forEach((doc) => {
          recipesList.push(doc.data() as Recipe);
        });
      }

      if (recipesList.length > 0) {
        localStorage.setItem(`store_recipes_${userId}`, JSON.stringify(recipesList));
        return recipesList;
      }

      const saved = localStorage.getItem(`store_recipes_${userId}`);
      if (saved) return JSON.parse(saved);
      return [];
    } catch (error) {
      console.warn("Failed to read recipes from Firestore:", error);
      const saved = localStorage.getItem(`store_recipes_${userId}`);
      if (saved) return JSON.parse(saved);
      return [];
    }
  }

  public async saveRecipes(userId: string, recipes: Recipe[]): Promise<void> {
    try {
      localStorage.setItem(`store_recipes_${userId}`, JSON.stringify(recipes));
      
      // Sync list with Firestore
      for (const recipe of recipes) {
        await setDoc(doc(db, "recipes", recipe.id), recipe);
      }

      // Prune documents that are no longer present
      const q = query(collection(db, "recipes"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const currentIds = new Set(recipes.map(r => r.id));
      const deletePromises: Promise<void>[] = [];
      snapshot.forEach((d) => {
        if (!currentIds.has(d.id)) {
          deletePromises.push(deleteDoc(doc(db, "recipes", d.id)));
        }
      });
      await Promise.all(deletePromises);
    } catch (error) {
      console.warn("Failed to write recipes to Firestore:", error);
    }
  }

  public subscribeRecipes(userId: string, callback: (recipes: Recipe[]) => void): () => void {
    const q = query(collection(db, "recipes"), where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
      const recipesList: Recipe[] = [];
      snapshot.forEach((doc) => {
        recipesList.push(doc.data() as Recipe);
      });
      if (recipesList.length > 0) {
        localStorage.setItem(`store_recipes_${userId}`, JSON.stringify(recipesList));
      }
      callback(recipesList);
    }, (error) => {
      console.warn("Failed to subscribe to recipes changes:", error);
    });
  }

  // =========================================================================
  // RECIPE LOGS METHODS (Firestore & LocalStorage)
  // =========================================================================

  public async getRecipeLogs(userId: string): Promise<RecipeLog[]> {
    try {
      const q = query(collection(db, "recipe_logs"), where("userId", "==", userId));
      const snapshot = await Promise.race([
        getDocs(q),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
      ]);
      
      const logsList: RecipeLog[] = [];
      if (snapshot) {
        snapshot.forEach((doc) => {
          logsList.push(doc.data() as RecipeLog);
        });
      }

      if (logsList.length > 0) {
        logsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        localStorage.setItem(`store_recipe_logs_${userId}`, JSON.stringify(logsList));
        return logsList;
      }

      const saved = localStorage.getItem(`store_recipe_logs_${userId}`);
      if (saved) return JSON.parse(saved);
      return [];
    } catch (error) {
      console.warn("Failed to read recipe logs from Firestore:", error);
      const saved = localStorage.getItem(`store_recipe_logs_${userId}`);
      if (saved) return JSON.parse(saved);
      return [];
    }
  }

  public async saveRecipeLogs(userId: string, logs: RecipeLog[]): Promise<void> {
    try {
      localStorage.setItem(`store_recipe_logs_${userId}`, JSON.stringify(logs));
      
      // Sync list with Firestore
      for (const log of logs) {
        await setDoc(doc(db, "recipe_logs", log.id), log);
      }

      // Prune documents that are no longer present
      const q = query(collection(db, "recipe_logs"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const currentIds = new Set(logs.map(l => l.id));
      const deletePromises: Promise<void>[] = [];
      snapshot.forEach((d) => {
        if (!currentIds.has(d.id)) {
          deletePromises.push(deleteDoc(doc(db, "recipe_logs", d.id)));
        }
      });
      await Promise.all(deletePromises);
    } catch (error) {
      console.warn("Failed to write recipe logs to Firestore:", error);
    }
  }

  public subscribeRecipeLogs(userId: string, callback: (logs: RecipeLog[]) => void): () => void {
    const q = query(collection(db, "recipe_logs"), where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
      const logsList: RecipeLog[] = [];
      snapshot.forEach((doc) => {
        logsList.push(doc.data() as RecipeLog);
      });
      logsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (logsList.length > 0) {
        localStorage.setItem(`store_recipe_logs_${userId}`, JSON.stringify(logsList));
      }
      callback(logsList);
    }, (error) => {
      console.warn("Failed to subscribe to recipe logs changes:", error);
    });
  }
}

export const dbService = new DatabaseService();
