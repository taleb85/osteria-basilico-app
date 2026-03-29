import type { ReactNode } from 'react';
import type { User } from '../../types';
import { isUiWidgetVisible } from '../../utils/uiScreenWidgets';
import { previewWidgetLabel } from './previewWidgetLabel';

export function WidgetChrome({
  widgetKey,
  previewUser,
  isSelectedAdmin,
  onUiToggle,
  children,
  hiddenBadge,
}: {
  widgetKey: string;
  previewUser: User;
  isSelectedAdmin: boolean;
  onUiToggle: (key: string, visible: boolean) => void;
  children: ReactNode;
  hiddenBadge: string;
}) {
  const visible = isUiWidgetVisible(previewUser, widgetKey);
  return (
    <div className="relative">
      {!isSelectedAdmin && (
        <div className="mb-1 flex items-center justify-end gap-2">
          <span className="hidden max-w-[55%] truncate text-right text-[9px] font-medium text-slate-400 dark:text-neutral-400 sm:inline">
            {previewWidgetLabel(widgetKey)}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={visible}
            aria-label={previewWidgetLabel(widgetKey)}
            onClick={() => onUiToggle(widgetKey, !visible)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${visible ? 'bg-accent' : 'bg-slate-300 dark:bg-neutral-600'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white toggle-knob shadow transition-transform ${
                visible ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}
      <div className="relative">
        <div className={visible ? '' : 'pointer-events-none select-none opacity-[0.32]'}>{children}</div>
        {!visible && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-dashed border-amber-400/70 bg-white/50 backdrop-blur-[1px] dark:border-amber-600/50 dark:bg-neutral-950/65">
            <span className="rounded-lg border border-amber-200 bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/90 dark:text-amber-200 dark:shadow-none">
              {hiddenBadge}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
