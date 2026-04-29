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
    const { audio_base64, mime } = await req.json();
    if (!audio_base64) throw new Error("audio_base64 obrigatório");

    const dataUrl = `data:${mime || "audio/webm"};base64,${audio_base64}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva o áudio a seguir em português do Brasil. Devolva APENAS o texto transcrito, sem comentários." },
              { type: "input_audio", input_audio: { data: dataUrl, format: mime?.includes("mp3") ? "mp3" : "webm" } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("transcrever error", resp.status, txt);
      return new Response(JSON.stringify({ error: "Falha na transcrição" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const json = await resp.json();
    const text = json.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ texto: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
