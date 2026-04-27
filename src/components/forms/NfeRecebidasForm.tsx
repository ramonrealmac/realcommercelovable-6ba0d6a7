import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { provedorService } from "@/services/provedorService";
import { RefreshCw, Download, CheckCircle, AlertTriangle, ShieldCheck, ShieldAlert, FileSearch, Eye } from "lucide-react";
import { formatCPFCNPJ } from "@/lib/validators";

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
  const [XUF, setXUF] = useState("35"); // Default SP
  const [XDtIni, setXDtIni] = useState(new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().substring(0, 10));
  const [XDtFim, setXDtFim] = useState(new Date().toISOString().substring(0, 10));
  const [XStatusFilter, setXStatusFilter] = useState("");
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});

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
      db.from("empresa").select("cnpj").eq("empresa_id", XEmpresaId).maybeSingle()
        .then(({ data, error }: any) => {
          if (error) console.error("Erro ao buscar CNPJ:", error);
          if (data?.cnpj) {
            const cleanCnpj = data.cnpj.replace(/\D/g, "");
            setXCNPJ(cleanCnpj);
          } else {
            console.warn("Empresa sem CNPJ cadastrado.");
          }
        });
      
      loadData();
    }
  }, [XEmpresaId]);

  const handleSincronizar = async () => {
    if (!XCNPJ) { toast.error("CNPJ não informado."); return; }
    setXLoading(true);
    try {
      // 1. Busca último NSU no banco para esta empresa
      const { data: nsuData } = await db.from("nfe_recebida")
        .select("nsu")
        .eq("empresa_id", XEmpresaId)
        .order("nsu", { ascending: false })
        .limit(1);
      
      const lastNSU = nsuData?.[0]?.nsu || "0";
      
      // 2. Chama o Provedor
      const resp = await provedorService.distribuicaoDFe(XUF, XCNPJ, lastNSU);
      
      if (resp.includes("ERRO:")) {
        throw new Error(resp.replace("ERRO:", "").trim());
      }

      const parsed = provedorService.parseIni(resp);
      
      const dfeInfo = parsed.DistribuicaoDFe;
      if (!dfeInfo || (dfeInfo.cStat !== "138" && dfeInfo.cStat !== "137")) {
         toast.info(`Provedor: ${dfeInfo?.xMotivo || "Sem documentos novos ou erro na consulta"}`);
         if (dfeInfo?.cStat !== "137") return;
      }

      // 3. Processa documentos (resNFe, procNFe, resEvento, procEvento)
      const docs = Object.keys(parsed).filter(k => k.startsWith("resNFe") || k.startsWith("procNFe"));
      let novos = 0;

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
        if (!error) novos++;
      }

      toast.success(`Sincronização concluída. ${novos} registros processados.`);
      // loadData(); // O usuário solicitou que sincronizar não execute filtrar automaticamente
    } catch (e: any) {
      console.error(e);
      toast.error("Erro no Provedor: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const handleManifestar = async (row: any, tipo: string) => {
    if (!confirm("Confirma o envio deste evento de manifestação?")) return;
    setXLoading(true);
    try {
      const resp = await provedorService.enviarManifesto(row.chave_nfe, tipo, XCNPJ);
      
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
      const resp = await provedorService.enviarComando(`NFE.DistribuicaoDFePorChave(${XUF}, "${XCNPJ}", "${row.chave_nfe}")`);
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
                <select value={XUF} onChange={e => setXUF(e.target.value)} className="bg-transparent border-none text-xs p-0 focus:ring-0 w-10">
                  <option value="11">RO</option><option value="12">AC</option><option value="13">AM</option><option value="14">RR</option><option value="15">PA</option><option value="16">AP</option><option value="17">TO</option>
                  <option value="21">MA</option><option value="22">PI</option><option value="23">CE</option><option value="24">RN</option><option value="25">PB</option><option value="26">PE</option><option value="27">AL</option><option value="28">SE</option><option value="29">BA</option>
                  <option value="31">MG</option><option value="32">ES</option><option value="33">RJ</option><option value="35">SP</option>
                  <option value="41">PR</option><option value="42">SC</option><option value="43">RS</option>
                  <option value="50">MS</option><option value="51">MT</option><option value="52">GO</option><option value="53">DF</option>
                </select>
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
                  onClick={handleSincronizar}
                  disabled={XLoading}
                  className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                >
                  <RefreshCw className={`w-3 h-3 ${XLoading ? "animate-spin" : ""}`} />
                  SINCRONIZAR
                </button>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default NfeRecebidasForm;
