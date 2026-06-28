import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const DB_FILE = path.join(process.cwd(), "data", "store_db.json");

// Helper to read database
function readDB() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], items: {}, moves: {} }, null, 2));
    }
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to read server DB:", e);
    return { users: [], items: {}, moves: {} };
  }
}

// Helper to write database
function writeDB(data: any) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to write server DB:", e);
  }
}

function getLocalFallbackResponse(userMessage: string, inventory: any[]): string {
  const text = userMessage.toLowerCase();
  
  // Detect language
  const isUrduScript = /[\u0600-\u06FF]/.test(userMessage);
  const isRomanUrdu = /\b(karo|kia|batao|hai|mujhe|dikhao|kam|sab|chal|dekh|ko|se|bhai|sir|stock)\b/i.test(userMessage);
  
  // Calculate inventory metrics
  const totalItems = inventory.length;
  let totalQty = 0;
  let totalValuation = 0;
  let totalCostValuation = 0;
  let lowStockCount = 0;
  const lowStockItems: any[] = [];
  
  for (const item of inventory) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.sellingPrice) || 0;
    const cost = Number(item.costPrice) || 0;
    
    totalQty += qty;
    totalValuation += qty * price;
    totalCostValuation += qty * cost;
    
    if (qty <= 5) {
      lowStockCount++;
      lowStockItems.push(item);
    }
  }
  
  const grossProfit = totalValuation - totalCostValuation;
  const profitMarginPercent = totalValuation > 0 ? (grossProfit / totalValuation) * 100 : 0;

  // Let's check for specific product search in user message
  let queriedItem: any = null;
  for (const item of inventory) {
    const name = (item.name || "").toLowerCase();
    const cat = (item.category || "").toLowerCase();
    if (text.includes(name) || (name.length > 3 && text.includes(name.substring(0, name.length - 1)))) {
      queriedItem = item;
      break;
    }
  }

  // Urdu Script Fallback Response
  if (isUrduScript) {
    // 1. Specific product search
    if (text.includes("رول") || text.includes("roll")) {
      const rollItem = inventory.find(i => (i.name || "").toLowerCase().includes("roll") || (i.name || "").includes("رول"));
      if (!rollItem) {
        return `**WALEED FOODS انوینٹری رپورٹ:**\n\nہمارے پاس انوینٹری میں **رول (Roll)** کا اسٹاک موجود نہیں ہے۔ اگر آپ اسے ایڈ کرنا چاہتے ہیں تو براہ کرم انوینٹری پیج پر جا کر نیا آئٹم شامل کریں۔`;
      } else {
        return `**WALEED FOODS رپورٹ (رول):**\n\n* **آئٹم کا نام:** ${rollItem.name}\n* **موجودہ اسٹاک:** ${rollItem.quantity} units\n* **خریداری قیمت:** Rs. ${rollItem.costPrice}\n* **فروخت قیمت:** Rs. ${rollItem.sellingPrice}\n* **اسٹاک مالیت:** Rs. ${(Number(rollItem.quantity) || 0) * (Number(rollItem.sellingPrice) || 0)}`;
      }
    }

    if (queriedItem) {
      const q = Number(queriedItem.quantity) || 0;
      const p = Number(queriedItem.sellingPrice) || 0;
      const c = Number(queriedItem.costPrice) || 0;
      const itemVal = q * p;
      return `**آئٹم کی معلومات (${queriedItem.name}):**\n\n* **کیٹیگری:** ${queriedItem.category || "General"}\n* **موجودہ اسٹاک:** **${q}** یونٹس\n* **خریداری قیمت (Cost Price):** Rs. ${c}\n* **فروخت قیمت (Selling Price):** Rs. ${p}\n* **کل اسٹاک مالیت:** Rs. ${itemVal}\n* **منافع مارجن:** ${p > 0 ? ((p - c) / p * 100).toFixed(1) : 0}%\n\nاگر قیمتیں 0 ہیں تو براہ کرم انوینٹری پیج پر جا کر قیمتیں درست کریں۔`;
    }

    // 2. Valuation and Margin query
    if (text.includes("valuation") || text.includes("profit") || text.includes("margin") || text.includes("مالیت") || text.includes("منافع") || text.includes("کل")) {
      return `**WALEED FOODS انوینٹری مالیاتی رپورٹ:**\n\n* **کل رجسٹرڈ آئٹمز:** **${totalItems}**\n* **موجودہ کل اسٹاک مالیت (Valuation):** **Rs. ${totalValuation.toLocaleString()}**\n* **مجموعی خریداری لاگت (Cost Valuation):** **Rs. ${totalCostValuation.toLocaleString()}**\n* **متوقع منافع (Estimated Profit):** **Rs. ${grossProfit.toLocaleString()}**\n* **اوسط منافع مارجن (Avg Margin):** **${profitMarginPercent.toFixed(1)}%**\n\n*نوٹ: اگر کسی آئٹم کی لاگت یا قیمتِ فروخت 0 ہے تو مارجنز درست کرنے کے لیے انوینٹری پیج پر اپڈیٹ کریں۔*`;
    }

    // 3. Low stock / Reorder query
    if (text.includes("low") || text.includes("stock") || text.includes("کم") || text.includes("سٹاک") || text.includes("رپورٹ")) {
      if (lowStockCount === 0) {
        return `**سٹاک الرٹ:**\n\nآپ کی انوینٹری میں تمام آئٹمز کا اسٹاک بہترین ہے۔ کوئی بھی آئٹم شارٹ یا کم اسٹاک (<= 5) میں نہیں ہے۔`;
      }
      const lowList = lowStockItems.map(i => `* **${i.name}**: موجودہ اسٹاک ${i.quantity} (کیٹیگری: ${i.category || "General"})`).join("\n");
      return `**کم اسٹاک والے آئٹمز کی لسٹ (Low Stock Alert):**\n\n${lowList}\n\n**مشورہ:** ان آئٹمز کو فوری طور پر دوبارہ آرڈر کرنے کا بندوبست کریں تاکہ سپلائی چین متاثر نہ ہو۔`;
    }

    // 4. Business Advice
    if (text.includes("advice") || text.includes("growth") || text.includes("مشورہ") || text.includes("رہنمائی")) {
      return `**WALEED FOODS بزنس ایڈوائس رپورٹ:**\n\n1. **منافع بڑھانے کے لیے:** آپ کا اوسط منافع مارجن **${profitMarginPercent.toFixed(1)}%** ہے۔ کم مارجن والے آئٹمز کی قیمتوں کا ازسرنو جائزہ لیں۔\n2. **سٹاک مینجمنٹ:** انوینٹری میں **${totalItems}** آئٹمز موجود ہیں جن کی کل مالیت **Rs. ${totalValuation.toLocaleString()}** ہے۔ ان آئٹمز کا اسٹاک کم رکھیں جن کی فروخت دھیمی ہے۔\n3. **کم اسٹاک الرٹس:** فی الحال **${lowStockCount}** آئٹمز کا اسٹاک کم ہے۔ ان کا آرڈر فوری دیں تاکہ کسٹمرز واپس نہ جائیں۔`;
    }

    // Default Greeting / Generic response in Urdu script
    return `**السلام علیکم!** میں آپ کا **INVEXA اسمارٹ اسسٹنٹ** ہوں۔\n\nمیں نے آپ کی انوینٹری کا ریل ٹائم ڈیٹا کامیابی سے لوڈ کر لیا ہے۔ آپ مجھ سے درج ذیل سوالات پوچھ سکتے ہیں:\n\n* **کل اسٹاک کی مالیت اور منافع مارجن کتنا ہے؟**\n* **کون سے آئٹمز کا اسٹاک کم ہے؟**\n* **کسی مخصوص آئٹم (جیسے میدہ، گھی، رول) کا اسٹاک چیک کریں۔**\n* **کاروبار بڑھانے کا مفید مشورہ لیں۔**`;
  }

  // Roman Urdu Fallback Response
  if (isRomanUrdu) {
    if (text.includes("رول") || text.includes("roll")) {
      const rollItem = inventory.find(i => (i.name || "").toLowerCase().includes("roll") || (i.name || "").includes("رول"));
      if (!rollItem) {
        return `**WALEED FOODS Inventory Report:**\n\nHamaray paas inventory mein **Roll (رول)** ka stock majood nahi hai. Agar aap isko add karna chahtay hain to inventory page par ja kar naya item add karein.`;
      } else {
        return `**WALEED FOODS Report (Roll):**\n\n* **Item Name:** ${rollItem.name}\n* **Majooda Stock:** ${rollItem.quantity} units\n* **Kharidari Price:** Rs. ${rollItem.costPrice}\n* **Sale Price:** Rs. ${rollItem.sellingPrice}\n* **Stock Value:** Rs. ${(Number(rollItem.quantity) || 0) * (Number(rollItem.sellingPrice) || 0)}`;
      }
    }

    if (queriedItem) {
      const q = Number(queriedItem.quantity) || 0;
      const p = Number(queriedItem.sellingPrice) || 0;
      const c = Number(queriedItem.costPrice) || 0;
      const itemVal = q * p;
      return `**Item Info (${queriedItem.name}):**\n\n* **Category:** ${queriedItem.category || "General"}\n* **Stock:** **${q}** units\n* **Kharidari Cost:** Rs. ${c}\n* **Sale Price:** Rs. ${p}\n* **Stock Value:** Rs. ${itemVal}\n* **Profit Margin:** ${p > 0 ? ((p - c) / p * 100).toFixed(1) : 0}%\n\nAgar price zero hai toh inventory page par ja kar cost aur selling price set karein.`;
    }

    if (text.includes("valuation") || text.includes("profit") || text.includes("margin") || text.includes("paisa") || text.includes("faida") || text.includes("hisaab") || text.includes("summary")) {
      return `**WALEED FOODS Inventory Financial Report (Roman Urdu):**\n\n* **Total Items:** **${totalItems}**\n* **Total Stock Valuation:** **Rs. ${totalValuation.toLocaleString()}**\n* **Total Cost Valuation:** **Rs. ${totalCostValuation.toLocaleString()}**\n* **Expected Profit (Est. Profit):** **Rs. ${grossProfit.toLocaleString()}**\n* **Avg Profit Margin:** **${profitMarginPercent.toFixed(1)}%**\n\n*Note: Agar kisi item ki cost price ya selling price 0 hai, toh accurate calculations ke liye inventory page par use update karein.*`;
    }

    if (text.includes("low") || text.includes("stock") || text.includes("kam") || text.includes("short")) {
      if (lowStockCount === 0) {
        return `**Stock Alert:**\n\nSaray items ka stock bilkul theek hai! Koi bhi item kam stock (<= 5) mein nahi hai.`;
      }
      const lowList = lowStockItems.map(i => `* **${i.name}**: Stock ${i.quantity} (Category: ${i.category || "General"})`).join("\n");
      return `**Kam Stock Walay Items Ki List:**\n\n${lowList}\n\n**Mashwara:** In items ka jaldi order dein taake supply chain mein rukawat na aaye.`;
    }

    if (text.includes("advice") || text.includes("growth") || text.includes("mashwara") || text.includes("tarika")) {
      return `**WALEED FOODS Business Advice (Roman Urdu):**\n\n1. **Profit Barhanay ke liye:** Aapka average profit margin **${profitMarginPercent.toFixed(1)}%** hai. Kam margin walay items ki prices barhane par ghaur karein.\n2. **Stock Valuation:** Aapka kul **Rs. ${totalValuation.toLocaleString()}** ka maal inventory mein majood hai. Slow-moving items ko sale par lagayein.\n3. **Reorder Alerts:** Abhi **${lowStockCount}** items ka stock short hai. Inka order jaldi karein taake customer khali hath na jaye.`;
    }

    return `**Assalam-o-Alaikum!** Main aapka **INVEXA Financial Agent** hoon.\n\nMene aapki store inventory ka live database loading complete kar liya hai. Aap mujhse ye sawal pooch sakte hain:\n\n* **Total valuation aur profit margin kitna hai?**\n* **Konsay products ka stock short chal raha hai?**\n* **Kisi khas product ka stock check karein.**\n* **Business grow karne ka mashwara lein.**`;
  }

  // English Fallback Response
  if (text.includes("roll") || text.includes("رول")) {
    const rollItem = inventory.find(i => (i.name || "").toLowerCase().includes("roll") || (i.name || "").includes("رول"));
    if (!rollItem) {
      return `**WALEED FOODS Inventory Report:**\n\nWe do not currently have **Roll** stock in your active database. To add it, please go to the Inventory management page.`;
    } else {
      return `**WALEED FOODS Stock Report (Roll):**\n\n* **Item Name:** ${rollItem.name}\n* **Stock Level:** ${rollItem.quantity} units\n* **Purchase Cost:** Rs. ${rollItem.costPrice}\n* **Selling Price:** Rs. ${rollItem.sellingPrice}\n* **Current Valuation:** Rs. ${(Number(rollItem.quantity) || 0) * (Number(rollItem.sellingPrice) || 0)}`;
    }
  }

  if (queriedItem) {
    const q = Number(queriedItem.quantity) || 0;
    const p = Number(queriedItem.sellingPrice) || 0;
    const c = Number(queriedItem.costPrice) || 0;
    const itemVal = q * p;
    return `**Item Details (${queriedItem.name}):**\n\n* **Category:** ${queriedItem.category || "General"}\n* **Current Stock:** **${q}** units\n* **Cost Price:** Rs. ${c}\n* **Selling Price:** Rs. ${p}\n* **Stock Valuation:** Rs. ${itemVal}\n* **Profit Margin:** ${p > 0 ? ((p - c) / p * 100).toFixed(1) : 0}%`;
  }

  if (text.includes("valuation") || text.includes("profit") || text.includes("margin") || text.includes("calculation") || text.includes("total") || text.includes("summary")) {
    return `**WALEED FOODS Live Inventory Financial Report:**\n\n* **Total Registered Products:** **${totalItems}**\n* **Total Inventory Value:** **Rs. ${totalValuation.toLocaleString()}**\n* **Total Cost Valuation:** **Rs. ${totalCostValuation.toLocaleString()}**\n* **Estimated Profit Margin:** **Rs. ${grossProfit.toLocaleString()} (${profitMarginPercent.toFixed(1)}%)**\n\n*Tip: If any items have 0 for prices, visit the Inventory page to add prices so profit metrics recalculate accurately.*`;
  }

  if (text.includes("low") || text.includes("stock") || text.includes("short") || text.includes("reorder")) {
    if (lowStockCount === 0) {
      return `**Reorder & Stock Report:**\n\nExcellent! All items have strong stock levels. No items are currently running low (<= 5).`;
    }
    const lowList = lowStockItems.map(i => `* **${i.name}**: Stock ${i.quantity} units (Category: ${i.category || "General"})`).join("\n");
    return `**Low Stock Alert (Stock <= 5 units):**\n\n${lowList}\n\n**Action Item:** Place a reorder soon to avoid running out of stock.`;
  }

  if (text.includes("advice") || text.includes("growth") || text.includes("insight")) {
    return `**INVEXA Financial Insights & Business Strategy:**\n\n1. **Maximize Margin:** Your average store profit margin is **${profitMarginPercent.toFixed(1)}%**. Consider increasing selling prices on items below 10% margin.\n2. **Dead Stock Reduction:** You have a total inventory valuation of **Rs. ${totalValuation.toLocaleString()}**. Liquidate slow-moving categories through combo sales.\n3. **Proactive Reorder:** There are **${lowStockCount}** items that are dangerously low in stock. Ordering early avoids customer turn-away.`;
  }

  return `**Welcome!** I am your **INVEXA Enterprise Financial Agent**.\n\nI have successfully synced your live store database records. You can ask me:\n\n* **What is the total valuation & profit margin?**\n* **Which products are low in stock?**\n* **Get business advice or check specific items.**`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // CORS headers so that client-only deployments (like Vercel) can make cross-origin sync calls
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // DB API 1: Get list of registered workspaces
  app.get("/api/db/users", (req, res) => {
    const db = readDB();
    res.json(db.users || []);
  });

  // DB API 2: Register/Save a workspace user
  app.post("/api/db/users", (req, res) => {
    const user = req.body;
    if (!user || !user.phone) {
      return res.status(400).json({ error: "Invalid user data" });
    }
    const db = readDB();
    db.users = db.users || [];
    // Remove if already exists with same phone, and insert newest
    db.users = [...db.users.filter((u: any) => u.phone.trim() !== user.phone.trim()), user];
    writeDB(db);
    res.json({ success: true, user });
  });

  // DB API 3: Sync items or stock moves for a user
  app.post("/api/db/sync", (req, res) => {
    const { userId, items, moves } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required for sync" });
    }
    const db = readDB();
    db.items = db.items || {};
    db.moves = db.moves || {};

    if (items) {
      db.items[userId] = items;
    }
    if (moves) {
      db.moves[userId] = moves;
    }

    writeDB(db);
    res.json({ success: true });
  });

  // DB API 4: Fetch synced items and stock moves for a user
  app.get("/api/db/sync/:userId", (req, res) => {
    const { userId } = req.params;
    const db = readDB();
    db.items = db.items || {};
    db.moves = db.moves || {};

    res.json({
      items: db.items[userId] || [],
      moves: db.moves[userId] || []
    });
  });

  // API 1: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API 2: Gemini Chat Assistant with real Context (Solid Enterprise Financial Agent)
  app.post("/api/chat", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { messages, inventory } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY environment variable is missing on the server. Please check your system configuration or Secrets panel." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const systemInstruction = `You are a SOLID ENTERPRISE FINANCIAL AGENT, acting as the ultimate "INVEXA Financial Expert & Inventory Manager" and Head Financial Accountant of WALEED FOODS.
Your goal is to provide 100% accurate information on stock quantities, valuations, prices, profit margins, and reorder alerts based strictly and exclusively on the real-time inventory list provided below.

Strict Constraints:
1. Under no circumstances should you invent, imagine, or hallucinate products, quantities, or prices. If a product is not in the active database array below, you MUST state directly in the user's language: "ہمارے پاس انوینٹری میں اس آئٹم کا اسٹاک موجود نہیں ہے" (or equivalent in Roman Urdu/English).
2. If prices or cost prices of items are 0 or undefined, remind the user to add cost and selling prices in the Inventory page to view margins.
3. Keep calculations mathematically precise:
   - Total Valuation = sum of (qty * price) for all items
   - Cost Valuation = sum of (qty * costPrice) for all items
   - Profit Margin = ((sellingPrice - costPrice) / sellingPrice) * 100
4. Always respond in the EXACT language/script the user is communicating in (Urdu script, Roman Urdu, or English). Do not mix languages or provide dual translations in a single turn.
5. Provide professional, crisp, and high-impact reports. Keep responses concise, clear, and perfectly formatted with bold keywords.

Active Store Inventory Database (JSON Payload):
${JSON.stringify(inventory || [], null, 2)}
`;

      // Map communication messages to GoogleGenAI SDK expected format safely
      let formattedContents = messages
        .filter((m: any) => m && typeof m === "object")
        .map((m: any) => {
          const role = m.role === "assistant" || m.role === "model" ? "model" : "user";
          const rawText = m.text || m.content || "";
          const text = typeof rawText === "string" ? rawText : JSON.stringify(rawText);
          return {
            role,
            parts: [{ text }]
          };
        });

      // Strictly sanitize contents to adhere to Gemini API requirements:
      // 1. Must start with "user" role
      while (formattedContents.length > 0 && formattedContents[0].role !== "user") {
        formattedContents.shift();
      }

      // 2. Must alternate roles. If consecutive identical roles exist, merge them.
      const sanitizedContents: any[] = [];
      for (const turn of formattedContents) {
        if (sanitizedContents.length === 0) {
          sanitizedContents.push(turn);
        } else {
          const lastTurn = sanitizedContents[sanitizedContents.length - 1];
          if (lastTurn.role === turn.role) {
            lastTurn.parts[0].text += "\n" + turn.parts[0].text;
          } else {
            sanitizedContents.push(turn);
          }
        }
      }
      formattedContents = sanitizedContents;

      // If after sanitation we have no messages, add a default fallback user turn
      if (formattedContents.length === 0) {
        formattedContents.push({
          role: "user",
          parts: [{ text: "Hello INVEXA Assistant, please greet me in my language." }]
        });
      }

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const modelsToTry = [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-1.5-pro",
        "gemini-2.0-flash"
      ];

      let response = null;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        let attempts = 0;
        const maxAttempts = 3;
        let delay = 1000; // start with 1 second delay

        while (attempts < maxAttempts) {
          try {
            attempts++;
            console.log(`Attempt ${attempts}/${maxAttempts} for content generation using model: ${modelName}`);
            response = await ai.models.generateContent({
              model: modelName,
              contents: formattedContents,
              config: {
                systemInstruction,
                temperature: 0.1, // low temperature for precise accounting
              },
            });
            if (response && response.text) {
              console.log(`Successfully generated content with model: ${modelName} on attempt ${attempts}`);
              break;
            }
          } catch (err: any) {
            const errMsg = err?.message || err?.toString() || "";
            const isTransient = errMsg.includes("503") || 
                                errMsg.toLowerCase().includes("unavailable") || 
                                errMsg.includes("429") || 
                                errMsg.toLowerCase().includes("limit") ||
                                errMsg.toLowerCase().includes("exhausted");

            console.error(`Model ${modelName} attempt ${attempts} failed: ${errMsg}`);
            lastError = err;

            if (isTransient && attempts < maxAttempts) {
              console.log(`Transient error detected, waiting ${delay}ms before retrying model ${modelName}...`);
              await sleep(delay);
              delay *= 2; // exponential backoff
            } else {
              // Not transient, or ran out of attempts, proceed to next model
              break;
            }
          }
        }
        if (response && response.text) {
          break;
        }
      }

      if (!response || !response.text) {
        console.log("[Info] All Gemini models are temporarily busy or exhausted. Responding with local analytical fallback.");
        const lastUserMsg = messages[messages.length - 1]?.text || "";
        const reply = getLocalFallbackResponse(lastUserMsg, inventory || []);
        return res.json({ reply, status: "fallback" });
      }

      const reply = response.text;
      res.json({ reply });
    } catch (error: any) {
      console.error("Gemini API server-side execution error, triggering local fallback:", error);
      const { messages, inventory } = req.body;
      const lastUserMsg = (messages && Array.isArray(messages)) ? (messages[messages.length - 1]?.text || "") : "";
      const reply = getLocalFallbackResponse(lastUserMsg, inventory || []);
      res.json({ reply, status: "fallback" });
    }
  });

  // Serve static assets or mount Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
