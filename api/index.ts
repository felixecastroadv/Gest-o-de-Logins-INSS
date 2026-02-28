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

REGRAS CRÍTICAS:
1. FIDELIDADE AOS DADOS: Você deve usar EXCLUSIVAMENTE os dados contidos nos textos dos documentos enviados pelo usuário (Procuração, CNIS, PPP, etc.).
2. PROIBIÇÃO DE ALUCINAÇÃO: Nunca invente nomes de clientes (como "Carlos Alberto"), endereços ou números de processos. Se o documento diz "Schirley Souza", o cliente é "Schirley Souza".
3. ARMAZENAMENTO DE CONTEXTO: Guarde todas as informações dos documentos enviados para compor a petição final.
4. GERAÇÃO DE PEÇA: Só gere a petição completa quando receber o comando 'GERAR PEÇA'. Até lá, limite-se a confirmar o recebimento e gerar o 'Relatório de Evidências' fiel ao documento.
5. RESPOSTA TÉCNICA: Use Markdown, seja formal e cite leis reais (Lei 8.213/91, etc.).
`;

const CNIS_SYSTEM_PROMPT = `
Você é o Dr. Michel Felix, um advogado previdenciarista brasileiro renomado.
Sua tarefa é extrair dados do CNIS com EXTREMA FIDELIDADE.
Retorne um JSON com 'client', 'bonds' e 'analysis'.
`;

async function callGemini(params: any) {
  const apiKey = process.env.API_KEY_1 || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey });
  return await ai.models.generateContent(params);
}

// API Routes
app.post("/api/analyze-cnis", async (req, res) => {
  try {
    const { cnisContent } = req.body;
    if (!cnisContent) return res.status(400).json({ error: "CNIS content is required" });

    const response = await callGemini({
      model: "gemini-3-flash-preview",
      contents: { role: "user", parts: [{ text: cnisContent }] },
      config: {
        systemInstruction: CNIS_SYSTEM_PROMPT,
        responseMimeType: "application/json"
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Error analyzing CNIS:", error);
    res.status(500).json({ error: error.message || "Falha na análise do CNIS" });
  }
});

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

// Development server setup - ONLY runs locally, NOT on Vercel
if (process.env.NODE_ENV !== "production") {
  const PORT = 3000;
  // Use dynamic import to avoid loading Vite in production/Vercel
  import("vite").then(({ createServer: createViteServer }) => {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    }).then((vite) => {
      app.use(vite.middlewares);
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Development server running on http://localhost:${PORT}`);
      });
    });
  }).catch(err => {
    console.error("Failed to start development server:", err);
  });
}

export default app;
