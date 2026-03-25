import { Bell, Globe, ShieldCheck, User as UserIcon } from 'lucide-react';
import type { User, Language } from '../../types';
import { getTranslations } from '../../utils/translations';
import { WidgetChrome } from './WidgetChrome';

export default function SettingsTabPreview({
  previewUser,
  language,
  isSelectedAdmin,
  onUiToggle,
}: {
  previewUser: User;
  language: Language;
  isSelectedAdmin: boolean;
  onUiToggle: (key: string, visible: boolean) => void;
}) {
  const t = getTranslations(language);
  const tv = t as Record<string, string>;
  const hiddenBadge = tv.profile_visibility_ui_hidden_badge ?? 'Nascosto';
  const name = `${previewUser.first_name ?? ''} ${previewUser.last_name ?? ''}`.trim() || 'Profilo';

  return (
    <div className="flex flex-col gap-4 font-sans">
      <WidgetChrome
        widgetKey="staff_profile.panel"
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        hiddenBadge={hiddenBadge}
      >
        <div className="surface-glass overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-neutral-800/80">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-lg font-bold text-accent">
                {(previewUser.first_name?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-900 dark:text-neutral-100">{name}</p>
                <p className="text-xs text-slate-500 dark:text-neutral-300">{previewUser.email ?? 'email@…'}</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {[
              { Icon: UserIcon, label: t.profile_settings },
              { Icon: Bell, label: t.profile_notifications },
              { Icon: Globe, label: t.language },
              { Icon: ShieldCheck, label: t.pin_for_profile },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3">
                <Icon className="h-5 w-5 text-slate-400 dark:text-neutral-400" />
                <span className="text-sm font-medium text-slate-800 dark:text-neutral-200">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </WidgetChrome>
    </div>
  );
}
