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
import AdminRow from './ui/AdminRow';

/** Liste permessi: niente overflow-hidden sul contenitore (evita tagli verticali su testi lunghi). */
export const PERMISSION_SUMMARY_LIST_CLASS =
  'space-y-0 rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/70';

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
    const key = row.key;
    const enabled = props.features[key] === true;
    const label = rowLabel(sectionId, key);

    if (props.mode === 'badges') {
      return (
        <AdminRow
          key={key}
          label={<span className={enabled ? 'text-slate-800' : 'text-slate-600'}>{label}</span>}
          action={
            <span
              className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                enabled ? 'bg-accent text-white shadow-sm' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {enabled ? (tv.role_template_yes ?? 'Sì') : (tv.role_template_no ?? 'No')}
            </span>
          }
        />
      );
    }

    return (
      <AdminRow
        key={key}
        label={label}
        action={
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
        }
      />
    );
  };

  return (
    <div className="space-y-5">
      {ROLE_TEMPLATE_FEATURE_SECTIONS.map((section) => {
        const titleKey = roleTemplateSectionTitleKey(section.id);
        const title = tv[titleKey] ?? titleKey;
        return (
          <div key={section.id}>
            <p className="ui-section-title mb-2">{title}</p>
            <div className={PERMISSION_SUMMARY_LIST_CLASS}>
              {section.rows.map((row) => renderRow(section.id, row))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
