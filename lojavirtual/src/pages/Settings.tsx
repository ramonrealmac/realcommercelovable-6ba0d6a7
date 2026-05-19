import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Save, Eye, EyeOff, ArrowLeft, Copy } from "lucide-react";
import { Link } from "react-router-dom";

const SETTINGS_KEYS = [
  { key: "abacatepay_api_key", label: "API Key do AbacatePay", description: "Chave de API obtida no painel do AbacatePay", sensitive: true },
  { key: "abacatepay_webhook_secret", label: "Webhook Secret (opcional)", description: "Secret para validação de webhooks", sensitive: true },
];

const Settings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    loadSettings();
    // Build webhook URL
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (projectId) {
      setWebhookUrl(`https://${projectId}.supabase.co/functions/v1/abacatepay-webhook`);
    }
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase.from("app_settings").select("*");
    if (error) {
      toast({ title: "Erro ao carregar configurações", description: error.message, variant: "destructive" });
    } else {
      const settingsMap: Record<string, string> = {};
      data?.forEach((s) => { settingsMap[s.key] = s.value; });
      setSettings(settingsMap);
    }
    setLoading(false);
  };

  const saveSetting = async (key: string, value: string) => {
    setSaving(true);
    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("key", key)
      .single();

    let error;
    if (existing) {
      ({ error } = await supabase.from("app_settings").update({ value }).eq("key", key));
    } else {
      ({ error } = await supabase.from("app_settings").insert({ key, value }));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Salvo com sucesso!" });
    }
    setSaving(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
              <p className="text-sm text-muted-foreground">Configurações de integração com AbacatePay</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {SETTINGS_KEYS.map(({ key, label, description, sensitive }) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-lg">{label}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={sensitive && !showSecrets[key] ? "password" : "text"}
                      value={settings[key] || ""}
                      onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`Digite ${label.toLowerCase()}...`}
                    />
                    {sensitive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }))}
                      >
                        {showSecrets[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  <Button onClick={() => saveSetting(key, settings[key] || "")} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">URL do Webhook</CardTitle>
              <CardDescription>
                Configure esta URL no painel do AbacatePay para receber notificações de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                <Button variant="outline" onClick={() => copyToClipboard(webhookUrl)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
