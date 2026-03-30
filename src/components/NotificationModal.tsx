import { useState, useEffect } from 'react';
import { X, Mail, Bell, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '../hooks/useMessages';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  unreadCount: number;
  onMessageClick: (messageId: string) => void;
  userId?: string;
  userName?: string;
  onRefresh?: () => void;
}

/**
 * Modal FULL-SCREEN per notifiche e messaggi.
 * Re-design a LISTA COMPATTA (stile turni/image_0.png).
 * Rimosso composer (spostato nel profilo).
 */
export function NotificationModal({
  isOpen,
  onClose,
  messages,
  unreadCount,
  onMessageClick,
}: NotificationModalProps) {
  const { triggerHapticFeedback, playNotificationSound } = useMultisensorialFeedback();

  // Feedback aptico all'apertura (una sola volta)
  useEffect(() => {
    if (isOpen) {
      triggerHapticFeedback('click');
      try {
        playNotificationSound();
      } catch (e) {
        // Silenzioso se bloccato dal browser
      }
    }
  }, [isOpen]); // Dipende solo da isOpen per evitare loop

  // Chiudi modal con ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-white w-screen h-screen overflow-hidden"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full h-full flex flex-col bg-white dark:bg-neutral-950 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Fisso - Stile PinPad FullScreen */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white dark:bg-neutral-950 px-6 py-6 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
                <Bell className="w-6 h-6 text-accent" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  Comunicazioni Staff
                </h2>
                {unreadCount > 0 && (
                  <p className="text-xs font-bold text-red-500 uppercase tracking-widest">
                    {unreadCount} messaggi da leggere
                  </p>
                )}
              </div>
            </div>
            
            <button
              type="button"
              onClick={onClose}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 transition-all active:scale-90 dark:bg-neutral-900 dark:text-neutral-500 hover:text-slate-900 dark:hover:text-white shadow-sm border border-slate-100 dark:border-white/5"
              aria-label="Chiudi"
            >
              <X className="h-8 w-8" strokeWidth={3} />
            </button>
          </div>

          {/* Lista Messaggi Compatta */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-neutral-950">
            <div className="w-full divide-y divide-slate-50 dark:divide-neutral-800/50">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center px-8">
                  <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800">
                    <Mail className="h-10 w-10 text-slate-200 dark:text-neutral-700" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Tutto in ordine!</h3>
                  <p className="text-sm font-medium text-slate-400 dark:text-neutral-500">
                    Non ci sono nuove comunicazioni.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isBroadcast = msg.message_type === 'broadcast';
                  const isUnread = !msg.is_read;

                  return (
                    <button
                      key={msg.id}
                      onClick={() => onMessageClick(msg.id)}
                      className={`w-full flex items-center gap-5 px-8 py-6 transition-all active:bg-slate-50 dark:active:bg-neutral-900 text-left group ${
                        isUnread ? 'bg-accent/5 dark:bg-accent/10' : 'bg-transparent'
                      }`}
                    >
                      {/* Icona Circolare (Sinistra) */}
                      <div className="flex-shrink-0">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-transform group-hover:scale-105 ${
                          isBroadcast 
                            ? 'bg-green-50 border-green-100 text-green-600 dark:bg-green-950/20 dark:border-green-900/30' 
                            : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-neutral-800 dark:border-neutral-700'
                        }`}>
                          {isBroadcast ? <span className="text-xl">📢</span> : <Mail className="h-5 w-5" />}
                        </div>
                      </div>

                      {/* Contenuto (Centro) */}
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-base font-bold truncate ${
                          isUnread ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-neutral-400'
                        }`}>
                          {msg.subject}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-tight mt-1">
                          <span>{msg.sender_name || 'Staff'}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-neutral-700" />
                          <span>{new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Badge/Stato (Destra) */}
                      <div className="flex-shrink-0">
                        {isUnread ? (
                          <div className="h-3 w-3 rounded-full bg-[#EF4444] shadow-[0_0_10px_rgba(239,68,68,0.6)]" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-200 dark:text-neutral-800" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          
          {/* Footer stile PinPad FullScreen */}
          <div className="p-8 border-t border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <button
              onClick={onClose}
              className="w-full h-16 rounded-3xl bg-[#1A1A1A] text-white font-black uppercase tracking-[0.2em] text-sm active:scale-[0.98] transition-all shadow-xl shadow-black/10"
            >
              Chiudi
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
