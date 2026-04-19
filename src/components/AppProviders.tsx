import { ReactNode } from 'react';
import { AppProvider } from '../context/AppContext';
import { LayoutPresetProvider } from '../context/LayoutPresetContext';

/**
 * Provider wrapper per app principale (non super-admin)
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <LayoutPresetProvider>
        {children}
      </LayoutPresetProvider>
    </AppProvider>
  );
}
