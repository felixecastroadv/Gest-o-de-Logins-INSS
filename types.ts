export interface ClientRecord {
  id: string;
  name: string;
  cpf: string;
  password: string;
  type: string;
  der: string;
  medExpertiseDate: string;
  socialExpertiseDate: string;
  extensionDate: string;
  dcbDate: string;
  ninetyDaysDate: string;
  securityMandateDate: string;
  isDailyAttention?: boolean;
}

export enum UserRole {
  ADVOGADO = 'Advogado(a)',
  SECRETARIA = 'Secretária'
}

export interface User {
  firstName: string;
  lastName: string;
  role: UserRole;
}

export const AUTHORIZED_USERS = [
  { firstName: 'Michel', lastName: 'Felix', role: UserRole.ADVOGADO },
  { firstName: 'Luana', lastName: 'Castro', role: UserRole.ADVOGADO },
  { firstName: 'Fabrícia', lastName: 'Sousa', role: UserRole.SECRETARIA },
];

// --- NOVOS TIPOS PARA CONTRATOS ---

export interface PaymentEntry {
  id: string;
  date: string; // ISO Date YYYY-MM-DD
  amount: number;
  note?: string;
}

export interface ContractRecord {
  id: string;
  firstName: string;
  lastName: string;
  cpf: string;
  serviceType: string;
  lawyer: 'Michel' | 'Luana';
  totalFee: number;
  status: 'Pendente' | 'Em Andamento' | 'Concluído';
  paymentMethod: 'À Vista' | 'Parcelado';
  installmentsCount?: number; // Novo campo para quantidade de parcelas
  payments: PaymentEntry[];
  createdAt: string;
}
