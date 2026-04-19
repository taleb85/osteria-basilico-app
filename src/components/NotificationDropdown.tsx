import { useState, useEffect, useRef } from 'react';
import { Bell, Mail, MessageCircle, X, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { it, enUS, es, fr, type Locale } from 'date-fns/locale';
import { Message } from '../hooks/useMessages';
import { getTranslations } from '../utils/translations';

const LOCALE_MAP: Record<string, Locale> = { it, en: enUS, es, fr };

interface NotificationDropdownProps {
  messages: Message[];
  unreadCount: number;
  onMessageClick: (message: Message) => void;
  isOpen: boolean;
  onClose: () => void;
  effectiveLanguage?: string;
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
  effectiveLanguage,
}: NotificationDropdownProps) {
  const t = getTranslations(effectiveLanguage as 'it' | 'en' | 'es' | 'fr');
  const dateLocale = LOCALE_MAP[effectiveLanguage ?? 'it'] ?? it;
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
      className="absolute right-0 top-full z-50 mt-2 w-80 max-h-96 rounded-lg border border-slate-200 bg-white shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-bold text-slate-900">
            {t.messages_latest}
          </h3>
          {unreadCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded hover:bg-slate-200 transition-colors"
          title="Chiudi"
          aria-label="Chiudi notifiche"
        >
          <X className="h-4 w-4 text-slate-600" />
        </button>
      </div>

      {/* Lista messaggi */}
      <div className="divide-y divide-slate-100 overflow-y-auto max-h-80">
        {recentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center px-4">
            <MessageCircle className="h-8 w-8 text-slate-300" />
            <p className="text-xs font-medium text-slate-600">
              {t.messages_no_new}
            </p>
            <p className="text-[11px] text-slate-500">
              {t.messages_all_read}
            </p>
          </div>
        ) : (
          recentMessages.map((msg) => {
            const isBroadcast = msg.message_type === 'broadcast';
            const timeAgo = formatDistanceToNow(parseISO(msg.created_at), {
              addSuffix: true,
              locale: dateLocale,
            });
            const preview = msg.body.substring(0, 40) + (msg.body.length > 40 ? '...' : '');
            const isUnread = !msg.is_read;

            return (
              <button
                key={msg.id}
                type="button"
                onClick={() => handleMessageClick(msg)}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                  isUnread ? 'bg-accent/5' : ''
                }`}
              >
                <div className="flex gap-3">
                  {/* Icona */}
                  <div className="flex-shrink-0 pt-0.5">
                    {isBroadcast ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded bg-brand-100 text-sm">
                        📢
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded bg-accent/10">
                        <Mail className="h-3 w-3 text-accent" />
                      </div>
                    )}
                  </div>

                  {/* Contenuto */}
                  <div className="min-w-0 flex-1">
                    {/* Titolo + Badge non letto */}
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-bold truncate ${
                        isUnread
                          ? 'text-slate-900'
                          : 'text-slate-700'
                      }`}>
                        {msg.subject}
                      </p>
                      {isUnread && (
                        <div className="h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                      )}
                    </div>

                    {/* Anteprima testo */}
                    <p className="text-xs text-slate-600 truncate mt-0.5">
                      {preview}
                    </p>

                    {/* Tempo */}
                    <p className="text-[10px] text-slate-500 mt-1">
                      {timeAgo}
                    </p>
                  </div>

                  {/* Freccia */}
                  <div className="flex-shrink-0 pt-1">
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer: Link al centro messaggi */}
      {recentMessages.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-2 bg-slate-50/50">
          <button
            type="button"
            onClick={() => {
              // TODO: Naviga a profilo con sezione messaggi
              onClose();
            }}
            className="w-full text-center text-xs font-semibold text-accent hover:text-accent-hover transition-colors py-1"
          >
            Visualizza Tutti →
          </button>
        </div>
      )}
    </div>
  );
}
