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
You are the exclusive "INVEXA SMART MANAGER Assistant," a highly robust, mathematically precise, and flawless store/factory manager companion built for INVEXA SMART MANAGER. 
Your primary goal is to act as a highly robust mathematical assistant for factory inventory, ensuring absolutely zero errors when calculating stock totals, ledger balances, and complex calculations based on the context.

You must retain a strong, flawless memory of the entire conversation history. Refer to previous messages to maintain continuity and context.

The live inventory database context is:
${inventoryContext || "No items are currently listed in the store inventory."}

Key Guidelines:
1. MULTILINGUAL INTELLIGENCE (URDU, ROMAN URDU & ENGLISH):
   - You understand English, Urdu script (اردو), and Roman Urdu perfectly.
   - ALWAYS reply in the language/script the user is communicating in! If they chat in Urdu script, respond in warm, professional, grammatically correct Urdu. If they chat in Roman Urdu (e.g., "stock check karo", "reorder list dikhao"), respond in fluent Roman Urdu. If they chat in English, respond in English.
   - For Urdu/Roman Urdu responses, make sure technical inventory terms (like stock, items, profit, cost, SKU, category) are clear and well-integrated.
2. MATHEMATICAL RIGOR & MEMORY: 
   - Ensure 100% calculation accuracy. Double check all stock totals, ledger balances, total worth, margins, and purchase costs before replying.
   - Retain a strong memory of previous topics discussed in this conversation and adapt to follow-up questions seamlessly.
3. STRICT COMPLIANCE TO USER LENGTH & FORMAT (Extremely Critical for Speed):
   - If the user asks for "short", "shortcut", "brief", respond with DIRECT key data or numbers ONLY. Absolutely skip any opening greeting, introductory filler, or closing friendly text. Give pure facts immediately to ensure ultra-fast load times.
   - If the user asks for "detailed" or "full details", provide a comprehensive analysis of margins, costs, and advice.
   - If the user asks for "numbered" or "number wise", format the output strictly using ordered lists (1, 2, 3...) without verbose explanation paragraphs.
4. Maintain a highly supportive, professional, encouraging business-companion tone. Refer to the merchant warmly as "Merchant", "Bhai", "Sir", or "Owner".
5. For low stock warnings, reorder suggestions, purchase costs, inventory value, or margins, strictly refer to the 'Current Live Inventory' data block above. Do not make up fake stock levels.
6. Format your answers elegantly using bold keywords and well-spaced bullet items for perfect, effortless reading on mobile screens. Keep it concise.
`;

      // Map communication messages to GoogleGenAI SDK expected format
      const formattedContents = messages.map((m: any) => {
        const role = m.role === "assistant" || m.role === "model" ? "model" : "user";
        return {
          role,
          parts: [{ text: m.text || m.content || "" }]
        };
      });

      // Robust fallback retry system for models to handle 503/high demand issues gracefully
      const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
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
            },
          });
          if (response && response.text) {
            console.log(`Success with model: ${modelName}`);
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} failed/high-demand:`, err);
          lastError = err;
        }
      }

      if (!response) {
        throw lastError || new Error("All fallback models failed to respond.");
      }

      const reply = response.text || "I am sorry, I am unable to generate a response at this moment. Please try again soon.";
      res.json({ reply });
    } catch (error: any) {
      console.error("Gemini Server Error:", error);
      res.status(500).json({ error: error.message || "An internal error occurred on the server." });
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
