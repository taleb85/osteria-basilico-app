import { useCallback, useId, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Language } from '../types';
import { getTranslations } from '../utils/translations';
import { resolveEffectiveVerificationToken } from '../utils/presenceVerificationPayload';
import PunchPresenceVerificationModal from '../components/PunchPresenceVerificationModal';

/**
 * Se la verifica QR è attiva, apre la modale e restituisce il payload letto; altrimenti stringa vuota.
 * Il manager che timbra per un altro dipendente è escluso (come per il geofence).
 */
export function usePunchPresenceVerification(language: Language) {
  const { presenceVerificationConfig, currentUser } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const resolverRef = useRef<((value: string) => void) | null>(null);
  const rejecterRef = useRef<(() => void) | null>(null);
  const modalId = useId();
  const readerId = `punch-qr-reader-${modalId.replace(/:/g, '')}`;

  const effectiveToken = resolveEffectiveVerificationToken(presenceVerificationConfig);

  const needsModal = useCallback(
    (punchUserId: string) => {
      const managerBypass = !!(currentUser && currentUser.id !== punchUserId);
      if (managerBypass) return false;
      // Regola di base: la scansione QR è SEMPRE obbligatoria per i dipendenti
      return true;
    },
    [currentUser, effectiveToken]
  );

  const requestProof = useCallback(
    (punchUserId: string): Promise<string> => {
      if (!needsModal(punchUserId)) {
        return Promise.resolve('');
      }
      return new Promise((resolve, reject) => {
        resolverRef.current = resolve;
        rejecterRef.current = () => reject(new Error('presence_cancelled'));
        setModalOpen(true);
      });
    },
    [needsModal]
  );

  const handleVerified = useCallback((text: string) => {
    const trimmed = text.trim();
    console.info('[presence-proof] QR letto dalla fotocamera; validazione firma/token in addPunchRecord', {
      length: trimmed.length,
      prefix: trimmed.slice(0, 24),
    });
    setModalOpen(false);
    resolverRef.current?.(trimmed);
    resolverRef.current = null;
    rejecterRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setModalOpen(false);
    rejecterRef.current?.();
    resolverRef.current = null;
    rejecterRef.current = null;
  }, []);

  const t = getTranslations(language);

  const modal = (
    <PunchPresenceVerificationModal
      open={modalOpen}
      onClose={handleCancel}
      onVerified={handleVerified}
      qrContainerId={readerId}
      language={language}
      title={t.punch_presence_modal_title}
      subtitle={t.punch_presence_modal_subtitle}
    />
  );

  return { requestProof, needsModal, modal, effectiveToken };
}
