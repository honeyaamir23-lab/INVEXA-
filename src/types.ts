export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category: string;
}

export const initialInventory: InventoryItem[] = [
  {
    id: "snack-item-1",
    name: "Maida 40kg",
    quantity: 25,
    price: 3200,
    category: "Raw Materials"
  },
  {
    id: "snack-item-2",
    name: "Packaging Box",
    quantity: 1500,
    price: 15,
    category: "Packaging"
  },
  {
    id: "snack-item-3",
    name: "Fried Rolls",
    quantity: 450,
    price: 60,
    category: "Finished Goods"
  }
];

export interface Item extends InventoryItem {
  qty: number;
  unit: string;
  minQty: number;
  reorderQty: number;
  costPrice: number; // acquisition cost / purchase price (PKR)
  supplier?: string; // vendor name
  brand?: string; // manufacturer / brand name
  location?: string; // storage rack, shelf or warehouse location
  sku?: string; // custom barcode, catalog sku code
  expiryDate?: string; // expiration date
  userId: string;
  createdAt: string;
}

export interface StockMove {
  id: string;
  itemId: string;
  itemName: string;
  qty: number; // positive value
  type: "Stock In" | "Stock Out";
  reason: "Purchase" | "Sale" | "Adjustment";
  date: string; // YYYY-MM-DD
  userId: string;
  supplier?: string;
  notes?: string;
  price?: number; // Cost or Sale price
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "model";
  text: string;
  timestamp: string;
}

export interface LocalUser {
  uid: string;
  email: string;
  ownerName: string; // Business owner's name
  phone: string; // WhatsApp or Mobile contact number
  storeName: string; // Venture or Factory name
  businessType: string; // e.g. Factory, Wholesaler, General Store, Cafe
  pinCode: string; // 4-digit security login PIN code
}

// =========================================================================
// RECIPE-BASED AUTOMATION CENTER TYPES
// =========================================================================

export interface RecipeIngredient {
  itemId: string;      // Raw material item ID (e.g. Roll, Packing Envelope)
  itemName: string;    // Raw material name
  quantityPerUnit: number; // Qty required for 1 unit of final product (e.g. 0.576)
  unit: string;        // Unit of raw material (e.g. grams, Pcs)
}

export interface Recipe {
  id: string;
  userId: string;
  finalProductId: string;   // Final product item ID (e.g. Burger Snacks)
  finalProductName: string; // Final product name
  name: string;             // Recipe / BOM Name (e.g. Burger Snacks Recipe)
  ingredients: RecipeIngredient[];
  createdAt: string;
}

export interface RecipeLog {
  id: string;
  userId: string;
  recipeId: string;
  recipeName: string;
  finalProductId: string;
  finalProductName: string;
  producedQty: number; // Stock In Qty of final product (e.g. 10 Sacks)
  status: "success" | "failed";
  failureReason?: string;
  deductions: {
    itemId: string;
    itemName: string;
    quantity: number; // calculated as producedQty * quantityPerUnit
    unit: string;
  }[];
  createdAt: string;
}

