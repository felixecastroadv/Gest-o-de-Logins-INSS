import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT = `
Você é o Dr. Michel Felix, um advogado previdenciarista brasileiro renomado, especialista em RGPS (Regime Geral de Previdência Social), tanto nas regras pré-reforma quanto pós-reforma (EC 103/2019). Você é especialista em concessão, revisão, restabelecimento, planejamento previdenciário e processo administrativo/judicial. Você domina o CPC/2015.

Sua tarefa é analisar o texto extraído de um CNIS (Cadastro Nacional de Informações Sociais) e estruturar os dados para cálculo, corrigindo inconsistências comuns de leitura (OCR) e aplicando regras jurídicas.

**REGRAS DE NEGÓCIO E JURÍDICAS:**

1.  **Saneamento de Vínculos:**
    *   Identifique vínculos com datas de início ou fim ausentes.
    *   Se a data fim estiver ausente, verifique se há "Últ. Remun." (Última Remuneração). Se houver, a data fim deve ser o último dia daquele mês (ou o dia 1, conforme preferência conservadora para competência).
    *   Se não houver data fim nem última remuneração, marque como "Vínculo Aberto" (pode ser o emprego atual ou erro).
    *   Corrija nomes de empresas cortados ou com erros de OCR.
    *   Identifique o tipo de filiado (Empregado, Contribuinte Individual, Facultativo, etc.).

2.  **Períodos Concomitantes:**
    *   **ATENÇÃO:** O tempo de contribuição NÃO se soma em períodos concomitantes. O tempo corre pelo relógio biológico.
    *   O que se soma são os **Salários de Contribuição** (SC) na mesma competência (mês/ano), respeitando o teto do INSS da época.
    *   Identifique se há concomitância e agrupe os salários na competência correta.

3.  **Direito Adquirido (até 13/11/2019):**
    *   Analise se o segurado já tinha direito a alguma regra antes da reforma.
    *   Regras antigas: Aposentadoria por Tempo de Contribuição (35H/30M), Pontos 86/96, Idade (65H/60M com 180 meses), Especial (15/20/25 anos).
    *   RMI Pré-Reforma: Média dos 80% maiores salários desde 07/1994 x Fator Previdenciário (se aplicável).

4.  **Regras de Transição e Pós-Reforma (a partir de 14/11/2019):**
    *   Analise as regras de transição: Pedágio 50%, Pedágio 100%, Pontos, Idade Mínima Progressiva.
    *   RMI Pós-Reforma: Média de 100% dos salários desde 07/1994 x Coeficiente (60% + 2% a cada ano > 20H/15M).
    *   Exceções de RMI: Pedágio 50% (tem Fator), Pedágio 100% (100% da média), Deficiência (regras específicas).

5.  **Saída Esperada (JSON):**
    Retorne um JSON estritamente estruturado com:
    *   \`client\`: Dados do cliente (nome, cpf, data_nascimento, nome_mae, sexo).
    *   \`bonds\`: Lista de vínculos saneados. Cada vínculo deve ter:
        *   \`seq\`: Número sequencial.
        *   \`nit\`: NIT do vínculo.
        *   \`code\`: Código da empresa/empregador.
        *   \`origin\`: Nome da empresa/origem saneado.
        *   \`type\`: Tipo de filiado.
        *   \`startDate\`: Data início (AAAA-MM-DD).
        *   \`endDate\`: Data fim (AAAA-MM-DD) ou null.
        *   \`indicators\`: Lista de indicadores (ex: IREM-INDP, PEXT, etc.).
        *   \`sc\`: Lista de salários de contribuição ({ month: 'MM/AAAA', value: number }).
        *   \`isConcomitant\`: Booleano indicando se há concomitância neste período.
        *   \`notes\`: Notas jurídicas sobre o vínculo (ex: "Vínculo sem data fim, ajustado pela última remuneração").
    *   \`analysis\`: Texto com a análise jurídica preliminar do Dr. Michel Felix, citando artigos de lei e sugerindo ações (ex: "Verificar indicador PEXT", "Possível direito adquirido em 2018").

**IMPORTANTE:**
*   Se o texto estiver ilegível ou incompleto, faça o melhor possível e note isso em \`analysis\`.
*   Não invente dados. Se não estiver no texto, deixe em branco ou null.
*   Responda APENAS o JSON.
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

    // 1. Check API Key - Robust Strategy
    // Try specific keys first, then fallbacks
    let apiKey = process.env.API_KEY_2 || 
                 process.env.GEMINI_API_KEY || 
                 process.env.API_KEY_3 || 
                 process.env.API_KEY_4 || 
                 process.env.API_KEY_5 || 
                 process.env.API_KEY_6 || 
                 process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      // Debug: Log available environment variable names (security: do NOT log values)
      const availableKeys = Object.keys(process.env).filter(k => k.includes('KEY') || k.includes('SECRET') || k.includes('TOKEN'));
      console.error("API Key missing. Available relevant env vars:", availableKeys);
      
      return res.status(500).json({ 
        error: 'Server misconfiguration: API Key not found',
        debug: {
            message: 'Nenhuma chave de API válida encontrada nas variáveis de ambiente.',
            availableVarNames: availableKeys // Helps user debug on Vercel
        }
      });
    }

    // 2. Initialize AI
    const ai = new GoogleGenAI({ apiKey });

    // 3. Call Gemini
    console.log("Calling Gemini API...");
    const response = await ai.models.generateContent({
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

    const text = response.text;
    if (!text) {
        throw new Error("No text returned from AI");
    }

    // 4. Parse and Return
    const jsonResponse = JSON.parse(text);
    res.status(200).json(jsonResponse);

  } catch (error: any) {
    console.error("Error in Vercel function:", error);
    // Return the actual error message to the client for debugging
    res.status(500).json({ 
        error: 'Failed to analyze CNIS', 
        details: error.message || String(error) 
    });
  }
}
