# Security Configuration Notes

## Overview

This document explains the security model implemented for the Osteria Basilico staff management system and the current state of Row-Level Security (RLS) policies.

## Current Security Status

### ⚠️ CRITICAL: RLS Policies Updated - App Requires Supabase Auth

**Date**: March 10, 2026
**Status**: RLS policies have been secured and now require authenticated users

The database now implements **strict Row-Level Security (RLS)** policies that:
- ✅ Block ALL anonymous (anon key) access to all tables
- ✅ Require Supabase Auth authenticated users for all operations
- ✅ Enforce role-based access control using auth.uid()
- ✅ Follow security best practices with no `USING (true)` policies

### Impact on Current Application

**The application will NOT work** until Supabase Auth is implemented because:
1. All database operations now require authenticated users
2. The anon key can no longer access any data
3. The service_role_key bypasses RLS but should not be used in production frontend code

## Previous Security Model (DEPRECATED)

The application previously used a **PIN-based authentication system** with:

1. **No Supabase Auth Integration**: The app did not use Supabase's built-in authentication
2. **Client-Side Authorization**: User authentication at application layer via PIN validation
3. **Two-Tier Database Access**:
   - **Anon Key**: Used for read operations (SELECT queries)
   - **Service Role Key**: Used for write operations (INSERT, UPDATE, DELETE)

This model has been replaced with proper RLS security.

## Current RLS Policies Implemented

All policies require **authenticated users** via Supabase Auth (auth.uid()).

### Helper Functions

Two security functions check user roles:

- **`is_admin(user_id)`**: Returns true if user has admin role and active status
- **`is_management(user_id)`**: Returns true if user has admin, manager, or assistant_manager role and active status

### Users Table Policies

| Operation | Policy | Description |
|-----------|--------|-------------|
| SELECT | Authenticated users can view all users | All authenticated users can see team members |
| INSERT | Only admins can create users | User creation restricted to admins only |
| UPDATE | Users can update own profile | Users can modify their own profile data |
| UPDATE | Admins can update any user | Admins have full update access |
| DELETE | Only admins can delete users | User deletion restricted to admins only |

### Shifts Table Policies

| Operation | Policy | Description |
|-----------|--------|-------------|
| SELECT | Authenticated users can view all shifts | All staff can see team schedules |
| INSERT | Management can create shifts | Only management roles can create shifts |
| UPDATE | Staff can update own shifts | Staff can modify their own shift records |
| UPDATE | Management can update any shift | Management has full shift update access |
| DELETE | Management can delete shifts | Only management can delete shifts |

### Punch Records Table Policies

| Operation | Policy | Description |
|-----------|--------|-------------|
| SELECT | Users can view own punch records | Staff can only see their own clock-in/out records |
| SELECT | Management can view all punch records | Management can view all staff punch records |
| INSERT | Users can create own punch records | Staff can clock in/out for themselves |
| UPDATE | Management can update punch records | Only management can correct punch records |
| DELETE | Only admins can delete punch records | Deletion restricted to admins only |

### Holiday Requests Table Policies

| Operation | Policy | Description |
|-----------|--------|-------------|
| SELECT | Users can view own holiday requests | Staff can only see their own requests |
| SELECT | Management can view all holiday requests | Management can view all requests |
| INSERT | Users can create own holiday requests | Staff can submit their own requests |
| UPDATE | Users can update own holiday requests | Staff can modify their pending requests only |
| UPDATE | Management can update any holiday request | Management can approve/reject any request |
| DELETE | Users can delete own pending requests | Staff can delete only pending requests |
| DELETE | Management can delete any holiday request | Management can delete any request |

## Security Compliance Status

### ✅ Fully Resolved

1. **Anonymous Access Blocked**: All anon key access to tables has been completely blocked
2. **RLS Enabled**: Row-Level Security is enabled on all tables (users, shifts, punch_records, holiday_requests)
3. **No USING (true) Policies**: All insecure always-true policies have been removed
4. **Role-Based Access Control**: Policies use auth.uid() and role checks for granular permissions
5. **Foreign Key Indexes**: All foreign key columns have proper indexes for performance
6. **Secure Helper Functions**: is_admin() and is_management() use SECURITY DEFINER with safe search_path
7. **Multiple Permissive Policies**: Removed duplicate SELECT policies, each operation has clear policies
8. **Principle of Least Privilege**: Users can only access their own data unless they have management roles

## Remaining Security Warnings

### 1. Unused Index Warnings

**Status**: Expected and will resolve over time

The following indexes may show as "unused":
- `idx_shifts_user_id`
- `idx_punch_records_user_id`
- `idx_holiday_requests_user_id`

**Reason**: These indexes were recently created. Supabase's query analyzer hasn't detected their usage yet because:
- The database is new or has minimal query history
- Indexes need query patterns to be recognized as "used"

**Action Required**: None. These indexes are correctly placed and will be utilized as the application runs.

### 2. Auth DB Connection Strategy

**Status**: Cannot be fixed via migration

**Warning**: "Your project's Auth server is configured to use at most 10 connections. Switch to a percentage based connection allocation strategy instead."

**Reason**: This is a Supabase project-level configuration setting that must be changed in the Supabase Dashboard, not via SQL migration.

**Action Required**:
1. Go to Supabase Dashboard
2. Navigate to Project Settings > Database
3. Change the "Connection Pool" configuration from fixed count to percentage-based

### 3. Application Requires Supabase Auth Integration

**Status**: Required for application functionality

**Current Situation**: The RLS policies now require authenticated users, but the application still uses PIN-based authentication without Supabase Auth integration.

**Impact**: The application will not be able to access the database until Supabase Auth is implemented.

**Required Actions**: See "Migration Path to Supabase Auth" section below.

## Migration Path to Supabase Auth

To make the application work with the new secure RLS policies, you must implement Supabase Auth:

### Step 1: Enable Supabase Auth

Implement email/password authentication in the application:

```typescript
// Sign up new user
const { data, error } = await supabase.auth.signUp({
  email: user.email,
  password: generatedPassword,
  options: {
    data: {
      pin: user.pin,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name
    }
  }
});
```

### Step 2: Link Existing Users

For each existing user in the `users` table:
1. Create a corresponding Supabase Auth user
2. Update the `users.id` to match the Auth user's UUID (`auth.uid()`)
3. Store the PIN in user metadata for kiosk mode

### Step 3: Update Login Flow

Modify the PIN login to authenticate with Supabase Auth:

```typescript
// Find user by PIN in metadata or users table
const user = await findUserByPin(pin);

// Sign in with Supabase Auth
const { data, error } = await supabase.auth.signInWithPassword({
  email: user.email,
  password: storedPassword
});

// Or implement a custom auth flow with PIN validation
```

### Step 4: Use Authenticated Client

Replace service_role_key usage with authenticated client:

```typescript
// Before: Used service role key
const { data } = await supabaseAdmin.from('shifts').insert(shift);

// After: Use authenticated client (RLS enforced)
const { data } = await supabase.from('shifts').insert(shift);
```

### Step 5: Remove Service Role Key from Frontend

Move any admin operations that require service_role_key to Supabase Edge Functions.

## Alternative: Temporary Service Role Access

If you need the app to work immediately without Auth implementation:

**⚠️ WARNING**: This is NOT recommended for production as it bypasses all security.

You can continue using the service_role_key which bypasses RLS, but understand:
- This defeats the purpose of RLS
- All security is at application layer only
- The service_role_key should NEVER be in production frontend code
- This is only acceptable for development/testing

## Environment Variables

Required environment variables:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**IMPORTANT**: The service role key should be kept secure and not exposed in public repositories.

## Summary

### Current RLS Security Implementation

The database now has **enterprise-grade Row-Level Security**:

- ✅ **ALL anonymous access blocked** - anon key cannot access any table
- ✅ **Authentication required** - All operations require Supabase Auth
- ✅ **Role-based access control** - Granular permissions based on user roles
- ✅ **No security bypasses** - No USING (true) policies
- ✅ **Principle of least privilege** - Users can only access their own data
- ✅ **Management oversight** - Admin and manager roles have appropriate elevated access
- ✅ **Audit-ready** - All policies are clearly defined and documented

### Application Status

- ⚠️ **Application requires Supabase Auth** - PIN-based auth must be migrated
- ⚠️ **Service role key bypasses RLS** - Only use in development, never in production
- 📋 **Migration path documented** - Clear steps to integrate Supabase Auth provided

### Security Best Practices Compliance

| Requirement | Status |
|-------------|--------|
| RLS Enabled on all tables | ✅ Compliant |
| No anonymous access | ✅ Compliant |
| Authentication required | ✅ Compliant |
| Role-based permissions | ✅ Compliant |
| No always-true policies | ✅ Compliant |
| Secure helper functions | ✅ Compliant |
| Foreign key indexes | ✅ Compliant |
| Principle of least privilege | ✅ Compliant |

The database security is now **production-ready** and follows Supabase and PostgreSQL RLS best practices.
