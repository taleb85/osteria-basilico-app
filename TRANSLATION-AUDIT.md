# Translation Audit — Osteria Basilico / FLOW App

**Date:** 2026-04-20  
**Tool:** Manual audit via shell analysis of `src/utils/translations.ts` + `src/components/*.tsx`

---

## 1. i18n Configuration

- **Library:** i18next + react-i18next + i18next-browser-languagedetector  
- **Supported languages:** `it`, `en`, `es`, `fr`  
- **Fallback language:** `it` (Italian)  
- **Language detection order:** `localStorage` → `navigator` → `htmlTag`  
- **Translation access pattern:** `const t = getTranslations(effectiveLanguage)` → `t.key_name`

---

## 2. Translation File Structure (`src/utils/translations.ts` — 5614 lines)

| Section | Lines | Type | Keys |
|---------|-------|------|------|
| `baseIt` | 9–1551 | Base (all keys) | **1346** |
| `baseEn` | 1552–3034 | `{ ...baseIt, ...EN overrides }` | **1345 overrides** |
| `baseEs` | 3035–4511 | `{ ...baseIt, ...ES overrides }` | **1341 overrides** |
| `baseFr` | 4513–5535 | `{ ...baseEn, ...FR overrides }` | **893 overrides** |

> **Note on inheritance:**  
> `baseEn` and `baseEs` spread from `baseIt` — any key not overridden shows **Italian** to EN/ES users.  
> `baseFr` spreads from `baseEn` — any key not overridden shows **English** to FR users.

---

## 3. Missing Translations Per Language

### 3.1 English (EN) — 1 missing key

EN explicitly overrides 1345 of 1346 Italian keys. The following key falls back to Italian for English users:

| Key | Italian value (shown to EN users) |
|-----|----------------------------------|
| `profile_photo_source_sheet_aria` | `'Come vuoi aggiungere la foto'` |

**Priority:** Low — accessibility label only.

---

### 3.2 Spanish (ES) — 5 missing keys

ES explicitly overrides 1341 of 1346 Italian keys. The following show **Italian** to Spanish users:

| Key | Italian value (shown to ES users) |
|-----|----------------------------------|
| `profile_visibility_save_apply` | `'Salva e applica'` |
| `settings_delete_user_button` | `'Elimina'` |
| `settings_delete_user_confirm` | `'Vuoi eliminare definitivamente questo profilo? L\'azione non è reversibile.'` |
| `settings_delete_user_success` | `'Profilo eliminato con successo.'` |
| `settings_delete_user_title` | `'Elimina profilo definitivamente'` |

**Priority:** Medium — user account deletion flow shown in Italian to ES users.

---

### 3.3 French (FR) — 453 missing keys ⚠️ CRITICAL

FR overrides only 893 of 1346 keys (66.4% coverage). The remaining **453 keys fall back to English**.  
This means French users see English for ~34% of the interface.

**Coverage:** 66.4% translated | **Gap:** 33.6% (453 keys falling back to English)

<details>
<summary>Complete list of 453 keys not translated to French (click to expand)</summary>

```
account_status, actions, admin_note, admin_note_placeholder, admin_role,
administration, approve, approve_selected, approve_shift, approve_shift_edit_hint,
approved_hours_summary, assistant_manager_role, attention, auto_return_seconds,
backup_json, bartender_role, btn_see_on_page, btn_view_shifts, change_shift,
change_status, changes_pin_prompt, check_and_edit_times, claim_shift,
confirm_and_next, confirm_entry, cook_role, copies, copy_week, create_shift,
data_missing, data_restored, deduct_break_label, delete_employee_confirm,
delete_selected, delete_selected_confirm, delete_shift, delete_shift_confirm,
department_filter_all, department_filter_label, department_label, department_none,
deselect, deselect_all, dishwasher_role, download_pdf, edit_employee_title,
edit_punch_no_entry, edit_punch_time, edit_punch_time_title, edit_shift, edit_view,
edited_by_prefix, email, email_placeholder, email_sent, employee,
employee_suspended_warning, end_time, entry, entry_btn, entry_ok, entry_registered,
exit, expected_time, export_csv, filter_active_click_to_clear, filter_all,
filter_approved_only, filter_drafts_only, filter_status, first_name,
global_pin_unlock_insufficient_role, global_pin_unlock_subtitle, global_pin_unlock_title,
good_work, good_work_comma, group_all, hide_suspended, holiday_management,
holiday_saved_email_sent, home_attendance_today, home_badge_in_shift, home_board_empty,
home_board_placeholder, home_btn_approve, home_btn_attendance, home_btn_close_shift,
home_btn_manage_shifts, home_btn_register, home_dashboard_title,
home_dinner_close_required, home_greeting, home_holiday_approved, home_holiday_pending,
home_holiday_rejected, home_holidays_section, home_hours_this_week, home_kpi_hours_week,
home_kpi_shifts_week, home_label_entry, home_label_exit_time, home_label_planned,
home_modal_close_dinner, home_modal_duration, home_modal_end, home_modal_start,
home_my_shifts, home_next_shift, home_no_requests, home_not_punched, home_punched,
home_requires_attention, home_section_attendance, home_see_all, home_see_all_shifts,
home_stat_approved, home_stat_delays, home_stat_in_shift, home_stat_missing_out,
home_status_anomaly, home_status_approved, home_status_complete, home_status_in_shift,
home_status_not_punched, home_status_to_approve, home_today, home_todays_shifts,
home_tomorrow, home_upcoming_holidays, home_vs_planned, hours_calc_from,
hours_this_month, import_error, import_warning, invite_redirecting, invite_subtitle,
invite_title, invite_verified, invite_verifying, last_name_optional, legend_approved,
legend_in_progress, legend_planned, load_error, manager_role, menu_functions,
mod_financial_reports, mod_my_shifts, mod_pdf_export, mod_team_schedule,
mod_vacation_requests, modified_times, modules_enabled, modules_enabled_desc,
n_shifts_confirmed, n_shifts_deleted, n_shifts_draft, names_list_title, nav_down,
nav_next, nav_prev, nav_up, new_open_shift, new_request, new_shift, no_access_settings,
no_change_at_16, no_holidays_yet, no_shift_today, no_shifts_scheduled, notif_aria_back,
open_shift, open_shifts, permission_approve_shifts, permission_approve_shifts_desc,
permission_create_shifts, permission_create_shifts_desc, permission_manage_drafts,
permission_manage_drafts_desc, permission_view_totals, permission_view_totals_desc,
permissions_granular, personnel, pin, pin_4_digits, pin_for_profile, pin_for_shift,
pin_mismatch, placeholder_first_name, placeholder_last_name, profile_settings,
profile_timesheet_show_shift_times_hint, profile_timesheet_show_shift_times_label,
profile_visibility_save_apply, publish_pin_prompt, publish_selected, publish_week,
punch_for_shift_at, punch_title_kiosk, real_times, registered_at, remove_test_user,
remove_test_user_confirm, remove_test_user_success, report_csv, request_holiday,
restore, role, role_admin, role_assistant_manager, role_bartender, role_cook,
role_dishwasher, role_manager, role_proprietario, role_waiter, rounded_to, save_all,
save_changes, save_error_retry, saving, scheduled_today, select, select_one_shift_to_edit,
select_shifts_to_edit, select_valid_json, settings_delete_user_button,
settings_delete_user_confirm, settings_delete_user_success, settings_delete_user_title,
shift_conflict_same_day, shift_plural, shift_selected, shift_singular, shifts_confirmed,
shifts_published, shifts_selected, shifts_week, show_menu, show_suspended, start_time,
stats_align_timesheet_period, stats_approved_hours, stats_approved_shifts_count,
stats_approved_shifts_in_period, stats_aria_date_end, stats_aria_date_start,
stats_base_salary_not_set, stats_confirmed_not_approved, stats_cost_from_rates,
stats_date_range, stats_estimated_cost, stats_hourly_rate_not_set,
stats_mgmt_personal_hours_period, stats_no_approved_for_cost, stats_no_approved_shifts,
stats_no_confirmed_shifts_period, stats_no_data, stats_no_pending_shifts,
stats_partial_hourly_rates, stats_payroll_date_line, stats_payroll_hint,
stats_payroll_title, stats_pending_shifts, stats_period_total_label, stats_planned_abbr,
stats_preset_current_month, stats_preset_current_week, stats_preset_custom,
stats_preset_period, stats_preset_prev_month, stats_selected_week,
stats_shifts_awaiting_approval, stats_team_hours_period, stats_total,
stats_week_by_week_heading, stats_week_no_hours, stats_week_tabs_aria,
stats_week_tabs_legend, stats_your_hours_in_range, status_approved, status_confirmed,
status_draft, sync_complete_pin_prompt, sync_lock_cancel, sync_lock_title,
sync_lock_wrong_pin, template_applied, template_apply, template_delete_confirm,
template_menu, template_my_templates, template_name_placeholder, template_no_templates,
template_save_current, template_saved, times_based_on_punches, tools_menu, tot,
total_hours, total_hours_label, ts_approval_freeze_notice, ts_approval_pin_invalid,
ts_approval_pin_label, ts_approval_pin_placeholder, ts_approving,
ts_audit_changes_title, ts_audit_field_calculated_time, ts_audit_field_clock_out_time,
ts_audit_field_timestamp, ts_audit_toggle_hint, ts_badge_in_shift, ts_break_deduction,
ts_break_hint_ready_card, ts_btn_approve_freeze, ts_btn_close_and_approve,
ts_btn_close_shift_insert_out, ts_btn_close_without_saving, ts_btn_register_exit,
ts_btn_save_and_close, ts_btn_save_and_next, ts_btn_skip, ts_btn_unlock_to_edit,
ts_btn_yes_approve_freeze, ts_check_filters, ts_dinner_close_required,
ts_drawer_approval_date, ts_drawer_approved_by, ts_drawer_approved_frozen,
ts_drawer_awaiting_completion, ts_drawer_edit_planned_times_btn,
ts_drawer_edit_planned_times_pin_title, ts_drawer_exit_time_punched,
ts_drawer_fix_exit_datetime, ts_drawer_freeze_btn, ts_drawer_freeze_title,
ts_drawer_no_edits, ts_drawer_no_further_edits, ts_drawer_not_punched_yet,
ts_drawer_nothing_to_save_hint, ts_drawer_planned_end_field, ts_drawer_planned_start_field,
ts_drawer_planned_times_save, ts_drawer_punch_edits, ts_drawer_shift_edits,
ts_drawer_shift_not_elapsed, ts_drawer_shift_time, ts_drawer_unlock_btn,
ts_drawer_unlock_title, ts_employee_name_menu_aria, ts_employee_week_review_empty,
ts_employee_week_review_menu, ts_employee_week_review_open_aria,
ts_employee_week_review_progress, ts_enter_manager_pin, ts_filter_label, ts_filter_punched,
ts_filter_punches_label, ts_freeze_planned_confirm, ts_freeze_planned_ref_hint,
ts_kpi_actual, ts_kpi_delta, ts_kpi_planned, ts_kpi_punched, ts_label_absent,
ts_label_actual_entry, ts_label_entry, ts_label_exit, ts_label_exit_date,
ts_label_exit_time, ts_label_from, ts_label_planned, ts_label_punched, ts_label_to,
ts_legend_complete, ts_legend_critical, ts_legend_manual_edit, ts_legend_validated,
ts_missing_exit, ts_modal_close_shift_title, ts_modal_confirm_approval,
ts_modal_entry_registered, ts_modal_hours_preview, ts_net_hours, ts_no_data,
ts_no_edits_allowed, ts_no_employees_found, ts_no_employees_this_week,
ts_no_shifts_description, ts_no_shifts_this_week, ts_orario, ts_orario_modificato,
ts_payroll_day_abbr, ts_period_custom, ts_period_month, ts_period_start, ts_period_week,
ts_preset_4weeks, ts_preset_5weeks, ts_ready_for_approval, ts_review_shifts_tooltip,
ts_review_short, ts_saving, ts_shift_approved_frozen, ts_status_approved,
ts_status_confirmed, ts_status_draft, ts_status_in_shift, ts_status_late,
ts_status_missing_out, ts_status_modified, ts_status_to_approve, ts_status_unpunched,
ts_times_grid_times_masked_aria, ts_times_masked_clock, ts_times_masked_delta,
ts_times_masked_hm, ts_times_masked_range, ts_times_masked_totals,
ts_timesheet_month_payroll_strip, ts_timesheet_month_tab_hint,
ts_toast_approve_freeze_error, ts_toast_day_review_complete,
ts_toast_employee_week_review_complete, ts_toast_exit_corrected, ts_toast_exit_error,
ts_toast_exit_saved, ts_toast_no_confirmed_shifts, ts_toast_shift_approved,
ts_toast_shift_time_updated, ts_toast_shift_unlocked, ts_toast_shift_updated,
ts_toast_unlock_error, ts_toast_wrong_pin, ts_unlocking, ts_warning_anomaly,
ts_warning_crossday_exit, ts_warning_no_exit, ts_warning_no_exit_confirm,
ts_warning_no_punch_in, upcoming_shifts, version, view_2weeks, view_day, view_month,
view_week, waiter_role, waiting_publication, week_hours, week_label, welcome_greeting,
wst_open_shifts_bar_collapse_aria, wst_open_shifts_bar_expand_aria
```

</details>

**Most impactful missing FR categories:**
- All `ts_*` keys (Timesheets module — ~130 keys) → entire timesheet module in English for FR users
- All `home_*` keys (Dashboard — ~40 keys) → home screen in English
- All `stats_*` keys (Statistics — ~30 keys) → stats module in English
- Role names: `role_admin`, `role_manager`, `role_bartender`, etc.
- Status labels: `status_approved`, `status_confirmed`, `status_draft`
- Navigation: `nav_next`, `nav_prev`, `nav_up`, `nav_down`

---

## 4. Translation Keys Used in Components but Missing from All Languages

Keys referenced as `t.keyName` in components that **do not exist in `translations.ts`** — these fall back to `undefined` (rendered as empty string or component breaks).

**Count: ~30 genuinely missing keys** (after filtering DOM/JS method names)

| Key | Used in | Impact |
|-----|---------|--------|
| `notif_empty_state` | `NotificationCenter.tsx:93` | Shows raw fallback: `'Nessuna notifica'` (hardcoded Italian) |
| `no_shifts_this_week` | `Timesheets.tsx:3896` | Shows hardcoded: `'Nessun turno questa settimana'` |
| `admin_banner` | Components | Silently empty |
| `admin_tab_profiles` | Admin UI | Silently empty |
| `admin_tab_rules` | Admin UI | Silently empty |
| `approval_status` | Multiple | Silently empty |
| `dinner_close` | Home/Shifts | Silently empty |
| `drag_to_reorder` | UI | Silently empty |
| `messages_all_read` | Messages | Silently empty |
| `messages_body_label` | MessageComposer | Silently empty |
| `messages_body_placeholder` | MessageComposer | Silently empty |
| `messages_chars_count` | MessageComposer | Silently empty |
| `messages_compose_placeholder` | MessageComposer | Silently empty |
| `messages_enter_body` | MessageComposer | Silently empty |
| `messages_enter_subject` | MessageComposer | Silently empty |
| `messages_latest` | MessagesList | Silently empty |
| `messages_new_chat` | Messages | Silently empty |
| `messages_new_conversation` | Messages | Silently empty |
| `messages_no_new` | Messages | Silently empty |
| `messages_recipient_all` | MessageComposer | Silently empty |
| `messages_recipient_label` | MessageComposer | Silently empty |
| `messages_recipient_private` | MessageComposer | Silently empty |
| `messages_recipient_select` | MessageComposer | Silently empty |
| `messages_send_btn` | MessageComposer | Silently empty |
| `messages_sent_ok` | MessageComposer | Silently empty |
| `messages_title` | Messages | Silently empty |
| `messages_write_placeholder` | MessageWriter | Silently empty |
| `notif_push_activate` | Notifications | Silently empty |
| `notif_push_blocked` | Notifications | Silently empty |
| `notif_push_hint` | Notifications | Silently empty |
| `ts_btn_confirm` | Timesheets | Silently empty |
| `ts_toast_shift_frozen` | Timesheets | Silently empty |
| `accent_color` | Settings | Silently empty |
| `card_ferie` | Dashboard | Silently empty |
| `card_kpi` | Dashboard | Silently empty |
| `card_presenze` | Dashboard | Silently empty |

> **Note:** The entire `messages_*` key group (20+ keys for the messaging feature) is absent from `translations.ts`. All message UI strings are either empty or rely on hardcoded Italian fallbacks.

---

## 5. Hardcoded Italian Strings in Components

The following Italian strings are hardcoded directly in JSX/TSX (not using `t.key`) — they **never change** regardless of user's language setting.

### 5.1 aria-label / title attributes (accessibility strings)

| File | Line | Attribute | Hardcoded Italian |
|------|------|-----------|-------------------|
| `NotificationModal.tsx` | 61 | `aria-label` | `"Chiudi"` |
| `DirectMessagesPanel.tsx` | 409 | `title` | `"Chiudi"` |
| `Statistics.tsx` | 561 | `aria-label` | `"Chiudi"` |
| `StaffPersonalDashboard.tsx` | 1134 | `aria-label` | `"Chiudi"` |
| `NotificationDropdown.tsx` | 87–88 | `title` / `aria-label` | `"Chiudi"` / `"Chiudi notifiche"` |
| `Timesheets.tsx` | 2872, 3611, 3784 | `aria-label` | `"Chiudi notifica"` / `"Chiudi"` |
| `LoginPage.tsx` | 407 | `aria-label` | `"Apri form di accesso"` |
| `AdminSyncOverlay.tsx` | 70 | `aria-label` | `"Aggiornamento dati in corso"` |
| `SwUpdateOverlay.tsx` | 64 | `aria-label` | `"Aggiornamento app"` |
| `SuperAdminPanel.tsx` | 520 | `title` | `"Modifica"` |
| `SuperAdminPanel.tsx` | 524 | `title` | `"Elimina"` |
| `SuperAdminPanel.tsx` | 1611 | `title` | `"Elimina sede"` |
| `HolidayRequests.tsx` | 468, 601 | `title` | `"Elimina richiesta"` |
| `MessagesList.tsx` | 163 | `title` | `"Elimina messaggio"` |
| `WeeklyShiftsTable.tsx` | 5963 | `title` | `"Deseleziona tutto"` |
| `WeeklyShiftsTable.tsx` | 4328 | `title` | `"Aggiungi turno"` |
| `WeeklyShiftsTable.tsx` | 4523 | `title` | `"Aggiungi turno serale"` |
| `WeeklyShiftsTable.tsx` | 2175 | `title` | `"Seleziona periodo"` |
| `Timesheets.tsx` | 3193 | `title` | `"Seleziona periodo"` |
| `Timesheets.tsx` | 3702 | `title` | `"Seleziona reparto per PDF"` |
| `ui/PinPadModal.tsx` | 204, 210 | `title` | `"Usa impronta digitale"` / `"Collega impronta digitale"` |
| `RoleFeatureTemplatesPage.tsx` | 791, 1008 | `title` prop | `"Visibilità nel Tabellone Turni"` |

### 5.2 Visible JSX text content

| File | Line | Hardcoded Italian text |
|------|------|----------------------|
| `StaffKioskView.tsx` | 165 | `<span>Chiudi</span>` |
| `Timesheets.tsx` | 3707 | `<span>Reparti</span>` |
| `ScreensPreview.tsx` | 394, 396 | `>Annulla</div>` / `>Conferma</div>` (preview UI) |
| `SuperAdminPanel.tsx` | 98 | `<p>Inserisci il PIN per accedere</p>` |
| `SuperAdminPanel.tsx` | 1186 | `<p>Salva queste credenziali in un posto sicuro</p>` |
| `SuperAdminPanel.tsx` | 2280 | `<p>Caricamento…</p>` |
| `SuperAdminPanel.tsx` | 2237 | Long Italian error message for CSV import |
| `SettingsPage.tsx` | 1636 | `<p>Salva una settimana dal tabellone turni usando il menu Template.</p>` |
| `SettingsPage.tsx` | 2012 | `<>Salvata</>` |
| `MessageComposer.tsx` | 97 | `<span>Inviato! ✅</span>` |
| `MessageComposer.tsx` | 143 | `<option>Seleziona dipendente...</option>` |
| `Timesheets.tsx` | 2827 | Suspense fallback: `<span>Caricamento…</span>` |
| `GestioneProfiliPage.tsx` | 183 | Long Italian admin description |
| `StaffPersonalDashboard.tsx` | 1121 | PWA install instructions in Italian |
| `WeeklyShiftsTable.tsx` | 5220 | `Sblocca modifica con PIN` |
| `WeeklyShiftsTable.tsx` | 5850 | `Nessun turno copiato` |

### 5.3 placeholder / subtitle props with hardcoded Italian

| File | Line | Prop | Hardcoded value |
|------|------|------|-----------------|
| `SuperAdminPanel.tsx` | 442 | `placeholder` | `"sala, bar, cucina…"` |
| `SuperAdminPanel.tsx` | 1061 | `placeholder` | `"Es. Ristorante Mario"` |
| `SuperAdminPanel.tsx` | 1080 | JSX text | `"Sarà il sottodominio: …"` |
| `SettingsPage.tsx` | 2000 | `placeholder` | `"es. direzione@azienda.it"` |
| `SettingsPage.tsx` | 2338 | `subtitle` prop | `"Inserisci il tuo PIN amministratore"` |
| `ProfileNavTabPanel.tsx` | 598 | `subtitle` prop | `"Inserisci il tuo PIN per accedere"` |
| `WeeklyShiftsTable.tsx` | 5514 | `subtitle` prop | `"Inserisci il PIN di un manager per modificare questo turno"` |
| `MessageWriter.tsx` | 308 | `placeholder` | `"Scrivi il tuo messaggio..."` |
| `MessageWriter.tsx` | 294 | `placeholder` | `"Es. Cambio Turno Domani"` |
| `ScreensPreview.tsx` | 176 | `placeholder` | `"Nome utente"` (preview component) |

### 5.4 t.key || 'Italian fallback' anti-pattern

These use a translation key with an Italian string fallback — the fallback fires for all non-IT languages if the key is missing:

| File | Line | Pattern |
|------|------|---------|
| `NotificationCenter.tsx` | 93 | `t.notif_empty_state \|\| 'Nessuna notifica'` (key missing!) |
| `Timesheets.tsx` | 3896 | `t.no_shifts_this_week \|\| 'Nessun turno questa settimana'` (key missing!) |
| `WeeklyShiftsTable.tsx` | 2478–2489 | `t.ts_export_week_pdf \|\| "Esporta PDF settimana corrente"` |
| `WeeklyShiftsTable.tsx` | 3005 | `t['bulk_copy_empty'] ?? 'Nessun turno trovato nella settimana precedente'` |
| `WeeklyShiftsTable.tsx` | 3009 | `showError?.('Errore durante la copia dei turni.')` — hardcoded error |

---

## 6. Summary Statistics

| Metric | Value |
|--------|-------|
| Total translation keys (IT base) | **1346** |
| EN translation coverage | **99.9%** (1 key missing) |
| ES translation coverage | **99.6%** (5 keys missing) |
| FR translation coverage | **66.4%** (453 keys missing) |
| Keys used in components but absent from ALL languages | **~34 keys** |
| Components with hardcoded Italian strings | **16 components** |
| Hardcoded Italian instances found | **50+** |
| Missing `messages_*` keys (entire feature group) | **~25 keys** |
| Missing `notif_push_*` keys (push notification UI) | **~8 keys** |

---

## 7. Priority Recommendations

### P0 — Critical (breaks functionality or UX)

1. **Add all missing `messages_*` translation keys** — the entire messaging feature UI renders empty strings for these keys in all languages, since the keys don't exist in `translations.ts`. Affected component: `MessageComposer.tsx`, `MessageWriter.tsx`, `MessagesList.tsx`.

2. **Add missing `notif_push_*` keys** — push notification UI shows empty labels. Affected: `NotificationCenter.tsx` and related.

3. **Add `notif_empty_state` key** — currently falls back to hardcoded Italian `'Nessuna notifica'` for all non-IT users.

### P1 — High (French users see English for core modules)

4. **Complete French translations for `ts_*` keys (~130 keys)** — the entire Timesheets management module is in English for French users.

5. **Complete French translations for `home_*` keys (~40 keys)** — the home dashboard is in English for French users.

6. **Complete French translations for `stats_*` keys (~30 keys)** — statistics module is in English for French users.

7. **Complete French translations for role names** (`role_admin`, `role_manager`, `role_bartender`, `role_cook`, `role_waiter`, `role_dishwasher`, `role_proprietario`, `waiter_role`, etc.)

### P2 — Medium (non-IT users see Italian in specific flows)

8. **Add ES translations for 5 missing keys** — specifically the `settings_delete_user_*` group (user deletion confirmation shown in Italian to Spanish users).

9. **Replace hardcoded `aria-label="Chiudi"` in 8+ components** with `aria-label={t.close}` (or appropriate key) — affects screen reader users in non-IT languages.

10. **Replace hardcoded `title="Modifica"`, `title="Elimina"` in `SuperAdminPanel.tsx`** with translation keys.

### P3 — Low (minor or isolated)

11. **Add EN translation for `profile_photo_source_sheet_aria`** — only 1 missing key, accessibility label only.

12. **Replace hardcoded `placeholder` strings in `SuperAdminPanel.tsx`** (lines 442, 1061) with translation keys.

13. **Replace `MessageWriter.tsx` hardcoded placeholders** with translation keys.

14. **Replace `StaffKioskView.tsx:165 <span>Chiudi</span>`** with `{t.close}`.

15. **Add missing `ts_btn_confirm`, `ts_toast_shift_frozen`, `card_ferie`, `card_kpi`, `card_presenze`** to `translations.ts`.

16. **Audit `ScreensPreview.tsx`** — this component is purely a UI preview/demo, so hardcoded Italian may be intentional; confirm with team.

---

## 8. Files Requiring the Most Attention

| File | Issues |
|------|--------|
| `src/utils/translations.ts` | Missing ~34 keys used by components; FR 34% untranslated |
| `src/components/WeeklyShiftsTable.tsx` | 6+ hardcoded Italian strings |
| `src/components/SuperAdminPanel.tsx` | 8+ hardcoded Italian strings |
| `src/components/Timesheets.tsx` | 4+ hardcoded Italian strings |
| `src/components/MessageComposer.tsx` | All `messages_*` keys missing from translations |
| `src/components/MessageWriter.tsx` | Hardcoded placeholders + missing keys |
| `src/components/NotificationCenter.tsx` | `notif_empty_state` key missing; Italian fallback shown to all |
