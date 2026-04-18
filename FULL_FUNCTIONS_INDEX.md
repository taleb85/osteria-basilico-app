# FULL FUNCTIONS INDEX — FLOW App
> Generato automaticamente · 2026-04-19 · 368 export utils + 84 componenti + 6 Edge Functions

---

## 1. Logica di Business

### 1.1 Turni & Timesheet

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `exportSchedulePDF` | Genera PDF turni settimanali | `weekStart, weekDays, users, shifts, options` → `Promise<void>` | ✅ | `src/utils/exportSchedulePDF.ts` |
| `exportTimesheetPdfToFile` | Genera PDF timesheet con range date | `ExportTimesheetPdfParams` → `Promise<void>` | ✅ | `src/utils/exportTimesheetPdf.ts` |
| `exportPersonalPDF` | Genera PDF mensile personale staff | `user, monthDate, shifts, holidays, name, rules` → `Promise<void>` | ✅ | `src/utils/exportPersonalPDF.ts` |
| `exportAttendancePdfFromGrid` | Esporta PDF presenze da griglia admin | `ExportAttendancePdfFromGridOptions` → `Promise<void>` | ✅ | `src/utils/timesheetPdfFromRange.ts` |
| `buildPunchMonthRows` | Costruisce righe CSV mese presenze | `users, shifts, punchRecords, month, opts` → `PunchMonthCsvRow[]` | ✅ | `src/utils/exportUtils.ts` |
| `exportPunchMonthToCsv` | Converte righe presenze in stringa CSV | `rows: PunchMonthCsvRow[]` → `string` | ✅ | `src/utils/exportUtils.ts` |
| `downloadPunchMonthCsv` | Scarica CSV presenze nel browser | `rows, filename` → `void` | ✅ | `src/utils/exportUtils.ts` |
| `exportToJSON` | Esporta dati grezzi in file JSON | `data: ExportData` → `void` | ✅ | `src/utils/exportData.ts` |
| `isShiftPayrollFrozen` | Controlla se turno è congelato (approvato) | `shift: Pick<Shift, approval_status, approved_at>` → `boolean` | ✅ | `src/utils/timesheetFreezeCriteria.ts` |
| `punchCompletenessForShift` | Verifica completezza timbrature per turno | `shift, punchRecords` → `PunchCompleteness` | ✅ | `src/utils/timesheetFreezeCriteria.ts` |
| `shiftCanBeFrozenFromTimesheet` | Verifica se turno può essere congelato | `shift, punchRecords` → `boolean` | ✅ | `src/utils/timesheetFreezeCriteria.ts` |
| `getTimesheetGridPrivacyMode` | Restituisce modalità privacy griglia presenze | `user` → `TimesheetGridPrivacyMode` | ✅ | `src/utils/timesheetGridPrivacy.ts` |
| `hasShiftConflictSameDay` | Controlla se il turno si sovrappone ad altri | `existing[], newShift` → `boolean` | interno | `src/context/AppContext.tsx` |
| `getShiftViolations` | Calcola violazioni regole lavoro per turno | `shift, allShifts, userId, workRules` → `ShiftViolation[]` | ✅ | `src/utils/workRules.ts` |
| `weeklyMinutes` | Calcola minuti settimanali lavorati | `shifts, userId, weekStart` → `number` | ✅ | `src/utils/workRules.ts` |
| `violationColor` | Colore CSS per severità violazioni | `violations: ShiftViolation[]` → `string` | ✅ | `src/utils/workRules.ts` |
| `violationTooltip` | Testo tooltip per violazioni | `violations: ShiftViolation[]` → `string` | ✅ | `src/utils/workRules.ts` |
| `getWorkRules` | Legge regole di lavoro da localStorage | `()` → `WorkRules` | ✅ | `src/utils/workRules.ts` |
| `saveWorkRules` | Persiste regole lavoro in localStorage | `rules: WorkRules` → `void` | ✅ | `src/utils/workRules.ts` |
| `loadWorkRulesFromSupabase` | Carica regole lavoro da Supabase Storage | `()` → `Promise<WorkRules \| null>` | ✅ | `src/utils/workRules.ts` |
| `saveWorkRulesToSupabase` | Salva regole lavoro su Supabase Storage | `rules: WorkRules` → `Promise<void>` | ✅ | `src/utils/workRules.ts` |
| `logHistory` | Registra azione nella cronologia turni | `action, actorName, description` → `void` | ✅ | `src/utils/scheduleHistory.ts` |
| `logShiftEdit` | Registra modifica specifica a un turno | `{ shiftId, field, oldVal, newVal, ... }` → `void` | ✅ | `src/utils/scheduleHistory.ts` |
| `getShiftHistory` | Recupera cronologia di un turno | `shiftId: string` → `HistoryEntry[]` | ✅ | `src/utils/scheduleHistory.ts` |
| `getHistory` | Recupera tutta la cronologia | `()` → `HistoryEntry[]` | ✅ | `src/utils/scheduleHistory.ts` |
| `clearHistory` | Azzera la cronologia | `()` → `void` | ✅ | `src/utils/scheduleHistory.ts` |
| `isCambioAt16` | Verifica se turno cambio finisce alle 16 | `endTime: string` → `boolean` | ✅ | `src/utils/shiftChangeTypes.ts` |
| `isDayShift` | Verifica se è turno giornaliero | `startTime: string` → `boolean` | ✅ | `src/utils/shiftChangeTypes.ts` |
| `scanShiftsFromPhoto` | OCR: estrae turni da foto con Gemini AI | `file: File` → `Promise<ParsedShiftRow[]>` | ✅ | `src/lib/scanShiftsFromPhoto.ts` |
| `payrollSchedule.*` | Calcola date pagamento paga | vari | ✅ | `src/utils/payrollSchedule.ts` |
| `getPayrollPaymentDateForCalendarMonth` | Data pagamento per mese | `monthRef: Date` → `Date` | ✅ | `src/utils/payrollSchedule.ts` |
| `isPayrollPaymentDay` | Verifica se giorno è pagamento | `day: Date` → `boolean` | ✅ | `src/utils/payrollSchedule.ts` |

### 1.2 Timbrature & Orari

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `getPunchPairForShift` | Trova coppia timbratura entrata/uscita per turno | `shift, punchRecords[]` → `{ in, out }` | ✅ | `src/utils/shiftResolvedClockTimes.ts` |
| `punchTimeHHMM` | Converte timestamp timbratura in HH:MM | `ts: string \| null` → `string \| null` | ✅ | `src/utils/shiftResolvedClockTimes.ts` |
| `getResolvedStartEndForHours` | Risolve orario effettivo (punch o pianificato) | `shift, punchRecords, opts` → `{ start, end, source }` | ✅ | `src/utils/shiftResolvedClockTimes.ts` |
| `getDefaultApprovalClockHHMM` | Orario default per approvazione | `shift, punchRecords` → `{ startHHMM, endHHMM }` | ✅ | `src/utils/shiftResolvedClockTimes.ts` |
| `shiftPastPlannedEndWithoutClockIn` | Controlla se turno è scaduto senza timbratura | `shift, now` → `boolean` | ✅ | `src/utils/shiftResolvedClockTimes.ts` |
| `computeEffectivePunchIn` | Calcola timbratura effettiva considerando regole | `shift, punchRecords` → `string \| null` | interno | `src/context/AppContext.tsx` |
| `calculateShiftMinutesGross` | Minuti lordi turno (start→end) | `startHHMM, endHHMM` → `number` | ✅ | `src/utils/timeCalculations.ts` |
| `getNetShiftMinutes` | Minuti netti turno sottraendo pause | `shift, breakRules, opts` → `number` | ✅ | `src/utils/breakRules.ts` |
| `getBreakMinutesForShift` | Minuti pausa applicabili a un turno | `shift, grossMinutes, user, breakRules, opts` → `number` | ✅ | `src/utils/breakRules.ts` |
| `calculateBreakDeductions` | Calcola deduzioni pause per lista turni | `shifts, user, breakRules, opts` → `Record<string,number>` | ✅ | `src/utils/breakRules.ts` |
| `calculateBreakDeductionsSafe` | Versione sicura con fallback errori | `...` → `Record<string,number>` | ✅ | `src/utils/breakRules.ts` |
| `getActiveBreakRules` | Filtra regole pause attive | `rules: BreakRule[] \| null` → `BreakRule[]` | ✅ | `src/utils/breakRules.ts` |
| `getBreakRules` | Legge regole pause da localStorage | `()` → `BreakRule[]` | ✅ | `src/utils/breakRules.ts` |
| `saveBreakRules` | Salva regole pause in localStorage | `rules: BreakRule[]` → `void` | ✅ | `src/utils/breakRules.ts` |
| `loadBreakRulesFromSupabase` | Carica regole pause da Supabase | `()` → `Promise<BreakRule[] \| null>` | ✅ | `src/utils/breakRules.ts` |
| `saveBreakRulesToSupabase` | Salva regole pause su Supabase | `rules: BreakRule[]` → `Promise<void>` | ✅ | `src/utils/breakRules.ts` |
| `getPeriodStartDate` | Data inizio periodo corrente | `config: PeriodConfig` → `Date` | ✅ | `src/utils/periodConfig.ts` |
| `getPeriodEndDate` | Data fine periodo corrente | `config: PeriodConfig` → `Date` | ✅ | `src/utils/periodConfig.ts` |
| `getPeriodDateRange` | Range date periodo (start/end string) | `config: PeriodConfig` → `{ startDate, endDate }` | ✅ | `src/utils/periodConfig.ts` |
| `loadPeriodConfig` | Carica config periodo da localStorage | `()` → `PeriodConfig` | ✅ | `src/utils/periodConfig.ts` |
| `savePeriodConfig` | Salva config periodo in localStorage | `cfg: PeriodConfig` → `void` | ✅ | `src/utils/periodConfig.ts` |
| `nextPeriodConfig` | Config periodo successivo | `current: PeriodConfig` → `PeriodConfig` | ✅ | `src/utils/periodConfig.ts` |
| `prevPeriodConfig` | Config periodo precedente | `current: PeriodConfig` → `PeriodConfig` | ✅ | `src/utils/periodConfig.ts` |
| `currentPeriodConfig` | Config periodo attuale | `()` → `PeriodConfig` | ✅ | `src/utils/periodConfig.ts` |
| `weekIndexForDateInPeriod` | Indice settimana in periodo | `config, refDate` → `number` | ✅ | `src/utils/periodConfig.ts` |
| `periodConfigForMonth` | Config periodo per mese | `refDate: Date` → `PeriodConfig` | ✅ | `src/utils/periodConfig.ts` |
| `timesheetPeriodSupabase.*` | CRUD periodi timesheet su Supabase | vari | ✅ | `src/utils/timesheetPeriodSupabase.ts` |

### 1.3 Ferie & Richieste

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `countUnreadNotifications` | Conta notifiche non lette per utente | `currentUser, shifts, holidays, users, t, lang` → `number` | ✅ | `src/utils/notifications.ts` |
| `hiddenPeriods.*` | Gestione periodi nascosti nel calendario | vari | ✅ | `src/utils/hiddenPeriods.ts` |

### 1.4 Geofence & Presenza

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `haversineDistanceMeters` | Distanza in metri tra due coordinate | `lat1, lon1, lat2, lon2` → `number` | ✅ | `src/utils/geo.ts` |
| `isUserInRestaurantRange` | Verifica se utente è nel raggio ristorante | `userLat, userLon, config, overrideRadius?` → `boolean` | ✅ | `src/utils/geo.ts` |
| `getCurrentPositionCoords` | Ottiene posizione GPS corrente | `()` → `Promise<GeolocationCoords>` | ✅ | `src/utils/geo.ts` |
| `resolveEffectiveGeofenceConfig` | Risolve config geofence attiva (disk+env) | `diskConfig: GeofenceConfig \| null` → `GeofenceConfig \| null` | ✅ | `src/utils/geofencePunch.ts` |
| `readGeofenceEnvConfig` | Legge config geofence da env vars | `()` → `GeofenceConfig \| null` | ✅ | `src/utils/geofencePunch.ts` |
| `getLocalGeofenceConfig` | Legge config geofence da localStorage | `()` → `GeofenceConfig \| null` | ✅ | `src/utils/geofenceConfigStorage.ts` |
| `writeLocalGeofenceConfig` | Scrive config geofence in localStorage | `data: GeofenceConfig` → `void` | ✅ | `src/utils/geofenceConfigStorage.ts` |
| `mergeGeofenceDiskLayers` | Fonde layer config geofence | `local, remote` → `GeofenceConfig` | ✅ | `src/utils/geofenceConfigStorage.ts` |
| `loadGeofenceConfigFromSupabase` | Carica config geofence da Supabase | `()` → `Promise<GeofenceConfig \| null>` | ✅ | `src/utils/geofenceConfigStorage.ts` |
| `saveGeofenceConfigToSupabase` | Salva config geofence su Supabase | `data: GeofenceConfig` → `Promise<void>` | ✅ | `src/utils/geofenceConfigStorage.ts` |
| `parseGeofenceFile` | Valida e parsa JSON config geofence | `raw: unknown` → `GeofenceConfig \| null` | ✅ | `src/utils/geofenceConfigStorage.ts` |
| `buildSignedPresenceQrPayload` | Genera payload QR firmato crittograficamente | `secret, userId, timestamp` → `Promise<string>` | ✅ | `src/utils/presenceProofVerification.ts` |
| `verifyPresenceProofScanned` | Verifica firma payload QR scansionato | `scanned, secret, opts` → `Promise<{ valid, userId, ... }>` | ✅ | `src/utils/presenceProofVerification.ts` |
| `buildVerificationPayloadFromAuthKey` | Costruisce payload da chiave auth | `secret: string` → `string` | ✅ | `src/utils/presenceVerificationPayload.ts` |
| `resolveEffectiveVerificationToken` | Risolve token verifica attivo | `disk: PresenceVerificationConfig \| null` → `string` | ✅ | `src/utils/presenceVerificationPayload.ts` |
| `normalizePresenceProof` | Normalizza stringa proof QR | `raw: string` → `string` | ✅ | `src/utils/presenceVerificationPayload.ts` |
| `generateRandomVerificationToken` | Genera token casuale per verifica | `()` → `string` | ✅ | `src/utils/presenceVerificationPayload.ts` |
| `readOsteriaAuthKeyFromEnv` | Legge chiave auth da env vars | `()` → `string` | ✅ | `src/utils/presenceVerificationPayload.ts` |
| `getLocalPresenceVerificationConfig` | Legge config verifica presenza locale | `()` → `PresenceVerificationConfig \| null` | ✅ | `src/utils/presenceVerificationConfigStorage.ts` |
| `writeLocalPresenceVerificationConfig` | Scrive config verifica presenza | `data: PresenceVerificationConfig` → `void` | ✅ | `src/utils/presenceVerificationConfigStorage.ts` |
| `loadPresenceVerificationFromSupabase` | Carica config verifica da Supabase | `()` → `Promise<PresenceVerificationConfig \| null>` | ✅ | `src/utils/presenceVerificationConfigStorage.ts` |
| `savePresenceVerificationToSupabase` | Salva config verifica su Supabase | `data` → `Promise<void>` | ✅ | `src/utils/presenceVerificationConfigStorage.ts` |
| `mergePresenceVerificationLayers` | Fonde layer config verifica presenza | `local, remote` → `PresenceVerificationConfig` | ✅ | `src/utils/presenceVerificationConfigStorage.ts` |
| `generatePresenceQrDataUrl` | Genera data URL QR per presenza | `payload: string` → `Promise<string>` | ✅ | `src/utils/qrPresence.ts` |
| `openPresenceQrPrintWindow` | Apre finestra stampa QR presenza | `dataUrl, subtitle` → `void` | ✅ | `src/utils/qrPresence.ts` |
| `scanQrCodeFromCamera` | Avvia scanner QR da fotocamera | `elementId: string` → `Promise<string>` | ✅ | `src/utils/qrScanner.ts` |
| `stopActiveQrScanner` | Ferma scanner QR attivo | `()` → `Promise<void>` | ✅ | `src/utils/qrScanner.ts` |

### 1.5 Permessi & Ruoli

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `isAdminOnly` | Verifica se utente è solo admin | `user` → `boolean` | ✅ | `src/utils/permissions.ts` |
| `isManagementRole` | Verifica se ruolo è management | `role: string` → `boolean` | ✅ | `src/utils/permissions.ts` |
| `canEditTeamShifts` | Può modificare turni del team | `user` → `boolean` | ✅ | `src/utils/permissions.ts` |
| `canOperateTeamSchedule` | Può operare sullo schedule del team | `user` → `boolean` | ✅ | `src/utils/permissions.ts` |
| `canApproveShiftActions` | Può approvare azioni su turni | `user` → `boolean` | ✅ | `src/utils/permissions.ts` |
| `canPublishScheduleDrafts` | Può pubblicare bozze schedule | `user` → `boolean` | ✅ | `src/utils/permissions.ts` |
| `wouldLeaveNoActiveAdmin` | Verifica se rimozione lascerebbe zero admin | `users, userId` → `boolean` | ✅ | `src/utils/permissions.ts` |
| `countActiveAdmins` | Conta admin attivi | `users: User[]` → `number` | ✅ | `src/utils/permissions.ts` |
| `findFreezeVerifierByPin` | Trova verifier freeze da PIN | `users, pin` → `User \| undefined` | ✅ | `src/utils/permissions.ts` |
| `findFreezeVerifierById` | Trova verifier freeze da ID | `users, userId` → `User \| undefined` | ✅ | `src/utils/permissions.ts` |
| `isPurelyManagementRole` | Verifica ruolo esclusivamente gestionale | `role: string` → `boolean` | ✅ | `src/utils/permissions.ts` |
| `isAdminSettingsTabEnabled` | Tab impostazioni admin abilitata | `user` → `boolean` | ✅ | `src/utils/enabledFeatures.ts` |
| `isFeatureEnabled` | Verifica se feature è abilitata per utente | `user, featureKey` → `boolean` | ✅ | `src/utils/enabledFeatures.ts` |
| `isAdminModuleEnabled` | Verifica se modulo admin è abilitato | `user, key: AdminModuleKey` → `boolean` | ✅ | `src/utils/enabledFeatures.ts` |
| `getEnabledFeatures` | Restituisce features abilitate utente | `user` → `EnabledFeatures` | ✅ | `src/utils/enabledFeatures.ts` |
| `getDefaultEnabledFeatures` | Features default per ruolo | `role: string` → `EnabledFeatures` | ✅ | `src/utils/enabledFeatures.ts` |
| `getRolePermissionGroup` | Gruppo permessi per ruolo | `role: string` → `'admin' \| RoleTemplateGroup` | ✅ | `src/utils/enabledFeatures.ts` |
| `buildMergedTemplateForAdminEditor` | Fonde template per editor admin | `group, overrides` → `EnabledFeatures` | ✅ | `src/utils/enabledFeatures.ts` |
| `buildMergedAdminModulesForAdminEditor` | Fonde moduli admin per editor | `()` → `Record<AdminModuleKey, boolean>` | ✅ | `src/utils/enabledFeatures.ts` |
| `getAdminModuleEnabled` | Moduli admin abilitati per utente | `user` → `Partial<Record<AdminModuleKey, boolean>>` | ✅ | `src/utils/enabledFeatures.ts` |
| `serializeTemplateGroupForDisk` | Serializza gruppo template per salvataggio | `group, features` → `object` | ✅ | `src/utils/enabledFeatures.ts` |
| `isModuleEnabled` | Verifica se modulo è abilitato per utente | `user, module: EnabledModule` → `boolean` | ✅ | `src/utils/enabledModules.ts` |
| `getEnabledModules` | Moduli abilitati per utente | `user` → `EnabledModule[]` | ✅ | `src/utils/enabledModules.ts` |
| `getDefaultEnabledModules` | Moduli default per ruolo | `role: string` → `EnabledModule[]` | ✅ | `src/utils/enabledModules.ts` |
| `getUnifiedNavTabs` | Tab navigazione unificata per utente | `user, isManagement, featureFlags` → `AppNavTab[]` | ✅ | `src/utils/enabledModules.ts` |
| `getBottomNavTabsForMainApp` | Tab bottom nav app principale | `user, isManagement, featureFlags` → `AppNavTab[]` | ✅ | `src/utils/enabledModules.ts` |
| `getVisibleManagementTabs` | Tab visibili per management | `user, featureFlags` → `string[]` | ✅ | `src/utils/enabledModules.ts` |
| `getVisibleStaffTabs` | Tab visibili per staff | `user, featureFlags` → `string[]` | ✅ | `src/utils/enabledModules.ts` |
| `isTabEnabledForUser` | Verifica tab abilitato per utente | `user, tab, featureFlags` → `boolean` | ✅ | `src/utils/enabledModules.ts` |
| `isStaffRequestsFeatureEnabled` | Feature richieste staff abilitata | `featureFlags` → `boolean` | ✅ | `src/utils/enabledModules.ts` |
| `translateRole` | Traduce nome ruolo | `role, lang` → `string` | ✅ | `src/utils/roles.ts` |
| `getRoleLabel` | Label display per ruolo | `role: string` → `string` | ✅ | `src/utils/roles.ts` |
| `getRoleScopeHint` | Suggerimento scope per ruolo | `role, lang` → `string` | ✅ | `src/utils/roleScopeHint.ts` |
| `normalizeUserRoleFromRow` | Normalizza ruolo da riga DB | `role: unknown` → `UserRole` | ✅ | `src/utils/staffPermissionDefaults.ts` |
| `defaultOperationalTemplateBase` | Template base permessi operativi | `()` → `Record<SettingsOperationalPermKey, boolean>` | ✅ | `src/utils/settingsPermissionRows.ts` |
| `buildSettingsPermissionRows` | Costruisce righe permessi settings | `t: translations` → `array` | ✅ | `src/utils/settingsPermissionRows.ts` |
| `operationalPayloadForUser` | Payload permessi operativi per utente | `user, template` → `object` | ✅ | `src/utils/roleTemplateUserSync.ts` |
| `normalizeStaffName` | Normalizza nome staff per matching | `raw: string` → `string` | ✅ | `src/utils/loginIdentifier.ts` |
| `pinMatchesStored` | Verifica PIN corrispondenza | `user, typedPin` → `boolean` | ✅ | `src/utils/loginIdentifier.ts` |
| `findUsersMatchingName` | Trova utenti per nome | `users, nameRaw` → `User[]` | ✅ | `src/utils/loginIdentifier.ts` |
| `findUserByNameAndPin` | Trova utente attivo per nome+PIN | `users, nameRaw, pin` → `User \| undefined` | ✅ | `src/utils/loginIdentifier.ts` |
| `findUserByNameAndPinAnyStatus` | Trova utente qualsiasi stato per nome+PIN | `users, nameRaw, pin` → `User \| undefined` | ✅ | `src/utils/loginIdentifier.ts` |
| `getLoginNamePinFailureKind` | Tipo di errore login nome+PIN | `users, nameRaw, pin` → `LoginNamePinFailureKind` | ✅ | `src/utils/loginIdentifier.ts` |
| `findUserByNameAndSecondaryPin` | Trova utente con PIN secondario | `users, nameRaw, pin` → `User \| undefined` | ✅ | `src/utils/loginIdentifier.ts` |
| `findActiveUserWithSamePin` | Trova utenti con stesso PIN | `users, pin, excludeId?` → `User \| null` | ✅ | `src/utils/loginIdentifier.ts` |

### 1.6 Feature Flags & Sync Cloud

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `getLocalFeatureFlags` | Legge feature flags da localStorage | `()` → `FeatureFlags` | ✅ | `src/utils/featureFlags.ts` |
| `saveLocalFeatureFlag` | Salva singolo flag in localStorage | `slug, enabled` → `void` | ✅ | `src/utils/featureFlags.ts` |
| `writeFeatureFlagsToStorage` | Scrive tutti i flags in localStorage | `flags: FeatureFlags` → `void` | ✅ | `src/utils/featureFlags.ts` |
| `loadFeatureFlagsFromSupabase` | Carica flags da Supabase Storage | `()` → `Promise<FeatureFlags \| null>` | ✅ | `src/utils/featureFlags.ts` |
| `updateFeatureFlagInSupabase` | Aggiorna singolo flag su Supabase | `slug, enabled` → `Promise<void>` | ✅ | `src/utils/featureFlags.ts` |
| `writeAllFeatureFlagsToSupabase` | Scrive tutti i flags su Supabase | `flags: FeatureFlags` → `Promise<void>` | ✅ | `src/utils/featureFlags.ts` |
| `isAppCloudSyncEnabled` | Verifica se sync cloud è attivo | `()` → `boolean` | ✅ | `src/utils/appCloudSync.ts` |
| `fetchGlobalSettingsBundleFromSupabase` | Scarica bundle impostazioni globali | `opts?` → `Promise<AppGlobalSettingsBundle \| null>` | ✅ | `src/utils/globalSettingsCloud.ts` |
| `uploadGlobalSettingsBundleToSupabase` | Carica bundle impostazioni su Supabase | `bundle` → `Promise<void>` | ✅ | `src/utils/globalSettingsCloud.ts` |
| `pullGlobalSettingsBundleOnAppBoot` | Scarica bundle all'avvio app | `()` → `Promise<AppGlobalSettingsBundle \| null>` | ✅ | `src/utils/globalSettingsCloud.ts` |
| `bumpAppSettingsSyncSignal` | Incrementa revisione sync impostazioni | `()` → `Promise<void>` | ✅ | `src/utils/globalSettingsCloud.ts` |
| `buildGlobalSettingsBundleFromParts` | Costruisce bundle da componenti separati | `parts` → `AppGlobalSettingsBundle` | ✅ | `src/utils/globalSettingsCloud.ts` |
| `parseGlobalSettingsBundle` | Valida e parsa bundle impostazioni | `raw: unknown` → `AppGlobalSettingsBundle \| null` | ✅ | `src/utils/globalSettingsCloud.ts` |
| `invalidateAppBootGlobalSettingsBundlePull` | Invalida cache bundle all'avvio | `()` → `void` | ✅ | `src/utils/globalSettingsCloud.ts` |
| `getAckClientSyncRevision` | Legge revisione sync confermata client | `()` → `number` | ✅ | `src/utils/clientSyncRevision.ts` |
| `writeAckClientSyncRevision` | Scrive revisione sync confermata | `revision: number` → `void` | ✅ | `src/utils/clientSyncRevision.ts` |
| `fetchClientSyncRevisionFromSupabase` | Scarica revisione sync da Supabase | `()` → `Promise<number \| null>` | ✅ | `src/utils/clientSyncRevision.ts` |
| `bumpClientSyncRevisionOnSupabase` | Incrementa revisione sync su Supabase | `()` → `Promise<number \| null>` | ✅ | `src/utils/clientSyncRevision.ts` |
| `loadRoleFeatureTemplatesFromSupabase` | Carica template ruoli da Supabase | `()` → `Promise<RoleFeatureTemplatesOnDisk \| null>` | ✅ | `src/utils/roleFeatureTemplates.ts` |
| `saveRoleFeatureTemplatesToSupabase` | Salva template ruoli su Supabase | `data` → `Promise<void>` | ✅ | `src/utils/roleFeatureTemplates.ts` |
| `loadAndMergeRoleTemplates` | Fonde template remoti e locali | `remote, local` → `RoleFeatureTemplatesOnDisk` | ✅ | `src/utils/roleFeatureTemplates.ts` |
| `getLocalRoleFeatureTemplates` | Legge template ruoli locali | `()` → `RoleFeatureTemplatesOnDisk \| null` | ✅ | `src/utils/roleFeatureTemplates.ts` |
| `writeRoleFeatureTemplatesLocal` | Scrive template ruoli locali | `data` → `void` | ✅ | `src/utils/roleFeatureTemplates.ts` |
| `setRoleFeatureTemplatesCache` | Imposta cache in-memory template ruoli | `data \| null` → `void` | ✅ | `src/utils/roleFeatureTemplates.ts` |
| `loadAdminModulesGlobalFromSupabase` | Carica moduli admin globali da Supabase | `()` → `Promise<AdminModulesGlobalOnDisk \| null>` | ✅ | `src/utils/adminModulesGlobal.ts` |
| `saveAdminModulesGlobalToSupabase` | Salva moduli admin globali su Supabase | `data` → `Promise<void>` | ✅ | `src/utils/adminModulesGlobal.ts` |
| `loadAndMergeAdminModulesGlobal` | Fonde moduli admin remoti e locali | `remote, local` → `AdminModulesGlobalOnDisk` | ✅ | `src/utils/adminModulesGlobal.ts` |
| `loadDepartmentsFromSupabase` | Carica reparti da Supabase | `()` → `Promise<DepartmentsCloudV1 \| null>` | ✅ | `src/utils/departmentsCloud.ts` |
| `saveDepartmentsToSupabase` | Salva reparti su Supabase | `snapshot` → `Promise<void>` | ✅ | `src/utils/departmentsCloud.ts` |
| `sendForceReloadPush` | Invia push notification per force reload | `senderId?` → `Promise<void>` | ✅ | `src/utils/sendForceReloadPush.ts` |
| `registerOsteriaBackgroundSync` | Registra background sync SW | `()` → `Promise<boolean>` | ✅ | `src/utils/backgroundSync.ts` |
| `supportsBackgroundSync` | Verifica supporto background sync | `()` → `boolean` | ✅ | `src/utils/backgroundSync.ts` |

### 1.7 Reparti & Statistiche

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `getDepartments` | Lista reparti correnti | `()` → `Department[]` | ✅ | `src/utils/departments.ts` |
| `addDepartment` | Aggiunge reparto | `value, label, color` → `Department[]` | ✅ | `src/utils/departments.ts` |
| `removeDepartment` | Rimuove reparto | `value: string` → `Department[]` | ✅ | `src/utils/departments.ts` |
| `updateDepartment` | Aggiorna reparto | `value, patch` → `Department[]` | ✅ | `src/utils/departments.ts` |
| `getDeptColor` | Colore CSS reparto | `value: string` → `string` | ✅ | `src/utils/departments.ts` |
| `getDeptPermissionMatchKeys` | Chiavi permesso per reparto | `deptValue` → `string[]` | ✅ | `src/utils/departments.ts` |
| `deptMatchesFilterKey` | Verifica reparto corrisponde filtro | `dept, filterKey` → `boolean` | ✅ | `src/utils/departments.ts` |
| `departmentMatchesBreakRuleDepartments` | Reparto corrisponde a regole pause | `dept, rule` → `boolean` | ✅ | `src/utils/departments.ts` |
| `translateDepartmentValue` | Traduce nome reparto | `value, lang` → `string` | ✅ | `src/utils/departmentLabels.ts` |
| `formatDepartmentDisplayForProfile` | Formato display reparto per profilo | `value, lang` → `string` | ✅ | `src/utils/departmentLabels.ts` |
| `stats.*` | Calcolo statistiche presenze/ore | vari | ✅ | `src/utils/stats.ts` |

### 1.8 Database & Supabase

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `database` | Oggetto CRUD per users/shifts/holidays/punch | `.users.*, .shifts.*, .holidays.*, .punchRecords.*` | ✅ | `src/lib/database.ts` |
| `setDatabaseTenant` | Imposta tenant ID per query DB | `tenantId: string` → `void` | ✅ | `src/lib/database.ts` |
| `getDatabaseTenant` | Legge tenant ID corrente | `()` → `string \| null` | ✅ | `src/lib/database.ts` |
| `formatSupabaseError` | Formatta errore Supabase leggibile | `err: unknown` → `string` | ✅ | `src/lib/database.ts` |
| `supabase` | Client Supabase (anon key) | — | ✅ | `src/lib/supabase.ts` |
| `supabaseAdmin` | Client Supabase (service role) | — | ✅ | `src/lib/supabase.ts` |

---

## 2. Componenti UI & Hooks

### 2.1 Componenti Principali

| Componente | Scopo | Props principali | Export | File |
|---|---|---|---|---|
| `App` | Root app — routing principale | — | `default` | `src/App.tsx` |
| `LoginPage` | Pagina login con PIN/nome | `onLogin, onBack` | `default` | `src/components/LoginPage.tsx` |
| `HomePage` | Dashboard home management/staff | `activeTab, onNavigateTo*` | `default` | `src/components/HomePage.tsx` |
| `WeeklyShiftsTable` | Griglia turni settimanale | `filterUserId?, stickyDateBarInScrollPane?` | `default` | `src/components/WeeklyShiftsTable.tsx` |
| `Timesheets` | Gestione timesheet admin | — | `default` | `src/components/Timesheets.tsx` |
| `HolidayRequests` | Gestione richieste ferie | — | `default` | `src/components/HolidayRequests.tsx` |
| `Statistics` | Statistiche ore e presenze | — | `default` | `src/components/Statistics.tsx` |
| `SettingsPage` | Pagina impostazioni | `view?` | `default` | `src/components/SettingsPage.tsx` |
| `SettingsHub` | Hub impostazioni modulare | — | `default` | `src/components/SettingsHub.tsx` |
| `AdminLayout` | Layout area admin con sidebar | — | `default` | `src/components/AdminLayout.tsx` |
| `AdminPanel` | Pannello amministrazione | — | `default` | `src/components/AdminPanel.tsx` |
| `SuperAdminPanel` | Pannello super-admin multi-tenant | — | `default` | `src/components/SuperAdminPanel.tsx` |
| `AdminGate` | Guard — blocca accesso non-admin | `children` | `default` | `src/components/AdminGate.tsx` |
| `StaffPersonalDashboard` | Dashboard personale staff | `user, onLogout, activeTab, onTabChange` | `default` | `src/components/StaffPersonalDashboard.tsx` |
| `ProfileNavTabPanel` | Pannello profilo con tab | `onLogout, onGoToSettings` | `default` | `src/components/ProfileNavTabPanel.tsx` |
| `UserProfile` | Form profilo utente | — | interno | `src/components/UserProfile.tsx` |
| `ProfileFormSelf` | Form modifica profilo self | vari | ✅ | `src/components/UserProfile.tsx` |
| `ProfileFormAdmin` | Form modifica profilo admin | `user, ...` | ✅ | `src/components/UserProfile.tsx` |
| `AdminTimesheetGridPrivacyEditor` | Editor privacy griglia timesheet | `user: User` | ✅ | `src/components/UserProfile.tsx` |
| `GestioneProfiliPage` | Pagina gestione profili staff | — | `default` | `src/components/GestioneProfiliPage.tsx` |
| `ProfileVisibilityHub` | Hub visibilità profilo staff | `initialSelectedUserId?, onClose?` | `default` | `src/components/ProfileVisibilityHub.tsx` |
| `ImpostazioniPage` | Pagina impostazioni avanzata | `onOpenProfilesTab?` | `default` | `src/components/ImpostazioniPage.tsx` |
| `RoleFeatureTemplatesPage` | Pagina template permessi ruolo | — | interno | `src/components/RoleFeatureTemplatesPage.tsx` |
| `RoleFeatureTemplatesPanel` | Pannello template permessi | `variant?` | ✅ | `src/components/RoleFeatureTemplatesPage.tsx` |
| `StaffOperationalPermissionsEditor` | Editor permessi operativi staff | `user, currentUser` | `default` | `src/components/StaffOperationalPermissionsEditor.tsx` |

### 2.2 Modali & Overlay

| Componente | Scopo | Props principali | Export | File |
|---|---|---|---|---|
| `EditShiftModal` | Modal modifica turno | `shift, onClose` | `default` | `src/components/EditShiftModal.tsx` |
| `ApproveShiftModal` | Modal approvazione turno | `shift, punchRecords, userName, onClose, onApprove` | `default` | `src/components/ApproveShiftModal.tsx` |
| `CreateStaffModal` | Modal creazione staff | `isOpen, onClose, ...` | `default` | `src/components/CreateStaffModal.tsx` |
| `EditStaffModal` | Modal modifica staff | `isOpen, onClose, user, readOnly?` | `default` | `src/components/EditStaffModal.tsx` |
| `RequestHolidayModal` | Modal richiesta ferie | `isOpen, onClose, userId` | `default` | `src/components/RequestHolidayModal.tsx` |
| `NotificationModal` | Modal notifica singola | `isOpen, onClose` | ✅ | `src/components/NotificationModal.tsx` |
| `PunchPresenceVerificationModal` | Modal verifica presenza QR/geo | vari | `default` | `src/components/PunchPresenceVerificationModal.tsx` |
| `PunchClockTerminal` | Terminal timbratura kiosk | `isOpen, onClose` | `default` | `src/components/PunchClockTerminal.tsx` |
| `PunchInKiosk` | Kiosk timbratura touch-first | `onGoToLogin` | `default` | `src/components/PunchInKiosk.tsx` |
| `OnboardingSetupModal` | Modal onboarding prima configurazione | `onComplete` | `default` | `src/components/OnboardingSetupModal.tsx` |
| `PermissionRequestModal` | Modal richiesta permessi browser | `onDone` | `default` | `src/components/PermissionRequestModal.tsx` |
| `SwUpdateOverlay` | Overlay aggiornamento service worker | — | `default` | `src/components/SwUpdateOverlay.tsx` |
| `RefreshLockOverlay` | Overlay lock durante refresh | — | `default` | `src/components/RefreshLockOverlay.tsx` |
| `PostUnlockRestartOverlay` | Overlay riavvio post-sblocco | `language` | `default` | `src/components/PostUnlockRestartOverlay.tsx` |
| `AdminSyncOverlay` | Overlay sync dati admin push | `onDone, onReload` | `default` | `src/components/AdminSyncOverlay.tsx` |
| `Toast` | Notifica toast | `message, type, onClose, duration?` | `default` | `src/components/Toast.tsx` |

### 2.3 Navigazione & Layout

| Componente | Scopo | Props principali | Export | File |
|---|---|---|---|---|
| `BottomNav` | Bottom navigation bar | `activeTab, onTabChange, visibleTabs` | `default` | `src/components/BottomNav.tsx` |
| `MobileProfileHeader` | Header mobile con profilo | `onLogout, activeTab, ...` | `default` | `src/components/MobileProfileHeader.tsx` |
| `AppHeader` | Header desktop app | `onLogout` | `default` | `src/components/AppHeader.tsx` |
| `TopBar` | Top bar globale | — | `default` | `src/components/TopBar.tsx` |
| `BodyPullToRefresh` | Pull-to-refresh su body | `onRefresh, disabled` | `default` | `src/components/BodyPullToRefresh.tsx` |
| `PullToRefresh` | Pull-to-refresh generico | `onRefresh, children, ...` | `default` | `src/components/PullToRefresh.tsx` |
| `HorizontalScrollArea` | Area scroll orizzontale | `children, ...` | ✅ | `src/components/HorizontalScrollArea.tsx` |
| `ElevatedAccessPanel` | Pannello accesso elevato PIN/biometrico | — | `default` | `src/components/ElevatedAccessPanel.tsx` |
| `PWAInstallRequired` | Schermata "installa PWA" | — | `default` | `src/components/PWAInstallRequired.tsx` |
| `PwaGate` | Guard PWA standalone | `children` | `default` | `src/components/PwaGate.tsx` |
| `InviteRedirect` | Redirect da link invito | — | `default` | `src/components/InviteRedirect.tsx` |
| `RootErrorBoundary` | Error boundary radice | `children` | ✅ | `src/components/RootErrorBoundary.tsx` |

### 2.4 Notifiche & Messaggi

| Componente | Scopo | Props principali | Export | File |
|---|---|---|---|---|
| `NotificationCenter` | Centro notifiche | `denseTrigger?` | `default` | `src/components/NotificationCenter.tsx` |
| `NotificationDropdown` | Dropdown notifiche | vari | ✅ | `src/components/NotificationDropdown.tsx` |
| `UnifiedBellButton` | Bottone campanella unificato | vari | ✅ | `src/components/UnifiedBellButton.tsx` |
| `NotificationPermissionButton` | Bottone richiesta permesso notifiche | vari | ✅ | `src/components/NotificationPermissionButton.tsx` |
| `StaffPushNotificationPromptBanner` | Banner richiesta push notification | `userId, effectiveLanguage` | ✅ | `src/components/StaffPushNotificationPromptBanner.tsx` |
| `DirectMessagesPanel` | Pannello messaggi diretti | `onClose?` | ✅ | `src/components/DirectMessagesPanel.tsx` |
| `MessageComposer` | Composizione messaggio | vari | ✅ | `src/components/MessageComposer.tsx` |
| `MessageWriter` | Scrittura messaggio | vari | ✅ | `src/components/MessageWriter.tsx` |
| `MessagesList` | Lista messaggi conversazione | vari | ✅ | `src/components/MessagesList.tsx` |

### 2.5 Componenti Mobile

| Componente | Scopo | Props principali | Export | File |
|---|---|---|---|---|
| `ManagementMobileShifts` | Turni management mobile | `shifts, users, currentUserId, language` | `default` | `src/components/mobile/ManagementMobileShifts.tsx` |
| `ManagementMobileTimesheet` | Timesheet management mobile | `shifts, punchRecords, users, ...` | `default` | `src/components/mobile/ManagementMobileTimesheet.tsx` |
| `MobileBottomNav` | Bottom nav mobile | `activeTab, onNavigate, visibleTabs, labels` | `default` | `src/components/mobile/MobileBottomNav.tsx` |
| `MobileHome` | Home mobile | vari | `default` | `src/components/mobile/MobileHome.tsx` |
| `MobileStaffDashboard` | Dashboard staff mobile | vari | `default` | `src/components/mobile/MobileStaffDashboard.tsx` |
| `MobileShifts` | Lista turni mobile | `shifts, language` | `default` | `src/components/mobile/MobileShifts.tsx` |
| `MobileTimesheet` | Timesheet mobile | vari | `default` | `src/components/mobile/MobileTimesheet.tsx` |
| `MobileRequests` | Richieste mobile | `requests, onRequestNew, t?` | `default` | `src/components/mobile/MobileRequests.tsx` |
| `MobileProfileStats` | Statistiche profilo mobile | vari | `default` | `src/components/mobile/MobileProfileStats.tsx` |
| `MobileStatsCards` | Card statistiche mobile | vari | `default` | `src/components/mobile/MobileStatsCards.tsx` |

### 2.6 Hooks

| Hook | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `useApp` | Accede al contesto AppContext | `()` → `AppContextType` | ✅ | `src/context/appContextCore.ts` |
| `useTenant` | Accede al contesto TenantContext | `()` → `TenantContextValue` | ✅ | `src/context/TenantContext.tsx` |
| `useLayoutPreset` | Accede al preset layout corrente | `()` → `LayoutPresetContextValue` | ✅ | `src/context/LayoutPresetContext.tsx` |
| `useProfileLeaveGuardRef` | Ref guard uscita profilo | `()` → `MutableRefObject<ProfileLeaveGuard \| null> \| null` | ✅ | `src/context/ProfileLeaveGuardContext.tsx` |
| `useIsMobileViewport` | True se viewport mobile (<768px) | `()` → `boolean` | ✅ | `src/hooks/useIsMobileViewport.ts` |
| `useMinViewportMd` | True se viewport ≥ md (768px) | `()` → `boolean` | ✅ | `src/hooks/useMinViewportMd.ts` |
| `useIsStandalone` | True se app in modalità PWA standalone | `()` → `boolean` | ✅ | `src/hooks/useIsStandalone.ts` |
| `useBodyScrollLock` | Blocca/sblocca scroll body | `locked: boolean` → `void` | ✅ | `src/hooks/useBodyScrollLock.ts` |
| `useWallAlignedMinuteClock` | Clock sincronizzato al minuto di parete | `()` → `Date` | ✅ | `src/hooks/useWallAlignedMinuteClock.ts` |
| `useMessages` | Carica e gestisce messaggi utente | `userId?, isAdmin?` → `{ messages, send, ... }` | ✅ | `src/hooks/useMessages.ts` |
| `useMessageDeepLink` | Gestisce deep link messaggi | `()` → `{ pendingLink, clear }` | ✅ | `src/hooks/useMessageDeepLink.ts` |
| `useMultisensorialFeedback` | Feedback audio+vibrazione+visivo | `()` → `{ trigger }` | ✅ | `src/hooks/useMultisensorialFeedback.ts` |
| `usePushNotifications` | Gestione iscrizione push notification | `userId?, options?` → `{ subscribe, unsubscribe, ... }` | ✅ | `src/hooks/usePushNotifications.ts` |
| `usePunchPresenceVerification` | Verifica presenza punch (QR/geo) | `language: Language` → `{ verify, ... }` | ✅ | `src/hooks/usePunchPresenceVerification.tsx` |

### 2.7 Context Providers

| Provider | Scopo | Export | File |
|---|---|---|---|
| `AppProvider` | Provider globale dati app (users, shifts, ...) | ✅ | `src/context/AppContext.tsx` |
| `TenantProvider` | Provider configurazione tenant | ✅ | `src/context/TenantContext.tsx` |
| `LayoutPresetProvider` | Provider preset layout responsive | ✅ | `src/context/LayoutPresetContext.tsx` |

---

## 3. Edge Functions (Deno/Supabase)

| Funzione | Scopo | Trigger | File |
|---|---|---|---|
| `notify-team-next-week-shifts` | Invia notifiche push per turni settimana prossima | HTTP POST (cron) | `supabase/functions/notify-team-next-week-shifts/index.ts` |
| `punch-exit-reminder-cron` | Reminder push per timbratura uscita mancante | HTTP POST (cron) | `supabase/functions/punch-exit-reminder-cron/index.ts` |
| `push-subscription` | Gestisce iscrizioni/disiscrizioni push | HTTP POST | `supabase/functions/push-subscription/index.ts` |
| `resend-email` | Invia email transazionale via Resend | HTTP POST | `supabase/functions/resend-email/index.ts` |
| `send-holiday-notification` | Notifica push approvazione/rifiuto ferie | HTTP POST | `supabase/functions/send-holiday-notification/index.ts` |
| `send-push-notification` | Invio generico push notification Web Push | HTTP POST | `supabase/functions/send-push-notification/index.ts` |
| `shift-change-webhook` | Webhook su cambio turno — notifica team | HTTP POST | `supabase/functions/shift-change-webhook/index.ts` |

---

## 4. Utility & Helper di Sistema

### 4.1 Tema & UI

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `applyDocumentTheme` | Applica tema light/dark al documento | `theme: Theme \| null` → `void` | ✅ | `src/utils/theme.ts` |
| `applyUnauthenticatedDocumentTheme` | Applica tema per stato non autenticato | `()` → `void` | ✅ | `src/utils/theme.ts` |
| `persistThemePreference` | Salva preferenza tema | `theme: Theme \| null` → `void` | ✅ | `src/utils/theme.ts` |
| `readStoredThemePreference` | Legge preferenza tema salvata | `()` → `Theme \| null` | ✅ | `src/utils/theme.ts` |
| `forceLightTheme` | Forza tema chiaro | `()` → `void` | ✅ | `src/utils/theme.ts` |
| `applyTenantBrand` | Applica variabili CSS brand tenant | `accent: string` → `void` | ✅ | `src/context/TenantContext.tsx` |
| `generateTenantLogoSvg` | Genera SVG logo da iniziali tenant | `name, accent` → `string (data URL)` | ✅ | `src/context/TenantContext.tsx` |
| `getTenantInitials` | Iniziali da nome tenant | `name: string` → `string` | ✅ | `src/context/TenantContext.tsx` |
| `updatePWAManifest` | Aggiorna manifest PWA runtime | `tenant: Tenant` → `void` | ✅ | `src/context/TenantContext.tsx` |
| `computeEffectiveLayoutFromWidth` | Layout effettivo da larghezza viewport | `innerWidth: number` → `LayoutEffective` | ✅ | `src/utils/layoutPreset.ts` |
| `computeViewportClass` | Classe viewport (phone/tablet/desktop) | `innerWidth: number` → `ViewportClass` | ✅ | `src/utils/layoutPreset.ts` |
| `lockBodyScroll` | Blocca scroll body (modali) | `()` → `void` | ✅ | `src/utils/bodyScrollLock.ts` |
| `unlockBodyScroll` | Sblocca scroll body | `()` → `void` | ✅ | `src/utils/bodyScrollLock.ts` |
| `isDatePickerPortalClick` | Verifica click interno date picker portal | `target: EventTarget \| null` → `boolean` | ✅ | `src/utils/datePickerPortal.ts` |
| `getAppNavTabTitle` | Titolo tab navigazione | `t, tab: AppNavTab` → `string` | ✅ | `src/utils/enabledModules.ts` |

### 4.2 Internazionalizzazione

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `getTranslations` | Dizionario traduzioni per lingua | `language: Language` → `Record<string, string>` | ✅ | `src/utils/translations.ts` |
| `translate` | Traduce singola chiave | `key, lang?` → `string` | ✅ | `src/utils/translations.ts` |
| `formatTrans` | Traduzione con variabili interpolate | `template, vars` → `string` | ✅ | `src/utils/translations.ts` |
| `getDateLocale` | Locale date-fns per lingua | `language: Language` → `Locale` | ✅ | `src/utils/translations.ts` |
| `getIntlLocale` | Stringa locale Intl per lingua | `language: Language` → `string` | ✅ | `src/utils/translations.ts` |
| `getAdminModuleLabel` | Label modulo admin tradotta | `key, t` → `string` | ✅ | `src/utils/translations.ts` |
| `getFeatureStrings` | Stringhe features per lingua | vari → `object` | ✅ | `src/utils/translations.ts` |
| `persistStoredUiLanguage` | Salva lingua UI in localStorage | `lang: Language` → `void` | ✅ | `src/utils/uiLanguagePreference.ts` |
| `readStoredUiLanguage` | Legge lingua UI salvata | `()` → `Language \| null` | ✅ | `src/utils/uiLanguagePreference.ts` |
| `clearStoredUiLanguage` | Rimuove lingua UI salvata | `()` → `void` | ✅ | `src/utils/uiLanguagePreference.ts` |
| `getDeviceUiLanguage` | Lingua UI del dispositivo | `()` → `Language` | ✅ | `src/utils/uiLanguagePreference.ts` |

### 4.3 Date & Ore

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `safeFormatDate` | Formatta data con fallback sicuro | `input, formatStr, opts?` → `string` | ✅ | `src/utils/safeDateFormat.ts` |
| `toValidDate` | Converte input vario in Date valida | `input: Date \| string \| number \| null` → `Date \| null` | ✅ | `src/utils/safeDateFormat.ts` |
| `lastSundayOfMonth` | Ultima domenica del mese | `d: Date` → `Date` | ✅ | `src/utils/periodConfig.ts` |
| `dispatchPeriodConfigUpdated` | Dispatcha evento cambio periodo | `()` → `void` | ✅ | `src/utils/periodConfig.ts` |

### 4.4 PWA & Service Worker

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `isPWAStandalone` | App in modalità PWA standalone | `()` → `boolean` | ✅ | `src/utils/pwaStandalone.ts` |
| `isIOS` | User agent è iOS | `()` → `boolean` | ✅ | `src/utils/pwaStandalone.ts` |
| `isAndroid` | User agent è Android | `()` → `boolean` | ✅ | `src/utils/pwaStandalone.ts` |
| `isDesktop` | User agent è desktop | `()` → `boolean` | ✅ | `src/utils/pwaStandalone.ts` |
| `isStandalonePwa` | Alias isPWAStandalone | `()` → `boolean` | ✅ | `src/utils/appIconBadge.ts` |
| `setAppLauncherBadgeUnreadCountAsync` | Badge icona app (Badging API) | `count: number` → `Promise<void>` | ✅ | `src/utils/appIconBadge.ts` |
| `requestNotificationPermissionForBadgeOnUserGesture` | Chiede permesso notifiche per badge | `()` → `void` | ✅ | `src/utils/appIconBadge.ts` |

### 4.5 Haptic & Audio

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `unlockAudioContext` | Sblocca AudioContext dopo gesto utente | `()` → `void` | ✅ | `src/utils/hapticFeedbackCore.ts` |
| `audioHapticByType` | Feedback audio per tipo azione | `type: AudioHapticType` → `void` | ✅ | `src/utils/hapticFeedbackCore.ts` |
| `lightHaptic` | Vibrazione leggera (wrapper) | `()` → `void` | ✅ | `src/utils/hapticFeedback.ts` |

### 4.6 Storage & Persistenza

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `readMainViewState` | Legge stato view principale da storage | `userId: string` → `MainViewStoredState \| null` | ✅ | `src/utils/mainAppViewRestore.ts` |
| `writeMainViewState` | Scrive stato view principale | `userId, payload` → `void` | ✅ | `src/utils/mainAppViewRestore.ts` |
| `clearMainViewState` | Cancella stato view principale | `userId: string` → `void` | ✅ | `src/utils/mainAppViewRestore.ts` |
| `applyWindowScrollY` | Ripristina scroll Y pagina | `y: number` → `void` | ✅ | `src/utils/mainAppViewRestore.ts` |
| `mainViewStorageKey` | Chiave localStorage per stato view | `userId: string` → `string` | ✅ | `src/utils/mainAppViewRestore.ts` |
| `readProfileAvatarFromStorage` | Legge avatar profilo da localStorage | `userId: string` → `string \| null` | ✅ | `src/utils/profilePhotoStorage.ts` |
| `writeProfileAvatarToStorage` | Scrive avatar profilo in localStorage | `userId, dataUrl \| null` → `void` | ✅ | `src/utils/profilePhotoStorage.ts` |
| `uploadAvatarToStorage` | Carica avatar su Supabase Storage | `userId, dataUrl, ...` → `Promise<string>` | ✅ | `src/utils/profilePhotoStorage.ts` |
| `deleteAvatarFromStorage` | Cancella avatar da Supabase Storage | `userId: string` → `Promise<void>` | ✅ | `src/utils/profilePhotoStorage.ts` |
| `fileToResizedJpegDataUrl` | Ridimensiona immagine e converte JPEG | `file, maxSize?` → `Promise<string>` | ✅ | `src/utils/profilePhotoStorage.ts` |
| `readAvatarFocus` | Legge focus avatar (crop center) | `userId: string` → `AvatarFocus` | ✅ | `src/utils/profilePhotoStorage.ts` |
| `writeAvatarFocus` | Scrive focus avatar | `userId, focus` → `void` | ✅ | `src/utils/profilePhotoStorage.ts` |
| `avatarFocusToObjectPosition` | Converte focus in CSS object-position | `focus: AvatarFocus` → `string` | ✅ | `src/utils/profilePhotoStorage.ts` |

### 4.7 WebAuthn & Biometrica

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `supportsPinUnlockWebAuthn` | Verifica supporto WebAuthn | `()` → `boolean` | ✅ | `src/utils/pinUnlockWebAuthn.ts` |
| `hasPlatformBiometricAuthenticator` | Verifica autenticatore biometrico | `()` → `Promise<boolean>` | ✅ | `src/utils/pinUnlockWebAuthn.ts` |
| `hasPinUnlockCredential` | Verifica credential WebAuthn salvata | `userId: string` → `boolean` | ✅ | `src/utils/pinUnlockWebAuthn.ts` |
| `registerPinUnlockCredential` | Registra nuova credential WebAuthn | `userId, displayName` → `Promise<void>` | ✅ | `src/utils/pinUnlockWebAuthn.ts` |
| `authenticatePinUnlockCredential` | Autentica con WebAuthn | `userId: string` → `Promise<boolean>` | ✅ | `src/utils/pinUnlockWebAuthn.ts` |
| `authenticatePinUnlockAndResolveUserId` | Autentica e risolve userId | `()` → `Promise<string \| null>` | ✅ | `src/utils/pinUnlockWebAuthn.ts` |
| `listCredentialsForCurrentRp` | Lista credential WebAuthn locali | `()` → `{ userId, credentialIdB64 }[]` | ✅ | `src/utils/pinUnlockWebAuthn.ts` |
| `hasAnyPinUnlockCredentialOnDevice` | Verifica presence di credenziali | `()` → `boolean` | ✅ | `src/utils/pinUnlockWebAuthn.ts` |

### 4.8 Seed & Import Dati

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `buildDemoProfileData` | Costruisce dati demo profilo staff | `now, userId` → `DemoProfileBuilt` | ✅ | `src/utils/seedDemoProfileData.ts` |
| `buildDemoCoworkerShiftsToday` | Turni demo colleghi di oggi | `now, coworkerUserIds` → `Omit<Shift,'id'>[]` | ✅ | `src/utils/seedDemoProfileData.ts` |
| `punchRecordsFromSpecs` | Genera timbrature da specifiche | `specs, userId` → `PunchRecord[]` | ✅ | `src/utils/seedDemoProfileData.ts` |
| `seedTenantFromTemplate` | Inizializza tenant da template | `template, tenantId` → `Promise<void>` | ✅ | `src/utils/seedTenantFromTemplate.ts` |
| `importData` | Importa dati da JSON | vari | ✅ | `src/utils/importData.ts` |

### 4.9 Misc Helper

| Funzione | Scopo | Parametri → Ritorno | Export | File |
|---|---|---|---|---|
| `withTimeout` | Wrappa Promise con timeout | `promise, ms, label?` → `Promise<T>` | ✅ | `src/utils/promiseTimeout.ts` |
| `splitPhoneForForm` | Divide numero in prefisso+nazionale | `full: string \| null` → `{ prefix, national }` | ✅ | `src/utils/phonePrefix.ts` |
| `joinPhone` | Unisce prefisso+nazionale | `prefix, national` → `string \| undefined` | ✅ | `src/utils/phonePrefix.ts` |
| `groupIntoConversations` | Raggruppa messaggi in conversazioni | `messages, myId` → `Conversation[]` | ✅ | `src/hooks/useMessages.ts` |

---

## Statistiche

| Categoria | Conteggio |
|---|---|
| Utils esportate | ~368 funzioni/costanti |
| Componenti React | 84 |
| Hooks | 14 |
| Context Providers | 3 |
| Edge Functions Supabase | 7 |
| **Totale** | **~476** |
