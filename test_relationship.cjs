require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    ALTER TABLE public.fiscal_nfe_cabecalho 
    ADD CONSTRAINT fiscal_nfe_cabecalho_cadastro_id_fkey 
    FOREIGN KEY (cadastro_id) 
    REFERENCES public.cadastro(cadastro_id)
  `;
  const { data, error } = await supabase.rpc('rpb_execute_query', { p_sql: sql });
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("Successfully ran query. Result:", data);
  }
}

run();
