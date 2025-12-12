import React, { useState, useEffect, useMemo } from 'react';
import { User, AUTHORIZED_USERS, ClientRecord, UserRole } from './types';
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
  SignalSlashIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

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
  
  return diffDays >= 0 && diffDays <= 7;
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
// Estas chaves garantem a conexão automática para todos os usuários.
const GLOBAL_SUPABASE_URL = "https://nnhatyvrtlbkyfadumqo.supabase.co";
const GLOBAL_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaGF0eXZydGxia3lmYWR1bXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mzk1NDYsImV4cCI6MjA4MTExNTU0Nn0.F_020GSnZ_jQiSSPFfAxY9Q8dU6FmjUDixOeZl4YHDg";

// Helper to safely attempt getting Env Vars (Supports Next.js, Create React App, and Vite)
const getEnvVar = (key: string): string | undefined => {
    try {
        // 1. Try Vite / Modern Browsers
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
             // @ts-ignore
            return import.meta.env[key];
        }
        // 2. Try Node / Next.js / CRA
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            // @ts-ignore
            return process.env[key];
        }
    } catch (e) {}
    return undefined;
};

const getDbConfig = () => {
    // 1. Try LocalStorage (Manual Override takes precedence if explicitly set by user)
    const stored = localStorage.getItem(DB_CONFIG_KEY);
    if (stored) return JSON.parse(stored);

    // 2. Try Environment Variables (Vercel Integration)
    const envUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL');
    const envKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY');

    if (envUrl && envKey) {
        return { url: envUrl, key: envKey, isEnv: true };
    }

    // 3. Fallback to Hardcoded Global Config (Guarantees connection for everyone)
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
const SettingsModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: () => void }) => {
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

// 2. Modal Component
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

// 4. Dashboard Component
interface DashboardProps {
  user: User;
  onLogout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onOpenSettings: () => void;
  isCloudConfigured: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, darkMode, toggleDarkMode, onOpenSettings, isCloudConfigured }) => {
  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ClientRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof ClientRecord; direction: 'ascending' | 'descending' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // --- Data Fetching Logic ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
        const supabase = initSupabase();
        
        if (supabase) {
            // Cloud Fetch
            const { data, error } = await supabase.from('clients').select('data').limit(1).single();
            if (error && error.code !== 'PGRST116') { // Ignore 'row not found'
                console.error("Erro ao buscar dados na nuvem", error);
                // Fallback to local if fetch fails
                const storedData = localStorage.getItem('inss_records');
                setRecords(storedData ? JSON.parse(storedData) : INITIAL_DATA);
            } else if (data && data.data) {
                setRecords(data.data);
                // Update local storage as cache
                localStorage.setItem('inss_records', JSON.stringify(data.data));
            } else {
                // First time cloud setup, use initial data
                const storedData = localStorage.getItem('inss_records');
                setRecords(storedData ? JSON.parse(storedData) : INITIAL_DATA);
            }
        } else {
            // Local Fetch
            const storedData = localStorage.getItem('inss_records');
            if (storedData) {
                setRecords(JSON.parse(storedData));
            } else {
                setRecords(INITIAL_DATA);
                localStorage.setItem('inss_records', JSON.stringify(INITIAL_DATA));
            }
        }
    } catch (e) {
        console.error("Erro geral", e);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isCloudConfigured]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const saveRecords = async (newRecords: ClientRecord[]) => {
    setIsSyncing(true);
    setRecords(newRecords);
    
    // Always save local first for instant UI feedback
    localStorage.setItem('inss_records', JSON.stringify(newRecords));

    // Try cloud save
    const supabase = initSupabase();
    if (supabase) {
        // We store the entire JSON blob in a single row for simplicity in this no-backend demo
        // Table 'clients' must have columns: id (primary key), data (jsonb)
        // We use ID 1 as the singleton record container
        const { error } = await supabase.from('clients').upsert({ id: 1, data: newRecords });
        if (error) {
            console.error("Falha ao salvar na nuvem:", error);
            alert("Atenção: Dados salvos localmente, mas houve erro na sincronização com a nuvem.");
        }
    }
    
    setTimeout(() => setIsSyncing(false), 500);
  };

  const handleCreate = (data: ClientRecord) => {
    const newRecord = { ...data, id: Math.random().toString(36).substr(2, 9) };
    saveRecords([newRecord, ...records]);
    setIsModalOpen(false);
  };

  const handleUpdate = (data: ClientRecord) => {
    const updatedRecords = records.map(r => r.id === data.id ? data : r);
    saveRecords(updatedRecords);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      const filtered = records.filter(r => r.id !== id);
      saveRecords(filtered);
    }
  };
  
  const toggleDailyAttention = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updatedRecords = records.map(r => {
          if (r.id === id) {
              return { ...r, isDailyAttention: !r.isDailyAttention };
          }
          return r;
      });
      saveRecords(updatedRecords);
  }

  const openNewModal = () => {
    setCurrentRecord(null);
    setIsModalOpen(true);
  };

  const openEditModal = (record: ClientRecord) => {
    setCurrentRecord(record);
    setIsModalOpen(true);
  };

  const requestSort = (key: keyof ClientRecord) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const filteredRecords = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    const filtered = records.filter(r => 
      (r.name && r.name.toLowerCase().includes(lowerSearch)) ||
      (r.cpf && r.cpf.includes(lowerSearch))
    );
    
    return filtered.sort((a, b) => {
        if (a.isDailyAttention !== b.isDailyAttention) {
             return a.isDailyAttention ? -1 : 1;
        }
        if (sortConfig) {
             const aValue = a[sortConfig.key] || '';
             const bValue = b[sortConfig.key] || '';
             if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
             if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
             return 0;
        }
        return a.name.localeCompare(b.name);
    });
  }, [records, searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const renderSortIcon = (columnKey: keyof ClientRecord) => {
     if (sortConfig?.key !== columnKey) return null;
     return sortConfig.direction === 'ascending' ? <ChevronUpIcon className="w-3 h-3 ml-1 inline" /> : <ChevronDownIcon className="w-3 h-3 ml-1 inline" />;
  };

  const ThSortable = ({ label, columnKey, align = "left" }: { label: string, columnKey: keyof ClientRecord, align?: "left"|"center"|"right" }) => (
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
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-200 overflow-hidden font-sans">
      {/* Navbar */}
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex-none z-30">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white p-2 rounded-lg shadow-lg shadow-primary-500/20">
                <ScaleIcon className="h-6 w-6" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Gestão INSS</h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-wide uppercase flex items-center gap-2">
                    Painel Administrativo
                    {isLoading || isSyncing ? (
                         <ArrowPathIcon className="h-3 w-3 animate-spin text-primary-500" />
                    ) : isCloudConfigured ? (
                        <span className="text-green-500 flex items-center gap-1"><CloudIcon className="h-3 w-3" /> Online</span>
                    ) : (
                        <span className="text-slate-400 flex items-center gap-1">Local (Offline)</span>
                    )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onOpenSettings} className="p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition" title="Configurações">
                 <Cog6ToothIcon className={`h-5 w-5 ${isCloudConfigured ? 'text-primary-500' : ''}`} />
              </button>

              <button 
                onClick={toggleDarkMode}
                className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95"
              >
                  {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
              </button>

              <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>

              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 py-1.5 px-3 rounded-full border border-slate-200 dark:border-slate-700">
                 <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm">
                    {user.firstName[0]}{user.lastName[0]}
                 </div>
                 <div className="hidden md:flex flex-col">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-none">{user.firstName} {user.lastName}</span>
                    <span className="text-[10px] text-primary-600 dark:text-primary-400 font-medium">{user.role}</span>
                 </div>
              </div>

              <button
                onClick={onLogout}
                className="ml-2 p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-xl transition-all active:scale-95"
                title="Sair"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col max-w-[1920px] w-full mx-auto p-4 sm:p-6 overflow-hidden">
        
        {/* Stats Summary */}
        <StatsCards records={records} />

        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 flex-none">
          <div className="relative w-full md:w-[400px] group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Buscar cliente por nome ou CPF..."
              className="pl-11 pr-4 py-3 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
             <button
                onClick={fetchData}
                className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary-600 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                title="Atualizar Dados"
              >
                <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={openNewModal}
                className="flex-1 md:flex-none bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all transform active:scale-95 flex items-center justify-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                Novo Cadastro
              </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="sticky top-0 z-20">
                    <tr>
                    <th className="px-4 py-3.5 bg-slate-100 dark:bg-slate-800/80 text-center w-14 font-bold text-slate-600 dark:text-slate-400 text-xs border-r border-slate-200 dark:border-slate-700">★</th>
                    <ThSortable label="Nome do Cliente" columnKey="name" />
                    <ThSortable label="CPF" columnKey="cpf" />
                    <th className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 text-xs uppercase">Senha</th>
                    <ThSortable label="Tipo" columnKey="type" />
                    <ThSortable label="DER" columnKey="der" />
                    <ThSortable label="P. Médica" columnKey="medExpertiseDate" />
                    <ThSortable label="P. Social" columnKey="socialExpertiseDate" />
                    <ThSortable label="Prorrog." columnKey="extensionDate" />
                    <ThSortable label="DCB" columnKey="dcbDate" />
                    <ThSortable label="90 Dias" columnKey="ninetyDaysDate" />
                    <ThSortable label="Mand. Seg." columnKey="securityMandateDate" />
                    <th className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 text-right text-xs uppercase sticky right-0 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)]">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedRecords.length > 0 ? (
                    paginatedRecords.map((record) => {
                        const isPriority = record.isDailyAttention;
                        const rowClass = isPriority 
                            ? 'bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50';
                        
                        return (
                        <tr key={record.id} className={`${rowClass} transition-colors duration-150 group`}>
                        <td className="px-4 py-3 text-center border-r border-slate-100 dark:border-slate-800/50">
                            <button onClick={(e) => toggleDailyAttention(record.id, e)} className="focus:outline-none transition-transform active:scale-90">
                                {isPriority ? (
                                    <StarIconSolid className="h-5 w-5 text-yellow-400 drop-shadow-sm" />
                                ) : (
                                    <StarIcon className="h-5 w-5 text-slate-300 hover:text-yellow-400 transition-colors" />
                                )}
                            </button>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{record.name}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs tracking-tight">{record.cpf}</td>
                        <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md px-2 py-1 select-all border border-slate-200 dark:border-slate-700">
                                {record.password}
                            </span>
                        </td>
                        <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide border ${
                            !record.type ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' :
                            record.type.toLowerCase().includes('bpc') ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800' :
                            record.type.toLowerCase().includes('aux') ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800' :
                            record.type.toLowerCase().includes('apo') ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800' :
                            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                            }`}>
                            {record.type || 'N/D'}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-sm">{record.der || '-'}</td>
                        
                        <td className={`px-4 py-3 text-sm ${isUrgentDate(record.medExpertiseDate) ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                            {isUrgentDate(record.medExpertiseDate) && <ExclamationTriangleIcon className="h-4 w-4 inline mr-1 mb-0.5 animate-pulse" />}
                            {record.medExpertiseDate || '-'}
                        </td>
                        
                        <td className={`px-4 py-3 text-sm ${isUrgentDate(record.socialExpertiseDate) ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                            {isUrgentDate(record.socialExpertiseDate) && <ExclamationTriangleIcon className="h-4 w-4 inline mr-1 mb-0.5 animate-pulse" />}
                            {record.socialExpertiseDate || '-'}
                        </td>

                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-sm">{record.extensionDate || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-sm">{record.dcbDate || '-'}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-500 text-xs italic">{record.ninetyDaysDate || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-sm">{record.securityMandateDate || '-'}</td>
                        
                        <td className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 transition-colors shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center justify-end gap-1">
                            <button 
                                onClick={() => openEditModal(record)}
                                className="p-1.5 text-blue-600 hover:text-white hover:bg-blue-600 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white transition rounded-lg"
                                title="Editar"
                            >
                                <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button 
                                onClick={() => handleDelete(record.id)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-red-500 dark:text-slate-500 dark:hover:bg-red-500 dark:hover:text-white transition rounded-lg"
                                title="Excluir"
                            >
                                <TrashIcon className="h-4 w-4" />
                            </button>
                            </div>
                        </td>
                        </tr>
                    )})
                    ) : (
                    <tr>
                        <td colSpan={13} className="px-6 py-24 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                <MagnifyingGlassIcon className="h-12 w-12 mb-3 opacity-20" />
                                <p className="text-lg font-medium">Nenhum registro encontrado</p>
                                <p className="text-sm">Tente buscar por outro nome ou CPF</p>
                            </div>
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between flex-none">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Exibir</span>
                        <select 
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            className="border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer shadow-sm"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400 border-l border-slate-300 dark:border-slate-700 pl-4">
                        Total: <span className="font-bold text-slate-700 dark:text-slate-200">{filteredRecords.length}</span> registros
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                        Página <span className="font-semibold text-slate-900 dark:text-white">{currentPage}</span> de {totalPages || 1}
                    </span>
                    <div className="flex gap-1">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            <ChevronLeftIcon className="h-5 w-5" />
                        </button>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            <ChevronRightIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </main>

      <RecordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={currentRecord ? handleUpdate : handleCreate}
        initialData={currentRecord}
      />
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
        />
      ) : (
        <Login 
            onLogin={handleLogin} 
            onOpenSettings={() => setIsSettingsOpen(true)}
            isCloudConfigured={isCloudConfigured}
        />
      )}
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={handleSettingsSave}
      />
    </>
  );
}