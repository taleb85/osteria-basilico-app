/*
  # Temporary Anonymous Write Access (DEVELOPMENT ONLY)

  1. Overview
    This migration temporarily enables anon key to perform write operations
    to unblock development. This is NOT secure and should ONLY be used in 
    development environments.

  2. Changes
    - Add temporary anon policies for INSERT/UPDATE/DELETE
    - Allows PIN-based app to function without service_role_key
    
  3. Security Warning
    ⚠️ THIS IS INSECURE - DO NOT USE IN PRODUCTION
    ⚠️ Remove these policies before deploying to production
    ⚠️ This is only for development/testing purposes

  4. Tables Updated
    - users
    - shifts  
    - punch_records
    - holiday_requests
*/

-- =====================================================
-- USERS TABLE - Temporary Anon Policies
-- =====================================================

CREATE POLICY "TEMP: Anon can insert users"
  ON users FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "TEMP: Anon can update users"
  ON users FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "TEMP: Anon can delete users"
  ON users FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "TEMP: Anon can select users"
  ON users FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- SHIFTS TABLE - Temporary Anon Policies
-- =====================================================

CREATE POLICY "TEMP: Anon can insert shifts"
  ON shifts FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "TEMP: Anon can update shifts"
  ON shifts FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "TEMP: Anon can delete shifts"
  ON shifts FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "TEMP: Anon can select shifts"
  ON shifts FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- PUNCH_RECORDS TABLE - Temporary Anon Policies
-- =====================================================

CREATE POLICY "TEMP: Anon can insert punch_records"
  ON punch_records FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "TEMP: Anon can update punch_records"
  ON punch_records FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "TEMP: Anon can delete punch_records"
  ON punch_records FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "TEMP: Anon can select punch_records"
  ON punch_records FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- HOLIDAY_REQUESTS TABLE - Temporary Anon Policies
-- =====================================================

CREATE POLICY "TEMP: Anon can insert holiday_requests"
  ON holiday_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "TEMP: Anon can update holiday_requests"
  ON holiday_requests FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "TEMP: Anon can delete holiday_requests"
  ON holiday_requests FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "TEMP: Anon can select holiday_requests"
  ON holiday_requests FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- IMPORTANT SECURITY NOTICE
-- =====================================================

/*
  ⚠️⚠️⚠️ CRITICAL SECURITY WARNING ⚠️⚠️⚠️
  
  These policies allow ANYONE with the anon key to:
  - Create, read, update, and delete ALL data
  - Bypass ALL authentication and authorization
  - Perform ANY operation on the database
  
  This configuration is EXTREMELY INSECURE and should ONLY be used:
  - In local development environments
  - For testing purposes
  - When the database contains NO sensitive data
  
  BEFORE PRODUCTION:
  1. Drop all "TEMP:" policies
  2. Add proper service_role_key to environment variables
  3. Implement Supabase Auth for secure authentication
  4. Re-enable secure authenticated policies only
  
  TO REMOVE THESE POLICIES:
  
  DROP POLICY "TEMP: Anon can insert users" ON users;
  DROP POLICY "TEMP: Anon can update users" ON users;
  DROP POLICY "TEMP: Anon can delete users" ON users;
  DROP POLICY "TEMP: Anon can select users" ON users;
  
  DROP POLICY "TEMP: Anon can insert shifts" ON shifts;
  DROP POLICY "TEMP: Anon can update shifts" ON shifts;
  DROP POLICY "TEMP: Anon can delete shifts" ON shifts;
  DROP POLICY "TEMP: Anon can select shifts" ON shifts;
  
  DROP POLICY "TEMP: Anon can insert punch_records" ON punch_records;
  DROP POLICY "TEMP: Anon can update punch_records" ON punch_records;
  DROP POLICY "TEMP: Anon can delete punch_records" ON punch_records;
  DROP POLICY "TEMP: Anon can select punch_records" ON punch_records;
  
  DROP POLICY "TEMP: Anon can insert holiday_requests" ON holiday_requests;
  DROP POLICY "TEMP: Anon can update holiday_requests" ON holiday_requests;
  DROP POLICY "TEMP: Anon can delete holiday_requests" ON holiday_requests;
  DROP POLICY "TEMP: Anon can select holiday_requests" ON holiday_requests;
*/
