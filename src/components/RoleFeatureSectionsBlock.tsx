import {
  ROLE_TEMPLATE_FEATURE_SECTIONS,
  roleTemplateSectionTitleKey,
  FEATURE_LABELS,
  FEATURE_LABELS_TAB_FIRST,
  type EnabledFeatureKey,
  type EnabledFeatures,
  type RoleTemplateSectionId,
} from '../utils/enabledFeatures';
import { getTranslations } from '../utils/translations';
import type { Language } from '../types';

/** Stesso chrome delle liste permessi in Impostazioni → Gestione team. */
export const PERMISSION_SUMMARY_LIST_CLASS =
  'space-y-0 rounded-xl overflow-hidden border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/70 divide-y divide-slate-100';

function rowLabel(sectionId: RoleTemplateSectionId, key: EnabledFeatureKey): string {
  if (sectionId === 'tabs_nav') return FEATURE_LABELS_TAB_FIRST[key];
  return FEATURE_LABELS[key];
}

type Props =
  | {
      mode: 'toggles';
      features: EnabledFeatures;
      language: Language;
      onToggle: (key: EnabledFeatureKey) => void;
    }
  | {
      mode: 'badges';
      features: EnabledFeatures;
      language: Language;
    };

export default function RoleFeatureSectionsBlock(props: Props) {
  const t = getTranslations(props.language);
  const tv = t as Record<string, string>;

  const renderRow = (sectionId: RoleTemplateSectionId, row: (typeof ROLE_TEMPLATE_FEATURE_SECTIONS)[number]['rows'][number]) => {
    if (row.kind === 'always_home') {
      return (
        <div
          key="always_home"
          className="flex items-center justify-between gap-3 px-4 py-3 bg-accent/[0.07]"
        >
          <div className="min-w-0">
            <span className="text-sm font-semibold text-slate-800">{tv.role_template_home_title ?? 'Home'}</span>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{tv.role_template_home_hint ?? ''}</p>
          </div>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-accent text-white shadow-sm">
            {tv.role_template_always_on ?? 'Sempre'}
          </span>
        </div>
      );
    }

    const key = row.key;
    const enabled = props.features[key] === true;
    const label = rowLabel(sectionId, key);

    if (props.mode === 'badges') {
      return (
        <div key={key} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className={`text-sm pr-2 min-w-0 ${enabled ? 'text-slate-800 font-medium' : 'text-slate-600'}`}>{label}</span>
          <span
            className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
              enabled ? 'bg-accent text-white shadow-sm' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {enabled ? (tv.role_template_yes ?? 'Sì') : (tv.role_template_no ?? 'No')}
          </span>
        </div>
      );
    }

    return (
      <div key={key} className="flex items-center justify-between gap-3 px-4 py-2.5">
        <span className="text-sm text-slate-800 font-medium pr-2 min-w-0">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => props.onToggle(key)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-accent/35 focus:ring-offset-2 ${
            enabled ? 'bg-accent' : 'bg-slate-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              enabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {ROLE_TEMPLATE_FEATURE_SECTIONS.map((section) => {
        const titleKey = roleTemplateSectionTitleKey(section.id);
        const title = tv[titleKey] ?? titleKey;
        return (
          <div key={section.id}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{title}</p>
            <div className={PERMISSION_SUMMARY_LIST_CLASS}>
              {section.rows.map((row) => renderRow(section.id, row))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
