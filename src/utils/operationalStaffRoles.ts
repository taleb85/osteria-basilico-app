import type { User } from '../types';

/** Ruoli assegnabili quando Manager/Assistant creano un dipendente dalla scheda team delegata. */
export const OPERATIONAL_STAFF_ROLES_FOR_DELEGATE: User['role'][] = [
  'server',
  'waiter',
  'cook',
  'chef',
  'bartender',
  'dishwasher',
];
