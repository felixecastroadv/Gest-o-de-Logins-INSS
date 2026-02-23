import express from "express";
import { createServer as createViteServer } from "vite";
import { analyzeCNIS } from "./server/aiService";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for large PDF text content
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/analyze-cnis", async (req, res) => {
    try {
      const { cnisContent } = req.body;
      if (!cnisContent) {
        return res.status(400).json({ error: "CNIS content is required" });
      }

      const analysis = await analyzeCNIS(cnisContent);
      res.json(analysis);
    } catch (error) {
      console.error("Error in /api/analyze-cnis:", error);
      res.status(500).json({ error: "Failed to analyze CNIS" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production setup (serve static files)
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
