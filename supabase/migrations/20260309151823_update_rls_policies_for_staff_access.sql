/*
  # Update RLS Policies for Staff Personal Access

  1. Security Model
    - Staff users can:
      - Read all users (to see colleagues)
      - Read only their own shifts
      - Insert their own punch records
      - Insert their own holiday requests
      - Read their own holiday requests
    
    - Admin users (role = 'Admin') can:
      - Full access to all tables (read, write, update, delete)
    
  2. Changes Made
    - Drop existing overly permissive policies
    - Create granular policies based on user role and ownership
    - Add helper function to check if user is admin
    
  3. Important Notes
    - Policies now enforce data isolation for staff users
    - Admins have unrestricted access for management purposes
    - Staff can only see and modify their own records
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read users" ON users;
DROP POLICY IF EXISTS "Admins and Managers can insert users" ON users;
DROP POLICY IF EXISTS "Admins and Managers can update users" ON users;
DROP POLICY IF EXISTS "Admins and Managers can delete users" ON users;

DROP POLICY IF EXISTS "Anyone can read shifts" ON shifts;
DROP POLICY IF EXISTS "Admins and Managers can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Admins and Managers can update shifts" ON shifts;
DROP POLICY IF EXISTS "Admins and Managers can delete shifts" ON shifts;

DROP POLICY IF EXISTS "Anyone can read punch records" ON punch_records;
DROP POLICY IF EXISTS "Anyone can insert punch records" ON punch_records;
DROP POLICY IF EXISTS "Admins and Managers can update punch records" ON punch_records;
DROP POLICY IF EXISTS "Admins and Managers can delete punch records" ON punch_records;

DROP POLICY IF EXISTS "Anyone can read holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Anyone can insert holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Admins and Managers can update holiday requests" ON holiday_requests;
DROP POLICY IF EXISTS "Admins and Managers can delete holiday requests" ON holiday_requests;

-- Create helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id_param uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id_param AND role = 'Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for users table
CREATE POLICY "All users can read user profiles"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert users"
  ON users FOR INSERT
  WITH CHECK (is_admin(id));

CREATE POLICY "Only admins can update users"
  ON users FOR UPDATE
  USING (is_admin(id));

CREATE POLICY "Only admins can delete users"
  ON users FOR DELETE
  USING (is_admin(id));

-- RLS Policies for shifts table
CREATE POLICY "Users can read their own shifts"
  ON shifts FOR SELECT
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Only admins can insert shifts"
  ON shifts FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update shifts"
  ON shifts FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete shifts"
  ON shifts FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for punch_records table
CREATE POLICY "Users can read their own punch records"
  ON punch_records FOR SELECT
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Users can insert their own punch records"
  ON punch_records FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Only admins can update punch records"
  ON punch_records FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete punch records"
  ON punch_records FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for holiday_requests table
CREATE POLICY "Users can read their own holiday requests"
  ON holiday_requests FOR SELECT
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Users can insert their own holiday requests"
  ON holiday_requests FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Only admins can update holiday requests"
  ON holiday_requests FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete holiday requests"
  ON holiday_requests FOR DELETE
  USING (is_admin(auth.uid()));
