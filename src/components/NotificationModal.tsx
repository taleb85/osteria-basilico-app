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
}

/**
 * Modal centrato per notifiche e messaggi.
 * Overlay scuro semi-trasparente.
 * Responsive: 90vw su mobile, 600px su desktop.
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
}: NotificationModalProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const { triggerHapticFeedback, playNotificationSound } = useMultisensorialFeedback();
  const modalRef = useRef<HTMLDivElement>(null);

  // Feedback aptico all'apertura
  useEffect(() => {
    if (isOpen) {
      triggerHapticFeedback('click');
      playNotificationSound();
    }
  }, [isOpen, triggerHapticFeedback, playNotificationSound]);

  // Chiudi modal al click su overlay
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200"
      onClick={handleOverlayClick}
    >
      {/* Modal Principale */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-4 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
              <Send className="h-4 w-4 text-accent" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-neutral-100">
              Notifiche
            </h2>
            {unreadCount > 0 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Chiudi notifiche"
          >
            <X className="h-5 w-5 text-slate-600 dark:text-neutral-400" />
          </button>
        </div>

        {/* Contenuto */}
        <div className="flex-1 overflow-y-auto">
          {isComposerOpen ? (
            /* Composer */
            <div className="p-4 sm:p-6">
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
            </div>
          ) : (
            /* Messaggi */
            <div className="divide-y divide-slate-100 dark:divide-neutral-800">
              {/* Tasto Nuova Comunicazione (Composer) */}
              {canWrite && (
                <div className="p-4 sm:p-6 bg-accent/5 dark:bg-accent/10 border-b border-accent/20">
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                  >
                    <Send className="h-4 w-4" />
                    Nuova Comunicazione
                  </button>
                </div>
              )}

              {/* Lista Messaggi */}
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-neutral-800">
                    <Send className="h-6 w-6 text-slate-400 dark:text-neutral-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-neutral-300">
                      Nessun nuovo messaggio
                    </p>
                    <p className="text-xs text-slate-500 dark:text-neutral-500 mt-1">
                      Tutti i messaggi sono stati letti
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isBroadcast = msg.message_type === 'broadcast';
                  const isUnread = !msg.is_read;

                  return (
                    <div
                      key={msg.id}
                      className={`p-4 sm:p-6 transition-colors ${
                        isUnread
                          ? 'bg-accent/5 dark:bg-accent/10'
                          : 'bg-slate-50/50 dark:bg-neutral-800/30'
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Icona */}
                        <div className="flex-shrink-0 pt-0.5">
                          {isBroadcast ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
                              <span className="text-base">📢</span>
                            </div>
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 dark:bg-accent/20">
                              <Mail className="h-4 w-4 text-accent" />
                            </div>
                          )}
                        </div>

                        {/* Contenuto */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-accent">
                              {msg.subject}
                            </h3>
                            {isUnread && (
                              <div className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                            )}
                          </div>

                          <p className="text-xs sm:text-sm text-slate-700 dark:text-neutral-300 mt-1 whitespace-pre-wrap break-words">
                            {msg.body}
                          </p>

                          <div className="flex items-center gap-3 mt-3 text-xs text-slate-500 dark:text-neutral-500">
                            <span>{msg.sender_name || 'Sconosciuto'}</span>
                            <span>•</span>
                            <span>{new Date(msg.created_at).toLocaleString('it-IT')}</span>
                          </div>

                          {/* Azioni */}
                          {isUnread && (
                            <button
                              type="button"
                              onClick={() => onMessageClick(msg.id)}
                              className="mt-3 text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
                            >
                              Segna come letto →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
