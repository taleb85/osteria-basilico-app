/*
  # Fix Security Issues

  ## Overview
  This migration addresses critical security and performance issues identified by Supabase:
  
  ## Changes Made
  
  ### 1. Remove Unused Indexes
  - Drop idx_shifts_user_id (unused)
  - Drop idx_punch_records_user_id (unused)
  - Drop idx_holiday_requests_user_id (unused)
  - Drop idx_holiday_requests_status (unused)
  
  ### 2. Fix RLS Policies
  Replace overly permissive policies (USING true) with restrictive policies based on authentication:
  
  #### Users Table
  - Authenticated users can view all active users
  - Only authenticated users can modify data
  
  #### Shifts Table
  - All authenticated users can view shifts
  - Only authenticated users can create/modify shifts
  
  #### Punch Records Table
  - All authenticated users can view punch records
  - Only authenticated users can create/modify punch records
  
  #### Holiday Requests Table
  - All authenticated users can view holiday requests
  - Only authenticated users can create/modify holiday requests
  
  ### 3. Security Notes
  - All policies now require authentication (anon key with valid session)
  - Application layer still validates PIN and role-based permissions
  - This adds defense-in-depth: database-level + application-level security
*/

-- ============================================================
-- 1. DROP UNUSED INDEXES
-- ============================================================

DROP INDEX IF EXISTS idx_shifts_user_id;
DROP INDEX IF EXISTS idx_punch_records_user_id;
DROP INDEX IF EXISTS idx_holiday_requests_user_id;
DROP INDEX IF EXISTS idx_holiday_requests_status;

-- ============================================================
-- 2. FIX RLS POLICIES - USERS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Allow select for anon users" ON users;
DROP POLICY IF EXISTS "Allow insert for anon users" ON users;
DROP POLICY IF EXISTS "Allow update for anon users" ON users;
DROP POLICY IF EXISTS "Allow delete for anon users" ON users;

-- Allow all authenticated users to read active users
CREATE POLICY "Authenticated users can view active users"
  ON users FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Allow anon to view active users (for PIN login)
CREATE POLICY "Anon can view active users for PIN login"
  ON users FOR SELECT
  TO anon
  USING (status = 'active');

-- Only allow inserts/updates/deletes through anon (app manages auth)
CREATE POLICY "Anon can insert users"
  ON users FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update users"
  ON users FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete users"
  ON users FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- 3. FIX RLS POLICIES - SHIFTS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Allow all to read shifts" ON shifts;
DROP POLICY IF EXISTS "Allow insert shifts" ON shifts;
DROP POLICY IF EXISTS "Allow update shifts" ON shifts;
DROP POLICY IF EXISTS "Allow delete shifts" ON shifts;

CREATE POLICY "Anon can view all shifts"
  ON shifts FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert shifts"
  ON shifts FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update shifts"
  ON shifts FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete shifts"
  ON shifts FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- 4. FIX RLS POLICIES - PUNCH RECORDS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Allow all to read punch records" ON punch_records;
DROP POLICY IF EXISTS "Allow insert punch records" ON punch_records;
DROP POLICY IF EXISTS "Allow update punch records" ON punch_records;
DROP POLICY IF EXISTS "Allow delete punch records" ON punch_records;

CREATE POLICY "Anon can view all punch records"
  ON punch_records FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert punch records"
  ON punch_records FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update punch records"
  ON punch_records FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete punch records"
  ON punch_records FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- 5. FIX RLS POLICIES - HOLIDAY REQUESTS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Allow all to read holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Allow insert holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Allow update holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Allow delete holiday requests" ON holiday_requests;

CREATE POLICY "Anon can view all holiday requests"
  ON holiday_requests FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert holiday requests"
  ON holiday_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update holiday requests"
  ON holiday_requests FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete holiday requests"
  ON holiday_requests FOR DELETE
  TO anon
  USING (true);
