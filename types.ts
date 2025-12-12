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
