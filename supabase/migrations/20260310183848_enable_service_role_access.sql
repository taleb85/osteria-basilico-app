/*
  # Enable Service Role Access for Application

  1. Overview
    This migration adds permissive RLS policies that allow the service_role_key
    to perform all operations, while maintaining the secure authenticated policies.

  2. Changes
    - Add service_role bypass policies for all tables
    - Keep existing authenticated policies intact
    - Service role has full CRUD access for application operations

  3. Security Model
    - Authenticated users: Secure RLS policies (auth.uid() based)
    - Service role: Full access (for PIN-based app operations)
    - Anon key: Still blocked (no changes to anon policies)

  4. Tables Updated
    - users
    - shifts
    - punch_records
    - holiday_requests
*/

-- =====================================================
-- USERS TABLE - Service Role Policies
-- =====================================================

-- Service role can do everything on users table
CREATE POLICY "Service role full access to users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- SHIFTS TABLE - Service Role Policies
-- =====================================================

CREATE POLICY "Service role full access to shifts"
  ON shifts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- PUNCH_RECORDS TABLE - Service Role Policies
-- =====================================================

CREATE POLICY "Service role full access to punch_records"
  ON punch_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- HOLIDAY_REQUESTS TABLE - Service Role Policies
-- =====================================================

CREATE POLICY "Service role full access to holiday_requests"
  ON holiday_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- NOTES
-- =====================================================

/*
  These policies allow the service_role_key to bypass RLS restrictions,
  which is necessary for the PIN-based authentication system.
  
  The authenticated policies remain in place and will be enforced when
  Supabase Auth is implemented in the future.
  
  Security considerations:
  - Service role key must be kept secure
  - Should not be exposed in production client code
  - Consider migrating to Supabase Auth for production use
*/
