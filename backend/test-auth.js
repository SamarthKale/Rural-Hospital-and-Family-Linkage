require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function check() {
  const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // List auth users
  const { data: list, error: listErr } = await s.auth.admin.listUsers();
  if (listErr) { console.log('LIST ERROR:', listErr.message); return; }
  console.log('AUTH USERS:');
  list.users.forEach(u => console.log('  ' + u.email + ' | confirmed=' + !!u.email_confirmed_at));

  // Check platform_users
  const { data: pu, error: puErr } = await s.from('platform_users').select('id, full_name, role');
  console.log('\nPLATFORM_USERS: ' + (puErr ? 'ERROR: ' + puErr.message : pu.length + ' rows'));
  (pu || []).forEach(u => console.log('  ' + u.id + ' | ' + u.full_name + ' | ' + u.role));

  // Test signIn with a FRESH client
  console.log('\nLOGIN TEST (fresh client):');
  const fresh = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: login, error: loginErr } = await fresh.auth.signInWithPassword({
    email: 'admin@graamswasthya.in', password: 'Admin@123'
  });
  if (loginErr) {
    console.log('LOGIN FAIL:', loginErr.message, '| status:', loginErr.status);
  } else {
    console.log('LOGIN OK | user_id=' + login.user.id);
    // Now query platform_users with the SERVICE ROLE client (not the fresh one)
    const { data: prof, error: profErr } = await s.from('platform_users')
      .select('id, full_name, role').eq('id', login.user.id).single();
    if (profErr) console.log('PROFILE FAIL:', profErr.message);
    else console.log('PROFILE OK:', prof.full_name, '|', prof.role);
    console.log('TOKEN (first 40):', login.session.access_token.substring(0, 40));
  }
}

check().catch(e => console.log('CRASH:', e.message));
