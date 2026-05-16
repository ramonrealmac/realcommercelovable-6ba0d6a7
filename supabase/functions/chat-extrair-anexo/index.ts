// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    const { file_base64, mime, instrucao } = await req.json();
    if (!file_base64) throw new Error("file_base64 obrigatório");

    const dataUrl = `data:${mime || "image/png"};base64,${file_base64}`;
    const isImage = (mime || "").startsWith("image/");

    const userContent: any[] = [
      {
        type: "text",
        text: `${instrucao || "Extraia em português do Brasil os dados estruturados deste documento (razão social, CNPJ/CPF, endereço, CEP, telefone, email, e — se houver — itens de produtos com quantidade e valor)."} Devolva um resumo amigável + um bloco JSON ao final.`,
      },
      isImage
        ? { type: "image_url", image_url: { url: dataUrl } }
        : { type: "text", text: `(Arquivo ${mime} em base64 — descreva o conteúdo se conseguir interpretar.)` },
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("extrair-anexo error", resp.status, txt);
      return new Response(JSON.stringify({ error: "Falha na extração" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const json = await resp.json();
    const text = json.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ texto: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
