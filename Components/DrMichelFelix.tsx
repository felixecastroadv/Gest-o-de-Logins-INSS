import React, { useState, useEffect, useRef } from 'react';
import { 
  PaperAirplaneIcon as Send, 
  PaperClipIcon as Paperclip, 
  DocumentTextIcon as FileText, 
  BriefcaseIcon as Briefcase, 
  MagnifyingGlassIcon as Search, 
  PlusIcon as Plus, 
  ChevronLeftIcon as ChevronLeft, 
  ChevronRightIcon as ChevronRight, 
  ArrowDownTrayIcon as Download, 
  ArrowPathIcon as Loader2, 
  UserIcon as User, 
  CpuChipIcon as Bot,
  ClockIcon as History, 
  ChatBubbleLeftRightIcon as MessageSquare, 
  TrashIcon as Trash2,
  ClipboardIcon as Copy,
  PencilIcon as Edit2,
  XMarkIcon as XMark
} from '@heroicons/react/24/outline';
import { CheckIcon as Check } from '@heroicons/react/24/solid';
import { SocialSecurityData } from '../SocialSecurityCalc';
import { initSupabase } from '../supabaseClient';
import { extractTextFromPDF } from '../src/utils/pdfParser';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: { name: string; url: string; type: string }[];
}

interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: Message[];
}

interface DrMichelFelixProps {
}

const DrMichelFelix: React.FC<DrMichelFelixProps> = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  useEffect(() => {
    const saved = localStorage.getItem('dr_michel_sessions');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('dr_michel_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentSession?.messages, isLoading]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'Nova Conversa',
      date: new Date().toLocaleDateString('pt-BR'),
      messages: []
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
  };

  const copyToClipboard = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Deseja excluir esta conversa?')) {
      const updated = sessions.filter(s => s.id !== id);
      setSessions(updated);
      if (currentSessionId === id) {
        setCurrentSessionId(updated.length > 0 ? updated[0].id : null);
      }
    }
  };

  const startEditing = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const saveTitle = (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    if (editTitle.trim()) {
      setSessions(sessions.map(s => s.id === id ? { ...s, title: editTitle.trim() } : s));
    }
    setEditingSessionId(null);
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionId(null);
  };

  const handleSendMessage = async (overrideInput?: string, images?: string[]) => {
    const messageText = overrideInput || input;
    if ((!messageText.trim() && (!images || images.length === 0)) || isLoading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: messageText.slice(0, 30) + '...',
        date: new Date().toLocaleDateString('pt-BR'),
        messages: []
      };
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
      sessionId = newSession.id;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length === 0 ? messageText.slice(0, 30) : s.title } : s
    ));
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/dr-michel/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          history: sessions.find(s => s.id === sessionId)?.messages || [],
          images: images || []
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Falha na resposta da IA';
        try {
          const errorData = JSON.parse(errorText);
          if (response.status === 429 || (errorData.error && errorData.error.code === 429)) {
            errorMessage = 'Limite de uso atingido (Quota Exceeded). Por favor, aguarde cerca de 1 minuto antes de tentar novamente. Se o problema persistir, considere usar uma chave de API paga.';
          } else if (response.status === 503 || (errorData.error && errorData.error.code === 503)) {
            errorMessage = 'O serviço de IA está temporariamente sobrecarregado (Erro 503). Por favor, aguarde alguns instantes e tente novamente.';
          } else {
            errorMessage = errorData.error?.message || errorData.error || errorMessage;
          }
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.text,
        timestamp: new Date().toISOString()
      };

      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s
      ));
    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ ERRO: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, messages: [...s.messages, errorMsg] } : s
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      let activeSessionId = currentSessionId;
      
      if (!activeSessionId) {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: 'Nova Conversa',
          messages: [],
          date: new Date().toLocaleDateString('pt-BR')
        };
        setSessions([newSession, ...sessions]);
        setCurrentSessionId(newSession.id);
        activeSessionId = newSession.id;
      }

      const fileArray = Array.from(files);
      let combinedText = "";
      const imagesToSend: string[] = [];

      // Inform user we are reading the files
      const readingMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Estou lendo ${fileArray.length} arquivo(s). Por favor, aguarde um momento...`,
        timestamp: new Date().toISOString()
      };
      
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...s.messages, readingMsg] } : s
      ));

      for (const file of fileArray) {
        if (file.type === 'application/pdf') {
          const { text, images, isScanned } = await extractTextFromPDF(file);
          combinedText += `\n--- CONTEÚDO DO ARQUIVO: ${file.name} ---\n${text}\n`;
          
          if (isScanned && images.length > 0) {
            combinedText += `\n[AVISO: Este arquivo contém ${images.length} páginas digitalizadas/manuscritas que foram convertidas para imagem para análise visual]\n`;
            imagesToSend.push(...images);
          }
        } else {
          combinedText += `\n--- ARQUIVO ANEXADO: ${file.name} (Tipo não suportado para extração direta) ---\n`;
        }
      }

      const uploadPrompt = `Enviei os seguintes documentos para análise: ${fileArray.map(f => f.name).join(', ')}. 
      
      Abaixo está o conteúdo extraído dos arquivos para sua análise e armazenamento:
      ${combinedText}
      
      INSTRUÇÃO OBRIGATÓRIA: Apenas armazene estas informações e confirme o recebimento. NÃO gere nenhum relatório agora. Aguarde meu comando "GERAR RELATÓRIO".`;
      
      // Send message with images if any
      await handleSendMessage(uploadPrompt, imagesToSend);
    } catch (error: any) {
      console.error("Erro ao processar arquivos:", error);
      alert(`Erro ao ler os arquivos PDF: ${error.message || 'Erro desconhecido'}. Certifique-se de que não estão protegidos por senha.`);
    } finally {
      setIsUploading(false);
    }
  };

  const generateDocx = async (content: string) => {
    try {
      const response = await fetch('/api/dr-michel/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      if (!response.ok) throw new Error('Falha ao gerar documento');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Peticao_Dr_Michel_${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar o arquivo Word.');
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
      
      {/* SIDEBAR: HISTÓRICO */}
      <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-900/50`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4" /> Histórico
          </h3>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <button 
            onClick={createNewSession}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" /> Nova Conversa
          </button>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar conversas..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            {filteredSessions.map(session => (
              <div 
                key={session.id}
                onClick={() => setCurrentSessionId(session.id)}
                className={`group p-3 rounded-xl cursor-pointer border transition-all ${currentSessionId === session.id ? 'bg-white dark:bg-slate-800 border-emerald-500 shadow-md' : 'border-transparent hover:bg-white dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
              >
                {editingSessionId === session.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle(session.id, e);
                        if (e.key === 'Escape') cancelEditing(e as any);
                      }}
                      autoFocus
                      className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-emerald-500 rounded px-2 py-1 text-sm outline-none"
                    />
                    <button onClick={(e) => saveTitle(session.id, e)} className="text-emerald-600 hover:text-emerald-700">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEditing} className="text-red-500 hover:text-red-600">
                      <XMark className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{session.title}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{session.date}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => startEditing(session, e)}
                        className="p-1 text-slate-400 hover:text-emerald-500"
                        title="Renomear conversa"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => deleteSession(session.id, e)}
                        className="p-1 text-slate-400 hover:text-red-500"
                        title="Excluir conversa"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative bg-white dark:bg-slate-950">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 z-10 p-2 bg-white dark:bg-slate-800 shadow-md rounded-full border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* WELCOME SCREEN OR MESSAGES */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {!currentSession || currentSession.messages.length === 0 ? (
            <div className="max-w-4xl mx-auto mt-12 space-y-12">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                  Olá, MICHEL!<br />
                  <span className="text-emerald-600">Bem vindo ao Dr. Michel Felix IA</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400">Seu assistente jurídico de elite para Direito Previdenciário.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2">Resumo de Caso</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Crie resumo de documentos, destacando fatos e argumentos jurídicos.</p>
                  <button 
                    onClick={() => handleSendMessage('Gere um resumo técnico deste caso com base nos dados da calculadora.')}
                    className="mt-4 text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Começar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Briefcase className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2">Geração de Peças</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Redija petições iniciais, recursos e requerimentos prontos para o Word.</p>
                  <button 
                    onClick={() => handleSendMessage('GERAR PEÇA: Petição Inicial de Aposentadoria por Tempo de Contribuição.')}
                    className="mt-4 text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Começar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Search className="w-6 h-6 text-orange-600" />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2">Análise de Provas</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Envie CNIS, PPP ou laudos para identificar lacunas e agentes nocivos.</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Começar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 py-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ou gerencie manualmente abaixo</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8">
              {currentSession.messages.map(msg => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === 'assistant' ? 'bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800' : ''}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'assistant' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                    {msg.role === 'assistant' ? <Bot className="w-6 h-6" /> : <User className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                        {msg.role === 'assistant' ? 'Dr. Michel Felix' : 'Você'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    <div className="flex items-center gap-2">
                      {msg.role === 'assistant' && (
                        <button 
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Copiar texto"
                        >
                          {copiedId === msg.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                        </button>
                      )}
                      {msg.role === 'assistant' && msg.content.includes('PETIÇÃO') && (
                        <button 
                          onClick={() => generateDocx(msg.content)}
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors shadow-sm"
                        >
                          <Download className="w-4 h-4" /> Baixar em Word (.docx)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Dr. Michel Felix</span>
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest animate-pulse">Analisando e fundamentando...</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-4/6"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="max-w-4xl mx-auto relative">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
              <textarea 
                rows={1}
                placeholder="Como posso te ajudar, Dr. Michel?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="w-full p-4 bg-transparent outline-none text-slate-800 dark:text-white resize-none min-h-[56px] max-h-40"
              />
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                    title="Anexar documentos (CNIS, PPP, etc.)"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                </div>
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-3">
              Dr. Michel Felix IA pode cometer erros. Verifique informações importantes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrMichelFelix;
