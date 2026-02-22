import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  UserIcon, DocumentTextIcon, CalculatorIcon, 
  ArrowDownTrayIcon, TrashIcon, PlusIcon, 
  CheckCircleIcon, ExclamationTriangleIcon,
  CalendarDaysIcon, CurrencyDollarIcon, CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import { ClientRecord } from './types';
import { formatCurrency } from './utils';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// --- Types ---

export interface CNISBond {
    id: string;
    seq: number;
    nit: string;
    code: string; // Código do vínculo (ex: 12345)
    origin: string; // Origem do vínculo (ex: EMPRESA X)
    type: string; // Tipo (Empregado, Contribuinte Individual, etc.)
    startDate: string;
    endDate: string;
    indicators: string[]; // Indicadores (ex: IREM-INDP)
    sc: { month: string; value: number }[]; // Salários de Contribuição
}

export interface SocialSecurityData {
    clientName: string;
    clientId?: string; // Link to existing client
    birthDate: string;
    gender: 'M' | 'F';
    motherName: string;
    cpf: string;
    
    cnisContent: string; // Raw text content
    bonds: CNISBond[];
    
    // Analysis Results (Placeholder for future logic)
    analysisDate: string;
}

export interface SocialSecurityCalcProps {
    clients: ClientRecord[];
    onSaveCalculation?: (data: any) => void;
}

// --- Constants & Styles (Reused from LaborCalc for consistency) ---
const STYLES = {
    INPUT_FIELD: "w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all",
    LABEL_TEXT: "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1",
    CARD_SECTION: "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 mb-4",
    CARD_TITLE: "text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide mb-4 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2",
    BTN_PRIMARY: "bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 text-sm",
    BTN_SECONDARY: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2 text-sm",
    TAB_ACTIVE: "bg-indigo-600 text-white shadow-md shadow-indigo-500/30",
    TAB_INACTIVE: "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700",
    EMPTY_MSG: "text-center py-8 text-slate-400 italic text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl"
};

const INITIAL_SS_DATA: SocialSecurityData = {
    clientName: '',
    birthDate: '',
    gender: 'M',
    motherName: '',
    cpf: '',
    cnisContent: '',
    bonds: [],
    analysisDate: new Date().toISOString().split('T')[0]
};

const SocialSecurityCalc: React.FC<SocialSecurityCalcProps> = ({ clients, onSaveCalculation }) => {
    const [activeTab, setActiveTab] = useState(1);
    const [data, setData] = useState<SocialSecurityData>(INITIAL_SS_DATA);

    const [isProcessing, setIsProcessing] = useState(false);

    // --- Handlers ---
    const handleInputChange = (field: keyof SocialSecurityData, value: any) => {
        setData(prev => ({ ...prev, [field]: value }));
    };

    const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const clientId = e.target.value;
        if (!clientId) return;
        
        const client = clients.find(c => c.id === clientId);
        if (client) {
            setData(prev => ({
                ...prev,
                clientId: client.id,
                clientName: client.name,
                cpf: client.cpf,
                // Try to infer birth date from other fields if available, or leave empty
            }));
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Por favor, selecione um arquivo PDF.');
            return;
        }

        setIsProcessing(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += pageText + '\n';
            }

            setData(prev => ({ ...prev, cnisContent: fullText }));
            
            // Auto-trigger parsing after upload
            setTimeout(() => parseCNIS(fullText), 500);

        } catch (error) {
            console.error('Erro ao ler PDF:', error);
            alert('Erro ao processar o arquivo PDF. Verifique se o arquivo é válido.');
        } finally {
            setIsProcessing(false);
        }
    };

    // --- CNIS Parsing Logic ---
    const parseCNIS = (contentOverride?: string) => {
        const content = contentOverride || data.cnisContent;
        if (!content) return;
        
        const bonds: CNISBond[] = [];
        
        // 1. Extract Personal Data
        // Regex to handle fields that might be on the same line or separate lines
        // We use specific lookaheads or stop characters to capture the value
        
        const nameMatch = content.match(/Nome:\s+(.+?)(?=\s+Data|\s+CPF|\s+NIT|$)/);
        const cpfMatch = content.match(/CPF:\s+([\d.-]+)/);
        const birthMatch = content.match(/Data de nascimento:\s+(\d{2}\/\d{2}\/\d{4})/);
        const motherMatch = content.match(/Nome da mãe:\s+(.+?)(?=\s+Página|$)/);
        const nitMatch = content.match(/NIT:\s+([\d.-]+)/);

        const newData: Partial<SocialSecurityData> = {};
        if (nameMatch) newData.clientName = nameMatch[1].trim();
        if (cpfMatch) newData.cpf = cpfMatch[1].trim();
        if (birthMatch) {
            const [d, m, y] = birthMatch[1].split('/');
            newData.birthDate = `${y}-${m}-${d}`;
        }
        if (motherMatch) newData.motherName = motherMatch[1].trim();

        // 2. Extract Bonds (Vínculos)
        // We split by "Seq." which seems to be a reliable delimiter for the start of a bond block in the OCR text.
        // However, "Seq." also appears in the header "Seq. NIT ...".
        // We can split by the header pattern to get blocks.
        
        const blocks = content.split(/Seq\.\s+NIT/);
        
        blocks.slice(1).forEach((block, index) => {
            // The block starts with the bond line (or close to it)
            // Example: "1 123.456.789-0 33.279.993/0058-77 DISTRIBUIDORA ... 07/11/1988 12/1989"
            
            // Find the line that looks like a bond definition
            // It must start with a number (Sequence) and contain a NIT-like pattern
            const bondLineMatch = block.match(/^\s*(\d+)\s+([\d.-]+)\s+/m);
            
            if (bondLineMatch) {
                const seq = parseInt(bondLineMatch[1]);
                const nit = bondLineMatch[2];
                
                // Extract the full line or the first few lines until we hit remunerations
                // Remunerations start with mm/yyyy
                const lines = block.split('\n');
                let bondInfoText = "";
                for (const line of lines) {
                    if (/\d{2}\/\d{4}\s+[\d.,]+/.test(line)) break; // Stop at remuneration
                    if (line.includes("Competência") && line.includes("Remuneração")) continue; // Skip header
                    bondInfoText += " " + line;
                }
                
                // Extract Dates from the bond info text
                // We look for full dates dd/mm/yyyy
                const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;
                const dates = [...bondInfoText.matchAll(datePattern)].map(m => m[0]);
                
                let startDate = '';
                let endDate = '';
                
                if (dates.length > 0) startDate = dates[0];
                if (dates.length > 1) endDate = dates[1];
                
                // Extract Code (CNPJ/CEI)
                const codeMatch = bondInfoText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{11,14}/);
                const code = codeMatch ? codeMatch[0] : '';
                
                // Extract Type
                const typeMatch = bondInfoText.match(/(Empregado|Contribuinte Individual|Facultativo|Trabalhador Avulso|Segurado Especial|Menor Aprendiz|Doméstico)/i);
                const type = typeMatch ? typeMatch[0] : 'Indefinido';
                
                // Extract Origin
                // It's usually between Code and Type
                let origin = 'VÍNCULO IMPORTADO';
                if (code && type !== 'Indefinido') {
                    const startIdx = bondInfoText.indexOf(code) + code.length;
                    const endIdx = bondInfoText.indexOf(type);
                    if (endIdx > startIdx) {
                        origin = bondInfoText.substring(startIdx, endIdx).trim();
                        // Clean up "ou Agente Público" if present
                        origin = origin.replace(/ou Agente Público/i, '').trim();
                    }
                } else if (code) {
                     // Fallback if type not found
                     const startIdx = bondInfoText.indexOf(code) + code.length;
                     // Take next 30 chars?
                     origin = bondInfoText.substring(startIdx, startIdx + 50).trim();
                }

                // Extract Remunerations
                const sc: { month: string; value: number }[] = [];
                const remunRegex = /(\d{2}\/\d{4})\s+([\d.]*,\d{2})/g;
                let remunMatch;
                while ((remunMatch = remunRegex.exec(block)) !== null) {
                    const [_, m, v] = remunMatch;
                    const value = parseFloat(v.replace(/\./g, '').replace(',', '.'));
                    sc.push({ month: m, value });
                }

                // Extract Indicators
                const indicators: string[] = [];
                // Capture uppercase codes that are likely indicators
                // Exclude common header words
                const indicatorRegex = /\b([A-Z0-9]{4,}(?:-[A-Z0-9]+)?)\b/g;
                const ignoredWords = ['COMPETENCIA', 'REMUNERACAO', 'INDICADORES', 'TOTAL', 'PAGINA', 'CNIS', 'INSS', 'DATA', 'NOME', 'FILIADO', 'ORIGEM', 'VINCULO'];
                
                let indMatch;
                while ((indMatch = indicatorRegex.exec(block)) !== null) {
                    const ind = indMatch[1];
                    if (!ignoredWords.includes(ind) && !indicators.includes(ind)) {
                        // Basic validation: Indicators usually don't have numbers unless specific codes
                        // Let's assume valid indicators are mostly letters
                        if (/[A-Z]/.test(ind)) {
                            indicators.push(ind);
                        }
                    }
                }

                bonds.push({
                    id: Math.random().toString(),
                    seq,
                    nit,
                    code,
                    origin,
                    type,
                    startDate: startDate.split('/').reverse().join('-'),
                    endDate: endDate ? endDate.split('/').reverse().join('-') : '',
                    indicators,
                    sc
                });
            }
        });

        if (bonds.length > 0) {
            setData(prev => ({
                ...prev,
                ...newData,
                bonds: [...prev.bonds, ...bonds]
            }));
            setActiveTab(3); // Move to Bonds tab
            alert(`${bonds.length} vínculos importados com sucesso!`);
        } else {
            alert("Não foi possível identificar vínculos no texto. Verifique se copiou o conteúdo corretamente.");
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <CalculatorIcon className="h-6 w-6 text-indigo-600" />
                        Calculadora Previdenciária
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Análise de Tempo de Contribuição e RMI</p>
                </div>
                <div className="flex gap-2">
                    <button className={STYLES.BTN_SECONDARY}>
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Exportar Relatório
                    </button>
                    <button className={STYLES.BTN_PRIMARY}>
                        <CheckCircleIcon className="h-4 w-4" />
                        Salvar Cálculo
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-4 overflow-x-auto">
                {[
                    { id: 1, label: '1. Dados do Segurado', icon: UserIcon },
                    { id: 2, label: '2. Importar CNIS', icon: DocumentTextIcon },
                    { id: 3, label: '3. Vínculos', icon: CalendarDaysIcon },
                    { id: 4, label: '4. Análise & RMI', icon: CurrencyDollarIcon },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? STYLES.TAB_ACTIVE : STYLES.TAB_INACTIVE}`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-5xl mx-auto">
                    
                    {/* TAB 1: DADOS DO SEGURADO */}
                    {activeTab === 1 && (
                        <div className={STYLES.CARD_SECTION}>
                            <h3 className={STYLES.CARD_TITLE}>Identificação</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={STYLES.LABEL_TEXT}>Selecionar Cliente (Opcional)</label>
                                    <select 
                                        className={STYLES.INPUT_FIELD}
                                        onChange={handleClientSelect}
                                        value={data.clientId || ''}
                                    >
                                        <option value="">-- Selecione ou Digite Abaixo --</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} - {c.cpf}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={STYLES.LABEL_TEXT}>Nome Completo</label>
                                    <input 
                                        type="text" 
                                        className={STYLES.INPUT_FIELD} 
                                        value={data.clientName}
                                        onChange={e => handleInputChange('clientName', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={STYLES.LABEL_TEXT}>CPF</label>
                                    <input 
                                        type="text" 
                                        className={STYLES.INPUT_FIELD} 
                                        value={data.cpf}
                                        onChange={e => handleInputChange('cpf', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={STYLES.LABEL_TEXT}>Data de Nascimento</label>
                                    <input 
                                        type="date" 
                                        className={STYLES.INPUT_FIELD} 
                                        value={data.birthDate}
                                        onChange={e => handleInputChange('birthDate', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={STYLES.LABEL_TEXT}>Sexo</label>
                                    <select 
                                        className={STYLES.INPUT_FIELD}
                                        value={data.gender}
                                        onChange={e => handleInputChange('gender', e.target.value as 'M' | 'F')}
                                    >
                                        <option value="M">Masculino</option>
                                        <option value="F">Feminino</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={STYLES.LABEL_TEXT}>Nome da Mãe</label>
                                    <input 
                                        type="text" 
                                        className={STYLES.INPUT_FIELD} 
                                        value={data.motherName}
                                        onChange={e => handleInputChange('motherName', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: IMPORTAR CNIS */}
                    {activeTab === 2 && (
                        <div className={STYLES.CARD_SECTION}>
                            <h3 className={STYLES.CARD_TITLE}>Importação de Dados (CNIS)</h3>
                            
                            <div className="mb-6">
                                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 dark:hover:bg-bray-800 dark:bg-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-600 transition-all">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <CloudArrowUpIcon className={`w-12 h-12 mb-4 ${isProcessing ? 'text-indigo-500 animate-bounce' : 'text-slate-500 dark:text-slate-400'}`} />
                                        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                                            <span className="font-bold">Clique para enviar</span> ou arraste o arquivo aqui
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">PDF do CNIS (Extrato Previdenciário)</p>
                                        {isProcessing && <p className="mt-2 text-sm font-bold text-indigo-500">Processando arquivo...</p>}
                                    </div>
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="application/pdf"
                                        onChange={handleFileUpload}
                                        disabled={isProcessing}
                                    />
                                </label>
                            </div>

                            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Conteúdo Extraído (Depuração)</p>
                                <textarea 
                                    className={`${STYLES.INPUT_FIELD} h-32 font-mono text-[10px] opacity-70`}
                                    placeholder="O conteúdo do PDF aparecerá aqui após o upload..."
                                    value={data.cnisContent}
                                    readOnly
                                />
                                <div className="flex justify-end mt-2">
                                    <button onClick={() => parseCNIS()} className={STYLES.BTN_SECONDARY} disabled={!data.cnisContent}>
                                        <ArrowDownTrayIcon className="h-4 w-4" />
                                        Reprocessar Texto
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: VÍNCULOS */}
                    {activeTab === 3 && (
                        <div className={STYLES.CARD_SECTION}>
                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-2">
                                    Vínculos Empregatícios
                                </h3>
                                <button 
                                    onClick={() => {
                                        const newBond: CNISBond = {
                                            id: Math.random().toString(),
                                            seq: data.bonds.length + 1,
                                            nit: '',
                                            code: '',
                                            origin: 'NOVO VÍNCULO',
                                            type: 'Empregado',
                                            startDate: '',
                                            endDate: '',
                                            indicators: [],
                                            sc: []
                                        };
                                        setData(prev => ({ ...prev, bonds: [...prev.bonds, newBond] }));
                                    }}
                                    className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg font-bold hover:bg-indigo-100 transition"
                                >
                                    + Adicionar Manualmente
                                </button>
                            </div>

                            {data.bonds.length === 0 ? (
                                <div className={STYLES.EMPTY_MSG}>
                                    Nenhum vínculo encontrado. Importe o CNIS ou adicione manualmente.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {data.bonds.map((bond, idx) => (
                                        <div key={bond.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seq. {bond.seq}</span>
                                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">{bond.origin || 'Vínculo Sem Nome'}</h4>
                                                    <p className="text-xs text-slate-500">{bond.type} - Cód: {bond.code}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button className="text-slate-400 hover:text-indigo-500 transition">
                                                        <DocumentTextIcon className="h-5 w-5" title="Ver Remunerações" />
                                                    </button>
                                                    <button 
                                                        onClick={() => setData(prev => ({ ...prev, bonds: prev.bonds.filter(b => b.id !== bond.id) }))}
                                                        className="text-slate-400 hover:text-red-500 transition"
                                                    >
                                                        <TrashIcon className="h-5 w-5" title="Excluir" />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <label className={STYLES.LABEL_TEXT}>Data Início</label>
                                                    <input 
                                                        type="date" 
                                                        className={STYLES.INPUT_FIELD} 
                                                        value={bond.startDate}
                                                        onChange={e => {
                                                            const newBonds = [...data.bonds];
                                                            newBonds[idx].startDate = e.target.value;
                                                            setData(prev => ({ ...prev, bonds: newBonds }));
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={STYLES.LABEL_TEXT}>Data Fim</label>
                                                    <input 
                                                        type="date" 
                                                        className={STYLES.INPUT_FIELD} 
                                                        value={bond.endDate}
                                                        onChange={e => {
                                                            const newBonds = [...data.bonds];
                                                            newBonds[idx].endDate = e.target.value;
                                                            setData(prev => ({ ...prev, bonds: newBonds }));
                                                        }}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className={STYLES.LABEL_TEXT}>Indicadores</label>
                                                    <input 
                                                        type="text" 
                                                        className={STYLES.INPUT_FIELD} 
                                                        placeholder="Ex: IREM-INDP, PREC-FACULT"
                                                        value={bond.indicators.join(', ')}
                                                        onChange={e => {
                                                            const newBonds = [...data.bonds];
                                                            newBonds[idx].indicators = e.target.value.split(',').map(s => s.trim());
                                                            setData(prev => ({ ...prev, bonds: newBonds }));
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 4: ANÁLISE */}
                    {activeTab === 4 && (
                        <div className={STYLES.CARD_SECTION}>
                            <h3 className={STYLES.CARD_TITLE}>Resumo da Análise</h3>
                            
                            {data.bonds.length === 0 ? (
                                <div className={STYLES.EMPTY_MSG}>
                                    Nenhum vínculo para analisar. Importe o CNIS primeiro.
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                            <p className="text-xs font-bold text-indigo-500 uppercase">Tempo Total (Bruto)</p>
                                            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                                                {(() => {
                                                    let totalDays = 0;
                                                    data.bonds.forEach(b => {
                                                        if (b.startDate && b.endDate) {
                                                            const start = new Date(b.startDate);
                                                            const end = new Date(b.endDate);
                                                            const diff = end.getTime() - start.getTime();
                                                            totalDays += Math.ceil(diff / (1000 * 60 * 60 * 24));
                                                        }
                                                    });
                                                    const years = Math.floor(totalDays / 365);
                                                    const months = Math.floor((totalDays % 365) / 30);
                                                    const days = (totalDays % 365) % 30;
                                                    return `${years}a ${months}m ${days}d`;
                                                })()}
                                            </p>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                            <p className="text-xs font-bold text-emerald-500 uppercase">Carência (Contribuições)</p>
                                            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                                                {data.bonds.reduce((acc, b) => acc + b.sc.length, 0)} meses
                                            </p>
                                        </div>
                                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800">
                                            <p className="text-xs font-bold text-amber-500 uppercase">Vínculos Analisados</p>
                                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                                                {data.bonds.length}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                                                <tr>
                                                    <th className="px-4 py-3">Período</th>
                                                    <th className="px-4 py-3">Origem / Empresa</th>
                                                    <th className="px-4 py-3 text-center">Tempo</th>
                                                    <th className="px-4 py-3 text-center">Carência</th>
                                                    <th className="px-4 py-3">Indicadores</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {data.bonds.map(bond => {
                                                    const start = bond.startDate ? new Date(bond.startDate) : null;
                                                    const end = bond.endDate ? new Date(bond.endDate) : null;
                                                    let durationStr = "-";
                                                    if (start && end) {
                                                        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                                        const y = Math.floor(diff / 365);
                                                        const m = Math.floor((diff % 365) / 30);
                                                        durationStr = `${y}a ${m}m`;
                                                    }

                                                    return (
                                                        <tr key={bond.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                                            <td className="px-4 py-3 font-mono text-xs">
                                                                {bond.startDate ? bond.startDate.split('-').reverse().join('/') : '?'} <br/>
                                                                {bond.endDate ? bond.endDate.split('-').reverse().join('/') : 'Ativo'}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="font-bold text-slate-700 dark:text-slate-200">{bond.origin}</div>
                                                                <div className="text-xs text-slate-500">{bond.type}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono text-xs text-slate-600 dark:text-slate-400">
                                                                {durationStr}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-bold text-emerald-600">
                                                                {bond.sc.length}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {bond.indicators.map(ind => (
                                                                        <span key={ind} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-600">
                                                                            {ind}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default SocialSecurityCalc;
