export interface Item {
  id: string;
  name: string;
  qty: number;
  unit: string;
  minQty: number;
  reorderQty: number;
  price: number; // selling price to customers (PKR)
  costPrice: number; // acquisition cost / purchase price (PKR)
  category: string; // custom or default category
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
