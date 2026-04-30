const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');

const DEMO_PASSWORD = 'RapidoDemo123!';
const WORKER_SERVICE_SETS = [
  [
    'flat_tire',
    'jump_start',
    'fuel_delivery',
    'towing',
    'moving_help',
    'handyman_help',
    'plumbing_help',
    'electrical_help',
    'cna_support',
    'senior_helper',
    'cleaning_help',
    'delivery_help',
    'pet_help',
    'tech_help',
    'others',
  ],
  [
    'flat_tire',
    'jump_start',
    'fuel_delivery',
    'towing',
    'moving_help',
    'handyman_help',
    'cleaning_help',
    'delivery_help',
    'pet_help',
    'tech_help',
  ],
  ['flat_tire', 'jump_start', 'fuel_delivery', 'towing'],
];
const DEMO_USERS = [
  {
    email: 'demo.customer@rapidohelp.local',
    fullName: 'Demo Customer',
    isWorker: false,
  },
  {
    email: 'demo.worker@rapidohelp.local',
    fullName: 'Demo Worker',
    isWorker: true,
  },
];

function loadRootEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
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

async function upsertAuthUser(client, demoUser) {
  const { data: usersData, error: listError } = await client.auth.admin.listUsers();
  if (listError) throw listError;

  const existingUser = usersData.users.find((user) => user.email === demoUser.email);

  if (existingUser) {
    const { data, error } = await client.auth.admin.updateUserById(existingUser.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: demoUser.fullName },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await client.auth.admin.createUser({
    email: demoUser.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: demoUser.fullName },
  });
  if (error) throw error;
  return data.user;
}

async function upsertDemoProfile(client, user, demoUser) {
  const serviceSets = demoUser.isWorker ? WORKER_SERVICE_SETS : [[]];

  for (const serviceTypes of serviceSets) {
    const profile = {
      id: user.id,
      full_name: demoUser.fullName,
      is_worker: demoUser.isWorker,
      worker_status: demoUser.isWorker ? 'online' : 'offline',
      service_types: serviceTypes,
      worker_work_details: demoUser.isWorker
        ? 'Roadside helper for flat tires, jump starts, fuel delivery, towing, and general urgent tasks.'
        : null,
      worker_experience_years: demoUser.isWorker ? 4 : null,
      worker_profile_completed: demoUser.isWorker,
    };

    const { error } = await client.from('profiles').upsert(profile).eq('id', user.id);

    if (!error) {
      return;
    }

    if (error.code !== '22P02' || !demoUser.isWorker) {
      throw error;
    }
  }
}

async function main() {
  loadRootEnv();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const demoUser of DEMO_USERS) {
    const user = await upsertAuthUser(client, demoUser);
    await upsertDemoProfile(client, user, demoUser);

    console.log(`ready:${demoUser.isWorker ? 'worker' : 'customer'}:${demoUser.email}:${DEMO_PASSWORD}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
