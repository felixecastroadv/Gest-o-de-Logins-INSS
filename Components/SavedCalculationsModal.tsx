import React, { useState, useEffect } from 'react';
import { XCircleIcon, TrashIcon, FolderOpenIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { SocialSecurityData } from '../SocialSecurityCalc';

interface SavedCalculationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoad: (data: SocialSecurityData) => void;
}

interface SavedCalculation {
    id: string;
    date: string;
    clientName: string;
    data: SocialSecurityData;
}

const SavedCalculationsModal: React.FC<SavedCalculationsModalProps> = ({ isOpen, onClose, onLoad }) => {
    const [calculations, setCalculations] = useState<SavedCalculation[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadCalculations();
        }
    }, [isOpen]);

    const loadCalculations = () => {
        try {
            const saved = localStorage.getItem('social_security_calculations');
            if (saved) {
                setCalculations(JSON.parse(saved));
            }
        } catch (error) {
            console.error("Erro ao carregar cálculos:", error);
        }
    };

    const handleDelete = (id: string) => {
        if (confirm("Tem certeza que deseja excluir este cálculo?")) {
            const newCalculations = calculations.filter(c => c.id !== id);
            setCalculations(newCalculations);
            localStorage.setItem('social_security_calculations', JSON.stringify(newCalculations));
        }
    };

    const handleLoad = (calc: SavedCalculation) => {
        if (confirm(`Deseja carregar o cálculo de ${calc.clientName}? Os dados atuais serão substituídos.`)) {
            onLoad(calc.data);
            onClose();
        }
    };

    const startEditing = (calc: SavedCalculation) => {
        setEditingId(calc.id);
        setEditName(calc.clientName);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditName('');
    };

    const saveEditing = (id: string) => {
        const newCalculations = calculations.map(c => {
            if (c.id === id) {
                return { ...c, clientName: editName, data: { ...c.data, clientName: editName } };
            }
            return c;
        });
        setCalculations(newCalculations);
        localStorage.setItem('social_security_calculations', JSON.stringify(newCalculations));
        setEditingId(null);
        setEditName('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <FolderOpenIcon className="h-5 w-5 text-indigo-500" />
                            Cálculos Salvos
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Gerencie seus cálculos previdenciários salvos localmente.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
                        <XCircleIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 dark:bg-slate-900/50">
                    {calculations.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 italic border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <p>Nenhum cálculo salvo encontrado.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {calculations.map((calc) => (
                                <div key={calc.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition flex justify-between items-center group">
                                    <div className="flex-1 mr-4">
                                        {editingId === calc.id ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="text" 
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                                    autoFocus
                                                />
                                                <button onClick={() => saveEditing(calc.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                                                    <CheckIcon className="h-5 w-5" />
                                                </button>
                                                <button onClick={cancelEditing} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                                    <XMarkIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                                                    {calc.clientName || "Cliente Sem Nome"}
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    Salvo em: {new Date(calc.date).toLocaleString()}
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    Vínculos: {calc.data.bonds.length} | DER: {calc.data.der}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    
                                    {editingId !== calc.id && (
                                        <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleLoad(calc)}
                                                className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
                                                title="Abrir"
                                            >
                                                <FolderOpenIcon className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={() => startEditing(calc)}
                                                className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition"
                                                title="Editar Nome"
                                            >
                                                <PencilSquareIcon className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(calc.id)}
                                                className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                                                title="Excluir"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
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

export default SavedCalculationsModal;
