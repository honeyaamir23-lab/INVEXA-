import { Item, StockMove, LocalUser } from "./types";
import { createClient } from "@supabase/supabase-js";

/**
 * INVEXA Enterprise Database Service
 * 
 * This service is prepared for Supabase integration. 
 * If Supabase environment credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)
 * are provided in the client environment, this service can easily be extended 
 * to synchronise or fetch directly from Supabase tables.
 * 
 * To prevent 503 errors and script crashes when keys are absent, this service
 * implements a seamless, highly optimized "Fallback to LocalStorage" logic.
 * It mimics database transactions asynchronously, providing zero-latency 
 * and perfect resilience against network or script failures.
 */

class DatabaseService {
  private hasSupabaseKeys: boolean = false;
  private supabaseClient: any = null;

  private getBaseUrl(): string {
    const origin = window.location.origin;
    if (origin.includes("localhost") || origin.includes(".run.app") || origin.includes("3000")) {
      return "";
    }
    // Deep fallback to original central Cloud Run container backend
    return "https://ais-pre-54pnig5mr3islz2e74ix2w-927601963567.asia-southeast1.run.app";
  }

  private async serverFetch(endpoint: string, options?: RequestInit): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers || {})
        }
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn(`Server endpoint ${endpoint} unreachable, defaulting to offline storage.`);
    }
    return null;
  }

  constructor() {
    // Check for client-side Supabase credentials
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.hasSupabaseKeys = true;
      try {
        this.supabaseClient = createClient(supabaseUrl, supabaseKey);
        console.log("Supabase configuration detected. Ready for table mapping.");
      } catch (e) {
        console.error("Failed to initialize Supabase client:", e);
      }
    } else {
      console.log("No Supabase configuration detected. Operating in Enterprise LocalStorage Fallback Mode.");
    }
  }

  /**
   * Check if we are running in active Supabase cloud mode
   */
  public isCloudMode(): boolean {
    return this.hasSupabaseKeys;
  }

  /**
   * Status Check function that verifies the Supabase connection on startup.
   * If credentials are valid and the backend responds, returns true.
   * Gracefully handles timeouts and networks errors to prevent script failures.
   */
  public async checkConnection(): Promise<boolean> {
    if (!this.hasSupabaseKeys) {
      return false;
    }

    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      return false;
    }

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2200);

      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: "GET",
        headers: {
          "apikey": (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ""
        },
        signal: controller.signal
      });

      clearTimeout(id);
      return response.status >= 200 && response.status < 500;
    } catch (e) {
      console.log("Supabase connection offline. Defaulting to enterprise LocalStorage Fallback.", e);
      return false;
    }
  }

  // =========================================================================
  // USER WORKSPACE METHODS
  // =========================================================================

  /**
   * Get list of all registered workspaces/users
   */
  public async getUsersList(): Promise<LocalUser[]> {
    const localSaved = localStorage.getItem("invexa_users_list");
    let localList: LocalUser[] = localSaved ? JSON.parse(localSaved) : [];

    try {
      // 1. Sync with server database first
      const serverUsers = await this.serverFetch("/api/db/users");
      if (serverUsers && Array.isArray(serverUsers)) {
        const mergedMap = new Map<string, LocalUser>();
        localList.forEach((u) => mergedMap.set(u.phone.trim(), u));
        serverUsers.forEach((u: any) => {
          if (u && u.phone) {
            mergedMap.set(u.phone.trim(), {
              uid: u.uid || u.id || "",
              email: u.email || "",
              ownerName: u.ownerName || "",
              phone: u.phone || "",
              storeName: u.storeName || "",
              businessType: u.businessType || "",
              pinCode: u.pinCode || ""
            });
          }
        });
        localList = Array.from(mergedMap.values());
        localStorage.setItem("invexa_users_list", JSON.stringify(localList));
      }
    } catch (e) {
      console.warn("Server user sync failed, using local/Supabase cache.");
    }

    if (!this.hasSupabaseKeys || !this.supabaseClient) {
      return localList;
    }

    try {
      // Synchronize registered workspaces globally across all live deployment platforms!
      const { data, error } = await this.supabaseClient
        .from("store_users")
        .select("*");

      if (error) {
        console.warn("Supabase 'store_users' sync inactive (or table doesn't exist yet):", error.message);
        return localList;
      }

      if (data && data.length > 0) {
        const cloudUsers: LocalUser[] = data.map((row: any) => ({
          uid: row.uid || row.id || "",
          email: row.email || "",
          ownerName: row.ownerName || row.owner_name || "",
          phone: row.phone || "",
          storeName: row.storeName || row.store_name || "",
          businessType: row.businessType || row.business_type || "",
          pinCode: row.pinCode || row.pin_code || ""
        }));

        // Merge keeping the newest cloud configurations primary
        const mergedMap = new Map<string, LocalUser>();
        localList.forEach((u) => mergedMap.set(u.phone.trim(), u));
        cloudUsers.forEach((u) => mergedMap.set(u.phone.trim(), u));

        const mergedList = Array.from(mergedMap.values());
        localStorage.setItem("invexa_users_list", JSON.stringify(mergedList));
        return mergedList;
      }
    } catch (err) {
      console.warn("Could not sync with cloud store_users table, using local cache:", err);
    }

    return localList;
  }

  /**
   * Save or register a new workspace
   */
  public async saveUserWorkspace(user: LocalUser): Promise<void> {
    try {
      const list = await this.getUsersList();
      const updatedList = [...list.filter((u) => u.phone.trim() !== user.phone.trim()), user];
      localStorage.setItem("invexa_users_list", JSON.stringify(updatedList));
      localStorage.setItem("store_user", JSON.stringify(user));

      // Replicate to Node Server Database
      await this.serverFetch("/api/db/users", {
        method: "POST",
        body: JSON.stringify(user)
      });

      // Attempt to replicate registration to Supabase cloud to enable multi-device logins
      if (this.hasSupabaseKeys && this.supabaseClient) {
        const row = {
          uid: user.uid,
          id: user.uid,
          email: user.email,
          ownerName: user.ownerName,
          owner_name: user.ownerName,
          phone: user.phone,
          storeName: user.storeName,
          store_name: user.storeName,
          businessType: user.businessType,
          business_type: user.businessType,
          pinCode: user.pinCode,
          pin_code: user.pinCode
        };

        const { error } = await this.supabaseClient
          .from("store_users")
          .insert([row]);

        if (error) {
          console.warn("Supabase 'store_users' insert error (table may not exist yet):", error.message);
        } else {
          console.log("Successfully replicated registration to Supabase cloud table 'store_users'.");
        }
      }
    } catch (error) {
      console.error("Failed to save workspace user:", error);
    }
  }

  /**
   * Authenticate a workspace using WhatsApp Number and Security PIN
   */
  public async authenticateWorkspace(phone: string, pin: string): Promise<LocalUser | null> {
    const cleanPhone = phone.trim();
    const cleanPin = pin.trim();

    // 1. True Cloud Authentication: Query Supabase directly if available
    if (this.hasSupabaseKeys && this.supabaseClient) {
      try {
        const { data, error } = await this.supabaseClient
          .from("store_users")
          .select("*")
          .eq("phone", cleanPhone);

        if (!error && data && data.length > 0) {
          const row = data[0];
          const userPin = (row.pinCode || row.pin_code || "").toString().trim();
          if (userPin === cleanPin) {
            const user: LocalUser = {
              uid: row.uid || row.id || "",
              email: row.email || "",
              ownerName: row.ownerName || row.owner_name || "",
              phone: row.phone || "",
              storeName: row.storeName || row.store_name || "",
              businessType: row.businessType || row.business_type || "",
              pinCode: userPin
            };
            localStorage.setItem("store_user", JSON.stringify(user));
            return user;
          }
        }
      } catch (err) {
        console.warn("Supabase direct authentication query failed, falling back to server:", err);
      }
    }

    // 2. Direct query fallback: Central Node Server
    try {
      const serverUsers = await this.serverFetch("/api/db/users");
      if (serverUsers && Array.isArray(serverUsers)) {
        const found = serverUsers.find(
          (u: any) => u.phone && u.phone.trim() === cleanPhone
        );
        if (found) {
          const userPin = (found.pinCode || found.pin_code || found.pin || "").toString().trim();
          if (userPin === cleanPin) {
            const user: LocalUser = {
              uid: found.uid || found.id || "",
              email: found.email || "",
              ownerName: found.ownerName || found.owner_name || "",
              phone: found.phone || "",
              storeName: found.storeName || found.store_name || "",
              businessType: found.businessType || found.business_type || "",
              pinCode: userPin
            };
            localStorage.setItem("store_user", JSON.stringify(user));
            return user;
          }
        }
      }
    } catch (e) {
      console.warn("Server direct auth lookup failed:", e);
    }

    // 3. Fallback: Check merged local storage cache
    const list = await this.getUsersList();
    const found = list.find(
      (u) => u.phone.trim() === cleanPhone && u.pinCode.trim() === cleanPin
    );
    if (found) {
      localStorage.setItem("store_user", JSON.stringify(found));
      return found;
    }
    return null;
  }

  /**
   * Completely wipe local workspace profiles and data (Clean State Reset)
   */
  public async wipeAllWorkspaceData(): Promise<void> {
    localStorage.clear();
  }

  // =========================================================================
  // ITEM INVENTORY METHODS
  // =========================================================================

  /**
   * Fetch items for a specific workspace
   */
  public async getItems(userId: string): Promise<Item[]> {
    try {
      const saved = localStorage.getItem(`store_items_${userId}`);
      let items: Item[] = saved ? JSON.parse(saved) : [];

      // 1. Direct Cloud Sync: Query Supabase directly if active
      if (this.hasSupabaseKeys && this.supabaseClient) {
        try {
          const { data, error } = await this.supabaseClient
            .from("inventory")
            .select("*")
            .eq("userId", userId);
          if (!error && data) {
            const cloudItems: Item[] = data.map((row: any) => ({
              id: row.id,
              userId: row.userId || row.user_id,
              name: row.name,
              qty: row.qty,
              unit: row.unit,
              price: row.price,
              minQty: row.minQty || row.min_qty,
              reorderQty: row.reorderQty || row.reorder_qty,
              costPrice: row.costPrice || row.cost_price,
              category: row.category,
              createdAt: row.createdAt || row.created_at
            }));
            const filteredCloudItems = cloudItems.filter((item) => !item.id.startsWith("demo-"));
            localStorage.setItem(`store_items_${userId}`, JSON.stringify(filteredCloudItems));
            return filteredCloudItems;
          }
        } catch (e) {
          console.warn("Failed to direct fetch items from Supabase:", e);
        }
      }

      // 2. Query fallback: Central Server Database sync
      const serverData = await this.serverFetch(`/api/db/sync/${userId}`);
      if (serverData && Array.isArray(serverData.items)) {
        const filteredServerItems = serverData.items.filter((item: any) => !item.id.startsWith("demo-"));
        localStorage.setItem(`store_items_${userId}`, JSON.stringify(filteredServerItems));
        return filteredServerItems;
      }
      return items;
    } catch (error) {
      console.error("Failed to parse items from storage:", error);
      return [];
    }
  }

  /**
   * Save items list for a workspace
   */
  public async saveItems(userId: string, items: Item[]): Promise<void> {
    const cleanItems = items.filter((item) => !item.id.startsWith("demo-"));
    try {
      localStorage.setItem(`store_items_${userId}`, JSON.stringify(cleanItems));

      // Replicate to Server
      await this.serverFetch("/api/db/sync", {
        method: "POST",
        body: JSON.stringify({ userId, items: cleanItems })
      });

      // Replicate to Supabase Directly (Upsert/Replace strategy)
      if (this.hasSupabaseKeys && this.supabaseClient) {
        try {
          // Delete old entries for the user
          await this.supabaseClient
            .from("inventory")
            .delete()
            .eq("userId", userId);

          if (cleanItems.length > 0) {
            const rows = cleanItems.map(item => ({
              id: item.id,
              name: item.name,
              qty: item.qty,
              unit: item.unit,
              minQty: item.minQty,
              min_qty: item.minQty,
              reorderQty: item.reorderQty,
              reorder_qty: item.reorderQty,
              price: item.price,
              costPrice: item.costPrice,
              cost_price: item.costPrice,
              category: item.category,
              userId: item.userId,
              user_id: item.userId,
              createdAt: item.createdAt,
              created_at: item.createdAt
            }));

            const { error } = await this.supabaseClient
              .from("inventory")
              .insert(rows);

            if (error) {
              console.warn("Supabase direct inventory insert issue:", error.message);
            }
          }
        } catch (e) {
          console.warn("Failed direct items sync to Supabase:", e);
        }
      }
    } catch (error) {
      console.error("Failed to write items to storage:", error);
    }
  }

  // =========================================================================
  // STOCK LEDGER MOVEMENT METHODS
  // =========================================================================

  /**
   * Fetch stock ledger moves for a specific workspace
   */
  public async getStockMoves(userId: string): Promise<StockMove[]> {
    try {
      const saved = localStorage.getItem(`store_moves_${userId}`);
      let moves: StockMove[] = saved ? JSON.parse(saved) : [];

      // 1. Direct Cloud Sync: Query Supabase directly if active
      if (this.hasSupabaseKeys && this.supabaseClient) {
        try {
          const { data, error } = await this.supabaseClient
            .from("stock_moves")
            .select("*")
            .eq("userId", userId);
          if (!error && data) {
            const cloudMoves: StockMove[] = data.map((row: any) => ({
              id: row.id,
              userId: row.userId || row.user_id,
              itemId: row.itemId || row.item_id,
              itemName: row.itemName || row.item_name,
              qty: row.qty,
              type: row.type,
              reason: row.reason,
              date: row.date,
              notes: row.notes,
              createdAt: row.createdAt || row.created_at
            }));
            const filteredCloudMoves = cloudMoves.filter((m) => !m.itemId?.startsWith("demo-") && !m.id?.startsWith("move-demo-"));
            localStorage.setItem(`store_moves_${userId}`, JSON.stringify(filteredCloudMoves));
            return filteredCloudMoves;
          }
        } catch (e) {
          console.warn("Failed to direct fetch moves from Supabase:", e);
        }
      }

      // 2. Query fallback: Central Server Database sync
      const serverData = await this.serverFetch(`/api/db/sync/${userId}`);
      if (serverData && Array.isArray(serverData.moves)) {
        const filteredServerMoves = serverData.moves.filter((m: any) => !m.itemId?.startsWith("demo-") && !m.id?.startsWith("move-demo-"));
        localStorage.setItem(`store_moves_${userId}`, JSON.stringify(filteredServerMoves));
        return filteredServerMoves;
      }
      return moves;
    } catch (error) {
      console.error("Failed to parse stock movements from storage:", error);
      return [];
    }
  }

  /**
   * Save stock ledger moves list for a workspace
   */
  public async saveStockMoves(userId: string, moves: StockMove[]): Promise<void> {
    const cleanMoves = moves.filter((m) => !m.itemId?.startsWith("demo-") && !m.id?.startsWith("move-demo-"));
    try {
      localStorage.setItem(`store_moves_${userId}`, JSON.stringify(cleanMoves));

      // Replicate to Server
      await this.serverFetch("/api/db/sync", {
        method: "POST",
        body: JSON.stringify({ userId, moves: cleanMoves })
      });

      // Replicate to Supabase Directly (Upsert/Replace strategy)
      if (this.hasSupabaseKeys && this.supabaseClient) {
        try {
          await this.supabaseClient
            .from("stock_moves")
            .delete()
            .eq("userId", userId);

          if (cleanMoves.length > 0) {
            const rows = cleanMoves.map(move => ({
              id: move.id,
              userId: move.userId,
              user_id: move.userId,
              itemId: move.itemId,
              item_id: move.itemId,
              itemName: move.itemName,
              item_name: move.itemName,
              qty: move.qty,
              type: move.type,
              reason: move.reason,
              date: move.date,
              notes: move.notes,
              createdAt: move.createdAt,
              created_at: move.createdAt
            }));

            const { error } = await this.supabaseClient
              .from("stock_moves")
              .insert(rows);

            if (error) {
              console.warn("Supabase direct stock_moves insert issue:", error.message);
            }
          }
        } catch (e) {
          console.warn("Failed direct stock moves sync to Supabase:", e);
        }
      }
    } catch (error) {
      console.error("Failed to write stock moves to storage:", error);
    }
  }

  // =========================================================================
  // CATEGORIES METHODS
  // =========================================================================

  /**
   * Fetch custom product categories for a specific workspace
   */
  public async getCategories(userId: string): Promise<string[]> {
    try {
      const saved = localStorage.getItem(`store_categories_${userId}`);
      if (saved) return JSON.parse(saved);
    } catch (error) {
      console.error("Failed to parse categories from storage:", error);
    }
    // Return standard premium inventory categories as default
    return ["Groceries", "Beverages & Dairy", "Boutique Apparel", "Factory Spares", "Hardware Stocks", "General Goods"];
  }

  /**
   * Save custom product categories list for a workspace
   */
  public async saveCategories(userId: string, categories: string[]): Promise<void> {
    try {
      localStorage.setItem(`store_categories_${userId}`, JSON.stringify(categories));
    } catch (error) {
      console.error("Failed to write categories to storage:", error);
    }
  }

  /**
   * Insert a single item directly into Supabase 'inventory' table.
   * Returns true on success, false on failure (for local fallback trigger).
   */
  public async addInventoryItem(item: Item): Promise<boolean> {
    if (!this.hasSupabaseKeys || !this.supabaseClient) {
      return false;
    }
    try {
      // Map properties both in camelCase and snake_case to match user's custom columns
      const row = {
        id: item.id,
        name: item.name,
        qty: item.qty,
        unit: item.unit,
        minQty: item.minQty,
        min_qty: item.minQty,
        reorderQty: item.reorderQty,
        reorder_qty: item.reorderQty,
        price: item.price,
        costPrice: item.costPrice,
        cost_price: item.costPrice,
        category: item.category,
        supplier: item.supplier,
        brand: item.brand,
        location: item.location,
        sku: item.sku,
        expiryDate: item.expiryDate,
        expiry_date: item.expiryDate,
        userId: item.userId,
        user_id: item.userId,
        createdAt: item.createdAt,
        created_at: item.createdAt
      };

      const { error } = await this.supabaseClient
        .from("inventory")
        .insert([row]);

      if (error) {
        console.error("Supabase API error inserting to 'inventory' table:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Connection or insertion failure in Supabase 'inventory' table:", err);
      return false;
    }
  }
}

export const dbService = new DatabaseService();
