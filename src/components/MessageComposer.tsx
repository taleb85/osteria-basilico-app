import { useState, useRef } from 'react';
import { Send, X, Loader2, Users, User } from 'lucide-react';
import { useMessages } from '../hooks/useMessages';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';

interface MessageComposerProps {
  userId: string;
  userName: string;
  allUsers: Array<{ id: string; first_name: string; last_name: string }>;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Composer per messaggi staff - Versione FULL-SCREEN.
 * Ottimizzato per la visibilità e l'uso su mobile.
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
        triggerHapticFeedback('success');
        setSuccessMessage(true);

        setTimeout(() => {
          setSuccessMessage(false);
          setSubject('');
          setBody('');
          setSelectedRecipientId('');
          setMessageType('broadcast');
          if (onSuccess) onSuccess();
        }, 1500);
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
    <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
      {/* Feedback Successo */}
      {successMessage && (
        <div className="flex items-center justify-center gap-3 rounded-xl bg-green-500 p-4 text-white shadow-lg shadow-green-500/20">
          <div className="flex h-8 w-8 animate-bounce items-center justify-center rounded-full bg-white text-green-500">
            <Send className="h-4 w-4" />
          </div>
          <span className="font-black uppercase tracking-widest text-sm">Messaggio inviato! ✅</span>
        </div>
      )}

      {/* Errore */}
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600 dark:bg-red-950/30">
          ⚠️ {error}
        </div>
      )}

      {/* Tipo Destinatario */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMessageType('broadcast')}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 transition-all ${
            messageType === 'broadcast'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-slate-100 bg-white text-slate-400 dark:border-neutral-800 dark:bg-neutral-900'
          }`}
        >
          <Users className="h-4 w-4" />
          <span className="text-xs font-black uppercase tracking-wider">Tutti (Staff)</span>
        </button>
        <button
          type="button"
          onClick={() => setMessageType('private')}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 transition-all ${
            messageType === 'private'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-slate-100 bg-white text-slate-400 dark:border-neutral-800 dark:bg-neutral-900'
          }`}
        >
          <User className="h-4 w-4" />
          <span className="text-xs font-black uppercase tracking-wider">Privato</span>
        </button>
      </div>

      {/* Selezione Destinatario Privato */}
      {messageType === 'private' && (
        <select
          value={selectedRecipientId}
          onChange={(e) => setSelectedRecipientId(e.target.value)}
          className="w-full rounded-xl border-2 border-slate-100 bg-white p-3 text-sm font-bold text-slate-900 outline-none focus:border-accent dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
        >
          <option value="">Seleziona dipendente...</option>
          {allUsers
            .filter((u) => u.id !== userId)
            .sort((a, b) => a.first_name.localeCompare(b.first_name))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name.toUpperCase()} {u.last_name.toUpperCase()}
              </option>
            ))}
        </select>
      )}

      {/* Oggetto */}
      <input
        type="text"
        placeholder="OGGETTO DEL MESSAGGIO..."
        value={subject}
        onChange={(e) => setSubject(e.target.value.toUpperCase())}
        className="w-full rounded-xl border-2 border-slate-100 bg-white p-3 text-sm font-black tracking-wider text-slate-900 outline-none focus:border-accent dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
      />

      {/* Corpo Messaggio */}
      <textarea
        ref={bodyInputRef}
        placeholder="SCRIVI QUI IL TUO MESSAGGIO..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full resize-none rounded-xl border-2 border-slate-100 bg-white p-3 text-sm font-medium leading-relaxed text-slate-900 outline-none focus:border-accent dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
      />

      {/* Pulsanti Azione */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl bg-slate-100 py-4 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-400"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || successMessage}
          className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-accent py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-hover disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isSending ? 'Invio in corso...' : 'Invia Comunicazione'}
        </button>
      </div>
    </div>
  );
}
