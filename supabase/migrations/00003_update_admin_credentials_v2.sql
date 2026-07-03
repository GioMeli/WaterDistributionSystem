
-- Update admin email and password
UPDATE auth.users
SET
  email = 'georgios.meli@un.org',
  encrypted_password = crypt('123Gm456!', gen_salt('bf')),
  email_confirmed_at = NOW(),
  updated_at = NOW(),
  raw_user_meta_data = '{"full_name":"Georgios Meli","role":"admin"}'
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Update identity provider_id to match new email
UPDATE auth.identities
SET
  provider_id = 'georgios.meli@un.org',
  identity_data = '{"sub":"a0000000-0000-0000-0000-000000000001","email":"georgios.meli@un.org"}',
  updated_at = NOW()
WHERE user_id = 'a0000000-0000-0000-0000-000000000001';

-- Update profile
UPDATE profiles
SET
  email = 'georgios.meli@un.org',
  full_name = 'Georgios Meli',
  updated_at = NOW()
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Set notification and admin email in app_settings
INSERT INTO app_settings (key, value, updated_at)
VALUES ('notification_email', 'georgios.meli@un.org', NOW())
ON CONFLICT (key) DO UPDATE SET value = 'georgios.meli@un.org', updated_at = NOW();

INSERT INTO app_settings (key, value, updated_at)
VALUES ('admin_email', 'georgios.meli@un.org', NOW())
ON CONFLICT (key) DO UPDATE SET value = 'georgios.meli@un.org', updated_at = NOW();
