import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Camera, ShieldCheck, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useProfileLeaveGuardRef } from '../context/ProfileLeaveGuardContext';
import { getTranslations } from '../utils/translations';
import { persistThemePreference } from '../utils/theme';
import { NotificationPermissionButton } from './NotificationPermissionButton';

function ThemeContrastIcon({ mode, className }: { mode: 'light' | 'dark'; className?: string }) {
  const activeLight = mode === 'light';
  const svgTransition =
    'absolute inset-0 h-full w-full transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.34,1.2,0.64,1)]';
  return (
    <span className={`relative inline-block shrink-0 ${className ?? ''}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={svgTransition} style={{ opacity: activeLight ? 1 : 0, transform: activeLight ? 'rotate(0deg) scale(1)' : 'rotate(-100deg) scale(0.82)' }}>
        <circle cx="12" cy="12" r="9.15" fill="#1e293b" />
        <path d="M12 3.35C16.7773 3.35 20.65 7.22274 20.65 12C20.65 16.7773 16.7773 20.65 12 20.65V3.35Z" fill="white" />
        <circle cx="12" cy="12" r="3.95" fill="white" />
        <path d="M12 8.05C14.1815 8.05 15.95 9.81848 15.95 12C15.95 14.1815 14.1815 15.95 12 15.95V8.05Z" fill="#1e293b" />
        <circle cx="12" cy="12" r="9.15" fill="none" stroke="#f1f5f9" strokeWidth="1.5" />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={svgTransition} style={{ opacity: activeLight ? 0 : 1, transform: activeLight ? 'rotate(100deg) scale(0.82)' : 'rotate(0deg) scale(1)' }}>
        <circle cx="12" cy="12" r="9.85" fill="#ffffff" />
        <path d="M12 5.45C15.6175 5.45 18.55 8.38254 18.55 12C18.55 15.6175 15.6175 18.55 12 18.55V5.45Z" fill="white" />
        <path d="M12 5.45C8.38254 5.45 5.45 8.38254 5.45 12C5.45 15.6175 8.38254 18.55 12 18.55V5.45Z" fill="#0a0a0a" />
        <path d="M12 8.25C14.0711 8.25 15.75 9.92893 15.75 12C15.75 14.0711 14.0711 15.75 12 15.75V8.25Z" fill="#0a0a0a" />
        <path d="M12 8.25C9.92893 8.25 8.25 9.92893 8.25 12C8.25 14.0711 9.92893 15.75 12 15.75V8.25Z" fill="white" />
      </svg>
    </span>
  );
}
import { isManagementRole } from '../utils/permissions';
import { isFeatureEnabled } from '../utils/enabledFeatures';
import { PinPadModal } from './ui/PinPadModal';
import { hasPinUnlockCredential, authenticatePinUnlockCredential } from '../utils/pinUnlockWebAuthn';
import { ProfileFormSelf, type ProfileFormSelfData } from './UserProfile';
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
  const { currentUser, effectiveLanguage, setLanguage, updateUser, updateUserPreferences, showError } = useApp();
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

  const [expanded, setExpanded] = useState<'settings' | 'notif' | 'theme' | null>(null);
  const toggleSection = (s: typeof expanded) => setExpanded(prev => prev === s ? null : s);

  if (!currentUser) return null;

  const fullName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ').trim()
    || currentUser.email?.split('@')[0] || 'Utente';
  const displayName = fullName;
  const profileInitial = (displayName.charAt(0) || '?').toUpperCase();
  const isMgmt = isManagementRole(currentUser.role);

  const changePhoto = tv.profile_tab_change_photo ?? 'Cambia foto';
  const logoutConfirm = tv.profile_logout_confirm ?? "Uscire dall'account?";

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

  const systemDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const uiTheme = (currentUser.theme ?? (systemDark ? 'dark' : 'light')) as 'light' | 'dark';
  const toggleUiTheme = () => {
    const nextTheme = uiTheme === 'light' ? 'dark' : 'light';
    updateUserPreferences({ theme: nextTheme });
    persistThemePreference(nextTheme);
  };

  const dark = uiTheme === 'dark';
  const menuRowBase = dark
    ? 'w-full flex items-center justify-between rounded-xl px-4 py-3.5 transition-all active:scale-[0.98] border border-white/[0.08] bg-transparent'
    : 'w-full flex items-center justify-between rounded-xl px-4 py-3.5 transition-all active:scale-[0.98] border border-slate-100 bg-white shadow-sm';
  const chevronCls = dark ? 'text-white/25' : 'text-slate-300';
  const rowLabelCls = dark ? 'text-[13px] font-semibold text-white/80' : 'text-[13px] font-semibold text-slate-700';

  const deptLabel = currentUser.department ?? '';
  const roleDisplay = currentUser.role ?? '';

  return (
    <div className="w-full max-w-lg mx-auto pb-content font-sans">
      {/* Photo crop modal */}
      {cropObjectUrl ? (
        <ProfilePhotoCropperModal
          imageSrc={cropObjectUrl}
          labels={cropLabels}
          onClose={closePhotoCropper}
          onConfirm={onCropConfirm}
        />
      ) : null}

      {/* Hidden file inputs */}
      <input ref={galleryInputRef} type="file" accept="image/*" className="sr-only" aria-hidden onChange={onPickedFileForCrop} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="sr-only" aria-hidden onChange={onPickedFileForCrop} />
      <input ref={filesInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif" className="sr-only" aria-hidden onChange={onPickedFileForCrop} />
      <input ref={nativePickInputRef} type="file" accept="image/*" className="sr-only" aria-hidden onChange={onPickedFileForCrop} />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div
          className="flex flex-col items-center gap-3 pt-8 pb-6 px-5"
          style={{ borderBottom: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #F1F5F9' }}
        >
          {/* Avatar + photo button */}
          <div className="relative inline-block" ref={photoMenuWrapRef}>
            <div
              className="flex h-[9rem] w-[9rem] items-center justify-center overflow-hidden rounded-3xl text-[3.5rem] font-bold"
              style={dark
                ? { background: 'rgba(102,153,255,0.10)', border: '2px solid rgba(255,255,255,0.12)', color: '#6699FF' }
                : { background: 'rgba(0,82,255,0.06)', border: '2px solid #F1F5F9', color: '#0052FF' }}
            >
              {resolvedAvatar ? (
                <img
                  src={resolvedAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ objectPosition: avatarFocusToObjectPosition(avatarFocus) }}
                  draggable={false}
                />
              ) : profileInitial}
            </div>

            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                if (preferNativePhotoPicker) { nativePickInputRef.current?.click(); return; }
                setPhotoSourceSheetOpen((o) => !o);
              }}
              disabled={photoBusy}
              aria-expanded={preferNativePhotoPicker ? undefined : photoSourceSheetOpen}
              aria-haspopup={preferNativePhotoPicker ? undefined : 'menu'}
              aria-controls={preferNativePhotoPicker ? undefined : 'profile-photo-source-menu'}
              className="absolute bottom-0.5 right-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white shadow-sm outline-none transition-colors hover:opacity-90 active:scale-[0.96] disabled:opacity-50 touch-manipulation"
              style={{ background: '#0052FF' }}
              title={changePhoto}
              aria-label={changePhoto}
            >
              <Camera className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>

            {!preferNativePhotoPicker && (
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
            )}
          </div>

          {/* Name + role/dept */}
          <div className="flex flex-col items-center gap-0.5">
            <h2 className="text-base font-bold tracking-tight" style={{ color: dark ? '#fff' : '#1e293b' }}>
              {displayName}
            </h2>
            <p className="text-[11px]" style={{ color: dark ? 'rgba(255,255,255,0.40)' : '#94a3b8' }}>
              {roleDisplay}{deptLabel && deptLabel !== roleDisplay ? ` · ${deptLabel}` : ''}
            </p>
          </div>

          {/* Status badges */}
          <div className="flex gap-2">
            {[roleDisplay, 'Attivo'].filter(Boolean).map((label, i) => (
              <span
                key={i}
                className="text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                style={dark
                  ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }
                  : { background: '#f1f5f9', color: '#64748b' }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Management area shortcut ──────────────────────────────────── */}
        {isMgmt && (
          <div className="px-4 pt-4">
            <button
              type="button"
              onClick={() => { setMgmtPin(''); setMgmtPinError(''); setShowMgmtPinPad(true); }}
              className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-white active:scale-[0.98] transition-all"
              style={{ background: '#0052FF', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <ShieldCheck className="w-4 h-4 text-white" strokeWidth={2} />
                </div>
                <span className="text-[13px] font-bold">{tv.area_gestionale_title ?? 'Area Gestionale'}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
            </button>
          </div>
        )}

        {/* ── Menu accordion ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 px-4 pt-4 pb-8">

          {/* Impostazioni profilo */}
          <div className="rounded-xl overflow-hidden" style={dark ? { border: '1px solid rgba(255,255,255,0.08)' } : { border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <button type="button" className="w-full flex items-center justify-between px-4 py-3.5 transition-all active:scale-[0.98]" onClick={() => toggleSection('settings')}>
              <span className={rowLabelCls}>{tv.profile_tab_group_settings ?? 'Impostazioni profilo'}</span>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${chevronCls} ${expanded === 'settings' ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {expanded === 'settings' && (
                <motion.div key="settings-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }} className="overflow-hidden">
                  <div style={dark ? { borderTop: '1px solid rgba(255,255,255,0.06)' } : { borderTop: '1px solid #F1F5F9' }} className="px-4 py-4 text-slate-900 dark:text-neutral-100">
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notifiche */}
          <div className="rounded-xl overflow-hidden" style={dark ? { border: '1px solid rgba(255,255,255,0.08)' } : { border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <button type="button" className="w-full flex items-center justify-between px-4 py-3.5 transition-all active:scale-[0.98]" onClick={() => toggleSection('notif')}>
              <span className={rowLabelCls}>{tv.profile_notifications_label ?? 'Notifiche'}</span>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${chevronCls} ${expanded === 'notif' ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {expanded === 'notif' && (
                <motion.div key="notif-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }} className="overflow-hidden">
                  <div style={dark ? { borderTop: '1px solid rgba(255,255,255,0.06)' } : { borderTop: '1px solid #F1F5F9' }} className="px-4 py-3">
                    <NotificationPermissionButton effectiveLanguage={effectiveLanguage} userId={currentUser?.id} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tema & Lingua */}
          <div className="rounded-xl overflow-hidden" style={dark ? { border: '1px solid rgba(255,255,255,0.08)' } : { border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <button type="button" className="w-full flex items-center justify-between px-4 py-3.5 transition-all active:scale-[0.98]" onClick={() => toggleSection('theme')}>
              <span className={rowLabelCls}>{tv.profile_theme_language ?? 'Tema & Lingua'}</span>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${chevronCls} ${expanded === 'theme' ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {expanded === 'theme' && (
                <motion.div key="theme-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }} className="overflow-hidden">
                  <div style={dark ? { borderTop: '1px solid rgba(255,255,255,0.06)' } : { borderTop: '1px solid #F1F5F9' }} className="px-4 py-3 space-y-3">
                    {/* Toggle tema */}
                    <button
                      type="button"
                      onClick={toggleUiTheme}
                      className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98]"
                      style={dark
                        ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e5e5' }
                        : { background: '#f8fafc', border: '1px solid #F1F5F9', color: '#1e293b' }}
                    >
                      <span>{uiTheme === 'light' ? (t.light ?? 'Chiaro') : (t.dark ?? 'Scuro')}</span>
                      <ThemeContrastIcon mode={uiTheme} className="h-6 w-6" />
                    </button>

                    {/* Selettore lingua */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30 mb-2">
                        {t.language ?? 'Lingua'}
                      </p>
                      <div
                        className="flex gap-1 rounded-xl p-1"
                        style={dark
                          ? { background: 'rgba(0,0,0,0.30)', border: '1px solid rgba(255,255,255,0.08)' }
                          : { background: '#f1f5f9', border: '1px solid #F1F5F9' }}
                      >
                        {(['it', 'en', 'es', 'fr'] as const).map((l) => {
                          const isActive = effectiveLanguage === l;
                          return (
                            <button
                              key={l}
                              type="button"
                              onClick={async () => {
                                setLanguage(l);
                                if (currentUser) {
                                  try { await updateUser(currentUser.id, { language: l }); } catch {}
                                }
                              }}
                              className="relative flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors"
                              style={isActive
                                ? { background: '#3366CC', color: '#ffffff' }
                                : { color: dark ? 'rgba(255,255,255,0.45)' : '#64748b' }}
                            >
                              {l.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>


        </div>
      </motion.div>

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
    </div>
  );
}
