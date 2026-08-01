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

    // Search for the report by name
    const query = `
      SELECT rpb_relatorio_id, nome, query_sql 
      FROM public.rpb_relatorio 
      WHERE nome ILIKE '%Contas a Receber%' 
         OR nome ILIKE '%Analitico%'
    `;
    const res = await client.query(query);
    console.log("Found reports:", res.rows.length);
    for (const row of res.rows) {
      console.log(`\nID: ${row.rpb_relatorio_id} | Nome: ${row.nome}`);
      console.log("Query SQL:\n", row.query_sql);
    }

  } catch (err) {
    console.error("Connection/Query Error:", err.message);
  } finally {
    await client.end();
  }
}

run();
