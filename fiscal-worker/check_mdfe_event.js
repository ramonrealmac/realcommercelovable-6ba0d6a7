import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const mdfId = 10;

  console.log(`--- Checking MDF-e ID: ${mdfId} ---`);

  const { data: manifesto } = await supabase
    .from('fiscal_mdf_manifesto')
    .select('*')
    .eq('mdf_manifesto_id', mdfId)
    .maybeSingle();

  console.log("Manifesto:", manifesto);

  const { data: documentos, error: errDoc } = await supabase
    .from('fiscal_mdf_documento')
    .select('*, cidade(*)')
    .eq('mdf_manifesto_id', mdfId);

  console.log("--- Documents ---");
  if (errDoc) console.error("Error fetching documents:", errDoc);
  console.log(documentos);

  const { data: descarrega, error: errDesc } = await supabase
    .from('fiscal_mdf_descarrega')
    .select('*, cidade(*)')
    .eq('mdf_manifesto_id', mdfId);

  console.log("--- Discharge Points (Descarrega) ---");
  if (errDesc) console.error("Error fetching descarrega:", errDesc);
  console.log(descarrega);
}

run();
