import type { User, Language } from '../../types';
import { getTranslations } from '../../utils/translations';
import { widgetAppliesToUser, type UiScreenWidgetDef } from '../../utils/uiScreenWidgets';
import { WidgetChrome } from './WidgetChrome';

export default function GenericWidgetsColumn({
  groups,
  previewUser,
  isSelectedAdmin,
  onUiToggle,
  language,
}: {
  groups: { groupKey: string; widgets: UiScreenWidgetDef[] }[];
  previewUser: User;
  isSelectedAdmin: boolean;
  onUiToggle: (key: string, visible: boolean) => void;
  language: Language;
}) {
  const t = getTranslations(language);
  const tv = t as Record<string, string>;
  const hiddenBadge = tv.profile_visibility_ui_hidden_badge ?? 'Nascosto';

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ groupKey, widgets: applicable }) => {
        const sub = applicable[0]?.screenLabel ?? groupKey;
        return (
          <div key={groupKey} className="space-y-2">
            <p className="px-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-300">{sub}</p>
            <div className="space-y-3">
              {applicable
                .filter((w) => widgetAppliesToUser(w, previewUser.role))
                .map((w) => (
                  <WidgetChrome
                    key={w.key}
                    widgetKey={w.key}
                    previewUser={previewUser}
                    isSelectedAdmin={isSelectedAdmin}
                    onUiToggle={onUiToggle}
                    hiddenBadge={hiddenBadge}
                  >
                    <div
                      className="surface-glass-sm px-4 py-3"
                      title={w.key}
                    >
                      <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">{w.label}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-neutral-400">
                        {tv.profile_visibility_generic_widget_demo ??
                          'Contenuto dimostrativo: in app qui compariranno i dati reali.'}
                      </p>
                    </div>
                  </WidgetChrome>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
