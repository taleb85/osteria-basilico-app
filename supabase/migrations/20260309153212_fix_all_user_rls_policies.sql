/*
  # Fix All User Table RLS Policies

  1. Problem Identified
    - UPDATE and DELETE policies also incorrectly use `is_admin(id)`
    - This checks if the user BEING modified is an admin, not if the CURRENT user is an admin
    - All policies should check `auth.uid()` to verify the current user's permissions

  2. Changes Made
    - Drop incorrect UPDATE and DELETE policies
    - Recreate them to check if the current authenticated user is an admin
    - Ensures only admins can modify/delete any user records

  3. Security
    - Maintains strict access control
    - Only authenticated admins can modify user data
    - Staff users can only read user profiles
*/

-- Drop incorrect policies
DROP POLICY IF EXISTS "Only admins can update users" ON users;
DROP POLICY IF EXISTS "Only admins can delete users" ON users;

-- Recreate with correct checks
CREATE POLICY "Only admins can update users"
  ON users FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete users"
  ON users FOR DELETE
  USING (is_admin(auth.uid()));
