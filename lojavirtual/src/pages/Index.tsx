import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, ListOrdered, Settings, QrCode } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <QrCode className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">AbacatePay</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Sistema de pagamentos PIX integrado com AbacatePay
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Link to="/checkout">
            <Card className="cursor-pointer transition-shadow hover:shadow-lg">
              <CardHeader className="text-center">
                <CreditCard className="mx-auto h-12 w-12 text-primary" />
                <CardTitle>Checkout PIX</CardTitle>
                <CardDescription>Criar uma nova cobrança PIX</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Ir para Checkout</Button>
              </CardContent>
            </Card>
          </Link>

          <Link to="/orders">
            <Card className="cursor-pointer transition-shadow hover:shadow-lg">
              <CardHeader className="text-center">
                <ListOrdered className="mx-auto h-12 w-12 text-primary" />
                <CardTitle>Pedidos</CardTitle>
                <CardDescription>Acompanhar pagamentos</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">Ver Pedidos</Button>
              </CardContent>
            </Card>
          </Link>

          <Link to="/settings">
            <Card className="cursor-pointer transition-shadow hover:shadow-lg">
              <CardHeader className="text-center">
                <Settings className="mx-auto h-12 w-12 text-primary" />
                <CardTitle>Configurações</CardTitle>
                <CardDescription>API Key e Webhook</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">Configurar</Button>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
