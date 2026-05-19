import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { pedidoId, customerName, customerEmail, customerCellphone, amount, description, returnUrl, completionUrl } = body;

    // Input validation
    if (!pedidoId || !customerName || !customerEmail || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Dados obrigatórios: pedidoId, nome, email e valor" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate emovimento exists and is LINK origin
    const { data: pedido, error: pedidoErr } = await supabase
      .from("emovimento")
      .select("emovimento_id, tp_origem, st_pedido")
      .eq("emovimento_id", pedidoId)
      .single();

    if (pedidoErr || !pedido) {
      return new Response(
        JSON.stringify({ error: "Pedido não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pedido.tp_origem !== "LINK") {
      return new Response(
        JSON.stringify({ error: "Apenas pedidos do link de vendas podem usar este endpoint" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API key from parametro table
    const { data: param } = await supabase
      .from("parametro")
      .select("xabacatepay_api_key")
      .eq("excluido_visivel", false)
      .limit(1)
      .single();

    if (!param?.xabacatepay_api_key) {
      return new Response(
        JSON.stringify({ error: "Pagamento online não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = param.xabacatepay_api_key.trim();
    const isV2Key = /^abc_(prod|test|dev)_/i.test(apiKey);

    const abacateResponse = await fetch(
      isV2Key
        ? "https://api.abacatepay.com/v2/transparents/create"
        : "https://api.abacatepay.com/v1/billing/create",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isV2Key
            ? {
                method: "PIX",
                data: {
                  amount,
                  expiresIn: 3600,
                  description: description || `Pedido #${pedidoId} - Lanchonete`,
                  metadata: {
                    pedidoId: String(pedidoId),
                  },
                },
              }
            : {
                frequency: "ONE_TIME",
                methods: ["PIX"],
                products: [
                  {
                    externalId: String(pedidoId),
                    name: description || "Pedido Lanchonete",
                    quantity: 1,
                    price: amount,
                  },
                ],
                returnUrl: returnUrl || "",
                completionUrl: completionUrl || "",
                customer: {
                  name: customerName,
                  email: customerEmail,
                  cellphone: customerCellphone || "",
                  taxId: "",
                },
              }
        ),
      }
    );

    const abacateData = await abacateResponse.json();

    if (!abacateResponse.ok || abacateData?.error || !abacateData?.data) {
      console.error("AbacatePay error:", abacateData);
      const errMsg = String(abacateData?.error || "");
      const isAuthErr = /api key|unauthorized|invalid|version mismatch/i.test(errMsg);
      return new Response(
        JSON.stringify({
          error: isAuthErr
            ? "Configuração de pagamento inválida. Contate o administrador."
            : "Erro ao gerar pagamento PIX",
          detail: errMsg || undefined,
        }),
        { status: isAuthErr ? 502 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const billingData = abacateData.data || abacateData;

    // Update pedido with billing info
    const paymentUrl = billingData.url || null;
    const qrCodeImage = billingData.brCodeBase64 || null;
    const pixCode = billingData.brCode || null;

    await supabase
      .from("emovimento")
      .update({
        id_transacao_abacatepay: billingData.id,
        url_pagamento: paymentUrl || pixCode,
        qr_code_pagamento: qrCodeImage,
      })
      .eq("emovimento_id", pedidoId);

    return new Response(
      JSON.stringify({
        billingId: billingData.id,
        paymentUrl,
        pixCode,
        qrCodeImage,
        amount: billingData.amount,
        status: billingData.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
