
-- Seed admin user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@wdms.local',
  crypt('Admin@1234', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"System Administrator","role":"admin"}',
  false,
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  ''
),
(
  'b0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'vendor@wdms.local',
  crypt('Vendor@1234', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Demo Vendor","role":"vendor"}',
  false,
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Seed identities (required for email login)
INSERT INTO auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin@wdms.local',
  'a0000000-0000-0000-0000-000000000001',
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"admin@wdms.local"}',
  'email',
  NOW(),
  NOW(),
  NOW()
),
(
  'b0000000-0000-0000-0000-000000000002',
  'vendor@wdms.local',
  'b0000000-0000-0000-0000-000000000002',
  '{"sub":"b0000000-0000-0000-0000-000000000002","email":"vendor@wdms.local"}',
  'email',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Seed profiles (trigger may have already handled this, but ensure they exist)
INSERT INTO profiles (id, full_name, email, role, status, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'System Administrator', 'admin@wdms.local', 'admin', 'active', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000002', 'Demo Vendor', 'vendor@wdms.local', 'vendor', 'active', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  status = EXCLUDED.status;
