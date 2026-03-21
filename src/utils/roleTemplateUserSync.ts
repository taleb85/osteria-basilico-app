import type { User } from '../types';
import { getRolePermissionGroup, type RoleTemplateGroup } from './enabledFeatures';
import { SETTINGS_OPERATIONAL_PERM_KEYS, type SettingsOperationalPermKey } from './settingsPermissionRows';

export type OperationalTemplatesState = Record<
  RoleTemplateGroup,
  Record<SettingsOperationalPermKey, boolean>
>;

/** Payload DB per allineare un utente al template operativo del suo gruppo. */
export function operationalPayloadForUser(
  user: User,
  templates: OperationalTemplatesState
): Partial<User> | null {
  if (user.role === 'admin') return null;
  const g = getRolePermissionGroup(user.role);
  if (g === 'admin') return null;
  const t = templates[g];
  return Object.fromEntries(
    SETTINGS_OPERATIONAL_PERM_KEYS.map((k) => [k, t[k] === true])
  ) as Partial<User>;
}
