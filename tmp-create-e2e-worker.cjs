const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');

function loadRootEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    process.env[key] = process.env[key] || value;
  }
}

loadRootEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = process.env.E2E_WORKER_EMAIL || 'e2e.worker@rapidohelp.local';
const password = process.env.E2E_WORKER_PASSWORD || 'Rapido123';

async function main() {
  const { data: usersData, error: listError } = await client.auth.admin.listUsers();
  if (listError) throw listError;

  let user = usersData.users.find((entry) => entry.email === email);
  if (user) {
    const { data, error } = await client.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Worker' },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Worker' },
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: profileError } = await client
    .from('profiles')
    .upsert({
      id: user.id,
      full_name: 'E2E Worker',
      is_worker: true,
      worker_status: 'online',
      service_types: ['flat_tire', 'others'],
      worker_work_details: 'Roadside helper for tire and quick checks',
      worker_experience_years: 3,
      worker_profile_completed: true,
    })
    .eq('id', user.id);

  if (profileError) throw profileError;

  console.log(`ready-worker:${user.id}:${email}:${password}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
