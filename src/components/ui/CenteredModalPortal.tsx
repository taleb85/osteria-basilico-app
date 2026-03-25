import { type ReactNode, type RefObject, type LegacyRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

type CenteredModalPortalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** ref sul pannello bianco (per click-outside combinato col trigger). */
  panelRef?: RefObject<HTMLDivElement | null>;
  /** aria sul backdrop (es. «Chiudi»). */
  backdropAriaLabel?: string;
  /** aria sul dialog */
  ariaLabel?: string;
  maxWidthClass?: string;
  maxHeightClass?: string;
  /** default `w-full` — `w-max min-w-0` per pannelli larghi quanto il contenuto (es. calendario). */
  panelWidthClass?: string;
  /** classi extra sul pannello (es. py-1) */
  panelClassName?: string;
  /** Per `isDatePickerPortalClick`: attributo sull’overlay root. */
  markDatePickerPortal?: boolean;
  /** Sopra bottom bar (z-50), overlay sync header, ecc. */
  overlayZClass?: string;
};

/**
 * Overlay fullscreen + card centrata (stesso linguaggio di UserAvatarMenu / NotificationCenter).
 */
export function CenteredModalPortal({
  open,
  onClose,
  children,
  panelRef,
  backdropAriaLabel = 'Chiudi',
  ariaLabel,
  maxWidthClass = 'max-w-md',
  maxHeightClass = 'max-h-[min(90dvh,720px)]',
  panelWidthClass = 'w-full',
  panelClassName = '',
  markDatePickerPortal = false,
  overlayZClass = 'z-[10050]',
}: CenteredModalPortalProps) {
  useBodyScrollLock(open);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${overlayZClass} flex items-center justify-center overflow-hidden overscroll-none p-4 font-sans`}
      role="presentation"
      {...(markDatePickerPortal ? { 'data-osteria-date-picker-portal': '' } : {})}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm dark:bg-black/75"
        aria-label={backdropAriaLabel}
        onClick={onClose}
      />
      <div
        ref={panelRef as LegacyRef<HTMLDivElement> | undefined}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`relative z-10 ${panelWidthClass} ${maxWidthClass} ${maxHeightClass} overflow-y-auto overscroll-contain rounded-2xl modal-glass-panel ${panelClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
