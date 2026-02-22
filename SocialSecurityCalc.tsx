import React, { useState, useEffect } from 'react';
import { 
  UserIcon, DocumentTextIcon, CalculatorIcon, 
  ArrowDownTrayIcon, TrashIcon, PlusIcon, 
  CheckCircleIcon, ExclamationTriangleIcon,
  CalendarDaysIcon, CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { ClientRecord } from './types';
import { formatCurrency } from './utils';

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

    // --- CNIS Parsing Logic ---
    const parseCNIS = () => {
        if (!data.cnisContent) return;
        
        const content = data.cnisContent;
        const bonds: CNISBond[] = [];
        
        // 1. Extract Personal Data
        const nameMatch = content.match(/Nome:\s+([A-Z\s]+)/);
        const cpfMatch = content.match(/CPF:\s+([\d.-]+)/);
        const birthMatch = content.match(/Data de nascimento:\s+(\d{2}\/\d{2}\/\d{4})/);
        const motherMatch = content.match(/Nome da mãe:\s+([A-Z\s]+)/);
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
        // Strategy: Find blocks starting with a sequence number and NIT, followed by company info
        // Regex explanation:
        // Seq\.\s+NIT -> Header
        // (\d+)\s+([\d.-]+)\s+([\d./-]+)\s+(.*?)\s+(Empregado|Contribuinte Individual|Facultativo|Trabalhador Avulso|Segurado Especial|Menor Aprendiz|Doméstico).*?(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})?
        
        // Simplified approach: Split by "Seq." and process each block
        const blocks = content.split(/Seq\.\s+NIT/);
        
        blocks.slice(1).forEach((block, index) => {
            // Extract Bond Info
            // Looking for: 1 123.456.789-0 12.345.678/0001-99 RAZAO SOCIAL TIPO 01/01/2000 01/01/2001
            // Note: The OCR might put these on different lines or merged lines.
            // Let's try to find the date pattern which is reliable: dd/mm/yyyy
            
            const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;
            const dates = [...block.matchAll(datePattern)].map(m => m[0]);
            
            if (dates.length > 0) {
                const startDate = dates[0];
                const endDate = dates.length > 1 ? dates[1] : ''; // Might be empty if active
                
                // Try to find company name and code
                // Usually comes before the type "Empregado" etc.
                const typeMatch = block.match(/(Empregado|Contribuinte Individual|Facultativo|Trabalhador Avulso|Segurado Especial|Menor Aprendiz|Doméstico)/i);
                const type = typeMatch ? typeMatch[0] : 'Desconhecido';
                
                // Extract Code (CNPJ/CEI) - usually looks like 00.000.000/0000-00
                const codeMatch = block.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{11,14}/);
                const code = codeMatch ? codeMatch[0] : '';

                // Extract Origin (Company Name)
                // It's hard to regex perfectly, but usually between Code and Type
                let origin = 'VÍNCULO IMPORTADO';
                if (codeMatch && typeMatch) {
                    const startIdx = block.indexOf(codeMatch[0]) + codeMatch[0].length;
                    const endIdx = block.indexOf(typeMatch[0]);
                    if (endIdx > startIdx) {
                        origin = block.substring(startIdx, endIdx).trim();
                    }
                }

                // Extract Remunerations
                // Pattern: mm/yyyy value
                // Value might have dots and commas: 1.234,56
                const sc: { month: string; value: number }[] = [];
                const remunRegex = /(\d{2}\/\d{4})\s+([\d.]*,\d{2})/g;
                let remunMatch;
                while ((remunMatch = remunRegex.exec(block)) !== null) {
                    const [_, m, v] = remunMatch;
                    // Filter out dates that are likely start/end dates (though regex requires comma, dates usually don't have comma)
                    // But sometimes OCR is messy.
                    // Also check if it's not a date like 01/2000 (could be Jan 2000)
                    
                    const value = parseFloat(v.replace(/\./g, '').replace(',', '.'));
                    sc.push({ month: m, value });
                }

                // Extract Indicators
                // Look for common indicators like IREM-INDP, PREC-FACULT, etc.
                // They are usually uppercase words, sometimes with hyphens
                const indicators: string[] = [];
                const indicatorRegex = /\b[A-Z]{4,}-[A-Z]{3,}\b|\bPEXT\b|\bAEXT-VT\b/g; // Example patterns
                const indMatches = block.match(indicatorRegex);
                if (indMatches) {
                    indMatches.forEach(i => {
                        if (!indicators.includes(i)) indicators.push(i);
                    });
                }

                bonds.push({
                    id: Math.random().toString(),
                    seq: index + 1,
                    nit: nitMatch ? nitMatch[1] : '',
                    code,
                    origin,
                    type,
                    startDate: startDate.split('/').reverse().join('-'), // Convert to YYYY-MM-DD
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
                            <div className="mb-4">
                                <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                                    Copie todo o conteúdo do PDF do CNIS (Ctrl+A, Ctrl+C) e cole no campo abaixo.
                                    O sistema identificará automaticamente os vínculos e remunerações.
                                </p>
                                <textarea 
                                    className={`${STYLES.INPUT_FIELD} h-64 font-mono text-xs`}
                                    placeholder="Cole o conteúdo do CNIS aqui..."
                                    value={data.cnisContent}
                                    onChange={e => handleInputChange('cnisContent', e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end">
                                <button onClick={parseCNIS} className={STYLES.BTN_PRIMARY}>
                                    <DocumentTextIcon className="h-5 w-5" />
                                    Processar CNIS
                                </button>
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
                            <div className={STYLES.EMPTY_MSG}>
                                A análise será gerada após o processamento dos vínculos.
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default SocialSecurityCalc;
