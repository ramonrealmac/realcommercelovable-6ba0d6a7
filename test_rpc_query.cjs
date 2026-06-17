require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    SELECT p.email, p.nm_usuario, eu.empresa_id, p.fl_autorizado 
    FROM public.profiles p
    JOIN public.empresa_usuario eu ON eu.user_id = p.id
    WHERE eu.empresa_id = 5;
  `;
  const { data, error } = await supabase.rpc('rpb_execute_query', { p_sql: sql });
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("Successfully ran query. Result:", JSON.stringify(data, null, 2));
  }
}

run();
