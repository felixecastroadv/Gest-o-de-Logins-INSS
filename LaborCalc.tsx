import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalculatorIcon, 
  BanknotesIcon, 
  ClockIcon, 
  ExclamationTriangleIcon, 
  DocumentTextIcon, 
  ArrowPathIcon,
  TrashIcon,
  PlusIcon,
  ArchiveBoxIcon,
  PencilSquareIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { jsPDF } from "jspdf";
import { ClientRecord, ContractRecord } from './types';

// --- Tipos e Interfaces ---

export interface CalculationRecord {
    id: string;
    date: string;
    employeeName: string;
    totalValue: number;
    data: LaborData;
}

interface LaborData {
  // Dados Contratuais
  employeeName: string;
  startDate: string;
  endDate: string;
  baseSalary: number;
  terminationReason: 'sem_justa_causa' | 'pedido_demissao' | 'justa_causa' | 'rescisao_indireta';
  noticePeriod: 'trabalhado' | 'indenizado' | 'dispensado';
  hasFgtsBalance: number; // Saldo já depositado para cálculo da multa

  // Adicionais
  insalubridadeLevel: 'nenhum' | 'minimo' | 'medio' | 'maximo'; // 10, 20, 40%
  periculosidade: boolean; // 30%
  adicionalNoturno: {
    active: boolean;
    periods: {
      id: string;
      hoursPerMonth: number;
      startDate: string;
      endDate: string;
    }[];
  };

  // Diferenças Salariais
  wageGap: {
    active: boolean;
    floorSalary: number; // Piso da categoria
    paidSalary: number; // Quanto realmente recebia
    startDate: string;
    endDate: string;
  }[];

  // Adicionais e Horas Extras (Lote)
  overtime: {
    id: string;
    percentage: number; // 50, 60, 100 ou custom
    customPercentage?: number;
    hoursPerMonth: number;
    startDate: string;
    endDate: string;
    applyDsr: boolean;
  }[];

  // Estabilidade / Indenizações
  stability: {
    isPregnant: boolean;
    childBirthDate: string; // Para calcular 5 meses após parto
    endDate: string; // Ou data fim manual
  };
  
  // Multas e Outros
  applyFine477: boolean; // Atraso pagamento
  applyFine467: boolean; // Verbas incontroversas
  moralDamages: number;
  unpaidFgtsMonths: number; // Quantos meses não foi depositado
  unpaid13thMonths: number; // Meses de 13o não pagos
  vacationExpiredQty: number; // Quantas férias vencidas inteiras
}

const INITIAL_LABOR_DATA: LaborData = {
  employeeName: '',
  startDate: '',
  endDate: '',
  baseSalary: 0,
  terminationReason: 'sem_justa_causa',
  noticePeriod: 'indenizado',
  hasFgtsBalance: 0,
  insalubridadeLevel: 'nenhum',
  periculosidade: false,
  adicionalNoturno: { active: false, periods: [] },
  wageGap: [],
  overtime: [],
  stability: { isPregnant: false, childBirthDate: '', endDate: '' },
  applyFine477: false,
  applyFine467: false,
  moralDamages: 0,
  unpaidFgtsMonths: 0,
  unpaid13thMonths: 0,
  vacationExpiredQty: 0
};

// --- Helpers de Cálculo ---

const parseDate = (dateStr: string) => {
  if (!dateStr) return null;
  return new Date(dateStr);
};

const diffMonths = (d1: Date, d2: Date) => {
  let months;
  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
};

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

interface LaborCalcProps {
    clients?: ClientRecord[];
    contracts?: ContractRecord[];
    savedCalculations?: CalculationRecord[];
    onSaveCalculation?: (calc: CalculationRecord) => void;
    onDeleteCalculation?: (id: string) => void;
}

export default function LaborCalc({ clients = [], contracts = [], savedCalculations = [], onSaveCalculation, onDeleteCalculation }: LaborCalcProps) {
  const [data, setData] = useState<LaborData>(INITIAL_LABOR_DATA);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [calcResult, setCalcResult] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [showSavedList, setShowSavedList] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- Handlers ---
  const handleInputChange = (field: keyof LaborData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedName = e.target.value;
      if (!selectedName) return;

      // Tenta achar em clientes ou contratos
      const client = clients.find(c => c.name === selectedName);
      const contract = contracts.find(c => `${c.firstName} ${c.lastName}` === selectedName);

      if (client) {
          setData(prev => ({ ...prev, employeeName: client.name }));
      } else if (contract) {
          setData(prev => ({ ...prev, employeeName: `${contract.firstName} ${contract.lastName}` }));
      }
  };

  const addOvertimeBatch = () => {
    setData(prev => ({
      ...prev,
      overtime: [...prev.overtime, {
        id: Math.random().toString(),
        percentage: 50,
        hoursPerMonth: 0,
        startDate: prev.startDate,
        endDate: prev.endDate,
        applyDsr: true
      }]
    }));
  };

  const removeOvertimeBatch = (id: string) => {
    setData(prev => ({ ...prev, overtime: prev.overtime.filter(o => o.id !== id) }));
  };

  const addWageGap = () => {
      setData(prev => ({
          ...prev,
          wageGap: [...prev.wageGap, {
              active: true,
              floorSalary: 0,
              paidSalary: prev.baseSalary,
              startDate: prev.startDate,
              endDate: prev.endDate
          }]
      }));
  };

  const removeWageGap = (idx: number) => {
      const newGaps = [...data.wageGap];
      newGaps.splice(idx, 1);
      setData(prev => ({ ...prev, wageGap: newGaps }));
  };

  const addNightShiftPeriod = () => {
    setData(prev => ({
      ...prev,
      adicionalNoturno: {
        ...prev.adicionalNoturno,
        periods: [
          ...prev.adicionalNoturno.periods,
          {
            id: Math.random().toString(),
            hoursPerMonth: 0,
            startDate: prev.startDate,
            endDate: prev.endDate
          }
        ]
      }
    }));
  };

  const removeNightShiftPeriod = (id: string) => {
    setData(prev => ({
      ...prev,
      adicionalNoturno: {
        ...prev.adicionalNoturno,
        periods: prev.adicionalNoturno.periods.filter(p => p.id !== id)
      }
    }));
  };

  const handleSave = () => {
      if (!data.employeeName) {
          alert("Informe o nome do cliente para salvar.");
          return;
      }
      if (onSaveCalculation) {
          const record: CalculationRecord = {
              id: editingId || Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              employeeName: data.employeeName,
              totalValue: totalValue,
              data: data
          };
          onSaveCalculation(record);
          setEditingId(null);
          alert("Cálculo salvo com sucesso!");
      }
  };

  const loadCalculation = (calc: CalculationRecord) => {
      setData(calc.data);
      setEditingId(calc.id);
      setShowSavedList(false);
      calculate(calc.data); // Recalcula para mostrar resultados
  };

  // --- ENGINE DE CÁLCULO ---
  const calculate = (calcData = data) => {
    const results = [];
    let total = 0;

    const start = parseDate(calcData.startDate);
    const end = parseDate(calcData.endDate);
    const salary = Number(calcData.baseSalary);

    if (!salary) {
        // alert("Por favor, insira ao menos o Salário Base para estimativa.");
        // Não alertar se for chamado internamente
    }

    // 1. Saldo de Salário
    if (end && salary) {
        const daysWorked = end.getDate();
        const balance = (salary / 30) * daysWorked;
        results.push({ desc: `Saldo de Salário (${daysWorked} dias)`, value: balance, category: 'Rescisórias' });
    }

    // 2. Aviso Prévio
    if (start && end && salary && calcData.noticePeriod === 'indenizado' && calcData.terminationReason !== 'justa_causa' && calcData.terminationReason !== 'pedido_demissao') {
        const years = Math.floor(diffMonths(start, end) / 12);
        const extraDays = Math.min(years * 3, 60); // Lei 12.506
        const totalDays = 30 + extraDays;
        const noticeValue = (salary / 30) * totalDays;
        results.push({ desc: `Aviso Prévio Indenizado (${totalDays} dias)`, value: noticeValue, category: 'Rescisórias' });
    }

    // 3. 13º Salário Proporcional
    if (end && salary) {
        const monthsWorkedYear = end.getMonth() + 1; // Simplificado
        // Se trabalhou mais que 15 dias no mês conta como mês cheio
        const effectiveMonths = end.getDate() > 14 ? monthsWorkedYear : monthsWorkedYear - 1;
        const thirteenth = (salary / 12) * effectiveMonths;
        results.push({ desc: `13º Salário Proporcional (${effectiveMonths}/12)`, value: thirteenth, category: 'Rescisórias' });
        
        // 13º Vencidos (Input manual de meses não pagos)
        if (calcData.unpaid13thMonths > 0) {
            const unpaid13th = (salary / 12) * calcData.unpaid13thMonths;
            results.push({ desc: `13º Salário Vencidos (${calcData.unpaid13thMonths} meses)`, value: unpaid13th, category: 'Rescisórias' });
        }
    }

    // 4. Férias
    if (salary) {
        // Vencidas
        if (calcData.vacationExpiredQty > 0) {
            const vacValue = (salary + (salary / 3)) * calcData.vacationExpiredQty;
            results.push({ desc: `Férias Vencidas + 1/3 (${calcData.vacationExpiredQty} períodos)`, value: vacValue, category: 'Rescisórias' });
        }
        
        // Proporcionais
        if (end) {
            const monthsWorkedYear = end.getMonth() + 1; // Simplificado considerando ano corrente
            const effectiveMonths = end.getDate() > 14 ? monthsWorkedYear : monthsWorkedYear - 1;
            const vacProp = (salary / 12) * effectiveMonths;
            const vacPropTotal = vacProp + (vacProp / 3);
            results.push({ desc: `Férias Proporcionais + 1/3 (${effectiveMonths}/12)`, value: vacPropTotal, category: 'Rescisórias' });
        }
    }

    // 5. Adicionais (Insalubridade, Periculosidade, Noturno)
    if (start && end) {
        const monthsWorked = diffMonths(start, end);
        const minimumWage = 1412; // Salário Mínimo 2024 (Base Insalubridade)
        
        // Insalubridade (Base Salário Mínimo)
        if (calcData.insalubridadeLevel !== 'nenhum') {
            let perc = 0;
            if (calcData.insalubridadeLevel === 'minimo') perc = 0.10;
            if (calcData.insalubridadeLevel === 'medio') perc = 0.20;
            if (calcData.insalubridadeLevel === 'maximo') perc = 0.40;
            
            const monthlyVal = minimumWage * perc;
            const totalInsalub = monthlyVal * monthsWorked;
            results.push({ desc: `Adicional Insalubridade (${perc * 100}% s/ Mínimo - ${monthsWorked} meses)`, value: totalInsalub, category: 'Adicionais' });
            
            // Reflexos
            results.push({ desc: `Reflexos Insalubridade (Férias, 13º, FGTS)`, value: totalInsalub * 0.3, category: 'Reflexos' });
        }

        // Periculosidade (Base Salário Base)
        if (calcData.periculosidade && salary) {
            const monthlyVal = salary * 0.30;
            const totalPeric = monthlyVal * monthsWorked;
            results.push({ desc: `Adicional Periculosidade (30% - ${monthsWorked} meses)`, value: totalPeric, category: 'Adicionais' });
            
            // Reflexos
            results.push({ desc: `Reflexos Periculosidade (Férias, 13º, FGTS)`, value: totalPeric * 0.3, category: 'Reflexos' });
        }

        // Adicional Noturno
        if (calcData.adicionalNoturno.active && salary) {
            const hourlyRate = salary / 220;
            const nightRate = hourlyRate * 0.20; // 20% Urbano
            
            calcData.adicionalNoturno.periods.forEach((period, idx) => {
                const pStart = parseDate(period.startDate) || start;
                const pEnd = parseDate(period.endDate) || end;
                
                if (pStart && pEnd && period.hoursPerMonth > 0) {
                    const months = diffMonths(pStart, pEnd);
                    const monthlyVal = nightRate * period.hoursPerMonth;
                    const totalNight = monthlyVal * months;
                    
                    results.push({ desc: `Adicional Noturno (${period.hoursPerMonth}h/mês - ${months} meses - Período ${idx + 1})`, value: totalNight, category: 'Adicionais' });
                    results.push({ desc: `Reflexos Ad. Noturno (Férias, 13º, FGTS, DSR) - Período ${idx + 1}`, value: totalNight * 0.35, category: 'Reflexos' });
                }
            });
        }
    }

    // 6. Diferença Salarial
    calcData.wageGap.forEach((gap, idx) => {
        const gapStart = parseDate(gap.startDate) || start;
        const gapEnd = parseDate(gap.endDate) || end;
        
        if (gapStart && gapEnd && gap.floorSalary > gap.paidSalary) {
            const months = diffMonths(gapStart, gapEnd);
            const diffValue = (gap.floorSalary - gap.paidSalary) * months;
            results.push({ desc: `Diferença Salarial (Período ${idx + 1}: ${months} meses)`, value: diffValue, category: 'Salários' });
            
            // Reflexos básicos (Férias + 13 + FGTS) estimativa rápida
            const reflex = diffValue * 0.3; // ~30% de reflexos
            results.push({ desc: `Reflexos s/ Diferença Salarial (Est. 30%)`, value: reflex, category: 'Reflexos' });
        }
    });

    // 7. Horas Extras (Lote)
    calcData.overtime.forEach((ot, idx) => {
        const otStart = parseDate(ot.startDate) || start;
        const otEnd = parseDate(ot.endDate) || end;
        
        if (otStart && otEnd && ot.hoursPerMonth > 0) {
            const months = diffMonths(otStart, otEnd);
            const perc = ot.percentage === -1 ? (ot.customPercentage || 50) : ot.percentage;
            
            // Valor da hora
            const hourlyRate = salary / 220; // Divisor padrão, poderia ser customizável
            const otRate = hourlyRate * (1 + (perc / 100));
            const totalOt = otRate * ot.hoursPerMonth * months;
            
            results.push({ desc: `Horas Extras ${perc}% (${ot.hoursPerMonth}h/mês x ${months} meses)`, value: totalOt, category: 'Horas Extras' });
            
            if (ot.applyDsr) {
                const dsr = totalOt * 0.1666; // Est. média de DSR
                results.push({ desc: `DSR sobre H.E. (Lote ${idx+1})`, value: dsr, category: 'Horas Extras' });
            }
        }
    });

    // 8. Estabilidade Gestante
    if (calcData.stability.isPregnant && salary) {
        let stabEnd = parseDate(calcData.stability.endDate);
        const stabStart = end || new Date();
        
        // Se não tem data fim, calcula parto + 5 meses
        if (!stabEnd && calcData.stability.childBirthDate) {
            const birth = parseDate(calcData.stability.childBirthDate);
            if (birth) {
                stabEnd = new Date(birth);
                stabEnd.setMonth(stabEnd.getMonth() + 5);
            }
        }

        if (stabEnd && stabEnd > stabStart) {
            const monthsStab = diffMonths(stabStart, stabEnd);
            const stabValue = salary * monthsStab;
            results.push({ desc: `Indenização Estabilidade Gestante (${monthsStab} meses)`, value: stabValue, category: 'Indenizações' });
        }
    }

    // 9. FGTS + 40%
    // Sobre salários não pagos
    if (calcData.unpaidFgtsMonths > 0 && salary) {
        const unpaidFgts = (salary * 0.08) * calcData.unpaidFgtsMonths;
        results.push({ desc: `FGTS Não Depositado (${calcData.unpaidFgtsMonths} meses)`, value: unpaidFgts, category: 'FGTS' });
    }
    
    // Multa 40% (Sobre saldo existente + o que foi gerado na rescisão estimada)
    let totalFgtsBase = Number(calcData.hasFgtsBalance) || 0;
    // Adiciona o FGTS da rescisão (Aviso + 13o) aprox
    // Simplificação: Soma dos valores salariais calculados * 8%
    const rescisaoFgtsBase = results
        .filter(r => ['Rescisórias', 'Salários', 'Horas Extras', 'Adicionais'].includes(r.category))
        .reduce((sum, item) => sum + item.value, 0);
    
    totalFgtsBase += (rescisaoFgtsBase * 0.08);

    if (calcData.terminationReason === 'sem_justa_causa' || calcData.terminationReason === 'rescisao_indireta') {
        const fine40 = totalFgtsBase * 0.4;
        results.push({ desc: `Multa 40% do FGTS (Estimada)`, value: fine40, category: 'FGTS' });
    }

    // 10. Multas CLT
    if (calcData.applyFine477 && salary) {
        results.push({ desc: `Multa Art. 477 (Atraso)`, value: salary, category: 'Multas' });
    }
    
    // Calcula subtotal para a multa do 467 (50% sobre verbas rescisórias incontroversas)
    if (calcData.applyFine467) {
        const incontroverso = results
            .filter(r => r.category === 'Rescisórias')
            .reduce((sum, item) => sum + item.value, 0);
        results.push({ desc: `Multa Art. 467 (50% Incontroverso)`, value: incontroverso * 0.5, category: 'Multas' });
    }

    // 11. Danos Morais
    if (calcData.moralDamages > 0) {
        results.push({ desc: `Indenização por Danos Morais`, value: Number(calcData.moralDamages), category: 'Indenizações' });
    }

    // Finalizar
    setCalcResult(results);
    setTotalValue(results.reduce((acc, curr) => acc + curr.value, 0));
    setActiveTab(5); // Ir para resultados
  };

  const generatePDF = () => {
      // @ts-ignore
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      
      // Header
      doc.setFillColor(30, 58, 138); // Primary Blue
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("RELATÓRIO DE CÁLCULO TRABALHISTA", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(10);
      doc.text("Estimativa Preliminar", pageWidth / 2, 28, { align: "center" });

      // Info Cliente
      let y = 55;
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DADOS DO PROCESSO / CLIENTE", margin, y);
      doc.setLineWidth(0.5);
      doc.line(margin, y+2, pageWidth - margin, y+2);
      
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Cliente: ${data.employeeName || 'Não informado'}`, margin, y);
      doc.text(`Data Base: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, y, { align: "right" });
      y += 6;
      doc.text(`Admissão: ${data.startDate ? new Date(data.startDate).toLocaleDateString('pt-BR') : '-'}`, margin, y);
      doc.text(`Demissão: ${data.endDate ? new Date(data.endDate).toLocaleDateString('pt-BR') : '-'}`, pageWidth - margin, y, { align: "right" });
      y += 6;
      doc.text(`Salário Base: ${formatCurrency(data.baseSalary)}`, margin, y);
      doc.text(`Motivo: ${data.terminationReason.replace(/_/g, ' ').toUpperCase()}`, pageWidth - margin, y, { align: "right" });

      // Tabela de Verbas
      y += 15;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DETALHAMENTO DAS VERBAS", margin, y);
      doc.line(margin, y+2, pageWidth - margin, y+2);
      y += 10;

      // Header Tabela
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y - 6, pageWidth - (margin*2), 8, 'F');
      doc.setFontSize(10);
      doc.text("DESCRIÇÃO", margin + 2, y);
      doc.text("VALOR (R$)", pageWidth - margin - 2, y, { align: "right" });
      y += 10;

      doc.setFont("helvetica", "normal");
      let currentCategory = '';

      calcResult.forEach((item) => {
          if (y > pageHeight - 40) { doc.addPage(); y = 30; }

          if (item.category !== currentCategory) {
              y += 4;
              doc.setFont("helvetica", "bold");
              doc.setTextColor(30, 58, 138);
              doc.text(item.category.toUpperCase(), margin, y);
              doc.line(margin, y+1, pageWidth-margin, y+1);
              y += 6;
              currentCategory = item.category;
              doc.setTextColor(0);
              doc.setFont("helvetica", "normal");
          }

          doc.text(item.desc, margin + 2, y);
          doc.text(formatCurrency(item.value), pageWidth - margin - 2, y, { align: "right" });
          y += 6;
      });

      // Total
      y += 5;
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
      
      doc.setFillColor(30, 58, 138);
      doc.rect(margin, y - 8, pageWidth - (margin*2), 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("TOTAL ESTIMADO:", margin + 4, y);
      doc.text(formatCurrency(totalValue), pageWidth - margin - 4, y, { align: "right" });

      // Explicação Metodológica (Justificado)
      y += 20;
      if (y > pageHeight - 60) { doc.addPage(); y = 30; }

      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.text("METODOLOGIA DE CÁLCULO", margin, y);
      doc.line(margin, y+2, pageWidth - margin, y+2);
      y += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const text = "O presente cálculo é uma estimativa preliminar realizada com base nas informações fornecidas pelo cliente e nos parâmetros da CLT. As verbas rescisórias consideram o saldo de salário, aviso prévio (indenizado ou trabalhado), férias vencidas e proporcionais acrescidas de 1/3, e 13º salário proporcional. Adicionais como insalubridade e periculosidade foram calculados sobre o salário mínimo e salário base, respectivamente, conforme legislação vigente. A multa de 40% do FGTS é estimada sobre o saldo informado somado aos depósitos mensais devidos no período. Este documento não possui valor de sentença judicial e está sujeito a alterações mediante análise de provas documentais e convenções coletivas da categoria.";
      
      const splitText = doc.splitTextToSize(text, pageWidth - (margin * 2));
      doc.text(splitText, margin, y, { align: "justify", maxWidth: pageWidth - (margin * 2) });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Gerado por Gestão INSS Jurídico em ${new Date().toLocaleDateString()} - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
      }

      doc.save(`Relatorio_Calculo_${data.employeeName || 'Trabalhista'}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header da Calculadora */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center shadow-sm z-10">
         <div className="flex items-center gap-3">
             <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                 <CalculatorIcon className="h-6 w-6" />
             </div>
             <div>
                 <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">Calculadora Trabalhista</h2>
                 <p className="text-xs text-slate-500 dark:text-slate-400">Estimativas Rescisórias & Indenizatórias</p>
             </div>
         </div>
         <div className="flex gap-2">
            <button onClick={() => setShowSavedList(!showSavedList)} className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700">
                <ArchiveBoxIcon className="h-4 w-4" /> {showSavedList ? 'Ocultar Salvos' : 'Ver Salvos'}
            </button>
            <button onClick={() => { setData(INITIAL_LABOR_DATA); setEditingId(null); setCalcResult([]); setTotalValue(0); setActiveTab(1); }} className="text-xs font-bold text-slate-500 hover:text-red-500 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                <TrashIcon className="h-4 w-4" /> Limpar
            </button>
            {totalValue > 0 && (
                <button onClick={generatePDF} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg shadow-indigo-500/30 flex items-center gap-2 transition">
                    <DocumentTextIcon className="h-4 w-4" />
                    Baixar PDF
                </button>
            )}
         </div>
      </div>

      {/* Saved List Overlay */}
      {showSavedList && (
          <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 animate-in slide-in-from-top-4">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3">Cálculos Salvos</h3>
              {savedCalculations.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Nenhum cálculo salvo.</p>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {savedCalculations.map(calc => (
                          <div key={calc.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm">
                              <div>
                                  <p className="font-bold text-slate-800 dark:text-white text-sm">{calc.employeeName}</p>
                                  <p className="text-xs text-slate-500">{new Date(calc.date).toLocaleDateString()} - {formatCurrency(calc.totalValue)}</p>
                              </div>
                              <div className="flex gap-1">
                                  <button onClick={() => loadCalculation(calc)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Carregar"><PencilSquareIcon className="h-4 w-4" /></button>
                                  <button onClick={() => onDeleteCalculation && onDeleteCalculation(calc.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Excluir"><TrashIcon className="h-4 w-4" /></button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 gap-1 shrink-0">
         {['Dados Contratuais', 'Verbas & Lote', 'Indenizações', 'Estabilidade', 'Resultados'].map((label, idx) => (
             <button
                key={idx}
                onClick={() => setActiveTab(idx + 1)}
                className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === idx + 1 
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
             >
                 {idx + 1}. {label}
             </button>
         ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-5xl mx-auto space-y-6 pb-20">
              
              {/* TAB 1: DADOS BASE */}
              {activeTab === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="md:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                          <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                              <DocumentTextIcon className="h-5 w-5 text-indigo-500" /> Informações Básicas
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="md:col-span-2">
                                  <label className="label-text">Nome do Cliente / Reclamante</label>
                                  <div className="flex gap-2">
                                      <input type="text" className="input-field" value={data.employeeName} onChange={e => handleInputChange('employeeName', e.target.value)} placeholder="Ex: João da Silva" />
                                      <select className="input-field w-1/3" onChange={handleClientSelect} defaultValue="">
                                          <option value="" disabled>Selecionar...</option>
                                          {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                          {contracts.map(c => <option key={c.id} value={`${c.firstName} ${c.lastName}`}>{c.firstName} {c.lastName}</option>)}
                                      </select>
                                  </div>
                              </div>
                              <div>
                                  <label className="label-text">Data Admissão</label>
                                  <input type="date" className="input-field" value={data.startDate} onChange={e => handleInputChange('startDate', e.target.value)} />
                              </div>
                              <div>
                                  <label className="label-text">Data Demissão / Ajuizamento</label>
                                  <input type="date" className="input-field" value={data.endDate} onChange={e => handleInputChange('endDate', e.target.value)} />
                              </div>
                              <div>
                                  <label className="label-text">Último Salário Base (R$)</label>
                                  <input type="number" className="input-field" value={data.baseSalary} onChange={e => handleInputChange('baseSalary', e.target.value)} placeholder="0.00" />
                              </div>
                              <div>
                                  <label className="label-text">Motivo da Rescisão</label>
                                  <select className="input-field" value={data.terminationReason} onChange={e => handleInputChange('terminationReason', e.target.value)}>
                                      <option value="sem_justa_causa">Dispensa Sem Justa Causa</option>
                                      <option value="rescisao_indireta">Rescisão Indireta</option>
                                      <option value="pedido_demissao">Pedido de Demissão</option>
                                      <option value="justa_causa">Justa Causa</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="label-text">Aviso Prévio</label>
                                  <select className="input-field" value={data.noticePeriod} onChange={e => handleInputChange('noticePeriod', e.target.value)}>
                                      <option value="indenizado">Indenizado (Pago)</option>
                                      <option value="trabalhado">Trabalhado</option>
                                      <option value="dispensado">Dispensado</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="label-text">Saldo FGTS (Para Multa 40%)</label>
                                  <input type="number" className="input-field" value={data.hasFgtsBalance} onChange={e => handleInputChange('hasFgtsBalance', e.target.value)} placeholder="Saldo em conta..." />
                              </div>
                          </div>
                      </div>
                      
                      <div className="md:col-span-2 flex justify-end">
                          <button onClick={() => setActiveTab(2)} className="btn-primary">
                              Próxima Etapa <ArrowPathIcon className="h-4 w-4" />
                          </button>
                      </div>
                  </div>
              )}

              {/* TAB 2: VERBAS E LOTE */}
              {activeTab === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      
                      {/* Seção Adicionais Fixos */}
                      <div className="card-section">
                          <h3 className="card-title text-indigo-600 dark:text-indigo-400">
                              <PlusIcon className="h-5 w-5" /> Adicionais Recorrentes
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                  <label className="label-text mb-2">Insalubridade</label>
                                  <select 
                                      className="input-field" 
                                      value={data.insalubridadeLevel} 
                                      onChange={e => handleInputChange('insalubridadeLevel', e.target.value)}
                                  >
                                      <option value="nenhum">Não se aplica</option>
                                      <option value="minimo">Grau Mínimo (10%)</option>
                                      <option value="medio">Grau Médio (20%)</option>
                                      <option value="maximo">Grau Máximo (40%)</option>
                                  </select>
                                  <p className="text-[10px] text-slate-400 mt-1">Base: Salário Mínimo</p>
                              </div>

                              <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-center">
                                  <label className="flex items-center gap-3 cursor-pointer">
                                      <input 
                                          type="checkbox" 
                                          checked={data.periculosidade} 
                                          onChange={e => handleInputChange('periculosidade', e.target.checked)} 
                                          className="w-5 h-5 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" 
                                      />
                                      <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                          Periculosidade (30%)
                                      </span>
                                  </label>
                                  <p className="text-[10px] text-slate-400 mt-1 pl-8">Base: Salário Base</p>
                              </div>

                              <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 col-span-1 md:col-span-3">
                                  <div className="flex justify-between items-center mb-2">
                                      <label className="flex items-center gap-3 cursor-pointer">
                                          <input 
                                              type="checkbox" 
                                              checked={data.adicionalNoturno.active} 
                                              onChange={e => setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, active: e.target.checked } }))} 
                                              className="w-5 h-5 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" 
                                          />
                                          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                              Adicional Noturno (20%)
                                          </span>
                                      </label>
                                      {data.adicionalNoturno.active && (
                                          <button onClick={addNightShiftPeriod} className="btn-secondary-sm text-[10px] py-1 px-2">
                                              <PlusIcon className="h-3 w-3" /> Add Período
                                          </button>
                                      )}
                                  </div>
                                  
                                  {data.adicionalNoturno.active && (
                                      <div className="space-y-2 mt-2">
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                                              Considera-se noturno o trabalho entre <strong>22h e 5h</strong> (urbano). A hora noturna é reduzida (52min 30s).
                                          </p>
                                          {data.adicionalNoturno.periods.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum período adicionado.</p>}
                                          {data.adicionalNoturno.periods.map((period, idx) => (
                                              <div key={period.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 relative">
                                                  <button onClick={() => removeNightShiftPeriod(period.id)} className="absolute top-1 right-1 text-slate-400 hover:text-red-500"><TrashIcon className="h-3 w-3" /></button>
                                                  <div>
                                                      <label className="label-tiny">Horas/Mês (Média)</label>
                                                      <input 
                                                          type="number" 
                                                          className="input-tiny"
                                                          value={period.hoursPerMonth}
                                                          onChange={e => {
                                                              const newPeriods = [...data.adicionalNoturno.periods];
                                                              newPeriods[idx].hoursPerMonth = Number(e.target.value);
                                                              setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className="label-tiny">Início</label>
                                                      <input 
                                                          type="date" 
                                                          className="input-tiny"
                                                          value={period.startDate}
                                                          onChange={e => {
                                                              const newPeriods = [...data.adicionalNoturno.periods];
                                                              newPeriods[idx].startDate = e.target.value;
                                                              setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className="label-tiny">Fim</label>
                                                      <input 
                                                          type="date" 
                                                          className="input-tiny"
                                                          value={period.endDate}
                                                          onChange={e => {
                                                              const newPeriods = [...data.adicionalNoturno.periods];
                                                              newPeriods[idx].endDate = e.target.value;
                                                              setData(prev => ({ ...prev, adicionalNoturno: { ...prev.adicionalNoturno, periods: newPeriods } }));
                                                          }}
                                                      />
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>

                      {/* Seção Diferença Salarial */}
                      <div className="card-section">
                          <div className="flex justify-between items-center mb-4">
                              <h3 className="card-title text-green-600 dark:text-green-400">
                                  <BanknotesIcon className="h-5 w-5" /> Diferença Salarial (Piso)
                              </h3>
                              <button onClick={addWageGap} className="btn-secondary-sm"><PlusIcon className="h-3 w-3" /> Adicionar Período</button>
                          </div>
                          {data.wageGap.length === 0 && <p className="empty-msg">Nenhum período de diferença salarial cadastrado.</p>}
                          {data.wageGap.map((gap, idx) => (
                              <div key={idx} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-3 relative group">
                                  <button onClick={() => removeWageGap(idx)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div>
                                          <label className="label-tiny">Início</label>
                                          <input type="date" className="input-tiny" value={gap.startDate} onChange={(e) => {
                                              const newGaps = [...data.wageGap]; newGaps[idx].startDate = e.target.value; setData({...data, wageGap: newGaps});
                                          }} />
                                      </div>
                                      <div>
                                          <label className="label-tiny">Fim</label>
                                          <input type="date" className="input-tiny" value={gap.endDate} onChange={(e) => {
                                              const newGaps = [...data.wageGap]; newGaps[idx].endDate = e.target.value; setData({...data, wageGap: newGaps});
                                          }} />
                                      </div>
                                      <div>
                                          <label className="label-tiny">Salário Piso (Deveria ser)</label>
                                          <input type="number" className="input-tiny font-bold text-green-600" value={gap.floorSalary} onChange={(e) => {
                                              const newGaps = [...data.wageGap]; newGaps[idx].floorSalary = Number(e.target.value); setData({...data, wageGap: newGaps});
                                          }} />
                                      </div>
                                      <div>
                                          <label className="label-tiny">Salário Pago (Real)</label>
                                          <input type="number" className="input-tiny" value={gap.paidSalary} onChange={(e) => {
                                              const newGaps = [...data.wageGap]; newGaps[idx].paidSalary = Number(e.target.value); setData({...data, wageGap: newGaps});
                                          }} />
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>

                      {/* Seção Horas Extras */}
                      <div className="card-section">
                          <div className="flex justify-between items-center mb-4">
                              <h3 className="card-title text-orange-600 dark:text-orange-400">
                                  <ClockIcon className="h-5 w-5" /> Horas Extras em Lote
                              </h3>
                              <button onClick={addOvertimeBatch} className="btn-secondary-sm"><PlusIcon className="h-3 w-3" /> Adicionar Lote</button>
                          </div>
                          
                          {data.overtime.length === 0 && <p className="empty-msg">Nenhum lote de horas extras cadastrado.</p>}
                          
                          {data.overtime.map((ot, idx) => (
                              <div key={ot.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-3 relative">
                                  <button onClick={() => removeOvertimeBatch(ot.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                                      <div className="col-span-1">
                                          <label className="label-tiny">Adicional (%)</label>
                                          <select 
                                            className="input-tiny" 
                                            value={ot.percentage} 
                                            onChange={(e) => {
                                                const newOt = [...data.overtime];
                                                newOt[idx].percentage = Number(e.target.value);
                                                setData({...data, overtime: newOt});
                                            }}
                                          >
                                              <option value={50}>50%</option>
                                              <option value={60}>60%</option>
                                              <option value={100}>100%</option>
                                              <option value={-1}>Outro...</option>
                                          </select>
                                          {ot.percentage === -1 && (
                                              <input 
                                                type="number" 
                                                className="input-tiny mt-1" 
                                                placeholder="%" 
                                                value={ot.customPercentage || ''}
                                                onChange={(e) => {
                                                    const newOt = [...data.overtime];
                                                    newOt[idx].customPercentage = Number(e.target.value);
                                                    setData({...data, overtime: newOt});
                                                }}
                                              />
                                          )}
                                      </div>
                                      <div>
                                          <label className="label-tiny">Horas/Mês (Média)</label>
                                          <input type="number" className="input-tiny" value={ot.hoursPerMonth} onChange={(e) => {
                                              const newOt = [...data.overtime]; newOt[idx].hoursPerMonth = Number(e.target.value); setData({...data, overtime: newOt});
                                          }} />
                                      </div>
                                      <div>
                                          <label className="label-tiny">De</label>
                                          <input type="date" className="input-tiny" value={ot.startDate} onChange={(e) => {
                                              const newOt = [...data.overtime]; newOt[idx].startDate = e.target.value; setData({...data, overtime: newOt});
                                          }} />
                                      </div>
                                      <div>
                                          <label className="label-tiny">Até</label>
                                          <input type="date" className="input-tiny" value={ot.endDate} onChange={(e) => {
                                              const newOt = [...data.overtime]; newOt[idx].endDate = e.target.value; setData({...data, overtime: newOt});
                                          }} />
                                      </div>
                                      <div className="flex items-center h-10">
                                           <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 select-none">
                                               <input type="checkbox" checked={ot.applyDsr} onChange={(e) => {
                                                   const newOt = [...data.overtime]; newOt[idx].applyDsr = e.target.checked; setData({...data, overtime: newOt});
                                               }} className="w-4 h-4 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" />
                                               Reflexo DSR
                                           </label>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="md:col-span-2 flex justify-between">
                          <button onClick={() => setActiveTab(1)} className="btn-secondary">Voltar</button>
                          <button onClick={() => setActiveTab(3)} className="btn-primary">Próxima Etapa <ArrowPathIcon className="h-4 w-4" /></button>
                      </div>
                  </div>
              )}

              {/* TAB 3: INDENIZAÇÕES E MULTAS */}
              {activeTab === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <div className="card-section">
                           <h3 className="card-title text-red-600 dark:text-red-400">
                               <ExclamationTriangleIcon className="h-5 w-5" /> Multas e Verbas Vencidas
                           </h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                               <div className="space-y-3">
                                   <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                                       <input type="checkbox" checked={data.applyFine477} onChange={e => handleInputChange('applyFine477', e.target.checked)} className="w-5 h-5 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" />
                                       <span className="text-sm font-semibold dark:text-slate-200">Multa Art. 477 (Atraso Pagamento)</span>
                                   </label>
                                   <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                                       <input type="checkbox" checked={data.applyFine467} onChange={e => handleInputChange('applyFine467', e.target.checked)} className="w-5 h-5 text-indigo-600 bg-slate-50 dark:bg-slate-700 border-slate-400 dark:border-slate-500 rounded focus:ring-indigo-500" />
                                       <span className="text-sm font-semibold dark:text-slate-200">Multa Art. 467 (Verbas Incontroversas)</span>
                                   </label>
                               </div>
                               <div className="space-y-4">
                                   <div>
                                       <label className="label-text">Férias Vencidas (Qtd. Períodos Inteiros)</label>
                                       <input type="number" className="input-field" value={data.vacationExpiredQty} onChange={e => handleInputChange('vacationExpiredQty', Number(e.target.value))} />
                                   </div>
                                   <div>
                                       <label className="label-text">Meses de FGTS não depositado</label>
                                       <input type="number" className="input-field" value={data.unpaidFgtsMonths} onChange={e => handleInputChange('unpaidFgtsMonths', Number(e.target.value))} />
                                   </div>
                                   <div>
                                       <label className="label-text">Meses de 13º Salário Vencidos</label>
                                       <input type="number" className="input-field" value={data.unpaid13thMonths} onChange={e => handleInputChange('unpaid13thMonths', Number(e.target.value))} />
                                   </div>
                                   <div>
                                       <label className="label-text">Indenização por Danos Morais (Estimativa R$)</label>
                                       <input type="number" className="input-field" value={data.moralDamages} onChange={e => handleInputChange('moralDamages', Number(e.target.value))} placeholder="0.00" />
                                   </div>
                               </div>
                           </div>
                       </div>

                       <div className="md:col-span-2 flex justify-between">
                          <button onClick={() => setActiveTab(2)} className="btn-secondary">Voltar</button>
                          <button onClick={() => setActiveTab(4)} className="btn-primary">Próxima Etapa <ArrowPathIcon className="h-4 w-4" /></button>
                      </div>
                  </div>
              )}

              {/* TAB 4: ESTABILIDADE GESTANTE */}
              {activeTab === 4 && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="card-section bg-pink-50 dark:bg-pink-900/10 border-pink-100 dark:border-pink-900/30">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-pink-100 dark:bg-pink-900/40 rounded-full text-pink-600 dark:text-pink-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                    </svg>
                                </div>
                                <h3 className="card-title text-pink-700 dark:text-pink-300 mb-0">Estabilidade Gestante / Rescisão Indireta</h3>
                            </div>
                            
                            <label className="flex items-center gap-3 cursor-pointer mb-6">
                                <input 
                                    type="checkbox" 
                                    checked={data.stability.isPregnant} 
                                    onChange={e => setData(prev => ({ ...prev, stability: { ...prev.stability, isPregnant: e.target.checked } }))} 
                                    className="w-5 h-5 text-pink-600 bg-pink-50 dark:bg-slate-700 border-pink-300 dark:border-pink-700 rounded focus:ring-pink-500" 
                                />
                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                    Calcular indenização do período de estabilidade gestacional
                                </span>
                            </label>

                            {data.stability.isPregnant && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-8 border-l-2 border-pink-200 dark:border-pink-800">
                                    <div>
                                        <label className="label-text text-pink-700 dark:text-pink-300">Data do Parto (Real ou Provável)</label>
                                        <input 
                                            type="date" 
                                            className="input-field border-pink-200 focus:ring-pink-500" 
                                            value={data.stability.childBirthDate} 
                                            onChange={e => setData(prev => ({ ...prev, stability: { ...prev.stability, childBirthDate: e.target.value } }))} 
                                        />
                                        <p className="text-xs text-slate-500 mt-1">O sistema calculará automaticamente 5 meses após esta data.</p>
                                    </div>
                                    <div>
                                        <label className="label-text text-pink-700 dark:text-pink-300">Ou Data Final da Estabilidade (Manual)</label>
                                        <input 
                                            type="date" 
                                            className="input-field border-pink-200 focus:ring-pink-500" 
                                            value={data.stability.endDate} 
                                            onChange={e => setData(prev => ({ ...prev, stability: { ...prev.stability, endDate: e.target.value } }))} 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-2 flex justify-between">
                          <button onClick={() => setActiveTab(3)} className="btn-secondary">Voltar</button>
                          <button 
                            onClick={() => calculate()} 
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-green-500/30 flex items-center gap-2 transform hover:scale-105 transition-all"
                          >
                             <CalculatorIcon className="h-5 w-5" /> Calcular Tudo
                          </button>
                      </div>
                   </div>
              )}

              {/* TAB 5: RESULTADOS */}
              {activeTab === 5 && (
                  <div className="animate-in zoom-in-95 duration-500 space-y-6">
                      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
                          <div>
                              <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Estimado Bruto</p>
                              <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                                  {formatCurrency(totalValue)}
                              </p>
                          </div>
                          <div className="flex gap-3">
                              <button onClick={() => setActiveTab(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-sm transition">
                                  Revisar Dados
                              </button>
                              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/50 flex items-center gap-2 transition">
                                  <ArchiveBoxIcon className="h-5 w-5" /> Salvar
                              </button>
                              <button onClick={generatePDF} className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/50 flex items-center gap-2 transition">
                                  <DocumentTextIcon className="h-5 w-5" /> PDF
                              </button>
                          </div>
                      </div>

                      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 dark:bg-slate-900/50">
                                  <tr>
                                      <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400">Descrição</th>
                                      <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 text-right">Valor</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {calcResult.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                          <td className="px-6 py-4">
                                              <span className="block font-medium text-slate-800 dark:text-slate-200">{item.desc}</span>
                                              <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">{item.category}</span>
                                          </td>
                                          <td className="px-6 py-4 text-right font-mono text-slate-700 dark:text-slate-300 font-bold">
                                              {formatCurrency(item.value)}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                      
                      <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/30 flex gap-3">
                          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-500 shrink-0" />
                          <p className="text-xs text-yellow-700 dark:text-yellow-400">
                              <strong>Atenção:</strong> Estes valores são estimativas baseadas nos dados inseridos e não substituem o cálculo oficial de liquidação de sentença. Verifique convenções coletivas para alíquotas específicas.
                          </p>
                      </div>
                  </div>
              )}

          </div>
      </div>
      
      {/* CSS Utility Classes for this component */}
      <style>{`
        .label-text { @apply block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase mb-2; }
        .label-tiny { @apply block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1; }
        .input-field { @apply w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-400 dark:border-slate-500 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm font-medium text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 shadow-sm; }
        .input-tiny { @apply w-full px-2 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-500 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium; }
        .btn-primary { @apply px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition flex items-center gap-2; }
        .btn-secondary { @apply px-6 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition; }
        .btn-secondary-sm { @apply px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-1; }
        .card-section { @apply bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700; }
        .card-title { @apply font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2; }
        .empty-msg { @apply text-center text-sm text-slate-500 dark:text-slate-400 italic py-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl; }
      `}</style>
    </div>
  );
}
