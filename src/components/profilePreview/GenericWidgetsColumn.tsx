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
            <p className="px-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">{sub}</p>
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
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                      <p className="text-sm font-semibold text-slate-800">{w.label}</p>
                      <p className="mt-1 font-sans text-[10px] text-slate-400 break-all text-center">{w.key}</p>
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
