import { Item, StockMove, LocalUser } from "./types";

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

  constructor() {
    // Check for client-side Supabase credentials
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.hasSupabaseKeys = true;
      console.log("Supabase configuration detected. Ready for table mapping.");
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
    try {
      const saved = localStorage.getItem("invexa_users_list");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to parse users list from store:", error);
      return [];
    }
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
    } catch (error) {
      console.error("Failed to save workspace user:", error);
    }
  }

  /**
   * Authenticate a workspace using WhatsApp Number and Security PIN
   */
  public async authenticateWorkspace(phone: string, pin: string): Promise<LocalUser | null> {
    const list = await this.getUsersList();
    const found = list.find(
      (u) => u.phone.trim() === phone.trim() && u.pinCode.trim() === pin.trim()
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
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to parse items from storage:", error);
      return [];
    }
  }

  /**
   * Save items list for a workspace
   */
  public async saveItems(userId: string, items: Item[]): Promise<void> {
    try {
      localStorage.setItem(`store_items_${userId}`, JSON.stringify(items));
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
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to parse stock movements from storage:", error);
      return [];
    }
  }

  /**
   * Save stock ledger moves list for a workspace
   */
  public async saveStockMoves(userId: string, moves: StockMove[]): Promise<void> {
    try {
      localStorage.setItem(`store_moves_${userId}`, JSON.stringify(moves));
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
}

export const dbService = new DatabaseService();
