import React, { useState, useEffect, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from "jspdf";
import { 
  UserIcon, DocumentTextIcon, CalculatorIcon, 
  ArrowDownTrayIcon, TrashIcon, PlusIcon, 
  CheckCircleIcon, ExclamationTriangleIcon,
  CalendarDaysIcon, CurrencyDollarIcon, CloudArrowUpIcon,
  MagnifyingGlassIcon, Cog6ToothIcon, TableCellsIcon
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
    code: string;
    origin: string;
    type: string;
    startDate: string;
    endDate: string;
    indicators: string[];
    sc: { month: string; value: number, indicators?: string[] }[];
    
    // New fields for the calculator
    activityType: string; // 'common', 'special_25', etc.
    isConcomitant: boolean;
    useInCalculation: boolean;
}

export interface SocialSecurityData {
    clientName: string;
    clientId?: string;
    birthDate: string;
    gender: 'M' | 'F';
    motherName: string;
    cpf: string;
    
    cnisContent: string;
    bonds: CNISBond[];
    
    // Step 3 Parameters
    calculationType: 'concession' | 'revision';
    der: string;
    reaffirmationDer: string;
    smartPlanning: boolean;
    analysis?: string; // Analysis from Dr. Michel Felix
}

export interface SocialSecurityCalcProps {
    clients: ClientRecord[];
    onSaveCalculation?: (data: any) => void;
}

// --- Constants ---
const STYLES = {
    INPUT_FIELD: "w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all",
    LABEL_TEXT: "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1",
    CARD_SECTION: "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 mb-4",
    CARD_HEADER: "bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30 p-3 rounded-t-xl flex items-center gap-2",
    CARD_TITLE: "text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide",
    BTN_PRIMARY: "bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 text-sm",
    BTN_SECONDARY: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2 text-sm",
    BTN_SUCCESS: "bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 text-sm",
    STEP_BADGE: "flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-amber-900 font-bold text-xs mr-2",
    TABLE_HEADER: "px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700",
    TABLE_CELL: "px-3 py-2 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800",
};

const INITIAL_SS_DATA: SocialSecurityData = {
    clientName: '',
    birthDate: '',
    gender: 'M',
    motherName: '',
    cpf: '',
    cnisContent: '',
    bonds: [],
    calculationType: 'concession',
    der: new Date().toISOString().split('T')[0],
    reaffirmationDer: '',
    smartPlanning: false
};

const SocialSecurityCalc: React.FC<SocialSecurityCalcProps> = ({ clients, onSaveCalculation }) => {
    const [data, setData] = useState<SocialSecurityData>(INITIAL_SS_DATA);
    const [expandedBonds, setExpandedBonds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- Helpers ---
    // Helper to calculate days between two dates (inclusive)
    const getDays = (s: Date, e: Date) => {
        if (s > e) return 0;
        const diff = Math.abs(e.getTime() - s.getTime());
        return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    };

    const calculateTime = (start: string, end: string, type: string, gender: string) => {
        // If start is missing, we can't calculate
        if (!start) return { years: 0, months: 0, days: 0, totalDays: 0 };
        
        const startDate = new Date(start);
        // If end is missing, assume it's up to the DER (or Today if DER is missing)
        // But only if we consider it "Active". For now, let's use DER if provided, else Today.
        let endDate = end ? new Date(end) : (data.der ? new Date(data.der) : new Date());
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
             return { years: 0, months: 0, days: 0, totalDays: 0 };
        }

        // EC 103/2019 Reform Date
        const REFORM_DATE = new Date('2019-11-13');

        let totalAdjustedDays = 0;

        // Determine Factor
        let factor = 1.0;
        if (type === 'special_25') factor = gender === 'M' ? 1.4 : 1.2;
        if (type === 'special_20') factor = gender === 'M' ? 1.75 : 1.5;
        if (type === 'special_15') factor = gender === 'M' ? 2.33 : 2.0;

        if (factor === 1.0) {
            // Common time, no split needed
            totalAdjustedDays = getDays(startDate, endDate);
        } else {
            // Special time, check split
            if (startDate > REFORM_DATE) {
                // Entire period is post-reform -> No conversion (Factor 1.0)
                totalAdjustedDays = getDays(startDate, endDate);
            } else if (endDate <= REFORM_DATE) {
                // Entire period is pre-reform -> Apply Factor
                const rawDays = getDays(startDate, endDate);
                totalAdjustedDays = Math.floor(rawDays * factor);
            } else {
                // Split period
                // Part 1: Start to Reform Date -> Apply Factor
                const part1Days = getDays(startDate, REFORM_DATE);
                const part1Adjusted = Math.floor(part1Days * factor);

                // Part 2: Reform Date + 1 to End -> Factor 1.0
                const postReformStart = new Date(REFORM_DATE);
                postReformStart.setDate(postReformStart.getDate() + 1);
                const part2Days = getDays(postReformStart, endDate);

                totalAdjustedDays = part1Adjusted + part2Days;
            }
        }
        
        const years = Math.floor(totalAdjustedDays / 365.25);
        const months = Math.floor((totalAdjustedDays % 365.25) / 30.44);
        const days = Math.floor((totalAdjustedDays % 365.25) % 30.44);

        return { years, months, days, totalDays: totalAdjustedDays };
    };
    
    // Unified Time Calculation (Day-by-Day Simulation)
    // Handles concurrency (counts only once) and Special Time multipliers (pre-Reform)
    const unifiedTime = useMemo(() => {
        const activeBonds = data.bonds.filter(b => b.useInCalculation && b.startDate);
        
        if (activeBonds.length === 0) return "0 anos, 0 meses e 0 dias";

        // 1. Determine Global Range
        let minDateMs = Infinity;
        let maxDateMs = -Infinity;

        const processedBonds = activeBonds.map(b => {
            const start = new Date(b.startDate);
            start.setHours(12, 0, 0, 0);
            
            let endStr = b.endDate || data.der || new Date().toISOString().split('T')[0];
            const end = new Date(endStr);
            end.setHours(12, 0, 0, 0);

            if (start.getTime() < minDateMs) minDateMs = start.getTime();
            if (end.getTime() > maxDateMs) maxDateMs = end.getTime();

            // Determine Factor
            let factor = 1.0;
            if (b.activityType === 'special_25') factor = data.gender === 'M' ? 1.4 : 1.2;
            if (b.activityType === 'special_20') factor = data.gender === 'M' ? 1.75 : 1.5;
            if (b.activityType === 'special_15') factor = data.gender === 'M' ? 2.33 : 2.0;

            return { startMs: start.getTime(), endMs: end.getTime(), factor };
        }).filter(b => !isNaN(b.startMs) && !isNaN(b.endMs) && b.startMs <= b.endMs);

        if (processedBonds.length === 0) return "0 anos, 0 meses e 0 dias";

        // EC 103/2019 Reform Date (13/11/2019)
        const REFORM_DATE_MS = new Date('2019-11-13').setHours(12, 0, 0, 0);

        let totalAdjustedDays = 0;
        
        // 2. Iterate Day by Day using Date object to avoid DST drift
        let current = new Date(minDateMs);
        const maxDate = new Date(maxDateMs);
        
        // Limit to 100 years to prevent infinite loops
        const MAX_LOOPS = 100 * 366; 
        let loops = 0;

        while (current <= maxDate && loops < MAX_LOOPS) {
            const currentMs = current.getTime();
            
            // Find max factor for this day
            let maxFactorForDay = 0;
            let isActive = false;

            for (const bond of processedBonds) {
                if (currentMs >= bond.startMs && currentMs <= bond.endMs) {
                    isActive = true;
                    // Apply factor only if Pre-Reform
                    const applicableFactor = (currentMs < REFORM_DATE_MS) ? bond.factor : 1.0;
                    if (applicableFactor > maxFactorForDay) {
                        maxFactorForDay = applicableFactor;
                    }
                }
            }

            if (isActive) {
                totalAdjustedDays += maxFactorForDay;
            }

            // Next day
            current.setDate(current.getDate() + 1);
            current.setHours(12, 0, 0, 0); // Maintain noon to be safe
            loops++;
        }

        const years = Math.floor(totalAdjustedDays / 365.25);
        const months = Math.floor((totalAdjustedDays % 365.25) / 30.44);
        const days = Math.floor((totalAdjustedDays % 365.25) % 30.44);
        
        return `${years} anos, ${months} meses e ${days} dias`;
    }, [data.bonds, data.gender, data.der]);

    // Unified Carência Calculation (Merge Months)
    const calculateUnifiedCarencia = () => {
        const uniqueMonths = new Set<string>();

        data.bonds.forEach(bond => {
            if (!bond.useInCalculation) return;

            // Priority: Date Range (since SCs might be missing from AI)
            if (bond.startDate && bond.endDate) {
                let current = new Date(bond.startDate);
                // Normalize to start of month and noon to avoid timezone issues
                current.setDate(1);
                current.setHours(12, 0, 0, 0);
                
                const end = new Date(bond.endDate);
                end.setDate(1);
                end.setHours(12, 0, 0, 0);

                // Safety break for infinite loops (e.g. bad dates)
                let safety = 0;
                while (current <= end && safety < 1200) { // 100 years max
                    const m = String(current.getMonth() + 1).padStart(2, '0');
                    const y = current.getFullYear();
                    uniqueMonths.add(`${m}/${y}`);
                    
                    // Move to next month
                    current.setMonth(current.getMonth() + 1);
                    safety++;
                }
            } else if (bond.sc && bond.sc.length > 0) {
                // Fallback to SCs if dates are missing
                bond.sc.forEach(s => uniqueMonths.add(s.month));
            }
        });

        return uniqueMonths.size;
    };

    // Helper to calculate carência for a single bond (for the table)
    const calculateBondCarencia = (bond: CNISBond) => {
        if (bond.startDate && bond.endDate) {
            let current = new Date(bond.startDate);
            current.setDate(1);
            current.setHours(12, 0, 0, 0);
            
            const end = new Date(bond.endDate);
            end.setDate(1);
            end.setHours(12, 0, 0, 0);

            let count = 0;
            let safety = 0;
            while (current <= end && safety < 1200) {
                count++;
                current.setMonth(current.getMonth() + 1);
                safety++;
            }
            return count;
        }
        return bond.sc.length;
    };

    // Helper to generate full monthly history including gaps
    const generateFullMonthlyHistory = (bond: CNISBond) => {
        const history: { month: string, value: number | null, indicators: string[], isMissing: boolean }[] = [];
        
        // If no start date, we can only show what we have
        if (!bond.startDate) {
            return bond.sc.map(s => ({ month: s.month, value: s.value, indicators: s.indicators || [], isMissing: false }));
        }

        let current = new Date(bond.startDate);
        // Normalize to start of month
        current.setDate(1);
        current.setHours(12, 0, 0, 0);

        let end: Date;
        if (bond.endDate) {
            end = new Date(bond.endDate);
        } else {
            // If active, go up to today
            end = new Date();
        }
        end.setDate(1);
        end.setHours(12, 0, 0, 0);

        // Create a map of existing SCs
        const scMap = new Map();
        bond.sc.forEach(s => scMap.set(s.month, s));

        let safety = 0;
        while (current <= end && safety < 1200) {
            const m = String(current.getMonth() + 1).padStart(2, '0');
            const y = current.getFullYear();
            const monthStr = `${m}/${y}`;

            if (scMap.has(monthStr)) {
                const s = scMap.get(monthStr);
                history.push({ month: monthStr, value: s.value, indicators: s.indicators || [], isMissing: false });
            } else {
                history.push({ month: monthStr, value: null, indicators: [], isMissing: true });
            }
            
            current.setMonth(current.getMonth() + 1);
            safety++;
        }
        
        return history;
    };

    // --- Handlers ---
    const toggleBondExpansion = (bondId: string) => {
        setExpandedBonds(prev => 
            prev.includes(bondId) ? prev.filter(id => id !== bondId) : [...prev, bondId]
        );
    };

    const handleInputChange = (field: keyof SocialSecurityData, value: any) => {
        setData(prev => ({ ...prev, [field]: value }));
    };

    const handleBondChange = (id: string, field: keyof CNISBond, value: any) => {
        setData(prev => ({
            ...prev,
            bonds: prev.bonds.map(b => b.id === id ? { ...b, [field]: value } : b)
        }));
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
            }));
        }
    };

    const analyzeCNISWithAI = async (text: string): Promise<Partial<SocialSecurityData> | null> => {
        try {
            const response = await fetch('/api/analyze-cnis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cnisContent: text })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("AI API Error:", response.status, errorText);
                alert(`Erro na IA (Debug): Status ${response.status}\nDetalhes: ${errorText}`);
                return null;
            }

            let aiData;
            try {
                aiData = await response.json();
            } catch (e) {
                console.error("Failed to parse AI JSON:", e);
                alert("Erro ao processar resposta da IA (JSON inválido). O servidor pode ter retornado um erro não tratado.");
                return null;
            }
            
            if (!aiData || !aiData.bonds) {
                console.warn("AI returned no bonds:", aiData);
                return null;
            }

            const mappedBonds: CNISBond[] = (aiData.bonds || []).map((b: any) => {
                // AI returns YYYY-MM-DD. We MUST keep it as YYYY-MM-DD for <input type="date">
                let startDate = b.startDate || '';
                let endDate = b.endDate || '';
                
                const sc = (b.sc || []).map((s: any) => ({ 
                    month: s.month, 
                    value: s.value,
                    indicators: s.indicators || []
                }));

                // Post-Processing: Infer dates if missing
                if (!startDate && sc.length > 0) {
                    // Use first SC month as start date (01/MM/YYYY -> YYYY-MM-01)
                    const [m, y] = sc[0].month.split('/');
                    startDate = `${y}-${m}-01`;
                }

                if (!endDate && sc.length > 0) {
                    // Use last SC month as end date (Last Day of Month)
                    const lastSc = sc[sc.length - 1];
                    const [m, y] = lastSc.month.split('/').map(Number);
                    const lastDay = new Date(y, m, 0).getDate();
                    endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                }

                return {
                    id: crypto.randomUUID(),
                    seq: b.seq,
                    nit: b.nit,
                    code: b.code,
                    origin: b.origin,
                    type: b.type,
                    startDate,
                    endDate,
                    indicators: b.indicators || [],
                    sc,
                    activityType: 'common',
                    isConcomitant: b.isConcomitant || false,
                    useInCalculation: true
                };
            });

            return {
                clientName: aiData.client.name,
                cpf: aiData.client.cpf,
                birthDate: aiData.client.birthDate ? aiData.client.birthDate.split('-').reverse().join('/') : '',
                motherName: aiData.client.motherName,
                gender: aiData.client.gender,
                bonds: mappedBonds,
                analysis: aiData.analysis
            };
        } catch (error) {
            console.error("AI Analysis failed", error);
            return null;
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
            
            // Try AI first
            // Truncate text to ~300k characters to avoid Vercel function timeouts (approx 60-80 pages of dense text)
            // The free tier has a 10s limit, Pro has 60s (or 300s if configured). 
            // Gemini has a large context window, so we can send more.
            const truncatedText = fullText.length > 300000 ? fullText.substring(0, 300000) + "\n...[Texto truncado para análise]..." : fullText;
            
            const aiResult = await analyzeCNISWithAI(truncatedText);
            
            if (aiResult) {
                setData(prev => ({
                    ...prev,
                    ...aiResult,
                    bonds: aiResult.bonds || [],
                    cnisContent: fullText
                }));
                alert("Análise concluída! (Dados processados 100% via IA)");
            } else {
                console.error("AI Analysis failed and local fallback is disabled.");
                alert("A análise da IA falhou. Por favor, tente novamente ou verifique o arquivo.");
            }

        } catch (error) {
            console.error('Erro ao ler PDF:', error);
            alert('Erro ao processar o arquivo PDF. Verifique se o arquivo é válido.');
        } finally {
            setIsProcessing(false);
        }
    };

    const generateReport = () => {
        // @ts-ignore
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        
        // Header
        doc.setFontSize(18);
        doc.text("Relatório de Análise Previdenciária", pageWidth / 2, 20, { align: "center" });
        
        doc.setFontSize(12);
        doc.text(`Cliente: ${data.clientName || "Não informado"}`, margin, 35);
        doc.text(`CPF: ${data.cpf || "Não informado"}`, margin, 42);
        doc.text(`Data de Nascimento: ${data.birthDate ? data.birthDate.split('-').reverse().join('/') : "Não informada"}`, margin, 49);
        doc.text(`DER: ${data.der ? data.der.split('-').reverse().join('/') : "Não informada"}`, margin, 56);
        
        doc.line(margin, 60, pageWidth - margin, 60);
        
        // Summary
        doc.setFontSize(14);
        doc.text("Resumo do Tempo de Contribuição", margin, 70);
        doc.setFontSize(12);
        doc.text(`Tempo Total Calculado: ${calculateUnifiedTime()}`, margin, 80);
        
        // Bonds Table
        let y = 95;
        doc.setFontSize(14);
        doc.text("Detalhamento dos Vínculos", margin, y);
        y += 10;
        
        doc.setFontSize(10);
        // Table Header
        doc.text("Seq", margin, y);
        doc.text("Origem", margin + 10, y);
        doc.text("Início", margin + 80, y);
        doc.text("Fim", margin + 105, y);
        doc.text("Tempo", margin + 130, y);
        doc.text("Carência", margin + 160, y);
        
        y += 5;
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
        
        data.bonds.forEach((bond, idx) => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            
            if (bond.useInCalculation) {
                const time = calculateTime(bond.startDate, bond.endDate, bond.activityType, data.gender);
                const timeStr = `${time.years}a ${time.months}m ${time.days}d`;
                
                doc.text((idx + 1).toString(), margin, y);
                doc.text(bond.origin.substring(0, 35), margin + 10, y);
                doc.text(bond.startDate ? bond.startDate.split('-').reverse().join('/') : '-', margin + 80, y);
                doc.text(bond.endDate ? bond.endDate.split('-').reverse().join('/') : '-', margin + 105, y);
                doc.text(timeStr, margin + 130, y);
                doc.text(bond.sc.length.toString(), margin + 160, y);
                
                y += 7;
            }
        });
        
        doc.save(`Relatorio_Previdenciario_${data.clientName.replace(/\s+/g, '_')}.pdf`);
    };

    const handleSave = () => {
        if (onSaveCalculation) {
            onSaveCalculation(data);
            alert("Cálculo salvo com sucesso!");
        } else {
            console.log("Salvar cálculo não implementado (falta onSaveCalculation prop)");
            alert("Função de salvar não disponível neste contexto.");
        }
    };

    const handleSalaryChange = (bondId: string, month: string, newValue: string) => {
        const valueFloat = parseFloat(newValue.replace(/\./g, '').replace(',', '.'));
        
        setData(prev => {
            const newBonds = prev.bonds.map(bond => {
                if (bond.id !== bondId) return bond;

                const newSc = [...bond.sc];
                const existingIndex = newSc.findIndex(s => s.month === month);

                if (isNaN(valueFloat)) {
                    // If invalid or empty, remove the entry if it exists (reset to missing)
                    if (existingIndex !== -1) {
                        newSc.splice(existingIndex, 1);
                    }
                } else {
                    // Update or Add
                    if (existingIndex !== -1) {
                        newSc[existingIndex].value = valueFloat;
                    } else {
                        newSc.push({ month, value: valueFloat, indicators: [] });
                    }
                }
                
                // Sort SCs
                newSc.sort((a, b) => {
                    const [ma, ya] = a.month.split('/').map(Number);
                    const [mb, yb] = b.month.split('/').map(Number);
                    return (ya * 12 + ma) - (yb * 12 + mb);
                });

                return { ...bond, sc: newSc };
            });
            return { ...prev, bonds: newBonds };
        });
    };

    // --- CNIS Parsing Logic (Refined) ---
    const parseCNIS = (contentOverride?: string) => {
        const content = contentOverride || data.cnisContent;
        if (!content) return;
        
        const bonds: CNISBond[] = [];
        
        // 1. Extract Personal Data
        const nameMatch = content.match(/Nome:\s+(.+?)(?=\s+Data|\s+CPF|\s+NIT|$)/);
        const cpfMatch = content.match(/CPF:\s+([\d.-]+)/);
        const birthMatch = content.match(/Data de nascimento:\s+(\d{2}\/\d{2}\/\d{4})/);
        const motherMatch = content.match(/Nome da mãe:\s+(.+?)(?=\s+Página|$)/);

        const newData: Partial<SocialSecurityData> = {};
        if (nameMatch) newData.clientName = nameMatch[1].trim();
        if (cpfMatch) newData.cpf = cpfMatch[1].trim();
        if (birthMatch) {
            const [d, m, y] = birthMatch[1].split('/');
            newData.birthDate = `${y}-${m}-${d}`;
        }
        if (motherMatch) newData.motherName = motherMatch[1].trim();

        // 2. Extract Bonds - Split by "Seq." to isolate blocks
        // We use a regex that looks for "Seq." followed by a number to split
        // But since split consumes the separator, we need to be careful.
        // Instead, let's find all indices of "Seq." followed by a number
        
        // Alternative: The text from PDF.js often has "Seq." then "NIT" then "Código Emp." on one line
        // and then the actual data on the next.
        // Or "1 123.456..."
        
        // Let's try to find blocks starting with a sequence number at the start of a line (or after newline)
        // Regex: \n\s*(\d+)\s+(\d{3}\.\d{5}\.\d{2}-\d)
        
        // Based on the OCR provided:
        // "1 27.638.097/0001-19 LABORATORIO..."
        // "2 124.56525.90-8 1183224483 Benefício..."
        
        // We will look for the pattern: Sequence Number + (NIT or CNPJ)
        // We'll iterate through the text finding these start points.
        
        const bondStartRegex = /\b(\d+)\s+(?=\d{3}\.\d{5}\.\d{2}-\d|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{2}\.\d{3}\.\d{5}\/\d{2})/g;
        
        let match;
        const indices: number[] = [];
        while ((match = bondStartRegex.exec(content)) !== null) {
            indices.push(match.index);
        }
        
        indices.forEach((startIndex, i) => {
            const endIndex = indices[i+1] || content.length;
            const block = content.substring(startIndex, endIndex);
            
            // Parse the block
            const seqMatch = block.match(/^(\d+)/);
            if (!seqMatch) return;
            const seq = parseInt(seqMatch[1]);
            
            // Extract NIT
            const nitMatch = block.match(/(\d{3}\.\d{5}\.\d{2}-\d)/);
            const nit = nitMatch ? nitMatch[0] : '';

            // Extract Code (CNPJ/CEI)
            const codeMatch = block.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{2}\.\d{3}\.\d{5}\/\d{2})/);
            const code = codeMatch ? codeMatch[0] : '';
            
            // Extract Type
            const typeMatch = block.match(/(Empregado|Contribuinte Individual|Facultativo|Trabalhador Avulso|Segurado Especial|Menor Aprendiz|Doméstico)/i);
            const type = typeMatch ? typeMatch[0] : 'Indefinido';

            // Extract Origin
            let origin = 'VÍNCULO SEM NOME';
            if (code) {
                // Try to find the company name. It usually comes after the code.
                // "27.638.097/0001-19 LABORATORIO CELULA..."
                const codeIndex = block.indexOf(code);
                if (codeIndex !== -1) {
                    const afterCode = block.substring(codeIndex + code.length).trim();
                    // It usually ends before "Empregado" or a date
                    const endNameMatch = afterCode.match(/(Empregado|Contribuinte|Facultativo|Trabalhador|\d{2}\/\d{2}\/\d{4})/);
                    if (endNameMatch && endNameMatch.index) {
                        let rawName = afterCode.substring(0, endNameMatch.index).trim();
                        // Cleanup common OCR artifacts
                        rawName = rawName.replace(/Origem do Vínculo/i, '').replace(/-/g, ' ').trim();
                        if (rawName.length > 2) origin = rawName;
                    }
                }
            } else if (type === 'Contribuinte Individual' || type === 'Facultativo') {
                origin = 'RECOLHIMENTO PRÓPRIO';
            } else if (block.includes('Benefício')) {
                 // Handle Benefit case
                 const benefitMatch = block.match(/Benefício\s+([0-9]+(?:\s+-\s+[A-Z\s]+)?)/);
                 if (benefitMatch) {
                     origin = "BENEFÍCIO " + benefitMatch[1];
                 } else {
                     origin = "BENEFÍCIO INSS";
                 }
            }

            // Extract Dates
            // Look for dates in the first part of the block (header)
            // We assume the first two dates found are Start and End
            // But we must be careful not to pick up dates from the "Remunerações" section immediately
            // The header usually ends before "Remunerações" or "Competência"
            
            const headerEndIndex = block.search(/(Remunerações|Competência)/);
            const headerPart = headerEndIndex !== -1 ? block.substring(0, headerEndIndex) : block.substring(0, 500);
            
            // Find full dates (DD/MM/YYYY)
            const fullDatePattern = /(\d{2}\/\d{2}\/\d{4})/g;
            const fullDates = [...headerPart.matchAll(fullDatePattern)].map(m => ({ text: m[0], index: m.index! }));
            
            let startDate = '';
            let endDate = '';
            
            if (fullDates.length >= 2) {
                startDate = fullDates[0].text;
                endDate = fullDates[1].text;
            } else if (fullDates.length === 1) {
                startDate = fullDates[0].text;
            }

            // Se não encontrou data fim (endDate vazio), tenta buscar por "Últ. Remun."
            if (!endDate) {
                // Tenta encontrar padrão MM/AAAA que apareça após a data de início
                // Muitas vezes aparece abaixo de "Últ. Remun."
                const startIndex = fullDates.length > 0 ? fullDates[0].index + 10 : 0;
                const searchPart = headerPart.substring(startIndex);
                
                // Procura explícito por "Últ. Remun." ou apenas uma data MM/AAAA solta
                const lastRemunLabelMatch = searchPart.match(/(?:Últ\.|Ult\.|Última|Ultima)\s*Remun\.?\s*(\d{2}\/\d{4})/i);
                
                if (lastRemunLabelMatch) {
                     const lastRemun = lastRemunLabelMatch[1];
                     const [m, y] = lastRemun.split('/').map(Number);
                     // Fix: Use the LAST day of the month
                     const lastDay = new Date(y, m, 0).getDate(); 
                     endDate = `${String(lastDay).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
                } else {
                    // Fallback: Pega a primeira data MM/AAAA que encontrar após o início
                    const mmYyyyPattern = /(\d{2}\/\d{4})/g;
                    const mmYyyyMatches = [...searchPart.matchAll(mmYyyyPattern)];
                    
                    if (mmYyyyMatches.length > 0) {
                        const lastRemun = mmYyyyMatches[0][0];
                        const [m, y] = lastRemun.split('/').map(Number);
                        // Fix: Use the LAST day of the month
                        const lastDay = new Date(y, m, 0).getDate();
                        endDate = `${String(lastDay).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
                    }
                }
            }

            // Extract Indicators
            const bondIndicators: string[] = [];
            const indMatch = block.match(/Indicadores:\s+([A-Z0-9-,\s]+)/);
            if (indMatch) {
                // Only take indicators if they are in the header part
                if (block.indexOf(indMatch[0]) < (headerEndIndex !== -1 ? headerEndIndex : 500)) {
                    const inds = indMatch[1].split(/[\s,]+/);
                    inds.forEach(i => {
                        if (i.length >= 3 && !bondIndicators.includes(i)) bondIndicators.push(i);
                    });
                }
            }

            // Extract Remunerations
            const sc: { month: string; value: number, indicators?: string[] }[] = [];
            // Regex for MM/YYYY followed by Value
            // Value can be "1.234,56"
            const remunRegex = /(\d{2}\/\d{4})\s+([\d.]*,\d{2})(?:\s+([A-Z0-9-]+))?/g;
            
            let remunMatch;
            // We search in the whole block
            while ((remunMatch = remunRegex.exec(block)) !== null) {
                const [_, m, v, ind] = remunMatch;
                
                // Avoid capturing the header dates as remunerations if they match the format (unlikely for full dates, but MM/YYYY matches)
                // Actually header dates are DD/MM/YYYY, so they won't match MM/YYYY exactly unless regex is loose.
                // Our regex requires MM/YYYY.
                
                // Also check if this date is the same as start/end date (sometimes OCR duplicates)
                // But usually Remuneration is distinct.
                
                const value = parseFloat(v.replace(/\./g, '').replace(',', '.'));
                sc.push({ month: m, value, indicators: ind ? [ind] : [] });
            }

            // Sort SC
            sc.sort((a, b) => {
                const [ma, ya] = a.month.split('/').map(Number);
                const [mb, yb] = b.month.split('/').map(Number);
                return (ya * 12 + ma) - (yb * 12 + mb);
            });

            // Infer End Date if missing
            if (!endDate && sc.length > 0) {
                const lastRemun = sc[sc.length - 1];
                const [m, y] = lastRemun.month.split('/').map(Number);
                // Fix: Use the LAST day of the month
                const lastDay = new Date(y, m, 0).getDate();
                endDate = `${String(lastDay).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
            }

            bonds.push({
                id: Math.random().toString(),
                seq,
                nit,
                code,
                origin,
                type,
                startDate: startDate ? startDate.split('/').reverse().join('-') : '',
                endDate: endDate ? endDate.split('/').reverse().join('-') : '',
                indicators: bondIndicators,
                sc,
                activityType: 'common',
                isConcomitant: false,
                useInCalculation: true
            });
        });

        if (bonds.length > 0) {
            setData(prev => ({
                ...prev,
                ...newData,
                bonds: [...prev.bonds, ...bonds]
            }));
            // alert(`${bonds.length} vínculos importados com sucesso!`);
        } else {
            alert("Não foi possível identificar vínculos. Verifique se o PDF é um CNIS válido.");
        }
    };

    const handleAddBond = () => {
        const newBond: CNISBond = {
            id: crypto.randomUUID(),
            seq: data.bonds.length + 1,
            origin: 'Novo Período',
            startDate: '',
            endDate: '',
            sc: [],
            indicators: [],
            type: 'Empregado',
            activityType: 'common',
            isConcomitant: false,
            useInCalculation: true
        };
        setData(prev => ({ ...prev, bonds: [...prev.bonds, newBond] }));
    };

    const handleExpandAll = () => {
        if (expandedBonds.length === data.bonds.length) {
            setExpandedBonds([]);
        } else {
            setExpandedBonds(data.bonds.map(b => b.id));
        }
    };

    const handleSortBonds = () => {
        setData(prev => ({
            ...prev,
            bonds: [...prev.bonds].sort((a, b) => {
                if (!a.startDate) return 1;
                if (!b.startDate) return -1;
                return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
            })
        }));
    };

    const handleRemoveEmpty = () => {
        setData(prev => ({
            ...prev,
            bonds: prev.bonds.filter(b => b.startDate || b.endDate || b.sc.length > 0)
        }));
    };

    const handleRemoveAll = () => {
        if (confirm('Tem certeza que deseja remover todos os períodos?')) {
            setData(prev => ({ ...prev, bonds: [] }));
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-y-auto">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <CalculatorIcon className="h-6 w-6 text-indigo-600" />
                        Calculadora Previdenciária
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Análise de Tempo de Contribuição e RMI</p>
                </div>
                <div className="flex gap-2">
                    <button className={STYLES.BTN_SECONDARY} onClick={generateReport}>
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Exportar Relatório
                    </button>
                    <button className={STYLES.BTN_PRIMARY} onClick={handleSave}>
                        <CheckCircleIcon className="h-4 w-4" />
                        Salvar Cálculo
                    </button>
                </div>
            </div>

            <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
                
                {/* STEP 1: IMPORTAÇÃO */}
                <div className={STYLES.CARD_SECTION}>
                    <div className={STYLES.CARD_HEADER}>
                        <span className={STYLES.STEP_BADGE}>1</span>
                        <h3 className={STYLES.CARD_TITLE}>Importação do CNIS <span className="text-slate-400 text-[10px] normal-case font-normal">(Opcional)</span></h3>
                    </div>
                    <div className="p-4">
                        {data.bonds.length > 0 ? (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
                                    <div>
                                        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">CNIS importado com sucesso contendo {data.bonds.length} vínculos.</p>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">Os dados foram carregados nos passos abaixo.</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        className="text-xs bg-white dark:bg-slate-800 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg hover:bg-emerald-50 transition"
                                        onClick={() => document.getElementById('cnis-upload')?.click()}
                                    >
                                        Reimportar CNIS
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col md:flex-row gap-6 items-center">
                                <div className="flex-1">
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-emerald-500 border-dashed rounded-lg cursor-pointer bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 transition-all group">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <CloudArrowUpIcon className={`w-8 h-8 mb-2 ${isProcessing ? 'text-emerald-600 animate-bounce' : 'text-emerald-600 group-hover:scale-110 transition-transform'}`} />
                                            <p className="text-sm font-bold text-emerald-700">Importar um novo CNIS (PDF)</p>
                                        </div>
                                        <input 
                                            id="cnis-upload"
                                            type="file" 
                                            className="hidden" 
                                            accept="application/pdf"
                                            onChange={handleFileUpload}
                                            disabled={isProcessing}
                                        />
                                    </label>
                                </div>
                                <div className="flex-1 text-sm text-slate-600 dark:text-slate-400 border-l-4 border-blue-400 pl-4 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-r-lg">
                                    <p>A importação do CNIS é opcional, mas <strong>altamente recomendada</strong>.</p>
                                    <p className="mt-1">Importando o CNIS você não precisa digitar os períodos contributivos e os salários de contribuição já reconhecidos pelo INSS.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* STEP 2: DADOS DO SEGURADO */}
                <div className={STYLES.CARD_SECTION}>
                    <div className={STYLES.CARD_HEADER}>
                        <span className={STYLES.STEP_BADGE}>2</span>
                        <h3 className={STYLES.CARD_TITLE}>Dados do Segurado</h3>
                        <div className="ml-auto">
                            <select 
                                className="text-xs bg-white dark:bg-slate-800 border border-slate-300 rounded px-2 py-1"
                                onChange={handleClientSelect}
                                value={data.clientId || ''}
                            >
                                <option value="">Carregar de Cliente...</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-1">
                            <label className={STYLES.LABEL_TEXT}>CPF</label>
                            <input 
                                type="text" 
                                className={STYLES.INPUT_FIELD} 
                                value={data.cpf}
                                onChange={e => handleInputChange('cpf', e.target.value)}
                            />
                        </div>
                        <div className="lg:col-span-2">
                            <label className={STYLES.LABEL_TEXT}>Nome do Segurado</label>
                            <input 
                                type="text" 
                                className={STYLES.INPUT_FIELD} 
                                value={data.clientName}
                                onChange={e => handleInputChange('clientName', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={STYLES.LABEL_TEXT}>Data de Nascimento</label>
                            <input 
                                type="date" 
                                className={`${STYLES.INPUT_FIELD} ${!data.birthDate ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : ''}`}
                                value={data.birthDate}
                                onChange={e => handleInputChange('birthDate', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={STYLES.LABEL_TEXT}>Sexo</label>
                            <select 
                                className={`${STYLES.INPUT_FIELD} ${!data.gender ? 'border-red-300' : ''}`}
                                value={data.gender}
                                onChange={e => handleInputChange('gender', e.target.value as 'M' | 'F')}
                            >
                                <option value="M">Masculino</option>
                                <option value="F">Feminino</option>
                            </select>
                        </div>
                        <div className="lg:col-span-3">
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

                {/* STEP 2.5: ANÁLISE JURÍDICA (IA) */}
                {data.analysis && (
                    <div className={`${STYLES.CARD_SECTION} border-l-4 border-indigo-500`}>
                        <div className={STYLES.CARD_HEADER}>
                            <span className={`${STYLES.STEP_BADGE} bg-indigo-600`}>IA</span>
                            <h3 className={STYLES.CARD_TITLE}>Análise Jurídica Preliminar (Dr. Michel Felix)</h3>
                        </div>
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-sm whitespace-pre-wrap font-serif">
                            {data.analysis}
                        </div>
                    </div>
                )}

                {/* STEP 3: PARÂMETROS */}
                <div className={STYLES.CARD_SECTION}>
                    <div className={STYLES.CARD_HEADER}>
                        <span className={STYLES.STEP_BADGE}>3</span>
                        <h3 className={STYLES.CARD_TITLE}>Parâmetros</h3>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label className={STYLES.LABEL_TEXT}>Concessão, planejamento previdenciário ou revisão</label>
                            <div className="flex gap-4 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="calcType" 
                                        checked={data.calculationType === 'concession'}
                                        onChange={() => handleInputChange('calculationType', 'concession')}
                                        className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">Concessão de novo benefício e/ou planejamento</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="calcType" 
                                        checked={data.calculationType === 'revision'}
                                        onChange={() => handleInputChange('calculationType', 'revision')}
                                        className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">Revisão de benefício já concedido</span>
                                </label>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={STYLES.LABEL_TEXT}>Data de Entrada do Requerimento (DER)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="date" 
                                        className={STYLES.INPUT_FIELD} 
                                        value={data.der}
                                        onChange={e => handleInputChange('der', e.target.value)}
                                    />
                                    <button 
                                        onClick={() => handleInputChange('der', new Date().toISOString().split('T')[0])}
                                        className="whitespace-nowrap px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 transition"
                                    >
                                        Hoje
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className={STYLES.LABEL_TEXT}>Reafirmação da DER (Opcional)</label>
                                <input 
                                    type="date" 
                                    className={STYLES.INPUT_FIELD} 
                                    value={data.reaffirmationDer}
                                    onChange={e => handleInputChange('reaffirmationDer', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-start gap-2 pt-2">
                            <input 
                                type="checkbox" 
                                id="smartPlanning"
                                checked={data.smartPlanning}
                                onChange={e => handleInputChange('smartPlanning', e.target.checked)}
                                className="mt-1 text-indigo-600 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="smartPlanning" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                <span className="font-bold block">Fazer Planejamento Previdenciário Inteligente</span>
                                <span className="text-xs text-slate-500">Se marcada, inclui na análise a situação do segurado na data de hoje, indica quando poderá se aposentar e se vale a pena continuar recolhendo.</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* STEP 4: VÍNCULOS (GRID) */}
                <div className={STYLES.CARD_SECTION}>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                        <div className="flex gap-2">
                            <button className={STYLES.BTN_SUCCESS} onClick={handleAddBond}>
                                <PlusIcon className="h-4 w-4" />
                                Adicionar novo período
                            </button>
                            <button className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all flex items-center gap-2 text-sm" onClick={handleExpandAll}>
                                <Cog6ToothIcon className="h-4 w-4" />
                                {expandedBonds.length > 0 && expandedBonds.length === data.bonds.length ? 'Recolher Detalhes' : 'Salários e detalhes'}
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded hover:bg-slate-200 transition" onClick={handleSortBonds}>Ordenar períodos</button>
                            <button className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded hover:bg-slate-200 transition" onClick={handleRemoveEmpty}>Remover vazios</button>
                            <button className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 px-3 py-2 rounded hover:bg-red-100 transition" onClick={handleRemoveAll}>Remover todos</button>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <table className="w-full">
                            <thead className="bg-amber-50 dark:bg-amber-900/20">
                                <tr>
                                    <th className={`${STYLES.TABLE_HEADER} w-10`}>Nº</th>
                                    <th className={STYLES.TABLE_HEADER}>Nome / Anotações</th>
                                    <th className={STYLES.TABLE_HEADER}>Início</th>
                                    <th className={STYLES.TABLE_HEADER}>Fim</th>
                                    <th className={STYLES.TABLE_HEADER}>Atividade / Especial</th>
                                    <th className={STYLES.TABLE_HEADER}>Tempo</th>
                                    <th className={STYLES.TABLE_HEADER}>Carência</th>
                                    <th className={STYLES.TABLE_HEADER}>Opções</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                                {data.bonds.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                            Nenhum período cadastrado. Importe o CNIS ou adicione manualmente.
                                        </td>
                                    </tr>
                                ) : (
                                    data.bonds.map((bond, idx) => {
                                        const time = calculateTime(bond.startDate, bond.endDate, bond.activityType, data.gender);
                                        return (
                                            <React.Fragment key={bond.id}>
                                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <td className="px-3 py-2 text-center">
                                                        <input type="checkbox" checked={bond.useInCalculation} onChange={() => handleBondChange(bond.id, 'useInCalculation', !bond.useInCalculation)} className="rounded text-indigo-600" />
                                                        <span className="block text-[10px] text-slate-400 font-mono">{idx + 1}</span>
                                                    </td>
                                                    <td className={STYLES.TABLE_CELL}>
                                                        <input 
                                                            type="text" 
                                                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-200 p-0"
                                                            value={bond.origin}
                                                            onChange={e => handleBondChange(bond.id, 'origin', e.target.value)}
                                                        />
                                                        <div className="text-[10px] text-slate-400">{bond.type}</div>
                                                    </td>
                                                    <td className={STYLES.TABLE_CELL}>
                                                        <input 
                                                            type="date" 
                                                            className="bg-transparent border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 text-xs w-28"
                                                            value={bond.startDate}
                                                            onChange={e => handleBondChange(bond.id, 'startDate', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className={STYLES.TABLE_CELL}>
                                                        <input 
                                                            type="date" 
                                                            className="bg-transparent border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 text-xs w-28"
                                                            value={bond.endDate}
                                                            onChange={e => handleBondChange(bond.id, 'endDate', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className={STYLES.TABLE_CELL}>
                                                        <select 
                                                            className="bg-transparent border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 text-xs w-full max-w-[140px]"
                                                            value={bond.activityType}
                                                            onChange={e => handleBondChange(bond.id, 'activityType', e.target.value)}
                                                        >
                                                            <option value="common">Período Comum (1.0)</option>
                                                            <option value="special_25">Especial 25 Anos ({data.gender === 'M' ? '1.4' : '1.2'})</option>
                                                            <option value="special_20">Especial 20 Anos ({data.gender === 'M' ? '1.75' : '1.5'})</option>
                                                            <option value="special_15">Especial 15 Anos ({data.gender === 'M' ? '2.33' : '2.0'})</option>
                                                            <option value="rural">Rural</option>
                                                            <option value="teacher">Professor</option>
                                                        </select>
                                                    </td>
                                                    <td className={STYLES.TABLE_CELL}>
                                                        <div className="text-xs font-mono">
                                                            {time.years}a {time.months}m {time.days}d
                                                        </div>
                                                    </td>
                                                    <td className={STYLES.TABLE_CELL}>
                                                        <div className="text-xs text-center">{calculateBondCarencia(bond)}</div>
                                                    </td>
                                                    <td className={STYLES.TABLE_CELL}>
                                                        <div className="flex gap-1">
                                                            <button 
                                                                onClick={() => toggleBondExpansion(bond.id)}
                                                                className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 ${expandedBonds.includes(bond.id) ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
                                                                title="Ver Salários"
                                                            >
                                                                <TableCellsIcon className="h-4 w-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => setData(prev => ({ ...prev, bonds: prev.bonds.filter(b => b.id !== bond.id) }))}
                                                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500"
                                                                title="Excluir"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedBonds.includes(bond.id) && (
                                                    <tr>
                                                        <td colSpan={8} className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-700">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div>
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                                                            Salários de Contribuição ({bond.sc.length})
                                                                        </h4>
                                                                        {generateFullMonthlyHistory(bond).some(h => h.isMissing) && (
                                                                            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                                                                                ⚠️ Lacunas Identificadas
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800">
                                                                        <table className="w-full text-xs">
                                                                            <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                                                                                <tr>
                                                                                    <th className="px-2 py-1 text-left text-slate-500 dark:text-slate-400">Competência</th>
                                                                                    <th className="px-2 py-1 text-right text-slate-500 dark:text-slate-400">Valor</th>
                                                                                    <th className="px-2 py-1 text-center text-slate-500 dark:text-slate-400">Ind.</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                                                {generateFullMonthlyHistory(bond).length > 0 ? (
                                                                                    generateFullMonthlyHistory(bond).map((s, i) => (
                                                                                        <tr key={s.month} className={s.isMissing ? "bg-amber-50 dark:bg-amber-900/10" : ""}>
                                                                                            <td className="px-2 py-1 text-slate-700 dark:text-slate-300 font-mono">{s.month}</td>
                                                                                            <td className={`px-2 py-1 text-right font-mono ${s.isMissing ? "text-amber-600 italic" : "text-slate-700 dark:text-slate-300"}`}>
                                                                                                <input 
                                                                                                    type="text" 
                                                                                                    className={`w-full bg-transparent text-right border-none focus:ring-1 focus:ring-indigo-500 rounded px-1 py-0.5 ${s.isMissing ? "placeholder-amber-400" : ""}`}
                                                                                                    placeholder="Sem registro"
                                                                                                    defaultValue={s.isMissing ? "" : formatCurrency(s.value!).replace('R$', '').trim()}
                                                                                                    onBlur={(e) => handleSalaryChange(bond.id, s.month, e.target.value)}
                                                                                                />
                                                                                            </td>
                                                                                            <td className="px-2 py-1 text-center text-slate-500 dark:text-slate-400 text-[10px]">
                                                                                                {s.indicators?.join(', ')}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))
                                                                                ) : (
                                                                                    <tr>
                                                                                        <td colSpan={3} className="px-2 py-4 text-center text-slate-400 italic">
                                                                                            <p className="mb-2">Nenhum salário registrado. Carência calculada por data ({calculateBondCarencia(bond)} meses).</p>
                                                                                            <button 
                                                                                                onClick={() => {
                                                                                                    // Generate months between start and end date
                                                                                                    if (!bond.startDate || !bond.endDate) {
                                                                                                        alert("Defina as datas de Início e Fim do vínculo primeiro.");
                                                                                                        return;
                                                                                                    }
                                                                                                    
                                                                                                    // Parse dates correctly (DD/MM/YYYY)
                                                                                                    const [d1, m1, y1] = bond.startDate.split('/').map(Number);
                                                                                                    const [d2, m2, y2] = bond.endDate.split('/').map(Number);
                                                                                                    
                                                                                                    const start = new Date(y1, m1 - 1, 1); // Start of month
                                                                                                    const end = new Date(y2, m2 - 1, 1);   // Start of month
                                                                                                    
                                                                                                    const newSc = [];
                                                                                                    let current = new Date(start);
                                                                                                    
                                                                                                    while (current <= end) {
                                                                                                        const m = String(current.getMonth() + 1).padStart(2, '0');
                                                                                                        const y = current.getFullYear();
                                                                                                        newSc.push({ month: `${m}/${y}`, value: 0, indicators: [] });
                                                                                                        current.setMonth(current.getMonth() + 1);
                                                                                                    }
                                                                                                    
                                                                                                    setData(prev => ({
                                                                                                        ...prev,
                                                                                                        bonds: prev.bonds.map(b => b.id === bond.id ? { ...b, sc: newSc } : b)
                                                                                                    }));
                                                                                                }}
                                                                                                className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded hover:bg-indigo-100 transition border border-indigo-200"
                                                                                            >
                                                                                                Gerar Competências (Preencher Manualmente)
                                                                                            </button>
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Indicadores e Detalhes</h4>
                                                                    <div className="flex flex-wrap gap-2 mb-4">
                                                                        {bond.indicators.length > 0 ? (
                                                                            bond.indicators.map((ind, i) => (
                                                                                <span key={i} className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded">
                                                                                    {ind}
                                                                                </span>
                                                                            ))
                                                                        ) : (
                                                                            <span className="text-xs text-slate-400 italic">Nenhum indicador</span>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    <div className="space-y-2">
                                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                                            <input 
                                                                                type="checkbox" 
                                                                                checked={bond.isConcomitant} 
                                                                                onChange={() => handleBondChange(bond.id, 'isConcomitant', !bond.isConcomitant)}
                                                                                className="rounded text-indigo-600 focus:ring-indigo-500" 
                                                                            />
                                                                            <span className="text-xs text-slate-700 dark:text-slate-300">Marcar como concomitante (apenas informativo)</span>
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                            <tfoot className="bg-slate-900 text-white sticky bottom-0 z-10">
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-sm uppercase tracking-wider">
                                        Tempo Líquido (Unificado):
                                    </td>
                                    <td className="px-4 py-3 font-mono font-bold text-emerald-400 text-sm">
                                        {unifiedTime}
                                    </td>
                                    <td colSpan={2} className="px-4 py-3 font-mono font-bold text-emerald-400 text-sm text-right">
                                        Carência Total: {calculateUnifiedCarencia()} meses
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SocialSecurityCalc;
