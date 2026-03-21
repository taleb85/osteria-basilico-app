/*
  # Allow Anonymous Full Access

  1. Changes
    - Drop all existing restrictive RLS policies
    - Create new policies that allow anon key full CRUD access on all tables
    - Maintains RLS enabled but with permissive policies

  2. Security
    - App-level security through PIN authentication
    - Database accessible via anon key for application operations
*/

-- Users table: Allow full access via anon
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Authenticated users can read all users" ON users;
DROP POLICY IF EXISTS "Anon can read all users" ON users;

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

CREATE POLICY "Anon can select users"
  ON users FOR SELECT
  TO anon
  USING (true);

-- Shifts table: Allow full access via anon
DROP POLICY IF EXISTS "Admins can manage all shifts" ON shifts;
DROP POLICY IF EXISTS "Authenticated users can read all shifts" ON shifts;
DROP POLICY IF EXISTS "Anon can view all shifts" ON shifts;
DROP POLICY IF EXISTS "Anon can read all shifts" ON shifts;

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

CREATE POLICY "Anon can select shifts"
  ON shifts FOR SELECT
  TO anon
  USING (true);

-- Punch records table: Allow full access via anon
DROP POLICY IF EXISTS "Admins can manage all punch records" ON punch_records;
DROP POLICY IF EXISTS "Authenticated users can read all punch records" ON punch_records;
DROP POLICY IF EXISTS "Anon can view all punch records" ON punch_records;
DROP POLICY IF EXISTS "Anon can read all punch records" ON punch_records;
DROP POLICY IF EXISTS "Users can insert their own punch records" ON punch_records;

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

CREATE POLICY "Anon can select punch records"
  ON punch_records FOR SELECT
  TO anon
  USING (true);

-- Holiday requests table: Allow full access via anon
DROP POLICY IF EXISTS "Admins can manage all holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Authenticated users can read all holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anon can view all holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anon can read all holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Users can insert their own holiday requests" ON holiday_requests;

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

CREATE POLICY "Anon can select holiday requests"
  ON holiday_requests FOR SELECT
  TO anon
  USING (true);