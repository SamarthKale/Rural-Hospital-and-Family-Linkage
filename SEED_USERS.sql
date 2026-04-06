-- =============================================================================
-- GraamSwasthya — Seed Admin & Doctor Users
-- Run this in Supabase SQL Editor (Project → SQL Editor → New Query)
-- =============================================================================
-- This script creates two users in Supabase Auth AND the platform_users table.
-- 
-- ADMIN LOGIN:
--   Email:    admin@graamswasthya.in
--   Password: Admin@123
--
-- DOCTOR LOGIN:
--   Email:    doctor@graamswasthya.in
--   Password: Doctor@123
-- =============================================================================

-- 1. Create Admin user in auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@graamswasthya.in',
  crypt('Admin@123', gen_salt('bf')),
  NOW(),
  'authenticated',
  'authenticated',
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Admin User"}',
  NOW(),
  NOW(),
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Doctor user in auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'doctor@graamswasthya.in',
  crypt('Doctor@123', gen_salt('bf')),
  NOW(),
  'authenticated',
  'authenticated',
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Dr. Sharma"}',
  NOW(),
  NOW(),
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create identities for email auth (required by Supabase Auth)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'email', 'admin@graamswasthya.in'),
  'email',
  'a0000000-0000-0000-0000-000000000001',
  NOW(), NOW(), NOW()
)
ON CONFLICT DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000002',
  jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000002', 'email', 'doctor@graamswasthya.in'),
  'email',
  'a0000000-0000-0000-0000-000000000002',
  NOW(), NOW(), NOW()
)
ON CONFLICT DO NOTHING;

-- 4. Create platform_users entries (must match auth.users UUIDs)
INSERT INTO platform_users (id, full_name, phone, role, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Admin User', '+919876543210', 'admin', TRUE),
  ('a0000000-0000-0000-0000-000000000002', 'Dr. Sharma', '+919876543211', 'doctor', TRUE)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- 5. Assign doctor to all existing villages (optional — admin has full access by default)
INSERT INTO user_village_assignments (user_id, village_id, assigned_by)
SELECT 
  'a0000000-0000-0000-0000-000000000002',
  v.id,
  'a0000000-0000-0000-0000-000000000001'
FROM villages v
ON CONFLICT (user_id, village_id) DO NOTHING;

-- =============================================================================
-- DONE! You can now log in with:
--   Admin:  admin@graamswasthya.in / Admin@123
--   Doctor: doctor@graamswasthya.in / Doctor@123
-- =============================================================================
