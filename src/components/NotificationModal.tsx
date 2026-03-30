import { useState, useEffect, useRef } from 'react';
import { X, Send, Mail, Users, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '../hooks/useMessages';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';
import { MessageComposer } from './MessageComposer';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  unreadCount: number;
  onMessageClick: (messageId: string) => void;
  userId?: string;
  userName?: string;
  canWrite?: boolean;
  allUsers?: Array<{ id: string; first_name: string; last_name: string }>;
  onComposerSuccess?: () => void;
  onRefresh?: () => void;
}

/**
 * Modal FULL-SCREEN per notifiche e messaggi.
 * Stile coerente con PinPadModal (glass panel, rounded corners, full overlay).
 */
export function NotificationModal({
  isOpen,
  onClose,
  messages,
  unreadCount,
  onMessageClick,
  userId,
  userName = 'User',
  canWrite = false,
  allUsers = [],
  onComposerSuccess,
  onRefresh,
}: NotificationModalProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const { triggerHapticFeedback, playNotificationSound } = useMultisensorialFeedback();

  // Feedback aptico all'apertura
  useEffect(() => {
    if (isOpen) {
      triggerHapticFeedback('click');
      try {
        playNotificationSound();
      } catch (e) {
        console.warn('Audio play blocked');
      }
      // Reset composer state all'apertura
      setIsComposerOpen(false);
    }
  }, [isOpen, triggerHapticFeedback, playNotificationSound]);

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
        className="fixed inset-0 z-[10070] flex flex-col bg-black/50 backdrop-blur-sm w-screen h-screen overflow-hidden"
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="flex-1 flex flex-col bg-white dark:bg-neutral-950 w-full h-full overflow-hidden"
        >
          {/* Header Fisso - Stile PinPad */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white dark:bg-neutral-950 px-6 py-5 dark:border-neutral-800">
            <div className="flex-1" /> {/* Spacer per centrare il titolo */}
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-2 mb-0.5">
                <Mail className="w-5 h-5 text-accent dark:text-accent-light" strokeWidth={2.5} />
                <h2 className="text-slate-900 dark:text-neutral-100 font-bold uppercase tracking-wider text-sm">
                  COMUNICAZIONI STAFF
                </h2>
              </div>
              {unreadCount > 0 && (
                <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">
                  {unreadCount} nuovi messaggi
                </p>
              )}
            </div>
            <div className="flex-1 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-900 transition-transform active:scale-90 dark:bg-neutral-800 dark:text-white shadow-sm"
                aria-label="Chiudi"
              >
                <X className="h-7 w-7" strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* Contenuto Scrollabile */}
          <div className="flex-1 overflow-y-auto pb-10">
            <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 flex flex-col">
              
              {/* Area di Scrittura (Solo per Manager/Admin) - SPOSTATA IN CIMA */}
              {canWrite && (
                <div className="mb-8 overflow-hidden rounded-[32px] border-2 border-accent/20 bg-accent/5 p-6 dark:bg-accent/10 order-first shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-accent" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-accent">
                        Nuova Comunicazione
                      </h3>
                    </div>
                    {!isComposerOpen && (
                      <button
                        onClick={() => setIsComposerOpen(true)}
                        className="text-[10px] font-black uppercase tracking-widest text-accent underline underline-offset-4"
                      >
                        Apri Editor
                      </button>
                    )}
                  </div>
                  
                  {isComposerOpen ? (
                    <MessageComposer
                      userId={userId || ''}
                      userName={userName}
                      allUsers={allUsers}
                      onClose={() => setIsComposerOpen(false)}
                      onSuccess={() => {
                        setIsComposerOpen(false);
                        if (onComposerSuccess) onComposerSuccess();
                      }}
                    />
                  ) : (
                    <div 
                      onClick={() => setIsComposerOpen(true)}
                      className="cursor-pointer rounded-2xl border-2 border-dashed border-accent/30 py-10 text-center transition-colors hover:bg-accent/10 bg-white/50 dark:bg-black/20"
                    >
                      <p className="text-sm font-bold text-accent/70">
                        Clicca qui per scrivere un messaggio...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Lista Notifiche */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-2 mb-2">
                  <div className="h-[1px] flex-1 bg-slate-100 dark:bg-neutral-800" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                    Messaggi Recenti
                  </h3>
                  <div className="h-[1px] flex-1 bg-slate-100 dark:bg-neutral-800" />
                </div>

                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800">
                      <Mail className="h-10 w-10 text-slate-200 dark:text-neutral-800" />
                    </div>
                    <p className="text-lg font-bold text-slate-400 dark:text-neutral-600">
                      Nessun messaggio trovato
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isBroadcast = msg.message_type === 'broadcast';
                    const isUnread = !msg.is_read;

                    return (
                      <div
                        key={msg.id}
                        className={`group relative overflow-hidden rounded-[28px] border-2 transition-all duration-200 ${
                          isUnread
                            ? 'border-accent shadow-lg shadow-accent/5 bg-white dark:bg-neutral-900'
                            : 'border-slate-100 bg-slate-50/50 dark:border-neutral-800 dark:bg-neutral-900/40'
                        }`}
                      >
                        <div className="p-5">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                                isBroadcast 
                                  ? 'bg-green-100 text-green-600 dark:bg-green-950/40' 
                                  : 'bg-accent/10 text-accent dark:bg-accent/20'
                              }`}>
                                {isBroadcast ? <span className="text-xl">📢</span> : <Mail className="h-5 w-5" />}
                              </div>
                              <div>
                                <h4 className={`text-base font-black leading-tight ${
                                  isUnread ? 'text-accent' : 'text-slate-700 dark:text-neutral-300'
                                }`}>
                                  {msg.subject}
                                </h4>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                                  {msg.sender_name || 'Staff'} • {new Date(msg.created_at).toLocaleString('it-IT', { 
                                    day: '2-digit', 
                                    month: 'short', 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </p>
                              </div>
                            </div>
                            {isUnread && (
                              <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 ring-4 ring-red-500/20" />
                            )}
                          </div>

                          <p className="text-sm leading-relaxed text-slate-600 dark:text-neutral-400 whitespace-pre-wrap font-medium">
                            {msg.body}
                          </p>

                          {isUnread && (
                            <div className="mt-4 flex justify-end">
                              <button
                                type="button"
                                onClick={() => onMessageClick(msg.id)}
                                className="rounded-xl bg-accent px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-accent-hover shadow-md shadow-accent/20 active:scale-95"
                              >
                                Segna come letto
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          
          {/* Footer stile PinPad */}
          <div className="p-6 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50">
            <button
              onClick={onClose}
              className="w-full h-14 rounded-2xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 font-bold active:scale-95 transition-all hover:bg-slate-200 uppercase tracking-widest text-xs"
            >
              Chiudi Centro Messaggi
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
