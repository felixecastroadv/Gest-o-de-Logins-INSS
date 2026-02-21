import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, AUTHORIZED_USERS, ClientRecord, UserRole, ContractRecord, PaymentEntry, ScannedDocument } from './types';
import { INITIAL_DATA } from './data';
import LaborCalc from './LaborCalc'; // Importação do novo componente
import { jsPDF } from "jspdf";
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
  WalletIcon,
  CalculatorIcon,
  DocumentDuplicateIcon,
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  CameraIcon,
  PhotoIcon,
  DocumentPlusIcon,
  EyeIcon,
  ArrowsPointingOutIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const INITIAL_CONTRACTS: ContractRecord[] = [];

// --- Interfaces ---
interface NotificationItem {
  id: string;
  clientName: string;
  type: string;
  date: string;
}

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ContractRecord) => void;
  initialData?: ContractRecord | null;
}

interface LoginProps {
  onLogin: (user: User) => void;
  onOpenSettings: () => void;
  isCloudConfigured: boolean;
}

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ClientRecord) => void;
  initialData?: ClientRecord | null;
  onOpenScanner?: () => void;
}

interface MonthlyDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    year: number;
    contracts: ContractRecord[];
    type: 'revenue' | 'michel' | 'luana' | null;
}

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
  onRestoreBackup: () => void;
}

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
  
  // Prazo de 15 dias para alerta
  return diffDays >= 0 && diffDays <= 15;
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

// 0.5 Scanner Modal Component (REVISADO E OTIMIZADO)
interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (doc: ScannedDocument) => void;
}

const DOCUMENT_TYPES = [
    "Identidade", "CPF", "Comprovante de residência", "Laudos", 
    "Exames/Documentos médicos", "Carteira de Trabalho", 
    "Perfil Profissiográfico (PPP)", "Contra-cheques", 
    "Prints de Conversa no Whatsapp", "Termo de Rescisão",
    "Certidão de Nascimento", "Certidão de Casamento", 
    "Certidão de Óbito", "Outro Documento"
];

const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onSave }) => {
    // Steps: select (type & source) -> crop (single image) -> preview (list of pages)
    const [step, setStep] = useState<'select' | 'crop' | 'preview'>('select');
    const [docType, setDocType] = useState('');
    
    // Image processing states
    const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
    const [pages, setPages] = useState<string[]>([]); // Array of cropped base64 images
    const [isProcessing, setIsProcessing] = useState(false);

    // Crop Logic States
    const [crop, setCrop] = useState({ x: 10, y: 10, w: 80, h: 80 }); // Percentages
    const [dragHandle, setDragHandle] = useState<string | null>(null);
    
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setStep('select');
            setDocType('');
            setCurrentImageSrc(null);
            setPages([]);
            setCrop({ x: 10, y: 10, w: 80, h: 80 });
        }
    }, [isOpen]);

    // --- File Handling ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setCurrentImageSrc(ev.target.result.toString());
                    setStep('crop');
                    setCrop({ x: 10, y: 10, w: 80, h: 80 }); // Reset crop
                }
            };
            reader.readAsDataURL(file);
        }
        // Reset inputs so same file can be selected again
        e.target.value = '';
    };

    // --- Crop Interaction Logic ---
    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent, handle: string) => {
        e.stopPropagation(); // Prevent defaulting
        setDragHandle(handle);
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (!dragHandle || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

        setCrop(prev => {
            let newCrop = { ...prev };
            
            if (dragHandle === 'tl') { // Top Left
                const right = prev.x + prev.w;
                const bottom = prev.y + prev.h;
                newCrop.x = Math.min(xPct, right - 10);
                newCrop.y = Math.min(yPct, bottom - 10);
                newCrop.w = right - newCrop.x;
                newCrop.h = bottom - newCrop.y;
            } else if (dragHandle === 'br') { // Bottom Right
                newCrop.w = Math.max(10, xPct - prev.x);
                newCrop.h = Math.max(10, yPct - prev.y);
            } else if (dragHandle === 'tr') { // Top Right
                const bottom = prev.y + prev.h;
                newCrop.y = Math.min(yPct, bottom - 10);
                newCrop.h = bottom - newCrop.y;
                newCrop.w = Math.max(10, xPct - prev.x);
            } else if (dragHandle === 'bl') { // Bottom Left
                const right = prev.x + prev.w;
                newCrop.x = Math.min(xPct, right - 10);
                newCrop.w = right - newCrop.x;
                newCrop.h = Math.max(10, yPct - prev.y);
            } else if (dragHandle === 'center') {
                // Move entire box if we implemented it, but keeping it simple with corners for now
            }

            return newCrop;
        });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (dragHandle) {
            // e.preventDefault(); // Might cause issues with scroll, handled by CSS touch-action
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragHandle) {
            e.preventDefault(); 
            handleMove(e.clientX, e.clientY);
        }
    };

    const handleEnd = () => {
        setDragHandle(null);
    };

    // --- Crop Execution (Calculo Geométrico Exato + Compressão) ---
    const confirmCrop = () => {
        if (!currentImageSrc || !imgRef.current || !containerRef.current) return;

        const image = imgRef.current;
        const container = containerRef.current;

        // 1. Geometria do Container e Imagem Original
        const contW = container.clientWidth;
        const contH = container.clientHeight;
        const natW = image.naturalWidth;
        const natH = image.naturalHeight;

        // 2. Calcular dimensões da Imagem Renderizada (considerando object-fit: contain)
        // Isso descobre o tamanho real da imagem na tela, excluindo as barras pretas
        const imgRatio = natW / natH;
        const contRatio = contW / contH;
        
        let rendW, rendH, offX, offY;

        if (imgRatio > contRatio) {
            // Imagem mais larga que o container (barra preta em cima/baixo)
            rendW = contW;
            rendH = contW / imgRatio;
            offX = 0;
            offY = (contH - rendH) / 2;
        } else {
            // Imagem mais alta que o container (barra preta na esquerda/direita)
            rendH = contH;
            rendW = contH * imgRatio;
            offX = (contW - rendW) / 2;
            offY = 0;
        }

        // 3. Converter Coordenadas do Crop (que são % do Container) para Pixels do Container
        const cropBoxX = (crop.x / 100) * contW;
        const cropBoxY = (crop.y / 100) * contH;
        const cropBoxW = (crop.w / 100) * contW;
        const cropBoxH = (crop.h / 100) * contH;

        // 4. Mapear para Coordenadas da Imagem (removendo offset das barras pretas)
        let startX = cropBoxX - offX;
        let startY = cropBoxY - offY;
        let finalW = cropBoxW;
        let finalH = cropBoxH;

        // 5. Escalar para a Resolução Original (Natural) da Imagem
        const scale = natW / rendW; // Fator de escala da tela para o real

        const sourceX = startX * scale;
        const sourceY = startY * scale;
        const sourceW = finalW * scale;
        const sourceH = finalH * scale;

        // 6. Desenhar no Canvas com Redimensionamento Inteligente (Compressão)
        const canvas = document.createElement('canvas');
        
        // Limite máximo de pixels para evitar arquivos gigantes (Compressão de Tamanho)
        const MAX_DIMENSION = 1600; 
        let targetW = sourceW;
        let targetH = sourceH;

        if (targetW > MAX_DIMENSION || targetH > MAX_DIMENSION) {
            const ratio = targetW / targetH;
            if (targetW > targetH) {
                targetW = MAX_DIMENSION;
                targetH = MAX_DIMENSION / ratio;
            } else {
                targetH = MAX_DIMENSION;
                targetW = MAX_DIMENSION * ratio;
            }
        }

        canvas.width = targetW;
        canvas.height = targetH;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Qualidade alta de redimensionamento
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(
                image, 
                sourceX, sourceY, sourceW, sourceH, // Origem (Coords da Imagem Natural)
                0, 0, targetW, targetH              // Destino (Canvas Redimensionado)
            );
            
            // Compressão JPEG Média (0.65) - Balanço ideal peso/qualidade
            const base64 = canvas.toDataURL('image/jpeg', 0.65);
            
            setPages(prev => [...prev, base64]);
            setCurrentImageSrc(null);
            setStep('preview');
        }
    };

    // --- PDF Generation ---
    const handleFinalizePDF = async () => {
        if (pages.length === 0) return;
        setIsProcessing(true);

        try {
            // A4 size in mm: 210 x 297
            // @ts-ignore
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = 297;

            for (let i = 0; i < pages.length; i++) {
                if (i > 0) pdf.addPage();
                
                const imgData = pages[i];
                
                // Get Image Dimensions to fit in A4 maintaining aspect ratio
                const imgProps = pdf.getImageProperties(imgData);
                const imgRatio = imgProps.width / imgProps.height;
                
                let w = pdfWidth - 20; // 10mm margin
                let h = w / imgRatio;
                
                if (h > (pdfHeight - 20)) {
                    h = pdfHeight - 20;
                    w = h * imgRatio;
                }
                
                const x = (pdfWidth - w) / 2;
                const y = 10; // Top margin

                pdf.addImage(imgData, 'JPEG', x, y, w, h);
            }

            const pdfBase64 = pdf.output('datauristring');
            
            const newDoc: ScannedDocument = {
                id: Math.random().toString(36).substr(2, 9),
                name: docType || 'Documento Digitalizado',
                type: 'application/pdf',
                url: pdfBase64,
                date: new Date().toLocaleDateString('pt-BR')
            };
            
            onSave(newDoc);
            onClose();

        } catch (error) {
            console.error("Erro ao gerar PDF", error);
            alert("Erro ao gerar PDF. Tente novamente.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200"
            onMouseUp={handleEnd}
            onTouchEnd={handleEnd}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
        >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800">
                
                {/* Header */}
                <div className="p-4 bg-primary-900 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-lg">Scanner de Documentos</h3>
                        <p className="text-xs text-primary-200">
                            {step === 'select' ? '1. Selecione a fonte' : 
                             step === 'crop' ? '2. Recorte a imagem' : 
                             '3. Revisão e PDF'}
                        </p>
                    </div>
                    <button onClick={onClose}><XMarkIcon className="h-6 w-6 text-white/80 hover:text-white" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                    
                    {/* STEP 1: SELECT */}
                    {step === 'select' && (
                        <div className="flex-1 flex flex-col justify-center space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nome do Documento</label>
                                <select 
                                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                                    value={docType}
                                    onChange={(e) => setDocType(e.target.value)}
                                >
                                    <option value="">Selecione o tipo...</option>
                                    {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => {
                                        if(!docType) { alert("Selecione o tipo de documento primeiro."); return; }
                                        cameraInputRef.current?.click();
                                    }}
                                    className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition group"
                                >
                                    <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full group-hover:scale-110 transition">
                                        <CameraIcon className="h-8 w-8 text-primary-600" />
                                    </div>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">Câmera</span>
                                </button>
                                
                                <button 
                                    onClick={() => {
                                        if(!docType) { alert("Selecione o tipo de documento primeiro."); return; }
                                        galleryInputRef.current?.click();
                                    }}
                                    className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition group"
                                >
                                    <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-full group-hover:scale-110 transition">
                                        <PhotoIcon className="h-8 w-8 text-purple-600" />
                                    </div>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">Galeria</span>
                                </button>
                            </div>
                            
                            {/* Inputs Invisíveis Distintos */}
                            <input 
                                type="file" 
                                accept="image/*" 
                                ref={cameraInputRef} 
                                className="hidden" 
                                capture="environment" 
                                onChange={handleFileChange} 
                            />
                            <input 
                                type="file" 
                                accept="image/*, application/pdf" // Para galeria não usamos capture
                                ref={galleryInputRef} 
                                className="hidden" 
                                onChange={handleFileChange} 
                            />

                            {pages.length > 0 && (
                                <button 
                                    onClick={() => setStep('preview')}
                                    className="w-full py-3 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                                >
                                    Voltar para Revisão ({pages.length} págs)
                                </button>
                            )}
                        </div>
                    )}

                    {/* STEP 2: CROP */}
                    {step === 'crop' && currentImageSrc && (
                        <div className="flex flex-col h-full">
                            <p className="text-xs text-center text-slate-500 mb-2 flex items-center justify-center gap-2">
                                <ArrowsPointingOutIcon className="h-3 w-3" /> Arraste os cantos azuis para ajustar
                            </p>
                            
                            <div 
                                className="relative bg-black/90 rounded-xl overflow-hidden flex-1 touch-none select-none flex items-center justify-center"
                                ref={containerRef}
                                style={{ touchAction: 'none' }}
                            >
                                <img 
                                    ref={imgRef} 
                                    src={currentImageSrc} 
                                    alt="Crop Target" 
                                    className="max-w-full max-h-full object-contain pointer-events-none select-none" 
                                    draggable={false}
                                />
                                
                                {/* Overlay Crop Box */}
                                <div 
                                    className="absolute border-2 border-primary-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                                    style={{
                                        left: `${crop.x}%`,
                                        top: `${crop.y}%`,
                                        width: `${crop.w}%`,
                                        height: `${crop.h}%`
                                    }}
                                >
                                    {/* Handles - Aumentados para toque fácil */}
                                    <div 
                                        className="absolute -top-4 -left-4 w-10 h-10 bg-transparent flex items-center justify-center z-20"
                                        onMouseDown={(e) => handleTouchStart(e, 'tl')}
                                        onTouchStart={(e) => handleTouchStart(e, 'tl')}
                                    >
                                        <div className="w-5 h-5 bg-primary-500 rounded-full border-2 border-white shadow-sm"></div>
                                    </div>

                                    <div 
                                        className="absolute -top-4 -right-4 w-10 h-10 bg-transparent flex items-center justify-center z-20"
                                        onMouseDown={(e) => handleTouchStart(e, 'tr')}
                                        onTouchStart={(e) => handleTouchStart(e, 'tr')}
                                    >
                                        <div className="w-5 h-5 bg-primary-500 rounded-full border-2 border-white shadow-sm"></div>
                                    </div>

                                    <div 
                                        className="absolute -bottom-4 -left-4 w-10 h-10 bg-transparent flex items-center justify-center z-20"
                                        onMouseDown={(e) => handleTouchStart(e, 'bl')}
                                        onTouchStart={(e) => handleTouchStart(e, 'bl')}
                                    >
                                        <div className="w-5 h-5 bg-primary-500 rounded-full border-2 border-white shadow-sm"></div>
                                    </div>

                                    <div 
                                        className="absolute -bottom-4 -right-4 w-10 h-10 bg-transparent flex items-center justify-center z-20"
                                        onMouseDown={(e) => handleTouchStart(e, 'br')}
                                        onTouchStart={(e) => handleTouchStart(e, 'br')}
                                    >
                                        <div className="w-5 h-5 bg-primary-500 rounded-full border-2 border-white shadow-sm"></div>
                                    </div>
                                    
                                    {/* Grid Lines Visuals */}
                                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                                        <div className="border-r border-b border-white"></div>
                                        <div className="border-r border-b border-white"></div>
                                        <div className="border-b border-white"></div>
                                        <div className="border-r border-b border-white"></div>
                                        <div className="border-r border-b border-white"></div>
                                        <div className="border-b border-white"></div>
                                        <div className="border-r border-white"></div>
                                        <div className="border-r border-white"></div>
                                        <div></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-4 flex gap-3 shrink-0">
                                <button onClick={() => setStep('select')} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200">
                                    Cancelar
                                </button>
                                <button onClick={confirmCrop} className="flex-1 py-3 text-white font-bold bg-green-600 hover:bg-green-700 rounded-xl shadow-lg flex items-center justify-center gap-2">
                                    <CheckIcon className="h-5 w-5" />
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: PREVIEW & PDF */}
                    {step === 'preview' && (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 overflow-y-auto mb-4">
                                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                    <DocumentDuplicateIcon className="h-5 w-5" />
                                    Páginas ({pages.length})
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    {pages.map((p, idx) => (
                                        <div key={idx} className="relative group aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                            <img src={p} alt={`Página ${idx+1}`} className="w-full h-full object-contain" />
                                            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded">
                                                {idx + 1}
                                            </div>
                                            <button 
                                                onClick={() => setPages(pages.filter((_, i) => i !== idx))}
                                                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition shadow-sm"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        onClick={() => setStep('select')}
                                        className="aspect-[3/4] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-400 hover:text-primary-600"
                                    >
                                        <PlusIcon className="h-8 w-8" />
                                        <span className="text-xs font-bold">Adicionar Pág.</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="shrink-0 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button 
                                    onClick={handleFinalizePDF}
                                    disabled={isProcessing || pages.length === 0}
                                    className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                                >
                                    {isProcessing ? (
                                        <>
                                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                            Gerando PDF...
                                        </>
                                    ) : (
                                        <>
                                            <DocumentTextIcon className="h-5 w-5" />
                                            Salvar Arquivo PDF
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

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

// 0.0 Copy Button Component
const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!text) return;
        
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (!text) return null;

    return (
        <button 
            onClick={handleCopy} 
            className={`p-1.5 rounded-lg transition-all duration-200 flex-shrink-0 ${copied ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Copiar"
        >
            {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <DocumentDuplicateIcon className="h-3.5 w-3.5" />}
        </button>
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
                            <p className="text-sm">Nenhuma pendência urgente para os próximos 15 dias.</p>
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
                    <p className="text-[10px] text-slate-400">Alertas para hoje e próximos 15 dias</p>
                </div>
            </div>
        </div>
    );
}

// 0.3 Contract Modal (NOVO)
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
                installmentsCount: 1,
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
    
    // Cálculo de parcela
    const installments = Number(formData.installmentsCount) || 1;
    const installmentValue = totalFee > 0 ? totalFee / installments : 0;

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
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Nome <span className="text-red-500">*</span></label>
                        <input type="text" name="firstName" required value={formData.firstName || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Sobrenome</label>
                        <input type="text" name="lastName" value={formData.lastName || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">CPF</label>
                        <input type="text" name="cpf" value={formData.cpf || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Tipo de Serviço</label>
                        <input type="text" name="serviceType" value={formData.serviceType || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>

                     <div className="md:col-span-2 mt-2">
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Financeiro & Responsável</h4>
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Advogado Responsável <span className="text-red-500">*</span></label>
                         <select name="lawyer" required value={formData.lawyer || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white">
                             <option value="">Selecione...</option>
                             <option value="Michel">Dr. Michel</option>
                             <option value="Luana">Dra. Luana</option>
                         </select>
                         <p className="text-[10px] text-slate-400 mt-1">Define a divisão de lucros (60/40).</p>
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Valor Total Honorários (R$)</label>
                         <input type="number" name="totalFee" value={formData.totalFee || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white font-mono" placeholder="0.00" />
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Status do Processo <span className="text-red-500">*</span></label>
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
                     
                     {/* Seção de Cálculo de Parcelas */}
                     {formData.paymentMethod === 'Parcelado' && (
                         <div className="md:col-span-2 bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex items-center justify-between gap-4">
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Qtd. Parcelas</label>
                                 <select 
                                    name="installmentsCount" 
                                    value={formData.installmentsCount || 1} 
                                    onChange={(e) => setFormData({...formData, installmentsCount: Number(e.target.value)})} 
                                    className="w-32 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none text-sm dark:text-white"
                                 >
                                     {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                         <option key={num} value={num}>{num}x</option>
                                     ))}
                                 </select>
                             </div>
                             <div className="text-right">
                                 <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase mb-1">Valor por Parcela</p>
                                 <p className="text-xl font-bold text-slate-800 dark:text-white font-mono">
                                     {formatCurrency(installmentValue)}
                                 </p>
                             </div>
                         </div>
                     )}

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

// 2. Record Modal Component
const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Partial<ClientRecord>>({
      nationality: 'Brasileira',
      maritalStatus: 'Solteiro(a)',
      profession: ''
  });
  const [activeTab, setActiveTab] = useState<'info' | 'docs'>('info');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
          nationality: 'Brasileira',
          maritalStatus: 'Solteiro(a)',
          profession: ''
      });
    }
    setActiveTab('info');
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as ClientRecord);
  };

  const handleRemoveDocument = (docId: string) => {
      const updatedDocs = (formData.documents || []).filter(d => d.id !== docId);
      setFormData({ ...formData, documents: updatedDocs });
  }

  const handleScannerSave = (doc: ScannedDocument) => {
      const updatedDocs = [...(formData.documents || []), doc];
      setFormData({ ...formData, documents: updatedDocs });
  }

  const generatePDF = (type: 'procuracao' | 'hipossuficiencia' | 'renuncia') => {
      // @ts-ignore
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 25;
      const maxLineWidth = pageWidth - (margin * 2);
      
      const currentDate = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
      
      const clientName = formData.name?.toUpperCase() || "__________________________";
      const clientCPF = formData.cpf || "___.___.___-__";
      const clientAddress = formData.address || "__________________________";
      const clientNationality = formData.nationality || "brasileiro(a)";
      const clientMarital = formData.maritalStatus || "estado civil";
      const clientProfession = formData.profession || "profissão";
      
      // Lógica para menor impúbere / representante legal
      const isMinor = !!formData.legalRepresentative;
      
      // Cores para as linhas decorativas (Tom Vinho/Avermelhado Premium)
      const decorColor = [140, 20, 20]; 

      // --- Desenhar Linha Decorativa Superior ---
      doc.setDrawColor(decorColor[0], decorColor[1], decorColor[2]);
      doc.setLineWidth(1.5);
      doc.line(margin, 15, pageWidth - margin, 15);
      
      doc.setDrawColor(200, 100, 100);
      doc.setLineWidth(0.5);
      doc.line(margin, 16, pageWidth/3, 16); 

      // --- Desenhar Linha Decorativa Inferior ---
      doc.setDrawColor(decorColor[0], decorColor[1], decorColor[2]);
      doc.setLineWidth(1.5);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      doc.setDrawColor(200, 100, 100);
      doc.setLineWidth(2);
      doc.line(pageWidth - margin - 30, pageHeight - 15, pageWidth - margin, pageHeight - 15);

      // --- Helper para Justificar Texto TOTAL (Full Justify) ---
      const drawFullyJustifiedBlock = (label: string, text: string, startY: number) => {
          doc.setFont("times", "bold");
          doc.text(label, margin, startY);
          const labelWidth = doc.getTextWidth(label + " ");
          
          doc.setFont("times", "normal");
          const words = text.split(/\s+/); // Separa por qualquer espaço em branco
          const spaceWidth = doc.getTextWidth(" "); // Largura padrão do espaço

          let lines: string[][] = [];
          let currentLineWords: string[] = [];
          let currentLineWidth = 0;

          // Define limites
          const firstLineMaxWidth = maxLineWidth - labelWidth;

          // Algoritmo de Quebra de Linha
          for (let i = 0; i < words.length; i++) {
              const word = words[i];
              const wordWidth = doc.getTextWidth(word);
              
              // Limite da linha atual (primeira linha tem recuo)
              const limit = lines.length === 0 ? firstLineMaxWidth : maxLineWidth;

              // Verifica se a palavra cabe (largura atual + espaço + palavra)
              if (currentLineWords.length > 0 && currentLineWidth + spaceWidth + wordWidth > limit) {
                  // Linha cheia, salva e inicia nova
                  lines.push(currentLineWords);
                  currentLineWords = [word];
                  currentLineWidth = wordWidth;
              } else {
                  // Adiciona palavra à linha atual
                  if (currentLineWords.length > 0) currentLineWidth += spaceWidth;
                  currentLineWords.push(word);
                  currentLineWidth += wordWidth;
              }
          }
          // Adiciona a última linha pendente
          if (currentLineWords.length > 0) lines.push(currentLineWords);

          // Renderização com Cálculo de Espaçamento Extra
          let currentY = startY;
          
          lines.forEach((lineWords, lineIndex) => {
              const isLastLine = lineIndex === lines.length - 1;
              const isFirstLine = lineIndex === 0;
              
              const xStart = isFirstLine ? margin + labelWidth : margin;
              const lineWidthAvailable = isFirstLine ? firstLineMaxWidth : maxLineWidth;

              if (isLastLine) {
                  // Última linha: Alinhamento à Esquerda (padrão normal)
                  let x = xStart;
                  lineWords.forEach((word) => {
                      doc.text(word, x, currentY);
                      x += doc.getTextWidth(word) + spaceWidth;
                  });
              } else {
                  // Linhas do meio: Justificação Total (Espalha espaços)
                  const totalWordsWidth = lineWords.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
                  const gaps = lineWords.length - 1;
                  const extraSpace = lineWidthAvailable - totalWordsWidth;
                  
                  // Se houver apenas 1 palavra na linha (ex: palavra gigante), não justifica
                  const spaceSize = gaps > 0 ? extraSpace / gaps : 0;

                  let x = xStart;
                  lineWords.forEach((word, wIdx) => {
                      doc.text(word, x, currentY);
                      // Adiciona espaço calculado, exceto após a última palavra
                      if (wIdx < gaps) {
                          x += doc.getTextWidth(word) + spaceSize;
                      }
                  });
              }
              currentY += 6; // Altura da linha
          });

          return currentY + 4; // Retorna novo Y com padding
      };

      // --- Configuração de Fonte Padrão (Times) ---
      doc.setFont("times", "normal");
      
      if (type === 'procuracao') {
          // TÍTULO - Ajustado Y para caber na página
          doc.setFont("times", "bold");
          doc.setFontSize(16);
          doc.text("PROCURAÇÃO AD JUDICIA ET EXTRA", pageWidth / 2, 30, { align: "center" });
          
          doc.setFontSize(12);
          
          // Ajustado cursorY inicial para 55 (antes 80) para economizar espaço
          let cursorY = 55;
          
          // Lógica de texto para Representante Legal
          let outorganteText = "";
          if (isMinor) {
              // Texto para menor impúbere conforme solicitado
              const repName = formData.legalRepresentative?.toUpperCase() || "________________";
              const repNacionality = formData.nationality || "brasileira"; // Assume nationality of parent usually matches or generic
              const repCivil = formData.legalRepresentativeMaritalStatus || "solteira";
              const repProf = formData.legalRepresentativeProfession || "do lar";
              const repCPF = formData.legalRepresentativeCpf || "___.___.___-__";
              const repAddress = formData.legalRepresentativeAddress || clientAddress; // Usa endereço do rep ou do cliente

              outorganteText = `${clientName}, menor impúbere, ${clientNationality}, pensionista, inscrito no CPF sob o nº ${clientCPF}, representado por sua genitora e outorgante, ${repName}, ${repNacionality}, ${repCivil}, ${repProf} inscrita no CPF sob o nº ${repCPF} residente e domiciliado à ${repAddress}.`;
          } else {
              outorganteText = `${clientName}, ${clientNationality}, ${clientMarital}, ${clientProfession}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}.`;
          }
          
          cursorY = drawFullyJustifiedBlock("OUTORGANTE:", outorganteText, cursorY);

          const outorgadoText = `MICHEL SANTOS FELIX, inscrito na OAB/RJ sob o nº 231.640 e no CPF/MF nº 142.805.877-01, e LUANA DE OLIVEIRA CASTRO PACHECO, inscrita na OAB/RJ sob o nº 226.749 e inscrita no CPF sob o nº 113.599.127-89, com endereço eletrônico felixecastroadv@gmail.com, e endereço profissional sito na Av. Prefeito José de Amorim, 500, apto. 204 , Jardim Meriti – São João de Meriti/RJ, CEP 25.555-201.`;
          cursorY = drawFullyJustifiedBlock("OUTORGADO:", outorgadoText, cursorY);

          const poderesText = `Pelo presente instrumento o outorgante confere ao outorgado amplos poderes para o foro em geral, com cláusula ad judicia et extra, para representá-lo nos órgãos públicos e privados, agências do INSS, Juízos, Instâncias ou Tribunais, possibilitando propor ações de direito competentes e defendê-lo até o final da decisão, usando os recursos legais e acompanhando-os, conferindo-lhe ainda poderes especiais para requerer concessão/revisão de benefícios previdenciários, obter cópias de expedientes e processos administrativos, acessar laudos sociais e periciais, acessar e manejar extratos, sistemas e telas do INSS, agendar serviços e atendimentos no INSS, receber valores e dar quitação, levantar valores, incluindo RPVs e precatórios (podendo para tanto assinar declaração de isenção de imposto de renda), obter extratos de contas judiciais, requerer expedição/retificação de certidões, incluindo Certidões de Tempo de Contribuição, obter cópia de documentos, Perfis Profissiográficos Previdenciários e laudos técnicos, obter cópia de documentos médicos e prontuários, firmar compromissos ou acordos, receber citação, confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre o qual se funda a ação, assinar declaração de hipossuficiência econômica e substabelecer a outrem, com ou sem reservas de iguais poderes, para agir em conjunto ou separadamente com o substabelecido.`;
          cursorY = drawFullyJustifiedBlock("PODERES:", poderesText, cursorY);
          
          // Data e Assinatura com posição dinâmica
          cursorY += 10;
          if (cursorY > pageHeight - 50) { doc.addPage(); cursorY = 40; } // Nova página se necessário

          doc.setFont("times", "normal");
          doc.text(`São João de Meriti/RJ, ${currentDate}.`, margin, cursorY);
          
          cursorY += 25;
          doc.setLineWidth(0.5);
          doc.setDrawColor(0); // Preto
          doc.line(pageWidth / 2 - 60, cursorY, pageWidth / 2 + 60, cursorY);
          
          cursorY += 5;
          doc.setFont("times", "bold");
          
          if (isMinor) {
              // Assinatura com Representante
              doc.text(`${clientName}`, pageWidth / 2, cursorY, { align: "center" });
              doc.text(`(representado por: ${formData.legalRepresentative?.toUpperCase()})`, pageWidth / 2, cursorY + 5, { align: "center" });
          } else {
              doc.text(clientName, pageWidth / 2, cursorY, { align: "center" });
          }

      } else if (type === 'hipossuficiencia') {
          // TÍTULO
          doc.setFont("times", "bold");
          doc.setFontSize(16);
          doc.text("DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA", pageWidth / 2, 50, { align: "center" });
          
          doc.setFontSize(12);
          doc.setFont("times", "normal");
          
          let cursorY = 90;
          let text = "";
          
          if (isMinor) {
               text = `Eu, ${formData.legalRepresentative?.toUpperCase()}, brasileiro(a), representante legal de ${clientName}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}, DECLARO para os devidos fins de direito que não possuo condições de arcar com as custas processuais e despesas judiciais sem causar prejuízos ao meu próprio sustento e ao da minha família, nos termos dos arts. 98 a 102 da Lei 13.105/2015.`;
          } else {
               text = `Eu, ${clientName}, ${clientNationality}, ${clientMarital}, ${clientProfession}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}, DECLARO para os devidos fins de direito que não possuo condições de arcar com as custas processuais e despesas judiciais sem causar prejuízos ao meu próprio sustento e ao da minha família, nos termos dos arts. 98 a 102 da Lei 13.105/2015.`;
          }
          
          // Usando o novo justificador sem label
          const words = text.split(/\s+/);
          const spaceWidth = doc.getTextWidth(" ");
          let lines = [];
          let currentLineWords = [];
          let currentLineWidth = 0;

          for (let i = 0; i < words.length; i++) {
              const word = words[i];
              const wordWidth = doc.getTextWidth(word);
              if (currentLineWords.length > 0 && currentLineWidth + spaceWidth + wordWidth > maxLineWidth) {
                  lines.push(currentLineWords);
                  currentLineWords = [word];
                  currentLineWidth = wordWidth;
              } else {
                  if (currentLineWords.length > 0) currentLineWidth += spaceWidth;
                  currentLineWords.push(word);
                  currentLineWidth += wordWidth;
              }
          }
          if (currentLineWords.length > 0) lines.push(currentLineWords);

          lines.forEach((lineWords, lineIndex) => {
              const isLastLine = lineIndex === lines.length - 1;
              if (isLastLine) {
                  let x = margin;
                  lineWords.forEach(word => {
                      doc.text(word, x, cursorY);
                      x += doc.getTextWidth(word) + spaceWidth;
                  });
              } else {
                  const totalWordsWidth = lineWords.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
                  const gaps = lineWords.length - 1;
                  const extraSpace = maxLineWidth - totalWordsWidth;
                  const spaceSize = gaps > 0 ? extraSpace / gaps : 0;
                  let x = margin;
                  lineWords.forEach((word, wIdx) => {
                      doc.text(word, x, cursorY);
                      if (wIdx < gaps) x += doc.getTextWidth(word) + spaceSize;
                  });
              }
              cursorY += 7; // Line height maior para declaração
          });
          
          cursorY += 30;
          
          // ASSINATURA
          doc.text(`São João de Meriti/RJ, ${currentDate}.`, margin, cursorY);
          
          cursorY += 25;
          doc.setLineWidth(0.5);
          doc.setDrawColor(0);
          doc.line(pageWidth / 2 - 60, cursorY, pageWidth / 2 + 60, cursorY);
          
          doc.setFont("times", "bold");
          
          if (isMinor) {
              doc.text(`${clientName}`, pageWidth / 2, cursorY + 5, { align: "center" });
              doc.text(`(representado por: ${formData.legalRepresentative?.toUpperCase()})`, pageWidth / 2, cursorY + 10, { align: "center" });
          } else {
              doc.text(clientName, pageWidth / 2, cursorY + 5, { align: "center" });
          }

      } else if (type === 'renuncia') {
          // TÍTULO
          doc.setFont("times", "bold");
          doc.setFontSize(16);
          doc.text("DA RENÚNCIA AOS VALORES EXCEDENTES", pageWidth / 2, 50, { align: "center" });
          doc.text("AO TETO DO JEF", pageWidth / 2, 58, { align: "center" });
          
          doc.setFontSize(12);
          doc.setFont("times", "normal");
          
          let cursorY = 90;
          let text = "";
          
          if (isMinor) {
              text = `${clientName}, CPF nº ${clientCPF}, neste ato representado por ${formData.legalRepresentative?.toUpperCase()}, renuncia à soma das parcelas vencidas e 12 vincendas que excedem ao teto do Juizado Especial Federal, a fim de permitir o trâmite da presente ação no Juizado Especial Federal, conforme Tema 1.030 do STJ.`;
          } else {
              text = `${clientName}, CPF nº ${clientCPF}, renuncia à soma das parcelas vencidas e 12 vincendas que excedem ao teto do Juizado Especial Federal, a fim de permitir o trâmite da presente ação no Juizado Especial Federal, conforme Tema 1.030 do STJ.`;
          }
          
          // Mesmo justificador manual da hipossuficiência
          const words = text.split(/\s+/);
          const spaceWidth = doc.getTextWidth(" ");
          let lines = [];
          let currentLineWords = [];
          let currentLineWidth = 0;

          for (let i = 0; i < words.length; i++) {
              const word = words[i];
              const wordWidth = doc.getTextWidth(word);
              if (currentLineWords.length > 0 && currentLineWidth + spaceWidth + wordWidth > maxLineWidth) {
                  lines.push(currentLineWords);
                  currentLineWords = [word];
                  currentLineWidth = wordWidth;
              } else {
                  if (currentLineWords.length > 0) currentLineWidth += spaceWidth;
                  currentLineWords.push(word);
                  currentLineWidth += wordWidth;
              }
          }
          if (currentLineWords.length > 0) lines.push(currentLineWords);

          lines.forEach((lineWords, lineIndex) => {
              const isLastLine = lineIndex === lines.length - 1;
              if (isLastLine) {
                  let x = margin;
                  lineWords.forEach(word => {
                      doc.text(word, x, cursorY);
                      x += doc.getTextWidth(word) + spaceWidth;
                  });
              } else {
                  const totalWordsWidth = lineWords.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
                  const gaps = lineWords.length - 1;
                  const extraSpace = maxLineWidth - totalWordsWidth;
                  const spaceSize = gaps > 0 ? extraSpace / gaps : 0;
                  let x = margin;
                  lineWords.forEach((word, wIdx) => {
                      doc.text(word, x, cursorY);
                      if (wIdx < gaps) x += doc.getTextWidth(word) + spaceSize;
                  });
              }
              cursorY += 7;
          });
          
          cursorY += 30;
          
          // ASSINATURA
          doc.text(`São João de Meriti/RJ, ${currentDate}.`, margin, cursorY);
          
          cursorY += 25;
          doc.setLineWidth(0.5);
          doc.setDrawColor(0);
          doc.line(pageWidth / 2 - 60, cursorY, pageWidth / 2 + 60, cursorY);
          
          doc.setFont("times", "bold");
          
          if (isMinor) {
              doc.text(`${clientName}`, pageWidth / 2, cursorY + 5, { align: "center" });
              doc.text(`(representado por: ${formData.legalRepresentative?.toUpperCase()})`, pageWidth / 2, cursorY + 10, { align: "center" });
          } else {
              doc.text(clientName, pageWidth / 2, cursorY + 5, { align: "center" });
          }
      }

      const pdfBase64 = doc.output('datauristring');
      let docName = 'Documento';
      if (type === 'procuracao') docName = 'Procuração (Gerada)';
      if (type === 'hipossuficiencia') docName = 'Hipossuficiência (Gerada)';
      if (type === 'renuncia') docName = 'Termo de Renúncia (Gerado)';

      const newDoc: ScannedDocument = {
          id: Math.random().toString(36).substr(2, 9),
          name: docName,
          type: 'application/pdf',
          url: pdfBase64,
          date: new Date().toLocaleDateString('pt-BR')
      };
      
      const updatedDocs = [...(formData.documents || []), newDoc];
      setFormData({ ...formData, documents: updatedDocs });
  };

  const fields = [
    { label: "Nome Completo", name: "name", type: "text", width: "full" },
    { label: "Nacionalidade", name: "nationality", type: "text", width: "third" },
    { label: "Estado Civil", name: "maritalStatus", type: "select", width: "third", options: ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"] },
    { label: "Profissão", name: "profession", type: "text", width: "third" },
    { label: "CPF", name: "cpf", type: "text", width: "half" },
    { label: "Senha INSS", name: "password", type: "text", width: "half" },
    { label: "Endereço Completo", name: "address", type: "text", width: "full" },
    
    // CAMPOS DO REPRESENTANTE LEGAL (Expandidos)
    { label: "Rep. Legal - Nome", name: "legalRepresentative", type: "text", width: "full" },
    { label: "Rep. Legal - CPF", name: "legalRepresentativeCpf", type: "text", width: "half" },
    { label: "Rep. Legal - Est. Civil", name: "legalRepresentativeMaritalStatus", type: "select", width: "half", options: ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"] },
    { label: "Rep. Legal - Profissão", name: "legalRepresentativeProfession", type: "text", width: "half" },
    { label: "Rep. Legal - Endereço Completo (c/ CEP)", name: "legalRepresentativeAddress", type: "text", width: "full" },

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

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6">
            <button 
                onClick={() => setActiveTab('info')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'info' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                Informações
            </button>
            <button 
                onClick={() => setActiveTab('docs')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'docs' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                Documentos ({formData.documents?.length || 0})
            </button>
        </div>
        
        <div className="p-8">
            {activeTab === 'info' ? (
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-6">
                {fields.map((field) => {
                    let spanClass = 'md:col-span-6';
                    if (field.width === 'half') spanClass = 'md:col-span-3';
                    if (field.width === 'third') spanClass = 'md:col-span-2';

                    return (
                        <div key={field.name} className={spanClass}>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                {field.label}
                            </label>
                            {field.type === 'select' ? (
                                <select
                                    name={field.name}
                                    value={(formData as any)[field.name] || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition text-sm"
                                >
                                    <option value="">Selecione...</option>
                                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            ) : (
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
                            )}
                        </div>
                    );
                })}
                
                <div className="md:col-span-6 mt-2">
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

                <div className="md:col-span-6 flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
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
            ) : (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white">Documentos Digitalizados</h4>
                        <button 
                            onClick={() => setIsScannerOpen(true)}
                            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-primary-700 transition"
                        >
                            <CameraIcon className="h-4 w-4" />
                            Nova Digitalização
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                        <button onClick={() => generatePDF('procuracao')} className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <DocumentTextIcon className="h-5 w-5 text-blue-500" />
                            Gerar Procuração
                        </button>
                        <button onClick={() => generatePDF('hipossuficiencia')} className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <ScaleIcon className="h-5 w-5 text-purple-500" />
                            Gerar Declaração
                        </button>
                        <button onClick={() => generatePDF('renuncia')} className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-500" />
                            Gerar Renúncia
                        </button>
                    </div>

                    <div className="space-y-3">
                        {formData.documents && formData.documents.length > 0 ? (
                            formData.documents.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                                            <DocumentTextIcon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 dark:text-white">{doc.name}</p>
                                            <p className="text-xs text-slate-500">{doc.date} • {doc.type === 'application/pdf' ? 'PDF' : 'IMG'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a href={doc.url} download={`${doc.name}.${doc.type === 'application/pdf' ? 'pdf' : 'jpg'}`} className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg" title="Baixar">
                                            <ArrowDownTrayIcon className="h-5 w-5" />
                                        </a>
                                        <button onClick={() => handleRemoveDocument(doc.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Excluir">
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <DocumentPlusIcon className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 text-sm">Nenhum documento anexado.</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-right">
                         <button
                            type="button"
                            onClick={() => handleSubmit({ preventDefault: () => {} } as any)}
                            className="px-5 py-2.5 text-white font-medium bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-500/30 transition flex items-center gap-2 ml-auto"
                        >
                            <CheckIcon className="h-5 w-5" />
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            )}
      </div>
      <ScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onSave={handleScannerSave} />
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

// 0.4 Monthly Details Modal
const MonthlyDetailsModal: React.FC<MonthlyDetailsModalProps> = ({ isOpen, onClose, year, contracts, type }) => {
    const monthlyData = useMemo(() => {
        if (!type) return [];
        
        // 12 months array (0-11)
        const data = Array(12).fill(null).map(() => ({ total: 0, payments: [] as { client: string, day: string, amount: number, fullAmount: number }[] }));

        contracts.forEach(contract => {
            (contract.payments || []).forEach(payment => {
                const parts = payment.date.split('-'); // YYYY-MM-DD
                const pYear = parseInt(parts[0]);
                const pMonth = parseInt(parts[1]) - 1; 

                if (pYear === year && pMonth >= 0 && pMonth < 12) {
                    let amount = payment.amount;
                    let displayAmount = amount;

                    // Apply Split Logic
                    if (type === 'michel') {
                        if (contract.lawyer === 'Michel') displayAmount = amount * 0.6;
                        else displayAmount = amount * 0.4;
                    } else if (type === 'luana') {
                         if (contract.lawyer === 'Luana') displayAmount = amount * 0.6;
                        else displayAmount = amount * 0.4;
                    }
                    
                    if (displayAmount > 0) {
                        data[pMonth].total += displayAmount;
                        data[pMonth].payments.push({
                            client: `${contract.firstName} ${contract.lastName}`,
                            day: parts[2],
                            amount: displayAmount,
                            fullAmount: amount
                        });
                    }
                }
            });
        });
        return data;
    }, [contracts, year, type]);

    if (!isOpen || !type) return null;

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const getTitle = () => {
        if (type === 'revenue') return `Receita Total - ${year}`;
        if (type === 'michel') return `Lucro Dr. Michel - ${year}`;
        if (type === 'luana') return `Lucro Dra. Luana - ${year}`;
        return '';
    };

    const getThemeColor = () => {
        if (type === 'revenue') return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
        if (type === 'michel') return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
        if (type === 'luana') return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
        return '';
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div>
                         <h3 className="text-xl font-bold text-slate-900 dark:text-white">{getTitle()}</h3>
                         <p className="text-xs text-slate-500 dark:text-slate-400">Detalhamento mensal dos pagamentos recebidos</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg transition">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                
                <div className="overflow-y-auto p-6 space-y-4">
                    {monthlyData.map((month, idx) => {
                        if (month.total === 0) return null;
                        return (
                            <div key={idx} className={`rounded-xl border p-4 ${getThemeColor()}`}>
                                <div className="flex justify-between items-center mb-3 border-b border-black/5 dark:border-white/10 pb-2">
                                    <h4 className="font-bold uppercase tracking-wide text-sm flex items-center gap-2">
                                        <CalendarDaysIcon className="h-4 w-4" />
                                        {monthNames[idx]}
                                    </h4>
                                    <span className="font-mono font-bold text-lg">{formatCurrency(month.total)}</span>
                                </div>
                                <div className="space-y-1.5 pl-2">
                                    {month.payments.map((p, pIdx) => (
                                        <div key={pIdx} className="flex justify-between text-xs items-center">
                                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                {p.day}/{String(idx + 1).padStart(2, '0')} - {p.client}
                                            </span>
                                            <span className="font-mono opacity-80">{formatCurrency(p.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                    {monthlyData.every(m => m.total === 0) && (
                        <div className="text-center py-10 text-slate-400">
                            <BanknotesIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>Nenhum pagamento registrado neste ano para esta categoria.</p>
                        </div>
                    )}
                </div>
             </div>
        </div>
    );
}

// 4. Financial Stats Component
const FinancialStats = ({ contracts }: { contracts: ContractRecord[] }) => {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [activeModalType, setActiveModalType] = useState<'revenue' | 'michel' | 'luana' | null>(null);

    // Extrair anos disponíveis nos pagamentos
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        years.add(currentYear);
        contracts.forEach(c => {
            if(c.payments) {
                c.payments.forEach(p => {
                    years.add(new Date(p.date).getFullYear());
                });
            }
        });
        return Array.from(years).sort((a, b) => b - a); // Decrescente
    }, [contracts, currentYear]);

    const stats = useMemo(() => {
        const totalPortfolio = contracts.reduce((acc, c) => acc + (Number(c.totalFee) || 0), 0);
        
        let yearlyIncome = 0;
        let michelIncome = 0;
        let luanaIncome = 0;
        let michelPortfolio = 0;
        let luanaPortfolio = 0;

        contracts.forEach(c => {
            const contractTotal = Number(c.totalFee) || 0;
            const responsible = c.lawyer;

            // Portfolio Split (Potencial Total)
            if (responsible === 'Michel') {
                michelPortfolio += contractTotal * 0.6;
                luanaPortfolio += contractTotal * 0.4;
            } else if (responsible === 'Luana') {
                luanaPortfolio += contractTotal * 0.6;
                michelPortfolio += contractTotal * 0.4;
            }

            // Yearly Cash Flow (Baseado nos pagamentos realizados)
            (c.payments || []).forEach(p => {
                // Fix timezone issue by parsing date manually or setting time to noon
                // Here assuming date string YYYY-MM-DD
                const parts = p.date.split('-');
                const pYear = parseInt(parts[0]);
                
                if (pYear === selectedYear) {
                    const amount = Number(p.amount);
                    yearlyIncome += amount;
                    
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

        return { totalPortfolio, yearlyIncome, michelIncome, luanaIncome, michelPortfolio, luanaPortfolio };
    }, [contracts, selectedYear]);

    return (
        <div className="space-y-4 mb-6">
            <MonthlyDetailsModal 
                isOpen={!!activeModalType} 
                onClose={() => setActiveModalType(null)} 
                year={selectedYear} 
                contracts={contracts} 
                type={activeModalType} 
            />

            <div className="flex justify-end">
                <div className="relative inline-block">
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-1.5 pl-4 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                        <ChevronDownIcon className="h-3 w-3" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <WalletIcon className="h-24 w-24 text-indigo-600" />
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor em Carteira (Total)</p>
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(stats.totalPortfolio)}</p>
                    <div className="mt-3 text-[10px] text-slate-400 flex justify-between">
                        <span>Potencial a receber (Tudo)</span>
                    </div>
                </div>

                <div 
                    onClick={() => setActiveModalType('revenue')}
                    className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group cursor-pointer hover:border-green-500 dark:hover:border-green-500 transition-all hover:shadow-md"
                >
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <BanknotesIcon className="h-24 w-24 text-green-600" />
                    </div>
                    <div className="flex justify-between items-start">
                         <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Receita ({selectedYear})</p>
                         <MagnifyingGlassIcon className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-2xl font-extrabold text-green-600 dark:text-green-400 mt-1">{formatCurrency(stats.yearlyIncome)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Total recebido no ano selecionado</p>
                </div>

                <div 
                    onClick={() => setActiveModalType('michel')}
                    className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-xl shadow-lg shadow-blue-500/20 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-blue-200 uppercase tracking-wide">Lucro Dr. Michel ({selectedYear})</p>
                        <MagnifyingGlassIcon className="h-4 w-4 text-white opacity-60" />
                    </div>
                    <p className="text-2xl font-extrabold mt-1">{formatCurrency(stats.michelIncome)}</p>
                    <p className="text-[10px] text-blue-200 mt-1">Divisão de lucros no ano</p>
                </div>

                <div 
                    onClick={() => setActiveModalType('luana')}
                    className="bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-xl shadow-lg shadow-purple-500/20 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                >
                     <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-purple-200 uppercase tracking-wide">Lucro Dra. Luana ({selectedYear})</p>
                        <MagnifyingGlassIcon className="h-4 w-4 text-white opacity-60" />
                    </div>
                    <p className="text-2xl font-extrabold mt-1">{formatCurrency(stats.luanaIncome)}</p>
                    <p className="text-[10px] text-purple-200 mt-1">Divisão de lucros no ano</p>
                </div>
            </div>
        </div>
    );
};

// 5. Dashboard Component
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
  const [currentView, setCurrentView] = useState<'clients' | 'contracts' | 'labor_calc'>('clients'); // ADICIONADO labor_calc
  const [showArchived, setShowArchived] = useState(false);

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
            // Cloud Fetch - Clients (ID 1)
            const { data: clientData, error: clientError } = await supabase
                .from('clients')
                .select('data')
                .eq('id', 1) // Explicitly ID 1
                .single();
                
            if (clientData && clientData.data) {
                fetchedClients = clientData.data;
                localStorage.setItem('inss_records', JSON.stringify(clientData.data));
            }

            // Cloud Fetch - Contracts (Stored in 'clients' table as ID 2 to share table)
            const { data: contractData, error: contractError } = await supabase
                .from('clients') // Using 'clients' table instead of 'contracts'
                .select('data')
                .eq('id', 2) // Explicitly ID 2
                .single();

            if (contractData && contractData.data) {
                fetchedContracts = contractData.data;
                localStorage.setItem('inss_contracts', JSON.stringify(contractData.data));
            } else if (contractError && contractError.code === 'PGRST116') {
                 // Row 2 doesn't exist yet, initialize it
                 await supabase.from('clients').upsert({ id: 2, data: INITIAL_CONTRACTS });
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
                    table: 'clients' // Listen only to clients table
                },
                (payload: any) => {
                     // Check ID to determine if it is Client Data (1) or Contract Data (2)
                     if (payload.new && payload.new.data) {
                         if (payload.new.id === 1) {
                             setRecords(payload.new.data);
                             localStorage.setItem('inss_records', JSON.stringify(payload.new.data));
                         } else if (payload.new.id === 2) {
                             setContracts(payload.new.data);
                             localStorage.setItem('inss_contracts', JSON.stringify(payload.new.data));
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
          // FIX: Save contracts to ID 2 in 'clients' table
          if (supabase) await supabase.from('clients').upsert({ id: 2, data: newData });
      }
      
      setTimeout(() => setIsSyncing(false), 800);
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
                   <span className="hidden lg:block font-medium">Calculadora</span>
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
                      'Cálculos Trabalhistas'}
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
                 <LaborCalc />
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCloudConfigured, setIsCloudConfigured] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem('inss_theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) { document.documentElement.classList.add('dark'); }
  }, []);
  
  const checkCloudStatus = () => {
      const config = getDbConfig();
      setIsCloudConfigured(!!(config && config.url && config.key));
  };

  useEffect(() => { checkCloudStatus(); }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('inss_theme', newMode ? 'dark' : 'light');
    if (newMode) { document.documentElement.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); }
  };

  const handleLogin = (authenticatedUser: User) => { setUser(authenticatedUser); };
  const handleLogout = () => { setUser(null); };
  const handleSettingsSave = () => { checkCloudStatus(); };
  
  const handleRestoreBackup = () => {
        const supabase = initSupabase();
        if(supabase) {
             const restore = async () => {
                 await supabase.from('clients').upsert({ id: 1, data: INITIAL_DATA });
                 await supabase.from('clients').upsert({ id: 2, data: INITIAL_CONTRACTS });
                 alert("Dados restaurados com sucesso!");
                 window.location.reload();
             };
             restore();
        } else {
            localStorage.setItem('inss_records', JSON.stringify(INITIAL_DATA));
            localStorage.setItem('inss_contracts', JSON.stringify(INITIAL_CONTRACTS));
            alert("Dados locais restaurados!");
            window.location.reload();
        }
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
            onRestoreBackup={handleRestoreBackup} 
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
                onRestoreBackup={handleRestoreBackup} 
            />
        </>
      )}
    </>
  );
}
