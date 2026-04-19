import { useEffect, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { getTranslations } from '../utils/translations';
import type { Language } from '../types';

type Props = {
  userId: string;
  effectiveLanguage: Language;
};

export function StaffPushNotificationPromptBanner({ userId, effectiveLanguage }: Props) {
  const t = getTranslations(effectiveLanguage);
  const [perm, setPerm] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  const { requestNotificationPermission, isLoading, isPushNotificationSupported } = usePushNotifications(userId, {
    enableAutoSubscribe: false,
  });

  useEffect(() => {
    const sync = () => {
      if (typeof Notification !== 'undefined') setPerm(Notification.permission);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  if (!isPushNotificationSupported) return null;
  if (perm === 'granted') return null;
  if (perm !== 'default' && perm !== 'denied') return null;

  const isDenied = perm === 'denied';

  return (
    <div
      role="status"
      className="mx-4 mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800">
        <Bell className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900/90">
          {t.staff_push_banner_title}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-amber-950/80">
          {isDenied ? t.staff_push_banner_body_denied : t.staff_push_banner_body_default}
        </p>
        {!isDenied && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void requestNotificationPermission().then(() => {
              if (typeof Notification !== 'undefined') setPerm(Notification.permission);
            })}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            {t.staff_push_banner_cta}
          </button>
        )}
      </div>
    </div>
  );
}
