import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { provedorService } from "@/services/provedorService";
import { RefreshCw, Download, CheckCircle, AlertTriangle, ShieldCheck, ShieldAlert, FileSearch, Eye, Terminal, Target } from "lucide-react";
import { formatCPFCNPJ } from "@/lib/validators";
import MonitorFiscalLogDialog from "./MonitorFiscalLogDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  const registrarLog = async (comando: string, resposta: string, ultNsu?: any, maxNsu?: any) => {
    try {
      await db.from("dfe_nsu_log").insert({
        empresa_id: XEmpresaId,
        comando: comando,
        resposta: resposta,
        ult_nsu: Number(ultNsu || 0),
        max_nsu: Number(maxNsu || 0)
      });
    } catch (e) {
      console.error("Erro ao registrar log MonitorFiscal:", e);
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
      let query = db.from("nfe_recebida")
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

          if (data?.max_nsu_busca) {
            setXMaxLoops(Number(data.max_nsu_busca));
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
      // 1. Define NSU inicial baseado no LOG de consultas (Busca manual para precisão absoluta)
      if (!forceStart) {
        const currentId = Number(XEmpresaId || 0);

        const { data: logs } = await db.from("dfe_nsu_log")
          .select("ult_nsu")
          .eq("empresa_id", currentId)
          .order("created_at", { ascending: false })
          .limit(50);
        
        if (logs && logs.length > 0) {
          const maxLogNSU = logs.reduce((max: number, l: any) => {
            const n = Number(l.ult_nsu || 0);
            return Math.max(max, n);
          }, 0);

          if (maxLogNSU > 0) {
            currentNSU = String(maxLogNSU);
          }
        }

        if (currentNSU === "0") {
          const { data: nsuData } = await db.from("nfe_recebida")
            .select("nsu")
            .eq("empresa_id", currentId)
            .order("nsu", { ascending: false })
            .limit(1);
          
          if (nsuData && nsuData.length > 0 && Number(nsuData[0].nsu) > 0) {
            currentNSU = String(nsuData[0].nsu);
          }
        }
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
        const comando = `NFE.DistribuicaoDFe(${sendUF}, "${XCNPJ}", "${currentNSU}")`;
        let resp = "";
        
        try {
          resp = await provedorService.enviarComando(comando);
          
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
          const dfeInfo = parsed.DistribuicaoDFe;

          if (!dfeInfo) {
            await registrarLog(comando, resp, 0, 0);
            break;
          }

          // Registra log com NSUs retornados pela SEFAZ
          // Importante: Só registramos o avanço se for 138 (documentos encontrados) ou 137 (nenhum novo)
          if (dfeInfo.cStat === "138" || dfeInfo.cStat === "137") {
            await registrarLog(comando, resp, dfeInfo.ultNSU, dfeInfo.maxNSU);
          } else {
            await registrarLog(comando, resp, 0, 0);
            toast.warning(`SEFAZ: ${dfeInfo.xMotivo || "Resposta inesperada"}`);
            hasMore = false;
            break;
          }
          
          if (dfeInfo.cStat === "137") {
            if (loopCount === 1) toast.info("Nenhum documento novo localizado na SEFAZ.");
            hasMore = false;
            break;
          }

          // Processa documentos deste lote
          const docs = Object.keys(parsed).filter(k => k.startsWith("resNFe") || k.startsWith("procNFe"));
          for (const key of docs) {
            const doc = parsed[key];
            if (!doc.chNFe) continue;

            const payload = {
              empresa_id: XEmpresaId,
              chave_nfe: doc.chNFe,
              cnpj_emitente: doc.CNPJ || doc.CPF,
              nm_emitente: (doc.xNome || "DESCONHECIDO").toUpperCase(),
              dt_emissao: doc.dEmi,
              vl_total: Number(doc.vNF || 0),
              nr_nota: doc.chNFe.substring(25, 34),
              serie: doc.chNFe.substring(22, 25),
              nsu: doc.NSU,
              xml_resumo: JSON.stringify(doc),
              updated_at: new Date().toISOString()
            };

            const { error } = await db.from("nfe_recebida").upsert(payload, { onConflict: "chave_nfe" });
            if (!error) totalNovos++;
          }

          // Prepara próxima volta
          const ultNSU = dfeInfo.ultNSU;
          const maxNSU = dfeInfo.maxNSU;

          if (ultNSU && maxNSU && parseInt(ultNSU) < parseInt(maxNSU)) {
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
      const comando = `NFE.DistribuicaoDFe(${sendUF}, "${XCNPJ}", "0")`;
      const resp = await provedorService.enviarComando(comando);
      
      if (resp.includes("ERRO:")) {
        throw new Error(resp.replace("ERRO:", "").trim());
      }

      const parsed = provedorService.parseIni(resp);
      const dfeInfo = parsed.DistribuicaoDFe;

      if (dfeInfo) {
        const { cStat, xMotivo, maxNSU } = dfeInfo;
        const msg = `SEFAZ [${cStat}]: ${xMotivo}`;
        
        if (maxNSU && (cStat === "137" || cStat === "138")) {
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

  const handleManifestar = async (row: any, tipo: string) => {
    if (!confirm("Confirma o envio deste evento de manifestação?")) return;
    setXLoading(true);
    try {
      const resp = await provedorService.enviarManifesto(row.chave_nfe, tipo, XCNPJ);
      await registrarLog(`Manifesto(${tipo}) - ${row.chave_nfe}`, resp);
      
      // Atualiza status localmente (em um cenário real leríamos o retorno do protocolo)
      const { error } = await db.from("nfe_recebida")
        .update({ st_manifesto: tipo, updated_at: new Date().toISOString() })
        .eq("nfe_recebida_id", row.nfe_recebida_id);

      if (error) throw error;
      toast.success("Manifesto enviado!");
      loadData();
    } catch (e: any) {
      toast.error("Erro ao manifestar: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const handleBaixarXml = async (row: any) => {
    setXLoading(true);
    try {
      // Para baixar o XML completo, chamamos a distribuição novamente por chave
      // Ou esperamos a próxima sincronização se a SEFAZ já tiver liberado via NSU
      // Aqui vamos forçar uma consulta por chave
      const comando = `NFE.DistribuicaoDFePorChave(${XUF}, "${XCNPJ}", "${row.chave_nfe}")`;
      const resp = await provedorService.enviarComando(comando);
      await registrarLog(comando, resp);

      const parsed = provedorService.parseIni(resp);
      
      const key = Object.keys(parsed).find(k => k.startsWith("procNFe"));
      if (key && parsed[key].XML) {
        await db.from("nfe_recebida")
          .update({ 
            st_download: true, 
            xml_completo: parsed[key].XML,
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
                  {(r.st_manifesto === "0" || r.st_manifesto === "210210") && (
                    <button 
                      onClick={() => handleManifestar(r, "210200")}
                      className="flex items-center gap-1 text-[11px] bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 hover:bg-green-100 transition-colors"
                      title="Confirmar Operação"
                    >
                      <ShieldCheck className="w-3 h-3" /> Confirmar
                    </button>
                  )}
                  {r.st_manifesto === "0" && (
                    <button 
                      onClick={() => handleManifestar(r, "210210")}
                      className="flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100 transition-colors"
                      title="Ciência da Operação"
                    >
                      <Eye className="w-3 h-3" /> Ciência
                    </button>
                  )}
                  {r.st_manifesto === "0" && (
                    <button 
                      onClick={() => handleManifestar(r, "210220")}
                      className="flex items-center gap-1 text-[11px] bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 hover:bg-red-100 transition-colors"
                      title="Desconhecimento"
                    >
                      <ShieldAlert className="w-3 h-3" /> Desconhecer
                    </button>
                  )}
                  <button 
                    onClick={() => handleBaixarXml(r)}
                    disabled={XLoading || r.st_manifesto === "0"}
                    className="ml-auto p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-20"
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
