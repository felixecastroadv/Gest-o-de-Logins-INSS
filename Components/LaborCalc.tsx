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
                                               }} className="rounded text-indigo-600 focus:ring-indigo-500" />
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
                                       <input type="checkbox" checked={data.applyFine477} onChange={e => handleInputChange('applyFine477', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded" />
                                       <span className="text-sm font-semibold dark:text-slate-200">Multa Art. 477 (Atraso Pagamento)</span>
                                   </label>
                                   <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                                       <input type="checkbox" checked={data.applyFine467} onChange={e => handleInputChange('applyFine467', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded" />
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
                                    className="w-5 h-5 text-pink-600 rounded focus:ring-pink-500" 
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
                            onClick={calculate} 
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
        .label-text { @apply block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5; }
        .label-tiny { @apply block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1; }
        .input-field { @apply w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm dark:text-white; }
        .input-tiny { @apply w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white; }
        .btn-primary { @apply px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition flex items-center gap-2; }
        .btn-secondary { @apply px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition; }
        .btn-secondary-sm { @apply px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-1; }
        .card-section { @apply bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700; }
        .card-title { @apply font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2; }
        .empty-msg { @apply text-center text-sm text-slate-400 italic py-4 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-xl; }
      `}</style>
    </div>
  );
}
