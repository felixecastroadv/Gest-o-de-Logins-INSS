import React, { useState, useMemo } from 'react';
import { 
  CalculatorIcon, 
  BanknotesIcon, 
  ClockIcon, 
  ExclamationTriangleIcon, 
  DocumentTextIcon, 
  ArrowPathIcon,
  TrashIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { jsPDF } from "jspdf";

// --- Tipos e Interfaces ---

interface LaborData {
  // Dados Contratuais
  employeeName: string;
  startDate: string;
  endDate: string;
  baseSalary: number;
  terminationReason: 'sem_justa_causa' | 'pedido_demissao' | 'justa_causa' | 'rescisao_indireta';
  noticePeriod: 'trabalhado' | 'indenizado' | 'dispensado';
  hasFgtsBalance: number; // Saldo já depositado para cálculo da multa

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

export default function LaborCalc() {
  const [data, setData] = useState<LaborData>(INITIAL_LABOR_DATA);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [calcResult, setCalcResult] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState<number>(0);

  // --- Handlers ---
  const handleInputChange = (field: keyof LaborData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
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

  // --- ENGINE DE CÁLCULO ---
  const calculate = () => {
    const results = [];
    let total = 0;

    const start = parseDate(data.startDate);
    const end = parseDate(data.endDate);
    const salary = Number(data.baseSalary);

    if (!salary) {
        alert("Por favor, insira ao menos o Salário Base para estimativa.");
    }

    // 1. Saldo de Salário
    if (end && salary) {
        const daysWorked = end.getDate();
        const balance = (salary / 30) * daysWorked;
        results.push({ desc: `Saldo de Salário (${daysWorked} dias)`, value: balance, category: 'Rescisórias' });
    }

    // 2. Aviso Prévio
    if (start && end && salary && data.noticePeriod === 'indenizado' && data.terminationReason !== 'justa_causa' && data.terminationReason !== 'pedido_demissao') {
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
        if (data.unpaid13thMonths > 0) {
            const unpaid13th = (salary / 12) * data.unpaid13thMonths;
            results.push({ desc: `13º Salário Vencidos (${data.unpaid13thMonths} meses)`, value: unpaid13th, category: 'Rescisórias' });
        }
    }

    // 4. Férias
    if (salary) {
        // Vencidas
        if (data.vacationExpiredQty > 0) {
            const vacValue = (salary + (salary / 3)) * data.vacationExpiredQty;
            results.push({ desc: `Férias Vencidas + 1/3 (${data.vacationExpiredQty} períodos)`, value: vacValue, category: 'Rescisórias' });
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

    // 5. Diferença Salarial
    data.wageGap.forEach((gap, idx) => {
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

    // 6. Horas Extras (Lote)
    data.overtime.forEach((ot, idx) => {
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

    // 7. Estabilidade Gestante
    if (data.stability.isPregnant && salary) {
        let stabEnd = parseDate(data.stability.endDate);
        const stabStart = end || new Date();
        
        // Se não tem data fim, calcula parto + 5 meses
        if (!stabEnd && data.stability.childBirthDate) {
            const birth = parseDate(data.stability.childBirthDate);
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

    // 8. FGTS + 40%
    // Sobre salários não pagos
    if (data.unpaidFgtsMonths > 0 && salary) {
        const unpaidFgts = (salary * 0.08) * data.unpaidFgtsMonths;
        results.push({ desc: `FGTS Não Depositado (${data.unpaidFgtsMonths} meses)`, value: unpaidFgts, category: 'FGTS' });
    }
    
    // Multa 40% (Sobre saldo existente + o que foi gerado na rescisão estimada)
    let totalFgtsBase = Number(data.hasFgtsBalance) || 0;
    // Adiciona o FGTS da rescisão (Aviso + 13o) aprox
    // Simplificação: Soma dos valores salariais calculados * 8%
    const rescisaoFgtsBase = results
        .filter(r => ['Rescisórias', 'Salários', 'Horas Extras'].includes(r.category))
        .reduce((sum, item) => sum + item.value, 0);
    
    totalFgtsBase += (rescisaoFgtsBase * 0.08);

    if (data.terminationReason === 'sem_justa_causa' || data.terminationReason === 'rescisao_indireta') {
        const fine40 = totalFgtsBase * 0.4;
        results.push({ desc: `Multa 40% do FGTS (Estimada)`, value: fine40, category: 'FGTS' });
    }

    // 9. Multas CLT
    if (data.applyFine477 && salary) {
        results.push({ desc: `Multa Art. 477 (Atraso)`, value: salary, category: 'Multas' });
    }
    
    // Calcula subtotal para a multa do 467 (50% sobre verbas rescisórias incontroversas)
    if (data.applyFine467) {
        const incontroverso = results
            .filter(r => r.category === 'Rescisórias')
            .reduce((sum, item) => sum + item.value, 0);
        results.push({ desc: `Multa Art. 467 (50% Incontroverso)`, value: incontroverso * 0.5, category: 'Multas' });
    }

    // 10. Danos Morais
    if (data.moralDamages > 0) {
        results.push({ desc: `Indenização por Danos Morais`, value: Number(data.moralDamages), category: 'Indenizações' });
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
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(30, 58, 138); // Primary Blue
      doc.text("ESTIMATIVA DE CÁLCULO TRABALHISTA", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Cliente: ${data.employeeName || 'Não informado'}`, 14, 30);
      doc.text(`Data Base: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, 30, { align: "right" });
      doc.line(14, 32, pageWidth - 14, 32);

      let y = 45;
      
      doc.setFontSize(12);
      doc.setTextColor(0);
      
      // Cabeçalho Tabela
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y - 6, pageWidth - 28, 8, 'F');
      doc.setFont("helvetica", "bold");
      doc.text("DESCRIÇÃO DA VERBA", 16, y);
      doc.text("VALOR ESTIMADO", pageWidth - 16, y, { align: "right" });
      y += 10;

      doc.setFont("helvetica", "normal");
      
      let currentCategory = '';

      calcResult.forEach((item) => {
          if (y > 270) { doc.addPage(); y = 20; }

          if (item.category !== currentCategory) {
              y += 2;
              doc.setFont("helvetica", "bold");
              doc.setTextColor(37, 99, 235); // Blue 600
              doc.text(item.category.toUpperCase(), 14, y);
              doc.line(14, y+1, pageWidth-14, y+1);
              y += 6;
              currentCategory = item.category;
              doc.setTextColor(0);
              doc.setFont("helvetica", "normal");
          }

          doc.text(item.desc, 14, y);
          doc.text(formatCurrency(item.value), pageWidth - 14, y, { align: "right" });
          y += 7;
      });

      y += 5;
      doc.setLineWidth(0.5);
      doc.line(14, y, pageWidth - 14, y);
      y += 10;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("TOTAL ESTIMADO:", 14, y);
      doc.text(formatCurrency(totalValue), pageWidth - 14, y, { align: "right" });

      doc.setFontSize(8);
      doc.setTextColor(150);
      y += 15;
      doc.text("* Este documento é uma estimativa preliminar baseada nas informações fornecidas.", 14, y);
      doc.text("* Valores sujeitos a alteração conforme provas documentais e decisão judicial.", 14, y + 4);

      doc.save(`Calculo_${data.employeeName || 'Trabalhista'}.pdf`);
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
            <button onClick={() => setData(INITIAL_LABOR_DATA)} className="text-xs font-bold text-slate-500 hover:text-red-500 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
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
                                  <input type="text" className="input-field" value={data.employeeName} onChange={e => handleInputChange('employeeName', e.target.value)} placeholder="Ex: João da Silva" />
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
                 
