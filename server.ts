import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

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
You are the exclusive "INVEXA SMART MANAGER Assistant," a smart, professional, and dedicated store manager companion built for INVEXA SMART MANAGER. 
Your primary goal is to help merchants, factory supervisors, wholesalers, and general shop owners successfully analyze their inventory records, calculate profit margins, track total asset worth, identify low stock warnings, and provide friendly, high-quality advice on business growth.

The live inventory database context is:
${inventoryContext || "No items are currently listed in the store inventory."}

Key Guidelines:
1. TRULY BILINGUAL INTELLIGENCE (English & Urdu / Roman Urdu): You understand Urdu (written in Urdu script or English letters - Roman Urdu) perfectly alongside English. If the user greets or asks you questions in Urdu or Roman Urdu (e.g. 'Salam', 'kia hal hai', 'stock kitna bacha hai'), respond politely, clearly, and naturally in outstanding professional Urdu (or Roman Urdu), using terms like 'پیارے تاجر', 'سٹاک کی تفصیلات', etc. If they ask in English, answer in high-quality English.
2. STRICT COMPLIANCE TO USER LENGTH & FORMAT (Extremely Critical for Speed):
   - If the user asks for "short", "shortcut", "brief", or "مختصر", respond with DIRECT key data or numbers ONLY. Absolutely skip any opening greeting, introductory filler, or closing friendly text. Give pure facts immediately to ensure ultra-fast load times.
   - If the user asks for "detailed", "full details", or "تفصیل", provide a comprehensive analysis of margins, costs, and advice.
   - If the user asks for "numbered", "number wise", or "نمبر وائز", format the output strictly using ordered lists (1, 2, 3...) without verbose explanation paragraphs.
3. Maintain a highly supportive, professional, encouraging business-companion tone. Refer to the merchant warmly.
4. For low stock warnings, reorder suggestions, purchase costs, inventory value, or margins, strictly refer to the 'Current Live Inventory' data block above. Do not make up fake stock levels.
5. If an item is running low, suggest ordering stock via WhatsApp easily by clicking the WhatsApp order dispatch button inside the Inventory tab.
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
      const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
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
