import express from "express";
import { GoogleGenAI } from "@google/genai";
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
      model: "gemini-1.5-flash-latest",
      contents,
      config: { systemInstruction: DR_MICHEL_SYSTEM_PROMPT }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
