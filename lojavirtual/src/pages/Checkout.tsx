import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { QrCode, ExternalLink, Loader2, CheckCircle2, Clock, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Checkout = () => {
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerCellphone: "",
    customerTaxId: "",
    amount: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    billingId: string;
    paymentUrl: string | null;
    pixCode?: string | null;
    qrCodeImage?: string | null;
    amount: number;
    status: string;
  } | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>("PENDING");
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const startPolling = (orderId: string) => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .single();

      if (data?.status === "PAID") {
        setOrderStatus("PAID");
        clearInterval(interval);
        toast({ title: "Pagamento confirmado! ✅" });
      }
    }, 5000);
    setPollingInterval(interval);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const amountInCents = Math.round(parseFloat(form.amount) * 100);

      // Create order in DB first
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: form.customerName,
          customer_email: form.customerEmail,
          customer_cellphone: form.customerCellphone || null,
          customer_tax_id: form.customerTaxId || null,
          amount: amountInCents,
          description: form.description || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create billing via edge function
      const { data, error } = await supabase.functions.invoke("create-billing", {
        body: {
          orderId: order.id,
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          customerCellphone: form.customerCellphone,
          customerTaxId: form.customerTaxId,
          amount: amountInCents,
          description: form.description,
          returnUrl: window.location.origin,
          completionUrl: window.location.origin + "/checkout?success=true",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.paymentUrl && !data?.pixCode && !data?.qrCodeImage) {
        throw new Error("A cobrança foi criada sem QR Code ou código PIX.");
      }

      setPaymentData(data);
      setOrderStatus("PENDING");
      startPolling(order.id);
      toast({ title: "Cobrança criada com sucesso!" });
    } catch (err: any) {
      toast({
        title: "Erro ao criar cobrança",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    setPaymentData(null);
    setOrderStatus("PENDING");
    setForm({
      customerName: "",
      customerEmail: "",
      customerCellphone: "",
      customerTaxId: "",
      amount: "",
      description: "",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-8 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Checkout PIX</h1>
            <p className="text-sm text-muted-foreground">Finalize seu pedido com pagamento PIX</p>
          </div>
        </div>

        {!paymentData ? (
          <Card>
            <CardHeader>
              <CardTitle>Dados do Pagamento</CardTitle>
              <CardDescription>Preencha os dados para gerar a cobrança PIX</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Nome completo *</Label>
                  <Input
                    id="customerName"
                    required
                    value={form.customerName}
                    onChange={(e) => handleChange("customerName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">E-mail *</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    required
                    value={form.customerEmail}
                    onChange={(e) => handleChange("customerEmail", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerCellphone">Celular</Label>
                    <Input
                      id="customerCellphone"
                      value={form.customerCellphone}
                      onChange={(e) => handleChange("customerCellphone", e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerTaxId">CPF/CNPJ</Label>
                    <Input
                      id="customerTaxId"
                      value={form.customerTaxId}
                      onChange={(e) => handleChange("customerTaxId", e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor (R$) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={form.amount}
                      onChange={(e) => handleChange("amount", e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      value={form.description}
                      onChange={(e) => handleChange("description", e.target.value)}
                      placeholder="Descrição do pedido"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando cobrança...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Gerar PIX
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center">
                {orderStatus === "PAID" ? (
                  <>
                    <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
                    <CardTitle className="text-green-600">Pagamento Confirmado!</CardTitle>
                    <CardDescription>Seu pagamento foi recebido com sucesso.</CardDescription>
                  </>
                ) : (
                  <>
                    <Clock className="mx-auto h-16 w-16 text-yellow-500 animate-pulse" />
                    <CardTitle>Aguardando Pagamento</CardTitle>
                    <CardDescription>
                      Escaneie o QR Code ou clique no link para pagar via PIX
                    </CardDescription>
                  </>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {orderStatus !== "PAID" && (
                  <>
                    <div className="flex justify-center">
                      <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 p-6">
                        <img
                          src={paymentData.qrCodeImage || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentData.pixCode || paymentData.paymentUrl || "")}`}
                          alt="QR Code PIX"
                          className="h-48 w-48"
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="mb-2 text-2xl font-bold text-foreground">
                        R$ {(paymentData.amount / 100).toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">ID: {paymentData.billingId}</p>
                    </div>
                    {paymentData.paymentUrl && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(paymentData.paymentUrl!, "_blank")}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir link de pagamento
                      </Button>
                    )}
                  </>
                )}
                <Button variant="secondary" className="w-full" onClick={resetForm}>
                  Novo Pagamento
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
