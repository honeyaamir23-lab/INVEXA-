import { useState, useRef, useEffect } from "react";
import { Item, StockMove, ChatMessage } from "../types";
import { Send, Sparkles, X, Bot, User, RefreshCw, AlertCircle, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { dbService } from "../db";

// Helper to find mentioned product in inventory using robust partial/token matching
const findMentionedProduct = (query: string, items: Item[]): Item | undefined => {
  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) return undefined;

  // 1. Exact or whole-string containment matches first (highest priority)
  for (const item of items) {
    const nameLower = item.name.toLowerCase();
    const skuLower = item.sku ? item.sku.toLowerCase() : "";

    if (cleanQuery === nameLower || nameLower === cleanQuery) {
      return item;
    }
    if (cleanQuery.includes(nameLower) || nameLower.includes(cleanQuery)) {
      return item;
    }
    if (skuLower && (cleanQuery.includes(skuLower) || skuLower.includes(cleanQuery))) {
      return item;
    }
  }

  // 2. Word-by-word intersection with filler words filtered out
  const fillers = new Set([
    "ka", "ki", "ko", "se", "aur", "bhi", "hai", "he", "kya", "kia", "batao", "btao", "dikhao", "stock", "price", "cost", "qty", "limit", "items", "product", "the", "for", "with", "and", "in", "of", "to", "at", "on", "a", "an", "کا", "کی", "کو", "سے", "اور", "بھی", "ہے", "کیا", "بتاؤ", "دکھاؤ", "اسٹاک", "سٹاک", "قیمت", "کے", "میں"
  ]);

  // Extract alphanumeric tokens from query
  const queryTokens = cleanQuery.split(/[^a-z0-9\u0600-\u06FF]+/).filter(t => t.length >= 2 && !fillers.has(t));
  if (queryTokens.length === 0) return undefined;

  let bestItem: Item | undefined = undefined;
  let maxScore = 0;

  for (const item of items) {
    const nameLower = item.name.toLowerCase();
    const itemTokens = nameLower.split(/[^a-z0-9\u0600-\u06FF]+/).filter(t => t.length >= 2 && !fillers.has(t));

    let score = 0;
    for (const qToken of queryTokens) {
      if (nameLower.includes(qToken)) {
        score += 3; // direct containment
      }
      for (const iToken of itemTokens) {
        if (iToken === qToken) {
          score += 5; // exact token match
        } else if (iToken.includes(qToken) || qToken.includes(iToken)) {
          score += 1;
        }
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestItem = item;
    }
  }

  return maxScore >= 3 ? bestItem : undefined;
};

// Resilient Offline/Local analysis engine to ensure 100% uptime for store owners
const getLocalAssistantResponse = (userText: string, items: Item[], moves: StockMove[]): string => {
  const query = userText.toLowerCase().trim();
  const isUrduScript = /[\u0600-\u06FF]/.test(userText);
  const words = query.split(/[^a-zA-Z]+/);
  const romanUrduDict = new Set([
    "bhai", "hai", "he", "kya", "kia", "karo", "dikhao", "kam", "zyada", "faida", "nuqsan", "kaise", "ko", "shuru", "btao", "batao", "khatam", "sasta", "mehnga", "mujhe", "bataen", "dikhaen", "hisaab", "hisab", "fayda", "nuksan", "gaya", "chal", "raha", "rahi", "haan", "na", "nahi", "nahin", "chahiye", "chahye", "ke", "ki", "se", "main", "mein", "shukriya", "shukria", "aur", "bhi", "ka", "ko", "ne", "tha", "thi", "the", "kar", "rha", "rhi", "rhey", "rahey"
  ]);
  const isRomanUrdu = words.some(w => romanUrduDict.has(w));
  
  // 1. Calculate stats
  const totalItems = items.length;
  const lowStockItems = items.filter(item => item.qty <= item.minQty);
  const outOfStockItems = items.filter(item => item.qty === 0);
  
  let totalCost = 0;
  let totalValue = 0;
  items.forEach(item => {
    totalCost += (item.costPrice || 0) * item.qty;
    totalValue += (item.price || 0) * item.qty;
  });
  const potentialProfit = totalValue - totalCost;
  const marginPercentage = totalValue > 0 ? (potentialProfit / totalValue) * 100 : 0;

  // Search for mentioned product using smart bilingually-optimized matching
  const mentionedProduct = findMentionedProduct(query, items);

  if (mentionedProduct) {
    const margin = mentionedProduct.price - (mentionedProduct.costPrice || 0);
    const itemMarginPercent = mentionedProduct.price > 0 ? (margin / mentionedProduct.price) * 100 : 0;
    
    if (isUrduScript) {
      return `### 🔍 پروڈکٹ کی تفصیلات: ${mentionedProduct.name}
آپ کی مطلوبہ پروڈکٹ کا لائیو ڈیٹا مندرجہ ذیل ہے:

- 📦 **موجودہ اسٹاک:** **${mentionedProduct.qty} ${mentionedProduct.unit}**
- ⚠️ **کم از کم مقررہ حد:** **${mentionedProduct.minQty} ${mentionedProduct.unit}**
- 🛒 **فروخت کی قیمت (ریٹیل):** **Rs. ${mentionedProduct.price.toLocaleString()}**
- 💼 **خریداری کی قیمت (لاگت):** **Rs. ${(mentionedProduct.costPrice || 0).toLocaleString()}**
- 📈 **منافع فی یونٹ:** **Rs. ${margin.toLocaleString()}** (${itemMarginPercent.toFixed(1)}%)
- 🏷️ **برانڈ اور کیٹیگری:** ${mentionedProduct.brand || "کوئی برانڈ نہیں"} | ${mentionedProduct.category || "جنرل"}
- 📍 **لوکیشن (شیلف نمبر):** ${mentionedProduct.location || "ڈیفالٹ شیلف"}
- 🔑 **SKU کوڈ:** \`${mentionedProduct.sku || "N/A"}\`
${mentionedProduct.expiryDate ? `- 📅 **ایکسپائری تاریخ:** ${mentionedProduct.expiryDate}` : ""}

*اسٹاک کی حالت:* ${mentionedProduct.qty <= mentionedProduct.minQty ? "⚠️ **فوری توجہ کی ضرورت ہے!** اسٹاک حد سے کم ہو گیا ہے۔" : "✅ **اسٹاک محفوظ حد میں ہے۔**"}`;
    } else if (isRomanUrdu) {
      return `### 🔍 Product Details: ${mentionedProduct.name}
Aap ki product ki mukammal live details niche di gayi hain:

- 📦 **Mojuda Stock:** **${mentionedProduct.qty} ${mentionedProduct.unit}**
- ⚠️ **Minimum Limit:** **${mentionedProduct.minQty} ${mentionedProduct.unit}**
- 🛒 **Retail Price:** **Rs. ${mentionedProduct.price.toLocaleString()}**
- 💼 **Cost Price (Khareed):** **Rs. ${(mentionedProduct.costPrice || 0).toLocaleString()}**
- 📈 **Profit Per Unit:** **Rs. ${margin.toLocaleString()}** (${itemMarginPercent.toFixed(1)}%)
- 🏷️ **Brand & Category:** ${mentionedProduct.brand || "None"} | ${mentionedProduct.category || "General"}
- 📍 **Location:** ${mentionedProduct.location || "Default Shelf"}
- 🔑 **SKU:** \`${mentionedProduct.sku || "N/A"}\`
${mentionedProduct.expiryDate ? `- 📅 **Expiry Date:** ${mentionedProduct.expiryDate}` : ""}

*Status:* ${mentionedProduct.qty <= mentionedProduct.minQty ? "⚠️ **Reorder Alert!** Stock warning limit se kam hai." : "✅ **Stock safe limit mein hai.**"}`;
    }
    return `### 🔍 Product Details: ${mentionedProduct.name}
Here is the live metadata and inventory state for this item:

- 📦 **Current Stock Level:** **${mentionedProduct.qty} ${mentionedProduct.unit}**
- ⚠️ **Min Stock Limit:** **${mentionedProduct.minQty} ${mentionedProduct.unit}**
- 🛒 **Retail Selling Price:** **Rs. ${mentionedProduct.price.toLocaleString()}**
- 💼 **Purchase Cost Price:** **Rs. ${(mentionedProduct.costPrice || 0).toLocaleString()}**
- 📈 **Unit Profit Margin:** **Rs. ${margin.toLocaleString()}** (${itemMarginPercent.toFixed(1)}%)
- 🏷️ **Brand & Category:** ${mentionedProduct.brand || "None"} | ${mentionedProduct.category || "General"}
- 📍 **Warehouse Location:** ${mentionedProduct.location || "Default Shelf"}
- 🔑 **SKU:** \`${mentionedProduct.sku || "N/A"}\`
${mentionedProduct.expiryDate ? `- 📅 **Expiry Date:** ${mentionedProduct.expiryDate}` : ""}

*Status:* ${mentionedProduct.qty <= mentionedProduct.minQty ? "⚠️ **Needs Reordering!** Running below limit." : "✅ **Stock Level Healthy.**"}`;
  }

  // AA. General Stock / Inventory Query
  if (query.includes("stock") || query.includes("سٹاک") || query.includes("انوینٹری") || query.includes("maal") || query.includes("mal") || query.includes("items") || query.includes("products") || query.includes("آئٹم") || query.includes("آئٹمز") || query.includes("inventory")) {
    const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
    const list = items.slice(0, 10).map(item => `- **${item.name}**: **${item.qty} ${item.unit}** (Price: Rs ${item.price.toLocaleString()})`).join("\n");
    const remainingCount = items.length - 10;
    const footer = remainingCount > 0 ? `\n*and ${remainingCount} more products in your catalog.*` : "";
    
    if (isUrduScript) {
      return `### 📦 اسٹاک کی موجودہ صورتحال (Stock Report)
آپ کے پاس کل **${totalItems}** پروڈکٹس رجسٹرڈ ہیں، اور کل اسٹاک کی مقدار **${totalQty}** یونٹس ہے۔

**اہم پروڈکٹس کا اسٹاک:**
${list || "کوئی پروڈکٹ ریکارڈ موجود نہیں ہے۔"}
${footer}

- ⚠️ **کم اسٹاک والی اشیاء:** **${lowStockItems.length}** پروڈکٹس
- 🚫 **آؤٹ آف اسٹاک اشیاء:** **${outOfStockItems.length}** پروڈکٹس

*اگر آپ کسی مخصوص پروڈکٹ کا اسٹاک معلوم کرنا چاہتے ہیں تو اس کا نام لکھیں!*`;
    } else if (isRomanUrdu) {
      return `### 📦 Current Stock Status
Aap ke paas total **${totalItems}** products listed hain, aur total stock quantity **${totalQty}** units hai.

**Main Products Stock:**
${list || "Koi product record majood nahi hai."}
${footer}

- ⚠️ **Low Stock Items:** **${lowStockItems.length}** products
- 🚫 **Out of Stock Items:** **${outOfStockItems.length}** products

*Kisi specific product ka stock dekhne ke liye uska naam likhein.*`;
    }
    return `### 📦 Current Stock Status
You have a total of **${totalItems}** registered products, with a total physical stock of **${totalQty}** units.

**Current Stock List (Top 10):**
${list || "No product records available."}
${footer}

- ⚠️ **Low Stock Warnings:** **${lowStockItems.length}** products
- 🚫 **Out of Stock Items:** **${outOfStockItems.length}** products

*To check stock for a specific item, please type its name directly.*`;
  }

  // A. Low Stock Query
  if (query.includes("low") || query.includes("short") || query.includes("reorder") || query.includes("کم") || query.includes("شارٹ") || query.includes("کم اسٹاک") || query.includes("limit")) {
    if (lowStockItems.length === 0) {
      if (isUrduScript) {
        return `🎉 **بہترین خبر!** آپ کے پاس کوئی بھی پروڈکٹ شارٹ یا کم نہیں ہے۔ تمام پروڈکٹس کا اسٹاک مکمل طور پر محفوظ ہے۔`;
      } else if (isRomanUrdu) {
        return `🎉 **Zabardast Khabar!** Aap ke paas koi bhi product short nahi hai. Sab items fully stocked hain!`;
      }
      return `**Great news!** All your products are fully stocked. There are currently **no low-stock items** in your store.`;
    }
    const list = lowStockItems.map(item => `- **${item.name}** (SKU: ${item.sku || "N/A"}): Current: **${item.qty} ${item.unit}** (Min: ${item.minQty})`).join("\n");
    
    if (isUrduScript) {
      return `### ⚠️ کم اسٹاک الرٹ (Low Stock Alert)
آپ کے پاس **${lowStockItems.length}** پروڈکٹس کم از کم مقررہ حد سے نیچے چل رہی ہیں:

${list}

*مشورہ: ان پروڈکٹس کا فوری طور پر آرڈر دیں تاکہ سیلز متاثر نہ ہوں۔*`;
    } else if (isRomanUrdu) {
      return `### ⚠️ Low Stock Alert
Aap ki **${lowStockItems.length}** products warning limit se kam chal rahi hain:

${list}

*Mashwara: In items ko jaldi reorder karlein taake customer khali haath na jaye!*`;
    }
    return `### ⚠️ Low Stock Alert
You have **${lowStockItems.length}** product(s) running below their minimum limit:

${list}

*Suggestion: Please reorder these items soon to prevent stockouts!*`;
  }

  // B. Out of Stock
  if (query.includes("out of") || query.includes("zero") || query.includes("khali") || query.includes("khatam") || query.includes("ختم") || query.includes("خالی") || query.includes("نہیں ہے")) {
    if (outOfStockItems.length === 0) {
      if (isUrduScript) {
        return `🎉 **بہت عمدہ!** آپ کا کوئی بھی مال ختم نہیں ہوا ہے۔ تمام پروڈکٹس کا کچھ نہ کچھ اسٹاک موجود ہے!`;
      } else if (isRomanUrdu) {
        return `🎉 **Bohot Achhe!** Aap ke paas koi bhi item bilkul khatam nahi hui hai. Sab ka stock active hai!`;
      }
      return `🎉 **Amazing!** None of your products are completely out of stock. Everything has active inventory!`;
    }
    const list = outOfStockItems.map(item => `- **${item.name}** (SKU: ${item.sku || "N/A"})`).join("\n");
    
    if (isUrduScript) {
      return `### 🚫 ختم شدہ اشیاء (Out of Stock Record)
درج ذیل **${outOfStockItems.length}** پروڈکٹس کا اسٹاک بالکل **0** (ختم) ہو چکا ہے:

${list}

*فوری کام: نئی شپمنٹ موصول ہوتے ہی ان آئٹمز کا اسٹاک درج کریں۔*`;
    } else if (isRomanUrdu) {
      return `### 🚫 Out of Stock Items
Aap ki **${outOfStockItems.length}** items bilkul khatam ho chuki hain (0 quantity):

${list}

*Zaroori kaam: New supply aate hi quantities update karein.*`;
    }
    return `### 🚫 Out of Stock Items
The following **${outOfStockItems.length}** product(s) have exactly **0** quantity remaining:

${list}

*Action needed: Update these stock levels as soon as you receive new shipments.*`;
  }

  // C. Financials, Valuation, Profit Margin, Investment
  if (query.includes("valuation") || query.includes("profit") || query.includes("margin") || query.includes("worth") || query.includes("cost") || query.includes("investment") || query.includes("capital") || query.includes("paisa") || query.includes("maliaat") || query.includes("budget") || query.includes("hisaab") || query.includes("hisab") || query.includes("حساب") || query.includes("لیجر") || query.includes("قيمت") || query.includes("قیمت") || query.includes("مال") || query.includes("منافع") || query.includes("کل") || query.includes("فنانشل") || query.includes("faida") || query.includes("munafa") || query.includes("invest") || query.includes("sarmaya") || query.includes("khareed") || query.includes("bech")) {
    if (isUrduScript) {
      return `### 📊 اسٹور کی مالی حالت اور ویلیو ایشن
یہاں آپ کی انوینٹری کا لائیو فنانشل ریکارڈ ہے:

- 📦 **کل فعال پروڈکٹس:** **${totalItems}** پروڈکٹس
- 💰 **کل انوینٹری لاگت (سرمایہ کاری):** **Rs. ${totalCost.toLocaleString()}**
- 🏷️ **اسٹور کی کل ریٹیل ویلیو (سیل قیمت):** **Rs. ${totalValue.toLocaleString()}**
- 📈 **ممکنہ کل منافع (Expected Profit):** **Rs. ${potentialProfit.toLocaleString()}**
- ✨ **اوسط منافع مارجن %:** **${marginPercentage.toFixed(1)}%**

*نوٹ: یہ حساب کتاب آپ کے لائیو اسٹاک اور خرید/فروخت کی قیمتوں پر مبنی ہے۔*`;
    } else if (isRomanUrdu) {
      return `### 📊 Store Financial & Valuation Status
Aap ki live inventory key financial details niche di gayi hain:

- 📦 **Total Active Products:** **${totalItems}** items
- 💰 **Total Inventory Cost (Investment):** **Rs. ${totalCost.toLocaleString()}**
- 🏷️ **Total Store Retail Value:** **Rs. ${totalValue.toLocaleString()}**
- 📈 **Expected Profit Margin:** **Rs. ${potentialProfit.toLocaleString()}**
- ✨ **Average Profit Margin %:** **${marginPercentage.toFixed(1)}%**

*Note: Yeh calculation aap ke live stock quantity aur rates par mabni hai.*`;
    }
    return `### 📊 Store Financial Overview
Here is the real-time financial valuation of your inventory:

- 📦 **Total Active Products:** **${totalItems}** items
- 💰 **Total Inventory Cost (Investment):** **Rs. ${totalCost.toLocaleString()}**
- 🏷️ **Total Store Retail Value:** **Rs. ${totalValue.toLocaleString()}**
- 📈 **Potential Profit Margin:** **Rs. ${potentialProfit.toLocaleString()}**
- ✨ **Average Profit Margin %:** **${marginPercentage.toFixed(1)}%**

*Note: These figures are based on your current stocked quantities and purchase/selling prices.*`;
  }

  // D. Most Stocked Items
  if (query.includes("most") || query.includes("highest stock") || query.includes("max") || query.includes("sab se zyada") || query.includes("zyada stock") || query.includes("زیادہ اسٹاک") || query.includes("بڑا اسٹاک")) {
    const sorted = [...items].sort((a, b) => b.qty - a.qty).slice(0, 3);
    const list = sorted.map((item, index) => `${index + 1}. **${item.name}**: **${item.qty} ${item.unit}** (Price: Rs ${item.price})`).join("\n");
    
    if (isUrduScript) {
      return `### 📈 سب سے زیادہ اسٹاک والی اشیاء (Top 3)
آپ کی انوینٹری میں درج ذیل اشیاء کا اسٹاک سب سے زیادہ ہے:

${list}

*ٹپ: زیادہ اسٹاک والے آئٹمز کی فروخت تیز کرنے کے لیے خصوصی پیکیج بنائیں۔*`;
    } else if (isRomanUrdu) {
      return `### 📈 Highest Stocked Items (Top 3)
Aap ki inventory mein sab se zyada stock in items ka hai:

${list}

*Tip: Zyada stock wali items ki sales mazeed barhane ke liye bundles banayein.*`;
    }
    return `### 📈 Highest Stocked Items (Top 3)
The following products currently have the largest quantity in stock:

${list}

*Strategy: Consider bundling high-stock items with others to accelerate sales turnover.*`;
  }

  // E. Cheapest / Lowest Price Items
  if (query.includes("cheapest") || query.includes("lowest price") || query.includes("sasta") || query.includes("kam qeemat") || query.includes("سستا") || query.includes("سستی") || query.includes("کم قیمت")) {
    const sorted = [...items].filter(item => item.price > 0).sort((a, b) => a.price - b.price).slice(0, 3);
    const list = sorted.map((item, index) => `${index + 1}. **${item.name}**: **Rs. ${item.price.toLocaleString()}** (Stock: ${item.qty} ${item.unit})`).join("\n");
    
    if (isUrduScript) {
      return `### 💰 سب سے سستی اشیاء (Top 3 Lowest Prices)
آپ کے اسٹور میں سب سے کم قیمت پر فروخت ہونے والی پروڈکٹس درج ذیل ہیں:

${list}`;
    } else if (isRomanUrdu) {
      return `### 💰 Cheapest Items (Top 3 Lowest Prices)
Aap ke store mein sab se kam price wali items yeh hain:

${list}`;
    }
    return `### 💰 Cheapest Items (Top 3 Lowest Prices)
The following products are priced lowest in your store catalog:

${list}`;
  }

  // F. Most Expensive / Highest Price Items
  if (query.includes("expensive") || query.includes("highest price") || query.includes("mehnga") || query.includes("zyada qeemat") || query.includes("مہنگا") || query.includes("مہنگی") || query.includes("زیادہ قیمت")) {
    const sorted = [...items].sort((a, b) => b.price - a.price).slice(0, 3);
    const list = sorted.map((item, index) => `${index + 1}. **${item.name}**: **Rs. ${item.price.toLocaleString()}** (Stock: ${item.qty} ${item.unit})`).join("\n");
    
    if (isUrduScript) {
      return `### 💎 سب سے مہنگی اشیاء (Top 3 Highest Prices)
آپ کے اسٹور میں سب سے زیادہ قیمت پر فروخت ہونے والی پریمیم اشیاء مندرجہ ذیل ہیں:

${list}`;
    } else if (isRomanUrdu) {
      return `### 💎 Most Expensive Items (Top 3 Premium Prices)
Aap ke store mein sab se mehngi products yeh hain:

${list}`;
    }
    return `### 💎 Most Expensive Items (Top 3 Premium Prices)
The following products represent the highest retail values in your store:

${list}`;
  }

  // G. Category Breakdown
  if (query.includes("category") || query.includes("categories") || query.includes("group") || query.includes("کیٹیگری") || query.includes("شعبہ")) {
    const catMap: Record<string, number> = {};
    items.forEach(item => {
      const cat = item.category || "General";
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    const list = Object.entries(catMap).map(([cat, count]) => `- **${cat}**: **${count}** items`).join("\n");
    
    if (isUrduScript) {
      return `### 🗂️ پروڈکٹ کیٹیگریز (Categories Breakdown)
آپ کی انوینٹری درج ذیل کیٹیگریز میں تقسیم کی گئی ہے:

${list}

*ٹپ: آپ کیٹیگری فلٹرز کا استعمال کر کے اپنی انوینٹری کو مزید بہتر تلاش کر سکتے ہیں۔*`;
    } else if (isRomanUrdu) {
      return `### 🗂️ Product Categories Breakdown
Aap ki inventory categories ki detail niche di gayi hai:

${list}`;
    }
    return `### 🗂️ Product Categories Breakdown
Here is the current distribution of items across categories:

${list}`;
  }

  // H. Suppliers
  if (query.includes("supplier") || query.includes("vendor") || query.includes("سپلائر") || query.includes("ڈیلر")) {
    const supMap: Record<string, number> = {};
    items.forEach(item => {
      const sup = item.supplier || "Not Configured";
      supMap[sup] = (supMap[sup] || 0) + 1;
    });
    const list = Object.entries(supMap).map(([sup, count]) => `- **${sup}**: Supplies **${count}** items`).join("\n");
    
    if (isUrduScript) {
      return `### 🤝 سپلائر کی تفصیلات (Suppliers & Vendors)
آپ کے رجسٹرڈ سپلائرز کی معلومات مندرجہ ذیل ہیں:

${list}`;
    } else if (isRomanUrdu) {
      return `### 🤝 Suppliers & Vendors List
Aap ke registered suppliers aur un se lee gayi items:

${list}`;
    }
    return `### 🤝 Suppliers & Vendors List
Here are your registered suppliers and the count of items supplied by each:

${list}`;
  }

  // I. Stock movements ledger
  if (query.includes("move") || query.includes("history") || query.includes("ledger") || query.includes("tabdeeli") || query.includes("recent") || query.includes("تبدیلی") || query.includes("ہسٹری") || query.includes("ریکارڈ")) {
    if (!moves || moves.length === 0) {
      if (isUrduScript) {
        return `اسٹور میں ابھی تک اسٹاک کی کوئی حالیہ تبدیلی یا ریکارڈ درج نہیں کیا گیا ہے۔`;
      } else if (isRomanUrdu) {
        return `Is store mein abhi tak stock ki koi recent tabdeeli ya record save nahi kiya gaya.`;
      }
      return `There are no recent stock movements or log entries recorded in this store yet.`;
    }
    const recent = moves.slice(-5).reverse();
    const list = recent.map(m => `- **${m.itemName}**: **${m.qty > 0 ? "+" : ""}${m.qty}** (${m.type}) - *${m.reason}* on ${new Date(m.date).toLocaleDateString()}`).join("\n");
    
    if (isUrduScript) {
      return `### 📝 اسٹاک کی تبدیلیاں (حالیہ 5 ریکارڈز)
یہاں اسٹاک کی حالیہ ایڈجسٹمنٹس کی تفصیل ہے:

${list}`;
    } else if (isRomanUrdu) {
      return `### 📝 Recent Stock Moves (Last 5 Logs)
Stock mein hone wali haal hi ki tabdeeliyan:

${list}`;
    }
    return `### 📝 Recent Stock Moves Log (Last 5)
Here are the most recent inventory adjustments:

${list}`;
  }

  // J. Expiry Checks
  if (query.includes("expiry") || query.includes("expired") || query.includes("date") || query.includes("expiring") || query.includes("ایکسپائری")) {
    const expiring = items.filter(item => item.expiryDate);
    if (expiring.length === 0) {
      if (isUrduScript) {
        return `🎉 **صحت مند اسٹاک!** آپ کی انوینٹری میں کسی بھی آئٹم پر کوئی ایکسپائری تاریخ درج نہیں ہے یا تمام محفوظ ہیں۔`;
      } else if (isRomanUrdu) {
        return `🎉 **Zabardast!** Aap ki products mein expiry dates ki koi urgent alert nahi hai.`;
      }
      return `There are no items flagged with active expiry dates in your database.`;
    }
    const list = expiring.map(item => `- **${item.name}**: Expires on **${item.expiryDate}** (Stock: ${item.qty} ${item.unit})`).join("\n");
    
    if (isUrduScript) {
      return `### 📅 ایکسپائری الرٹ (Expiry Track)
درج ذیل اشیاء کی ایکسپائری تاریخیں درج ہیں:

${list}

*مشورہ: زائد المعیاد ہونے سے پہلے ان اشیاء کی فروخت یقینی بنائیں۔*`;
    } else if (isRomanUrdu) {
      return `### 📅 Expiry Alert
Niche di gayi items par expiry dates register hain:

${list}`;
    }
    return `### 📅 Expiry Alert
The following items have registered expiry dates:

${list}`;
  }

  // K. Total Items Count
  if (query.includes("total items") || query.includes("how many items") || query.includes("count") || query.includes("تعداد") || query.includes("پروڈکٹس")) {
    if (isUrduScript) {
      return `### 📦 انوینٹری سمری (Inventory Summary)
آپ کے پاس فی الحال **${totalItems}** پروڈکٹس رجسٹرڈ ہیں:

- 📋 **فعال اشیاء کا کاؤنٹ:** **${totalItems}** SKU
- ⚠️ **کم اسٹاک اشیاء:** **${lowStockItems.length}** پروڈکٹس
- 🚫 **آؤٹ آف اسٹاک اشیاء:** **${outOfStockItems.length}** پروڈکٹس

*آپ کسی مخصوص کیٹیگری یا برانڈ کی تفصیل بھی جان سکتے ہیں۔*`;
    } else if (isRomanUrdu) {
      return `### 📦 Inventory Registry Count
Aap ke store mein total **${totalItems}** active products registered hain:

- 📋 **Total Products:** **${totalItems}** items
- ⚠️ **Low Stock Warns:** **${lowStockItems.length}** products
- 🚫 **Out of Stock:** **${outOfStockItems.length}** items`;
    }
    return `### 📦 Inventory Registry Count
Your store has a total of **${totalItems}** active products registered:

- 📋 **Total SKUs:** **${totalItems}** items
- ⚠️ **Low Stock Warning:** **${lowStockItems.length}** products
- 🚫 **Completely Empty Stock:** **${outOfStockItems.length}** items`;
  }

  // L. Business Advice / Growth Tips
  if (query.includes("grow") || query.includes("improve") || query.includes("profit") || query.includes("business") || query.includes("karobar") || query.includes("بڑھانے") || query.includes("طریقہ") || query.includes("مشورہ") || query.includes("طریقے") || query.includes("مشورے")) {
    if (isUrduScript) {
      return `### 🚀 کاروبار بڑھانے اور منافع بچانے کے مفید مشورے
آپ کی انوینٹری ڈیٹا کی بنیاد پر، میں نے درج ذیل تجاویز تیار کی ہیں:

1. ⚠️ **پہلے کم اسٹاک آئٹمز آرڈر کریں:** آپ کی **${lowStockItems.length}** اہم اشیاء کم ہیں، انہیں فوری خریدیں تاکہ گاہک واپس نہ جائے۔
2. 💰 **سرمایہ کاری کو رول کریں:** آپ کا کل سرمایہ **Rs. ${totalCost.toLocaleString()}** بند پڑا ہے۔ جو مال سست بکتا ہے اس کا اسٹاک کم رکھیں اور تیز بکنے والے مال پر فوکس کریں۔
3. 📈 **منافع مارجن پر کام کریں:** آپ کا اوسط منافع مارجن **${marginPercentage.toFixed(1)}%** ہے۔ کم منافع والی اشیاء کی جگہ ہائی مارجن پریمیم برانڈز کو جگہ دیں۔
4. 📝 **روزانہ لیجر اپ ڈیٹ رکھیں:** اسٹاک ان اور آؤٹ کا بروقت اندراج چوری اور غبن سے محفوظ رکھتا ہے۔

*انویکسا ہمیشہ آپ کے کاروبار کی ترقی کے لیے دعاگو ہے!*`;
    } else if (isRomanUrdu) {
      return `### 🚀 Business Grow Karne & Profit Barhane ke Tips
Aap ke live inventory data ke mutabiq niche diye gaye mashwaray bohot faide mand ho sakte hain:

1. ⚠️ **Low Stock pe focus karein:** Aap ki **${lowStockItems.length}** products limits se kam hain, inko foran purchase karein.
2. 💰 **Dead stock se bachein:** Total investment Rs. ${totalCost.toLocaleString()} hai. Jo items kam bikti hain unka stock thora rakhein taake cash flow block na ho.
3. 📈 **Profit margins check karein:** Average margin percentage **${marginPercentage.toFixed(1)}%** hai. High-profit margin items ko zyada promote karein.
4. 🤝 **Suppliers se negotiation karein:** Cost price kam karne ke liye suppliers se wholesale discounts demand karein.`;
    }
    return `### 🚀 Business Growth & Optimization Advice
Based on your current stock metrics, here are key action points to boost performance:

1. ⚠️ **Replenish Critical Stocks:** Restock the **${lowStockItems.length}** low-stock items immediately to prevent lost sales opportunities.
2. 💰 **Optimize Cash Capital Flow:** You have **Rs. ${totalCost.toLocaleString()}** tied up in physical stock. Identify slow-moving inventory and run discount deals to free up liquid cash.
3. 📈 **Enhance Pricing Strategy:** Your average margin is **${marginPercentage.toFixed(1)}%**. Try negotiating bulk buy discounts with your suppliers to raise individual unit margins.
4. 📝 **Log Every Movement:** Ensure all staff members strictly use Invexa to log Stock In / Stock Out, preventing shrinkage.`;
  }

  // M. Default / Greetings / Help
  if (isUrduScript) {
    return `### 👋 السلام علیکم! میں آپ کا انویکسا اسمارٹ اسسٹنٹ ہوں
کاروباری ترقی، اسٹاک کے حساب کتاب اور انوینٹری فنانسنگ کا ماہر ساتھی۔

آپ مجھ سے ایسے سوالات پوچھ سکتے ہیں، جن کا جواب لائیو اسٹاک کی بنیاد پر دیا جائے گا:
- **"کل اسٹور کی مالیت اور منافع کا حساب دکھاؤ"** (فنانشل ڈیٹا)
- **"کون سی پروڈکٹس کا اسٹاک کم ہے؟"** (ری آرڈر لسٹ)
- **"سب سے مہنگی اور سب سے سستی اشیاء کون سی ہیں؟"** (قیمتوں کا تقابل)
- **"کاروبار بڑھانے اور منافع کا مشورہ دو"** (بزنس ایڈوائس)
- یا کسی بھی مخصوص پروڈکٹ کا نام لکھیں جیسے: \`${items[0]?.name || "پروڈکٹ کا نام"}\`

*آج کاروبار کے کس پہلو میں مدد کروں؟*`;
  } else if (isRomanUrdu) {
    return `### 👋 Assalam-o-Alaikum! Main aap ka Invexa Smart Assistant hoon
Aap ka business companion jo live stock calculations aur financial analytics mein mahir hai.

Aap mujhse aise sawal pooch sakte hain:
- **"Total valuation aur profit margin dikhao"**
- **"Konsi items short ya low stock hain?"**
- **"Sab se mehngi aur sab se sasti items dikhao"**
- **"Business grow karne ke liye tips do"**
- Kisi specific product ka status poochne ke liye uska naam likhein!

*Aaj main aap ke business mein kis tarah madad kar sakta hoon?*`;
  }

  return `### 👋 Welcome to INVEXA SMART ASSISTANT
Your highly robust, intelligent, and offline-resilient business manager. I have complete access to your store and can help with calculations, valuations, and metrics!

Feel free to ask me anything:
- **"What is the total valuation & profit margin of my store?"**
- **"Show me the list of low stock items"**
- **"Which items are completely empty / out of stock?"**
- **"Show the latest stock movements log history"**
- **"Give me business growth advice based on my current data"**
- Type any specific product name from your catalog to view its live card details instantly.

How can I serve your business today?`;
};

const isSpecificLocalQuery = (userText: string, items: Item[]): boolean => {
  const query = userText.toLowerCase().trim();
  const keywords = [
    "stock", "سٹاک", "انوینٹری", "maal", "mal", "items", "products", "آئٹم", "آئٹمز", "inventory",
    "low", "short", "reorder", "کم", "کم اسٹاک", "out of", "zero", "khali", "khatam", "khatm", "khtm", "ختم", "خالی",
    "valuation", "profit", "margin", "worth", "cost", "investment", "capital", "paisa", "maliaat", "budget", "hisaab", "hisab", "حساب", "لیجر", "قیمت", "منافع", "کل", "فنانشل", "faida", "munafa", "invest", "sarmaya", "khareed", "bech",
    "most", "highest stock", "max", "sab se zyada", "cheapest", "sasta", "kam qeemat", "سستا", "expensive", "mehnga", "zyada qeemat", "مہنگا",
    "category", "categories", "کیٹیگری", "supplier", "vendor", "سپلائر",
    "move", "history", "ledger", "tabdeeli", "expiry", "expired", "expiring", "ایکسپائری",
    "total items", "count", "تعداد", "پروڈکٹس",
    "grow", "improve", "business", "karobar", "بڑھانے", "طریقہ", "مشورہ"
  ];
  
  // If query contains any of the target keywords
  if (keywords.some(keyword => query.includes(keyword))) {
    return true;
  }
  
  // If query mentions any specific product name in the catalog using smart matching
  const mentionedProduct = findMentionedProduct(query, items);
  if (mentionedProduct) {
    return true;
  }
  
  return false;
};

interface ChatBotProps {
  items: Item[];
  moves: StockMove[];
  isOnline: boolean;
}

export default function ChatBot({ items, moves, isOnline }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-msg",
      role: "assistant",
      text: "Hello! I am your INVEXA ASSISTANT. I can instantly analyze your total asset valuation, calculate profit margins, and review high-level trends. How can I assist your business today?",
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fabBtnRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea vertically as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  // Click outside to minimize popup logic
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isOpen) return;
      
      // If click falls outside both the chatbot pop-up and the toggle FAB button, close the chat
      if (
        chatContainerRef.current &&
        !chatContainerRef.current.contains(event.target as Node) &&
        fabBtnRef.current &&
        !fabBtnRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Generate real-time store context for our Gemini API
  const getContext = () => {
    const list = items.map(
      (i) => `- ${i.name} (SKU: ${i.sku || "N/A"}): ${i.qty} ${i.unit} (Price: Rs ${i.price}, Cost: Rs ${i.costPrice || i.price * 0.8}, Margin: ${(i.price - (i.costPrice || i.price * 0.8))} PKR, category: ${i.category}, supplier: ${i.supplier || "None"}, brand: ${i.brand || "None"}, location: ${i.location || "None"}, expiry: ${i.expiryDate || "None"})`
    ).join("\n");
    const lowStock = items.filter((i) => i.qty > 0 && i.qty <= i.minQty).map((i) => `${i.name} (SKU: ${i.sku || "N/A"})`).join(", ");
    const outOfStock = items.filter((i) => i.qty <= 0).map((i) => i.name).join(", ");
    const totalWorth = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const totalAcquisitionCost = items.reduce((sum, i) => sum + i.qty * (i.costPrice || i.price * 0.8), 0);

    const recentTx = moves
      .slice(0, 4)
      .map((m) => `- ${m.itemName}: ${m.type === "Stock In" ? "+" : "-"}${m.qty} (date: ${m.date}, reason: ${m.reason})`)
      .join("\n");

    return `
Total stock selling valuation: Rs ${totalWorth.toLocaleString("en-US")}
Total stock acquisition cost: Rs ${totalAcquisitionCost.toLocaleString("en-US")}
Total clean estimated markup value: Rs ${(totalWorth - totalAcquisitionCost).toLocaleString("en-US")}
Total registered SKU count: ${items.length}

Current Item Inventory Catalog:
${list || "No active inventory records listed."}

Low Stock Products (needs reorders):
${lowStock || "All products are at safe operating stock thresholds."}

Out of Stock Products (urgent):
${outOfStock || "No products are completely out of stock."}

Recent Activity Logs:
${recentTx || "No stock movements recorded in the ledger recently."}
`;
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    setError(null);
    if (!customText) setInput("");

    // Add user message to stack
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const inventoryContext = getContext();
      let data: any = null;
      let lastError: any = null;

      // 1. Try central Server-Side API Call with relative and fallback mirror URLs (no local interceptors)
      const baseUrl = dbService.getBaseUrl();
      const urls: string[] = ["", baseUrl];
      
      if (baseUrl && baseUrl.includes("-pre-")) {
        urls.push(baseUrl.replace("-pre-", "-dev-"));
      } else if (baseUrl && baseUrl.includes("-dev-")) {
        urls.push(baseUrl.replace("-dev-", "-pre-"));
      }

      // Filter out duplicate or empty URLs
      const uniqueUrls = Array.from(new Set(urls.map(u => u ? u.trim() : "")));

      for (const url of uniqueUrls) {
        try {
          const endpointUrl = url ? `${url}/api/chat` : "/api/chat";
          console.log(`Sending ChatBot context API call to: ${endpointUrl}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 6000); // 6 seconds timeout to allow server-side retries under load
          
          const response = await fetch(endpointUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [...messages, userMsg],
              inventoryContext,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          let parsed: any = null;
          if (response.ok) {
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              parsed = await response.json();
            } else {
              const text = await response.text();
              parsed = { reply: text };
            }
          } else {
            let errorText = "";
            try {
              const contentType = response.headers.get("content-type") || "";
              if (contentType.includes("application/json")) {
                const errJson = await response.json();
                errorText = errJson.error || errJson.message || "";
              } else {
                errorText = await response.text();
              }
            } catch (e) {
              errorText = `Status code ${response.status}`;
            }
            throw new Error(errorText || `The server returned an error (status: ${response.status}).`);
          }

          // If the server succeeded but returned a generic error response or safety warning, force fallback
          if (parsed && parsed.reply && typeof parsed.reply === "string") {
            const replyLower = parsed.reply.toLowerCase();
            const hasAPIErrorIndicator = replyLower.includes("quota exceeded") || 
                                        replyLower.includes("high demand") || 
                                        replyLower.includes("rate limit") || 
                                        replyLower.includes("unable to generate") || 
                                        replyLower.includes("sorry, i am unable");
            if (hasAPIErrorIndicator) {
              console.warn("Server response contains API limitation message, triggering offline fallback...");
              throw new Error("Generic API error response caught.");
            }
          }

          if (parsed) {
            data = parsed;
            break; // Succeeded! Exit the retry loop.
          }
        } catch (err: any) {
          console.warn(`Chat request attempt failed on URL (${url}):`, err);
          lastError = err;
        }
      }

      // 2. Fallback to resilient, bilingually-tailored offline manager engine if all else fails
      if (!data || !data.reply) {
        console.log("Central servers unreachable or misconfigured. Running offline fallback engine...");
        const isInventory = isSpecificLocalQuery(textToSend, items);
        if (isInventory) {
          const localReply = getLocalAssistantResponse(textToSend, items, moves);
          data = { reply: localReply };
        } else {
          data = {
            reply: "I am currently running offline or having trouble reaching the Gemini server. Please check your internet connection to ask general business questions. In offline mode, I can only help with stock level reports, asset valuations, and low-stock warnings."
          };
        }
      }

      // Robust string extraction to absolutely prevent rendering crashes (Objects are not valid as React children)
      let replyText = "I apologize, I am unable to process that request right now.";
      if (data && typeof data.reply === "string") {
        replyText = data.reply;
      } else if (data && typeof data.reply === "object" && data.reply !== null) {
        replyText = data.reply.text || JSON.stringify(data.reply);
      } else if (data && typeof data === "string") {
        replyText = data;
      }

      // Add assistant response
      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        role: "assistant",
        text: replyText,
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "A connection error occurred. Please verify your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  // Precompiled suggestion pills
  const suggestions = [
    "What is the total valuation & profit margin?",
    "Which products are low in stock?",
    "How can I grow my business profit?",
  ];

  return (
    <div>
      {/* WhatsApp-Style Sleek Floating Circle Button */}
      <motion.button
        id="chatbot-toggle-button"
        ref={fabBtnRef}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-[84px] right-5 h-12 w-12 rounded-full flex items-center justify-center shadow-2xl transition z-50 cursor-pointer border-2 border-white ${
          isOnline ? "bg-[#25D366] hover:bg-[#20ba5a]" : "bg-slate-400 hover:bg-slate-500"
        }`}
        title={isOnline ? "Ask Gemini Assistant" : "Gemini Assistant (Offline)"}
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={22} className="fill-white/10" />}
        {!isOpen && (
          <span className={`absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[7px] text-white font-extrabold border border-white ${
            isOnline ? "bg-amber-500 animate-pulse" : "bg-slate-500"
          }`}>
            {isOnline ? "AI" : "OFF"}
          </span>
        )}
      </motion.button>

      {/* Slide-over Compact Chat Box */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="chatbot-container"
            ref={chatContainerRef}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-[148px] right-5 left-5 md:left-auto md:w-[330px] bg-white overflow-hidden rounded-2xl shadow-2xl border border-slate-200 h-[410px] flex flex-col z-50"
          >
            {/* Header resembles premium assistant look */}
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 bg-[#25D366] text-white rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold">
                  AI
                </div>
                <div>
                  <h3 className="font-extrabold text-[11px] md:text-xs text-left">INVEXA ASSISTANT</h3>
                  <p className="text-[8px] text-[#25D366] font-semibold flex items-center gap-1 text-left">
                    <span className="h-1 w-1 bg-[#25D366] rounded-full animate-ping shrink-0" />
                    <span>Gemini Live Support</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-md cursor-pointer duration-150"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div
              ref={scrollRef}
              className="flex-grow p-3 overflow-y-auto space-y-2.5 bg-slate-50 text-slate-800"
            >
              {messages.map((m) => {
                const isAssistant = m.role === "assistant" || m.role === "model";
                return (
                  <div
                    key={m.id}
                    className={`flex gap-2 max-w-[88%] ${
                      isAssistant ? "mr-auto text-left" : "ml-auto flex-row-reverse text-right"
                    }`}
                  >
                    {/* Avatars */}
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 shadow-xs border ${
                        isAssistant ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-neutral-800 text-neutral-100 border-neutral-700"
                      }`}
                    >
                      {isAssistant ? <Bot size={11} /> : <User size={11} />}
                    </div>

                    {/* Chat Bubble */}
                    <div className="space-y-0.5">
                      <div
                        className={`p-2.5 rounded-2xl text-[11px] leading-relaxed font-medium ${
                          isAssistant
                            ? "bg-white text-slate-800 rounded-tl-none border border-slate-200/50 shadow-2xs"
                            : "bg-[#25D366] text-white rounded-tr-none text-left shadow-2xs"
                        }`}
                        style={{ whiteSpace: "pre-wrap" }}
                      >
                        {m.text}
                      </div>
                      <span className="text-[7px] text-slate-400 block px-1 mt-0.5">
                        {m.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Loader */}
              {loading && (
                <div className="flex gap-2 max-w-[80%] mr-auto text-left">
                  <div className="h-6 w-6 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center animate-spin border border-emerald-100">
                    <RefreshCw size={10} />
                  </div>
                  <div className="p-2.5 bg-white text-slate-400 rounded-2xl rounded-tl-none border border-slate-100 text-[11px] shadow-3xs italic">
                    Analyzing store metrics...
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="p-2.5 bg-rose-50 text-rose-800 rounded-2xl border border-rose-100 text-[11px] flex gap-2 items-start shadow-inner">
                  <AlertCircle size={12} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error:</span> {error}
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions Drawer Pills */}
            {messages.length < 4 && !loading && (
              <div className="px-2.5 py-1.5 bg-slate-50 overflow-x-auto whitespace-nowrap flex gap-1.5 border-t border-slate-100 shrink-0 scrollbar-none">
                {suggestions.map((s, index) => (
                  <button
                    key={index}
                    onClick={() => handleSendMessage(s)}
                    className="inline-block py-1 px-2.5 bg-white hover:bg-emerald-50 text-[#128C7E] border border-slate-200 hover:border-[#25D366] rounded-full text-[9px] font-bold duration-150 cursor-pointer shadow-3xs shrink-0"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Footer Input Bar */}
            {!isOnline ? (
              <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-center gap-1.5 shrink-0 text-slate-500 font-bold text-[10px]">
                <AlertCircle size={12} className="text-amber-500 shrink-0" />
                <span>🔌 AI Chatbot is offline. Reconnect to resume.</span>
              </div>
            ) : (
              <div className="p-2 border-t border-slate-100 bg-white flex items-end gap-2 shrink-0">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder="Ask about inventory, value..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={loading}
                  className="flex-grow px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#25D366] rounded-xl text-[11px] duration-150 text-slate-900 resize-none max-h-[120px] overflow-y-auto scrollbar-none"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={loading || !input.trim()}
                  className="h-8 w-8 bg-[#25D366] hover:bg-[#20ba5a] disabled:opacity-40 text-white rounded-lg flex items-center justify-center transition duration-150 shrink-0 cursor-pointer shadow-md self-end"
                >
                  <Send size={13} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
