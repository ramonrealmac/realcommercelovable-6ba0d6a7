require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'operadora_taxa' 
    ORDER BY ordinal_position
  `;
  const { data, error } = await supabase.rpc('rpb_execute_query', { p_sql: sql });
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("Successfully ran query. Result:", JSON.stringify(data, null, 2));
  }
}

run();
