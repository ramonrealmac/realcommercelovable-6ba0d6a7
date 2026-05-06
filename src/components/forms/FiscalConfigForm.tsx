import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Save, Search, Activity, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FiscalConfigFormValues {
  tipo_certificado: string;
  certificado: string;
  senha_certificado: string;
  ambiente_nfe: string;
  uf: string;
}

const FiscalConfigForm = () => {
  const { XEmpresaId } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [searchingCerts, setSearchingCerts] = useState(false);
  const [certificadosServidor, setCertificadosServidor] = useState<any[]>([]);
  const [modalCertOpen, setModalCertOpen] = useState(false);

  const form = useForm<FiscalConfigFormValues>({
    defaultValues: {
      tipo_certificado: "ARQUIVO",
      certificado: "",
      senha_certificado: "",
      ambiente_nfe: "2",
      uf: "SP"
    }
  });

  const tipoCertificadoAtual = form.watch("tipo_certificado");

  // Carregar dados iniciais sempre que mudar a empresa
  useEffect(() => {
    const carregarConfig = async () => {
      if (!XEmpresaId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("fiscal_config")
          .select("tipo_certificado, certificado, senha_certificado, ambiente_nfe")
          .eq("empresa_id", XEmpresaId)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          form.reset({
            tipo_certificado: data.tipo_certificado || "ARQUIVO",
            certificado: data.certificado || "",
            senha_certificado: data.senha_certificado ? atob(data.senha_certificado) : "",
            ambiente_nfe: data.ambiente_nfe || "2",
            uf: "SP" 
          });
        } else {
          // Se não houver configuração para esta empresa, reseta para os padrões
          form.reset({
            tipo_certificado: "ARQUIVO",
            certificado: "",
            senha_certificado: "",
            ambiente_nfe: "2",
            uf: "SP"
          });
        }
      } catch (err: any) {
        toast.error("Erro ao carregar configurações fiscais: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    carregarConfig();
  }, [XEmpresaId]);

  const onSubmit = async (values: FiscalConfigFormValues) => {
    if (!XEmpresaId) return;
    setLoading(true);
    try {
      // Verifica se ja existe
      const { data: existing } = await supabase
        .from("fiscal_config")
        .select("empresa_id")
        .eq("empresa_id", XEmpresaId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("fiscal_config")
          .update({
            tipo_certificado: values.tipo_certificado,
            certificado: values.certificado,
            senha_certificado: values.senha_certificado ? btoa(values.senha_certificado) : null,
            ambiente_nfe: values.ambiente_nfe
          })
          .eq("empresa_id", XEmpresaId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fiscal_config")
          .insert({
            empresa_id: XEmpresaId,
            tipo_certificado: values.tipo_certificado,
            certificado: values.certificado,
            senha_certificado: values.senha_certificado ? btoa(values.senha_certificado) : null,
            ambiente_nfe: values.ambiente_nfe
          });
        if (error) throw error;
      }
      toast.success("Configurações salvas com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const dispatchWorkerCommand = async (comando: string, payload: any): Promise<any> => {
    // Insere o comando na fila
    const { data, error } = await supabase
      .from("fiscal_evento")
      .insert({
        empresa_id: XEmpresaId,
        comando,
        payload,
        status: "PENDENTE",
        tipo: "NFE"
      })
      .select("id")
      .single();

    if (error) throw error;
    const eventoId = data.id;

    // Aguarda a resposta no Realtime
    return new Promise((resolve, reject) => {
      const channel = supabase
        .channel(`evento_${eventoId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "fiscal_evento",
            filter: `id=eq.${eventoId}`
          },
          (payload) => {
            const row = payload.new as any;
            if (row.status === "CONCLUIDO") {
              channel.unsubscribe();
              resolve(JSON.parse(row.resposta));
            } else if (row.status === "ERRO") {
              channel.unsubscribe();
              reject(new Error(row.mensagem_erro || "Erro desconhecido no worker."));
            }
          }
        )
        .subscribe();

      // Timeout de 15 segundos
      setTimeout(() => {
        channel.unsubscribe();
        reject(new Error("Timeout: O Worker não respondeu a tempo."));
      }, 15000);
    });
  };

  const buscarCertificados = async () => {
    setSearchingCerts(true);
    try {
      const comando = tipoCertificadoAtual === 'REPOSITORIO' ? "LISTAR_CERTIFICADOS_WINDOWS" : "LISTAR_CERTIFICADOS";
      const payload = tipoCertificadoAtual === 'REPOSITORIO' ? {} : { diretorio: "C:/Certificados" };
      
      console.log(`[FiscalConfig] Buscando certificados do tipo: ${tipoCertificadoAtual}...`);
      const response = await dispatchWorkerCommand(comando, payload);
      console.log(`[FiscalConfig] Resposta do Worker:`, response);
      
      if (response && response.sucesso) {
        if (tipoCertificadoAtual === 'REPOSITORIO') {
          setCertificadosServidor(response.certificados || []);
        } else {
          setCertificadosServidor(response.arquivos || []);
        }
        setModalCertOpen(true);
      } else {
        toast.error("Falha ao buscar certificados: " + (response.erro || response.mensagem || "Verifique se a pasta C:/Certificados existe no servidor."));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSearchingCerts(false);
    }
  };

  const testarSefaz = async () => {
    const values = form.getValues();
    if (!values.certificado) {
      toast.warning("Preencha o caminho ou o número de série do certificado antes de testar!");
      return;
    }
    
    if (values.tipo_certificado === 'ARQUIVO' && !values.senha_certificado) {
      toast.warning("Preencha a senha do certificado!");
      return;
    }

    setTesting(true);
    const idToast = toast.loading("Conectando à SEFAZ...");
    
    try {
      const payload = {
        config: {
          tipo_certificado: values.tipo_certificado,
          certificadoPath: values.certificado,
          certificadoSenha: values.senha_certificado, // Sends plain password to worker
          ambiente: parseInt(values.ambiente_nfe),
          uf: values.uf,
          modelo: 55
        }
      };
      
      const response = await dispatchWorkerCommand("STATUS_SERVICO", payload);
      
      if (response.sucesso) {
        toast.success("SEFAZ Online! Comunicação perfeita.", { id: idToast });
        console.log("XML Retorno:", response.status_retorno);
      }
    } catch (err: any) {
      toast.error(`Falha na SEFAZ: ${err.message}`, { id: idToast });
    } finally {
      setTesting(false);
    }
  };

  const selecionarCertificado = (path: string) => {
    form.setValue("certificado", path);
    setModalCertOpen(false);
  };

  return (
    <div className="p-6 h-full overflow-auto bg-muted/20">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuração Fiscal</h2>
          <p className="text-muted-foreground">
            Configure o certificado digital e teste a comunicação com a SEFAZ (Worker ACBr).
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Certificado Digital
                </CardTitle>
                <CardDescription>
                  Informe o caminho do certificado digital (A1) armazenado no servidor do Worker e sua senha.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipo_certificado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Certificado</FormLabel>
                        <Select onValueChange={(val) => { field.onChange(val); form.setValue("certificado", ""); form.setValue("senha_certificado", ""); }} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ARQUIVO">Arquivo Físico (.pfx)</SelectItem>
                            <SelectItem value="REPOSITORIO">Repositório do Windows</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                    <FormField
                      control={form.control}
                      name="ambiente_nfe"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ambiente SEFAZ</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o ambiente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">1 - Produção</SelectItem>
                              <SelectItem value="2">2 - Homologação</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="certificado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {tipoCertificadoAtual === 'ARQUIVO' ? "Caminho do Certificado (.pfx)" : "Número de Série do Certificado"}
                          </FormLabel>
                          <FormControl>
                            <Input placeholder={tipoCertificadoAtual === 'ARQUIVO' ? "Ex: C:\\Certificados\\empresa.pfx" : "Ex: 4A8B9C1029..."} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={buscarCertificados}
                    disabled={searchingCerts}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Buscar no {tipoCertificadoAtual === 'ARQUIVO' ? 'Servidor' : 'Windows'}
                  </Button>
                </div>

                {tipoCertificadoAtual === 'ARQUIVO' && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="senha_certificado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha do Certificado</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="****" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between items-center">
              <Button type="button" variant="outline" onClick={testarSefaz} disabled={testing}>
                <Activity className="w-4 h-4 mr-2 text-blue-500" />
                Testar Conexão SEFAZ
              </Button>
              
              <Button type="submit" disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                Salvar Configurações
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <Dialog open={modalCertOpen} onOpenChange={setModalCertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {tipoCertificadoAtual === 'REPOSITORIO' ? "Certificados no Windows" : "Arquivos no Servidor (C:/Certificados)"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] mt-4">
            {certificadosServidor.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Nenhum certificado encontrado.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {certificadosServidor.map((cert, index) => {
                  const isWindows = tipoCertificadoAtual === 'REPOSITORIO';
                  
                  // Se for arquivo, o label é o nome do arquivo. O valor é o caminho completo.
                  const label = isWindows ? cert.Subject : cert.split('/').pop()?.split('\\').pop() || cert;
                  const value = isWindows ? cert.SerialNumber : cert;
                  
                  return (
                    <Button 
                      key={index} 
                      variant="outline" 
                      className="justify-start h-auto py-3 px-4 text-left whitespace-normal flex flex-col items-start gap-1 overflow-hidden"
                      onClick={() => selecionarCertificado(value)}
                    >
                      <span className="font-medium text-sm leading-tight truncate w-full">{label}</span>
                      {isWindows && <span className="text-xs text-muted-foreground font-mono">Série: {value}</span>}
                      {!isWindows && <span className="text-[10px] text-muted-foreground font-mono truncate w-full">{cert}</span>}
                    </Button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FiscalConfigForm;
