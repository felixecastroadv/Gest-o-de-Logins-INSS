import React, { useState, useEffect, useMemo } from 'react';
import { 
  ScaleIcon, UserGroupIcon, BriefcaseIcon, CalculatorIcon, ArrowRightOnRectangleIcon, 
  ArrowPathRoundedSquareIcon, CloudIcon, BellIcon, Cog6ToothIcon, SunIcon, MoonIcon,
  ArchiveBoxIcon, MagnifyingGlassIcon, PlusIcon, StarIcon, ArrowUturnLeftIcon, 
  PencilSquareIcon, TrashIcon, ExclamationTriangleIcon, ChevronUpIcon, ChevronDownIcon, 
  ChevronLeftIcon, ChevronRightIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { DashboardProps, ClientRecord, ContractRecord, NotificationItem } from '../types';
import { INITIAL_DATA, INITIAL_CONTRACTS_LIST } from '../data';
import LaborCalc, { CalculationRecord } from '../LaborCalc';
import SocialSecurityCalc from '../SocialSecurityCalc';
import { initSupabase } from '../supabaseClient';
import { isUrgentDate, formatCurrency } from '../utils';
import StatsCards from './StatsCards';
import FinancialStats from './FinancialStats';
import RecordModal from './RecordModal';
import ContractModal from './ContractModal';
import SettingsModal from './SettingsModal';
import NotificationsModal from './NotificationsModal';
import CopyButton from './CopyButton';

const Dashboard: React.FC<DashboardProps> = ({ 
  user, 
  onLogout, 
  darkMode, 
  toggleDarkMode, 
  onOpenSettings, 
  isCloudConfigured,
  isSettingsOpen,
  onCloseSettings,
  onSettingsSaved,
  onRestoreBackup
}) => {
  const [currentView, setCurrentView] = useState<'clients' | 'contracts' | 'labor_calc' | 'social_calc'>('clients');
  const [showArchived, setShowArchived] = useState(false);

  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [savedCalculations, setSavedCalculations] = useState<CalculationRecord[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ClientRecord | null>(null);
  
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [currentContract, setCurrentContract] = useState<ContractRecord | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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
        let fetchedContracts = INITIAL_CONTRACTS_LIST;
        let fetchedCalculations: CalculationRecord[] = [];

        if (supabase) {
            // Cloud Fetch - Clients (ID 1)
            const { data: clientData } = await supabase
                .from('clients')
                .select('data')
                .eq('id', 1)
                .single();
                
            if (clientData && clientData.data) {
                fetchedClients = clientData.data;
                localStorage.setItem('inss_records', JSON.stringify(clientData.data));
            }

            // Cloud Fetch - Contracts (ID 2)
            const { data: contractData, error: contractError } = await supabase
                .from('clients')
                .select('data')
                .eq('id', 2)
                .single();

            if (contractData && contractData.data) {
                fetchedContracts = contractData.data;
                localStorage.setItem('inss_contracts', JSON.stringify(contractData.data));
            } else if (contractError && contractError.code === 'PGRST116') {
                 await supabase.from('clients').upsert({ id: 2, data: INITIAL_CONTRACTS_LIST });
            }

            // Cloud Fetch - Calculations (ID 3)
            const { data: calcData, error: calcError } = await supabase
                .from('clients')
                .select('data')
                .eq('id', 3)
                .single();

            if (calcData && calcData.data) {
                fetchedCalculations = calcData.data;
                localStorage.setItem('inss_calculations', JSON.stringify(calcData.data));
            } else if (calcError && calcError.code === 'PGRST116') {
                 await supabase.from('clients').upsert({ id: 3, data: [] });
            }

        } else {
             // Local Fallback
             const localClients = localStorage.getItem('inss_records');
             if (localClients) fetchedClients = JSON.parse(localClients);

             const localContracts = localStorage.getItem('inss_contracts');
             if (localContracts) fetchedContracts = JSON.parse(localContracts);

             const localCalculations = localStorage.getItem('inss_calculations');
             if (localCalculations) fetchedCalculations = JSON.parse(localCalculations);
        }

        setRecords(fetchedClients);
        setContracts(fetchedContracts);
        setSavedCalculations(fetchedCalculations);

    } catch (e) {
        console.error("Erro geral", e);
        setDbError("Erro de conexão local/nuvem.");
    } finally {
        setIsLoading(false);
    }
  };

  // Setup Realtime Subscription
  useEffect(() => {
    fetchData();

    const supabase = initSupabase();
    if (supabase) {
        const channel = supabase.channel('db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'clients'
                },
                (payload: any) => {
                     if (payload.new && payload.new.data) {
                         if (payload.new.id === 1) {
                             setRecords(payload.new.data);
                             localStorage.setItem('inss_records', JSON.stringify(payload.new.data));
                         } else if (payload.new.id === 2) {
                             setContracts(payload.new.data);
                             localStorage.setItem('inss_contracts', JSON.stringify(payload.new.data));
                         } else if (payload.new.id === 3) {
                             setSavedCalculations(payload.new.data);
                             localStorage.setItem('inss_calculations', JSON.stringify(payload.new.data));
                         }
                     }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, [isCloudConfigured]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, currentView, showArchived]);

  // Compute Alerts
  const activeAlerts = useMemo(() => {
      const alerts: NotificationItem[] = [];
      records.forEach(r => {
          if (r.isArchived) return; // Ignorar arquivados
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
  const saveData = async (type: 'clients' | 'contracts' | 'calculations', newData: any[]) => {
      setIsSyncing(true);
      setSaveError(null);
      const supabase = initSupabase();

      try {
          if (type === 'clients') {
              setRecords(newData);
              localStorage.setItem('inss_records', JSON.stringify(newData));
              if (supabase) {
                  const { error } = await supabase.from('clients').upsert({ id: 1, data: newData });
                  if (error) throw error;
              }
          } else if (type === 'contracts') {
              setContracts(newData);
              localStorage.setItem('inss_contracts', JSON.stringify(newData));
              if (supabase) {
                  const { error } = await supabase.from('clients').upsert({ id: 2, data: newData });
                  if (error) throw error;
              }
          } else if (type === 'calculations') {
              setSavedCalculations(newData);
              localStorage.setItem('inss_calculations', JSON.stringify(newData));
              if (supabase) {
                  const { error } = await supabase.from('clients').upsert({ id: 3, data: newData });
                  if (error) throw error;
              }
          }
      } catch (err: any) {
          console.error("Erro ao salvar na nuvem:", err);
          setSaveError("Erro ao sincronizar com o banco de dados. Dados salvos apenas localmente.");
      } finally {
          setTimeout(() => setIsSyncing(false), 800);
      }
  }
  
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

  const handleSaveClient = (data: ClientRecord) => {
    if (currentRecord) {
        handleClientUpdate(data);
    } else {
        handleClientCreate(data);
    }
  };

  const handleClientDelete = (id: string) => {
    if (confirm('Excluir cliente permanentemente?')) {
        saveData('clients', records.filter(r => r.id !== id));
    }
  };
  const handleToggleArchive = (id: string) => {
      const record = records.find(r => r.id === id);
      if (!record) return;
      const newValue = !record.isArchived;
      const action = newValue ? 'arquivar' : 'restaurar';
      
      if (confirm(`Deseja realmente ${action} este cliente?`)) {
          const updated = records.map(r => r.id === id ? { ...r, isArchived: newValue } : r);
          saveData('clients', updated);
      }
  }

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

  const handleSaveContract = (data: ContractRecord) => {
    if (currentContract) {
        handleContractUpdate(data);
    } else {
        handleContractCreate(data);
    }
  };

  const handleContractDelete = (id: string) => {
      if (confirm('Excluir contrato e histórico financeiro?')) {
          saveData('contracts', contracts.filter(c => c.id !== id));
      }
  }

  // Handlers for Calculations
  const handleSaveCalculation = (calc: CalculationRecord) => {
      const exists = savedCalculations.find(c => c.id === calc.id);
      let updated;
      if (exists) {
          updated = savedCalculations.map(c => c.id === calc.id ? calc : c);
      } else {
          updated = [calc, ...savedCalculations];
      }
      saveData('calculations', updated);
  };

  const handleDeleteCalculation = (id: string) => {
      if (confirm('Excluir este cálculo salvo?')) {
          saveData('calculations', savedCalculations.filter(c => c.id !== id));
      }
  };

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
            ((r.name && r.name.toLowerCase().includes(lowerSearch)) ||
            (r.cpf && r.cpf.includes(lowerSearch))) &&
            (showArchived ? r.isArchived : !r.isArchived)
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

  // Helper for Date Cells with Alerts
  const renderDateCell = (dateStr: string) => {
      const urgent = isUrgentDate(dateStr);
      return (
          <td className="px-4 py-3">
              <div className={`flex items-center gap-1.5 ${urgent ? 'text-red-600 dark:text-red-400 font-bold' : 'dark:text-slate-400'}`}>
                  {urgent && <ExclamationTriangleIcon className="h-4 w-4 animate-pulse" />}
                  {dateStr || '-'}
              </div>
          </td>
      );
  };

  const PaginationControls = () => (
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Linhas por página:</span>
              <select 
                  value={itemsPerPage} 
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold py-1.5 px-2 outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
              </select>
          </div>
          
          <div className="flex items-center gap-2">
              <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                  <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Página {currentPage} de {totalPages || 1}
              </span>
              <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                  <ChevronRightIcon className="h-4 w-4" />
              </button>
          </div>
      </div>
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

                {/* NOVO MENU: CÁLCULOS */}
               <button 
                   onClick={() => setCurrentView('labor_calc')}
                   className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${currentView === 'labor_calc' ? 'bg-emerald-600 shadow-lg shadow-emerald-500/30' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
               >
                   <CalculatorIcon className="h-6 w-6 lg:mr-3" />
                   <span className="hidden lg:block font-medium">Calc. Trabalhista</span>
               </button>

               <button 
                   onClick={() => setCurrentView('social_calc')}
                   className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${currentView === 'social_calc' ? 'bg-orange-600 shadow-lg shadow-orange-500/30' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
               >
                   <CalculatorIcon className="h-6 w-6 lg:mr-3" />
                   <span className="hidden lg:block font-medium">Calc. Previdenciária</span>
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
                     {currentView === 'clients' ? 'Painel de Processos' : 
                      currentView === 'contracts' ? 'Gestão de Contratos' :
                      currentView === 'labor_calc' ? 'Cálculos Trabalhistas' :
                      'Cálculos Previdenciários'}
                 </h2>
                 {isSyncing ? (
                      <span className="text-xs text-blue-500 flex items-center gap-1"><ArrowPathRoundedSquareIcon className="h-3 w-3 animate-spin" /> Salvando...</span>
                 ) : saveError ? (
                      <span className="text-xs text-red-500 flex items-center gap-1 font-bold" title={saveError}><ExclamationTriangleIcon className="h-3 w-3" /> Erro ao Salvar</span>
                 ) : isCloudConfigured ? (
                     <span className="text-xs text-green-500 flex items-center gap-1 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full border border-green-100 dark:border-green-800"><CloudIcon className="h-3 w-3" /> Online</span>
                 ) : (
                     <span className="text-xs text-slate-400 flex items-center gap-1">Local</span>
                 )}
             </div>

             <div className="flex items-center gap-3">
                 <button onClick={() => setIsNotificationsOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg relative">
                     <BellIcon className="h-5 w-5" />
                     {activeAlerts.length > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-slate-900 animate-pulse"></span>}
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
             {currentView === 'labor_calc' ? (
                 <LaborCalc 
                    clients={records} 
                    contracts={contracts} 
                    savedCalculations={savedCalculations}
                    onSaveCalculation={handleSaveCalculation}
                    onDeleteCalculation={handleDeleteCalculation}
                 />
             ) : currentView === 'social_calc' ? (
                 <SocialSecurityCalc 
                    clients={records}
                 />
             ) : currentView === 'clients' ? (
                 <>
                    {/* ... (Conteúdo de Clients Mantido - Oculto aqui para brevidade, mas o código completo está no topo) ... */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                        <div className="flex-1">
                             <StatsCards records={records.filter(r => !r.isArchived)} />
                        </div>
                    </div>
                    
                    {/* Action Bar Clients */}
                    <div className="flex flex-col gap-4 mb-6">
                         {/* Toggle Tabs */}
                         <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl w-fit">
                            <button 
                                onClick={() => setShowArchived(false)} 
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${!showArchived ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <UserGroupIcon className="h-4 w-4" />
                                Ativos
                            </button>
                            <button 
                                onClick={() => setShowArchived(true)} 
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${showArchived ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <ArchiveBoxIcon className="h-4 w-4" />
                                Arquivados
                            </button>
                         </div>

                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="relative w-full md:w-[400px] group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                </div>
                                <input
                                type="text"
                                placeholder={showArchived ? "Buscar em arquivados..." : "Buscar cliente por nome ou CPF..."}
                                className="pl-11 pr-4 py-3 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none shadow-sm transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            {!showArchived && (
                                <button
                                    onClick={() => { setCurrentRecord(null); setIsModalOpen(true); }}
                                    className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-primary-500/25 flex items-center gap-2"
                                >
                                    <PlusIcon className="h-5 w-5" />
                                    Novo Processo
                                </button>
                            )}
                        </div>
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
                                    {paginatedList.length === 0 ? (
                                        <tr>
                                            <td colSpan={13} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                                Nenhum cliente encontrado {showArchived ? 'nos arquivos' : ''}.
                                            </td>
                                        </tr>
                                    ) : paginatedList.map((record: any) => {
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
                                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span>{record.cpf}</span>
                                                        <CopyButton text={record.cpf} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{record.password}</span>
                                                        <CopyButton text={record.password} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${!record.type ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'}`}>{record.type || 'N/D'}</span>
                                                </td>
                                                <td className="px-4 py-3 dark:text-slate-400">{record.der || '-'}</td>
                                                {renderDateCell(record.medExpertiseDate)}
                                                {renderDateCell(record.socialExpertiseDate)}
                                                {renderDateCell(record.extensionDate)}
                                                {renderDateCell(record.dcbDate)}
                                                <td className="px-4 py-3 text-xs italic text-slate-400">{record.ninetyDaysDate || '-'}</td>
                                                {renderDateCell(record.securityMandateDate)}
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {!showArchived ? (
                                                            <button 
                                                                onClick={() => handleToggleArchive(record.id)} 
                                                                className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded"
                                                                title="Arquivar"
                                                            >
                                                                <ArchiveBoxIcon className="h-4 w-4" />
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={() => handleToggleArchive(record.id)} 
                                                                className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                                                title="Restaurar"
                                                            >
                                                                <ArrowUturnLeftIcon className="h-4 w-4" />
                                                            </button>
                                                        )}
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
                        <PaginationControls />
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
                        <PaginationControls />
                    </div>
                 </>
             )}
        </main>

        <RecordModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onSave={handleSaveClient}
            initialData={currentRecord}
        />
        
        <ContractModal 
            isOpen={isContractModalOpen} 
            onClose={() => setIsContractModalOpen(false)} 
            onSave={handleSaveContract}
            initialData={currentContract}
        />
        
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={onCloseSettings} 
            onSave={onSettingsSaved}
            onRestoreBackup={onRestoreBackup}
        />

        <NotificationsModal 
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            notifications={activeAlerts}
        />
      </div>
    </div>
  );
};

export default Dashboard;
