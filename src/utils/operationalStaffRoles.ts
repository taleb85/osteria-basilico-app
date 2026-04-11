import type { User } from '../types';

/**
 * Ruoli assegnabili quando Manager/Assistant creano un dipendente dalla scheda team delegata.
 * 'waiter' e 'chef' sono alias legacy → normalizzati a 'server' e 'cook' in EditStaffModal.
 */
export const OPERATIONAL_STAFF_ROLES_FOR_DELEGATE: User['role'][] = [
  'server',
  'cook',
  'bartender',
  'dishwasher',
];
