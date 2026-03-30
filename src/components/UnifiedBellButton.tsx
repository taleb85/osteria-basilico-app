import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useMessages } from '../hooks/useMessages';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';
import { NotificationDropdown } from './NotificationDropdown';

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
  const { messages, unreadCount, markAsRead } = useMessages(userId);
  const { triggerHapticFeedback, isSoundEnabled, setIsSoundEnabled } =
    useMultisensorialFeedback();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
      setIsDropdownOpen(!isDropdownOpen);
      // Feedback aptico per click breve
      triggerHapticFeedback('click');
    }

    setIsLongPress(false);
  };

  const handleMessageClick = (messageId: string) => {
    // Marca come letto
    markAsRead(messageId);
    // Chiudi dropdown
    setIsDropdownOpen(false);
    // Callback esterno se fornito
    if (onMessageClick) {
      onMessageClick(messageId);
    }
  };

  return (
    <div className="relative">
      {/* Pulsante Campanella */}
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        title={`Notifiche${unreadCount > 0 ? ` (${unreadCount} non lette)` : ''}`}
        aria-label={`Campanella notifiche${unreadCount > 0 ? ` con ${unreadCount} nuovi messaggi` : ''}`}
        className="relative flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg surface-glass-sm px-1.5 transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation bg-white dark:bg-neutral-950 shadow-sm border border-slate-100 dark:border-white/10"
      >
        <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-accent dark:text-accent-light" strokeWidth={2} />

        {/* Badge numero notifiche non lette */}
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

      {/* Dropdown Messaggi */}
      {isDropdownOpen && (
        <div className="absolute right-0 top-full z-50 mt-2">
          <NotificationDropdown
            messages={messages}
            unreadCount={unreadCount}
            onMessageClick={(msg) => handleMessageClick(msg.id)}
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
          />
        </div>
      )}

      {/* Info tooltip long-press */}
      {unreadCount > 0 && !isDropdownOpen && (
        <div className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white pointer-events-none opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-neutral-950">
          Long press per mutare
        </div>
      )}
    </div>
  );
}
