import express from "express";
import { GoogleGenAI } from "@google/genai";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

// AI Service Logic Integrated
const DR_MICHEL_SYSTEM_PROMPT = `
PERFIL: Advogado Sênior Especialista em Direito Previdenciário (RGPS) e Processo Civil.
REGRAS: Seja obediente ao usuário, use documentos anexados como base, e só gere peças sob comando 'GERAR PEÇA'.
`;

async function callGemini(params: any) {
  const apiKey = process.env.API_KEY_1 || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey });
  return await ai.models.generateContent(params);
}

// API Routes
app.post("/api/dr-michel/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    const contents = [
      ...history.map((h: any) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await callGemini({
      model: "gemini-3-flash-preview",
      contents,
      config: { systemInstruction: DR_MICHEL_SYSTEM_PROMPT }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message || "Erro na comunicação com a IA" });
  }
});

app.post("/api/dr-michel/generate-docx", async (req, res) => {
  try {
    const { content } = req.body;
    
    const lines = content.split('\n');
    const paragraphs = lines.map((line: string) => {
      const isBold = line.startsWith('**') && line.endsWith('**');
      const text = line.replace(/\*\*/g, '');
      
      return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 360 },
        children: [
          new TextRun({
            text: text,
            size: 24,
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
              top: 1701,
              left: 1701,
              bottom: 1134,
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
  } catch (error: any) {
    console.error("Error generating DOCX:", error);
    res.status(500).json({ error: "Falha ao gerar documento Word" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
