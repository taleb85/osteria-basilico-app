import { useState, useRef, useEffect } from 'react';
import { Bell, Edit2 } from 'lucide-react';
import { useMessages } from '../hooks/useMessages';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';
import { useApp } from '../context/AppContext';
import { NotificationModal } from './NotificationModal';
import { MessageComposer } from './MessageComposer';

interface UnifiedBellButtonProps {
  userId?: string;
  effectiveLanguage?: string;
  onMessageClick?: (messageId: string) => void;
}

/**
 * Campanella unificata per notifiche.
 * Combina:
 * - Badge numero notifiche non lette
 * - Click breve → Dropdown messaggi
 * - Long press → Toggle mute audio
 * - Feedback aptico
 */
export function UnifiedBellButton({
  userId,
  effectiveLanguage = 'it',
  onMessageClick,
}: UnifiedBellButtonProps) {
  const { messages, unreadCount, markAsRead, loadMessages, isLoading, error } = useMessages(userId);
  const { triggerHapticFeedback, isSoundEnabled, setIsSoundEnabled } =
    useMultisensorialFeedback();
  const { currentUser, users } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleRefresh = () => {
    if (userId && typeof loadMessages === 'function') {
      loadMessages(userId);
    }
  };

  // Cleanup timer al unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleMouseDown = () => {
    setIsLongPress(false);
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPress(true);
      // Toggle mute
      setIsSoundEnabled(!isSoundEnabled);
      // Feedback aptico
      triggerHapticFeedback(isSoundEnabled ? 'warning' : 'success');
    }, 500); // 500ms per long press
  };

  const handleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Se non è stato long press, è un click breve
    if (!isLongPress) {
      setIsModalOpen(true);
      // Feedback aptico per click breve
      triggerHapticFeedback('click');
    }

    setIsLongPress(false);
  };

  const handleMessageClick = (messageId: string) => {
    // Marca come letto
    markAsRead(messageId);
    // Callback esterno se fornito
    if (onMessageClick) {
      onMessageClick(messageId);
    }
  };

  // Se il caricamento fallisce, mostra una campanella grigia statica
  const isDisabled = isLoading || !!error;

  return (
    <div className="relative">
      {/* Pulsante Campanella */}
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={!isDisabled ? handleMouseDown : undefined}
        onMouseUp={!isDisabled ? handleMouseUp : undefined}
        onMouseLeave={!isDisabled ? handleMouseUp : undefined}
        onTouchStart={!isDisabled ? handleMouseDown : undefined}
        onTouchEnd={!isDisabled ? handleMouseUp : undefined}
        disabled={isDisabled}
        title={
          error
            ? `Errore caricamento notifiche: ${error}`
            : isLoading
              ? 'Caricamento notifiche...'
              : `Notifiche${unreadCount > 0 ? ` (${unreadCount} non lette)` : ''}`
        }
        aria-label={
          error
            ? `Errore caricamento notifiche`
            : isLoading
              ? 'Caricamento notifiche'
              : `Campanella notifiche${unreadCount > 0 ? ` con ${unreadCount} nuovi messaggi` : ''}`
        }
        className={`relative flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg surface-glass-sm px-1.5 transition-all duration-200 touch-manipulation bg-white dark:bg-neutral-950 shadow-sm border border-slate-100 dark:border-white/10 ${
          isDisabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:scale-105 active:scale-95'
        }`}
      >
        <Bell
          className={`h-5 w-5 sm:h-6 sm:w-6 transition-colors ${
            error
              ? 'text-slate-400 dark:text-slate-600'
              : isLoading
                ? 'text-slate-400 dark:text-slate-600 animate-pulse'
                : 'text-accent dark:text-accent-light' /* Verde Basilico #2D5A27 */
          }`}
          strokeWidth={2}
        />

        {/* Badge numero notifiche non lette - Nascosto quando count === 0 per header pulito */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-md">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {/* Indicatore mute */}
        {!isSoundEnabled && (
          <div
            className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-slate-500 border border-white dark:border-neutral-950 shadow-sm"
            title="Audio disabilitato"
            aria-label="Audio disabilitato"
          />
        )}
      </button>

      {/* Dropdown Messaggi - Mostrato solo se non c'è errore */}
      {!error && (
        <div className="absolute right-0 top-full z-50 mt-2">
          {/* Tasto Nuova Comunicazione (visibile solo a ADMIN/MANAGER) */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                <Edit2 className="h-3 w-3" />
                Nuova Comunicazione
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Notifiche Centrato */}
      <NotificationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        messages={messages}
        unreadCount={unreadCount}
        onMessageClick={(messageId) => {
          markAsRead(messageId);
          triggerHapticFeedback('success');
        }}
        userId={userId}
        userName={currentUser?.first_name}
        canWrite={currentUser?.role === 'admin' || currentUser?.role === 'manager'}
        allUsers={users.map((u) => ({
          id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
        }))}
        onComposerSuccess={() => {
          // Non chiudiamo il modal, lasciamo che il composer mostri il successo
        }}
        onRefresh={handleRefresh}
      />

      {/* Info tooltip long-press */}
      {unreadCount > 0 && (
        <div className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white pointer-events-none opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-neutral-950">
          Long press per mutare
        </div>
      )}
    </div>
  );
}
