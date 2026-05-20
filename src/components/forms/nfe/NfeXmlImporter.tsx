import React, { useRef, useState } from "react";
import { Upload, FileText, Globe, RefreshCw, Key } from "lucide-react";
import { toast } from "sonner";
import { parseNfeXml } from "./NfeXmlParser";
import type { INfeDadosXml } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { provedorService } from "@/services/provedorService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const db = supabase as any;

interface NfeXmlImporterProps {
  onImported: (dados: INfeDadosXml) => void;
  disabled?: boolean;
  empresaId?: number | string;
}

const NfeXmlImporter: React.FC<NfeXmlImporterProps> = ({ onImported, disabled, empresaId }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [chave, setChave] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileContent = (content: string) => {
    const dados = parseNfeXml(content);
    if (!dados) {
      toast.error("Não foi possível interpretar o arquivo XML. Verifique se é uma NF-e válida.");
      return;
    }
    toast.success(`NF-e ${dados.nr_nota}/${dados.serie} lida com sucesso!`);
    onImported(dados);
    setOpen(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Selecione um arquivo XML de NF-e.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      handleFileContent(content);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Selecione apenas arquivos XML de NF-e.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      handleFileContent(content);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImportarSefaz = async () => {
    const cleanChave = chave.trim();
    if (!/^\d{44}$/.test(cleanChave)) {
      toast.error("A chave de acesso da NF-e deve conter exatamente 44 dígitos numéricos.");
      return;
    }

    if (!empresaId) {
      toast.error("ID da empresa não informado. Não é possível consultar a SEFAZ.");
      return;
    }

    setLoading(true);
    try {
      // 1. Busca CNPJ e Cidade/UF da empresa
      const { data: empData, error: empErr } = await db
        .from("empresa")
        .select("cnpj, endereco_cidade_id")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (empErr || !empData) {
        throw new Error(empErr?.message || "Dados da empresa não localizados.");
      }

      const cnpj = empData.cnpj?.replace(/\D/g, "");
      if (!cnpj) {
        throw new Error("CNPJ da empresa não cadastrado.");
      }

      let uf = "35"; // Fallback SP
      if (empData.endereco_cidade_id) {
        const { data: cityData, error: cityErr } = await db
          .from("cidade")
          .select("cd_ibge")
          .eq("cidade_id", empData.endereco_cidade_id)
          .maybeSingle();

        if (!cityErr && cityData?.cd_ibge && cityData.cd_ibge.length >= 2) {
          uf = cityData.cd_ibge.substring(0, 2);
        }
      }

      // 2. Consulta prévia se a nota já existe nas tabelas locais
      // Primeiro verifica no cabeçalho das notas já escrituradas/salvas no projeto (fiscal_nfe_cabecalho)
      const { data: notaCab } = await db
        .from("fiscal_nfe_cabecalho")
        .select("nfe_cabecalho_id, xml_nf")
        .eq("chave_nfe", cleanChave)
        .eq("excluido", false)
        .maybeSingle();

      if (notaCab?.xml_nf) {
        const dados = parseNfeXml(notaCab.xml_nf);
        if (dados) {
          toast.success(`NF-e ${dados.nr_nota}/${dados.serie} carregada das notas importadas do projeto!`);
          onImported(dados);
          setOpen(false);
          setChave("");
          return;
        }
      }

      // Depois verifica se ela já foi baixada na base de dados de recebimento (fiscal_nfe_recebida)
      const { data: nfeRec } = await db
        .from("fiscal_nfe_recebida")
        .select("*")
        .eq("chave_nfe", cleanChave)
        .maybeSingle();

      // Otimização: se já temos o XML completo localmente, importa instantaneamente
      if (nfeRec?.xml_completo && nfeRec.st_download) {
        const dados = parseNfeXml(nfeRec.xml_completo);
        if (dados) {
          toast.success(`NF-e ${dados.nr_nota}/${dados.serie} carregada da base local de recebidas!`);
          onImported(dados);
          setOpen(false);
          setChave("");
          return;
        }
      }

      let manifestadoComo = nfeRec?.st_manifesto || "0";

      // 3. Tenta baixar o XML completo na SEFAZ diretamente primeiro
      toast.info("Consultando XML na SEFAZ...");
      const comando = `NFE.DistribuicaoDFePorChave(${uf}, "${cnpj}", "${cleanChave}")`;
      let resp = await provedorService.enviarComando(comando, empresaId);

      if (resp.includes("ERRO:")) {
        throw new Error(resp.replace("ERRO:", "").trim());
      }

      let parsed = provedorService.parseIni(resp);
      let baseObj = parsed?.DistribuicaoDFe || parsed;
      let key = Object.keys(baseObj || {}).find(k => {
        const doc = baseObj[k];
        if (!doc || typeof doc !== "object") return false;
        const kUpper = k.toUpperCase();
        const schemaUpper = String(doc.schema || "").toUpperCase();
        return (
          kUpper.startsWith("PROCNFE") ||
          kUpper.startsWith("RESNFE") ||
          kUpper.startsWith("RESD") ||
          schemaUpper === "PROCNFE" ||
          schemaUpper === "RESNFE"
        ) && !!(doc.xml || doc.XML || doc.Xml);
      });
      let doc = key ? baseObj[key] : null;
      let xml = doc?.XML || doc?.xml || doc?.Xml;

      // 4. Se não retornou o XML completo, oferece para realizar a Ciência da Operação
      if (!xml) {
        const confirmar = window.confirm(
          "O XML completo não foi retornado pela SEFAZ (a nota pode estar sem manifesto). Deseja realizar a 'Ciência da Operação' agora para tentar liberar o download?"
        );
        if (!confirmar) {
          setLoading(false);
          return; // Aborta
        }

        toast.info("Enviando evento de 'Ciência da Operação' para a SEFAZ...");
        const respManifesto = await provedorService.enviarManifesto(
          cleanChave,
          "210210", // Ciência da Operação
          cnpj,
          undefined,
          empresaId
        );

        if (respManifesto.includes("ERRO:")) {
          throw new Error("Erro ao manifestar na SEFAZ: " + respManifesto.replace("ERRO:", "").trim());
        }

        toast.success("Manifestação registrada com sucesso! Tentando baixar novamente...");
        manifestadoComo = "210210";

        // Aguarda 1.5 segundos para a SEFAZ propagar a liberação
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Tenta buscar o XML novamente
        resp = await provedorService.enviarComando(comando, empresaId);
        if (resp.includes("ERRO:")) {
          throw new Error(resp.replace("ERRO:", "").trim());
        }

        parsed = provedorService.parseIni(resp);
        baseObj = parsed?.DistribuicaoDFe || parsed;
        key = Object.keys(baseObj || {}).find(k => {
          const doc = baseObj[k];
          if (!doc || typeof doc !== "object") return false;
          const kUpper = k.toUpperCase();
          const schemaUpper = String(doc.schema || "").toUpperCase();
          return (
            kUpper.startsWith("PROCNFE") ||
            kUpper.startsWith("RESNFE") ||
            kUpper.startsWith("RESD") ||
            schemaUpper === "PROCNFE" ||
            schemaUpper === "RESNFE"
          ) && !!(doc.xml || doc.XML || doc.Xml);
        });
        doc = key ? baseObj[key] : null;
        xml = doc?.XML || doc?.xml || doc?.Xml;

        if (!xml) {
          throw new Error("XML completo ainda não disponível. A SEFAZ pode demorar alguns minutos para processar o manifesto. Tente novamente em breve.");
        }
      }

      // 5. Efetua o parse do XML
      const dados = parseNfeXml(xml);
      if (!dados) {
        throw new Error("Não foi possível interpretar o XML retornado da SEFAZ.");
      }

      // 6. Salva ou atualiza a nota na tabela `fiscal_nfe_recebida`
      const payload = {
        empresa_id: Number(empresaId),
        chave_nfe: dados.chave_nfe,
        cnpj_emitente: dados.emitente.cnpj,
        nm_emitente: dados.emitente.razao_social,
        dt_emissao: dados.dt_emissao,
        vl_total: dados.vl_total_nf,
        nr_nota: dados.nr_nota,
        serie: dados.serie,
        st_download: true,
        st_manifesto: manifestadoComo,
        xml_completo: xml,
        xml_resumo: JSON.stringify({
          chNFe: dados.chave_nfe,
          CNPJ: dados.emitente.cnpj,
          xNome: dados.emitente.razao_social,
          dEmi: dados.dt_emissao,
          vNF: dados.vl_total_nf
        }),
        updated_at: new Date().toISOString()
      };

      const { error: dbErr } = await db.from("fiscal_nfe_recebida").upsert(payload, { onConflict: "chave_nfe" });
      if (dbErr) {
        console.error("Erro ao salvar XML em fiscal_nfe_recebida:", dbErr);
      }

      toast.success(`NF-e ${dados.nr_nota}/${dados.serie} importada da SEFAZ com sucesso!`);
      onImported(dados);
      setOpen(false);
      setChave("");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro na importação SEFAZ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !loading && setOpen(val)}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold border border-border rounded bg-card hover:bg-accent text-card-foreground disabled:opacity-50 transition-all uppercase shadow-sm duration-200 active:scale-95"
          title="Importar XML de NF-e"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Importar XML</span>
          <FileText className="w-4 h-4 sm:hidden" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md p-6 bg-card border border-border rounded-xl shadow-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
            <FileText className="w-5 h-5 text-primary animate-pulse" />
            Importar Nota Fiscal Eletrônica (NF-e)
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="arquivo" className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-6 bg-muted/50 p-1 rounded-lg border border-border">
            <TabsTrigger 
              value="arquivo" 
              className="text-xs font-bold uppercase transition-all rounded-md data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm py-2"
            >
              Arquivo XML
            </TabsTrigger>
            <TabsTrigger 
              value="sefaz"
              className="text-xs font-bold uppercase transition-all rounded-md data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm py-2"
            >
              Chave SEFAZ
            </TabsTrigger>
          </TabsList>

          <TabsContent value="arquivo" className="focus-visible:outline-none">
            <input
              ref={inputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleFile}
            />
            
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group active:scale-[0.98] ${
                dragActive 
                  ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.1)]" 
                  : "border-border hover:border-primary/50 hover:bg-accent/40"
              }`}
            >
              <div className="p-4 bg-primary/10 rounded-full text-primary group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Selecione ou arraste o arquivo XML</p>
                <p className="text-xs text-muted-foreground mt-1">Apenas arquivos .xml de NF-e</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sefaz" className="space-y-4 focus-visible:outline-none">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Chave de Acesso da NF-e (44 dígitos)
              </label>
              <div className="relative flex items-center">
                <Key className="absolute left-3 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  maxLength={44}
                  placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                  value={chave}
                  disabled={loading}
                  onChange={e => setChave(e.target.value.replace(/\D/g, ""))}
                  className="w-full border border-border focus:border-primary/60 focus:ring-1 focus:ring-primary/40 rounded-lg pl-9 pr-12 py-2.5 text-sm font-mono tracking-wider transition-all bg-card/50 text-foreground outline-none shadow-inner"
                />
                <span className="absolute right-3 text-[10px] text-muted-foreground font-mono font-bold">
                  {chave.length}/44
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                Nota: Para consultar na SEFAZ, o certificado digital correspondente ao CNPJ da empresa logada deve estar devidamente configurado e ativo.
              </p>
            </div>

            <button
              type="button"
              disabled={loading || chave.length !== 44}
              onClick={handleImportarSefaz}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-xs uppercase tracking-wider hover:bg-primary/95 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 disabled:pointer-events-none transition-all shadow-md duration-200"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Consultando SEFAZ...
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  Importar da SEFAZ
                </>
              )}
            </button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default NfeXmlImporter;
