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

  const loadMessages = useCallback(
    async (uid: string) => {
      if (!uid) return;
      try {
        setIsLoading(true);
        setError(null);

        // Validazione di sicurezza: verifica che database.supabase sia disponibile
        if (!database?.supabase) {
          setMessages([]);
          setUnreadCount(0);
          return;
        }

        // Query nativa Supabase dalla tabella 'staff_messages'
        const { data, error: supabaseError } = await database.supabase
          .from('staff_messages')
          .select('*')
          .or(`recipient_id.is.null,recipient_id.eq.${uid}`)
          .order('created_at', { ascending: false });

        // Gestione errori Supabase
        if (supabaseError) {
          if (supabaseError.code === 'PGRST116' || supabaseError.code === '42501') {
            setMessages([]);
            setUnreadCount(0);
            return;
          }
          throw supabaseError;
        }

        if (!data) {
          setMessages([]);
          setUnreadCount(0);
          return;
        }

        if (!Array.isArray(data)) {
          throw new Error('Invalid messages array in response');
        }

        const unread = data.filter((m) => !m.is_read).length;
        setMessages(data as Message[]);
        setUnreadCount(unread);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Carica messaggi iniziali
  useEffect(() => {
    if (!database?.supabase || !userId) {
      if (!userId) setIsLoading(false);
      return;
    }
    loadMessages(userId);
  }, [userId, loadMessages]);

  // Sottoscrizione real-time ai messaggi
  useEffect(() => {
    if (!userId || !database?.supabase) return;

    try {
      const channel = database.supabase
        .channel(`staff_messages:user:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'staff_messages',
          },
          () => {
            loadMessages(userId);
          }
        )
        .subscribe();

      setSubscription(channel);

      return () => {
        channel.unsubscribe();
      };
    } catch (err) {
      console.error('[useMessages] Real-time error:', err);
      return undefined;
    }
  }, [userId, loadMessages]);

  /**
   * Marca un messaggio come letto.
   */
  const markAsRead = useCallback(
    async (messageId: string) => {
      if (!userId) return false;

      try {
        // Validazione di sicurezza
        if (!database?.supabase) {
          console.warn('[useMessages] Supabase client not initialized');
          return false;
        }

        // Update messaggio in Supabase
        const { error: supabaseError } = await database.supabase
          .from('staff_messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', messageId);

        // Gestione errori Supabase
        if (supabaseError) {
          // Gestione RLS errors (403)
          if (supabaseError.code === 'PGRST116' || supabaseError.code === '42501') {
            console.warn('[useMessages] Permission denied (RLS) marking as read');
            return false;
          }

          throw supabaseError;
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
        // Validazione di sicurezza
        if (!database?.supabase) {
          console.warn('[useMessages] Supabase client not initialized');
          return false;
        }

        const messageType = recipientId ? 'private' : 'broadcast';

        // Insert messaggio in Supabase
        const { error: supabaseError } = await database.supabase
          .from('staff_messages')
          .insert({
            sender_id: userId,
            message_type: messageType,
            subject,
            body,
            recipient_id: recipientId || null,
            is_read: false,
            created_at: new Date().toISOString(),
          });

        // Gestione errori Supabase
        if (supabaseError) {
          // Gestione RLS errors (403)
          if (supabaseError.code === 'PGRST116' || supabaseError.code === '42501') {
            console.warn('[useMessages] Permission denied (RLS) sending message');
            return false;
          }

          throw supabaseError;
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
    loadMessages,
  };
}
