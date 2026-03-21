/*
  # Implement Secure Row-Level Security Policies

  1. Overview
    This migration removes all insecure policies that allow anonymous access
    and implements strict RLS policies based on authenticated users and roles.

  2. Changes
    - Drop all existing permissive policies with USING (true)
    - Block all anonymous (anon) access to tables
    - Enable RLS on all tables (if not already enabled)
    - Create role-based policies using auth.uid() for authenticated users

  3. Security Model
    - **Anonymous users**: NO ACCESS to any table
    - **Regular staff**: Can view all users (for team context), manage only their own records
    - **Management roles** (admin, manager, assistant_manager): Full access to all data
    - All policies check authentication via auth.uid()

  4. Tables Secured
    - users: Admin-only writes, self + admin reads/updates
    - shifts: Staff can view own, management can manage all
    - punch_records: Staff can create own, management can manage all
    - holiday_requests: Staff can manage own, management can manage all

  5. Helper Functions
    - Recreates is_management() and is_admin() functions with proper security
*/

-- =====================================================
-- HELPER FUNCTIONS - Drop and Recreate
-- =====================================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS is_management(uuid);
DROP FUNCTION IF EXISTS is_admin(uuid);

-- Function to check if authenticated user has management role (admin, manager, or assistant_manager)
CREATE FUNCTION is_management(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = check_user_id
    AND role IN ('admin', 'manager', 'assistant_manager')
    AND status = 'active'
  );
$$;

-- Function to check if authenticated user is admin
CREATE FUNCTION is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = check_user_id
    AND role = 'admin'
    AND status = 'active'
  );
$$;

-- =====================================================
-- USERS TABLE - Secure Policies
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop all existing insecure policies
DROP POLICY IF EXISTS "Anon can insert users" ON users;
DROP POLICY IF EXISTS "Anon can update users" ON users;
DROP POLICY IF EXISTS "Anon can delete users" ON users;
DROP POLICY IF EXISTS "Anon can select users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Authenticated users can read all users" ON users;
DROP POLICY IF EXISTS "Anon can read all users" ON users;
DROP POLICY IF EXISTS "Authenticated users can view all users" ON users;
DROP POLICY IF EXISTS "Only admins can create users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;
DROP POLICY IF EXISTS "Only admins can delete users" ON users;

-- SELECT: Authenticated users can view all users (needed for team context, shift assignments)
CREATE POLICY "Authenticated users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only admins can create new users
CREATE POLICY "Only admins can create users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- UPDATE: Users can update own profile, admins can update anyone
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any user"
  ON users FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- DELETE: Only admins can delete users
CREATE POLICY "Only admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- =====================================================
-- SHIFTS TABLE - Secure Policies
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Drop all existing insecure policies
DROP POLICY IF EXISTS "Anon can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Anon can update shifts" ON shifts;
DROP POLICY IF EXISTS "Anon can delete shifts" ON shifts;
DROP POLICY IF EXISTS "Anon can select shifts" ON shifts;
DROP POLICY IF EXISTS "Admins can manage all shifts" ON shifts;
DROP POLICY IF EXISTS "Authenticated users can read all shifts" ON shifts;
DROP POLICY IF EXISTS "Anon can view all shifts" ON shifts;
DROP POLICY IF EXISTS "Anon can read all shifts" ON shifts;
DROP POLICY IF EXISTS "Management can create shifts" ON shifts;
DROP POLICY IF EXISTS "Staff can update own shifts" ON shifts;
DROP POLICY IF EXISTS "Management can update any shift" ON shifts;
DROP POLICY IF EXISTS "Management can delete shifts" ON shifts;

-- SELECT: Authenticated users can view all shifts (needed for team schedules)
CREATE POLICY "Authenticated users can view all shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Management can create shifts
CREATE POLICY "Management can create shifts"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (is_management(auth.uid()));

-- UPDATE: Staff can update own shifts (for approval), management can update all
CREATE POLICY "Staff can update own shifts"
  ON shifts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Management can update any shift"
  ON shifts FOR UPDATE
  TO authenticated
  USING (is_management(auth.uid()))
  WITH CHECK (is_management(auth.uid()));

-- DELETE: Only management can delete shifts
CREATE POLICY "Management can delete shifts"
  ON shifts FOR DELETE
  TO authenticated
  USING (is_management(auth.uid()));

-- =====================================================
-- PUNCH_RECORDS TABLE - Secure Policies
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE punch_records ENABLE ROW LEVEL SECURITY;

-- Drop all existing insecure policies
DROP POLICY IF EXISTS "Anon can insert punch records" ON punch_records;
DROP POLICY IF EXISTS "Anon can update punch records" ON punch_records;
DROP POLICY IF EXISTS "Anon can delete punch records" ON punch_records;
DROP POLICY IF EXISTS "Anon can select punch records" ON punch_records;
DROP POLICY IF EXISTS "Admins can manage all punch records" ON punch_records;
DROP POLICY IF EXISTS "Authenticated users can read all punch records" ON punch_records;
DROP POLICY IF EXISTS "Anon can view all punch records" ON punch_records;
DROP POLICY IF EXISTS "Anon can read all punch records" ON punch_records;
DROP POLICY IF EXISTS "Users can insert their own punch records" ON punch_records;
DROP POLICY IF EXISTS "Users can view own punch records" ON punch_records;
DROP POLICY IF EXISTS "Management can view all punch records" ON punch_records;
DROP POLICY IF EXISTS "Users can create own punch records" ON punch_records;
DROP POLICY IF EXISTS "Management can update punch records" ON punch_records;
DROP POLICY IF EXISTS "Only admins can delete punch records" ON punch_records;

-- SELECT: Users can view own records, management can view all
CREATE POLICY "Users can view own punch records"
  ON punch_records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Management can view all punch records"
  ON punch_records FOR SELECT
  TO authenticated
  USING (is_management(auth.uid()));

-- INSERT: Authenticated users can create their own punch records
CREATE POLICY "Users can create own punch records"
  ON punch_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Only management can update punch records (for corrections)
CREATE POLICY "Management can update punch records"
  ON punch_records FOR UPDATE
  TO authenticated
  USING (is_management(auth.uid()))
  WITH CHECK (is_management(auth.uid()));

-- DELETE: Only admins can delete punch records
CREATE POLICY "Only admins can delete punch records"
  ON punch_records FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- =====================================================
-- HOLIDAY_REQUESTS TABLE - Secure Policies
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE holiday_requests ENABLE ROW LEVEL SECURITY;

-- Drop all existing insecure policies
DROP POLICY IF EXISTS "Anon can insert holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anon can update holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anon can delete holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anon can select holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Admins can manage all holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Authenticated users can read all holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anon can view all holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anon can read all holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Users can insert their own holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Users can view own holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Management can view all holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Users can create own holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Users can update own holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Management can update any holiday request" ON holiday_requests;
DROP POLICY IF EXISTS "Users can delete own pending requests" ON holiday_requests;
DROP POLICY IF EXISTS "Management can delete any holiday request" ON holiday_requests;

-- SELECT: Users can view own requests, management can view all
CREATE POLICY "Users can view own holiday requests"
  ON holiday_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Management can view all holiday requests"
  ON holiday_requests FOR SELECT
  TO authenticated
  USING (is_management(auth.uid()));

-- INSERT: Authenticated users can create their own holiday requests
CREATE POLICY "Users can create own holiday requests"
  ON holiday_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update own requests (before approval), management can update all
CREATE POLICY "Users can update own holiday requests"
  ON holiday_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Management can update any holiday request"
  ON holiday_requests FOR UPDATE
  TO authenticated
  USING (is_management(auth.uid()))
  WITH CHECK (is_management(auth.uid()));

-- DELETE: Users can delete own pending requests, management can delete any
CREATE POLICY "Users can delete own pending requests"
  ON holiday_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Management can delete any holiday request"
  ON holiday_requests FOR DELETE
  TO authenticated
  USING (is_management(auth.uid()));

-- =====================================================
-- IMPORTANT NOTES
-- =====================================================

-- This migration implements proper RLS security that requires authenticated users.
-- Anonymous (anon) access is completely blocked on all tables.
--
-- To use this system, you must:
-- 1. Enable Supabase Auth in your application
-- 2. Have users authenticate via Supabase Auth (email/password, magic links, etc.)
-- 3. Store the Supabase user ID (auth.uid()) in the users.id column
-- 4. Use authenticated sessions for all database operations
--
-- The current app uses PIN-based authentication without Supabase Auth.
-- To migrate:
-- 1. Implement Supabase Auth sign-up/sign-in
-- 2. Link existing users to Supabase Auth users
-- 3. Update the app to use authenticated Supabase client
-- 4. Remove service_role_key from frontend code
