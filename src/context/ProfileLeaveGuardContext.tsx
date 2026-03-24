import { createContext, useContext, type MutableRefObject } from 'react';

export type ProfileLeaveGuard = {
  isDirty: () => boolean;
  save: () => Promise<void>;
};

export const ProfileLeaveGuardRefContext = createContext<MutableRefObject<ProfileLeaveGuard | null> | null>(
  null
);

export function useProfileLeaveGuardRef(): MutableRefObject<ProfileLeaveGuard | null> | null {
  return useContext(ProfileLeaveGuardRefContext);
}
