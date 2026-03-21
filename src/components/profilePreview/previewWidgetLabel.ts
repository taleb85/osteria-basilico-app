import { UI_SCREEN_WIDGETS } from '../../utils/uiScreenWidgets';

export function previewWidgetLabel(widgetKey: string): string {
  return UI_SCREEN_WIDGETS.find((w) => w.key === widgetKey)?.label ?? widgetKey;
}
