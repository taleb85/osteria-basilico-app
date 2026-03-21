import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { Theme } from '../types';
import { translations } from '../utils/translations';

interface UserMenuProps {
  user: User;
}

export default function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { updateUserPreferences } = useApp();

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
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
  const currentTheme = user.theme ?? 'dark';
  const t = translations[user.language ?? 'it'];

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-[#f8fafc]"
      >
        <span className="text-white text-sm font-black">{getInitial()}</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-14 w-64 bg-white dark:bg-[#1a1a1a] rounded-[32px] border border-gray-200 dark:border-white/10 overflow-hidden z-50 shadow-xl"
          >
            {/* TEMA */}
            <div className="p-3">
              <div className="flex items-center space-x-2 px-3 py-2 mb-2">
                  <Sun className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400 text-xs uppercase tracking-widest font-bold">
                    {t.theme.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-xl transition-colors ${
                      currentTheme === 'light'
                        ? 'bg-accent text-white'
                        : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span className="text-sm font-medium">{t.light}</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-xl transition-colors ${
                      currentTheme === 'dark'
                        ? 'bg-accent text-white'
                        : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span className="text-sm font-medium">{t.dark}</span>
                  </button>
                </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
