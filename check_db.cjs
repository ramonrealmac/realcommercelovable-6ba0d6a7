const { Client } = require('pg');

const client = new Client({
  host: 'db.zicapdmkddpllxniupgi.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'S0ftw@y2026',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected successfully!");

    // Check profiles
    const res = await client.query('SELECT id, email, nm_usuario FROM public.profiles LIMIT 5');
    console.log("Profiles:", res.rows);

    // Check empresa_usuario for empresa_id = 5
    const eu = await client.query('SELECT * FROM public.empresa_usuario WHERE empresa_id = 5 LIMIT 5');
    console.log("Empresa 5 usuarios:", eu.rows);

  } catch (err) {
    console.error("Connection/Query Error:", err.message);
  } finally {
    await client.end();
  }
}

run();
