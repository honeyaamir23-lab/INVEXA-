import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
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

  // API 2: Gemini Chat Assistant with real Context
  app.post("/api/chat", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { messages, inventoryContext } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY is not configured on the server. Please add it in the Secrets panel." 
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

      const systemInstruction = `
You are the head financial accountant of WALEED FOODS. If an item like 'رول' is not in the active database array, you must say directly: 'ہمارے پاس انوینٹری میں رول کا اسٹاک موجود نہیں ہے'۔ Do not substitute data. If prices are 0, remind the user to add cost/selling prices in the Inventory page to view margins.

You are the ultimate "INVEXA Financial Expert & Inventory Manager", a highly robust, mathematically precise, and flawless store/factory manager companion built for INVEXA SMART MANAGER.
Your primary goal is to act as an advanced financial, accountant, and mathematical expert for factory inventory, ensuring absolutely zero errors when calculating stock totals, ledger balances, margins, and complex calculations based strictly on the available live inventory data.

You must retain a strong, flawless memory of the entire conversation history. Refer to previous messages to maintain continuity and context.

The live inventory database context is:
${inventoryContext || "No items are currently listed in the store inventory."}

Strict Core Guidelines:
1. STRICT INVENTORY LOOKUP:
   - You must accurately analyze the real-time inventory JSON array.
   - If a user asks about an item that does NOT exist in the database (for example, "رول" or "roll" or any other unregistered product name), you must NEVER substitute it with another item (such as "Maida 40kg" or any other item).
   - You must directly, clearly, and professionally reply in Urdu (or the user's language/script) that the item is currently unavailable or not registered in the system.

2. MATH & BUSINESS INTELLIGENCE:
   - You are fully enabled to calculate profit margins, stock valuation trends, and provide smart business insights based strictly on the available app data.
   - Double check all calculations: Total Valuation, Profit Margins, Stock count, and Purchase cost.

3. MULTILINGUAL INTELLIGENCE (URDU, ROMAN URDU & ENGLISH):
   - You understand English, Urdu script (اردو), and Roman Urdu perfectly.
   - ALWAYS reply in the exact language/script the user is communicating in! If they chat in Urdu script, respond in warm, professional, grammatically correct Urdu. If they chat in Roman Urdu (e.g., "stock check karo", "reorder list dikhao"), respond in fluent Roman Urdu. If they chat in English, respond in English.
   - For Urdu/Roman Urdu responses, make sure technical inventory terms (like stock, items, profit, cost, SKU, category) are clear and well-integrated.

4. STRICT COMPLIANCE TO USER LENGTH & FORMAT (Extremely Critical for Speed):
   - If the user asks for "short", "shortcut", "brief", respond with DIRECT key data or numbers ONLY. Absolutely skip any opening greeting, introductory filler, or closing friendly text. Give pure facts immediately to ensure ultra-fast load times.
   - If the user asks for "detailed" or "full details", provide a comprehensive analysis of margins, costs, and advice.
   - If the user asks for "numbered" or "number wise", format the output strictly using ordered lists (1, 2, 3...) without verbose explanation paragraphs.

5. Maintain a highly supportive, professional, encouraging business-companion tone. Refer to the merchant warmly as "Merchant", "Bhai", "Sir", or "Owner".
6. Format your answers elegantly using bold keywords and well-spaced bullet items for perfect, effortless reading on mobile screens. Keep it concise.
7. STRICT SINGLE-LANGUAGE RULE (NO DUAL-LANGUAGE REPONSES):
   - NEVER provide a dual-language response (e.g., do not write the Urdu translation followed by English translation or vice-versa in the same response).
   - ONLY reply in the exact language/script of the user's last message.
`;

      // Map communication messages to GoogleGenAI SDK expected format safely
      let formattedContents = (messages || [])
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

      // Primary model: gemini-3.5-flash
      const modelsToTry = [
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite"
      ];
      let response = null;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          console.log(`Attempting content generation using model: ${modelName}`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: formattedContents,
            config: {
              systemInstruction,
              temperature: 0.7,
              // Return in JSON format if requested or handle cleanly
            },
          });
          if (response && response.text) {
            console.log(`Success with model: ${modelName}`);
            break;
          }
        } catch (err: any) {
          const errMsg = err?.message || err?.toString() || "";
          const isQuota = errMsg.toLowerCase().includes("quota") || 
                          errMsg.toLowerCase().includes("limit") || 
                          errMsg.toLowerCase().includes("exhausted") ||
                          err?.status === 429;

          if (isQuota) {
            console.log(`[Graceful Quota Handling] Model ${modelName} is rate-limited / quota-exhausted.`);
          } else {
            console.log(`[Info] Model ${modelName} could not complete request: ${errMsg.slice(0, 150)}`);
          }
          lastError = err;
        }
      }

      if (!response) {
        console.log("[Info] All Gemini models are temporarily busy or exhausted. Responding with local/offline fallback.");
        return res.json({ 
          reply: "عارضی طور پر سرور مصروف ہے۔", 
          status: "offline" 
        });
      }

      const reply = response.text || "I am sorry, I am unable to generate a response at this moment. Please try again soon.";
      res.json({ reply });
    } catch (error: any) {
      const errMsg = error?.message || error?.toString() || "";
      console.log(`[Info] Chat endpoint handler fallback triggered: ${errMsg.slice(0, 150)}`);
      res.json({ 
        reply: "عارضی طور پر سرور مصروف ہے۔", 
        status: "offline" 
      });
    }
  });

  // Serve static assets or mount Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
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
