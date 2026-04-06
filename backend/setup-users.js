require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  console.log('🔧 Cleaning up and recreating users...\n');

  // 1. Delete any broken auth.users entries via raw SQL
  console.log('Step 1: Cleaning broken auth entries...');
  const { error: cleanErr } = await supabase.rpc('exec_sql', {
    sql: "DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('admin@graamswasthya.in','doctor@graamswasthya.in'));"
  }).maybeSingle();
  // Ignore errors — rpc might not exist

  // 2. Delete existing auth users via Admin API
  console.log('Step 2: Removing existing auth users via Admin API...');
  const { data: listData } = await supabase.auth.admin.listUsers();
  if (listData?.users) {
    for (const u of listData.users) {
      if (['admin@graamswasthya.in', 'doctor@graamswasthya.in'].includes(u.email)) {
        // First delete from platform_users (FK constraint)
        await supabase.from('user_village_assignments').delete().eq('user_id', u.id);
        await supabase.from('platform_users').delete().eq('id', u.id);
        // Then delete auth user
        const { error } = await supabase.auth.admin.deleteUser(u.id);
        console.log(`  Deleted ${u.email}: ${error ? error.message : 'OK'}`);
      }
    }
  }

  // Also clean up any manual SQL-inserted users that Admin API can't see
  console.log('Step 3: Cleaning manual SQL entries...');
  await supabase.from('user_village_assignments').delete().in('user_id', [
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
  ]);
  await supabase.from('platform_users').delete().in('id', [
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
  ]);

  // Wait a moment for cleanup to propagate
  await new Promise(r => setTimeout(r, 2000));

  // 3. Create fresh users via Admin API
  const users = [
    { email: 'admin@graamswasthya.in', password: 'Admin@123', name: 'Admin User', phone: '+919876543210', role: 'admin' },
    { email: 'doctor@graamswasthya.in', password: 'Doctor@123', name: 'Dr. Sharma', phone: '+919876543211', role: 'doctor' },
  ];

  for (const u of users) {
    console.log(`\nStep 4: Creating ${u.email}...`);
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });

    if (authErr) {
      console.log(`  ❌ Auth create failed: ${authErr.message}`);
      continue;
    }

    const userId = authData.user.id;
    console.log(`  ✅ Auth user created: ${userId}`);

    // Insert platform_users
    const { error: puErr } = await supabase.from('platform_users').insert({
      id: userId,
      full_name: u.name,
      phone: u.phone,
      role: u.role,
      is_active: true,
    });
    console.log(`  ${puErr ? '❌ platform_users: ' + puErr.message : '✅ platform_users OK'}`);
  }

  // 5. Test login immediately
  console.log('\n--- Testing login ---');
  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'admin@graamswasthya.in',
    password: 'Admin@123',
  });

  if (loginErr) {
    console.log('❌ Login FAILED:', loginErr.message);
  } else {
    console.log('✅ Login SUCCESS!');
    console.log('   User ID:', loginData.user.id);
    console.log('   Email:', loginData.user.email);
  }

  console.log('\n✅ Done! Credentials:');
  console.log('   Admin:  admin@graamswasthya.in / Admin@123');
  console.log('   Doctor: doctor@graamswasthya.in / Doctor@123');
}

fix().catch(console.error);
