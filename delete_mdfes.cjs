const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteMdfes() {
  console.log("Deleting MDF-es from 5 to 95...");
  
  // First, we need to delete child records if there's no cascade delete.
  // Child tables might include: fiscal_mdf_manifesto_municipio, fiscal_mdf_manifesto_nf, fiscal_mdf_manifesto_cte, fiscal_mdf_manifesto_percurso, fiscal_mdf_manifesto_condutor, fiscal_mdf_manifesto_veiculo, fiscal_mdf_manifesto_vale_pedagio.
  
  try {
    // Delete child records first
    const { data: mdfesToDelete, error: selectError } = await supabase
      .from('fiscal_mdf_manifesto')
      .select('mdf_manifesto_id')
      .gte('numero', 5)
      .lte('numero', 95);
      
    if (selectError) {
      console.error("Error fetching MDF-es to delete:", selectError);
      return;
    }
    
    if (!mdfesToDelete || mdfesToDelete.length === 0) {
      console.log("No MDF-es found in the range 5-95.");
      return;
    }
    
    const ids = mdfesToDelete.map(m => m.mdf_manifesto_id);
    console.log(`Found ${ids.length} MDF-es to delete.`);
    
    // Attempt deleting them directly
    const { error: deleteError } = await supabase
      .from('fiscal_mdf_manifesto')
      .delete()
      .in('mdf_manifesto_id', ids);
      
    if (deleteError) {
      console.error("Error deleting MDF-es:", deleteError);
    } else {
      console.log("Successfully deleted MDF-es.");
    }
    
    // Also reset the config sequence if needed
    const { error: configError } = await supabase
      .from('config_nfe')
      .update({ n_mdfe: 5 })
      .eq('id', 1); // Assuming ID 1 or we just update all if there's only one.
      
    if (configError) {
      console.error("Error resetting config_nfe.n_mdfe:", configError);
    } else {
      console.log("Successfully reset n_mdfe sequence to 5.");
    }

  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

deleteMdfes();
