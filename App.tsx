import React, { useState, useEffect, useMemo } from 'react';
import { User, AUTHORIZED_USERS, ClientRecord, UserRole, ContractRecord, PaymentEntry } from './types';
import { INITIAL_DATA } from './data';
import { 
  LockClosedIcon, 
  ArrowRightOnRectangleIcon, 
  PlusIcon, 
  PencilSquareIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  MoonIcon,
  SunIcon,
  StarIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ScaleIcon,
  ComputerDesktopIcon,
  ArrowDownTrayIcon,
  CloudIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  SignalIcon,
  SignalSlashIcon,
  ArrowPathRoundedSquareIcon,
  ArchiveBoxArrowDownIcon,
  BellIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  CurrencyDollarIcon,
  WalletIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const INITIAL_CONTRACTS: ContractRecord[] = [];

// --- Helpers ---

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
};

const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const isUrgentDate = (dateStr: string): boolean => {
  const date = parseDate(dateStr);
  if (!date) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Returns true if date is today or in the next 7 days
  return diffDays >= 0 && diffDays <= 7;
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// --- Database Service (Supabase Wrapper) ---
declare global {
  interface Window {
    supabase: any;
  }
}

const DB_CONFIG_KEY = 'inss_db_config';

// ------------------------------------------------------------------
// CONFIGURAÇÃO GLOBAL DO BANCO DE DADOS (AUTO-CONFIG)
// ------------------------------------------------------------------
const GLOBAL_SUPABASE_URL = "https://nnhatyvrtlbkyfadumqo.supabase.co";
const GLOBAL_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaGF0eXZydGxia3lmYWR1bXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mzk1NDYsImV4cCI6MjA4MTExNTU0Nn0.F_020GSnZ_jQiSSPFfAxY9Q8dU6FmjUDixOeZl4YHDg";

const getEnvVar = (key: string): string | undefined => {
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
             // @ts-ignore
            return import.meta.env[key];
        }
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            // @ts-ignore
            return process.env[key];
        }
    } catch (e) {}
    return undefined;
};

const getDbConfig = () => {
    const stored = localStorage.getItem(DB_CONFIG_KEY);
    if (stored) return JSON.parse(stored);

    const envUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL');
    const envKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY');

    if (envUrl && envKey) {
        return { url: envUrl, key: envKey, isEnv: true };
    }

    if (GLOBAL_SUPABASE_URL && GLOBAL_SUPABASE_KEY) {
        return { url: GLOBAL_SUPABASE_URL, key: GLOBAL_SUPABASE_KEY, isEnv: true };
    }

    return null;
};

const initSupabase = () => {
    const config = getDbConfig();
    if (config && config.url && config.key && window.supabase) {
        return window.supabase.createClient(config.url, config.key);
    }
    return null;
};

// --- Components ---

// 0. Install Prompt Component
const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsInstalled(true);
        }
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsVisible(false);
        }
    };

    if (isInstalled || !isVisible) return null;

    return (
        <div className="absolute top-6 right-6 z-50 animate-bounce-slow hidden md:block">
            <button
                onClick={handleInstallClick}
                className="flex items-center gap-3 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 text-white px-5 py-3 rounded-full shadow-2xl transition-all transform hover:scale-105 group"
            >
                <div className="bg-white text-primary-600 p-2 rounded-full shadow-sm">
                    <ArrowDownTrayIcon className="h-5 w-5" />
                </div>
                <div className="text-left">
                    <p className="text-xs font-medium text-slate-200 uppercase tracking-wider">Disponível</p>
                    <p className="font-bold text-sm">Instalar App no PC</p>
                </div>
            </button>
        </div>
    );
};

// 0.1 Settings Modal
const SettingsModal = ({ isOpen, onClose, onSave, onRestoreBackup }: { isOpen: boolean, onClose: () => void, onSave: () => void, onRestoreBackup: () => void }) => {
    const [url, setUrl] = useState('');
    const [key, setKey] = useState('');
    const [isEnvManaged, setIsEnvManaged] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const config = getDbConfig();
            if (config) {
                setUrl(config.url || '');
                setKey(config.key || '');
                setIsEnvManaged(!!config.isEnv);
            }
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!isEnvManaged) {
            localStorage.setItem(DB_CONFIG_KEY, JSON.stringify({ url, key }));
        }
        onSave();
        onClose();
    };

    const handleClear = () => {
        if(confirm("Isso desconectará o banco de dados. Deseja continuar?")) {
            localStorage.removeItem(DB_CONFIG_KEY);
            setUrl('');
            setKey('');
            setIsEnvManaged(false);
            onSave();
            onClose();
        }
    };
    
    const handleRestore = () => {
        if (confirm("ATENÇÃO: Isso irá apagar os dados atuais da nuvem e substituí-los pelos dados originais de backup (data.ts). Tem certeza?")) {
            onRestoreBackup();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-primary-100 dark:bg-primary-900/30 p-2 rounded-lg text-primary-600 dark:text-primary-400">
                        <CloudIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Conexão Nuvem</h3>
                        <p className="text-xs text-slate-500">Sincronize dados entre computadores</p>
                    </div>
                </div>

                {isEnvManaged ? (
                    <div className="mb-4 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 flex items-start gap-3">
                        <CheckIcon className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-green-700 dark:text-green-300">
                                Conexão Automática Ativa!
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                O sistema já está configurado para acessar a nuvem.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                                Modo Local (Offline)
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Para ativar o modo online, insira as chaves abaixo.
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Supabase URL</label>
                        <input 
                            type="text" 
                            value={url} 
                            onChange={e => setUrl(e.target.value)} 
                            disabled={isEnvManaged}
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed font-mono text-slate-600 dark:text-slate-300" 
                            placeholder="https://xyz.supabase.co" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Supabase Anon Key</label>
                        <input 
                            type="password" 
                            value={key} 
                            onChange={e => setKey(e.target.value)} 
                            disabled={isEnvManaged}
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed font-mono text-slate-600 dark:text-slate-300" 
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5..." 
                        />
                    </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button 
                        onClick={handleRestore}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition"
                    >
                        <ArchiveBoxArrowDownIcon className="h-4 w-4" />
                        Restaurar Dados Iniciais (Backup)
                    </button>
                    <p className="text-[10px] text-center text-slate-400 mt-2">
                        Use isto caso a tabela esteja vazia (0 registros).
                    </p>
                </div>

                <div className="flex gap-3 mt-6">
                    {!isEnvManaged && url && key && <button onClick={handleClear} className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition">Desconectar</button>}
                    <div className="flex-1 flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition">Cancelar</button>
                        {!isEnvManaged && <button onClick={handleSave} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-primary-500/30 transition">Salvar & Conectar</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// 0.2 Notifications Modal
interface NotificationItem {
    id: string;
    clientName: string;
    type: 'Prorrogação' | 'Perícia Médica' | 'Perícia Social' | 'Mandado de Segurança';
    date: string;
}

const NotificationsModal = ({ isOpen, onClose, notifications }: { isOpen: boolean, onClose: () => void, notifications: NotificationItem[] }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-end z-[90] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800 mt-16 mr-0 md:mr-4 overflow-hidden animate-in slide-in-from-right duration-200">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                         <div className="bg-orange-100 dark:bg-orange-900/30 p-1.5 rounded-lg text-orange-600 dark:text-orange-400">
                             <BellAlertIcon className="h-5 w-5" />
                         </div>
                         <h3 className="font-bold text-slate-800 dark:text-white">Alertas Urgentes</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                            <CheckIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Nenhuma pendência urgente para os próximos 7 dias.</p>
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {notifications.map((notif, idx) => (
                                <li key={`${notif.id}-${idx}`} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm line-clamp-1">{notif.clientName}</span>
                                        <span className="text-[10px] font-mono bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800/30">
                                            {notif.date}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                        <ExclamationTriangleIcon className="h-3.5 w-3.5 text-orange-500" />
                                        {notif.type}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400">Alertas para hoje e próximos 7 dias</p>
                </div>
            </div>
        </div>
    );
}

// 0.3 Contract Modal (NOVO)
interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ContractRecord) => void;
  initialData?: ContractRecord | null;
}

const ContractModal: React.FC<ContractModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState<Partial<ContractRecord>>({
        payments: []
    });
    const [newPaymentAmount, setNewPaymentAmount] = useState('');
    const [newPaymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            setFormData({ 
                status: 'Pendente', 
                paymentMethod: 'Parcelado', 
                payments: [],
                createdAt: new Date().toISOString().split('T')[0]
            });
        }
        setNewPaymentAmount('');
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAddPayment = () => {
        if (!newPaymentAmount || Number(newPaymentAmount) <= 0) return;
        const payment: PaymentEntry = {
            id: Math.random().toString(36).substr(2, 9),
            date: newPaymentDate,
            amount: Number(newPaymentAmount),
            note: 'Pagamento registrado'
        };
        const updatedPayments = [...(formData.payments || []), payment];
        setFormData({ ...formData, payments: updatedPayments });
        setNewPaymentAmount('');
    };

    const handleRemovePayment = (id: string) => {
        const updatedPayments = (formData.payments || []).filter(p => p.id !== id);
        setFormData({ ...formData, payments: updatedPayments });
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as ContractRecord);
    };

    const totalPaid = (formData.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const totalFee = Number(formData.totalFee) || 0;
    const remaining = Math.max(0, totalFee - totalPaid);
    const progress = totalFee > 0 ? (totalPaid / totalFee) * 100 : 0;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                         <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg">
                             <BriefcaseIcon className="h-6 w-6" />
                         </div>
                         <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                             {initialData ? 'Editar Contrato' : 'Novo Contrato'}
                         </h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="md:col-span-2">
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Dados do Cliente</h4>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Nome</label>
                        <input type="text" name="firstName" required value={formData.firstName || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Sobrenome</label>
                        <input type="text" name="lastName" required value={formData.lastName || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">CPF</label>
                        <input type="text" name="cpf" required value={formData.cpf || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Tipo de Serviço</label>
                        <input type="text" name="serviceType" required value={formData.serviceType || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>

                     <div className="md:col-span-2 mt-2">
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Financeiro & Responsável</h4>
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Advogado Responsável</label>
                         <select name="lawyer" required value={formData.lawyer || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white">
                             <option value="">Selecione...</option>
                             <option value="Michel">Dr. Michel</option>
                             <option value="Luana">Dra. Luana</option>
                         </select>
                         <p className="text-[10px] text-slate-400 mt-1">Define a divisão de lucros (60/40).</p>
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Valor Total Honorários (R$)</label>
                         <input type="number" name="totalFee" required value={formData.totalFee || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white font-mono" placeholder="0.00" />
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Status do Processo</label>
                         <select name="status" value={formData.status || 'Pendente'} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white">
                             <option value="Pendente">Pendente</option>
                             <option value="Em Andamento">Em Andamento</option>
                             <option value="Concluído">Concluído</option>
                         </select>
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Forma de Pagamento</label>
                         <select name="paymentMethod" value={formData.paymentMethod || 'Parcelado'} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white">
                             <option value="À Vista">À Vista</option>
                             <option value="Parcelado">Parcelado</option>
                         </select>
                     </div>

                     {/* Payment Section */}
                     <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mt-2">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Registro de Pagamentos</h4>
                                <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 w-64">
                                    <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Pago: <span className="text-green-600 dark:text-green-400 font-bold">{formatCurrency(totalPaid)}</span> • 
                                    Restante: <span className="text-red-500 dark:text-red-400 font-bold">{formatCurrency(remaining)}</span>
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2 mb-4 items-end">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valor do Pagamento</label>
                                <input type="number" value={newPaymentAmount} onChange={e => setNewPaymentAmount(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" placeholder="R$ 0,00" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data</label>
                                <input type="date" value={newPaymentDate} onChange={e => setNewPaymentDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" />
                            </div>
                            <button type="button" onClick={handleAddPayment} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition">
                                <PlusIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {formData.payments && formData.payments.length > 0 ? (
                                formData.payments.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-1.5 rounded">
                                                <BanknotesIcon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <span className="block font-bold dark:text-slate-200">{formatCurrency(p.amount)}</span>
                                                <span className="text-[10px] text-slate-500 uppercase">{new Date(p.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => handleRemovePayment(p.id)} className="text-slate-400 hover:text-red-500 transition">
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-xs text-slate-400 py-2">Nenhum pagamento registrado.</p>
                            )}
                        </div>
                     </div>

                     <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 rounded-xl transition">Cancelar</button>
                        <button type="submit" className="px-5 py-2.5 text-white font-medium bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/30 transition flex items-center gap-2">
                            <CheckIcon className="h-5 w-5" />
                            Salvar Contrato
                        </button>
                     </div>
                </form>
            </div>
        </div>
    );
};

// 1. Login Component
interface LoginProps {
  onLogin: (user: User) => void;
  onOpenSettings: () => void;
  isCloudConfigured: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, onOpenSettings, isCloudConfigured }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = AUTHORIZED_USERS.find(
      u => u.firstName.toLowerCase() === firstName.trim().toLowerCase() && 
           u.lastName.toLowerCase() === lastName.trim().toLowerCase()
    );

    if (foundUser) {
      onLogin(foundUser);
    } else {
      setError('Acesso negado. Credenciais inválidas.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
      
      <InstallPrompt />
      
      <div className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/10 relative z-10">
        <button onClick={onOpenSettings} className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-2 rounded-full hover:bg-white/10 group" title="Configurar Banco de Dados">
            <Cog6ToothIcon className={`h-5 w-5 ${isCloudConfigured ? 'text-green-400' : 'text-slate-400 group-hover:text-white'}`} />
        </button>

        <div className="text-center mb-8">
          <div className="bg-gradient-to-tr from-primary-600 to-primary-400 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/30 transform rotate-3 hover:rotate-6 transition-transform duration-300">
            <ScaleIcon className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Gestão INSS</h2>
          <p className="text-slate-300 mt-2 font-medium">Acesso Exclusivo Jurídico</p>
          {!isCloudConfigured && (
              <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700/50">
                  <SignalSlashIcon className="h-3 w-3" />
                  MODO LOCAL (OFFLINE)
              </span>
          )}
          {isCloudConfigured && (
              <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[10px] font-bold bg-green-900/40 text-green-400 border border-green-800/50 shadow-[0_0_10px_rgba(74,222,128,0.2)]">
                  <SignalIcon className="h-3 w-3" />
                  NUVEM CONECTADA
              </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 ml-1">Nome</label>
                <input
                type="text"
                required
                className="w-full px-5 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition text-white placeholder-slate-500"
                placeholder="Ex: Michel"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 ml-1">Sobrenome</label>
                <input
                type="text"
                required
                className="w-full px-5 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition text-white placeholder-slate-500"
                placeholder="Ex: Felix"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 text-red-200 text-sm rounded-xl border border-red-500/20 flex items-center gap-3 animate-pulse">
              <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-bold py-3.5 rounded-xl transition duration-300 shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 group"
          >
            <LockClosedIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
            Acessar Sistema
          </button>
        </form>
        
        <div className="mt-8 text-center text-xs text-slate-500">
            &copy; 2025 Gestão Jurídica Inteligente
        </div>
      </div>
    </div>
  );
};

// 2. Record Modal Component (Mantido o original para Clientes)
interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ClientRecord) => void;
  initialData?: ClientRecord | null;
}

const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Partial<ClientRecord>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({});
    }
  }, [initialData, isOpen]);

  useEffect(() => {
    if (formData.der && formData.der.length === 10) {
       const derDate = parseDate(formData.der);
       if (derDate) {
         const calculatedDate = addDays(derDate, 90);
         const formatted = formatDate(calculatedDate);
         if (formData.ninetyDaysDate !== formatted) {
           setFormData(prev => ({ ...prev, ninetyDaysDate: formatted }));
         }
       }
    }
  }, [formData.der]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as ClientRecord);
  };

  const fields = [
    { label: "Nome Completo", name: "name", type: "text", width: "full" },
    { label: "CPF", name: "cpf", type: "text", width: "half" },
    { label: "Senha INSS", name: "password", type: "text", width: "half" },
    { label: "Tipo Benefício", name: "type", type: "text", width: "half" },
    { label: "DER", name: "der", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
    { label: "Perícia Médica", name: "medExpertiseDate", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
    { label: "Perícia Social", name: "socialExpertiseDate", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
    { label: "Prorrogação", name: "extensionDate", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
    { label: "DCB", name: "dcbDate", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
    { label: "90 Dias (Auto)", name: "ninetyDaysDate", type: "text", width: "half", readOnly: true },
    { label: "Mand. Segurança", name: "securityMandateDate", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${initialData ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'}`}>
                {initialData ? <PencilSquareIcon className="h-6 w-6" /> : <PlusIcon className="h-6 w-6" />}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {initialData ? 'Editar Processo' : 'Novo Processo'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {fields.map((field) => (
            <div key={field.name} className={field.width === 'full' ? 'md:col-span-2' : ''}>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                {field.label}
              </label>
              <input
                type={field.type}
                name={field.name}
                value={(formData as any)[field.name] || ''}
                onChange={handleChange}
                placeholder={field.placeholder || ''}
                readOnly={field.readOnly}
                className={`w-full px-4 py-2.5 border rounded-xl outline-none transition text-sm
                    ${field.readOnly 
                        ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700' 
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500'
                    }`}
              />
            </div>
          ))}
          
          <div className="md:col-span-2 mt-2">
             <label className="flex items-center gap-3 cursor-pointer p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group">
                <input 
                    type="checkbox" 
                    checked={formData.isDailyAttention || false}
                    onChange={(e) => setFormData({...formData, isDailyAttention: e.target.checked})}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 border-slate-300 dark:border-slate-600"
                />
                <div>
                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">
                        Monitoramento Diário (Prioridade)
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        Marque esta opção para destacar este cliente na lista.
                    </span>
                </div>
             </label>
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition shadow-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-white font-medium bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-500/30 transition flex items-center gap-2 transform active:scale-95"
            >
              <CheckIcon className="h-5 w-5" />
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. Stats Component
const StatsCards = ({ records }: { records: ClientRecord[] }) => {
    const stats = useMemo(() => {
        const total = records.length;
        const bpc = records.filter(r => r.type?.toLowerCase().includes('bpc')).length;
        const aux = records.filter(r => r.type?.toLowerCase().includes('aux')).length;
        const priority = records.filter(r => r.isDailyAttention).length;
        return { total, bpc, aux, priority };
    }, [records]);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                    <UserGroupIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Total Clientes</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                    <DocumentTextIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Casos BPC</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.bpc}</p>
                </div>
            </div>
             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
                    <ScaleIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Auxílios</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.aux}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-lg">
                    <StarIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Prioridades</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.priority}</p>
                </div>
            </div>
        </div>
    )
}

// 4. Financial Stats Component (NOVO)
const FinancialStats = ({ contracts }: { contracts: ContractRecord[] }) => {
    const stats = useMemo(() => {
        const totalPortfolio = contracts.reduce((acc, c) => acc + (Number(c.totalFee) || 0), 0);
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        let monthlyIncome = 0;
        let michelIncome = 0;
        let luanaIncome = 0;
        let michelPortfolio = 0;
        let luanaPortfolio = 0;

        contracts.forEach(c => {
            const contractTotal = Number(c.totalFee) || 0;
            const responsible = c.lawyer;

            // Portfolio Split (Potencial)
            if (responsible === 'Michel') {
                michelPortfolio += contractTotal * 0.6;
                luanaPortfolio += contractTotal * 0.4;
            } else if (responsible === 'Luana') {
                luanaPortfolio += contractTotal * 0.6;
                michelPortfolio += contractTotal * 0.4;
            }

            // Monthly Cash Flow
            (c.payments || []).forEach(p => {
                const pDate = new Date(p.date);
                if (pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
                    const amount = Number(p.amount);
                    monthlyIncome += amount;
                    
                    if (responsible === 'Michel') {
                        michelIncome += amount * 0.6;
                        luanaIncome += amount * 0.4;
                    } else if (responsible === 'Luana') {
                        luanaIncome += amount * 0.6;
                        michelIncome += amount * 0.4;
                    }
                }
            });
        });

        return { totalPortfolio, monthlyIncome, michelIncome, luanaIncome, michelPortfolio, luanaPortfolio };
    }, [contracts]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                 <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                     <WalletIcon className="h-24 w-24 text-indigo-600" />
                 </div>
                 <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor em Carteira (Total)</p>
                 <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(stats.totalPortfolio)}</p>
                 <div className="mt-3 text-[10px] text-slate-400 flex justify-between">
                     <span>Dr. Michel: {formatCurrency(stats.michelPortfolio)}</span>
                     <span>Dra. Luana: {formatCurrency(stats.luanaPortfolio)}</span>
                 </div>
             </div>

             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                 <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                     <BanknotesIcon className="h-24 w-24 text-green-600" />
                 </div>
                 <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Receita do Mês</p>
                 <p className="text-2xl font-extrabold text-green-600 dark:text-green-400 mt-1">{formatCurrency(stats.monthlyIncome)}</p>
                 <p className="text-[10px] text-slate-400 mt-1">Entradas em caixa neste mês</p>
             </div>

             <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-xl shadow-lg shadow-blue-500/20 text-white relative overflow-hidden">
                 <p className="text-xs font-bold text-blue-200 uppercase tracking-wide">Repasse Dr. Michel</p>
                 <p className="text-2xl font-extrabold mt-1">{formatCurrency(stats.michelIncome)}</p>
                 <p className="text-[10px] text-blue-200 mt-1">Mês Atual (60% Próprios / 40% Luana)</p>
             </div>

             <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-xl shadow-lg shadow-purple-500/20 text-white relative overflow-hidden">
                 <p className="text-xs font-bold text-purple-200 uppercase tracking-wide">Repasse Dra. Luana</p>
                 <p className="text-2xl font-extrabold mt-1">{formatCurrency(stats.luanaIncome)}</p>
                 <p className="text-[10px] text-purple-200 mt-1">Mês Atual (60% Próprios / 40% Michel)</p>
             </div>
        </div>
    );
};

// 4. Dashboard Component
interface DashboardProps {
  user: User;
  onLogout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onOpenSettings: () => void;
  isCloudConfigured: boolean;
  isSettingsOpen: boolean;
  onCloseSettings: () => void;
  onSettingsSaved: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  user, 
  onLogout, 
  darkMode, 
  toggleDarkMode, 
  onOpenSettings, 
  isCloudConfigured,
  isSettingsOpen,
  onCloseSettings,
  onSettingsSaved
}) => {
  const [currentView, setCurrentView] = useState<'clients' | 'contracts'>('clients');

  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ClientRecord | null>(null);
  
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [currentContract, setCurrentContract] = useState<ContractRecord | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // --- Realtime & Data Fetching Logic ---
  const fetchData = async () => {
    setIsLoading(true);
    setDbError(null);
    const supabase = initSupabase();

    try {
        // Fetch Clients
        let fetchedClients = INITIAL_DATA;
        let fetchedContracts = INITIAL_CONTRACTS;

        if (supabase) {
            // Cloud Fetch - Clients
            const { data: clientData, error: clientError } = await supabase.from('clients').select('data').limit(1).single();
            if (clientData && clientData.data) {
                fetchedClients = clientData.data;
                localStorage.setItem('inss_records', JSON.stringify(clientData.data));
            }

            // Cloud Fetch - Contracts (simulated via separate table or key if user creates it, fallback local)
            const { data: contractData, error: contractError } = await supabase.from('contracts').select('data').limit(1).single();
            if (contractData && contractData.data) {
                fetchedContracts = contractData.data;
                localStorage.setItem('inss_contracts', JSON.stringify(contractData.data));
            } else if (contractError && contractError.code === 'PGRST116') {
                 // Table might exist but is empty
                 await supabase.from('contracts').upsert({ id: 1, data: INITIAL_CONTRACTS });
            }
        } else {
             // Local Fallback
             const localClients = localStorage.getItem('inss_records');
             if (localClients) fetchedClients = JSON.parse(localClients);

             const localContracts = localStorage.getItem('inss_contracts');
             if (localContracts) fetchedContracts = JSON.parse(localContracts);
        }

        setRecords(fetchedClients);
        setContracts(fetchedContracts);

    } catch (e) {
        console.error("Erro geral", e);
        setDbError("Erro de conexão local/nuvem.");
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Realtime setup could go here for both tables
  }, [isCloudConfigured]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, currentView]);

  // Compute Alerts
  const activeAlerts = useMemo(() => {
      const alerts: NotificationItem[] = [];
      records.forEach(r => {
          if (isUrgentDate(r.extensionDate)) {
              alerts.push({ id: r.id + '_ext', clientName: r.name, type: 'Prorrogação', date: r.extensionDate });
          }
          if (isUrgentDate(r.medExpertiseDate)) {
              alerts.push({ id: r.id + '_med', clientName: r.name, type: 'Perícia Médica', date: r.medExpertiseDate });
          }
          if (isUrgentDate(r.socialExpertiseDate)) {
              alerts.push({ id: r.id + '_soc', clientName: r.name, type: 'Perícia Social', date: r.socialExpertiseDate });
          }
          if (isUrgentDate(r.securityMandateDate)) {
              alerts.push({ id: r.id + '_mand', clientName: r.name, type: 'Mandado de Segurança', date: r.securityMandateDate });
          }
      });
      return alerts;
  }, [records]);

  // Save Logic (Generic)
  const saveData = async (type: 'clients' | 'contracts', newData: any[]) => {
      setIsSyncing(true);
      const supabase = initSupabase();

      if (type === 'clients') {
          setRecords(newData);
          localStorage.setItem('inss_records', JSON.stringify(newData));
          if (supabase) await supabase.from('clients').upsert({ id: 1, data: newData });
      } else {
          setContracts(newData);
          localStorage.setItem('inss_contracts', JSON.stringify(newData));
          if (supabase) await supabase.from('contracts').upsert({ id: 1, data: newData });
      }
      
      setTimeout(() => setIsSyncing(false), 800);
  }
  
  const handleRestoreBackup = () => {
      saveData('clients', INITIAL_DATA);
      saveData('contracts', INITIAL_CONTRACTS);
      alert("Dados restaurados com sucesso!");
  };

  // Handlers for Clients
  const handleClientCreate = (data: ClientRecord) => {
    const newRecord = { ...data, id: Math.random().toString(36).substr(2, 9) };
    saveData('clients', [newRecord, ...records]);
    setIsModalOpen(false);
  };
  const handleClientUpdate = (data: ClientRecord) => {
    const updated = records.map(r => r.id === data.id ? data : r);
    saveData('clients', updated);
    setIsModalOpen(false);
  };
  const handleClientDelete = (id: string) => {
    if (confirm('Excluir cliente?')) {
        saveData('clients', records.filter(r => r.id !== id));
    }
  };
  const toggleDailyAttention = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = records.map(r => r.id === id ? { ...r, isDailyAttention: !r.isDailyAttention } : r);
      saveData('clients', updated);
  }

  // Handlers for Contracts
  const handleContractCreate = (data: ContractRecord) => {
      const newRec = { ...data, id: Math.random().toString(36).substr(2, 9) };
      saveData('contracts', [newRec, ...contracts]);
      setIsContractModalOpen(false);
  }
  const handleContractUpdate = (data: ContractRecord) => {
      const updated = contracts.map(c => c.id === data.id ? data : c);
      saveData('contracts', updated);
      setIsContractModalOpen(false);
  }
  const handleContractDelete = (id: string) => {
      if (confirm('Excluir contrato e histórico financeiro?')) {
          saveData('contracts', contracts.filter(c => c.id !== id));
      }
  }

  // Sorting and Filtering Logic
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getFilteredData = () => {
      const lowerSearch = searchTerm.toLowerCase();
      
      if (currentView === 'clients') {
          return records.filter(r => 
            (r.name && r.name.toLowerCase().includes(lowerSearch)) ||
            (r.cpf && r.cpf.includes(lowerSearch))
          ).sort((a, b) => {
              if (a.isDailyAttention !== b.isDailyAttention) return a.isDailyAttention ? -1 : 1;
              if (sortConfig) {
                  const aVal = (a as any)[sortConfig.key] || '';
                  const bVal = (b as any)[sortConfig.key] || '';
                  if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                  if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
              }
              return a.name.localeCompare(b.name);
          });
      } else {
          return contracts.filter(c => 
            (c.firstName.toLowerCase().includes(lowerSearch)) ||
            (c.lastName.toLowerCase().includes(lowerSearch)) ||
            (c.cpf.includes(lowerSearch))
          ).sort((a, b) => {
             // Contracts sort logic
             if (sortConfig) {
                  const aVal = (a as any)[sortConfig.key] || '';
                  const bVal = (b as any)[sortConfig.key] || '';
                  if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                  if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
             }
             return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Default new first
          });
      }
  }

  const filteredList = getFilteredData();
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedList = filteredList.slice(startIndex, startIndex + itemsPerPage);

  // Render Helpers
  const renderSortIcon = (columnKey: string) => {
     if (sortConfig?.key !== columnKey) return null;
     return sortConfig.direction === 'ascending' ? <ChevronUpIcon className="w-3 h-3 ml-1 inline" /> : <ChevronDownIcon className="w-3 h-3 ml-1 inline" />;
  };

  const ThSortable = ({ label, columnKey, align = "left" }: { label: string, columnKey: string, align?: "left"|"center"|"right" }) => (
      <th 
        className={`px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none text-xs uppercase tracking-wider text-${align}`}
        onClick={() => requestSort(columnKey)}
      >
        <div className={`flex items-center ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"}`}>
            {label}
            {renderSortIcon(columnKey)}
        </div>
      </th>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-200 overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-20 lg:w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 transition-all duration-300 z-40">
           <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
               <div className="bg-gradient-to-br from-primary-500 to-indigo-600 p-1.5 rounded-lg mr-0 lg:mr-3 shadow-lg shadow-indigo-500/30">
                   <ScaleIcon className="h-6 w-6 text-white" />
               </div>
               <span className="font-bold text-lg hidden lg:block tracking-tight">Gestão INSS</span>
           </div>

           <div className="flex-1 py-6 px-3 space-y-2">
               <button 
                   onClick={() => setCurrentView('clients')}
                   className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${currentView === 'clients' ? 'bg-primary-600 shadow-lg shadow-primary-500/30' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
               >
                   <UserGroupIcon className="h-6 w-6 lg:mr-3" />
                   <span className="hidden lg:block font-medium">Processos</span>
               </button>

               <button 
                   onClick={() => setCurrentView('contracts')}
                   className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${currentView === 'contracts' ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
               >
                   <BriefcaseIcon className="h-6 w-6 lg:mr-3" />
                   <span className="hidden lg:block font-medium">Contratos & Fin.</span>
               </button>
           </div>
           
           <div className="p-4 border-t border-slate-800">
               <div className="flex items-center justify-center lg:justify-start gap-3">
                   <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                       {user.firstName[0]}
                   </div>
                   <div className="hidden lg:block">
                       <p className="text-xs font-bold text-white">{user.firstName}</p>
                       <p className="text-[10px] text-slate-400">{user.role}</p>
                   </div>
               </div>
               <button onClick={onLogout} className="mt-4 w-full flex items-center justify-center lg:justify-start p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition">
                   <ArrowRightOnRectangleIcon className="h-5 w-5 lg:mr-2" />
                   <span className="hidden lg:block text-xs font-bold uppercase">Sair</span>
               </button>
           </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Navbar (Top) */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-6 z-30">
             <div className="flex items-center gap-4">
                 <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                     {currentView === 'clients' ? 'Painel de Processos' : 'Gestão de Contratos'}
                 </h2>
                 {isSyncing ? (
                      <span className="text-xs text-blue-500 flex items-center gap-1"><ArrowPathRoundedSquareIcon className="h-3 w-3 animate-spin" /> Salvando...</span>
                 ) : isCloudConfigured ? (
                     <span className="text-xs text-green-500 flex items-center gap-1 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full border border-green-100 dark:border-green-800"><CloudIcon className="h-3 w-3" /> Online</span>
                 ) : (
                     <span className="text-xs text-slate-400 flex items-center gap-1">Local</span>
                 )}
             </div>

             <div className="flex items-center gap-3">
                 <button onClick={() => setIsNotificationsOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg relative">
                     <BellIcon className="h-5 w-5" />
                     {activeAlerts.length > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-slate-900"></span>}
                 </button>
                 <button onClick={onOpenSettings} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                     <Cog6ToothIcon className={`h-5 w-5 ${isCloudConfigured ? 'text-primary-500' : ''}`} />
                 </button>
                 <button onClick={toggleDarkMode} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                     {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                 </button>
             </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
             
             {/* CONTENT SWITCHER */}
             {currentView === 'clients' ? (
                 <>
                    <StatsCards records={records} />
                    
                    {/* Action Bar Clients */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="relative w-full md:w-[400px] group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                            </div>
                            <input
                            type="text"
                            placeholder="Buscar cliente por nome ou CPF..."
                            className="pl-11 pr-4 py-3 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none shadow-sm transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => { setCurrentRecord(null); setIsModalOpen(true); }}
                            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-primary-500/25 flex items-center gap-2"
                        >
                            <PlusIcon className="h-5 w-5" />
                            Novo Processo
                        </button>
                    </div>

                    {/* Clients Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-slate-800/80">
                                    <tr>
                                        <th className="px-4 py-3.5 text-center w-14 font-bold text-slate-600 dark:text-slate-400">★</th>
                                        <ThSortable label="Nome" columnKey="name" />
                                        <ThSortable label="CPF" columnKey="cpf" />
                                        <th className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300">Senha</th>
                                        <ThSortable label="Tipo" columnKey="type" />
                                        <ThSortable label="DER" columnKey="der" />
                                        <ThSortable label="P. Médica" columnKey="medExpertiseDate" />
                                        <ThSortable label="P. Social" columnKey="socialExpertiseDate" />
                                        <ThSortable label="Prorrog." columnKey="extensionDate" />
                                        <ThSortable label="DCB" columnKey="dcbDate" />
                                        <ThSortable label="90 Dias" columnKey="ninetyDaysDate" />
                                        <ThSortable label="Mandado" columnKey="securityMandateDate" />
                                        <th className="px-4 py-3.5 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {paginatedList.map((record: any) => {
                                        const isPriority = record.isDailyAttention;
                                        const rowClass = isPriority 
                                            ? 'bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20' 
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50';
                                        return (
                                            <tr key={record.id} className={`${rowClass} transition-colors`}>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={(e) => toggleDailyAttention(record.id, e)}>
                                                        {isPriority ? <StarIconSolid className="h-5 w-5 text-yellow-400" /> : <StarIcon className="h-5 w-5 text-slate-300 hover:text-yellow-400" />}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 font-semibold dark:text-slate-200">{record.name}</td>
                                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{record.cpf}</td>
                                                <td className="px-4 py-3"><span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{record.password}</span></td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${!record.type ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'}`}>{record.type || 'N/D'}</span>
                                                </td>
                                                <td className="px-4 py-3 dark:text-slate-400">{record.der || '-'}</td>
                                                <td className={`px-4 py-3 ${isUrgentDate(record.medExpertiseDate) ? 'text-orange-600 font-bold' : 'dark:text-slate-400'}`}>{record.medExpertiseDate || '-'}</td>
                                                <td className={`px-4 py-3 ${isUrgentDate(record.socialExpertiseDate) ? 'text-orange-600 font-bold' : 'dark:text-slate-400'}`}>{record.socialExpertiseDate || '-'}</td>
                                                <td className={`px-4 py-3 ${isUrgentDate(record.extensionDate) ? 'text-orange-600 font-bold' : 'dark:text-slate-400'}`}>{record.extensionDate || '-'}</td>
                                                <td className="px-4 py-3 dark:text-slate-400">{record.dcbDate || '-'}</td>
                                                <td className="px-4 py-3 text-xs italic text-slate-400">{record.ninetyDaysDate || '-'}</td>
                                                <td className={`px-4 py-3 ${isUrgentDate(record.securityMandateDate) ? 'text-orange-600 font-bold' : 'dark:text-slate-400'}`}>{record.securityMandateDate || '-'}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => { setCurrentRecord(record); setIsModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><PencilSquareIcon className="h-4 w-4" /></button>
                                                        <button onClick={() => handleClientDelete(record.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><TrashIcon className="h-4 w-4" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                 </>
             ) : (
                 <>
                    <FinancialStats contracts={contracts} />

                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="relative w-full md:w-[400px] group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar contrato por nome ou CPF..."
                                className="pl-11 pr-4 py-3 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => { setCurrentContract(null); setIsContractModalOpen(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center gap-2"
                        >
                            <PlusIcon className="h-5 w-5" />
                            Novo Contrato
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-slate-800/80">
                                    <tr>
                                        <ThSortable label="Cliente" columnKey="firstName" />
                                        <ThSortable label="Serviço" columnKey="serviceType" />
                                        <ThSortable label="Responsável" columnKey="lawyer" />
                                        <ThSortable label="Valor Total" columnKey="totalFee" />
                                        <th className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300">Pagamento</th>
                                        <ThSortable label="Status" columnKey="status" />
                                        <th className="px-4 py-3.5 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {paginatedList.map((contract: any) => {
                                        const totalPaid = (contract.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
                                        const totalFee = Number(contract.totalFee) || 0;
                                        const percentPaid = totalFee > 0 ? (totalPaid / totalFee) * 100 : 0;
                                        
                                        return (
                                            <tr key={contract.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold dark:text-slate-200">{contract.firstName} {contract.lastName}</div>
                                                    <div className="text-xs text-slate-400 font-mono">{contract.cpf}</div>
                                                </td>
                                                <td className="px-4 py-3 dark:text-slate-300">{contract.serviceType}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${contract.lawyer === 'Michel' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20' : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20'}`}>
                                                        {contract.lawyer === 'Michel' ? '👨‍⚖️ Dr. Michel' : '👩‍⚖️ Dra. Luana'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-mono font-bold dark:text-slate-200">{formatCurrency(totalFee)}</td>
                                                <td className="px-4 py-3 w-48">
                                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-1">
                                                        <div className={`h-2 rounded-full ${percentPaid >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(percentPaid, 100)}%` }}></div>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex justify-between">
                                                        <span>Pago: {formatCurrency(totalPaid)}</span>
                                                        <span>{Math.round(percentPaid)}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                     <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border 
                                                        ${contract.status === 'Concluído' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400' : 
                                                          contract.status === 'Em Andamento' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400' : 
                                                          'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                         {contract.status}
                                                     </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => { setCurrentContract(contract); setIsContractModalOpen(true); }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"><PencilSquareIcon className="h-4 w-4" /></button>
                                                        <button onClick={() => handleContractDelete(contract.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><TrashIcon className="h-4 w-4" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                 </>
             )}
        </main>

        <RecordModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={currentRecord ? handleClientUpdate : handleClientCreate}
            initialData={currentRecord}
        />

        <ContractModal 
            isOpen={isContractModalOpen}
            onClose={() => setIsContractModalOpen(false)}
            onSave={currentContract ? handleContractUpdate : handleContractCreate}
            initialData={currentContract}
        />
        
        <NotificationsModal 
            isOpen={isNotificationsOpen} 
            onClose={() => setIsNotificationsOpen(false)} 
            notifications={activeAlerts} 
        />
        
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={onCloseSettings} 
            onSave={onSettingsSaved}
            onRestoreBackup={handleRestoreBackup}
        />
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCloudConfigured, setIsCloudConfigured] = useState(false);

  useEffect(() => {
    // Check local storage for dark mode preference
    const isDark = localStorage.getItem('inss_theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);
  
  const checkCloudStatus = () => {
      const config = getDbConfig();
      setIsCloudConfigured(!!(config && config.url && config.key));
  };

  useEffect(() => {
      checkCloudStatus();
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('inss_theme', newMode ? 'dark' : 'light');
    
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogin = (authenticatedUser: User) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleSettingsSave = () => {
      checkCloudStatus();
  };
  
  const handleAppRestoreBackup = async () => {
      localStorage.setItem('inss_records', JSON.stringify(INITIAL_DATA));
      const supabase = initSupabase();
      if (supabase) {
          await supabase.from('clients').upsert({ id: 1, data: INITIAL_DATA });
      }
      alert("Dados restaurados com sucesso a partir do backup do sistema!");
  };

  return (
    <>
      {user ? (
        <Dashboard 
            user={user} 
            onLogout={handleLogout} 
            darkMode={darkMode} 
            toggleDarkMode={toggleDarkMode}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isCloudConfigured={isCloudConfigured}
            isSettingsOpen={isSettingsOpen}
            onCloseSettings={() => setIsSettingsOpen(false)}
            onSettingsSaved={handleSettingsSave}
        />
      ) : (
        <>
            <Login 
                onLogin={handleLogin} 
                onOpenSettings={() => setIsSettingsOpen(true)}
                isCloudConfigured={isCloudConfigured}
            />
            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                onSave={handleSettingsSave}
                onRestoreBackup={handleAppRestoreBackup}
            />
        </>
      )}
    </>
  );
}
