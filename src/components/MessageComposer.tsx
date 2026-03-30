import { useState, useRef } from 'react';
import { Send, X, Loader2 } from 'lucide-react';
import { useMessages } from '../hooks/useMessages';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';
import { database } from '../lib/database';

interface MessageComposerProps {
  userId: string;
  userName: string;
  allUsers: Array<{ id: string; first_name: string; last_name: string }>;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Composer per messaggi staff.
 * Visibile solo a ADMIN/MANAGER.
 * Permette invio broadcast o privato.
 */
export function MessageComposer({
  userId,
  userName,
  allUsers,
  onClose,
  onSuccess,
}: MessageComposerProps) {
  const { sendMessage } = useMessages(userId);
  const { triggerHapticFeedback } = useMultisensorialFeedback();

  const [messageType, setMessageType] = useState<'broadcast' | 'private'>('broadcast');
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!subject.trim()) {
      setError('Inserisci un oggetto');
      return;
    }

    if (!body.trim()) {
      setError('Inserisci un messaggio');
      return;
    }

    if (messageType === 'private' && !selectedRecipientId) {
      setError('Seleziona un destinatario');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const success = await sendMessage(
        subject.trim(),
        body.trim(),
        messageType === 'private' ? selectedRecipientId : undefined
      );

      if (success) {
        // Feedback positivo
        triggerHapticFeedback('success');
        setSuccessMessage(true);

        // Chiudi il composer dopo 2 secondi
        setTimeout(() => {
          setSuccessMessage(false);
          setSubject('');
          setBody('');
          setSelectedRecipientId('');
          setMessageType('broadcast');
          onClose();
          if (onSuccess) onSuccess();
        }, 2000);
      } else {
        setError('Errore nell\'invio del messaggio');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-lg border border-accent/30 bg-white dark:bg-neutral-900 p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-neutral-100">
          <Send className="h-4 w-4 text-accent" />
          Nuova Comunicazione
        </h3>
        <button
          type="button"
          onClick={onClose}
          disabled={isSending}
          className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          aria-label="Chiudi composer"
        >
          <X className="h-4 w-4 text-slate-600 dark:text-neutral-400" />
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-3 rounded-lg bg-green-100 p-3 text-sm font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-300">
          ✓ Messaggio inviato con successo!
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
          ✕ {error}
        </div>
      )}

      {/* Destinatario */}
      <div className="mb-3 space-y-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300">
          Destinatario:
        </label>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-300">
            <input
              type="radio"
              name="msgType"
              value="broadcast"
              checked={messageType === 'broadcast'}
              onChange={() => {
                setMessageType('broadcast');
                setSelectedRecipientId('');
              }}
              disabled={isSending}
              className="h-4 w-4"
            />
            📢 Tutti
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-300">
            <input
              type="radio"
              name="msgType"
              value="private"
              checked={messageType === 'private'}
              onChange={() => setMessageType('private')}
              disabled={isSending}
              className="h-4 w-4"
            />
            ✉️ Privato
          </label>
        </div>
      </div>

      {/* Seleziona destinatario privato */}
      {messageType === 'private' && (
        <div className="mb-3">
          <select
            value={selectedRecipientId}
            onChange={(e) => setSelectedRecipientId(e.target.value)}
            disabled={isSending}
            className="w-full rounded-lg border border-accent/30 bg-white px-3 py-2 text-sm dark:border-accent/50 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="">Seleziona destinatario...</option>
            {allUsers
              .filter((u) => u.id !== userId)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Oggetto */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">
          Oggetto:
        </label>
        <input
          type="text"
          placeholder="Es. Riunione, Cena stasera..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={isSending}
          maxLength={100}
          className="w-full rounded-lg border border-accent/30 bg-white px-3 py-2 text-sm placeholder-accent/40 dark:border-accent/50 dark:bg-neutral-800 dark:text-neutral-100 disabled:opacity-50"
        />
        <p className="text-[10px] text-slate-500 dark:text-neutral-500 mt-1">
          {subject.length}/100
        </p>
      </div>

      {/* Messaggio */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">
          Messaggio:
        </label>
        <textarea
          ref={bodyInputRef}
          placeholder="Scrivi il tuo messaggio..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isSending}
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border border-accent/30 bg-white px-3 py-2 text-sm placeholder-accent/40 resize-none dark:border-accent/50 dark:bg-neutral-800 dark:text-neutral-100 disabled:opacity-50"
        />
        <p className="text-[10px] text-slate-500 dark:text-neutral-500 mt-1">
          {body.length}/500
        </p>
      </div>

      {/* Pulsanti */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-60 dark:bg-accent dark:hover:bg-accent-hover"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isSending ? 'Invio...' : 'Invia'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSending}
          className="rounded-lg border border-accent/30 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 dark:border-accent/50 dark:text-accent-light dark:hover:bg-accent/20 disabled:opacity-50"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
