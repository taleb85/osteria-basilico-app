import { useState, useEffect, useRef } from 'react';
import { Bell, Mail, MessageCircle, X, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Message } from '../hooks/useMessages';

interface NotificationDropdownProps {
  messages: Message[];
  unreadCount: number;
  onMessageClick: (message: Message) => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dropdown campanella nell'header che mostra le ultime notifiche
 * con possibilità di cliccare per navigare al messaggio completo.
 */
export function NotificationDropdown({
  messages,
  unreadCount,
  onMessageClick,
  isOpen,
  onClose,
}: NotificationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);

  // Aggiorna messaggi recenti (ultimi 5, ordinati per data discendente)
  useEffect(() => {
    const sorted = [...messages]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
    setRecentMessages(sorted);
  }, [messages]);

  // Chiudi dropdown al click fuori
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleMessageClick = (message: Message) => {
    onMessageClick(message);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full z-50 mt-2 w-80 max-h-96 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-700 dark:text-neutral-300" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
            Ultime Notifiche
          </h3>
          {unreadCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <X className="h-4 w-4 text-slate-600 dark:text-neutral-400" />
        </button>
      </div>

      {/* Lista messaggi */}
      <div className="divide-y divide-slate-100 dark:divide-neutral-800 overflow-y-auto max-h-80">
        {recentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <MessageCircle className="h-8 w-8 text-slate-300 dark:text-neutral-700" />
            <p className="text-xs text-slate-500 dark:text-neutral-500">
              Nessuna notifica
            </p>
          </div>
        ) : (
          recentMessages.map((msg) => {
            const isBroadcast = msg.message_type === 'broadcast';
            const timeAgo = formatDistanceToNow(parseISO(msg.created_at), {
              addSuffix: true,
              locale: it,
            });
            const preview = msg.body.substring(0, 40) + (msg.body.length > 40 ? '...' : '');
            const isUnread = !msg.is_read;

            return (
              <button
                key={msg.id}
                type="button"
                onClick={() => handleMessageClick(msg)}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800 ${
                  isUnread ? 'bg-accent/5 dark:bg-accent/10' : ''
                }`}
              >
                <div className="flex gap-3">
                  {/* Icona */}
                  <div className="flex-shrink-0 pt-0.5">
                    {isBroadcast ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded bg-green-100 dark:bg-green-950/40 text-sm">
                        📢
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded bg-accent/10 dark:bg-accent/20">
                        <Mail className="h-3 w-3 text-accent dark:text-accent-light" />
                      </div>
                    )}
                  </div>

                  {/* Contenuto */}
                  <div className="min-w-0 flex-1">
                    {/* Titolo + Badge non letto */}
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-bold truncate ${
                        isUnread
                          ? 'text-slate-900 dark:text-neutral-100'
                          : 'text-slate-700 dark:text-neutral-400'
                      }`}>
                        {msg.subject}
                      </p>
                      {isUnread && (
                        <div className="h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                      )}
                    </div>

                    {/* Anteprima testo */}
                    <p className="text-xs text-slate-600 dark:text-neutral-400 truncate mt-0.5">
                      {preview}
                    </p>

                    {/* Tempo */}
                    <p className="text-[10px] text-slate-500 dark:text-neutral-500 mt-1">
                      {timeAgo}
                    </p>
                  </div>

                  {/* Freccia */}
                  <div className="flex-shrink-0 pt-1">
                    <ChevronRight className="h-4 w-4 text-slate-400 dark:text-neutral-600" />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer: Link al centro messaggi */}
      {recentMessages.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-2 dark:border-neutral-700">
          <button
            type="button"
            onClick={() => {
              // TODO: Naviga a profilo con sezione messaggi
              onClose();
            }}
            className="w-full text-center text-xs font-semibold text-accent hover:text-accent-hover dark:text-accent-light dark:hover:text-accent transition-colors"
          >
            Visualizza Tutti →
          </button>
        </div>
      )}
    </div>
  );
}
