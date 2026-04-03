import { useState, useRef } from 'react';
import { useMessages } from '../hooks/useMessages';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';
import { useApp } from '../context/AppContext';
import { NotificationModal } from './NotificationModal';

interface UnifiedBellButtonProps {
  userId?: string;
  effectiveLanguage?: string;
  onMessageClick?: (messageId: string) => void;
}

/**
 * Campanella unificata per notifiche.
 * Apre il centro messaggi al click.
 */
export function UnifiedBellButton({
  userId,
  onMessageClick,
}: UnifiedBellButtonProps) {
  const { messages, unreadCount, markAsRead, loadMessages, isLoading, error } = useMessages(userId);
  const { triggerHapticFeedback } = useMultisensorialFeedback();
  const { currentUser } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleRefresh = () => {
    if (userId && typeof loadMessages === 'function') {
      loadMessages(userId);
    }
  };

  // Per ora lo teniamo sempre attivo per test, o comunque non bloccato da caricamento
  const isDisabled = !!error;

  return (
    <div className="relative shrink-0">
      {/* Pulsante Campanella */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isDisabled) {
            setIsModalOpen(true);
            triggerHapticFeedback('click');
          }
        }}
        disabled={isDisabled}
        title={
          error
            ? `Errore caricamento notifiche: ${error}`
            : `Notifiche${unreadCount > 0 ? ` (${unreadCount} non lette)` : ''}`
        }
        aria-label={
          error
            ? `Errore caricamento notifiche`
            : `Campanella notifiche${unreadCount > 0 ? ` con ${unreadCount} nuovi messaggi` : ''}`
        }
        className={`relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-neutral-900 border border-slate-100 dark:border-white/10 shadow-sm transition-all duration-200 touch-manipulation hover:bg-blue-50 dark:hover:bg-blue-950/30 ${
          isDisabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:scale-105 active:scale-95'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-5 w-5 sm:h-6 sm:w-6 transition-colors ${
            error
              ? 'text-slate-400 dark:text-slate-600'
              : 'text-accent'
          }`}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge numero notifiche non lette - Rosso acceso con numero bianco */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-black text-white shadow-md ring-2 ring-white dark:ring-neutral-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Modal Notifiche Centrato */}
      <NotificationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        messages={messages}
        unreadCount={unreadCount}
        onMessageClick={(messageId) => {
          markAsRead(messageId);
          triggerHapticFeedback('success');
          if (onMessageClick) onMessageClick(messageId);
        }}
        userId={userId}
        userName={currentUser?.first_name}
        onRefresh={handleRefresh}
        currentUser={currentUser}
      />
    </div>
  );
}
