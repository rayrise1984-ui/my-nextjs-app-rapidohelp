const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');

const DEMO_PASSWORD = 'RapidoDemo123!';
const DEMO_WORKER_EMAIL =
  process.env.SMTP_USER || process.env.DEV_WORKER_EMAIL || 'helpdesk@rapidohelp.com';
const DEMO_WORKER_PASSWORD =
  process.env.SMTP_PASS || process.env.DEV_WORKER_PASSWORD || DEMO_PASSWORD;
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
    role: 'customer',
    isWorker: false,
  },
  {
    email: DEMO_WORKER_EMAIL,
    fullName: 'Demo Worker',
    role: 'agent',
    isWorker: true,
  },
  {
    email: process.env.SMTP_ADMIN_EMAIL || 'helpdesk@rapidohelp.com',
    fullName: 'Helpdesk Admin',
    role: 'admin',
    isWorker: false,
  },
];

const WORKER_BACKGROUND_CHECK_CONSENT_VERSION = 'helper_background_check_v1';

function loadEnvFile(envPath) {
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

function loadRootEnv() {
  loadEnvFile(path.join(__dirname, '..', '.env.local'));
  loadEnvFile(path.join(__dirname, '..', '.env'));
}

async function upsertAuthUser(client, demoUser) {
  const role = demoUser.role || (demoUser.isWorker ? 'agent' : 'customer');
  const { data: usersData, error: listError } = await client.auth.admin.listUsers();
  if (listError) throw listError;

  const existingUser = usersData.users.find((user) => user.email === demoUser.email);

  if (existingUser) {
    const { data, error } = await client.auth.admin.updateUserById(existingUser.id, {
      password: demoUser.isWorker ? DEMO_WORKER_PASSWORD : DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: demoUser.fullName,
        role,
        is_worker: demoUser.isWorker,
        worker_background_check_consent: demoUser.isWorker,
        worker_background_check_consent_platform: demoUser.isWorker ? 'web' : null,
        worker_background_check_consent_version: demoUser.isWorker
          ? WORKER_BACKGROUND_CHECK_CONSENT_VERSION
          : null,
      },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await client.auth.admin.createUser({
    email: demoUser.email,
    password: demoUser.isWorker ? DEMO_WORKER_PASSWORD : DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: demoUser.fullName,
      role,
      is_worker: demoUser.isWorker,
      worker_background_check_consent: demoUser.isWorker,
      worker_background_check_consent_platform: demoUser.isWorker ? 'web' : null,
      worker_background_check_consent_version: demoUser.isWorker
        ? WORKER_BACKGROUND_CHECK_CONSENT_VERSION
        : null,
    },
  });
  if (error) throw error;
  return data.user;
}

async function upsertDemoProfile(client, user, demoUser) {
  const role = demoUser.role || (demoUser.isWorker ? 'agent' : 'customer');
  const serviceSets = demoUser.isWorker ? WORKER_SERVICE_SETS : [[]];

  for (const serviceTypes of serviceSets) {
    const profile = {
      id: user.id,
      full_name: demoUser.fullName,
      role,
      is_worker: demoUser.isWorker,
      worker_background_check_consent_at: demoUser.isWorker ? new Date().toISOString() : null,
      worker_background_check_consent_platform: demoUser.isWorker ? 'web' : null,
      worker_background_check_consent_version: demoUser.isWorker
        ? WORKER_BACKGROUND_CHECK_CONSENT_VERSION
        : null,
      worker_status: demoUser.isWorker ? 'online' : 'offline',
      service_types: serviceTypes,
      worker_work_details: demoUser.isWorker
        ? 'Roadside helper for flat tires, jump starts, fuel delivery, towing, and general urgent tasks.'
        : null,
      worker_experience_years: demoUser.isWorker ? 4 : null,
      worker_profile_completed: demoUser.role === 'admin' ? true : false,
    };

    const { error } = await client.from('profiles').upsert(profile).eq('id', user.id);

    if (!error) {
      return;
    }

    if (error.code !== '22P02' || !demoUser.isWorker) {
      throw error;
    }
  }

  if (demoUser.isWorker) {
    const { error: backgroundError } = await client.from('worker_background_checks').upsert({
      worker_id: user.id,
      legal_full_name: demoUser.fullName,
      ssn_last4: '1234',
      driver_license_number: 'D1234567',
      driver_license_state: 'CA',
      legal_address_line1: '123 Demo Worker Way',
      legal_address_line2: null,
      legal_city: 'San Francisco',
      legal_state: 'CA',
      legal_postal_code: '94107',
      payout_account_holder_name: demoUser.fullName,
      payout_bank_name: 'Demo Bank',
      payout_account_type: 'checking',
      payout_account_last4: '4321',
      payout_routing_last4: '6789',
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
    });

    if (backgroundError) {
      throw backgroundError;
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

    const passwordSource = demoUser.isWorker
      ? process.env.SMTP_PASS
        ? 'SMTP_PASS'
        : process.env.DEV_WORKER_PASSWORD
          ? 'DEV_WORKER_PASSWORD'
          : 'DEMO_PASSWORD'
      : 'DEMO_PASSWORD';

    console.log(
      `ready:${demoUser.isWorker ? 'worker' : 'customer'}:${demoUser.email} (password from ${passwordSource})`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
