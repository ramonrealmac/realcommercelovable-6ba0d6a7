import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Save, Search, Activity, ShieldCheck, Terminal, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import MonitorFiscalLogDialog from "./MonitorFiscalLogDialog";
import ClienteSearchDialog, { IClienteRow } from "./pedido/ClienteSearchDialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import FiscalConfigItemGrid from "./FiscalConfigItemGrid";

interface FiscalConfigFormValues {
  tipo_certificado: string;
  certificado: string;
  senha_certificado: string;
  ambiente_nfe: string;
  uf: string;
  cliente_padrao_id: number | null;
  cliente_padrao_nome: string;
  email_smtp_host: string;
  email_smtp_port: number;
  email_smtp_user: string;
  email_smtp_pass: string;
  email_smtp_ssl: boolean;
  email_smtp_tls: boolean;
  email_assunto_nfe: string;
  email_corpo_nfe: string;
  pasta_arquivos_fiscais: string;
}

const FiscalConfigForm = () => {
  const { XEmpresaId } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [searchingCerts, setSearchingCerts] = useState(false);
  const [certificadosServidor, setCertificadosServidor] = useState<any[]>([]);
  const [modalCertOpen, setModalCertOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [clienteSearchOpen, setClienteSearchOpen] = useState(false);

  const form = useForm<FiscalConfigFormValues>({
    defaultValues: {
      tipo_certificado: "ARQUIVO",
      certificado: "",
      senha_certificado: "",
      ambiente_nfe: "2",
      uf: "SP",
      cliente_padrao_id: null,
      cliente_padrao_nome: "Não definido (Consumidor)",
      email_smtp_host: "",
      email_smtp_port: 587,
      email_smtp_user: "",
      email_smtp_pass: "",
      email_smtp_ssl: false,
      email_smtp_tls: true,
      email_assunto_nfe: "NF-e emitida: [CHAVE]",
      email_corpo_nfe: "Olá, segue em anexo a NF-e e o DANFE referente à sua compra.",
      pasta_arquivos_fiscais: ""
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
          .select(`
            tipo_certificado, certificado, senha_certificado, ambiente_nfe, cliente_padrao_id,
            email_smtp_host, email_smtp_port, email_smtp_user, email_smtp_pass, 
            email_smtp_ssl, email_smtp_tls, email_assunto_nfe, email_corpo_nfe,
            pasta_arquivos_fiscais
          `)
          .eq("empresa_id", XEmpresaId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          form.reset({
            tipo_certificado: data.tipo_certificado || "ARQUIVO",
            certificado: data.certificado || "",
            senha_certificado: data.senha_certificado ? atob(data.senha_certificado) : "",
            ambiente_nfe: data.ambiente_nfe || "2",
            uf: "SP",
            cliente_padrao_id: data.cliente_padrao_id || null,
            cliente_padrao_nome: "Carregando...",
            email_smtp_host: data.email_smtp_host || "",
            email_smtp_port: data.email_smtp_port || 587,
            email_smtp_user: data.email_smtp_user || "",
            email_smtp_pass: data.email_smtp_pass || "",
            email_smtp_ssl: !!data.email_smtp_ssl,
            email_smtp_tls: !!data.email_smtp_tls,
            email_assunto_nfe: data.email_assunto_nfe || "NF-e emitida: [CHAVE]",
            email_corpo_nfe: data.email_corpo_nfe || "Olá, segue em anexo a NF-e e o DANFE referente à sua compra.",
            pasta_arquivos_fiscais: (data as any).pasta_arquivos_fiscais || ""
          });

          if (data.cliente_padrao_id) {
            const { data: cliente } = await supabase
              .from("cadastro")
              .select("razao_social, nome_fantasia")
              .eq("cadastro_id", data.cliente_padrao_id)
              .maybeSingle();
            if (cliente) {
              form.setValue("cliente_padrao_nome", (cliente as any).nome_fantasia || (cliente as any).razao_social);
            }
          } else {
            form.setValue("cliente_padrao_nome", "Não definido (Consumidor)");
          }
        } else {
          // Se não houver configuração para esta empresa, reseta para os padrões
          form.reset({
            tipo_certificado: "ARQUIVO",
            certificado: "",
            senha_certificado: "",
            ambiente_nfe: "2",
            uf: "SP",
            cliente_padrao_id: null,
            cliente_padrao_nome: "Não definido (Consumidor)",
            email_smtp_host: "",
            email_smtp_port: 587,
            email_smtp_user: "",
            email_smtp_pass: "",
            email_smtp_ssl: false,
            email_smtp_tls: true,
            email_assunto_nfe: "NF-e emitida: [CHAVE]",
            email_corpo_nfe: "Olá, segue em anexo a NF-e e o DANFE referente à sua compra.",
            pasta_arquivos_fiscais: ""
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

      const payload = {
        tipo_certificado: values.tipo_certificado,
        certificado: values.certificado,
        senha_certificado: values.senha_certificado ? btoa(values.senha_certificado) : null,
        ambiente_nfe: values.ambiente_nfe,
        cliente_padrao_id: values.cliente_padrao_id,
        email_smtp_host: values.email_smtp_host,
        email_smtp_port: values.email_smtp_port,
        email_smtp_user: values.email_smtp_user,
        email_smtp_pass: values.email_smtp_pass,
        email_smtp_ssl: values.email_smtp_ssl,
        email_smtp_tls: values.email_smtp_tls,
        email_assunto_nfe: values.email_assunto_nfe,
        email_corpo_nfe: values.email_corpo_nfe,
        pasta_arquivos_fiscais: values.pasta_arquivos_fiscais || null
      };

      if (existing) {
        const { error } = await supabase
          .from("fiscal_config")
          .update(payload)
          .eq("empresa_id", XEmpresaId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fiscal_config")
          .insert({
            empresa_id: XEmpresaId,
            ...payload
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

        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="dados">Dados Principais</TabsTrigger>
            <TabsTrigger value="email">Envio de E-mail</TabsTrigger>
            <TabsTrigger value="modelos">Modelos e Sequenciais</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      Certificado Digital
                    </CardTitle>
                    <CardDescription>
                      Informe o caminho do certificado digital (A1) e o ambiente de emissão.
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

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">Configurações de PDV</CardTitle>
                    <CardDescription>Defina o cliente padrão para vendas rápidas no PDV.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label>Cliente Padrão do PDV</Label>
                        <Input readOnly value={form.watch("cliente_padrao_nome")} className="bg-muted/50" />
                      </div>
                      <Button type="button" variant="outline" onClick={() => setClienteSearchOpen(true)}>
                        <Search className="w-4 h-4 mr-2" />
                        Selecionar
                      </Button>
                      {form.watch("cliente_padrao_id") && (
                        <Button type="button" variant="ghost" className="text-destructive" onClick={() => {
                          form.setValue("cliente_padrao_id", null);
                          form.setValue("cliente_padrao_nome", "Não definido (Consumidor)");
                        }}>Limpar</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={testarSefaz} disabled={testing}>
                      <Activity className="w-4 h-4 mr-2 text-blue-500" />
                      Testar Conexão SEFAZ
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setLogOpen(true)} className="gap-2">
                      <Terminal className="w-4 h-4" />
                      Ver Log
                    </Button>
                  </div>
                  
                  <Button type="submit" disabled={loading} className="px-8">
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Configurações
                  </Button>
                </div>
              </form>
            </Form>

            <ClienteSearchDialog 
              open={clienteSearchOpen}
              onClose={() => setClienteSearchOpen(false)}
              empresaId={XEmpresaId || 0}
              onSelect={(c) => {
                form.setValue("cliente_padrao_id", c.cadastro_id);
                form.setValue("cliente_padrao_nome", c.nome_fantasia || c.razao_social);
                setClienteSearchOpen(false);
              }}
            />
          </TabsContent>

          <TabsContent value="email" className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-primary" />
                      Servidor de E-mail (SMTP)
                    </CardTitle>
                    <CardDescription>
                      Configure os dados do servidor para envio automático de DANFE e XML para os clientes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email_smtp_host"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Servidor SMTP</FormLabel>
                            <FormControl>
                              <Input placeholder="ex: smtp.gmail.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email_smtp_port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Porta</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email_smtp_user"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Usuário / E-mail</FormLabel>
                            <FormControl>
                              <Input placeholder="seu-email@dominio.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email_smtp_pass"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="****" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center gap-8 py-2">
                      <FormField
                        control={form.control}
                        name="email_smtp_ssl"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-4">
                            <div className="space-y-0.5">
                              <FormLabel>Usar SSL</FormLabel>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email_smtp_tls"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-4">
                            <div className="space-y-0.5">
                              <FormLabel>Usar TLS</FormLabel>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="email_assunto_nfe"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assunto Padrão (NF-e)</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Nota Fiscal Eletrônica [CHAVE]" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email_corpo_nfe"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mensagem Padrão (Corpo do E-mail)</FormLabel>
                          <FormControl>
                            <Textarea rows={4} placeholder="Olá, segue sua nota..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <div className="flex justify-end bg-card p-4 rounded-lg border shadow-sm">
                  <Button type="submit" disabled={loading} className="px-8">
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Configurações de E-mail
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="modelos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Modelos e Sequenciais</CardTitle>
                <CardDescription>
                  Configure as séries e números sequenciais para cada modelo de nota fiscal (NFe e NFCe).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FiscalConfigItemGrid XEmpresaId={Number(XEmpresaId)} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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

        <MonitorFiscalLogDialog
          isOpen={logOpen}
          onClose={() => setLogOpen(false)}
          empresaId={XEmpresaId}
        />
      </div>
    </div>
  );
};

export default FiscalConfigForm;
