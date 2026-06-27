import { useState, useRef, useEffect } from "react";
import { Item, StockMove, ChatMessage } from "../types";
import { Send, Sparkles, X, Bot, User, RefreshCw, AlertCircle, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { dbService } from "../db";

// Resilient Offline/Local analysis engine to ensure 100% uptime for store owners
const getLocalAssistantResponse = (userText: string, items: Item[], moves: StockMove[]): string => {
  const query = userText.toLowerCase().trim();
  const isUrduScript = /[\u0600-\u06FF]/.test(userText);
  const isRomanUrdu = query.includes("bhai") || query.includes("hai") || query.includes("kya") || query.includes("karo") || query.includes("dikhao") || query.includes("kam") || query.includes("zyada") || query.includes("faida") || query.includes("nuqsan") || query.includes("kaise") || query.includes("ko");
  
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

  // 2. Format replies
  
  // A. Low Stock Query
  if (query.includes("low") || (query.includes("stock") && (query.includes("low") || query.includes("minimum") || query.includes("کم") || query.includes("شارٹ")))) {
    if (lowStockItems.length === 0) {
      if (isUrduScript) {
        return `🎉 **بہترین خبر!** آپ کے پاس کوئی بھی آئٹم شارٹ یا کم نہیں ہے۔ تمام پروڈکٹس کا اسٹاک مکمل ہے۔`;
      } else if (isRomanUrdu) {
        return `🎉 **Zabardast Khabar!** Aap ke paas koi bhi item short ya kam nahi hai. Sab items fully stocked hain.`;
      }
      return `**Great news!** All your products are fully stocked. There are currently **no low-stock items** in your store.`;
    }
    const list = lowStockItems.map(item => `- **${item.name}** (SKU: ${item.sku || "N/A"}): Current Qty: **${item.qty} ${item.unit}** (Min threshold: ${item.minQty} ${item.unit})`).join("\n");
    
    if (isUrduScript) {
      return `### ⚠️ کم اسٹاک الرٹ (Low Stock Alert)\nآپ کی **${lowStockItems.length}** پروڈکٹس کم از کم حد سے نیچے چل رہی ہیں:\n\n${list}\n\n*مشورہ: اسٹاک ختم ہونے سے پہلے ان آئٹمز کا آرڈر دیں!*`;
    } else if (isRomanUrdu) {
      return `### ⚠️ Low Stock Alert\nAap ki **${lowStockItems.length}** products minimum limit se kam hain:\n\n${list}\n\n*Mashwara: Stock khatam hone se pehle in items ko reorder karlein!*`;
    }
    return `### ⚠️ Low Stock Alert\nYou have **${lowStockItems.length}** product(s) running below their minimum limit:\n\n${list}\n\n*Suggestion: Please reorder these items soon to prevent stockouts!*`;
  }

  // B. Financials, Valuation, Profit Margin
  if (query.includes("valuation") || query.includes("profit") || query.includes("margin") || query.includes("worth") || query.includes("قیمت") || query.includes("مال") || query.includes("منافع") || query.includes("کل") || query.includes("فنانشل") || query.includes("invest") || query.includes("faida") || query.includes("munafa")) {
    if (isUrduScript) {
      return `### 📊 اسٹور کی مالی حالت اور ویلیو ایشن
یہاں آپ کی انوینٹری کا لائیو فنانشل ریکارڈ ہے:

- 📦 **کل فعال پروڈکٹس:** **${totalItems}** آئٹمز
- 💰 **کل انوینٹری لاگت (سرمایہ کاری):** **Rs. ${totalCost.toLocaleString()}**
- 🏷️ **اسٹور کی کل ریٹیل ویلیو (سیل قیمت):** **Rs. ${totalValue.toLocaleString()}**
- 📈 **ممکنہ کل منافع (Expected Profit):** **Rs. ${potentialProfit.toLocaleString()}**
- ✨ **اوسط منافع مارجن %:** **${marginPercentage.toFixed(1)}%**

*نوٹ: یہ حساب کتاب آپ کے لائیو اسٹاک اور خرید/فروخت کی قیمت پر مبنی ہے۔*`;
    } else if (isRomanUrdu) {
      return `### 📊 Store Financial & Valuation Status
Aap ki inventory ki live details niche di gayi hain:

- 📦 **Total Active Products:** **${totalItems}** items
- 💰 **Total Inventory Cost (Invesment):** **Rs. ${totalCost.toLocaleString()}**
- 🏷️ **Total Store Retail Value:** **Rs. ${totalValue.toLocaleString()}**
- 📈 **Expected Profit Margin:** **Rs. ${potentialProfit.toLocaleString()}**
- ✨ **Average Margin %:** **${marginPercentage.toFixed(1)}%**

*Note: Yeh calculation aap ke mojuda stock quantity aur buying/selling price par mabni hai.*`;
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

  // C. Out of Stock
  if (query.includes("out of") || query.includes("zero") || query.includes("ختم") || query.includes("khali")) {
    if (outOfStockItems.length === 0) {
      if (isUrduScript) {
        return `🎉 **بہت عمدہ!** آپ کے پاس کوئی بھی پروڈکٹ مکمل ختم نہیں ہوئی ہے۔ تمام پروڈکٹس کا اسٹاک موجود ہے!`;
      } else if (isRomanUrdu) {
        return `🎉 **Bohot Achhe!** Aap ke paas koi bhi product khatam nahi hui hai. Sab ka stock active hai!`;
      }
      return `🎉 **Amazing!** None of your products are completely out of stock. Everything has active inventory!`;
    }
    const list = outOfStockItems.map(item => `- **${item.name}** (SKU: ${item.sku || "N/A"})`).join("\n");
    
    if (isUrduScript) {
      return `### 🚫 ختم شدہ آئٹمز (Out of Stock)\nدرج ذیل **${outOfStockItems.length}** پروڈکٹس کا اسٹاک بالکل **0** ہو چکا ہے:\n\n${list}\n\n*فوری کام: نیا اسٹاک حاصل کرتے ہی ان کی تعداد کو اپ ڈیٹ کریں۔*`;
    } else if (isRomanUrdu) {
      return `### 🚫 Out of Stock Items\nIn **${outOfStockItems.length}** products ka stock bilkul **0** ho chuka hai:\n\n${list}\n\n*Zaroori kaam: New stock aate hi inki quantity update karein.*`;
    }
    return `### 🚫 Out of Stock Items\nThe following **${outOfStockItems.length}** product(s) have exactly **0** quantity remaining:\n\n${list}\n\n*Action needed: Update these stock levels as soon as you receive new shipments.*`;
  }

  // D. Stock movements history
  if (query.includes("move") || query.includes("history") || query.includes("ledger") || query.includes("تبدیلی") || query.includes("ریکارڈ") || query.includes("ہسٹری") || query.includes("chalu")) {
    if (!moves || moves.length === 0) {
      if (isUrduScript) {
        return `اس اسٹور میں ابھی تک اسٹاک کی کوئی حالیہ تبدیلی یا ریکارڈ درج نہیں کیا گیا ہے۔`;
      } else if (isRomanUrdu) {
        return `Is store mein abhi tak stock ki koi recent tabdeeli ya record save nahi kiya gaya.`;
      }
      return `There are no recent stock movements or log entries recorded in this store yet.`;
    }
    const recent = moves.slice(-5).reverse();
    const list = recent.map(m => `- **${m.itemName}**: **${m.qty > 0 ? "+" : ""}${m.qty}** (${m.type}) - *${m.reason}* on ${new Date(m.date).toLocaleDateString()}`).join("\n");
    
    if (isUrduScript) {
      return `### 📝 اسٹاک کی تبدیلیاں (حالیہ 5 ریکارڈز)\nیہاں اسٹاک کی حالیہ ایڈجسٹمنٹس کی تفصیل ہے:\n\n${list}`;
    } else if (isRomanUrdu) {
      return `### 📝 Recent Stock Moves (Last 5 Logs)\nStock mein hone wali haal hi ki tabdeeliyan:\n\n${list}`;
    }
    return `### 📝 Recent Stock Moves Log (Last 5)\nHere are the most recent inventory adjustments:\n\n${list}`;
  }

  // E. Greetings / Hello
  if (query.includes("hello") || query.includes("hi") || query.includes("hey") || query.includes("سلام") || query.includes("ہیلو") || query.includes("اپ کون") || query.includes("assalam") || query.includes("kaisa")) {
    if (isUrduScript) {
      return `### 👋 السلام علیکم! میں انویکسا اسمارٹ مینیجر اسسٹنٹ ہوں
آپ کا لائیو اسٹور ساتھی۔ میں انوینٹری کے مکمل ڈیٹا اور درست کیلکولیشن کے ساتھ تیار ہوں!

آپ مجھ سے ایسے سوالات پوچھ سکتے ہیں:
1. **"کون سے پروڈکٹس کا اسٹاک کم ہے؟"**
2. **"کل مالیت اور منافع کا حساب دکھاؤ"**
3. **"حالیہ انوینٹری تبدیلیاں ہسٹری پیش کرو"**
4. **"کون سی آئٹمز بالکل ختم ہو چکی ہیں؟"**

آج میں آپ کے کاروبار میں کس طرح مدد کر سکتا ہوں؟`;
    } else if (isRomanUrdu) {
      return `### 👋 Assalam-o-Alaikum! Main Invexa Smart Manager Assistant hoon
Aap ka live store companion. Main pure inventory data aur bilkul sahi calculations ke sath tayar hoon!

Aap mujhse aise sawalat pooch sakte hain:
1. **"Konsi products low in stock hain?"**
2. **"Total valuation aur profit margin dikhao"**
3. **"Recent stock moves history dikhao"**
4. **"Konsi items bilkul khatam ho chuki hain?"**

Aaj main aap ke business mein kis tarah madad kar sakta hoon?`;
    }
    return `### 👋 Assalam-o-Alaikum! I am INVEXA SMART MANAGER Assistant
Your resilient, built-in store companion. I am fully loaded with your live inventory context and ready to help!

You can ask me questions like:
1. **"Which products are low in stock?"**
2. **"What is the total valuation & profit margin?"**
3. **"Show recent stock moves history"**
4. **"Which items are completely out of stock?"**

How can I assist you with your business today?`;
  }

  // F. Specific product lookups
  const mentionedProduct = items.find(item => query.includes(item.name.toLowerCase()));
  if (mentionedProduct) {
    const margin = mentionedProduct.price - (mentionedProduct.costPrice || 0);
    const itemMarginPercent = mentionedProduct.price > 0 ? (margin / mentionedProduct.price) * 100 : 0;
    
    if (isUrduScript) {
      return `### 🔍 پروڈکٹ کی تفصیلات: ${mentionedProduct.name}
آپ کی منتخب کردہ پروڈکٹ کی لائیو معلومات درج ذیل ہیں:

- 📦 **موجودہ اسٹاک کی تعداد:** **${mentionedProduct.qty} ${mentionedProduct.unit}**
- ⚠️ **کم از کم حد (Min limit):** **${mentionedProduct.minQty} ${mentionedProduct.unit}**
- 🛒 **فروخت کی قیمت (Retail Price):** **Rs. ${mentionedProduct.price.toLocaleString()}**
- 💼 **خریداری کی قیمت (Cost Price):** **Rs. ${(mentionedProduct.costPrice || 0).toLocaleString()}**
- 📈 **منافع فی یونٹ (Unit Profit Margin):** **Rs. ${margin.toLocaleString()}** (${itemMarginPercent.toFixed(1)}%)
- 🏷️ **برانڈ اور کیٹیگری:** ${mentionedProduct.brand || "کوئی نہیں"} | ${mentionedProduct.category || "جنرل"}
- 📍 **اسٹور میں لوکیشن (خانہ):** ${mentionedProduct.location || "ڈیفالٹ شیلف"}
- 🔑 **SKU:** \`${mentionedProduct.sku || "N/A"}\`
${mentionedProduct.expiryDate ? `- 📅 **ایکسپائری تاریخ:** ${mentionedProduct.expiryDate}` : ""}

*اسٹیشن کی حالت:* ${mentionedProduct.qty <= mentionedProduct.minQty ? "⚠️ **آرڈر کی ضرورت ہے!** اسٹاک حد سے کم ہے۔" : "✅ **اسٹاک صحت مند ہے۔**"}`;
    } else if (isRomanUrdu) {
      return `### 🔍 Product Details: ${mentionedProduct.name}
Aap ki is product ki live details niche di gayi hain:

- 📦 **Mojuda Stock:** **${mentionedProduct.qty} ${mentionedProduct.unit}**
- ⚠️ **Minimum Limit:** **${mentionedProduct.minQty} ${mentionedProduct.unit}**
- 🛒 **Retail Price:** **Rs. ${mentionedProduct.price.toLocaleString()}**
- 💼 **Cost Price:** **Rs. ${(mentionedProduct.costPrice || 0).toLocaleString()}**
- 📈 **Unit Profit Margin:** **Rs. ${margin.toLocaleString()}** (${itemMarginPercent.toFixed(1)}%)
- 🏷️ **Brand & Category:** ${mentionedProduct.brand || "None"} | ${mentionedProduct.category || "General"}
- 📍 **Location:** ${mentionedProduct.location || "Default Shelf"}
- 🔑 **SKU:** \`${mentionedProduct.sku || "N/A"}\`
${mentionedProduct.expiryDate ? `- 📅 **Expiry Date:** ${mentionedProduct.expiryDate}` : ""}

*Status:* ${mentionedProduct.qty <= mentionedProduct.minQty ? "⚠️ **Reordering ki zaroorat hai!** Limit se kam hai." : "✅ **Stock level bilkul theek hai.**"}`;
    }

    return `### 🔍 Product Details: ${mentionedProduct.name}
Here is the live status for the product you mentioned:

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

  // G. Default Response
  if (isUrduScript) {
    return `### 💡 لائیو اسسٹنٹ
میں نے آپ کی درخواست کو اسٹور کی **${totalItems} فعال پروڈکٹس** اور اسٹاک ہسٹری کے مطابق پرکھا ہے:

- 📦 **کل فعال پروڈکٹس:** **${totalItems}**
- ⚠️ **کم اسٹاک الرٹس:** **${lowStockItems.length}** پروڈکٹس
- 💰 **اسٹور کی کل مالیت:** **Rs. ${totalValue.toLocaleString()}**

*میں آپ کا مخصوص سوال پوری طرح نہیں سمجھ سکا، براہ کرم "کم اسٹاک"، "کل مالیت"، یا کسی مخصوص پروڈکٹ کا نام لکھ کر بات کریں!*`;
  } else if (isRomanUrdu) {
    return `### 💡 Live Assistant
Main ne aap ki query ko **${totalItems} products** ke mutabiq check kiya hai:

- 📦 **Total Products:** **${totalItems}**
- ⚠️ **Low Stock Alert:** **${lowStockItems.length}** items kam hain
- 💰 **Total Valuation:** **Rs. ${totalValue.toLocaleString()}**

*Main aap ka sawal poori tarah samajh nahi saka. Aap "low stock", "total valuation", ya kisi specific product ka naam likh kar pooch sakte hain!*`;
  }

  return `### 💡 Live Merchant Assistant
I have analyzed your request against your **${totalItems} active products** and logged stock history:

- 📦 **Total Products:** **${totalItems}**
- ⚠️ **Low Stock Alert:** **${lowStockItems.length}** item(s) running low.
- 💰 **Total Inventory Net Worth:** **Rs. ${totalValue.toLocaleString()}**

*I didn't quite catch the specific details for your query. Try asking about **"low stock"**, **"total valuation"**, or mention a specific product name from your catalog!*`;
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
      
      // Resilient Dual-Environment Endpoint Lookup & Fallback System
      const baseUrl = dbService.getBaseUrl();
      const urls: string[] = [baseUrl];
      
      if (baseUrl.includes("-pre-")) {
        urls.push(baseUrl.replace("-pre-", "-dev-"));
      } else if (baseUrl.includes("-dev-")) {
        urls.push(baseUrl.replace("-dev-", "-pre-"));
      }

      let data = null;
      let lastError: any = null;

      for (const url of urls) {
        try {
          const endpointUrl = url ? `${url}/api/chat` : "/api/chat";
          console.log(`Sending ChatBot context API call to: ${endpointUrl}`);
          const response = await fetch(endpointUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [...messages, userMsg],
              inventoryContext,
            }),
          });

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
            // It's an error response (e.g., 500, 502, 504)
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

          data = parsed;
          break; // Succeeded! Exit the retry loop.
        } catch (err: any) {
          console.warn(`Chat request attempt failed on URL (${url}):`, err);
          lastError = err;
          
          // Fast fail if it's a structural server config error (e.g., API key missing) rather than a network disconnect/timeout
          const errorMsg = err.message || "";
          const isNetworkError = errorMsg.includes("Failed to fetch") || 
                                 errorMsg.includes("NetworkError") || 
                                 errorMsg.includes("Load failed") ||
                                 errorMsg.includes("unreachable") ||
                                 errorMsg.includes("json") ||
                                 errorMsg.includes("token");
                                 
          if (!isNetworkError && errorMsg !== "The server failed to respond.") {
            throw err; // Propagate critical issues (like missing API Key) directly to the user
          }
        }
      }

      if (!data) {
        console.log("Central servers unreachable or misconfigured. Running local offline engine...");
        const localReply = getLocalAssistantResponse(textToSend, items, moves);
        
        // Check if there was a structural server error (like missing API key) to append guidance
        const lastErrorMsg = (lastError?.message || "").toLowerCase();
        const isApiKeyIssue = lastErrorMsg.includes("key") || lastErrorMsg.includes("unauthorized") || lastErrorMsg.includes("configure");
        
        let warningText = "";
        if (isApiKeyIssue) {
          warningText = `\n\n---\n*💡 Developer Note: The server's GEMINI_API_KEY is not configured yet. Add it in the Settings panel of AI Studio to activate full AI features.*`;
        } else {
          warningText = `\n\n---\n*⚡ Running in local merchant engine mode (Offline Resilient Mode).*`;
        }
        
        data = {
          reply: `${localReply}${warningText}`
        };
      }

      // Add assistant response
      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        role: "assistant",
        text: data.reply,
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
                  <h3 className="font-extrabold text-[11px] md:text-xs">INVEXA ASSISTANT</h3>
                  <p className="text-[8px] text-[#25D366] font-semibold flex items-center gap-1">
                    <span className="h-1 w-1 bg-[#25D366] rounded-full animate-ping shrink-0" />
                    <span>Gemini Live Support</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer duration-150"
              >
                <X size={16} />
              </button>
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
