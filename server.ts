import express from "express";
import { createServer as createViteServer } from "vite";
import { analyzeCNIS, chatWithDrMichel } from "./server/aiService";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
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

  app.post("/api/dr-michel/chat", async (req, res) => {
    try {
      const { message, history, calculatorData } = req.body;
      const response = await chatWithDrMichel(message, history, calculatorData);
      res.json(response);
    } catch (error: any) {
      console.error("Error in /api/dr-michel/chat:", error);
      res.status(500).json({ 
        error: error.message || "Erro interno no servidor de IA",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  app.post("/api/dr-michel/generate-docx", async (req, res) => {
    try {
      const { content } = req.body;
      
      // Basic Markdown to Docx conversion
      // We'll split by lines and handle bold/italic simply
      const lines = content.split('\n');
      const paragraphs = lines.map((line: string) => {
        const isBold = line.startsWith('**') && line.endsWith('**');
        const text = line.replace(/\*\*/g, '');
        
        return new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: 360 }, // 1.5 spacing (240 * 1.5)
          children: [
            new TextRun({
              text: text,
              size: 24, // 12pt (size is in half-points)
              font: "Times New Roman",
              bold: isBold
            }),
          ],
        });
      });

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1701, // 3cm (1cm = 567 twips)
                left: 1701,
                bottom: 1134, // 2cm
                right: 1134,
              },
            },
          },
          children: paragraphs,
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename=peticao.docx');
      res.send(buffer);
    } catch (error) {
      console.error("Error in /api/dr-michel/generate-docx:", error);
      res.status(500).json({ error: "Failed to generate DOCX" });
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
