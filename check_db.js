import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    SELECT policyname, tablename, cmd, roles, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'cadastro_veiculo'
  `;
  const { data, error } = await supabase.rpc('rpb_execute_query', { p_sql: sql });
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("RLS policies on cadastro_veiculo:", data);
  }
}

run();
