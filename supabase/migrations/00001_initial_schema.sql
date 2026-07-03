
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'vendor' CHECK (role IN ('vendor', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- LOCATIONS
-- ============================================================
CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_number text NOT NULL,
  building_number text NOT NULL,
  office_name text NOT NULL,
  sup_number text NOT NULL,
  estimated_bottles integer NOT NULL DEFAULT 0,
  latitude double precision,
  longitude double precision,
  location_notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read locations" ON locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert locations" ON locations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can update locations" ON locations
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can delete locations" ON locations
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- DELIVERIES
-- ============================================================
CREATE TABLE deliveries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_date date NOT NULL,
  vendor_id uuid NOT NULL REFERENCES profiles(id),
  vendor_full_name text NOT NULL DEFAULT '',
  vendor_signature_url text,
  admin_id uuid REFERENCES profiles(id),
  admin_full_name text,
  admin_signature_url text,
  status text NOT NULL DEFAULT 'in_progress' CHECK (
    status IN ('draft','in_progress','submitted_to_admin','rejected_by_admin','resubmitted_to_admin','approved','finalised')
  ),
  admin_comments text,
  generated_pdf_url text,
  final_signed_pdf_url text,
  submitted_at timestamptz,
  approved_at timestamptz,
  finalised_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can read own deliveries" ON deliveries
  FOR SELECT TO authenticated
  USING (vendor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Vendors can insert own deliveries" ON deliveries
  FOR INSERT TO authenticated
  WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "Vendors can update own in-progress deliveries" ON deliveries
  FOR UPDATE TO authenticated
  USING (
    (vendor_id = auth.uid() AND status IN ('in_progress','rejected_by_admin','resubmitted_to_admin'))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- DELIVERY_LOCATION_ITEMS
-- ============================================================
CREATE TABLE delivery_location_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id),
  route_number text NOT NULL DEFAULT '',
  building_number text NOT NULL DEFAULT '',
  office_name text NOT NULL DEFAULT '',
  sup_number text NOT NULL DEFAULT '',
  estimated_bottles integer NOT NULL DEFAULT 0,
  issued_quantity integer NOT NULL DEFAULT 0,
  received_quantity integer NOT NULL DEFAULT 0,
  officer_name text,
  officer_signature_url text,
  no_issue_needed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','no_issue_needed')),
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_location_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can read own delivery items" ON delivery_location_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d WHERE d.id = delivery_id
      AND (d.vendor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    )
  );

CREATE POLICY "Vendors can insert delivery items for own deliveries" ON delivery_location_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM deliveries d WHERE d.id = delivery_id AND d.vendor_id = auth.uid())
  );

CREATE POLICY "Vendors can update own delivery items" ON delivery_location_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d WHERE d.id = delivery_id
      AND (
        (d.vendor_id = auth.uid() AND d.status IN ('in_progress','rejected_by_admin','resubmitted_to_admin'))
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
    )
  );

-- ============================================================
-- REPORT_EXPORTS
-- ============================================================
CREATE TABLE report_exports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id uuid NOT NULL REFERENCES profiles(id),
  export_type text NOT NULL CHECK (export_type IN ('csv','excel','pdf')),
  filter_start_date date,
  filter_end_date date,
  generated_file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage report exports" ON report_exports
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- AUDIT_LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Authenticated can insert audit logs" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- APP_SETTINGS (for email recipient config)
-- ============================================================
CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings" ON app_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Default settings
INSERT INTO app_settings (key, value) VALUES
  ('email_recipient', ''),
  ('email_cc', ''),
  ('app_name', 'Water Distribution Management System');

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('signatures', 'signatures', true),
  ('pdfs', 'pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload signatures" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Anyone can read signatures" ON storage.objects
  FOR SELECT USING (bucket_id = 'signatures');

CREATE POLICY "Authenticated users can upload pdfs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pdfs');

CREATE POLICY "Anyone can read pdfs" ON storage.objects
  FOR SELECT USING (bucket_id = 'pdfs');

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_items_updated_at BEFORE UPDATE ON delivery_location_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendor')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SEED DATA — 5 sample locations
-- ============================================================
INSERT INTO locations (route_number, building_number, office_name, sup_number, estimated_bottles, latitude, longitude, is_active, sort_order) VALUES
  ('1', 'D001', 'Office of the Chief of Mission', 'SUP03397', 10, 33.3152, 44.3661, true, 1),
  ('2', 'D001', 'CMS', 'SUP03682', 8, 33.3155, 44.3665, true, 2),
  ('3', 'B055', 'UNPOL', 'SUP03648', 12, 33.3201, 44.3701, true, 3),
  ('4', 'E091', 'Centralized Warehouse', 'SUP02236', 20, 33.3180, 44.3720, true, 4),
  ('5', '565',  'Aviation', 'SUP03377', 6, 33.3100, 44.3580, true, 5);
