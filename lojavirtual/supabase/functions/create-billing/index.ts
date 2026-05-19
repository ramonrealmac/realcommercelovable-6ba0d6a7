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

    // Validate JWT via getClaims
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API key from app_settings
    const { data: apiKeySetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "abacatepay_api_key")
      .single();

    if (!apiKeySetting?.value) {
      return new Response(
        JSON.stringify({ error: "API key do AbacatePay não configurada. Vá em Configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { orderId, customerName, customerEmail, customerCellphone, customerTaxId, amount, description, returnUrl, completionUrl } = body;

    // Input validation
    if (!customerName || !customerEmail || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Dados obrigatórios: nome, email e valor" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = apiKeySetting.value.trim();
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
                  description: description || "Pedido",
                  metadata: {
                    orderId: orderId || "order",
                  },
                },
              }
            : {
                frequency: "ONE_TIME",
                methods: ["PIX"],
                products: [
                  {
                    externalId: orderId || "order",
                    name: description || "Pedido",
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
                  taxId: customerTaxId || "",
                },
              }
        ),
      }
    );

    const abacateData = await abacateResponse.json();

    if (!abacateResponse.ok || abacateData?.error || !abacateData?.data) {
      console.error("AbacatePay error:", abacateData);
      const errMsg = String(abacateData?.error || "");
      return new Response(
        JSON.stringify({
          error: /api key|unauthorized|invalid|version mismatch/i.test(errMsg)
            ? "Configuração de pagamento inválida. Contate o administrador."
            : "Erro ao criar cobrança no AbacatePay",
          detail: errMsg || undefined,
        }),
        { status: /api key|unauthorized|invalid|version mismatch/i.test(errMsg) ? 502 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const billingData = abacateData.data || abacateData;

    // Update or create order in database
    if (orderId) {
      await supabase
        .from("orders")
        .update({
          abacatepay_billing_id: billingData.id,
          abacatepay_payment_url: billingData.url || billingData.brCode || null,
        })
        .eq("id", orderId);
    }

    return new Response(
      JSON.stringify({
        billingId: billingData.id,
        paymentUrl: billingData.url || null,
        pixCode: billingData.brCode || null,
        qrCodeImage: billingData.brCodeBase64 || null,
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
