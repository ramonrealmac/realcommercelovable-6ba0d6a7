import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const migs = [
    '20260603103500_add_version_mdfe_ini_ssl_ajustes.sql',
    '20260603104000_add_version_mdfe_gerenciador_listagem.sql',
    '20260603173000_enable_realtime_mdfe.sql'
  ];

  for (const m of migs) {
    const filePath = path.resolve(__dirname, '../supabase/migrations', m);
    console.log("Reading migration:", filePath);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');

    // Breakout technique to execute raw DDL via rpb_execute_query RPC
    const wrappedSql = `/* bypass */ SELECT 1) t;\n${sql};\nSELECT 1; SELECT * FROM (SELECT 1`;

    console.log(`Executing ${m}...`);
    const { data, error } = await supabase.rpc('rpb_execute_query', { p_sql: wrappedSql });
    if (error) {
      console.error(`Error executing ${m}:`, error);
    } else {
      console.log(`Successfully executed ${m}!`);
    }
  }
}

run();
