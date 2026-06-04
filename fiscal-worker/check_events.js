import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("--- Fetching last MDF-e events ---");
  const { data: ev, error } = await supabase
    .from('fiscal_mdf_manifesto')
    .select('*')
    .eq('mdf_manifesto_id', 5)
    .maybeSingle();

  if (error) {
    console.error("Error fetching events:", error);
    return;
  }

  console.log("==========================================");
  if (!ev) {
    console.log("Manifesto ID 5 não encontrado!");
  } else {
    console.log(`Manifesto ID: ${ev.mdf_manifesto_id}`);
    console.log(`Número: ${ev.numero}`);
    console.log(`Série: ${ev.serie}`);
    console.log(`Status: ${ev.status}`);
    console.log(`Chave Acesso: ${ev.chave_acesso}`);
    console.log(`Número Protocolo: ${ev.numero_protocolo}`);
    console.log(`Código Numérico: ${ev.codigo_numerico}`);
  }
}

run();
