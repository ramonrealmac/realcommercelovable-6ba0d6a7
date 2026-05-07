require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
db.from('empresa').select('*').limit(1).then(r => {
  if (r.error) {
    console.error(r.error);
  } else {
    console.log("COLUNAS EMPRESA:", Object.keys(r.data[0] || {}));
  }
}).catch(console.error);
