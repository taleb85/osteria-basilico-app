/*
  # Implement Proper RLS Security for PIN-Based Authentication

  ## Overview
  This migration fixes all "RLS Policy Always True" warnings by implementing restrictive policies.
  Since the app uses PIN-based auth without Supabase Auth sessions, we restrict all write operations
  and only allow reads through anon key.

  ## Security Model
  
  ### Current Architecture Issue
  - App uses PIN-based authentication without Supabase Auth
  - All operations use anon key (completely unprotected)
  - RLS policies with USING (true) provide NO security
  - Anyone with the anon key can do anything
  
  ### New Security Model
  This migration implements a read-only security model for the anon key:
  - Anon role can SELECT (read) data
  - Anon role CANNOT insert, update, or delete
  - Write operations will fail at database level
  
  ### Required Application Changes
  The frontend will need to be updated to use a service role key for write operations,
  or implement proper Supabase Auth with email/password authentication.

  ## Changes Made

  ### 1. Drop All Overly Permissive Policies
  Remove all policies that allow anon to perform unrestricted write operations

  ### 2. Implement Read-Only Access for Anon
  - SELECT policies allow reading data (needed for login/dashboard)
  - NO insert, update, or delete policies for anon role
  
  ### 3. Add Authenticated User Policies (for future auth migration)
  Prepared policies for when the app migrates to Supabase Auth

  ## Migration Path to Full Security
  
  To fully secure this application, the recommended approach is:
  1. Implement Supabase email/password authentication
  2. Store PIN in user metadata for backwards compatibility
  3. Use authenticated user context in RLS policies
  4. Remove service role key from frontend

  ## Notes
  - Foreign key indexes already exist and will be used as data grows
  - is_admin function fixed in previous migration
  - Auth DB connection strategy requires Supabase dashboard configuration
*/

-- ============================================================
-- DROP ALL EXISTING POLICIES
-- ============================================================

-- Users table
DROP POLICY IF EXISTS "Anon can view active users" ON users;
DROP POLICY IF EXISTS "All users can read user profiles" ON users;
DROP POLICY IF EXISTS "Authenticated users can view active users" ON users;
DROP POLICY IF EXISTS "Anon can view active users for PIN login" ON users;
DROP POLICY IF EXISTS "Only admins can insert users" ON users;
DROP POLICY IF EXISTS "Anon can insert users" ON users;
DROP POLICY IF EXISTS "Only admins can update users" ON users;
DROP POLICY IF EXISTS "Anon can update users" ON users;
DROP POLICY IF EXISTS "Only admins can delete users" ON users;
DROP POLICY IF EXISTS "Anon can delete users" ON users;

-- Shifts table
DROP POLICY IF EXISTS "Users can read their own shifts" ON shifts;
DROP POLICY IF EXISTS "Anon can read shifts" ON shifts;
DROP POLICY IF EXISTS "Only admins can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Anon can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Only admins can update shifts" ON shifts;
DROP POLICY IF EXISTS "Anon can update shifts" ON shifts;
DROP POLICY IF EXISTS "Only admins can delete shifts" ON shifts;
DROP POLICY IF EXISTS "Anon can delete shifts" ON shifts;

-- Punch records table
DROP POLICY IF EXISTS "Users can read their own punch records" ON punch_records;
DROP POLICY IF EXISTS "Anon can read punch records" ON punch_records;
DROP POLICY IF EXISTS "Users can insert their own punch records" ON punch_records;
DROP POLICY IF EXISTS "Anon can insert punch records" ON punch_records;
DROP POLICY IF EXISTS "Only admins can update punch records" ON punch_records;
DROP POLICY IF EXISTS "Anon can update punch records" ON punch_records;
DROP POLICY IF EXISTS "Only admins can delete punch records" ON punch_records;
DROP POLICY IF EXISTS "Anon can delete punch records" ON punch_records;

-- Holiday requests table
DROP POLICY IF EXISTS "Users can read their own holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anon can read holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Users can insert their own holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anon can insert holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Only admins can update holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anon can update holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Only admins can delete holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anon can delete holiday requests" ON holiday_requests;

-- ============================================================
-- CREATE READ-ONLY POLICIES FOR ANON ROLE
-- ============================================================

-- Users: Allow anon to read all users (needed for PIN login and displaying staff)
CREATE POLICY "Anon can read all users"
  ON users FOR SELECT
  TO anon
  USING (true);

-- Shifts: Allow anon to read all shifts (needed for schedule display)
CREATE POLICY "Anon can read all shifts"
  ON shifts FOR SELECT
  TO anon
  USING (true);

-- Punch Records: Allow anon to read all punch records (needed for time tracking display)
CREATE POLICY "Anon can read all punch records"
  ON punch_records FOR SELECT
  TO anon
  USING (true);

-- Holiday Requests: Allow anon to read all holiday requests (needed for calendar display)
CREATE POLICY "Anon can read all holiday requests"
  ON holiday_requests FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- TEMPORARY: Allow writes from service role only
-- ============================================================
-- Note: The application will need to use service_role key for write operations
-- OR implement proper Supabase Auth to use the authenticated policies below

-- ============================================================
-- CREATE POLICIES FOR AUTHENTICATED USERS (for future migration)
-- ============================================================

-- Users table: Authenticated users
CREATE POLICY "Authenticated users can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'assistant_manager')
    )
  );

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'assistant_manager')
    )
  );

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'assistant_manager')
    )
  );

-- Shifts table: Authenticated users
CREATE POLICY "Authenticated users can read all shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage all shifts"
  ON shifts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'assistant_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'assistant_manager')
    )
  );

-- Punch Records table: Authenticated users
CREATE POLICY "Authenticated users can read all punch records"
  ON punch_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own punch records"
  ON punch_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all punch records"
  ON punch_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'assistant_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'assistant_manager')
    )
  );

-- Holiday Requests table: Authenticated users
CREATE POLICY "Authenticated users can read all holiday requests"
  ON holiday_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own holiday requests"
  ON holiday_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all holiday requests"
  ON holiday_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'assistant_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'assistant_manager')
    )
  );
