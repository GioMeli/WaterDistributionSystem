
-- Drop all existing profiles policies that cause recursion
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create a security-definer function to get the current user's role
-- This breaks the recursion by bypassing RLS
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Recreate policies using auth.uid() directly or the security-definer function
-- Users can always read their own profile (no recursion: auth.uid() is not a subquery on profiles)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Admins can read all profiles (uses security-definer function, no recursion)
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (get_my_role() = 'admin');

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (get_my_role() = 'admin');

-- Admins can insert profiles
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (get_my_role() = 'admin');

-- Allow the trigger (service role) to insert profiles on signup
-- The handle_new_user trigger runs as SECURITY DEFINER so it bypasses RLS already
-- But also allow authenticated users to insert their own profile (for signUp flow)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());
