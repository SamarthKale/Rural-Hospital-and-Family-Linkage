-- =============================================================================
-- EMERGENCY CLEANUP: Fix corrupted auth entries
-- Run this in Supabase SQL Editor FIRST
-- =============================================================================

-- Remove any manually inserted auth entries that are corrupted
DELETE FROM auth.identities 
WHERE provider_id IN (
  'a0000000-0000-0000-0000-000000000001', 
  'a0000000-0000-0000-0000-000000000002'
);

DELETE FROM auth.sessions 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('admin@graamswasthya.in', 'doctor@graamswasthya.in')
);

DELETE FROM auth.refresh_tokens 
WHERE user_id IN (
  SELECT id::text FROM auth.users 
  WHERE email IN ('admin@graamswasthya.in', 'doctor@graamswasthya.in')
);

DELETE FROM auth.mfa_factors 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('admin@graamswasthya.in', 'doctor@graamswasthya.in')
);

-- Clean platform_users FK references first
DELETE FROM user_village_assignments 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('admin@graamswasthya.in', 'doctor@graamswasthya.in')
);

DELETE FROM platform_users 
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('admin@graamswasthya.in', 'doctor@graamswasthya.in')
);

-- Also clean up the hardcoded UUIDs from SEED_USERS.sql
DELETE FROM user_village_assignments WHERE user_id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002'
);
DELETE FROM platform_users WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002'
);

-- Now delete the corrupted auth users
DELETE FROM auth.users 
WHERE email IN ('admin@graamswasthya.in', 'doctor@graamswasthya.in');

-- Also delete by the hardcoded UUIDs from SEED_USERS.sql
DELETE FROM auth.identities WHERE user_id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002'
);
DELETE FROM auth.users WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002'
);

-- Verify cleanup
SELECT id, email FROM auth.users;
