const { createClient } = require('@supabase/supabase-js');

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const email = 'demo.customer@rapidohelp.local';
  const { data: usersData, error: usersError } = await client.auth.admin.listUsers();
  if (usersError) throw usersError;

  const user = usersData.users.find((entry) => entry.email === email);
  if (!user) throw new Error('Demo customer not found');

  const { data, error } = await client
    .from('jobs')
    .insert({
      user_id: user.id,
      service_type: 'others',
      description: 'battery check',
      location_lat: 38.294,
      location_lng: -122.286,
      location_name: 'Downtown (38.294, -122.286)',
      estimated_price: 55,
      status: 'pending',
    })
    .select('id,description,service_type,status,created_at')
    .single();

  if (error) throw error;
  console.log(`inserted-job:${data.id}:${data.description}:${data.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
