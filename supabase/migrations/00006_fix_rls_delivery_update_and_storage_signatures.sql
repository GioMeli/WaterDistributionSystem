
-- ─────────────────────────────────────────────────────────────
-- Fix 1: deliveries UPDATE policy
-- Problem: no WITH CHECK clause → PostgreSQL defaults to USING,
--   so new row's status must also satisfy the USING condition.
--   When vendor sets status='submitted_to_admin' the check fails.
-- Fix: explicit WITH CHECK allows the target statuses vendors can
--   transition TO, while USING still restricts which rows they
--   can edit FROM.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Vendors can update own in-progress deliveries" ON public.deliveries;

CREATE POLICY "Vendors can update own in-progress deliveries"
  ON public.deliveries
  FOR UPDATE
  TO authenticated
  USING (
    -- Which rows a vendor may START editing
    (vendor_id = auth.uid()
      AND status = ANY (ARRAY[
        'in_progress'::text,
        'rejected_by_admin'::text,
        'resubmitted_to_admin'::text
      ]))
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    -- What the row is allowed to look like AFTER the update
    (vendor_id = auth.uid()
      AND status = ANY (ARRAY[
        'in_progress'::text,
        'submitted_to_admin'::text,
        'resubmitted_to_admin'::text
      ]))
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Fix 2: storage signatures – add UPDATE policy
-- Problem: overwriting an existing signature file requires an
--   UPDATE policy on storage.objects; INSERT-only policies block
--   the upsert when the object already exists.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can update signatures" ON storage.objects;

CREATE POLICY "Authenticated users can update signatures"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'signatures')
  WITH CHECK (bucket_id = 'signatures');

-- Allow authenticated users to delete and re-upload their own signature files
DROP POLICY IF EXISTS "Authenticated users can delete signatures" ON storage.objects;

CREATE POLICY "Authenticated users can delete signatures"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'signatures');
