import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('fiscal_mdf_veiculo')
    .select('*, cadastro_veiculo(descricao)')
    .limit(1);
  if (error) {
    console.error("Query failed:", error.message);
  } else {
    console.log("Query succeeded, rows:", data);
  }
}
check();
