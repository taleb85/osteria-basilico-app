import { useState } from 'react';
import { useAppUser } from '../context/appSliceContexts';
import { useAppData } from '../context/appSliceContexts';
import { useAppOverlay } from '../context/appSliceContexts';
import { useT } from '../hooks/useT';
import { format } from 'date-fns';
import { usePunchPresenceVerification } from '../hooks/usePunchPresenceVerification';
import { PinPadModal } from './ui/PinPadModal';
import { AnimatePresence } from 'framer-motion';

interface PunchClockTerminalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PunchClockTerminal({ isOpen, onClose }: PunchClockTerminalProps) {
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);
  const { users, effectiveLanguage } = useAppUser();
  const { addPunchRecord } = useAppData();
  const { showError } = useAppOverlay();
  const { requestProof, modal: presenceModal } = usePunchPresenceVerification(effectiveLanguage);
  const t = useT();

  const handleSubmit = async () => {
    setIsLoading(true);
    const user = users.find((u) => u.pin === pin);

    if (!user) {
      setMessageType('error');
      setMessage(t.pin_invalid);
      setTimeout(() => {
        setPin('');
        setMessage('');
        setIsLoading(false);
      }, 2000);
      return;
    }

    if (user.status !== 'active') {
      setMessageType('error');
      setMessage(t.user_suspended_punch);
      setTimeout(() => {
        setPin('');
        setMessage('');
        setIsLoading(false);
      }, 2000);
      return;
    }

    let presenceProof: string | undefined;
    try {
      const proof = await requestProof(user.id);
      presenceProof = proof || undefined;
    } catch (e) {
      if (e instanceof Error && e.message === 'presence_cancelled') {
        setMessageType('error');
        setMessage(t.punch_presence_cancelled);
        showError?.(t.punch_presence_cancelled);
        setTimeout(() => {
          setPin('');
          setMessage('');
          setIsLoading(false);
        }, 3500);
        return;
      }
      setIsLoading(false);
      throw e;
    }
    const pr = await addPunchRecord(user.id, 'in', { presenceProof });
    if (pr && typeof pr === 'object' && 'error' in pr && pr.error) {
      setMessageType('error');
      setMessage(pr.error);
      showError?.(pr.error);
      setTimeout(() => {
        setPin('');
        setMessage('');
        setIsLoading(false);
      }, 3500);
      return;
    }
    setMessageType('success');
    setMessage(t.punch_entry_success);

    setTimeout(() => {
      setPin('');
      setMessage('');
      setIsLoading(false);
      onClose();
    }, 1500);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <PinPadModal
            title="Terminale Presenze"
            subtitle={format(new Date(), 'HH:mm - dd/MM/yyyy')}
            pinLabel={t.login_password_label ?? 'PIN'}
            pin={pin}
            onPinChange={(p) => (setPin(p), setMessage(''))}
            onConfirm={handleSubmit}
            onCancel={onClose}
            error={messageType === 'error' ? message : undefined}
            isLoading={isLoading}
            confirmLabel="OK"
            cancelLabel={t.cancel}
          />
        )}
      </AnimatePresence>
      {presenceModal}
    </>
  );
}
