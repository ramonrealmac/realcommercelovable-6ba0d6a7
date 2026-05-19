import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const rawBody = await req.text();

    // Validate webhook secret if configured
    const { data: paramRow } = await supabase
      .from("parametro")
      .select("xabacatepay_webhook_secret")
      .eq("excluido_visivel", false)
      .limit(1)
      .single();

    const secret = paramRow?.xabacatepay_webhook_secret;
    if (!secret) {
      console.error("Webhook secret not configured in parametro.xabacatepay_webhook_secret");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sigHeader = req.headers.get("x-webhook-secret") || req.headers.get("x-signature");
    if (!sigHeader || sigHeader.length !== secret.length) {
      console.error("Webhook secret missing or length mismatch");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Constant-time comparison to prevent timing attacks
    let mismatch = 0;
    for (let i = 0; i < secret.length; i++) {
      mismatch |= sigHeader.charCodeAt(i) ^ secret.charCodeAt(i);
    }
    if (mismatch !== 0) {
      console.error("Webhook secret mismatch");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = JSON.parse(rawBody);
    const { data, event } = body;

    const billingId = data?.billing?.id || data?.transparent?.id;
    const status = data?.billing?.status || data?.transparent?.status;

    if (billingId) {

      // Update legacy orders table
      if (status === "PAID" || status === "COMPLETED") {
        await supabase
          .from("orders")
          .update({ status: "PAID" })
          .eq("abacatepay_billing_id", billingId);
      } else if (status === "EXPIRED") {
        await supabase
          .from("orders")
          .update({ status: "EXPIRED" })
          .eq("abacatepay_billing_id", billingId);
      } else if (status === "CANCELLED" || status === "REFUNDED") {
        await supabase
          .from("orders")
          .update({ status: "CANCELLED" })
          .eq("abacatepay_billing_id", billingId);
      }

      // Update emovimento table — transition LINK orders to Reservado (R) when paid
      if (status === "PAID" || status === "COMPLETED" || event === "transparent.completed") {
        // Find the emovimento linked to this billing
        const { data: pedido } = await supabase
          .from("emovimento")
          .select("emovimento_id, st_pedido, vl_movimento")
          .eq("id_transacao_abacatepay", billingId)
          .eq("excluido", false)
          .single();

        if (pedido && pedido.st_pedido === "A") {
          // Transition A -> R (Reservado)
          const { error: updateErr } = await supabase
            .from("emovimento")
            .update({
              st_pedido: "R",
              dt_finalizacao: new Date().toISOString()
            })
            .eq("emovimento_id", pedido.emovimento_id);

          if (updateErr) {
            console.error("Error transitioning emovimento:", updateErr);
          } else {
            // Write to emovimento_pagamento
            const { error: pagErr } = await supabase
              .from("emovimento_pagamento")
              .insert({
                emovimento_id: pedido.emovimento_id,
                tp_pagamento: "PIX",
                vl_pagamento: pedido.vl_movimento,
                dt_pagamento: new Date().toISOString(),
                nr_autorizacao: billingId,
                condicao_id: 1, -- Cash/Immediate
                n_parcelas: 1
              });

            if (pagErr) {
              console.error("Error inserting emovimento_pagamento:", pagErr);
            } else {
              console.log(`Pedido ${pedido.emovimento_id} transitioned to R (paid via AbacatePay)`);
            }
          }
        }
      } else if (status === "EXPIRED" || status === "CANCELLED" || status === "REFUNDED" || event === "transparent.refunded") {
        const { data: pedido } = await supabase
          .from("emovimento")
          .select("emovimento_id, st_pedido")
          .eq("id_transacao_abacatepay", billingId)
          .eq("excluido", false)
          .single();

        if (pedido && pedido.st_pedido === "A") {
          await supabase
            .from("emovimento")
            .update({
              st_pedido: "C",
              dt_cancelamento: new Date().toISOString()
            })
            .eq("emovimento_id", pedido.emovimento_id);
          console.log(`Pedido ${pedido.emovimento_id} cancelled (AbacatePay ${status})`);
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
