import { useCallback } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Hook per navigare direttamente a un messaggio specifico nella scheda profilo.
 * Implementa il deep-linking per messaggi via campanella dropdown o push notifications.
 */
export function useMessageDeepLink() {
  const { setActiveTab } = useApp();

  /**
   * Naviga al profilo e scrolla alla sezione messaggi.
   * Marca il messaggio come letto e mostra il testo completo.
   */
  const navigateToMessage = useCallback(
    async (messageId: string, onMarkRead?: () => Promise<void>) => {
      try {
        // 1. Marca il messaggio come letto (se fornito callback)
        if (onMarkRead) {
          await onMarkRead();
        }

        // 2. Naviga al profilo (tab 'profilo')
        setActiveTab('profilo');

        // 3. Scrolla alla sezione messaggi con delay per permettere il render
        setTimeout(() => {
          const messagesSection = document.getElementById('messages-section');
          if (messagesSection) {
            messagesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // 4. Evidenzia il messaggio specifico con animazione
            const messageElement = document.getElementById(`message-${messageId}`);
            if (messageElement) {
              messageElement.classList.add('animate-pulse');
              messageElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

              // Rimuovi animazione dopo 3 secondi
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
    [setActiveTab]
  );

  /**
   * Analizza URL params per deep-linking via push notifications.
   * Es. /profilo?message=msg-id-123
   */
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
