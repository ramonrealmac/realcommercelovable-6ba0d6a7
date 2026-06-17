require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('empresa_usuario')
    .select('user_id, empresa_id, fl_excluido, profiles(id, email)')
    .eq('empresa_id', 5);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Result:", JSON.stringify(data, null, 2));
  }
}

run();
