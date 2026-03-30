import { useState, useEffect, useRef } from 'react';
import { X, Send, Mail } from 'lucide-react';
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
 * Occupa il 100% della larghezza e altezza dello schermo.
 * Header fisso, area di scrittura in alto per Manager, lista messaggi sotto.
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
  const modalRef = useRef<HTMLDivElement>(null);

  // Feedback aptico all'apertura
  useEffect(() => {
    if (isOpen) {
      triggerHapticFeedback('click');
      // Riproduci suono solo se l'utente ha interagito (gestito internamente o silenziosamente)
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
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-white dark:bg-neutral-950 w-screen h-screen overflow-hidden">
      {/* Header Fisso */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-950 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
            <Send className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              COMUNICAZIONI STAFF
            </h2>
            {unreadCount > 0 && (
              <p className="text-xs font-bold text-red-500 uppercase tracking-wider">
                {unreadCount} nuovi messaggi
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-900 transition-transform active:scale-90 dark:bg-neutral-800 dark:text-white"
          aria-label="Chiudi"
        >
          <X className="h-10 w-10" strokeWidth={3} />
        </button>
      </div>

      {/* Contenuto Scrollabile */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 flex flex-col">
          {/* Area di Scrittura (Solo per Manager/Admin) - SPOSTATA IN CIMA */}
          {canWrite && (
            <div className="mb-8 overflow-hidden rounded-2xl border border-accent/20 bg-accent/5 p-4 dark:bg-accent/10 sm:p-6 order-first shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-accent">
                  Nuovo Messaggio
                </h3>
                {!isComposerOpen && (
                  <button
                    onClick={() => setIsComposerOpen(true)}
                    className="text-xs font-bold text-accent underline underline-offset-4"
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
                  className="cursor-pointer rounded-xl border-2 border-dashed border-accent/30 py-8 text-center transition-colors hover:bg-accent/10"
                >
                  <p className="text-sm font-medium text-accent/70">
                    Clicca qui per scrivere una nuova comunicazione...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Lista Notifiche */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">
              Messaggi Recenti
            </h3>

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 dark:bg-neutral-900">
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
                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 ${
                      isUnread
                        ? 'border-accent/30 bg-white shadow-lg shadow-accent/5 dark:bg-neutral-900'
                        : 'border-slate-100 bg-slate-50/50 dark:border-neutral-800 dark:bg-neutral-900/40'
                    }`}
                  >
                    <div className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
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
                          <span className="flex h-2 w-2 rounded-full bg-red-500 ring-4 ring-red-500/20" />
                        )}
                      </div>

                      <p className="text-sm leading-relaxed text-slate-600 dark:text-neutral-400 whitespace-pre-wrap">
                        {msg.body}
                      </p>

                      {isUnread && (
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => onMessageClick(msg.id)}
                            className="rounded-lg bg-accent/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-accent transition-colors hover:bg-accent hover:text-white"
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
    </div>
  );
}
