import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Terminal, Send, Activity, Settings2 } from "lucide-react";

const ProvedorTestForm: React.FC = () => {
  const [config, setConfig] = useState({
    ip: "localhost",
    port: "3001", // Porta da ponte
    mode: "bridge" as "direct" | "bridge"
  });
  const [command, setCommand] = useState("NFE.StatusServico()");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    setResponse("Enviando comando...");
    
    try {
      const url = `http://${config.ip}:${config.port}${config.mode === 'direct' ? '/cmd' : ''}`;
      
      const res = await fetch(url, {
        method: "POST",
        mode: "cors",
        body: command,
        headers: {
          "Content-Type": "text/plain",
        },
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const text = await res.text();
      setResponse(text);
      toast.success("Comando executado com sucesso!");
    } catch (error: any) {
      console.error("Erro Provedor:", error);
      setResponse(`Erro de Comunicação:\n${error.message}\n\nCertifique-se que:\n1. O script 'provedor-bridge.cjs' está rodando (node provedor-bridge.cjs).\n2. O Monitor está aberto na porta 3434.\n3. A porta no formulário (${config.port}) é a mesma do script da ponte.`);
      toast.error("Falha na comunicação com o Provedor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Activity className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Teste de Comunicação com o Provedor</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-md border-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Configuração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Modo de Conexão</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={config.mode === "bridge" ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setConfig(p => ({ ...p, mode: "bridge", port: "3001" }))}
                  className="text-[10px]"
                >
                  Ponte (TCP)
                </Button>
                <Button 
                  variant={config.mode === "direct" ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setConfig(p => ({ ...p, mode: "direct", port: "8080" }))}
                  className="text-[10px]"
                >
                  Direto (HTTP)
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip">Endereço IP</Label>
              <Input 
                id="ip" 
                value={config.ip} 
                onChange={e => setConfig(prev => ({ ...prev, ip: e.target.value }))} 
                placeholder="Ex: localhost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Porta {config.mode === 'bridge' ? 'da Ponte' : 'HTTP'}</Label>
              <Input 
                id="port" 
                value={config.port} 
                onChange={e => setConfig(prev => ({ ...prev, port: e.target.value }))} 
                placeholder={config.mode === 'bridge' ? "3001" : "8080"}
              />
            </div>
            <div className="pt-2">
              <p className="text-[10px] text-muted-foreground bg-secondary p-2 rounded">
                {config.mode === 'bridge' ? 
                  "Modo Ponte: Use o script provedor-bridge.cjs para converter HTTP em TCP." :
                  "Modo Direto: Requer Servidor HTTP ativo no Provedor."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-lg border-primary/20">
          <CardHeader className="pb-3 bg-primary/5">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Console de Comandos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="command">Comando</Label>
              <div className="flex gap-2">
                <Input 
                  id="command" 
                  value={command} 
                  onChange={e => setCommand(e.target.value)} 
                  placeholder="Ex: NFE.StatusServico()"
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend} disabled={loading}>
                  {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Resposta do Provedor</Label>
              <Textarea 
                readOnly 
                value={response} 
                className="font-mono text-xs h-[300px] bg-slate-950 text-emerald-400 border-none resize-none focus-visible:ring-0"
                placeholder="Aguardando resposta..."
              />
            </div>

            <div className="flex gap-2">
              {["NFE.StatusServico()", "NFE.Ativo()", "BOLETO.Ativo()"].map(cmd => (
                <Button 
                  key={cmd} 
                  variant="outline" 
                  size="sm" 
                  className="text-[10px]"
                  onClick={() => setCommand(cmd)}
                >
                  {cmd}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProvedorTestForm;
