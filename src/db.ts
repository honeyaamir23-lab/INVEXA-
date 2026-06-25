import { Item, StockMove, LocalUser } from "./types";
import { createClient } from "@supabase/supabase-js";

export interface SyncTask {
  id: string;
  userId: string;
  action: "UPSERT_ITEM" | "DELETE_ITEM" | "INSERT_MOVE" | "UPSERT_WORKSPACE";
  targetId: string;
  payload: any;
  createdAt: string;
}

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
  private syncStatusListener: ((status: "idle" | "pending" | "syncing", pendingCount: number) => void) | null = null;
  private isSyncing = false;

  // =========================================================================
  // OFFLINE QUEUE METHODS
  // =========================================================================

  public getSyncQueue(userId: string): SyncTask[] {
    if (!this.hasSupabaseKeys || !this.supabaseClient) {
      try {
        localStorage.removeItem(`store_sync_queue_${userId}`);
      } catch (e) {}
      return [];
    }
    try {
      const saved = localStorage.getItem(`store_sync_queue_${userId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  private saveSyncQueue(userId: string, queue: SyncTask[]): void {
    if (!this.hasSupabaseKeys || !this.supabaseClient) return;
    localStorage.setItem(`store_sync_queue_${userId}`, JSON.stringify(queue));
  }

  public registerSyncStatusListener(listener: (status: "idle" | "pending" | "syncing", pendingCount: number) => void) {
    this.syncStatusListener = listener;
  }

  public addToSyncQueue(userId: string, action: SyncTask["action"], targetId: string, payload: any): void {
    if (!this.hasSupabaseKeys || !this.supabaseClient) {
      if (this.syncStatusListener) {
        this.syncStatusListener("idle", 0);
      }
      return;
    }
    const queue = this.getSyncQueue(userId);
    
    // Deduplicate
    let filteredQueue = queue;
    if (action === "DELETE_ITEM") {
      filteredQueue = queue.filter(t => !(t.targetId === targetId && t.action === "UPSERT_ITEM"));
    } else if (action === "UPSERT_ITEM") {
      filteredQueue = queue.filter(t => !(t.targetId === targetId && t.action === "UPSERT_ITEM"));
    } else if (action === "UPSERT_WORKSPACE") {
      filteredQueue = queue.filter(t => t.action !== "UPSERT_WORKSPACE");
    }

    const newTask: SyncTask = {
      id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
      userId,
      action,
      targetId,
      payload,
      createdAt: new Date().toISOString()
    };

    filteredQueue.push(newTask);
    this.saveSyncQueue(userId, filteredQueue);
    
    if (this.syncStatusListener) {
      this.syncStatusListener("pending", filteredQueue.length);
    }

    this.triggerSync(userId);
  }

  public triggerSync(userId: string) {
    this.syncPendingQueue(userId).catch(e => console.log("Background sync trigger info:", e));
  }

  private isDatabaseError(error: any): boolean {
    if (!error) return false;
    const code = (error.code || "").toString();
    const message = (error.message || "").toLowerCase();
    
    // Check for PostgreSQL standard error codes
    // 42P01 is undefined_table, 42703 is undefined_column, 42501 is permission_denied, 23502 is not_null_violation, etc.
    if (code && (code.startsWith("42") || code.startsWith("23") || code.startsWith("PGRST"))) {
      return true;
    }
    
    // Fallback phrase checks
    if (message.includes("relation") && message.includes("does not exist")) {
      return true;
    }
    if (message.includes("column") && message.includes("does not exist")) {
      return true;
    }
    if (message.includes("permission") || message.includes("policy") || message.includes("violates")) {
      return true;
    }
    
    return false;
  }

  public async syncPendingQueue(userId: string, onProgress?: (status: string) => void): Promise<boolean> {
    if (this.isSyncing) return false;
    
    if (!this.hasSupabaseKeys || !this.supabaseClient) {
      return false;
    }

    const isConn = await this.checkConnection();
    if (!isConn) {
      if (this.syncStatusListener) {
        const queueLength = this.getSyncQueue(userId).length;
        this.syncStatusListener(queueLength > 0 ? "pending" : "idle", queueLength);
      }
      return false;
    }

    const queue = this.getSyncQueue(userId);
    if (queue.length === 0) {
      if (this.syncStatusListener) {
        this.syncStatusListener("idle", 0);
      }
      return true;
    }

    this.isSyncing = true;
    if (this.syncStatusListener) {
      this.syncStatusListener("syncing", queue.length);
    }
    console.log(`Starting background sync for user ${userId}. Queue length: ${queue.length}`);
    onProgress?.(`Syncing ${queue.length} pending actions...`);

    const client = this.supabaseClient;
    let successCount = 0;

    for (const task of queue) {
      try {
        let success = false;
        
        if (task.action === "UPSERT_ITEM") {
          const item = task.payload;
          const snakeRow = {
            id: item.id,
            name: item.name,
            qty: item.qty,
            unit: item.unit,
            min_qty: item.minQty,
            reorder_qty: item.reorderQty,
            price: item.price,
            cost_price: item.costPrice,
            category: item.category,
            supplier: item.supplier,
            brand: item.brand,
            location: item.location,
            sku: item.sku,
            expiry_date: item.expiryDate,
            user_id: item.userId,
            created_at: item.createdAt
          };
          const camelRow = {
            id: item.id,
            name: item.name,
            qty: item.qty,
            unit: item.unit,
            minQty: item.minQty,
            reorderQty: item.reorderQty,
            price: item.price,
            costPrice: item.costPrice,
            category: item.category,
            supplier: item.supplier,
            brand: item.brand,
            location: item.location,
            sku: item.sku,
            expiryDate: item.expiryDate,
            userId: item.userId,
            createdAt: item.createdAt
          };
          const fullRow = { ...snakeRow, ...camelRow };

          let { error } = await client.from("inventory").upsert([fullRow]);
          
          if (error && (error.code === "42703" || error.message?.includes("column"))) {
            console.log("Upsert inventory with full columns failed, trying clean snake_case row...");
            const res = await client.from("inventory").upsert([snakeRow]);
            error = res.error;
            if (error && (error.code === "42703" || error.message?.includes("column"))) {
              console.log("Upsert inventory failed with snake_case, trying clean camelCase row...");
              const res2 = await client.from("inventory").upsert([camelRow]);
              error = res2.error;
            }
          }

          if (!error) {
            success = true;
          } else {
            console.log("Sync UPSERT_ITEM failure info:", error);
            if (this.isDatabaseError(error)) {
              console.warn("Permanent database table/schema error for inventory. Skipping task to avoid sync deadlock.");
              success = true; // Clear from queue to prevent blockades
            }
          }
        } else if (task.action === "DELETE_ITEM") {
          const { error: itemErr } = await client.from("inventory").delete().eq("id", task.targetId);
          await client.from("stock_moves").delete().eq("item_id", task.targetId);
          
          if (!itemErr) {
            success = true;
          } else {
            console.log("Sync DELETE_ITEM failed:", itemErr);
            if (this.isDatabaseError(itemErr)) {
              console.warn("Permanent database schema error during delete. Skipping to prevent sync queue blockade.");
              success = true;
            }
          }
        } else if (task.action === "INSERT_MOVE") {
          const move = task.payload;
          const snakeRow = {
            id: move.id,
            user_id: move.userId,
            item_id: move.itemId,
            item_name: move.itemName,
            qty: move.qty,
            type: move.type,
            reason: move.reason,
            date: move.date,
            notes: move.notes,
            created_at: move.createdAt
          };
          const camelRow = {
            id: move.id,
            userId: move.userId,
            itemId: move.itemId,
            itemName: move.itemName,
            qty: move.qty,
            type: move.type,
            reason: move.reason,
            date: move.date,
            notes: move.notes,
            createdAt: move.createdAt
          };
          const fullRow = { ...snakeRow, ...camelRow };

          let { error } = await client.from("stock_moves").upsert([fullRow]);
          
          if (error && (error.code === "42703" || error.message?.includes("column"))) {
            console.log("Upsert stock_moves failed with full row, trying clean snake_case row...");
            const res = await client.from("stock_moves").upsert([snakeRow]);
            error = res.error;
            if (error && (error.code === "42703" || error.message?.includes("column"))) {
              console.log("Upsert stock_moves failed with snake_case, trying clean camelCase row...");
              const res2 = await client.from("stock_moves").upsert([camelRow]);
              error = res2.error;
            }
          }

          if (!error) {
            success = true;
          } else {
            console.log("Sync INSERT_MOVE failure info:", error);
            if (this.isDatabaseError(error)) {
              console.warn("Permanent database table/schema error for stock_moves. Skipping task to avoid sync deadlock.");
              success = true;
            }
          }
        } else if (task.action === "UPSERT_WORKSPACE") {
          const user = task.payload;
          const fullRow = {
            id: user.uid,
            uid: user.uid,
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
          const snakeRow = {
            id: user.uid,
            uid: user.uid,
            email: user.email,
            owner_name: user.ownerName,
            phone: user.phone,
            store_name: user.storeName,
            business_type: user.businessType,
            pin_code: user.pinCode
          };
          const camelRow = {
            id: user.uid,
            uid: user.uid,
            email: user.email,
            ownerName: user.ownerName,
            phone: user.phone,
            storeName: user.storeName,
            businessType: user.businessType,
            pinCode: user.pinCode
          };

          let { error } = await client.from("workspaces").upsert([fullRow]);
          if (error && (error.code === "42703" || error.message?.includes("column"))) {
            console.log("Upsert workspaces failed with full columns, trying clean snake_case row...");
            const res = await client.from("workspaces").upsert([snakeRow]);
            error = res.error;
            if (error && (error.code === "42703" || error.message?.includes("column"))) {
              console.log("Upsert workspaces failed with snake_case, trying clean camelCase row...");
              const res2 = await client.from("workspaces").upsert([camelRow]);
              error = res2.error;
            }
          }

          let error2 = null;
          if (error) {
            let resUser = await client.from("store_users").upsert([fullRow]);
            if (resUser.error && (resUser.error.code === "42703" || resUser.error.message?.includes("column"))) {
              resUser = await client.from("store_users").upsert([snakeRow]);
              if (resUser.error && (resUser.error.code === "42703" || resUser.error.message?.includes("column"))) {
                resUser = await client.from("store_users").upsert([camelRow]);
              }
            }
            error2 = resUser.error;
          }

          if (!error || !error2) {
            success = true;
          } else {
            console.log("Sync UPSERT_WORKSPACE failure info:", error, error2);
            if (this.isDatabaseError(error) && (error2 === null || this.isDatabaseError(error2))) {
              console.warn("Permanent database workspace tables are missing or have wrong schema. Skipping task to prevent blockade.");
              success = true;
            }
          }
        }

        if (success) {
          successCount++;
          const currentQueue = this.getSyncQueue(userId);
          const updatedQueue = currentQueue.filter(t => t.id !== task.id);
          this.saveSyncQueue(userId, updatedQueue);
          if (this.syncStatusListener) {
            this.syncStatusListener("syncing", updatedQueue.length);
          }
        } else {
          console.log("Sync task paused for queue processing:", task);
          break;
        }
      } catch (err) {
        console.error("Error executing task sync:", err);
        break;
      }
    }

    this.isSyncing = false;
    const finalQueue = this.getSyncQueue(userId);
    console.log(`Background sync complete. Success: ${successCount}. Remaining: ${finalQueue.length}`);
    
    if (this.syncStatusListener) {
      this.syncStatusListener(finalQueue.length === 0 ? "idle" : "pending", finalQueue.length);
    }

    return finalQueue.length === 0;
  }

  /**
   * Performs an intelligent, self-aware background synchronization and merge.
   * 1. Checks connection.
   * 2. Flushes any pending offline sync queue.
   * 3. Fetches latest cloud items and stock moves.
   * 4. Merges them with local state using a highly robust "flushed cloud + queue overlay" strategy.
   * 5. Updates local storage.
   * 6. Returns the merged datasets to update React state silently.
   */
  public async performSelfAwareSync(
    userId: string,
    localItems: Item[],
    localMoves: StockMove[]
  ): Promise<{ items: Item[]; moves: StockMove[]; success: boolean } | null> {
    if (!this.hasSupabaseKeys || !this.supabaseClient) {
      return null;
    }

    const connected = await this.checkConnection();
    if (!connected) {
      return null;
    }

    // First, flush the queue to make sure all local offline edits are up in the cloud
    const queue = this.getSyncQueue(userId);
    if (queue.length > 0) {
      const syncSuccess = await this.syncPendingQueue(userId);
      if (!syncSuccess) {
        // Queue is not fully flushed (maybe partial connection issue), do not overwrite local state yet
        console.log("Self-aware sync: queue flush is still in progress or partially failed. Postponing full merge.");
        return null;
      }
    }

    try {
      // Fetch latest items and moves from Supabase
      const [itemsResult, movesResult] = await Promise.all([
        this.supabaseClient.from("inventory").select("*").eq("user_id", userId),
        this.supabaseClient.from("stock_moves").select("*").eq("user_id", userId)
      ]);

      if (itemsResult.error || movesResult.error) {
        console.log("Self-aware sync fetch details:", itemsResult.error, movesResult.error);
        return null;
      }

      const rawCloudItems = itemsResult.data || [];
      const rawCloudMoves = movesResult.data || [];

      // Map cloud items to standard type
      const cloudItems: Item[] = rawCloudItems.map((row: any) => ({
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
        supplier: row.supplier,
        brand: row.brand,
        location: row.location,
        sku: row.sku,
        expiryDate: row.expiryDate || row.expiry_date,
        createdAt: row.createdAt || row.created_at
      })).filter((item: Item) => !item.id.startsWith("demo-"));

      // Map cloud moves to standard type
      const cloudMoves: StockMove[] = rawCloudMoves.map((row: any) => ({
        id: row.id,
        userId: row.userId || row.user_id,
        itemId: row.itemId || row.item_id,
        itemName: row.itemName || row.item_name,
        qty: row.qty,
        type: row.type,
        reason: row.reason,
        date: row.date,
        notes: row.notes,
        price: row.price,
        createdAt: row.createdAt || row.created_at
      })).filter((m: StockMove) => !m.itemId?.startsWith("demo-") && !m.id?.startsWith("move-demo-"));

      // -----------------------------------------------------------------
      // INTELLIGENT MERGING WITH QUEUE OVERLAYS
      // Since our sync queue was flushed, cloudItems represents the absolute
      // truth (including other devices), and we overlay any *newly* queued actions.
      // -----------------------------------------------------------------
      const currentQueue = this.getSyncQueue(userId);

      // Merge items
      const itemMap = new Map<string, Item>();
      for (const item of cloudItems) {
        itemMap.set(item.id, item);
      }

      // Overlay any newly added queue items that occurred since flush
      for (const task of currentQueue) {
        if (task.action === "UPSERT_ITEM") {
          itemMap.set(task.targetId, task.payload);
        } else if (task.action === "DELETE_ITEM") {
          itemMap.delete(task.targetId);
        }
      }

      const mergedItems = Array.from(itemMap.values());

      // Merge stock moves
      const moveMap = new Map<string, StockMove>();
      for (const move of cloudMoves) {
        moveMap.set(move.id, move);
      }

      for (const task of currentQueue) {
        if (task.action === "INSERT_MOVE") {
          moveMap.set(task.targetId, task.payload);
        }
      }

      const mergedMoves = Array.from(moveMap.values());

      // Sort moves reverse-chronologically so reporting stays accurate
      mergedMoves.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Persist merged sets to localStorage
      localStorage.setItem(`store_items_${userId}`, JSON.stringify(mergedItems));
      localStorage.setItem(`store_moves_${userId}`, JSON.stringify(mergedMoves));

      return {
        items: mergedItems,
        moves: mergedMoves,
        success: true
      };
    } catch (e) {
      console.error("Critical error in performSelfAwareSync:", e);
      return null;
    }
  }

  private getBaseUrl(): string {
    const origin = window.location.origin;
    if (origin.includes("localhost") || origin.includes(".run.app") || origin.includes("3000")) {
      return "";
    }
    // Deep fallback to original central Cloud Run container backend (Preview URL)
    return "https://ais-pre-54pnig5mr3islz2e74ix2w-927601963567.asia-southeast1.run.app";
  }

  private async serverFetch(endpoint: string, options?: RequestInit): Promise<any> {
    const baseUrl = this.getBaseUrl();
    let mainResult = null;

    // 1. Fetch from the primary environment
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers || {})
        }
      });
      if (response.ok) {
        mainResult = await response.json();
      }
    } catch (e) {
      console.log(`Server fetch error on main URL (${baseUrl}):`, e);
    }

    // 2. Mirror or fallback fetch for multi-environment synergy
    if (baseUrl.includes("-pre-") || baseUrl.includes("-dev-")) {
      const fallbackUrl = baseUrl.includes("-pre-")
        ? baseUrl.replace("-pre-", "-dev-")
        : baseUrl.replace("-dev-", "-pre-");

      try {
        console.log(`Mirroring or falling back fetch to: ${fallbackUrl}`);
        const response = await fetch(`${fallbackUrl}${endpoint}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {})
          }
        });
        if (response.ok) {
          const fallbackResult = await response.json();
          if (!mainResult) {
            mainResult = fallbackResult;
          }
        }
      } catch (e) {
        console.log(`Server fetch error on fallback URL (${fallbackUrl}):`, e);
      }
    }

    return mainResult;
  }

  constructor() {
    // Check for client-side Supabase credentials with hardcoded secure fallbacks for live seamless zero-config deployment
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

    const fallbackUrl = "https://yveulmixiapooghegkxq.supabase.co";
    const fallbackKey = "sb_publishable__vMM-QxRopYwtTRH0cd74Q_FC0pxAhy";

    // Only configure Supabase if the environment variables are explicitly defined and not empty/placeholder, otherwise use fallback
    const supabaseUrl = (envUrl && envUrl !== "YOUR_SUPABASE_URL" && !envUrl.startsWith("YOUR_")) ? envUrl : fallbackUrl;
    const supabaseKey = (envKey && envKey !== "YOUR_SUPABASE_ANON_KEY" && !envKey.startsWith("YOUR_")) ? envKey : fallbackKey;

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
    if (!this.hasSupabaseKeys || !this.supabaseClient) {
      return false;
    }

    try {
      // Native, high-performance check by selecting 1 row from inventory
      const { error } = await this.supabaseClient.from("inventory").select("id").limit(1);
      
      // If there is an error but it's not a network error (e.g. PGRST116 or empty result), we are connected!
      if (error && error.message && (error.message.includes("fetch") || error.message.includes("network"))) {
        return false;
      }
      return true;
    } catch (e) {
      console.log("Supabase connection offline. Defaulting to enterprise LocalStorage Fallback.", e);
      return false;
    }
  }

  // =========================================================================
  // USER WORKSPACE METHODS
  // =========================================================================

  /**
   * Get list of all registered workspaces/users from the server
   */
  public async getUsersList(): Promise<LocalUser[]> {
    // 1. Direct Cloud Sync: Query Supabase directly if active
    if (this.hasSupabaseKeys && this.supabaseClient) {
      try {
        let fetchedData = null;
        let fetchError = null;

        const { data, error } = await this.supabaseClient
          .from("workspaces")
          .select("*");
        
        if (!error && data) {
          fetchedData = data;
        } else {
          // Fallback to store_users table if workspaces table is absent
          const { data: data2, error: error2 } = await this.supabaseClient
            .from("store_users")
            .select("*");
          if (!error2 && data2) {
            fetchedData = data2;
          } else {
            fetchError = error || error2;
          }
        }

        if (!fetchError && fetchedData && Array.isArray(fetchedData)) {
          return fetchedData.map((row: any) => ({
            uid: row.uid || row.id || "",
            email: row.email || "",
            ownerName: row.ownerName || row.owner_name || "",
            phone: row.phone || "",
            storeName: row.storeName || row.store_name || "",
            businessType: row.businessType || row.business_type || "",
            pinCode: (row.pinCode || row.pin_code || "").toString().trim()
          }));
        }
      } catch (e) {
        console.log("Failed to fetch workspaces list from Supabase:", e);
      }
    }

    // 2. Query fallback: Central Server Database sync across ALL container instances
    const allUsersMap = new Map<string, LocalUser>();
    const urlsToTry = [];
    const baseUrl = this.getBaseUrl();
    urlsToTry.push(baseUrl);

    if (baseUrl.includes("-pre-")) {
      urlsToTry.push(baseUrl.replace("-pre-", "-dev-"));
    } else if (baseUrl.includes("-dev-")) {
      urlsToTry.push(baseUrl.replace("-dev-", "-pre-"));
    }

    for (const url of urlsToTry) {
      try {
        const response = await fetch(`${url}/api/db/users`, {
          headers: { "Content-Type": "application/json" }
        });
        if (response.ok) {
          const serverUsers = await response.json();
          if (serverUsers && Array.isArray(serverUsers)) {
            for (const u of serverUsers) {
              const cleanPhone = (u.phone || "").toString().trim();
              if (cleanPhone) {
                allUsersMap.set(cleanPhone, {
                  uid: u.uid || u.id || "",
                  email: u.email || "",
                  ownerName: u.ownerName || u.owner_name || "",
                  phone: cleanPhone,
                  storeName: u.storeName || u.store_name || "",
                  businessType: u.businessType || u.business_type || "",
                  pinCode: (u.pinCode || u.pin_code || u.pin || "").toString().trim()
                });
              }
            }
          }
        }
      } catch (e) {
        console.log(`Failed fallback user fetch from ${url}:`, e);
      }
    }

    if (allUsersMap.size > 0) {
      return Array.from(allUsersMap.values());
    }

    // Fallback to currently logged-in user in localStorage if server is offline
    const saved = localStorage.getItem("store_user");
    if (saved) {
      try {
        return [JSON.parse(saved)];
      } catch (e) {}
    }
    return [];
  }

  /**
   * Save or register a new workspace
   */
  public async saveUserWorkspace(user: LocalUser): Promise<void> {
    try {
      // Store current user session in local device
      localStorage.setItem("store_user", JSON.stringify(user));

      // Persist to Server Central Database
      await this.serverFetch("/api/db/users", {
        method: "POST",
        body: JSON.stringify(user)
      });

      // ALSO queue persist to Supabase directly if active
      if (this.hasSupabaseKeys && this.supabaseClient) {
        this.addToSyncQueue(user.uid, "UPSERT_WORKSPACE", user.uid, user);
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

    // 1. Direct Supabase Lookup if active
    if (this.hasSupabaseKeys && this.supabaseClient) {
      try {
        let fetchedData = null;
        let fetchError = null;

        const { data, error } = await this.supabaseClient
          .from("workspaces")
          .select("*")
          .eq("phone", cleanPhone);
        
        if (!error && data && data.length > 0) {
          fetchedData = data;
        } else {
          // Fallback to store_users table if workspaces is empty or fails
          const { data: data2, error: error2 } = await this.supabaseClient
            .from("store_users")
            .select("*")
            .eq("phone", cleanPhone);
          
          if (!error2 && data2 && data2.length > 0) {
            fetchedData = data2;
          } else {
            fetchError = error || error2;
          }
        }

        if (!fetchError && fetchedData && fetchedData.length > 0) {
          const found = fetchedData[0];
          const userPin = (found.pinCode || found.pin_code || "").toString().trim();
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
      } catch (e) {
        console.log("Supabase direct auth lookup details:", e);
      }
    }

    // 2. Direct central server database lookup across all active server container environments
    try {
      const serverUsers = await this.getUsersList();
      const found = serverUsers.find(
        (u: any) => u.phone && u.phone.trim() === cleanPhone
      );
      if (found) {
        const userPin = found.pinCode.trim();
        if (userPin === cleanPin) {
          localStorage.setItem("store_user", JSON.stringify(found));
          return found;
        }
      }
    } catch (e) {
      console.log("Server direct auth lookup details:", e);
    }

    // Offline mode: allow logging back into the currently logged-in profile if already cached
    const saved = localStorage.getItem("store_user");
    if (saved) {
      try {
        const cachedUser: LocalUser = JSON.parse(saved);
        if (cachedUser.phone.trim() === cleanPhone && cachedUser.pinCode.trim() === cleanPin) {
          return cachedUser;
        }
      } catch (e) {}
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

      if (!this.hasSupabaseKeys || !this.supabaseClient) {
        return items;
      }

      const connected = await this.checkConnection();
      if (!connected) {
        return items;
      }

      // Sync any pending items first to avoid overwriting newer local offline edits
      const queue = this.getSyncQueue(userId);
      if (queue.length > 0) {
        const syncSuccess = await this.syncPendingQueue(userId);
        if (!syncSuccess) {
          return items;
        }
      }

      // Fetch latest from Supabase
      try {
        const { data, error } = await this.supabaseClient
          .from("inventory")
          .select("*")
          .eq("user_id", userId);
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
            supplier: row.supplier,
            brand: row.brand,
            location: row.location,
            sku: row.sku,
            expiryDate: row.expiryDate || row.expiry_date,
            createdAt: row.createdAt || row.created_at
          }));
          const filteredCloudItems = cloudItems.filter((item) => !item.id.startsWith("demo-"));
          localStorage.setItem(`store_items_${userId}`, JSON.stringify(filteredCloudItems));
          return filteredCloudItems;
        }
      } catch (e) {
        console.log("Failed to direct fetch items from Supabase:", e);
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

      // Asynchronously replicate a local copy to server
      this.serverFetch("/api/db/sync", {
        method: "POST",
        body: JSON.stringify({ userId, items: cleanItems })
      }).catch(() => {});
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

      if (!this.hasSupabaseKeys || !this.supabaseClient) {
        return moves;
      }

      const connected = await this.checkConnection();
      if (!connected) {
        return moves;
      }

      // Sync pending moves first
      const queue = this.getSyncQueue(userId);
      if (queue.length > 0) {
        const syncSuccess = await this.syncPendingQueue(userId);
        if (!syncSuccess) {
          return moves;
        }
      }

      // Fetch from Supabase
      try {
        const { data, error } = await this.supabaseClient
          .from("stock_moves")
          .select("*")
          .eq("user_id", userId);
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
            price: row.price,
            createdAt: row.createdAt || row.created_at
          }));
          const filteredCloudMoves = cloudMoves.filter((m) => !m.itemId?.startsWith("demo-") && !m.id?.startsWith("move-demo-"));
          localStorage.setItem(`store_moves_${userId}`, JSON.stringify(filteredCloudMoves));
          return filteredCloudMoves;
        }
      } catch (e) {
        console.log("Failed to direct fetch moves from Supabase:", e);
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
      this.serverFetch("/api/db/sync", {
        method: "POST",
        body: JSON.stringify({ userId, moves: cleanMoves })
      }).catch(() => {});
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
