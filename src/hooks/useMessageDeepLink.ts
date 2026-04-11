import { useCallback } from 'react';

/**
 * Hook per navigare direttamente a un messaggio specifico nella scheda profilo.
 * Implementa il deep-linking per messaggi via campanella dropdown o push notifications.
 */
export function useMessageDeepLink() {
  /**
   * Naviga al profilo e scrolla alla sezione messaggi.
   * Marca il messaggio come letto e mostra il testo completo.
   */
  const navigateToMessage = useCallback(
    async (messageId: string, onMarkRead?: () => Promise<void>) => {
      try {
        if (onMarkRead) {
          await onMarkRead();
        }

        window.dispatchEvent(
          new CustomEvent('osteria-navigate', {
            detail: { tab: 'profile' as const, anchor: 'messages-section' },
          })
        );

        setTimeout(() => {
          const messagesSection = document.getElementById('messages-section');
          if (messagesSection) {
            messagesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            const messageElement = document.getElementById(`message-${messageId}`);
            if (messageElement) {
              messageElement.classList.add('animate-pulse');
              messageElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

              setTimeout(() => {
                messageElement.classList.remove('animate-pulse');
              }, 3000);
            }
          }
        }, 100);

        return true;
      } catch (err) {
        console.error('[useMessageDeepLink] Error:', err);
        return false;
      }
    },
    []
  );

  const handleMessageUrlParam = useCallback(
    async (messageId: string, onMarkRead?: () => Promise<void>) => {
      return navigateToMessage(messageId, onMarkRead);
    },
    [navigateToMessage]
  );

  return {
    navigateToMessage,
    handleMessageUrlParam,
  };
}
