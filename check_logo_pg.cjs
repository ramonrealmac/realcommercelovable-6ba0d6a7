require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

async function check() {
  const url = process.env.VITE_SUPABASE_URL || '';
  const ref = url.split('//')[1].split('.')[0];
  const dbPass = process.env.SUPABASE_DB_PASSWORD;
  
  // pooler needs project reference in user or ?options=project=ref
  // standard way: postgres.[ref]:[password]@pooler...
  const client = new Client({
    connectionString: `postgresql://postgres.${ref}:${dbPass}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT empresa_id, logomarca FROM empresa WHERE empresa_id = 5');
    console.log('Result:', res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}
check();
