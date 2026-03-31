import { useState, useEffect } from 'react';
import { X, Mail, Bell, ChevronRight, Users, User, Edit2, Send, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useMessages, Message } from '../hooks/useMessages';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';
import { useApp } from '../context/AppContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  unreadCount: number;
  onMessageClick: (messageId: string) => void;
  userId?: string;
  userName?: string;
  onRefresh?: () => void;
  currentUser?: any;
}

/**
 * Modal per notifiche e messaggi con overlay oscurato e sfocato.
 * Utilizza createPortal per garantire che lo sfondo copra l'intero schermo e non sia limitato dall'header.
 */
export function NotificationModal({
  isOpen,
  onClose,
  messages,
  unreadCount,
  onMessageClick,
  currentUser,
}: NotificationModalProps) {
  const { triggerHapticFeedback, playNotificationSound } = useMultisensorialFeedback();
  const { users } = useApp();
  const { sendMessage, deleteMessage } = useMessages(currentUser?.id);

  useBodyScrollLock(isOpen);

  const [isStaffComposerOpen, setIsStaffComposerOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [staffSubject, setStaffSubject] = useState('');
  const [staffBody, setStaffBody] = useState('');
  const [isStaffSending, setIsStaffSending] = useState(false);
  const [messageType, setMessageType] = useState<'broadcast' | 'private'>('broadcast');
  const [selectedRecipientId, setSelectedRecipientId] = useState('');

  const [replyBody, setStaffReplyBody] = useState('');
  const [isReplying, setIsStaffReplying] = useState(false);
  const [isDeletingMsg, setIsDeletingMsg] = useState(false);

  // Feedback aptico all'apertura
  useEffect(() => {
    if (isOpen) {
      triggerHapticFeedback('click');
      try {
        playNotificationSound();
      } catch (e) {
        // Silenzioso se bloccato dal browser
      }
      // Reset composer state all'apertura
      setIsStaffComposerOpen(false);
      setSelectedMessage(null);
      setMessageType('broadcast');
      setSelectedRecipientId('');
    }
  }, [isOpen, triggerHapticFeedback, playNotificationSound]);

  // Chiudi modal con ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedMessage) {
          setSelectedMessage(null);
        } else if (isStaffComposerOpen) {
          setIsStaffComposerOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedMessage, isStaffComposerOpen]);

  const handleMessageClick = (msg: Message) => {
    onMessageClick(msg.id);
    setSelectedMessage(msg);
    triggerHapticFeedback('click');
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyBody.trim()) return;
    
    setIsStaffReplying(true);
    try {
      const ok = await sendMessage(
        `RE: ${selectedMessage.subject}`,
        replyBody.trim(),
        selectedMessage.sender_id
      );
      if (ok) {
        triggerHapticFeedback('success');
        setStaffReplyBody('');
        setSelectedMessage(null);
      }
    } finally {
      setIsStaffReplying(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (!window.confirm('Eliminare definitivamente questo messaggio?')) return;

    setIsDeletingMsg(true);
    try {
      const ok = await deleteMessage(msgId);
      if (ok) {
        triggerHapticFeedback('success');
        setSelectedMessage(null);
      }
    } finally {
      setIsDeletingMsg(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const modalContent = (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100000] flex items-center justify-center overflow-hidden p-4 font-sans"
      >
        {/* Overlay oscurato e sfocato che copre TUTTO lo schermo */}
        <button
          type="button"
          className="absolute inset-0 bg-black/85 backdrop-blur-md dark:bg-black/90 w-screen h-screen"
          aria-label="Chiudi"
          onClick={onClose}
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[340px] max-h-[85vh] flex flex-col bg-white dark:bg-neutral-900 rounded-[40px] shadow-2xl overflow-hidden border border-white/10 z-[100001]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Fisso - Stile PinPad FullScreen */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white dark:bg-neutral-950 px-5 py-4 dark:border-neutral-800">
            <div className="flex items-center gap-2 flex-1">
              {selectedMessage && (
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="p-2 -ml-2 rounded-full hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-400"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
              )}
              <div className="flex flex-col items-center flex-1 text-center">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  {selectedMessage ? 'Chat' : 'Comunicazioni'}
                </h2>
                {!selectedMessage && unreadCount > 0 && (
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                    {unreadCount} da leggere
                  </p>
                )}
              </div>
            </div>
          </div>

          {selectedMessage ? (
            /* VISTA CHAT / RISPOSTA */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-black/10">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Messaggio Originale */}
                <div className="flex flex-col items-start max-w-[90%] relative group">
                  <div className="bg-white dark:bg-neutral-800 rounded-2xl rounded-tl-none p-4 shadow-sm border border-slate-100 dark:border-white/5 w-full">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <p className="text-[10px] font-black text-accent uppercase tracking-widest">
                        {users.find(u => u.id === selectedMessage.sender_id)?.first_name || 'Staff'}
                      </p>
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => handleDeleteMessage(selectedMessage.id)}
                          disabled={isDeletingMsg}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Elimina messaggio"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                      {selectedMessage.subject}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                      {selectedMessage.body}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">
                      {new Date(selectedMessage.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Info Broadcast */}
                {selectedMessage.message_type === 'broadcast' && (
                  <div className="flex justify-center">
                    <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Comunicazione di gruppo
                    </span>
                  </div>
                )}
              </div>

              {/* Area Risposta */}
              <div className="p-4 bg-white dark:bg-neutral-900 border-t border-slate-100 dark:border-neutral-800">
                <div className="relative flex items-end gap-2">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setStaffReplyBody(e.target.value)}
                    placeholder="Rispondi..."
                    rows={1}
                    className="flex-1 max-h-32 resize-none rounded-2xl border-2 border-slate-100 bg-slate-50 dark:bg-neutral-800 dark:border-white/5 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus:border-accent"
                    style={{ height: 'auto' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={isReplying || !replyBody.trim()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/20 active:scale-90 transition-all disabled:opacity-50"
                  >
                    {isReplying ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* VISTA LISTA */
            <>
              {/* Area di Scrittura (TUTTI GLI UTENTI) */}
              <div className="p-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/30 dark:bg-black/10">
                <button
                  type="button"
                  onClick={() => setIsStaffComposerOpen((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-100 dark:border-white/10 py-3 text-xs font-bold text-accent transition-all active:scale-95 shadow-sm"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isStaffComposerOpen ? 'Annulla' : 'Messaggi'}</span>
                </button>

                {isStaffComposerOpen && (
                  <div className="mt-3 rounded-[24px] border-2 border-accent/20 bg-accent/5 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-accent">
                        Nuovo Messaggio
                      </h3>
                    </div>

                    {/* Tipo Destinatario */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setMessageType('broadcast')}
                        className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2 transition-all active:scale-95 ${
                          messageType === 'broadcast'
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-slate-100 bg-white text-slate-400 dark:border-neutral-800 dark:bg-neutral-900'
                        }`}
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Tutti</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessageType('private')}
                        className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2 transition-all active:scale-95 ${
                          messageType === 'private'
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-slate-100 bg-white text-slate-400 dark:border-neutral-800 dark:bg-neutral-900'
                        }`}
                      >
                        <User className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Privato</span>
                      </button>
                    </div>

                    {/* Selezione Destinatario Privato */}
                    {messageType === 'private' && (
                      <select
                        value={selectedRecipientId}
                        onChange={(e) => setSelectedRecipientId(e.target.value)}
                        className="w-full h-10 mb-2 rounded-xl border-2 border-slate-100 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-accent dark:border-neutral-800 dark:bg-neutral-900 dark:text-white appearance-none shadow-sm"
                      >
                        <option value="">Seleziona...</option>
                        {users
                          .filter((u) => u.id !== currentUser?.id && u.status === 'active')
                          .sort((a, b) => {
                            const getDeptPriority = (u: any) => {
                              const d = (u.department || '').toLowerCase();
                              if (d === 'sala_bar') return 1;
                              if (d === 'sala') return 2;
                              if (d === 'bar') return 3;
                              if (d === 'kitchen' || d === 'cucina') return 4;
                              return 5;
                            };
                            const pa = getDeptPriority(a);
                            const pb = getDeptPriority(b);
                            if (pa !== pb) return pa - pb;
                            return (a.sort_order ?? 0) - (b.sort_order ?? 0);
                          })
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {(u.first_name ?? '').toUpperCase()} {(u.last_name ?? '').toUpperCase()}
                            </option>
                          ))}
                      </select>
                    )}

                    <input
                      value={staffSubject}
                      onChange={(e) => setStaffSubject(e.target.value.toUpperCase())}
                      className="w-full mb-2 h-10 rounded-xl border-2 border-slate-100 bg-white px-4 text-xs font-black tracking-widest text-slate-900 outline-none focus:border-accent shadow-sm"
                      placeholder="OGGETTO"
                    />

                    <textarea
                      value={staffBody}
                      onChange={(e) => setStaffBody(e.target.value)}
                      rows={3}
                      className="w-full mb-3 rounded-xl border-2 border-slate-100 bg-white px-4 py-3 text-xs font-medium text-slate-900 outline-none focus:border-accent resize-none shadow-sm"
                      placeholder="Messaggio..."
                    />

                    <button
                      type="button"
                      disabled={isStaffSending || !staffSubject.trim() || !staffBody.trim() || (messageType === 'private' && !selectedRecipientId)}
                      onClick={async () => {
                        if (!currentUser?.id) return;
                        setIsStaffSending(true);
                        try {
                          const ok = await sendMessage(
                            staffSubject.trim(), 
                            staffBody.trim(),
                            messageType === 'private' ? selectedRecipientId : undefined
                          );
                          if (ok) {
                            triggerHapticFeedback('success');
                            try {
                              playNotificationSound();
                            } catch {
                              // ignore
                            }
                            setIsStaffComposerOpen(false);
                            setStaffSubject('');
                            setStaffBody('');
                            setMessageType('broadcast');
                            setSelectedRecipientId('');
                          } else {
                            triggerHapticFeedback('warning');
                          }
                        } finally {
                          setIsStaffSending(false);
                        }
                      }}
                      className="w-full h-12 rounded-xl bg-[#2D5A27] text-white font-black uppercase tracking-[0.15em] text-[10px] shadow-lg shadow-accent/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
                    >
                      {isStaffSending ? 'INVIO...' : 'INVIA ORA'}
                    </button>
                  </div>
                )}
              </div>

              {/* Lista Messaggi Compatta */}
              <div className="flex-1 overflow-y-auto bg-white dark:bg-neutral-950">
                <div className="w-full divide-y divide-slate-50 dark:divide-neutral-800/50">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800">
                        <Mail className="h-8 w-8 text-slate-200 dark:text-neutral-700" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Tutto in ordine!</h3>
                      <p className="text-[11px] font-medium text-slate-400 dark:text-neutral-500">
                        Nessuna comunicazione.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isBroadcast = msg.message_type === 'broadcast';
                      const isUnread = !msg.is_read;

                      return (
                        <button
                          key={msg.id}
                          onClick={() => handleMessageClick(msg)}
                          className={`w-full flex items-center gap-3 px-5 py-4 transition-all active:bg-slate-50 dark:active:bg-neutral-800 text-left group ${
                            isUnread ? 'bg-accent/5 dark:bg-accent/10' : 'bg-transparent'
                          }`}
                        >
                          {/* Icona Circolare (Sinistra) */}
                          <div className="flex-shrink-0">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 transition-transform group-hover:scale-105 ${
                              isBroadcast 
                                ? 'bg-green-50 border-green-100 text-green-600 dark:bg-green-950/20 dark:border-green-900/30' 
                                : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-neutral-800 dark:border-neutral-700'
                            }`}>
                              {isBroadcast ? <span className="text-base">📢</span> : <Mail className="h-4 w-4" />}
                            </div>
                          </div>

                          {/* Contenuto (Centro) */}
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-xs font-bold truncate ${
                              isUnread ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-neutral-400'
                            }`}>
                              {msg.subject}
                            </h4>
                            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-tight mt-0.5">
                              <span>
                                {msg.sender_id === currentUser?.id 
                                  ? 'Tu' 
                                  : users.find(u => u.id === msg.sender_id)?.first_name || 'Staff'}
                              </span>
                              <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-neutral-700" />
                              <span>{new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>

                          {/* Badge/Stato (Destra) */}
                          <div className="flex-shrink-0">
                            {isUnread ? (
                              <div className="h-2 w-2 rounded-full bg-[#EF4444] shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-200 dark:text-neutral-800" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
          
          {/* Footer stile PinPad */}
          <div className="p-5 border-t border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <button
              onClick={onClose}
              className="w-full h-12 rounded-2xl bg-[#2D5A27] text-white font-black uppercase tracking-[0.15em] text-[11px] active:scale-[0.98] transition-all shadow-xl shadow-[#2D5A27]/20"
            >
              Chiudi
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
