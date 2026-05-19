import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { provedorService } from "@/services/provedorService";
import { RefreshCw, Download, CheckCircle, AlertTriangle, ShieldCheck, ShieldAlert, FileSearch, Eye, Terminal, Target } from "lucide-react";
import { formatCPFCNPJ } from "@/lib/validators";
import MonitorFiscalLogDialog from "../fiscal/MonitorFiscalLogDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const db = supabase as any;

const XGridCols: IGridColumn[] = [
  { key: "nr_nota", label: "Nota", width: "100px" },
  { key: "serie", label: "Série", width: "60px", align: "center" },
  { key: "dt_emissao", label: "Emissão", width: "110px", render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
  { key: "nm_emitente", label: "Emitente", width: "2fr" },
  { key: "cnpj_emitente", label: "CNPJ Emitente", width: "150px", render: r => formatCPFCNPJ(r.cnpj_emitente) },
  { key: "vl_total", label: "Valor", width: "120px", align: "right", render: r => Number(r.vl_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
  { 
    key: "st_nf", 
    label: "Status", 
    width: "180px", 
    render: r => {
      const labels: any = {
        "0": "Pendente",
        "210200": "Confirmada",
        "210210": "Ciência",
        "210220": "Desconhecida",
        "210240": "Não Realizada"
      };
      const stManif = labels[r.st_manifesto] || r.st_manifesto;
      const stDownload = r.st_download ? " (XML OK)" : " (Sem XML)";
      
      return (
        <div className="flex flex-col gap-1">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase text-center ${
            r.st_manifesto === "210200" ? "bg-green-100 text-green-700" :
            r.st_manifesto === "210210" ? "bg-blue-100 text-blue-700" :
            r.st_manifesto === "0" ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-700"
          }`}>
            {stManif}
          </span>
          <span className={`text-[9px] text-center font-medium ${r.st_download ? "text-green-600" : "text-amber-600"}`}>
            {stDownload}
          </span>
        </div>
      );
    }
  },
];

const NfeRecebidasForm: React.FC = () => {
  // Sincronização Estabilizada: 2026-05-06 18:43
  const { XEmpresaId } = useAppContext();
  const [XData, setXData] = useState<any[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XCNPJ, setXCNPJ] = useState("");
  const [XUF, setXUF] = useState(""); 
  const [XDtIni, setXDtIni] = useState(new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().substring(0, 10));
  const [XDtFim, setXDtFim] = useState(new Date().toISOString().substring(0, 10));
  const [XStatusFilter, setXStatusFilter] = useState("");
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XLogOpen, setXLogOpen] = useState(false);
  const [XMaxLoops, setXMaxLoops] = useState(10);
  const [XAlertOpen, setXAlertOpen] = useState(false);
  const [XAlertMsg, setXAlertMsg] = useState("");
  const [XManifOpen, setXManifOpen] = useState(false);
  const [XSelectedNfe, setXSelectedNfe] = useState<any>(null);
  const [XManifTipo, setXManifTipo] = useState("");
  const [XJustificativa, setXJustificativa] = useState("");

  const handleOpenManif = (row: any, tipo: string) => {
    setXSelectedNfe(row);
    setXManifTipo(tipo);
    setXJustificativa("");
    if (tipo === "210240") {
      setXManifOpen(true);
    } else {
      handleConfirmarManifesto(row, tipo);
    }
  };

  const handleConfirmarManifesto = async (row: any, tipo: string, just?: string) => {
    if (!just && tipo === "210240") {
      toast.error("Justificativa obrigatória para esta operação.");
      return;
    }
    
    const labels: any = { 
      "210200": "Confirmação da Operação", 
      "210210": "Ciência da Operação", 
      "210220": "Desconhecimento da Operação", 
      "210240": "Operação não Realizada" 
    };

    if (!confirm(`Confirma o envio da manifestação "${labels[tipo]}"?`)) return;
    
    setXLoading(true);
    try {
      const resp = await provedorService.enviarManifesto(row.chave_nfe, tipo, XCNPJ, just, XEmpresaId);
      await registrarLog(`Manifesto(${tipo}) - ${row.chave_nfe}`, resp, 0, 0, row.nfe_recebida_id);
      
      if (resp.includes("ERRO:")) {
        throw new Error(resp.replace("ERRO:", "").trim());
      }

      // Atualiza status localmente
      const { error } = await db.from("fiscal_nfe_recebida")
        .update({ st_manifesto: tipo, updated_at: new Date().toISOString() })
        .eq("nfe_recebida_id", row.nfe_recebida_id);

      if (error) throw error;
      toast.success("Manifesto enviado com sucesso!");
      setXManifOpen(false);
      loadData();
    } catch (e: any) {
      toast.error("Erro ao manifestar: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const registrarLog = async (comando: string, resposta: string, ultNsu?: any, maxNsu?: any, nfeId?: any) => {
    try {
      const u = Number(ultNsu || 0);
      const m = Number(maxNsu || 0);
      
      // 1. Atualiza o sequencial oficial do sistema para a próxima sincronização
      const records = [];
      if (u > 0) {
        records.push({ empresa_id: XEmpresaId, tabela: "fiscal_evento", nm_campo1: "ultNSU", nm_campo2: "", ult_seq: u });
      }
      if (m > 0) {
        records.push({ empresa_id: XEmpresaId, tabela: "fiscal_evento", nm_campo1: "maxNSU", nm_campo2: "", ult_seq: m });
      }

      for (const record of records) {
        const { data: existing } = await db.from("sys_sequencial")
          .select("ult_seq")
          .eq("empresa_id", record.empresa_id)
          .eq("tabela", record.tabela)
          .eq("nm_campo1", record.nm_campo1)
          .eq("nm_campo2", record.nm_campo2)
          .maybeSingle();

        if (existing) {
          await db.from("sys_sequencial")
            .update({ ult_seq: record.ult_seq })
            .eq("empresa_id", record.empresa_id)
            .eq("tabela", record.tabela)
            .eq("nm_campo1", record.nm_campo1)
            .eq("nm_campo2", record.nm_campo2);
        } else {
          await db.from("sys_sequencial").insert(record);
        }
      }

      // 2. Mantém compatibilidade com a tabela de log antiga se necessário, 
      // mas o foco agora é a fiscal_evento que o enviarComando já preencheu.
      // Vou apenas logar no console que o NSU avançou.
      console.log(`[NSU] Avançou para ${u}. Próxima consulta usará este valor.`);
      
    } catch (e) {
      console.error("Exceção ao registrar log MonitorFiscal:", e);
    }
  };

  const XFilteredData = XData.filter(row => {
    // Local data grid filters (colunas)
    for (const [key, val] of Object.entries(XSearchFilters)) {
      if (!val) continue;
      const rowVal = String(row[key] || "").toLowerCase();
      if (!rowVal.includes(val.toLowerCase())) return false;
    }
    // Filtro de Status (cliente)
    if (XStatusFilter && row.st_manifesto !== XStatusFilter) return false;
    return true;
  });

  const loadData = async () => {
    if (!XEmpresaId) {
      console.warn("loadData cancelado: XEmpresaId não definido.");
      return;
    }
    setXLoading(true);
    try {
      let query = db.from("fiscal_nfe_recebida")
        .select("*")
        .eq("empresa_id", XEmpresaId);

      if (XDtIni) query = query.gte("dt_emissao", XDtIni);
      if (XDtFim) query = query.lte("dt_emissao", XDtFim);

      const { data, error } = await query.order("dt_emissao", { ascending: false });

      if (error) throw error;
      console.log(`[NFe] ${data?.length || 0} registros (empresa ${XEmpresaId}, ${XDtIni} → ${XDtFim})`);
      setXData(data || []);
    } catch (e: any) {
      console.error("Erro ao carregar NF-e:", e);
      toast.error("Erro ao carregar dados: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  useEffect(() => {
    if (XEmpresaId) {
      // Busca CNPJ e UF da empresa atual
      db.from("empresa")
        .select("*")
        .eq("empresa_id", XEmpresaId)
        .maybeSingle()
        .then(async ({ data, error }: any) => {
          if (error) {
            console.error("Erro ao buscar dados da empresa:", error);
            return;
          }
          
          if (data?.cnpj) {
            const cleanCnpj = data.cnpj.replace(/\D/g, "");
            setXCNPJ(cleanCnpj);
          }

          // Busca a UF da cidade pelo Código IBGE (2 primeiros dígitos)
          setXUF(""); // Reset UF
          if (data?.endereco_cidade_id) {
            const { data: cityData } = await db.from("cidade")
              .select("cd_ibge, descricao")
              .eq("cidade_id", data.endereco_cidade_id)
              .maybeSingle();
            
            if (cityData?.cd_ibge && cityData.cd_ibge.length >= 2) {
              const code = cityData.cd_ibge.substring(0, 2);
              setXUF(code);
            } else {
              toast.error(`Cidade vinculada (${cityData?.descricao || data.endereco_cidade_id}) não possui Código IBGE válido. Verifique o cadastro de cidades.`);
            }
          } else {
            toast.error("Empresa sem cidade vinculada no cadastro. Não será possível sincronizar NF-e.");
          }

          // Busca configuração fiscal da empresa
          const { data: fiscalData } = await db.from("fiscal_config")
            .select("dfe_maxnsu_busca")
            .eq("empresa_id", XEmpresaId)
            .maybeSingle();
          
          if (fiscalData?.dfe_maxnsu_busca) {
            setXMaxLoops(Number(fiscalData.dfe_maxnsu_busca));
            console.log(`[Config] max_nsu_busca configurado para ${fiscalData.dfe_maxnsu_busca} loops.`);
          }
        });
      
      loadData();
    }
  }, [XEmpresaId]);

  const handleSincronizar = async (forceStart: boolean = false) => {
    if (!XCNPJ) { toast.error("CNPJ não informado."); return; }
    setXLoading(true);
    
    let currentNSU = "0";
    let hasMore = true;
    let totalNovos = 0;
    let loopCount = 0;

    try {
      // 1. Busca o Último NSU sincronizado no banco
      if (!forceStart) {
        const currentId = Number(XEmpresaId || 0);
        console.log(`[Sinc] Buscando último NSU salvo para empresa ${currentId}...`);
        
        const { data: seqData, error: seqErr } = await db
          .from("sys_sequencial")
          .select("ult_seq")
          .eq("empresa_id", currentId)
          .eq("tabela", "fiscal_evento")
          .eq("nm_campo1", "ultNSU")
          .eq("nm_campo2", "")
          .maybeSingle();
          
        if (!seqErr && seqData && seqData.ult_seq) {
          currentNSU = String(seqData.ult_seq);
          console.log(`[Sinc] Retomando sincronização a partir do NSU: ${currentNSU}`);
        } else {
          console.log(`[Sinc] Nenhum NSU anterior encontrado. Iniciando do zero.`);
        }
      } else {
         console.log(`[Sinc] Sincronização manual forçada do zero.`);
      }

      // 2. Loop de Sincronização (Lotes de 50)
      while (hasMore && loopCount < XMaxLoops) {
        loopCount++;
        
        if (!XUF) {
          toast.error("UF não identificada. Verifique o Código IBGE da cidade no cadastro da empresa.");
          setXLoading(false);
          return;
        }
        const sendUF = XUF;
        const comando = `NFE.DistribuicaoDFePorUltNSU(${sendUF}, "${XCNPJ}", "${currentNSU}")`;
        let resp = "";
        
        try {
          resp = await provedorService.enviarComando(comando, XEmpresaId);
          
          if (resp.includes("ERRO:")) {
            const errorMsg = resp.replace("ERRO:", "").trim();
            await registrarLog(comando, resp, 0, 0); // Log error without advancing NSU
            
            if (errorMsg.includes("640") || errorMsg.includes("superior ao maior NSU")) {
              if (confirm("O NSU local está à frente da SEFAZ. Deseja reiniciar a sincronização do zero?")) {
                setXLoading(false);
                handleSincronizar(true);
                return;
              }
              break;
            }
            if (errorMsg.includes("656") || errorMsg.includes("Consumo Indevido")) {
              setXAlertMsg("Consumo Indevido na SEFAZ. Aguarde alguns minutos ou uma hora para tentar novamente.");
              setXAlertOpen(true);
              break;
            }
            throw new Error(errorMsg);
          }

          const parsed = provedorService.parseIni(resp);
          const dfeInfo = parsed.DistribuicaoDFe || parsed; // JSON can sometimes be the root object

          if (!dfeInfo || (!dfeInfo.cStat && !dfeInfo.CStat)) {
            await registrarLog(comando, resp, 0, 0);
            break;
          }

          // Normaliza os dados do DFE (suporta INI e JSON com diferentes cases)
          const getVal = (obj: any, keys: string[]) => {
            for (const k of keys) {
              if (obj[k] !== undefined) return obj[k];
              // Tenta case-insensitive
              const foundK = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
              if (foundK) return obj[foundK];
            }
            return null;
          };

          const cStat = String(getVal(dfeInfo, ["cStat", "CStat"]) || "");
          const ultNSU = String(getVal(dfeInfo, ["ultNSU", "ultnsu"]) || "0");
          const maxNSU = String(getVal(dfeInfo, ["maxNSU", "maxnsu"]) || "0");
          const xMotivo = String(getVal(dfeInfo, ["xMotivo", "XMotivo"]) || "");

          console.log(`[Sinc] Lote ${loopCount}: cStat=${cStat}, ultNSU=${ultNSU}, maxNSU=${maxNSU}`);

          // Registra log com NSUs retornados pela SEFAZ
          // Importante: Só registramos o avanço se for 138 (documentos encontrados) ou 137 (nenhum novo)
          if (cStat === "138" || cStat === "137") {
            await registrarLog(comando, resp, ultNSU, maxNSU);
            currentNSU = ultNSU; // Sempre avança para o ultNSU retornado
          } else {
            await registrarLog(comando, resp, 0, 0);
            toast.warning(`SEFAZ: ${xMotivo || "Resposta inesperada"}`);
            hasMore = false;
            break;
          }
          
          if (cStat === "137") {
            if (loopCount === 1) toast.info("Nenhum documento novo localizado na SEFAZ.");
            hasMore = false;
            console.log("[Sinc] Fim: Nenhum documento novo (137).");
            break;
          }

          // Processa documentos deste lote
          const docs = Object.keys(parsed).filter(k => 
            k.toUpperCase().startsWith("RESNFE") || 
            k.toUpperCase().startsWith("PROCNFE")
          );

          for (const key of docs) {
            const doc = parsed[key];
            const chNFe = doc.chNFe || doc.ChNFe || doc.CH_NFE;
            if (!chNFe) continue;

            const payload = {
              empresa_id: XEmpresaId,
              chave_nfe: chNFe,
              cnpj_emitente: doc.CNPJ || doc.Cnpj || doc.cnpj || doc.CPF || doc.Cpf || doc.cpf,
              nm_emitente: (doc.xNome || doc.XNome || doc.nome || "DESCONHECIDO").toUpperCase(),
              dt_emissao: doc.dEmi || doc.DEmi || doc.data_emissao,
              vl_total: Number(doc.vNF || doc.VNF || doc.valor || 0),
              nr_nota: chNFe.substring(25, 34),
              serie: chNFe.substring(22, 25),
              nsu: doc.NSU || doc.nsu,
              xml_resumo: JSON.stringify(doc),
              updated_at: new Date().toISOString()
            };

            const { error } = await db.from("fiscal_nfe_recebida").upsert(payload, { onConflict: "chave_nfe" });
            if (!error) totalNovos++;
          }

          // Prepara próxima volta se houver mais documentos
          if (cStat === "138" && parseInt(ultNSU) < parseInt(maxNSU)) {
            currentNSU = ultNSU;
            await new Promise(r => setTimeout(r, 500));
          } else {
            hasMore = false;
          }
        } catch (e: any) {
          // Se cair aqui, é erro de conexão ou exceção no processamento
          const errorMsg = "FALHA DE COMUNICAÇÃO: " + (e.message || "Provedor/Bridge Offline");
          await registrarLog(comando, errorMsg, 0, 0);
          throw e; // Repassa para o catch externo mostrar o toast
        }
      }

      if (totalNovos > 0) {
        toast.success(`Sincronização concluída. ${totalNovos} novos documentos processados.`);
        loadData();
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro no Provedor: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const handleAlinharNSU = async () => {
    if (!XCNPJ) { toast.error("CNPJ não informado."); return; }
    if (!confirm("Isso irá alinhar o NSU local com o da SEFAZ, marcando como processadas todas as notas até o momento. Deseja continuar?")) return;
    
    setXLoading(true);
    try {
      const sendUF = XUF || "35";
      const comando = `NFE.DistribuicaoDFePorUltNSU(${sendUF}, "${XCNPJ}", "0")`;
      const resp = await provedorService.enviarComando(comando, XEmpresaId);
      
      if (resp.includes("ERRO:")) {
        throw new Error(resp.replace("ERRO:", "").trim());
      }

      const parsed = provedorService.parseIni(resp);
      const dfeInfo = parsed.DistribuicaoDFe || parsed;

      if (dfeInfo) {
        const cStat = String(dfeInfo.cStat || dfeInfo.CStat || "");
        const xMotivo = dfeInfo.xMotivo || dfeInfo.XMotivo || "";
        const maxNSU = String(dfeInfo.maxNSU || dfeInfo.maxnsu || "0");
        
        const msg = `SEFAZ [${cStat}]: ${xMotivo}`;
        
        if (maxNSU !== "0" && (cStat === "137" || cStat === "138")) {
          // Registra o log com o MAX_NSU para que a próxima sincronização comece de lá
          await registrarLog("ALINHAMENTO MANUAL", resp, maxNSU, maxNSU);
          toast.success(`${msg}. Sistema alinhado com a SEFAZ no NSU ${maxNSU}.`);
        } else {
          if (cStat === "656") {
            setXAlertMsg("Consumo Indevido na SEFAZ. Aguarde alguns minutos ou uma hora para tentar novamente.");
            setXAlertOpen(true);
          } else {
            toast.warning(msg);
          }
        }
      } else {
        toast.error("Não foi possível interpretar a resposta da SEFAZ.");
      }
    } catch (e: any) {
      toast.error("Erro ao alinhar NSU: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const handleBaixarXml = async (row: any) => {
    if (!row.st_manifesto || row.st_manifesto === "0") {
      if (confirm("Para baixar o XML é necessário realizar a 'Ciência da Operação'. Deseja realizar agora?")) {
        await handleConfirmarManifesto(row, "210210");
        // Após manifestar, recarrega o dado da linha para ter o st_manifesto atualizado e tenta baixar
        const { data: updatedRow } = await db.from("fiscal_nfe_recebida").select("*").eq("nfe_recebida_id", row.nfe_recebida_id).maybeSingle();
        if (updatedRow?.st_manifesto === "210210") {
          handleBaixarXml(updatedRow);
        }
      }
      return;
    }
    setXLoading(true);
    try {
      // Para baixar o XML completo, chamamos a distribuição novamente por chave
      // Ou esperamos a próxima sincronização se a SEFAZ já tiver liberado via NSU
      // Aqui vamos forçar uma consulta por chave
      const comando = `NFE.DistribuicaoDFePorChave(${XUF}, "${XCNPJ}", "${row.chave_nfe}")`;
      const resp = await provedorService.enviarComando(comando, XEmpresaId);
      await registrarLog(comando, resp, 0, 0, row.nfe_recebida_id);

      const parsed = provedorService.parseIni(resp);
      
      const key = Object.keys(parsed).find(k => k.toUpperCase().startsWith("PROCNFE"));
      const doc = key ? parsed[key] : null;
      const xml = doc?.XML || doc?.xml || doc?.Xml;

      if (xml) {
        await db.from("fiscal_nfe_recebida")
          .update({ 
            st_download: true, 
            xml_completo: xml,
            updated_at: new Date().toISOString() 
          })
          .eq("nfe_recebida_id", row.nfe_recebida_id);
        
        toast.success("XML baixado com sucesso!");
        loadData();
      } else {
        toast.warning("XML ainda não disponível para download. Tente após alguns minutos ou verifique se houve Ciência/Confirmação.");
      }
    } catch (e: any) {
      toast.error("Erro no Provedor: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          <FileSearch className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">NF-e Recebidas</h2>
          <p className="text-xs text-muted-foreground">Manifesto e download de documentos fiscais</p>
        </div>
      </div>

      <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden p-4 flex flex-col">
        <DataGrid 
          columns={[
            ...XGridCols,
            {
              key: "acoes",
              label: "Ações",
              width: "240px",
              render: r => (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1 text-[11px] bg-secondary text-secondary-foreground px-2 py-1 rounded border border-border hover:bg-secondary/80 transition-colors font-bold uppercase shadow-sm">
                        Manifestar
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => handleOpenManif(r, "210210")}>
                        <Eye className="w-4 h-4 mr-2 text-blue-500" /> Ciência da Operação
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenManif(r, "210200")}>
                        <ShieldCheck className="w-4 h-4 mr-2 text-green-500" /> Confirmação da Operação
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleOpenManif(r, "210240")}>
                        <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" /> Operação não Realizada
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenManif(r, "210220")} className="text-destructive">
                        <ShieldAlert className="w-4 h-4 mr-2" /> Desconhecimento
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button 
                    onClick={() => handleBaixarXml(r)}
                    disabled={XLoading || !r.st_manifesto || r.st_manifesto === "0"}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-20"
                    title="Baixar XML"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )
            }
          ]}
          data={XFilteredData}
          showFilters
          filterValues={XSearchFilters}
          onFilterChange={(k, v) => setXSearchFilters(prev => ({ ...prev, [k]: v }))}
          onRowDoubleClick={(row) => { setXSelectedNfe(row); setXLogOpen(true); }}
          exportTitle="NF-e Recebidas"
          showRecordCount
          maxHeight="calc(100vh - 300px)"
          toolbarLeft={
            <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-lg border border-border mr-4">
              <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Início</span>
                <input type="date" value={XDtIni} onChange={e => setXDtIni(e.target.value)} className="bg-transparent border-none text-xs p-0 focus:ring-0 w-24" />
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Fim</span>
                <input type="date" value={XDtFim} onChange={e => setXDtFim(e.target.value)} className="bg-transparent border-none text-xs p-0 focus:ring-0 w-24" />
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Situação</span>
                <select value={XStatusFilter} onChange={e => setXStatusFilter(e.target.value)} className="bg-transparent border-none text-xs p-0 focus:ring-0 w-28">
                  <option value="">TODAS</option>
                  <option value="0">PENDENTE</option>
                  <option value="210210">CIÊNCIA</option>
                  <option value="210200">CONFIRMADA</option>
                  <option value="210220">DESCONHECIDA</option>
                  <option value="210240">NÃO REALIZADA</option>
                </select>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">UF</span>
                <span className="text-xs font-bold py-1">
                  {(() => {
                    const ufLabels: Record<string, string> = {
                      '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
                      '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
                      '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
                      '41': 'PR', '42': 'SC', '43': 'RS',
                      '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'
                    };
                    return ufLabels[XUF] || XUF || "-";
                  })()}
                </span>
              </div>
              
              <div className="flex gap-1 ml-2">
                <button 
                  onClick={loadData}
                  disabled={XLoading}
                  className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-xs font-bold hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  FILTRAR
                </button>
                <button 
                  onClick={() => handleSincronizar()}
                  disabled={XLoading}
                  className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                >
                  <RefreshCw className={`w-3 h-3 ${XLoading ? "animate-spin" : ""}`} />
                  SINCRONIZAR
                </button>
                <button 
                  onClick={handleAlinharNSU}
                  disabled={XLoading}
                  className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-xs font-bold hover:bg-secondary/80 transition-colors flex items-center gap-1 border border-border shadow-sm"
                  title="Alinhar NSU com SEFAZ (Ignora notas antigas)"
                >
                  <Target className="w-3 h-3" />
                  ALINHAR
                </button>
                <button 
                  onClick={() => setXLogOpen(true)}
                  className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-xs font-bold hover:bg-secondary/80 transition-colors flex items-center gap-1 border border-border shadow-sm"
                  title="Ver Log de Comandos MonitorFiscal"
                >
                  <Terminal className="w-3 h-3" />
                  LOG
                </button>
              </div>
            </div>
          }
        />
      </div>

      <MonitorFiscalLogDialog 
        isOpen={XLogOpen} 
        onClose={() => setXLogOpen(false)} 
        empresaId={XEmpresaId} 
      />

      <Dialog open={XManifOpen} onOpenChange={setXManifOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Operação não Realizada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="justificativa">Justificativa (mínimo 15 caracteres)</Label>
              <Textarea 
                id="justificativa"
                placeholder="Descreva o motivo pelo qual a operação não foi realizada..."
                value={XJustificativa}
                onChange={(e) => setXJustificativa(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-[10px] text-muted-foreground italic">
                Nota: Esta manifestação é conclusiva e indica que você reconhece a nota mas a mercadoria não foi recebida.
              </p>
            </div>
          </div>
          <DialogFooter>
            <button 
              onClick={() => setXManifOpen(false)}
              className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={() => handleConfirmarManifesto(XSelectedNfe, "210240", XJustificativa)}
              disabled={XJustificativa.length < 15 || XLoading}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Enviar Manifestação
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={XAlertOpen} onOpenChange={setXAlertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" /> Alerta da SEFAZ
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 text-sm font-bold text-center leading-relaxed">
            {XAlertMsg}
          </div>
          <div className="flex justify-center pb-2">
            <button 
              onClick={() => setXAlertOpen(false)}
              className="bg-primary text-primary-foreground px-8 py-2 rounded-md font-bold hover:opacity-90 transition-opacity"
            >
              OK
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NfeRecebidasForm;

