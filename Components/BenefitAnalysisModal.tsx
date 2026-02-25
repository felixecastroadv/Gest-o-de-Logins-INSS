import React, { useState, useMemo } from 'react';
import { SocialSecurityData } from '../SocialSecurityCalc';
import { analyzeBenefits, BenefitResult } from '../BenefitRules';
import { CheckCircleIcon, XCircleIcon, CalculatorIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface BenefitAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: SocialSecurityData;
}

interface BenefitCardProps {
    benefit: BenefitResult;
}

const BenefitCard: React.FC<BenefitCardProps> = ({ benefit }) => {
    return (
        <div className={`p-4 mb-3 rounded-xl border ${benefit.isEligible ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} shadow-sm transition hover:shadow-md`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className={`font-bold text-base ${benefit.isEligible ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {benefit.benefitName}
                    </h3>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">
                        Regra: {benefit.ruleType}
                    </p>
                </div>
                <div>
                    {benefit.isEligible ? (
                        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-full">
                            <CheckCircleIcon className="h-4 w-4" />
                            <span>Elegível</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-full">
                            <XCircleIcon className="h-4 w-4" />
                            <span>Não Elegível</span>
                        </div>
                    )}
                </div>
            </div>

            {!benefit.isEligible && benefit.missingDetails && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                        {benefit.missingDetails}
                    </p>
                </div>
            )}

            {benefit.isEligible && (
                <div className="mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-800/30 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">RMI Estimada (Base)</span>
                        <span className="text-lg font-bold text-slate-800 dark:text-white">
                            {benefit.rmi ? benefit.rmi.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs leading-tight">
                            *Valor estimado (média simples). Requer correção monetária oficial.
                        </p>
                    </div>
                    <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 transition">
                        <CalculatorIcon className="h-3.5 w-3.5" />
                        Detalhar RMI
                    </button>
                </div>
            )}
        </div>
    );
};

const BenefitAnalysisModal: React.FC<BenefitAnalysisModalProps> = ({ isOpen, onClose, data }) => {
    if (!isOpen) return null;

    const [selectedCategory, setSelectedCategory] = useState<'aposentadorias' | 'auxilios' | 'dependentes'>('aposentadorias');
    
    // Run analysis
    const result = useMemo(() => analyzeBenefits(data), [data]);

    // Filter benefits by category
    const filteredBenefits = useMemo(() => {
        return result.benefits.filter(b => b.category === selectedCategory);
    }, [result, selectedCategory]);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <DocumentTextIcon className="h-5 w-5 text-indigo-500" />
                            Análise de Requisitos e RMI
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Verificação automática de elegibilidade com base nos dados do CNIS.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
                        <XCircleIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 dark:bg-slate-900/50 min-h-0">
                    
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tempo Total</span>
                            <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                {result.totalTime.years}a {result.totalTime.months}m {result.totalTime.days}d
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Idade</span>
                            <div className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">
                                {isNaN(result.age.years) ? 'N/A' : `${result.age.years} anos`}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Carência</span>
                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                {result.totalCarencia} meses
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pontos</span>
                            <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                                {isNaN(result.points) ? 'N/A' : result.points.toFixed(1)}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                        <button 
                            onClick={() => setSelectedCategory('aposentadorias')}
                            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition whitespace-nowrap ${selectedCategory === 'aposentadorias' ? 'bg-white dark:bg-slate-800 text-indigo-600 border-x border-t border-slate-200 dark:border-slate-700 relative -mb-px' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                        >
                            Aposentadorias
                        </button>
                        <button 
                            onClick={() => setSelectedCategory('auxilios')}
                            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition whitespace-nowrap ${selectedCategory === 'auxilios' ? 'bg-white dark:bg-slate-800 text-indigo-600 border-x border-t border-slate-200 dark:border-slate-700 relative -mb-px' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                        >
                            Auxílios e Salários
                        </button>
                        <button 
                            onClick={() => setSelectedCategory('dependentes')}
                            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition whitespace-nowrap ${selectedCategory === 'dependentes' ? 'bg-white dark:bg-slate-800 text-indigo-600 border-x border-t border-slate-200 dark:border-slate-700 relative -mb-px' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                        >
                            Benefícios aos Dependentes
                        </button>
                    </div>

                    {/* Results List */}
                    <div className="space-y-2">
                        {filteredBenefits.length > 0 ? (
                            filteredBenefits.map((benefit, idx) => (
                                <BenefitCard key={idx} benefit={benefit} />
                            ))
                        ) : (
                            <div className="text-center py-12 text-slate-500 italic border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                <p className="text-sm">Nenhum benefício encontrado para esta categoria.</p>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
                    <button onClick={onClose} className="px-5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BenefitAnalysisModal;
