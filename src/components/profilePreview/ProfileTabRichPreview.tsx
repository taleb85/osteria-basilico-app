import type { ReactNode } from 'react';
import type { User, Language } from '../../types';
import type { FeatureFlags } from '../../utils/featureFlags';
import type { AppNavTab } from '../../utils/enabledModules';
import { isStaffRequestsFeatureEnabled } from '../../utils/enabledModules';
import type { UiScreenWidgetDef } from '../../utils/uiScreenWidgets';
import { getTranslations } from '../../utils/translations';
import ManagementHomePreview from '../ManagementHomePreview';
import GenericWidgetsColumn from './GenericWidgetsColumn';
import StaffHomePreview from './StaffHomePreview';
import TurniMgmtPreview from './TurniMgmtPreview';
import StaffShiftsPreview from './StaffShiftsPreview';
import FerieMgmtPreview from './FerieMgmtPreview';
import StaffHolidaysPreview from './StaffHolidaysPreview';
import TimesheetTabPreview from './TimesheetTabPreview';
import StatisticsTabPreview from './StatisticsTabPreview';
import SettingsTabPreview from './SettingsTabPreview';

const OMIT_STAFF_HOME = 'staff_home';
const OMIT_STAFF_TURNI = 'staff_shifts';
const OMIT_STAFF_FERIE = 'staff_holidays';

export default function ProfileTabRichPreview({
  activeHubTab,
  isMgmt,
  layoutGroups,
  previewUser,
  language,
  isSelectedAdmin,
  featureFlags,
  onUiToggle,
  navLabel,
  children,
}: {
  activeHubTab: AppNavTab;
  isMgmt: boolean;
  layoutGroups: { groupKey: string; widgets: UiScreenWidgetDef[] }[];
  previewUser: User;
  language: Language;
  isSelectedAdmin: boolean;
  featureFlags?: FeatureFlags | null;
  onUiToggle: (key: string, visible: boolean) => void;
  navLabel: string;
  children?: ReactNode;
}) {
  const t = getTranslations(language);
  const tv = t as Record<string, string>;
  const gm = new Map(layoutGroups.map((g) => [g.groupKey, g] as const));

  const omitKeys = new Set<string>();
  if (activeHubTab === 'home' && isMgmt && gm.has('home_mgmt')) omitKeys.add('home_mgmt');
  if (activeHubTab === 'home' && !isMgmt && gm.has('staff_home')) omitKeys.add(OMIT_STAFF_HOME);
  if (activeHubTab === 'turni' && isMgmt && gm.has('turni')) omitKeys.add('turni');
  if (activeHubTab === 'turni' && !isMgmt && gm.has('staff_shifts')) omitKeys.add(OMIT_STAFF_TURNI);
  if (activeHubTab === 'ferie' && isMgmt && gm.has('ferie')) omitKeys.add('ferie');
  if (activeHubTab === 'ferie' && !isMgmt && gm.has('staff_holidays')) omitKeys.add(OMIT_STAFF_FERIE);
  if (activeHubTab === 'timesheet' && gm.has('timesheet')) omitKeys.add('timesheet');
  if (activeHubTab === 'reports' && gm.has('stats')) omitKeys.add('stats');
  if (activeHubTab === 'settings' && gm.has('staff_profile')) omitKeys.add('staff_profile');

  const remainder = layoutGroups.filter((g) => !omitKeys.has(g.groupKey));

  const blocks: ReactNode[] = [];

  if (activeHubTab === 'home' && isMgmt && gm.has('home_mgmt')) {
    blocks.push(
      <ManagementHomePreview
        key="home-mgmt"
        previewUser={previewUser}
        language={language}
        isSelectedAdmin={isSelectedAdmin}
        staffRequestsEnabled={isStaffRequestsFeatureEnabled(featureFlags)}
        onUiToggle={onUiToggle}
        embedded
      />
    );
  }
  if (activeHubTab === 'home' && !isMgmt && gm.has('staff_home')) {
    blocks.push(
      <StaffHomePreview
        key="staff-home"
        previewUser={previewUser}
        language={language}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
      />
    );
  }
  if (activeHubTab === 'turni' && isMgmt && gm.has('turni')) {
    blocks.push(
      <TurniMgmtPreview
        key="turni-mgmt"
        previewUser={previewUser}
        language={language}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
      />
    );
  }
  if (activeHubTab === 'turni' && !isMgmt && gm.has('staff_shifts')) {
    blocks.push(
      <StaffShiftsPreview
        key="staff-shifts"
        previewUser={previewUser}
        language={language}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
      />
    );
  }
  if (activeHubTab === 'ferie' && isMgmt && gm.has('ferie')) {
    blocks.push(
      <FerieMgmtPreview
        key="ferie-mgmt"
        previewUser={previewUser}
        language={language}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
      />
    );
  }
  if (activeHubTab === 'ferie' && !isMgmt && gm.has('staff_holidays')) {
    blocks.push(
      <StaffHolidaysPreview
        key="staff-ferie"
        previewUser={previewUser}
        language={language}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
      />
    );
  }
  if (activeHubTab === 'timesheet' && gm.has('timesheet')) {
    blocks.push(
      <TimesheetTabPreview
        key="ts"
        previewUser={previewUser}
        language={language}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
      />
    );
  }
  if (activeHubTab === 'reports' && gm.has('stats')) {
    blocks.push(
      <StatisticsTabPreview
        key="stats"
        previewUser={previewUser}
        language={language}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
      />
    );
  }
  if (activeHubTab === 'settings' && gm.has('staff_profile')) {
    blocks.push(
      <SettingsTabPreview
        key="settings"
        previewUser={previewUser}
        language={language}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
      />
    );
  }

  if (remainder.length > 0) {
    blocks.push(
      <GenericWidgetsColumn
        key="generic"
        groups={remainder}
        previewUser={previewUser}
        isSelectedAdmin={isSelectedAdmin}
        onUiToggle={onUiToggle}
        language={language}
      />
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="mb-1 text-sm font-bold text-slate-800">{tv.profile_visibility_mock_heading ?? 'Anteprima schermata'}</h3>
      <p className="mb-2 max-w-md text-[11px] text-slate-500">
        {tv.profile_visibility_mock_hint_realistic ?? tv.profile_visibility_mock_hint ?? ''}
      </p>
      <div className="flex justify-center pb-1">
        <div className="mx-auto w-full max-w-4xl sm:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl rounded-[1.75rem] sm:rounded-[2rem] border-[3px] border-slate-800 bg-slate-800 p-2 sm:p-3 shadow-2xl">
          <div className="flex max-h-[min(88vh,960px)] min-h-[280px] flex-col overflow-hidden rounded-[1.25rem] sm:rounded-[1.35rem] bg-[#e2e8f0]">
            <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2.5 text-center sm:py-3">
              <p className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">{navLabel}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:text-[11px]">
                {tv.profile_visibility_mock_frame_label ?? 'Simulazione'}
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 sm:p-4">
              <div className="space-y-4">{blocks}</div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
