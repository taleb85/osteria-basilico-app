/*
  # Fix User Insert RLS Policy

  1. Problem Identified
    - Current INSERT policy checks `is_admin(id)` where `id` is the NEW user being created
    - This always fails because the new user doesn't exist yet and isn't an admin
    - Should check `is_admin(auth.uid())` to verify the CURRENT user is an admin

  2. Changes Made
    - Drop incorrect INSERT policy
    - Create correct policy that checks if the current authenticated user is an admin
    - This allows admins to create new users directly from the AdminPanel

  3. Security
    - Only users with role='Admin' can insert new users
    - Maintains security while fixing the bug
*/

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Only admins can insert users" ON users;

-- Create the correct policy that checks the current user's admin status
CREATE POLICY "Only admins can insert users"
  ON users FOR INSERT
  WITH CHECK (is_admin(auth.uid()));
