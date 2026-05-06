import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env");
  process.exit(1);
}

// Cria a conexão com o Supabase utilizando a Service Role Key (bypassa RLS)
export const supabase = createClient(supabaseUrl, supabaseKey);
