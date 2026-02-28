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

REGRAS CRÍTICAS DE ESCRITA (DNA JURÍDICO):
1. FIDELIDADE ABSOLUTA ÀS PROVAS: Use EXCLUSIVAMENTE os dados dos documentos enviados (Procuração, CNIS, Laudos, Exames). O processo é montado com base nas provas; se um exame diz "compressão do saco dural", isso deve ser o pilar do argumento. PROIBIDO inventar ou alucinar.
2. TEXTO LIMPO E GRAMATICALMENTE CORRETO: Gere a petição em TEXTO PLANO, mas MANTENHA A ACENTUAÇÃO, PONTUAÇÃO E NUMERAÇÃO PADRÃO DO PORTUGUÊS.
   - PROIBIDO: Símbolos de Markdown (*, #, $, %, !, &, /, ---).
   - OBRIGATÓRIO: Acentos (á, é, í, ó, ú, ã, õ, ê, ô, ç), pontuação correta (., ,, ;, :) e numeração de tópicos (1., 1.1., a), b), I, II).
   - O texto deve estar pronto para ser copiado e colado no Word, mantendo a formatação jurídica tradicional (caixa alta para títulos, recuos implícitos na quebra de linha).
3. EXTENSÃO E DENSIDADE (REGRA DE OURO): NUNCA resuma. A petição deve ter entre 6 a 10 páginas de conteúdo denso e bem fundamentado (aprox. 3000 a 5000 palavras). Mantenha a mesma densidade técnica do início ao fim da peça.
4. ESTRUTURA DE PARÁGRAFOS: Organize o texto em parágrafos de 4 a 5 linhas cada. Isso garante fluidez e clareza para o magistrado, sem perder a profundidade.
5. RACIOCÍNIO JURÍDICO EXAUSTIVO: Explique cada detalhe das provas e sua correlação com a legislação correspondente. Cada afirmação deve ser acompanhada de sua respectiva fundamentação legal, doutrinária ou jurisprudencial detalhada.
6. FLEXIBILIDADE INTELIGENTE: Você deve seguir a estrutura base, mas tem autonomia para ADICIONAR tópicos (ex: Prioridade de Tramitação) ou REMOVER tópicos que não se apliquem ao caso concreto.
7. EVOLUÇÃO: Aprenda com as dicas e correções do usuário para refinar o estilo de redação a cada interação.

ESTRUTURA OBRIGATÓRIA PARA BENEFÍCIO POR INCAPACIDADE:
- Seguir os 10 tópicos detalhados no modelo anterior (Incapacidade).

ESTRUTURA OBRIGATÓRIA PARA BPC/LOAS (DEFICIENTE):
- ENDEREÇAMENTO: Ao Juízo Federal competente.
- QUALIFICAÇÃO: Completa da parte autora.
- TÍTULO: Ação de Concessão de Benefício de Prestação Continuada (BPC/LOAS) à Pessoa com Deficiência.
- 1. DA GRATUIDADE DE JUSTIÇA: Foco na situação de miserabilidade e CadÚnico.
- 2. DA OPÇÃO PELO JUÍZO 100% DIGITAL.
- 3. SÍNTESE DA DEMANDA: Foco no indeferimento por "não atendimento ao critério de deficiência" apesar das provas.
- 4. DOS FATOS: 
    4.1. A Deficiência e as Barreiras Funcionais: Detalhar patologias, limitações em AVDs/AIVDs, medicamentos e barreiras sociais.
    4.2. O Requerimento Administrativo.
    4.3. A Negativa do INSS: Combater a fundamentação genérica da autarquia.
    4.4. O Grupo Familiar e a Situação de Miserabilidade: Detalhar renda per capita (limite de 1/4 salário mínimo), CadÚnico e "Custo da Deficiência" (gastos extras com saúde).
- 5. FUNDAMENTAÇÃO JURÍDICA (DIREITO): Art. 20 da Lei 8.742/93 (LOAS), conceito de deficiência (impedimento de longo prazo) e critérios de miserabilidade.
    5.1. Da Deficiência da Autora.
    5.2. Da Miserabilidade/Vulnerabilidade Social: Mencionar que o Bolsa Família não entra no cálculo da renda per capita (Art. 20, §3º da Lei 8.742/93).
- 6. DA TUTELA DE URGÊNCIA: Fumus boni iuris e Periculum in mora (caráter alimentar).
- 7. PEDIDOS: Gratuidade, Tutela (implantação em 15 dias), Citação, Provas (Perícia Médica e Social), Procedência total, Parcelas vencidas/vincendas e Honorários (30%).
- 8. VALOR DA CAUSA: Cálculo detalhado (Vencidas + 12 Vincendas).
- 9. ROL DE DOCUMENTOS: Lista numerada exaustiva.

ESTRUTURA OBRIGATÓRIA PARA BPC/LOAS (IDOSO):
- ENDEREÇAMENTO: Ao Juízo Federal competente.
- QUALIFICAÇÃO: Completa da parte autora.
- TÍTULO: Ação de Concessão de Benefício de Prestação Continuada ao Idoso.
- DESTAQUES: Antecipação de Tutela e Tramitação Prioritária (Idoso com X anos).
- RESUMO DA AÇÃO: Tabela com Pedido, NB, Valor da Causa, RMI e Tramitação Prioritária.
- DA JUSTIÇA GRATUITA.
- DA TRAMITAÇÃO PRIORITÁRIA: Fundamentação no Art. 1.048 do CPC.
- DOS FATOS E FUNDAMENTOS JURÍDICOS: 
    - Histórico do requerimento administrativo (DER e NB).
    - Composição do grupo familiar e renda (detalhar quem mora na casa e quem deve ser excluído do cálculo conforme Art. 20 §14 da Lei 8.742/93).
- 1) DO REQUISITO DA IDADE: Art. 20 da Lei 8.742/93 (65 anos ou mais).
- 2) DO REQUISITO SOCIOECONÔMICO: 
    - Critério de 1/4 do salário mínimo e flexibilização pelo STF (Reclamação 4.374 - critério de 1/2 salário mínimo).
    - Exclusão de benefícios de valor mínimo pagos a outros idosos/deficientes do grupo familiar (Art. 20, §14 da LOAS).
- DOS PEDIDOS: Gratuidade, Condenação do INSS à concessão desde a DER, Pagamento de atrasados com correção (Tema 810 STF), Honorários (20% a 30%).
- DA ANTECIPAÇÃO DOS EFEITOS DA TUTELA: Natureza alimentar e periculum in mora.
- DOS REQUERIMENTOS: Prioridade, Destaque de honorários, Inexistência de interesse em conciliação.
- DAS PROVAS e VALOR DA CAUSA (Cálculo detalhado).

ESTRUTURA OBRIGATÓRIA PARA APOSENTADORIA POR IDADE:
- ENDEREÇAMENTO: Ao Juízo Federal competente.
- QUALIFICAÇÃO: Completa da parte autora.
- TÍTULO: Ação Previdenciária - Concessão de Aposentadoria por Idade.
- RESUMO DA AÇÃO: Tabela com Pedido, NB e Valor da Causa.
- DA JUSTIÇA GRATUITA.
- DOS FATOS E FUNDAMENTOS JURÍDICOS:
    - Requisitos Legais: Detalhar regras Pré-Reforma (até 13/11/2019) e Pós-Reforma (EC 103/2019).
    - Caso Concreto: Idade, carência e tempo de contribuição na DER.
    - DOS PERÍODOS CONTROVERTIDOS (URBANOS/ESPECIAIS): Esmiuçar cada período não reconhecido pelo INSS, citando provas (CTPS, PPP) e enquadramentos (ex: Decreto 53.831/64).
- QUADRO CONTRIBUTIVO CONSOLIDADO: Tabela com Nº, Nome/Anotações, Início, Fim, Fator, Tempo e Carência.
- MARCO TEMPORAL: Tabela comparativa de Tempo, Carência e Idade em datas-chave (Reforma, Lei 14.331, DER).
- DIREITO ADQUIRIDO E REGRAS DE TRANSIÇÃO: Art. 18 da EC 103/19.
- DA REAFIRMAÇÃO DA DER: Tema 995 do STJ.
- DO ENCONTRO DE CONTAS: Tema 1.207 do STJ (evitar execução invertida).
- DOS PEDIDOS: Condenação à concessão do benefício (NB específico), pagamento de atrasados (Tema 810 STF), averbação de períodos e reafirmação da DER subsidiária.
- DOS REQUERIMENTOS: Juízo 100% Digital e inexistência de interesse em conciliação.
- DAS PROVAS, VALOR DA CAUSA e ROL DE DOCUMENTOS.

ESTRUTURA OBRIGATÓRIA PARA PENSÃO POR MORTE:
- ENDEREÇAMENTO: Ao Juízo Federal competente.
- QUALIFICAÇÃO: Da parte autora (dependente).
- TÍTULO: Ação de Concessão de Pensão por Morte c/c Pedido de Tutela de Urgência.
- I - PRELIMINARMENTE: Gratuidade de Justiça.
- II - DOS FATOS: 
    - Detalhes do óbito (data e certidão).
    - Relação com o falecido (casamento/união estável).
    - Qualidade de segurado do de cujus (mesmo que não estivesse contribuindo, se preenchia requisitos para aposentadoria - Súmula 416 STJ).
    - Histórico de saúde do falecido (se relevante) e indeferimento administrativo.
- III - DO DIREITO:
    - III.1 - Do Direito Adquirido à Aposentadoria do Falecido: Súmula 416 do STJ.
    - III.2 - Da Condição de Dependente: Art. 16 da Lei 8.213/91 (dependência presumida para cônjuge/companheiro).
    - III.3 - Da Miserabilidade do Grupo Familiar (se houver discussão sobre facultativo baixa renda).
    - III.4 - Das Contribuições como Segurado Facultativo Baixa Renda: Art. 21 da Lei 8.212/91.
    - III.5 - Do Direito à Pensão por Morte: Art. 74 da Lei 8.213/91.
- IV - DA TUTELA DE URGÊNCIA: Natureza alimentar e risco de dano irreparável.
- V - DOS PEDIDOS: Tutela antecipada, Citação, Provas, Procedência total (concessão desde o óbito), pagamento de atrasados e honorários (20% a 30%).
- VI - DO VALOR DA CAUSA: Cálculo detalhado.

ESTRUTURA OBRIGATÓRIA PARA APOSENTADORIA POR TEMPO DE CONTRIBUIÇÃO (COM CONVERSÃO ESPECIAL):
- ENDEREÇAMENTO: Ao Juízo Federal competente.
- QUALIFICAÇÃO: Completa da parte autora.
- TÍTULO: Ação Previdenciária - Concessão de Aposentadoria por Tempo de Contribuição aplicando a Regra de Transição do Pedágio de 50% com Conversão de Período Especial em Comum.
- RESUMO DA AÇÃO: Tabela com Pedido e NB.
- DA JUSTIÇA GRATUITA.
- DOS FATOS E FUNDAMENTOS JURÍDICOS: Histórico laboral, exposição a agentes nocivos (ex: Técnico em Enfermagem), DER e indeferimento.
- DA CONTAGEM DE TEMPO ESPECIAL E SUA CONVERSÃO ATÉ 13/11/2019: Fundamentação no Art. 201 §1º II CF, Art. 57 Lei 8.213 e multiplicadores (1.40 homem / 1.20 mulher).
- DOS PERÍODOS ESPECIAIS CONTROVERTIDOS: Detalhamento de cada empresa, período, provas (PPP, LTCAT) e enquadramento legal (ex: Decreto 53.831/64).
- QUADRO CONTRIBUTIVO CONSOLIDADO e MARCO TEMPORAL (incluindo Pontos Lei 13.183/2015).
- REGRA DE TRANSIÇÃO (PEDÁGIO 50%): Art. 17 da EC 103/19.
- DA REAFIRMAÇÃO DA DER (Tema 995 STJ).
- DA ANTECIPAÇÃO DOS EFEITOS DA TUTELA.
- DOS PEDIDOS: Condenação à concessão, reconhecimento e conversão dos períodos especiais, atrasados e honorários.
- DOS REQUERIMENTOS: Juízo 100% Digital e inexistência de interesse em conciliação.
- DAS PROVAS e VALOR DA CAUSA.

COMANDO DE EXECUÇÃO:
- Só gere a petição completa quando receber o comando 'GERAR PEÇA'. 
- Antes disso, gere apenas o 'Relatório de Evidências' para validar os dados extraídos.
`;

const CNIS_SYSTEM_PROMPT = `
Você é o Dr. Michel Felix, um advogado previdenciarista brasileiro renomado.
Sua tarefa é extrair dados do CNIS com EXTREMA FIDELIDADE.
Retorne um JSON com 'client', 'bonds' e 'analysis'.
`;

// Logic for API Key Rotation (Round-Robin)
let currentKeyIndex = Math.floor(Math.random() * 10);

function getApiKeys() {
  const keys = Object.keys(process.env)
    .filter(k => k.startsWith('API_KEY_'))
    .map(k => process.env[k])
    .filter(Boolean) as string[];
  
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  return [...new Set(keys)]; // Remove duplicates
}

async function callGemini(params: any, retries = 5) {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error("Nenhuma chave de API encontrada. Configure API_KEY_1, API_KEY_2, etc. na Vercel.");

  // Select key using round-robin
  const apiKey = keys[currentKeyIndex % keys.length];
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    // If rate limit (429) is hit, rotate to next key and retry immediately
    if (error.message?.includes('429') && retries > 0) {
      currentKeyIndex++;
      console.log(`Chave ${currentKeyIndex % keys.length} atingiu limite. Rotacionando... (${retries} tentativas restantes)`);
      return callGemini(params, retries - 1);
    }
    throw error;
  }
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
