import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { User } from '../types';
import type { Theme } from '../types';
import { translations } from '../utils/translations';
import { CenteredModalPortal } from './ui/CenteredModalPortal';

interface UserMenuProps {
  user: User;
}

export default function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { updateUserPreferences } = useApp();

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      const tgt = event.target as Node;
      if (modalRef.current?.contains(tgt)) return;
      if (menuRef.current?.contains(tgt)) return;
      setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen]);

  const handleThemeChange = (theme: Theme) => {
    updateUserPreferences({ theme });
    localStorage.setItem('userTheme', theme);
  };

  const getInitial = () => user.first_name.charAt(0).toUpperCase();
  const currentTheme = user.theme ?? 'light';
  const t = translations[user.language ?? 'it'];

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-[#f8fafc]"
      >
        <span className="text-sm font-black text-white">{getInitial()}</span>
      </motion.button>

      {isOpen && (
        <CenteredModalPortal
          open
          onClose={() => setIsOpen(false)}
          panelRef={modalRef}
          backdropAriaLabel={t.close}
          ariaLabel={t.theme}
          maxWidthClass="max-w-sm"
          panelClassName="p-3 dark:border-white/10 dark:bg-[#1a1a1a]"
        >
          <div className="mb-2 flex items-center space-x-2 px-3 py-2">
            <Sun className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{t.theme.toUpperCase()}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`flex items-center justify-center space-x-2 rounded-xl px-3 py-2 transition-colors ${
                currentTheme === 'light'
                  ? 'bg-accent text-white'
                  : 'text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <Sun className="h-4 w-4" />
              <span className="text-sm font-medium">{t.light}</span>
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`flex items-center justify-center space-x-2 rounded-xl px-3 py-2 transition-colors ${
                currentTheme === 'dark'
                  ? 'bg-accent text-white'
                  : 'text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <Moon className="h-4 w-4" />
              <span className="text-sm font-medium">{t.dark}</span>
            </button>
          </div>
        </CenteredModalPortal>
      )}
    </div>
  );
}
