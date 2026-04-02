/** Contatore: più overlay aperti = più lock; lo sblocco avviene solo quando l’ultimo si chiude. */
let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';
let savedTouchAction = '';

function applyLock() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  const html = document.documentElement;
  const scrollbarWidth = window.innerWidth - html.clientWidth;
  if (lockCount === 1) {
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    savedTouchAction = body.style.touchAction;
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  // Segnale per nascondere la sticky header sopra gli overlay (iOS Safari backdrop-filter bug)
  body.dataset.overlay = '1';
}

function removeLock() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (lockCount === 0) {
    body.style.overflow = savedOverflow;
    body.style.paddingRight = savedPaddingRight;
    body.style.touchAction = savedTouchAction;
    delete body.dataset.overlay;
  }
}

/** Blocca lo scroll della pagina sotto agli overlay (modali, drawer fullscreen). */
export function lockBodyScroll(): void {
  lockCount += 1;
  applyLock();
}

export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  removeLock();
}
