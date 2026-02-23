import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT = `
Você é o Dr. Michel Felix, um advogado previdenciarista brasileiro renomado, especialista em RGPS.
Sua tarefa é extrair dados do CNIS com EXTREMA FIDELIDADE.

**OBJETIVO:**
Ler o texto do CNIS e retornar uma lista de vínculos (bonds) limpa e correta.

**REGRAS CRÍTICAS DE EXTRAÇÃO:**

1.  **IDENTIFICAÇÃO DE VÍNCULOS:**
    *   Cada vínculo no CNIS começa geralmente com um número de sequência ("Seq."), seguido pelo NIT e pelo Nome/CNPJ da empresa.
    *   **IGNORE** cabeçalhos de página, rodapés ou textos informativos que não sejam vínculos reais.
    *   **NÃO CRIE** vínculos fantasmas. Se não tiver certeza, não invente.
    *   **NOME DA EMPRESA (Origin):** Extraia o nome exato da empresa ou empregador. Evite "VÍNCULO SEM NOME". Se for recolhimento por carnê, use "CONTRIBUINTE INDIVIDUAL" ou "RECOLHIMENTO PRÓPRIO".

2.  **DATAS (Início e Fim):**
    *   **Data Início:** Extraia a data de admissão/início.
    *   **Data Fim (CRUCIAL):**
        *   Se a "Data Fim" estiver explícita, use-a.
        *   **SE A DATA FIM ESTIVER VAZIA:** Procure IMEDIATAMENTE pelo campo **"Últ. Remun."** (Última Remuneração) dentro do bloco daquele vínculo.
        *   **REGRA DE PREENCHIMENTO:** Se usar a "Últ. Remun." (ex: 04/2023), a Data Fim DEVE ser o **ÚLTIMO DIA** daquele mês (ex: 30/04/2023).
        *   Se não houver Data Fim E não houver Última Remuneração, o vínculo é ATIVO (Data Fim = null).

3.  **SALÁRIOS DE CONTRIBUIÇÃO (SC):**
    *   Extraia todos os salários (Competência e Valor).
    *   Mantenha a fidelidade aos valores.

4.  **INDICADORES:**
    *   Capture todos os indicadores (ex: IREM-INDP, PEXT, AEXT-VT, IEAN).

**FORMATO DE SAÍDA (JSON):**
{
  "client": { ... },
  "bonds": [
    {
      "seq": 1,
      "origin": "NOME DA EMPRESA",
      "startDate": "AAAA-MM-DD",
      "endDate": "AAAA-MM-DD", // Use null se aberto
      "sc": [],
      "indicators": []
    }
  ],
  "analysis": "Texto da análise..."
}

**ATENÇÃO:**
*   O usuário reclamou de "Vínculos Fantasmas" e "Datas Erradas". SEJA PRECISO.
*   Compare a sequência numérica. Se o CNIS tem 10 vínculos, retorne 10 vínculos.
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cnisContent } = req.body;
    
    if (!cnisContent) {
      return res.status(400).json({ error: 'CNIS content is required' });
    }

    // 1. Define API Keys in Priority Order
    const apiKeys = [
        process.env.API_KEY_1, // New primary key
        process.env.API_KEY_2,
        process.env.API_KEY_3,
        process.env.API_KEY_4,
        process.env.API_KEY_5,
        process.env.API_KEY_6,
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_API_KEY
    ].filter(key => !!key); // Remove undefined/empty keys

    if (apiKeys.length === 0) {
      const availableKeys = Object.keys(process.env).filter(k => k.includes('KEY') || k.includes('SECRET'));
      console.error("No API Keys found. Available vars:", availableKeys);
      return res.status(500).json({ 
        error: 'Server misconfiguration: No API Keys found',
        debug: { availableVarNames: availableKeys }
      });
    }

    // 2. Try keys sequentially (Rotation Logic)
    let lastError = null;
    let successResponse = null;

    for (const [index, apiKey] of apiKeys.entries()) {
        try {
            console.log(`Attempting with API Key #${index + 1} (ending in ...${apiKey?.slice(-4)})...`);
            
            const ai = new GoogleGenAI({ apiKey: apiKey! });
            
            // Add timeout promise to race against AI call
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("AI Request Timeout (45s)")), 45000)
            );

            const aiPromise = ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: {
                    role: "user",
                    parts: [{ text: cnisContent }]
                },
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                    responseMimeType: "application/json"
                }
            });

            // Race the AI call against the timeout
            const response: any = await Promise.race([aiPromise, timeoutPromise]);

            const text = response.text;
            if (!text) throw new Error("No text returned from AI");

            successResponse = JSON.parse(text);
            console.log(`Success with API Key #${index + 1}`);
            break; // Stop loop on success

        } catch (error: any) {
            console.warn(`Failed with API Key #${index + 1}:`, error.message);
            lastError = error;
            // Continue to next key...
        }
    }

    if (successResponse) {
        return res.status(200).json(successResponse);
    } else {
        throw lastError || new Error("All API keys failed");
    }

  } catch (error: any) {
    console.error("Error in Vercel function:", error);
    // Return the actual error message to the client for debugging
    res.status(500).json({ 
        error: 'Failed to analyze CNIS', 
        details: error.message || String(error) 
    });
  }
}
