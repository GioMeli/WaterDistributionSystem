
-- ============================================================
-- DISPENSER MANAGEMENT MODULE
-- New tables only; existing tables untouched
-- ============================================================

-- Helper: check if caller is admin (avoids self-loop in RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- ── 1. dispensers ──────────────────────────────────────────
CREATE TABLE dispensers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  uuid REFERENCES locations(id) ON DELETE SET NULL,
  serial_number text,
  model         text,
  notes         text,
  is_active     boolean NOT NULL DEFAULT true,
  next_due_date date,
  last_completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dispensers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_dispensers" ON dispensers
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "vendor_select_active_dispensers" ON dispensers
  FOR SELECT TO authenticated
  USING (is_active = true AND NOT is_admin());

-- ── 2. dispenser_cycles ────────────────────────────────────
CREATE TYPE dispenser_process_type AS ENUM ('sanitisation', 'descaling');
CREATE TYPE dispenser_cycle_status AS ENUM (
  'open', 'submitted_to_admin', 'approved', 'rejected'
);

CREATE TABLE dispenser_cycles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_type dispenser_process_type NOT NULL,
  vendor_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  vendor_full_name text NOT NULL,
  vendor_signature_url text,
  status       dispenser_cycle_status NOT NULL DEFAULT 'open',
  admin_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  admin_full_name text,
  admin_comments text,
  admin_approved_at timestamptz,
  cycle_pdf_url text,
  submitted_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dispenser_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_cycles" ON dispenser_cycles
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "vendor_own_cycles_select" ON dispenser_cycles
  FOR SELECT TO authenticated
  USING (vendor_id = auth.uid() AND NOT is_admin());

CREATE POLICY "vendor_own_cycles_insert" ON dispenser_cycles
  FOR INSERT TO authenticated
  WITH CHECK (vendor_id = auth.uid() AND NOT is_admin());

CREATE POLICY "vendor_own_cycles_update" ON dispenser_cycles
  FOR UPDATE TO authenticated
  USING (vendor_id = auth.uid() AND NOT is_admin())
  WITH CHECK (vendor_id = auth.uid() AND NOT is_admin());

-- ── 3. dispenser_cycle_items ───────────────────────────────
CREATE TYPE dispenser_item_status AS ENUM (
  'pending','collected','in_process','returned','completed',
  'submitted_to_admin','approved','rejected'
);

CREATE TABLE dispenser_cycle_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        uuid NOT NULL REFERENCES dispenser_cycles(id) ON DELETE CASCADE,
  dispenser_id    uuid NOT NULL REFERENCES dispensers(id) ON DELETE RESTRICT,
  -- denormalised for PDF/reporting
  serial_number   text,
  model           text,
  location_name   text,
  -- collection
  collected_date  date,
  collect_officer_name text,
  collect_officer_signature_url text,
  -- return
  returned_date   date,
  return_officer_name text,
  return_officer_signature_url text,
  -- vendor sign-off
  vendor_signature_url text,
  -- individual PDF
  item_pdf_url    text,
  -- status & computed
  status          dispenser_item_status NOT NULL DEFAULT 'pending',
  next_due_date   date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dispenser_cycle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_items" ON dispenser_cycle_items
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "vendor_own_items_select" ON dispenser_cycle_items
  FOR SELECT TO authenticated
  USING (
    NOT is_admin() AND
    EXISTS (
      SELECT 1 FROM dispenser_cycles c
      WHERE c.id = dispenser_cycle_items.cycle_id
        AND c.vendor_id = auth.uid()
    )
  );

CREATE POLICY "vendor_own_items_insert" ON dispenser_cycle_items
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT is_admin() AND
    EXISTS (
      SELECT 1 FROM dispenser_cycles c
      WHERE c.id = dispenser_cycle_items.cycle_id
        AND c.vendor_id = auth.uid()
    )
  );

CREATE POLICY "vendor_own_items_update" ON dispenser_cycle_items
  FOR UPDATE TO authenticated
  USING (
    NOT is_admin() AND
    EXISTS (
      SELECT 1 FROM dispenser_cycles c
      WHERE c.id = dispenser_cycle_items.cycle_id
        AND c.vendor_id = auth.uid()
    )
  )
  WITH CHECK (
    NOT is_admin() AND
    EXISTS (
      SELECT 1 FROM dispenser_cycles c
      WHERE c.id = dispenser_cycle_items.cycle_id
        AND c.vendor_id = auth.uid()
    )
  );

-- ── 4. Storage bucket for signatures & PDFs ───────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dispenser-assets',
  'dispenser-assets',
  true,
  10485760,
  ARRAY['image/png','image/jpeg','image/webp','application/pdf']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "dispenser_assets_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dispenser-assets');

CREATE POLICY "dispenser_assets_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'dispenser-assets');

CREATE POLICY "dispenser_assets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'dispenser-assets' AND is_admin());

-- ── 5. updated_at triggers ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_dispensers_updated_at
  BEFORE UPDATE ON dispensers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cycles_updated_at
  BEFORE UPDATE ON dispenser_cycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON dispenser_cycle_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
