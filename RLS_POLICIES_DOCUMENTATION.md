# Row-Level Security (RLS) Policies Documentation

**Last Updated**: March 10, 2026
**Database**: Osteria Basilico Staff Management System
**Status**: Production (anon full access) — vedi raccomandazioni per policy restrittive

---

## Stato attuale (produzione)

L'app usa **chiave anon** e **autenticazione PIN** (non Supabase Auth). Le policy attuali (`allow_anon_full_access`) consentono CRUD completo via anon su tutte le tabelle. La sicurezza è demandata all'app (PIN, ruoli in `users`).

**Limitazioni**:
- Chiunque abbia la chiave anon può accedere ai dati
- Nessun controllo a livello database per ruoli/utente
- Adatto a uso interno, non per dati sensibili esposti

---

## Raccomandazioni per policy restrittive

Per rendere le policy più restrittive serve uno di questi approcci:

### Opzione A: Integrare Supabase Auth
1. Aggiungere login email/password (o magic link)
2. Salvare il PIN in `user_metadata` per compatibilità
3. Usare `auth.uid()` nelle policy (vedi sezione "Policy ideali" sotto)
4. Rimuovere l’accesso anon per le operazioni sensibili

### Opzione B: Backend dedicato
1. Creare un backend (Node, Edge Functions, ecc.) con `service_role`
2. Esporre API che validano PIN/ruolo lato server
3. Limitare l’anon key a sole letture (SELECT) o disabilitarla per le tabelle sensibili
4. Il frontend chiama il backend invece di Supabase diretto

### Opzione C: Edge Functions + JWT custom
1. Usare Supabase Edge Functions con `service_role`
2. Validare PIN e generare JWT custom
3. Usare `auth.jwt()` nelle policy per verificare il token

---

## Overview

Questo documento descrive le policy RLS ideali (con Supabase Auth) e lo stato attuale. Le policy ideali sono pronte per una futura migrazione ad autenticazione completa.

---

## Security Principles

### Core Requirements

1. **Zero Anonymous Access**: The anon key cannot access any data
2. **Authentication Mandatory**: All operations require Supabase Auth authentication
3. **Role-Based Access Control (RBAC)**: Permissions based on user roles
4. **Principle of Least Privilege**: Users access only what they need
5. **No Security Bypasses**: No policies with `USING (true)` or `WITH CHECK (true)`

### User Roles Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| `admin` | 3 | Full system access, user management, all operations |
| `manager` | 2 | Staff oversight, scheduling, approvals, reports |
| `assistant_manager` | 2 | Same as manager (management tier) |
| `waiter` | 1 | Self-service only, view team context |
| `bartender` | 1 | Self-service only, view team context |
| `cook` | 1 | Self-service only, view team context |

---

## Helper Functions

### `is_admin(check_user_id uuid)`

**Purpose**: Check if a user has admin privileges

**Returns**: `boolean`

**Logic**:
```sql
SELECT EXISTS (
  SELECT 1 FROM users
  WHERE id = check_user_id
  AND role = 'admin'
  AND status = 'active'
);
```

**Security**:
- `SECURITY DEFINER`: Executes with function owner's privileges
- `STABLE`: Result doesn't change within a transaction
- `SET search_path = public`: Prevents search_path injection attacks

**Usage**: `is_admin(auth.uid())`

---

### `is_management(check_user_id uuid)`

**Purpose**: Check if a user has management privileges (admin, manager, or assistant_manager)

**Returns**: `boolean`

**Logic**:
```sql
SELECT EXISTS (
  SELECT 1 FROM users
  WHERE id = check_user_id
  AND role IN ('admin', 'manager', 'assistant_manager')
  AND status = 'active'
);
```

**Security**: Same as `is_admin()`

**Usage**: `is_management(auth.uid())`

---

## Table: `users`

**RLS Status**: ✅ Enabled
**Anonymous Access**: ❌ Blocked

### Policy: "Authenticated users can view all users"

**Operation**: `SELECT`
**Role**: `authenticated`
**Logic**: `USING (true)`

**Purpose**: Allow all authenticated staff to view team members for:
- Team schedules and shift planning
- Colleague contact information
- Dashboard displays showing team context

**Security Consideration**: Team visibility is required for collaboration. Sensitive fields (like PIN) should be filtered at application layer when not needed.

---

### Policy: "Only admins can create users"

**Operation**: `INSERT`
**Role**: `authenticated`
**Logic**: `WITH CHECK (is_admin(auth.uid()))`

**Purpose**: Restrict user creation to administrators only

**Enforces**:
- Only admins can add new staff members
- Prevents unauthorized user creation
- Maintains centralized user management

**Blocks**:
- Regular staff creating fake accounts
- Privilege escalation attempts

---

### Policy: "Users can update own profile"

**Operation**: `UPDATE`
**Role**: `authenticated`
**Logic**:
- `USING (auth.uid() = id)`
- `WITH CHECK (auth.uid() = id)`

**Purpose**: Allow users to update their own profile information

**Allows**:
- Updating personal preferences (language, theme)
- Modifying contact information
- Self-service profile management

**Prevents**:
- Users modifying other users' profiles
- Unauthorized data changes

---

### Policy: "Admins can update any user"

**Operation**: `UPDATE`
**Role**: `authenticated`
**Logic**:
- `USING (is_admin(auth.uid()))`
- `WITH CHECK (is_admin(auth.uid()))`

**Purpose**: Grant administrators full user management capabilities

**Allows**:
- Changing user roles
- Suspending/activating accounts
- Correcting user information
- Managing sort order

**Use Cases**:
- Employee promotions/demotions
- Account status changes
- Administrative corrections

---

### Policy: "Only admins can delete users"

**Operation**: `DELETE`
**Role**: `authenticated`
**Logic**: `USING (is_admin(auth.uid()))`

**Purpose**: Restrict user deletion to administrators

**Security Rationale**:
- Prevents accidental account deletion
- Maintains audit trail control
- Ensures proper offboarding process

**Alternative**: Consider soft-deletion (status='suspended') instead of hard deletion for audit purposes

---

## Table: `shifts`

**RLS Status**: ✅ Enabled
**Anonymous Access**: ❌ Blocked

### Policy: "Authenticated users can view all shifts"

**Operation**: `SELECT`
**Role**: `authenticated`
**Logic**: `USING (true)`

**Purpose**: Allow all staff to view team schedules

**Business Justification**:
- Staff need to see who's working when
- Enables shift coordination and coverage
- Facilitates team communication
- Allows shift swap negotiations

---

### Policy: "Management can create shifts"

**Operation**: `INSERT`
**Role**: `authenticated`
**Logic**: `WITH CHECK (is_management(auth.uid()))`

**Purpose**: Restrict shift creation to management roles

**Allows**: Admin, Manager, Assistant Manager to create shifts

**Prevents**:
- Regular staff creating unauthorized shifts
- Schedule manipulation
- Payroll fraud

---

### Policy: "Staff can update own shifts"

**Operation**: `UPDATE`
**Role**: `authenticated`
**Logic**:
- `USING (auth.uid() = user_id)`
- `WITH CHECK (auth.uid() = user_id)`

**Purpose**: Allow staff to update their own shift details

**Use Cases**:
- Marking approval_requested status
- Adding shift notes
- Updating break times (if allowed)

**Limitations**: Staff cannot assign shifts to other users

---

### Policy: "Management can update any shift"

**Operation**: `UPDATE`
**Role**: `authenticated`
**Logic**:
- `USING (is_management(auth.uid()))`
- `WITH CHECK (is_management(auth.uid()))`

**Purpose**: Grant management full shift management capabilities

**Allows**:
- Approving/rejecting shift changes
- Correcting shift times
- Reassigning shifts
- Managing all shift fields

---

### Policy: "Management can delete shifts"

**Operation**: `DELETE`
**Role**: `authenticated`
**Logic**: `USING (is_management(auth.uid()))`

**Purpose**: Allow management to remove shifts

**Use Cases**:
- Canceling shifts due to low business
- Correcting scheduling errors
- Removing duplicate entries

**Note**: Consider keeping audit log of deleted shifts

---

## Table: `punch_records`

**RLS Status**: ✅ Enabled
**Anonymous Access**: ❌ Blocked

### Policy: "Users can view own punch records"

**Operation**: `SELECT`
**Role**: `authenticated`
**Logic**: `USING (auth.uid() = user_id)`

**Purpose**: Allow staff to view their own time records

**Privacy**: Staff cannot see other staff members' clock-in/out times

**Use Cases**:
- Checking own work hours
- Verifying clock-in/out times
- Personal timesheet review

---

### Policy: "Management can view all punch records"

**Operation**: `SELECT`
**Role**: `authenticated`
**Logic**: `USING (is_management(auth.uid()))`

**Purpose**: Allow management to view all staff time records

**Business Requirements**:
- Payroll processing
- Attendance monitoring
- Performance reviews
- Schedule optimization

---

### Policy: "Users can create own punch records"

**Operation**: `INSERT`
**Role**: `authenticated`
**Logic**: `WITH CHECK (auth.uid() = user_id)`

**Purpose**: Allow staff to clock in and out

**Enforces**:
- Staff can only create records for themselves
- Prevents buddy punching (clocking in for others)
- Maintains time tracking integrity

**Prevents**:
- Creating time records for other employees
- Time theft

---

### Policy: "Management can update punch records"

**Operation**: `UPDATE`
**Role**: `authenticated`
**Logic**:
- `USING (is_management(auth.uid()))`
- `WITH CHECK (is_management(auth.uid()))`

**Purpose**: Allow management to correct time records

**Use Cases**:
- Fixing forgotten clock-outs
- Correcting erroneous entries
- Adjusting for system issues
- Manual time entry

**Audit Recommendation**: Log all punch record modifications for compliance

---

### Policy: "Only admins can delete punch records"

**Operation**: `DELETE`
**Role**: `authenticated`
**Logic**: `USING (is_admin(auth.uid()))`

**Purpose**: Restrict deletion to administrators only

**Security Rationale**:
- Maintains payroll integrity
- Prevents wage fraud
- Ensures audit trail
- Complies with labor regulations

**Best Practice**: Avoid deletion; use corrections instead

---

## Table: `holiday_requests`

**RLS Status**: ✅ Enabled
**Anonymous Access**: ❌ Blocked

### Policy: "Users can view own holiday requests"

**Operation**: `SELECT`
**Role**: `authenticated`
**Logic**: `USING (auth.uid() = user_id)`

**Purpose**: Allow staff to view their own vacation requests

**Privacy**: Staff cannot see other staff members' time-off requests

---

### Policy: "Management can view all holiday requests"

**Operation**: `SELECT`
**Role**: `authenticated`
**Logic**: `USING (is_management(auth.uid()))`

**Purpose**: Allow management to view all time-off requests

**Business Requirements**:
- Approval workflow
- Schedule coordination
- Staffing level management
- Vacation planning

---

### Policy: "Users can create own holiday requests"

**Operation**: `INSERT`
**Role**: `authenticated`
**Logic**: `WITH CHECK (auth.uid() = user_id)`

**Purpose**: Allow staff to submit time-off requests

**Enforces**:
- Staff can only request time off for themselves
- Maintains request integrity

---

### Policy: "Users can update own holiday requests"

**Operation**: `UPDATE`
**Role**: `authenticated`
**Logic**:
- `USING (auth.uid() = user_id AND status = 'pending')`
- `WITH CHECK (auth.uid() = user_id AND status = 'pending')`

**Purpose**: Allow staff to modify their pending requests only

**Allows**:
- Changing dates of pending requests
- Updating request notes
- Modifying request type

**Prevents**:
- Modifying approved/rejected requests
- Changing status to approved (circumventing approval)
- Editing other users' requests

**Business Logic**: Once approved or rejected, requests are locked

---

### Policy: "Management can update any holiday request"

**Operation**: `UPDATE`
**Role**: `authenticated`
**Logic**:
- `USING (is_management(auth.uid()))`
- `WITH CHECK (is_management(auth.uid()))`

**Purpose**: Allow management to manage all requests

**Allows**:
- Approving requests
- Rejecting requests
- Modifying request details
- Managing all request fields

---

### Policy: "Users can delete own pending requests"

**Operation**: `DELETE`
**Role**: `authenticated`
**Logic**: `USING (auth.uid() = user_id AND status = 'pending')`

**Purpose**: Allow staff to cancel pending requests

**Allows**: Canceling time-off requests before approval

**Prevents**:
- Deleting approved/rejected requests
- Removing historical records

---

### Policy: "Management can delete any holiday request"

**Operation**: `DELETE`
**Role**: `authenticated`
**Logic**: `USING (is_management(auth.uid()))`

**Purpose**: Allow management to remove any request

**Use Cases**:
- Correcting erroneous requests
- Administrative cleanup
- Canceling approved requests due to business needs

---

## Testing RLS Policies

### Test Scenarios

#### Anonymous User (No Auth)
```sql
-- All operations should be DENIED
SELECT * FROM users; -- ❌ Should fail
INSERT INTO users (...) VALUES (...); -- ❌ Should fail
UPDATE users SET ... WHERE ...; -- ❌ Should fail
DELETE FROM users WHERE ...; -- ❌ Should fail
```

#### Regular Staff Member (Waiter, Bartender, Cook)
```sql
-- Can view all users
SELECT * FROM users; -- ✅ Should succeed

-- Can view own punch records only
SELECT * FROM punch_records WHERE user_id = auth.uid(); -- ✅ Should succeed
SELECT * FROM punch_records; -- ⚠️ Returns only own records

-- Can create own punch records
INSERT INTO punch_records (user_id, ...) VALUES (auth.uid(), ...); -- ✅ Should succeed
INSERT INTO punch_records (user_id, ...) VALUES ('other-user-id', ...); -- ❌ Should fail

-- Cannot create users
INSERT INTO users (...) VALUES (...); -- ❌ Should fail
```

#### Management (Admin, Manager, Assistant Manager)
```sql
-- Can view all punch records
SELECT * FROM punch_records; -- ✅ Should succeed (all records)

-- Can update any shift
UPDATE shifts SET status = 'approved' WHERE id = 'any-shift-id'; -- ✅ Should succeed

-- Can view all holiday requests
SELECT * FROM holiday_requests; -- ✅ Should succeed (all requests)
```

#### Admin Only
```sql
-- Can create users
INSERT INTO users (...) VALUES (...); -- ✅ Should succeed

-- Can delete users
DELETE FROM users WHERE id = 'user-id'; -- ✅ Should succeed

-- Can delete punch records
DELETE FROM punch_records WHERE id = 'record-id'; -- ✅ Should succeed
```

---

## Security Audit Checklist

Use this checklist to verify RLS implementation:

- [ ] RLS is enabled on all tables
- [ ] No anonymous access to any table
- [ ] No policies with `USING (true)` for write operations
- [ ] All policies check `auth.uid()` for authenticated users
- [ ] Helper functions use `SECURITY DEFINER` with safe `search_path`
- [ ] Role checks use `is_admin()` and `is_management()` functions
- [ ] Users can only modify their own data (except management)
- [ ] Management roles have appropriate elevated permissions
- [ ] Admin role has full system access
- [ ] Foreign key columns have indexes for performance
- [ ] Policies are documented and understood by development team
- [ ] Test cases cover all policy scenarios
- [ ] Audit logging is in place for sensitive operations

---

## Performance Considerations

### Index Usage

All foreign key columns have indexes for optimal RLS policy performance:

```sql
CREATE INDEX idx_shifts_user_id ON shifts(user_id);
CREATE INDEX idx_punch_records_user_id ON punch_records(user_id);
CREATE INDEX idx_holiday_requests_user_id ON holiday_requests(user_id);
```

### Policy Efficiency

- Policies use indexed columns (`user_id`, `id`)
- Helper functions are `STABLE` for query optimization
- `EXISTS` subqueries are optimized by PostgreSQL planner

---

## Compliance and Regulations

### Data Privacy (GDPR, CCPA)

- ✅ Users cannot access other users' personal data (punch records, holiday requests)
- ✅ Management access is role-based and justified by business need
- ✅ Audit trail capabilities (can log policy evaluations)

### Labor Law Compliance

- ✅ Time records integrity (limited modification, admin-only deletion)
- ✅ Attendance tracking accuracy (users cannot clock in for others)
- ✅ Holiday request workflow (proper approval process)

### SOC 2 / ISO 27001

- ✅ Principle of least privilege implemented
- ✅ Role-based access control enforced at database level
- ✅ No security bypasses or backdoors
- ✅ Comprehensive documentation

---

## Troubleshooting

### "Permission Denied" Errors

1. **Check authentication**: Is `auth.uid()` returning a valid UUID?
2. **Verify user role**: Does the user have the required role (admin, management)?
3. **Check user status**: Is the user account active (`status = 'active'`)?
4. **Review policy**: Does the operation match an allowed policy?

### Users Cannot Access Data

1. **Verify Supabase Auth**: Is the user properly authenticated?
2. **Check RLS policies**: Are policies defined for the user's role?
3. **Test with service_role_key**: Does it work with RLS bypass? (confirms RLS issue)
4. **Review helper functions**: Are `is_admin()` and `is_management()` working?

### Performance Issues

1. **Check indexes**: Are foreign key indexes present and used?
2. **Review query plans**: Use `EXPLAIN ANALYZE` to check policy evaluation
3. **Optimize helper functions**: Ensure `STABLE` attribute is set
4. **Consider caching**: Cache role checks at application layer if needed

---

## Maintenance

### Adding New Roles

When adding a new role:

1. Update `is_management()` function if it's a management role
2. Review all policies to determine appropriate access
3. Add role-specific policies if needed
4. Update documentation
5. Test all operations for the new role

### Modifying Policies

When modifying policies:

1. Document the change and rationale
2. Test in development environment first
3. Verify no existing functionality breaks
4. Update this documentation
5. Deploy during maintenance window if possible
6. Monitor for permission errors after deployment

---

## References

- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)

---

**Document Version**: 1.0
**Last Reviewed**: March 10, 2026
**Next Review**: June 10, 2026
