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
        className={`relative flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-200 touch-manipulation bg-[#1a1a1a] dark:bg-black shadow-sm ${
          isDisabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:scale-105 active:scale-95'
        }`}
      >
        <Bell
          className={`h-5 w-5 sm:h-6 sm:w-6 transition-colors ${
            error
              ? 'text-slate-600'
              : isLoading
                ? 'text-slate-600 animate-pulse'
                : 'text-[#2D5A27]' /* Verde Basilico originale */
          }`}
          strokeWidth={2.5}
        />

        {/* Badge numero notifiche non lette - Rosso acceso con numero bianco */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-[10px] font-black text-white shadow-md ring-2 ring-[#1a1a1a]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {/* Indicatore mute */}
        {!isSoundEnabled && (
          <div
            className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-slate-500 border border-[#1a1a1a]"
            title="Audio disabilitato"
          />
        )}
      </button>

      {/* Info tooltip long-press */}
      {unreadCount > 0 && (
        <div className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white pointer-events-none opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-neutral-950">
          Long press per mutare
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
        onRefresh={handleRefresh}
      />
    </div>
  );
}
