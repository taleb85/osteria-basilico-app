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
  }, [userId]);

  const loadMessages = useCallback(
    async (uid: string) => {
      try {
        setIsLoading(true);
        setError(null);

        // Query per ottenere i messaggi dell'utente
        const response = await fetch(`/api/messages?userId=${uid}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.statusText}`);
        }

        const data = (await response.json()) as { messages: Message[]; unreadCount: number };
        setMessages(data.messages);
        setUnreadCount(data.unreadCount);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
        setError(errorMsg);
        console.error('[useMessages] Error loading messages:', err);
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
