import { supabase } from "./src/integrations/supabase/client";

async function test() {
  const { data, error } = await supabase
    .from("empresa_usuario")
    .select(`
      empresa_usuario_id,
      user_id,
      profiles:user_id (
        nm_usuario,
        ds_login
      )
    `)
    .limit(5);
  
  console.log("Data:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
}

test();
