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
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

// --- Helpers ---

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  // Parts are DD, MM, YYYY
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

// Check if a date is within the next 7 days (including today)
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

// --- Components ---

// 1. Login Component
interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
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
      setError('Acesso negado. Verifique nome e sobrenome.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4 transition-colors duration-200">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <LockClosedIcon className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Acesso Restrito</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Gestão INSS - Jurídico</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="Ex: Michel"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sobrenome</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="Ex: Felix"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-4 w-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
};

// 2. Modal Component for Create/Edit
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

  // Automatic calculation logic
  useEffect(() => {
    // Whenever DER changes, try to calculate 90 days date
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
    { label: "Nome", name: "name", type: "text" },
    { label: "CPF", name: "cpf", type: "text" },
    { label: "Senha", name: "password", type: "text" },
    { label: "Tipo", name: "type", type: "text" },
    { label: "DER (DD/MM/AAAA)", name: "der", type: "text", placeholder: "01/01/2025" },
    { label: "P. Médica", name: "medExpertiseDate", type: "text" },
    { label: "P. Social", name: "socialExpertiseDate", type: "text" },
    { label: "Prorrogação", name: "extensionDate", type: "text" },
    { label: "DCB", name: "dcbDate", type: "text" },
    { label: "90 Dias (Auto)", name: "ninetyDaysDate", type: "text", readOnly: false },
    { label: "Mand. Segur.", name: "securityMandateDate", type: "text", placeholder: "Data do MS" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            {initialData ? 'Editar Registro' : 'Novo Cadastro'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.name} className={field.name === 'name' ? 'md:col-span-2' : ''}>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                {field.label}
              </label>
              <input
                type={field.type}
                name={field.name}
                value={(formData as any)[field.name] || ''}
                onChange={handleChange}
                placeholder={field.placeholder || ''}
                className={`w-full px-3 py-2 border rounded-md outline-none transition text-sm ${
                    field.name === 'ninetyDaysDate' ? 'bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white'
                } border-slate-300 dark:border-slate-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
              />
            </div>
          ))}
          
          <div className="md:col-span-2">
             <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <input 
                    type="checkbox" 
                    checked={formData.isDailyAttention || false}
                    onChange={(e) => setFormData({...formData, isDailyAttention: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Prioridade (Entrar todos os dias)
                </span>
             </label>
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition flex items-center gap-2"
            >
              <CheckIcon className="h-4 w-4" />
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. Dashboard Component
interface DashboardProps {
  user: User;
  onLogout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, darkMode, toggleDarkMode }) => {
  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ClientRecord | null>(null);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof ClientRecord; direction: 'ascending' | 'descending' } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const storedData = localStorage.getItem('inss_records');
    if (storedData) {
      setRecords(JSON.parse(storedData));
    } else {
      setRecords(INITIAL_DATA);
      localStorage.setItem('inss_records', JSON.stringify(INITIAL_DATA));
    }
  }, []);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const saveRecords = (newRecords: ClientRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem('inss_records', JSON.stringify(newRecords));
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
        // First priority: Daily Attention (Priority)
        if (a.isDailyAttention !== b.isDailyAttention) {
             return a.isDailyAttention ? -1 : 1;
        }

        // Second priority: Column Sorting
        if (sortConfig) {
             const aValue = a[sortConfig.key] || '';
             const bValue = b[sortConfig.key] || '';
             
             if (aValue < bValue) {
               return sortConfig.direction === 'ascending' ? -1 : 1;
             }
             if (aValue > bValue) {
               return sortConfig.direction === 'ascending' ? 1 : -1;
             }
             return 0;
        }

        // Default: Alphabetical by name
        return a.name.localeCompare(b.name);
    });
  }, [records, searchTerm, sortConfig]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => {
      if (currentPage > 1) setCurrentPage(p => p - 1);
  };

  const handleNextPage = () => {
      if (currentPage < totalPages) setCurrentPage(p => p + 1);
  };

  const renderSortIcon = (columnKey: keyof ClientRecord) => {
     if (sortConfig?.key !== columnKey) return null;
     return sortConfig.direction === 'ascending' ? 
       <ChevronUpIcon className="w-3 h-3 ml-1 inline" /> : 
       <ChevronDownIcon className="w-3 h-3 ml-1 inline" />;
  };

  const ThSortable = ({ label, columnKey }: { label: string, columnKey: keyof ClientRecord }) => (
      <th 
        className="px-4 py-4 font-semibold bg-slate-50 dark:bg-slate-800/95 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition select-none"
        onClick={() => requestSort(columnKey)}
      >
        <div className="flex items-center">
            {label}
            {renderSortIcon(columnKey)}
        </div>
      </th>
  );

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-900 flex flex-col transition-colors duration-200 overflow-hidden">
      {/* Navbar */}
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-none z-30 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-lg shadow-md shadow-blue-500/20">
                <LockClosedIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white hidden sm:block">Gestão INSS</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Painel Jurídico</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={toggleDarkMode}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition"
                title={darkMode ? "Modo Claro" : "Modo Escuro"}
              >
                  {darkMode ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />}
              </button>

              <div className="hidden md:flex flex-col items-end mr-2 border-r border-slate-200 dark:border-slate-700 pr-4">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{user.firstName} {user.lastName}</span>
                <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">{user.role}</span>
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-400 dark:hover:text-red-400 rounded-full transition"
                title="Sair"
              >
                <ArrowRightOnRectangleIcon className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area (Scrollable within) */}
      <main className="flex-1 flex flex-col max-w-[98%] w-full mx-auto py-4 overflow-hidden">
        
        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 flex-none">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por Nome ou CPF..."
              className="pl-10 pr-4 py-2.5 w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button
            onClick={openNewModal}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Novo Cadastro
          </button>
        </div>

        {/* Data Table Container - This handles the scroll */}
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-800 rounded-t-xl shadow-lg border-x border-t border-slate-200 dark:border-slate-700 transition-colors duration-200">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-xs sticky top-0 z-20 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-4 font-semibold text-center w-12 bg-slate-50 dark:bg-slate-800/95">★</th>
                  <ThSortable label="Nome" columnKey="name" />
                  <ThSortable label="CPF" columnKey="cpf" />
                  <th className="px-4 py-4 font-semibold bg-slate-50 dark:bg-slate-800/95">Senha</th>
                  <ThSortable label="Tipo" columnKey="type" />
                  <ThSortable label="DER" columnKey="der" />
                  <ThSortable label="P. Médica" columnKey="medExpertiseDate" />
                  <ThSortable label="P. Social" columnKey="socialExpertiseDate" />
                  <ThSortable label="Prorrogação" columnKey="extensionDate" />
                  <ThSortable label="DCB" columnKey="dcbDate" />
                  <ThSortable label="90 Dias" columnKey="ninetyDaysDate" />
                  <ThSortable label="Mand. Seg." columnKey="securityMandateDate" />
                  <th className="px-4 py-4 font-semibold text-right bg-slate-50 dark:bg-slate-800/95">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {paginatedRecords.length > 0 ? (
                  paginatedRecords.map((record) => {
                    const rowClass = record.isDailyAttention 
                        ? 'bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/30';
                    
                    const borderClass = record.isDailyAttention
                        ? 'border-l-4 border-l-yellow-400'
                        : 'border-l-4 border-l-transparent';

                    return (
                    <tr key={record.id} className={`${rowClass} ${borderClass} transition duration-150`}>
                      <td className="px-4 py-3 text-center">
                          <button onClick={(e) => toggleDailyAttention(record.id, e)} className="focus:outline-none">
                            {record.isDailyAttention ? (
                                <StarIconSolid className="h-5 w-5 text-yellow-400" />
                            ) : (
                                <StarIcon className="h-5 w-5 text-slate-300 hover:text-yellow-400 transition" />
                            )}
                          </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{record.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{record.cpf}</td>
                      <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded px-2 py-1">
                            {record.password}
                          </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                          !record.type ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' :
                          record.type.toLowerCase().includes('bpc') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                          record.type.toLowerCase().includes('aux') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          record.type.toLowerCase().includes('apo') ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {record.type || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{record.der || '-'}</td>
                      
                      <td className={`px-4 py-3 ${isUrgentDate(record.medExpertiseDate) ? 'text-orange-600 dark:text-orange-400 font-bold animate-pulse' : 'text-slate-600 dark:text-slate-400'}`}>
                        {isUrgentDate(record.medExpertiseDate) && <ExclamationTriangleIcon className="h-4 w-4 inline mr-1 mb-0.5" />}
                        {record.medExpertiseDate || '-'}
                      </td>
                      
                      <td className={`px-4 py-3 ${isUrgentDate(record.socialExpertiseDate) ? 'text-orange-600 dark:text-orange-400 font-bold animate-pulse' : 'text-slate-600 dark:text-slate-400'}`}>
                        {isUrgentDate(record.socialExpertiseDate) && <ExclamationTriangleIcon className="h-4 w-4 inline mr-1 mb-0.5" />}
                        {record.socialExpertiseDate || '-'}
                      </td>

                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{record.extensionDate || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{record.dcbDate || '-'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-500 text-xs italic">{record.ninetyDaysDate || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{record.securityMandateDate || '-'}</td>
                      
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEditModal(record)}
                            className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="Editar"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(record.id)}
                            className="p-1 text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition rounded hover:bg-red-50 dark:hover:bg-red-900/20"
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
                    <td colSpan={13} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-white dark:bg-slate-800 border-x border-b border-slate-200 dark:border-slate-700 rounded-b-xl px-4 py-3 flex items-center justify-between flex-none transition-colors duration-200">
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Linhas por página:</span>
                <select 
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
                <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                    Total: {filteredRecords.length}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300 mr-2">
                    Página {currentPage} de {totalPages || 1}
                </span>
                <button 
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="p-1 rounded-md border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <button 
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages}
                    className="p-1 rounded-md border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    <ChevronRightIcon className="h-5 w-5" />
                </button>
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

// 4. Main App Component
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Initial theme check
    const isDark = localStorage.getItem('theme') === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return newMode;
    });
  };

  const handleLogin = (authenticatedUser: User) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <>
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard 
          user={user} 
          onLogout={handleLogout} 
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
      )}
    </>
  );
};

export default App;