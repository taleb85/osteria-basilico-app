/*
  # Enable Operations for All Tables with PIN-based Auth

  1. Context
    - The application uses PIN-based authentication
    - No Supabase Auth sessions are created
    - All operations use the anon key
    - Access control is managed at the application layer

  2. Changes Made
    - Update policies for shifts, punch_records, and holiday_requests
    - Allow operations from anon key since auth.uid() is always NULL
    - Keep RLS enabled for future security enhancements
    - Maintain SELECT policies that work without auth

  3. Security
    - Application layer validates user roles and permissions
    - PIN verification happens before operations
    - Controlled environment (single restaurant)
*/

-- SHIFTS TABLE
DROP POLICY IF EXISTS "Users can read their own shifts" ON shifts;
DROP POLICY IF EXISTS "Only admins can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Only admins can update shifts" ON shifts;
DROP POLICY IF EXISTS "Only admins can delete shifts" ON shifts;

CREATE POLICY "Allow all to read shifts"
  ON shifts FOR SELECT
  USING (true);

CREATE POLICY "Allow insert shifts"
  ON shifts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update shifts"
  ON shifts FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete shifts"
  ON shifts FOR DELETE
  USING (true);

-- PUNCH RECORDS TABLE
DROP POLICY IF EXISTS "Users can read their own punch records" ON punch_records;
DROP POLICY IF EXISTS "Users can insert their own punch records" ON punch_records;
DROP POLICY IF EXISTS "Only admins can update punch records" ON punch_records;
DROP POLICY IF EXISTS "Only admins can delete punch records" ON punch_records;

CREATE POLICY "Allow all to read punch records"
  ON punch_records FOR SELECT
  USING (true);

CREATE POLICY "Allow insert punch records"
  ON punch_records FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update punch records"
  ON punch_records FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete punch records"
  ON punch_records FOR DELETE
  USING (true);

-- HOLIDAY REQUESTS TABLE
DROP POLICY IF EXISTS "Users can read their own holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Users can insert their own holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Only admins can update holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Only admins can delete holiday requests" ON holiday_requests;

CREATE POLICY "Allow all to read holiday requests"
  ON holiday_requests FOR SELECT
  USING (true);

CREATE POLICY "Allow insert holiday requests"
  ON holiday_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update holiday requests"
  ON holiday_requests FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete holiday requests"
  ON holiday_requests FOR DELETE
  USING (true);
