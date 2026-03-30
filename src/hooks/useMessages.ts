import { useEffect, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { database } from '../lib/database';

export interface Message {
  id: string;
  sender_id: string;
  sender_name?: string;
  recipient_id?: string;
  message_type: 'broadcast' | 'private';
  subject: string;
  body: string;
  created_at: string;
  is_read: boolean;
  read_at?: string;
}

/**
 * Hook per gestire i messaggi dell'utente.
 * Fornisce lista messaggi, filtri, e funzioni per marcare come letti.
 */
export function useMessages(userId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [subscription, setSubscription] = useState<RealtimeChannel | null>(null);

  // Carica messaggi iniziali
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    loadMessages(userId);
  }, [userId]);

  // Sottoscrizione real-time ai messaggi
  useEffect(() => {
    if (!userId) return;

    try {
      // Validazione di sicurezza: verifica che database.supabase sia disponibile
      if (!database?.supabase) {
        console.warn('[useMessages] Supabase client not initialized, skipping real-time subscription');
        return;
      }

      const channel = database.supabase
        .channel(`messages:user:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            // Ricarica quando un nuovo messaggio arriva
            loadMessages(userId);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'message_reads',
          },
          (payload) => {
            // Aggiorna stato di lettura in tempo reale
            loadMessages(userId);
          }
        )
        .subscribe();

      setSubscription(channel);

      return () => {
        channel.unsubscribe();
      };
    } catch (err) {
      // Logga l'errore ma non crashare il componente
      console.error('[useMessages] Error subscribing to real-time messages:', err);
      // Continua a far funzionare il componente caricando i messaggi una volta sola
      return undefined;
    }
  }, [userId]);

  const loadMessages = useCallback(
    async (uid: string) => {
      try {
        setIsLoading(true);
        setError(null);

        // Aggiungi un timeout di sicurezza (5 secondi) per il fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          // Query per ottenere i messaggi dell'utente
          const response = await fetch(`/api/messages?userId=${uid}`, {
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          
          // Validazione risposta HTTP
          if (!response.ok) {
            throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
          }

          // Validazione content-type prima di parsare JSON
          const contentType = response.headers.get('content-type');
          if (!contentType?.includes('application/json')) {
            throw new Error(`Invalid content type: ${contentType}. Expected application/json`);
          }

          // Parsare JSON con validazione
          const data = (await response.json()) as { messages: Message[]; unreadCount: number };
          
          // Validare struttura dati
          if (!Array.isArray(data.messages)) {
            throw new Error('Invalid messages array in response');
          }

          setMessages(data.messages);
          setUnreadCount(data.unreadCount);
        } catch (err) {
          clearTimeout(timeoutId);
          
          // Distingui tra timeout e altri errori
          if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error('Timeout caricamento messaggi (5 secondi)');
          }
          
          throw err;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
        setError(errorMsg);
        console.error('[useMessages] Error loading messages:', err);
        // Non rethrow: permetti all'app di continuare anche se i messaggi falliscono
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Marca un messaggio come letto.
   */
  const markAsRead = useCallback(
    async (messageId: string) => {
      if (!userId) return false;

      try {
        const response = await fetch(`/api/messages/${messageId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to mark message as read');
        }

        // Aggiorna lo stato locale
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m))
        );

        setUnreadCount((prev) => Math.max(0, prev - 1));
        return true;
      } catch (err) {
        console.error('[useMessages] Error marking as read:', err);
        return false;
      }
    },
    [userId]
  );

  /**
   * Invia un nuovo messaggio.
   */
  const sendMessage = useCallback(
    async (subject: string, body: string, recipientId?: string) => {
      if (!userId) return false;

      try {
        const messageType = recipientId ? 'private' : 'broadcast';

        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject,
            body,
            message_type: messageType,
            recipient_id: recipientId || null,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        // Ricarica messaggi per riflettere il nuovo
        await loadMessages(userId);
        return true;
      } catch (err) {
        console.error('[useMessages] Error sending message:', err);
        return false;
      }
    },
    [userId, loadMessages]
  );

  /**
   * Filtra messaggi broadcast.
   */
  const broadcastMessages = messages.filter((m) => m.message_type === 'broadcast');

  /**
   * Filtra messaggi privati.
   */
  const privateMessages = messages.filter((m) => m.message_type === 'private');

  /**
   * Filtra messaggi non letti.
   */
  const unreadMessages = messages.filter((m) => !m.is_read);

  return {
    messages,
    broadcastMessages,
    privateMessages,
    unreadMessages,
    isLoading,
    error,
    unreadCount,
    markAsRead,
    sendMessage,
  };
}
