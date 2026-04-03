import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Camera, ShieldCheck, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useProfileLeaveGuardRef } from '../context/ProfileLeaveGuardContext';
import { getTranslations } from '../utils/translations';
import { isManagementRole } from '../utils/permissions';
import { isFeatureEnabled } from '../utils/enabledFeatures';
import { PinPadModal } from './ui/PinPadModal';
import { hasPinUnlockCredential, authenticatePinUnlockCredential } from '../utils/pinUnlockWebAuthn';
import { ProfileFormSelf, type ProfileFormSelfData } from './UserProfile';
import { SoundSettings } from './SoundSettings';
import ProfilePhotoSourceSheet from './profile/ProfilePhotoSourceSheet';
import ProfilePhotoCropperModal from './profile/ProfilePhotoCropperModal';
import {
  readProfileAvatarFromStorage,
  writeProfileAvatarToStorage,
  readAvatarFocus,
  writeAvatarFocus,
  avatarFocusToObjectPosition,
  type AvatarFocus,
} from '../utils/profilePhotoStorage';
import { splitPhoneForForm, joinPhone, DEFAULT_PHONE_PREFIX } from '../utils/phonePrefix';
import type { Language } from '../types';
function serializeProfileForm(fd: ProfileFormSelfData): string {
  return JSON.stringify({
    email: fd.email.trim(),
    phone: joinPhone(fd.phone_prefix, fd.phone_national),
    language: fd.language,
    pin: fd.pin.replace(/\D/g, '').slice(0, 4),
  });
}

/**
 * Scheda bottom bar “Profilo”: hero + form impostazioni sempre visibile + riga Esci.
 */
export default function ProfileNavTabPanel({
  onLogout,
  onGoToSettings,
}: {
  onLogout: () => void;
  onGoToSettings?: () => void;
}) {
  const { currentUser, effectiveLanguage, updateUser, showError } = useApp();
  const profileLeaveGuardRef = useProfileLeaveGuardRef();
  const navigate = useNavigate();
  const t = getTranslations(effectiveLanguage);
  const tv = t as Record<string, string>;
  const [formData, setFormData] = useState<ProfileFormSelfData>({
    first_name: '',
    last_name: '',
    email: '',
    phone_prefix: DEFAULT_PHONE_PREFIX,
    phone_national: '',
    language: 'it',
    department: undefined,
    role: 'server',
    pin: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  // PIN gate per Area Gestionale
  const [showMgmtPinPad, setShowMgmtPinPad] = useState(false);
  const [mgmtPin, setMgmtPin] = useState('');
  const [mgmtPinError, setMgmtPinError] = useState('');

  const openMgmtArea = useCallback(() => {
    if (onGoToSettings) onGoToSettings();
    else navigate('/admin');
  }, [onGoToSettings, navigate]);

  const handleMgmtPinConfirm = useCallback(() => {
    if (!currentUser) return;
    if (mgmtPin === currentUser.pin) {
      setShowMgmtPinPad(false);
      setMgmtPin('');
      setMgmtPinError('');
      openMgmtArea();
    } else {
      setMgmtPinError('PIN non valido');
      setMgmtPin('');
      setTimeout(() => setMgmtPinError(''), 2000);
    }
  }, [currentUser, mgmtPin, openMgmtArea]);

  // Auto-submit a 4 cifre
  useEffect(() => {
    if (mgmtPin.length === 4) handleMgmtPinConfirm();
  }, [mgmtPin, handleMgmtPinConfirm]);
  const [photoSourceSheetOpen, setPhotoSourceSheetOpen] = useState(false);
  const [cropObjectUrl, setCropObjectUrl] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  /** Telefono/tablet touch: un solo input senza `capture` → foglio nativo unico (evita doppia scelta). */
  const nativePickInputRef = useRef<HTMLInputElement>(null);
  const [preferNativePhotoPicker, setPreferNativePhotoPicker] = useState(false);
  const [avatarFocus, setAvatarFocus] = useState<AvatarFocus>({ x: 50, y: 50 });
  const focusRef = useRef<AvatarFocus>({ x: 50, y: 50 });
  const savedSnapshotRef = useRef('');
  const photoMenuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    const ph = splitPhoneForForm(currentUser.phone);
    const fd: ProfileFormSelfData = {
      first_name: currentUser.first_name ?? '',
      last_name: currentUser.last_name ?? '',
      email: currentUser.email ?? '',
      phone_prefix: ph.prefix,
      phone_national: ph.national,
      language: (currentUser.language ?? 'it') as Language,
      department: currentUser.department,
      role: currentUser.role,
      pin: currentUser.pin ?? '',
    };
    setFormData(fd);
    savedSnapshotRef.current = serializeProfileForm(fd);
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- solo cambio utente (id), non ogni sync di currentUser

  useEffect(() => {
    if (!currentUser?.id) return;
    const f = readAvatarFocus(currentUser.id);
    focusRef.current = f;
    setAvatarFocus(f);
  }, [currentUser?.id]);

  const resolvedAvatar =
    currentUser &&
    (readProfileAvatarFromStorage(currentUser.id) ?? currentUser.avatar_url ?? null);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const apply = () => setPreferNativePhotoPicker(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (preferNativePhotoPicker) setPhotoSourceSheetOpen(false);
  }, [preferNativePhotoPicker]);

  useEffect(() => {
    if (!photoSourceSheetOpen || preferNativePhotoPicker) return;
    const onDown = (e: PointerEvent) => {
      if (photoMenuWrapRef.current?.contains(e.target as Node)) return;
      setPhotoSourceSheetOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [photoSourceSheetOpen, preferNativePhotoPicker]);

  const onPickedFileForCrop = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !file.type.startsWith('image/')) {
        showError?.(tv.profile_tab_photo_error ?? 'Impossibile elaborare la foto.');
        return;
      }
      const url = URL.createObjectURL(file);
      setCropObjectUrl(url);
    },
    [showError, tv.profile_tab_photo_error]
  );

  const closePhotoCropper = useCallback(() => {
    setCropObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const persistCroppedAvatar = useCallback(
    async (dataUrl: string) => {
      if (!currentUser?.id) return;
      setPhotoBusy(true);
      try {
        writeProfileAvatarToStorage(currentUser.id, dataUrl);
        const center: AvatarFocus = { x: 50, y: 50 };
        writeAvatarFocus(currentUser.id, center);
        focusRef.current = center;
        setAvatarFocus(center);
        const ok = await updateUser(currentUser.id, { avatar_url: dataUrl });
        if (!ok) throw new Error('avatar save failed');
      } finally {
        setPhotoBusy(false);
      }
    },
    [currentUser?.id, updateUser]
  );

  const onCropConfirm = useCallback(
    async (dataUrl: string) => {
      setCropObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      try {
        await persistCroppedAvatar(dataUrl);
      } catch {
        showError?.(tv.profile_tab_photo_error ?? 'Impossibile elaborare la foto.');
      }
    },
    [persistCroppedAvatar, showError, tv.profile_tab_photo_error]
  );

  const handleRemovePhoto = useCallback(async () => {
    if (!currentUser?.id) return;
    if (!window.confirm(tv.profile_tab_remove_photo_confirm ?? 'Vuoi rimuovere la foto profilo?')) return;
    
    setPhotoBusy(true);
    try {
      // Rimuovi da localStorage
      writeProfileAvatarToStorage(currentUser.id, null);
      // Rimuovi dal database
      const ok = await updateUser(currentUser.id, { avatar_url: null });
      if (!ok) throw new Error('avatar removal failed');
    } catch {
      showError?.(tv.profile_tab_photo_error ?? 'Errore durante la rimozione della foto.');
    } finally {
      setPhotoBusy(false);
    }
  }, [currentUser?.id, updateUser, showError, tv]);

  const performProfileSave = useCallback(async () => {
    if (!currentUser) return;
    const pinDigits = formData.pin.replace(/\D/g, '').slice(0, 4);
    setIsSaving(true);
    try {
      const ok = await updateUser(currentUser.id, {
        email: formData.email,
        phone: joinPhone(formData.phone_prefix, formData.phone_national),
        language: formData.language,
        ...(pinDigits.length === 4 ? { pin: pinDigits } : {}),
      });
      if (!ok) throw new Error('save failed');
      savedSnapshotRef.current = serializeProfileForm(formData);
    } finally {
      setIsSaving(false);
    }
  }, [currentUser, formData, updateUser]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await performProfileSave();
    } catch {
      /* updateUser notifica */
    }
  };

  const isDirty = useCallback(
    () => serializeProfileForm(formData) !== savedSnapshotRef.current,
    [formData]
  );

  const isProfileReadOnly = isFeatureEnabled(currentUser, 'profile_readonly');

  useEffect(() => {
    const ref = profileLeaveGuardRef;
    if (!ref) return;
    ref.current = {
      isDirty,
      save: performProfileSave,
    };
    return () => {
      ref.current = null;
    };
  }, [profileLeaveGuardRef, isDirty, performProfileSave]);

  if (!currentUser) return null;

  const displayName =
    (currentUser.first_name?.trim() || currentUser.email?.split('@')[0] || 'Utente').trim() || 'Utente';
  const profileInitial = (displayName.charAt(0) || '?').toUpperCase();
  const isMgmt = isManagementRole(currentUser.role);
  const isMobile = window.innerWidth < 768;

  const sectionLabel = tv.profile_tab_group_settings ?? 'Impostazioni';
  const changePhoto = tv.profile_tab_change_photo ?? 'Cambia foto';
  const logoutConfirm = tv.profile_logout_confirm ?? 'Uscire dall’account?';

  const sourceLabels = {
    sheetAria: tv.profile_photo_source_sheet_aria ?? '',
    gallery: tv.profile_photo_source_gallery ?? 'Galleria',
    camera: tv.profile_photo_source_camera ?? 'Fotocamera',
    files: tv.profile_photo_source_files ?? 'File',
    remove: tv.profile_tab_remove_photo ?? 'Rimuovi foto',
  };
  const cropLabels = {
    close: tv.profile_photo_crop_close ?? 'Chiudi',
    title: tv.profile_photo_crop_title ?? 'Modifica foto',
    crop: tv.profile_photo_crop_action ?? 'Ritaglia',
    hint: tv.profile_photo_crop_hint ?? '',
  };

  const confirmLogout = () => {
    if (window.confirm(logoutConfirm)) onLogout();
  };

  return (
    <div className="w-full max-w-lg mx-auto pb-content pt-2 sm:pt-4 font-sans">
      {cropObjectUrl ? (
        <ProfilePhotoCropperModal
          imageSrc={cropObjectUrl}
          labels={cropLabels}
          onClose={closePhotoCropper}
          onConfirm={onCropConfirm}
        />
      ) : null}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        onChange={onPickedFileForCrop}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        aria-hidden
        onChange={onPickedFileForCrop}
      />
      <input
        ref={filesInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
        className="sr-only"
        aria-hidden
        onChange={onPickedFileForCrop}
      />
      <input
        ref={nativePickInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        onChange={onPickedFileForCrop}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-3"
      >
        {/* Hero */}
        <div className="flex flex-col items-center px-4 pt-1 pb-0">
          <div className="relative inline-block">
            <div className="relative rounded-2xl outline-none" aria-label={displayName}>
              <div className="flex h-[8.5rem] w-[8.5rem] items-center justify-center overflow-hidden rounded-2xl border-2 border-accent/25 bg-accent/10 text-[2.35rem] font-bold text-accent shadow-sm sm:h-40 sm:w-40 sm:text-[2.5rem]">
                {resolvedAvatar ? (
                  <img
                    src={resolvedAvatar}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ objectPosition: avatarFocusToObjectPosition(avatarFocus) }}
                    draggable={false}
                  />
                ) : (
                  profileInitial
                )}
              </div>
            </div>
            <div ref={photoMenuWrapRef} className="absolute bottom-1 right-1 z-20">
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (preferNativePhotoPicker) {
                    nativePickInputRef.current?.click();
                    return;
                  }
                  setPhotoSourceSheetOpen((o) => !o);
                }}
                disabled={photoBusy}
                aria-expanded={preferNativePhotoPicker ? undefined : photoSourceSheetOpen}
                aria-haspopup={preferNativePhotoPicker ? undefined : 'menu'}
                aria-controls={preferNativePhotoPicker ? undefined : 'profile-photo-source-menu'}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-white shadow-sm outline-none transition-colors hover:bg-accent-hover active:scale-[0.96] disabled:opacity-50 touch-manipulation focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-0"
                title={changePhoto}
                aria-label={changePhoto}
              >
                <Camera className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
              {!preferNativePhotoPicker ? (
                <ProfilePhotoSourceSheet
                  open={photoSourceSheetOpen}
                  labels={sourceLabels}
                  onClose={() => setPhotoSourceSheetOpen(false)}
                  onPickGallery={() => galleryInputRef.current?.click()}
                  onPickCamera={() => cameraInputRef.current?.click()}
                  onPickFiles={() => filesInputRef.current?.click()}
                  onRemovePhoto={resolvedAvatar ? handleRemovePhoto : undefined}
                  menuId="profile-photo-source-menu"
                />
              ) : null}
            </div>
          </div>
          <h2 className="mt-4 text-center text-xl font-bold tracking-tight text-slate-900 dark:text-neutral-100">
            {displayName}
          </h2>
        </div>

        <p className="px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">{sectionLabel}</p>

        {/* Accesso Area Gestionale — richiede PIN */}
        {isMgmt && (
          <div className="px-4">
            <button
              type="button"
              onClick={() => { setMgmtPin(''); setMgmtPinError(''); setShowMgmtPinPad(true); }}
              className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white dark:bg-neutral-800 px-5 py-4 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-sm active:scale-[0.98] transition-all hover:border-accent/40 hover:bg-accent/[0.03]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold uppercase tracking-wide">{tv.area_gestionale_title ?? 'Area Gestionale'}</p>
                  <p className="text-[10px] !text-slate-500 dark:!text-neutral-400">{tv.area_gestionale_subtitle ?? 'Gestisci turni, profili e impostazioni'}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 dark:text-neutral-600 shrink-0" />
            </button>
          </div>
        )}

        {/* PIN pad modal Area Gestionale */}
        <AnimatePresence>
          {showMgmtPinPad && currentUser && (
            <PinPadModal
              title="Area Gestionale"
              subtitle="Inserisci il tuo PIN per accedere"
              pinLabel="PIN"
              pin={mgmtPin}
              onPinChange={(v) => { setMgmtPinError(''); setMgmtPin(v); }}
              error={mgmtPinError}
              onConfirm={handleMgmtPinConfirm}
              onCancel={() => { setShowMgmtPinPad(false); setMgmtPin(''); setMgmtPinError(''); }}
              confirmLabel="Accedi"
              userId={currentUser.id}
              userDisplayName={`${currentUser.first_name} ${currentUser.last_name ?? ''}`.trim()}
              userEmail={currentUser.email ?? ''}
              onBiometricSuccess={() => {
                setShowMgmtPinPad(false);
                setMgmtPin('');
                openMgmtArea();
              }}
            />
          )}
        </AnimatePresence>

        {/* Form impostazioni profilo */}
        <div className="surface-glass overflow-hidden rounded-2xl mx-4">
          <div className="bg-slate-50/70 dark:bg-neutral-950/50 px-4 py-4 text-slate-900 dark:text-neutral-100">
            <ProfileFormSelf
              formData={formData}
              setFormData={setFormData}
              onSave={handleProfileSave}
              isSaving={isSaving}
              readOnly={false}
              appearance="light"
              nameLocked={true}
              departmentLocked={true}
              roleLocked={true}
            />
          </div>
        </div>

        {/* IMPOSTAZIONI SUONO E FEEDBACK */}
        <div className="mx-4">
          <SoundSettings />
        </div>
      </motion.div>
    </div>
  );
}
