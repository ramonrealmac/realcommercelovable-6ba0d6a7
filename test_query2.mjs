import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://zicapdmkddpllxniupgi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY2FwZG1rZGRwbGx4bml1cGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNjE3MTYsImV4cCI6MjA5MDgzNzcxNn0.hqOi69cdFzB_G_JpWS-UvdusCKpeATSMOxci0dEas78';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('cadastro').select('cadastro_id, razao_social, excluido, st_cliente, st_cadastro, empresa_id').eq('cadastro_id', 10384);
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error("Error:", error);
}
run();
