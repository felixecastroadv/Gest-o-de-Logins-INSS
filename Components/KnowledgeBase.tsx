import React, { useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { CheckCircle2, Plus } from 'lucide-react';

export default function KnowledgeBase() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSuccess, setIsSuccess] = useState(false);

  const handleProcess = async () => {
    if (!title.trim() || !content.trim()) {
      setMessage({ text: 'Título e conteúdo são obrigatórios.', type: 'error' });
      return;
    }

    setIsProcessing(true);
    setMessage({ text: 'Preparando documento...', type: 'info' });

    try {
      // 0. Delete existing document with the same title to allow replacement
      setMessage({ text: 'Verificando se o documento já existe...', type: 'info' });
      await supabaseService.deleteLegalDocumentByTitle(title);

      // 1. Chunk the text on the frontend (Smarter Legal Chunking)
      // Split primarily by "Art. " to keep articles and their paragraphs together
      const rawParts = content.split(/(?=\n\s*Art\.\s|\n\s*Artigo\s)/i);
      const chunks: string[] = [];
      let currentChunk = "";
      
      for (const part of rawParts) {
        const p = part.trim();
        if (!p) continue;

        // If adding this part exceeds a safe limit (e.g., 2500 chars) and we already have something,
        // push the current chunk and start a new one.
        if (currentChunk.length + p.length > 2500 && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }

        currentChunk += (currentChunk ? "\n\n" : "") + p;

        // If a single article is massive (like Art 5 of CF) and exceeds 2500, 
        // we push it immediately after adding to avoid giant chunks.
        if (currentChunk.length >= 2500) {
           // If it's way too big (e.g. > 4000), we might need to sub-split, but Gemini handles up to 10k bytes well.
           chunks.push(currentChunk.trim());
           currentChunk = "";
        }
      }
      
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }

      if (chunks.length === 0) {
        throw new Error('Nenhum trecho de texto gerado.');
      }

      // 2. Process each chunk sequentially to avoid timeouts
      let processedChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) continue;

        setMessage({ text: `Processando trecho ${i + 1} de ${chunks.length}... (Isso pode levar alguns minutos para leis grandes)`, type: 'info' });

        const response = await fetch('/api/rag/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Falha ao processar o trecho ${i + 1}`);
        }

        const { embedding } = await response.json();

        processedChunks.push({
          content: chunk,
          metadata: {
            title,
            sourceUrl,
            dateAdded: new Date().toISOString()
          },
          embedding
        });
        
        // Save in batches of 10 to avoid losing everything if it fails halfway
        if (processedChunks.length >= 10 || i === chunks.length - 1) {
           setMessage({ text: `Salvando trechos no banco de dados (${i + 1}/${chunks.length})...`, type: 'info' });
           await supabaseService.saveLegalDocuments(processedChunks);
           processedChunks = []; // clear array
        }
      }

      setMessage({ text: 'Documento salvo com sucesso na Base de Conhecimento!', type: 'success' });
      setTitle('');
      setContent('');
      setSourceUrl('');
      setIsSuccess(true);
    } catch (error: any) {
      console.error('Erro no RAG:', error);
      setMessage({ text: error.message || 'Erro ao processar documento.', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Documento Salvo com Sucesso!</h2>
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          A legislação/jurisprudência foi processada e adicionada à base de conhecimento. A IA já pode utilizar essas informações em suas respostas.
        </p>
        <button
          onClick={() => {
            setIsSuccess(false);
            setMessage({ text: '', type: '' });
          }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={20} />
          Adicionar Mais Leis
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Base de Conhecimento (Treinar IA)</h2>
      <p className="text-slate-600 mb-6 text-sm">
        Adicione leis, jurisprudências ou documentos padrão aqui. A IA usará essas informações para responder com mais precisão e embasamento jurídico.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Título do Documento *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Lei 8.213/91 - Planos de Benefícios da Previdência Social"
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">URL da Fonte (Opcional)</label>
          <input
            type="text"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Ex: http://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm"
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Conteúdo do Documento *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Cole o texto da lei ou jurisprudência aqui..."
            rows={10}
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
          />
        </div>

        {message.text && (
          <div className={`p-3 rounded-lg text-sm ${
            message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleProcess}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
              isProcessing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isProcessing ? 'Processando...' : 'Processar e Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
