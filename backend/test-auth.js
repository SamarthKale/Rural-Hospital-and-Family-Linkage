require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function debug() {
  const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Auth users
  const { data: listData } = await s.auth.admin.listUsers();
  console.log('=== AUTH USERS ===');
  listData.users.forEach(u => console.log(u.id + ' | ' + u.email));

  // Platform users
  const { data: pu } = await s.from('platform_users').select('id, full_name, role');
  console.log('\n=== PLATFORM_USERS ===');
  (pu || []).forEach(u => console.log(u.id + ' | ' + u.full_name + ' | ' + u.role));

  // Now fix: sync platform_users IDs to match auth users
  console.log('\n=== FIXING ===');
  
  // Delete all existing platform_users for our target emails
  // First need to get auth user IDs
  const adminAuth = listData.users.find(u => u.email === 'admin@graamswasthya.in');
  const doctorAuth = listData.users.find(u => u.email === 'doctor@graamswasthya.in');

  // Delete all platform_users that don't match the auth IDs
  const authIds = [adminAuth?.id, doctorAuth?.id].filter(Boolean);
  
  // Delete stale platform_users entries
  for (const p of (pu || [])) {
    if (!authIds.includes(p.id)) {
      // Clean up FK references first
      await s.from('user_village_assignments').delete().eq('user_id', p.id);
      // Then check if any other tables reference this
      await s.from('households').update({ created_by: null }).eq('created_by', p.id);
      const { error } = await s.from('platform_users').delete().eq('id', p.id);
      console.log('Deleted stale: ' + p.id + ' | ' + (error ? error.message : 'OK'));
    }
  }

  // Upsert correct entries
  if (adminAuth) {
    const { error } = await s.from('platform_users').upsert({
      id: adminAuth.id, full_name: 'Admin User', phone: '+919876543210', role: 'admin', is_active: true
    }, { onConflict: 'id' });
    console.log('Admin upsert (' + adminAuth.id + '): ' + (error ? error.message : 'OK'));
  }

  if (doctorAuth) {
    const { error } = await s.from('platform_users').upsert({
      id: doctorAuth.id, full_name: 'Dr. Sharma', phone: '+919876543211', role: 'doctor', is_active: true
    }, { onConflict: 'id' });
    console.log('Doctor upsert (' + doctorAuth.id + '): ' + (error ? error.message : 'OK'));
  }

  // Final check
  const { data: pu2 } = await s.from('platform_users').select('id, full_name, role');
  console.log('\n=== FINAL PLATFORM_USERS ===');
  (pu2 || []).forEach(u => console.log(u.id + ' | ' + u.full_name + ' | ' + u.role));

  // Test login
  console.log('\n=== LOGIN TEST ===');
  const { data: login, error: loginErr } = await s.auth.signInWithPassword({
    email: 'admin@graamswasthya.in', password: 'Admin@123'
  });
  if (loginErr) { console.log('Auth: FAIL ' + loginErr.message); return; }
  console.log('Auth: OK (id=' + login.user.id + ')');
  
  const { data: prof, error: profErr } = await s.from('platform_users')
    .select('id, full_name, role').eq('id', login.user.id).single();
  if (profErr) { console.log('Profile: FAIL ' + profErr.message); return; }
  console.log('Profile: OK (' + prof.full_name + ', ' + prof.role + ')');
  console.log('\nALL GOOD - login should work now!');
}

debug().catch(console.error);
