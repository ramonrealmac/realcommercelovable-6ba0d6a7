import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { FileX, AlertTriangle, Loader2, CheckCircle2, RefreshCw, ChevronRight } from "lucide-react";

const db = supabase as any;

interface IInutilizacao {
  inutilizacao_id: number;
  modelo: string;
  serie: string;
  nr_ini: number;
  nr_fin: number;
  justificativa: string;
  ambiente: number;
  c_stat: number | null;
  x_motivo: string | null;
  nr_protocolo: string | null;
  st_inutilizacao: string;
  created_at: string;
}

interface IConfigItem {
  fiscal_config_item_id: number;
  modelo: string;
  serie: string;
}

interface NfeInutilizacaoFormProps {
  initialData?: {
    modelo?: string;
    serie?: string;
    nr_ini?: string | number;
    nr_fin?: string | number;
  };
}

const NfeInutilizacaoForm: React.FC<NfeInutilizacaoFormProps> = ({ initialData }) => {
  const { XEmpresaId } = useAppContext();

  // Form state
  const [XModelo, setXModelo] = useState(initialData?.modelo || "55");
  const [XSerie, setXSerie] = useState(initialData?.serie || "");
  const [XNrIni, setXNrIni] = useState(String(initialData?.nr_ini || ""));
  const [XNrFin, setXNrFin] = useState(String(initialData?.nr_fin || ""));
  const [XJustificativa, setXJustificativa] = useState("");
  const [XSaving, setXSaving] = useState(false);

  // Config items (séries disponíveis)
  const [XConfigItems, setXConfigItems] = useState<IConfigItem[]>([]);

  // Histórico
  const [XHistorico, setXHistorico] = useState<IInutilizacao[]>([]);
  const [XLoadingHist, setXLoadingHist] = useState(false);

  // Empresa CNPJ e UF
  const [XEmpresaCnpj, setXEmpresaCnpj] = useState("");
  const [XEmpresaUF, setXEmpresaUF] = useState("");
  const [XAmbiente, setXAmbiente] = useState(1);

  useEffect(() => {
    if (!XEmpresaId) return;
    carregarDados();
  }, [XEmpresaId]);

  const carregarDados = async () => {
    // Empresa
    const { data: emp } = await db.from("empresa")
      .select("cnpj, endereco_uf, endereco_cidade_id")
      .eq("empresa_id", XEmpresaId)
      .maybeSingle();
    if (emp) {
      setXEmpresaCnpj(emp.cnpj || "");
      setXEmpresaUF(emp.endereco_uf || "SP");
    }

    // Config fiscal ambiente
    const { data: fc } = await db.from("fiscal_config")
      .select("ambiente_nfe")
      .eq("empresa_id", XEmpresaId)
      .maybeSingle();
    if (fc) setXAmbiente(Number(fc.ambiente_nfe || 1));

    // Config itens (séries)
    const { data: ci } = await db.from("fiscal_config_item")
      .select("fiscal_config_item_id, modelo, serie")
      .eq("empresa_id", XEmpresaId)
      .order("modelo");
    setXConfigItems(ci || []);

    // Histórico
    carregarHistorico();
  };

  const carregarHistorico = async () => {
    setXLoadingHist(true);
    const { data } = await db.from("fiscal_nfe_inutilizacao")
      .select("*")
      .eq("empresa_id", XEmpresaId)
      .order("created_at", { ascending: false })
      .limit(50);
    setXHistorico(data || []);
    setXLoadingHist(false);
  };

  const handleSubmit = async () => {
    // Validações básicas
    if (!XSerie.trim()) { toast.error("Informe a série."); return; }
    if (!XNrIni || !XNrFin) { toast.error("Informe o número inicial e final."); return; }
    const ini = parseInt(XNrIni);
    const fin = parseInt(XNrFin);
    if (isNaN(ini) || isNaN(fin) || ini < 1 || fin < ini) {
      toast.error("Intervalo de numeração inválido."); return;
    }
    if (XJustificativa.trim().length < 15) {
      toast.error("A justificativa deve ter ao menos 15 caracteres."); return;
    }
    if (!XEmpresaCnpj) { toast.error("CNPJ da empresa não localizado."); return; }

    setXSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Insere o registro de inutilização
      const { data: inut, error: inutErr } = await db.from("fiscal_nfe_inutilizacao").insert({
        empresa_id: XEmpresaId,
        modelo: XModelo,
        serie: XSerie.trim(),
        nr_ini: ini,
        nr_fin: fin,
        justificativa: XJustificativa.trim(),
        ambiente: XAmbiente,
        cnpj: XEmpresaCnpj.replace(/\D/g, ""),
        st_inutilizacao: "PENDENTE",
        fiscal_evento_id: null,
        usuario_id: user?.id || null,
      }).select("inutilizacao_id").single();

      if (inutErr) throw new Error(inutErr.message);

      // 2. Mapeia UF para código numérico IBGE
      const ufMap: Record<string, number> = {
        AC: 12, AL: 27, AM: 13, AP: 16, BA: 29, CE: 23, DF: 53,
        ES: 32, GO: 52, MA: 21, MG: 31, MS: 50, MT: 51, PA: 15,
        PB: 25, PE: 26, PI: 22, PR: 41, RJ: 33, RN: 24, RO: 11,
        RR: 14, RS: 43, SC: 42, SE: 28, SP: 35, TO: 17
      };
      const cuf = ufMap[XEmpresaUF.toUpperCase()] || 35;

      // 3. Cria evento fiscal para o worker processar
      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: XEmpresaId,
        tipo: XModelo === "65" ? "NFCE" : "NFE",
        comando: XModelo === "65" ? "INUTILIZAR_NFCE" : "INUTILIZAR_NFE",
        status: "PENDENTE",
        ambiente: XAmbiente,
        user_id: user?.id || null,
        payload: {
          inutilizacao_id: inut.inutilizacao_id,
          cuf: String(cuf),
          ano: new Date().getFullYear(),
          cnpj: XEmpresaCnpj.replace(/\D/g, ""),
          serie: XSerie.trim(),
          nr_ini: ini,
          nr_fin: fin,
          justificativa: XJustificativa.trim(),
          config: {
            uf: XEmpresaUF,
            modelo: parseInt(XModelo),
            ambiente: XAmbiente,
          }
        }
      }).select("id").single();

      if (evErr) throw new Error(evErr.message);

      // 4. Vincula evento ao registro de inutilização
      await db.from("fiscal_nfe_inutilizacao")
        .update({ fiscal_evento_id: evento.id })
        .eq("inutilizacao_id", inut.inutilizacao_id);

      toast.success("Solicitação de inutilização enviada ao Fiscal Worker. Aguarde o processamento.");

      // Limpa form
      setXNrIni("");
      setXNrFin("");
      setXJustificativa("");

      // Aguarda alguns segundos e recarrega
      setTimeout(carregarHistorico, 5000);

    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setXSaving(false);
    }
  };

  const stColor = (st: string) => {
    if (st === "CONCLUIDO") return "text-emerald-600 dark:text-emerald-400";
    if (st === "ERRO") return "text-rose-600 dark:text-rose-400";
    return "text-amber-600 dark:text-amber-400";
  };

  const stLabel = (st: string) => {
    if (st === "CONCLUIDO") return "Inutilizado";
    if (st === "ERRO") return "Erro";
    return "Pendente";
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30">
          <FileX className="w-5 h-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Inutilização de Numeração</h2>
          <p className="text-xs text-muted-foreground">
            Inutiliza faixas de NF-e/NFC-e não utilizadas junto à SEFAZ. Operação irreversível.
          </p>
        </div>
      </div>

      {/* Aviso */}
      <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <strong>Atenção:</strong> Números inutilizados não poderão ser reutilizados.
          Use apenas para faixas que definitivamente não serão emitidas (falhas de sequência, saltos, etc.).
          A justificativa deve ter ao menos 15 caracteres e ser enviada à SEFAZ.
        </p>
      </div>

      {/* Formulário */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-foreground mb-4">Nova Solicitação</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Modelo */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Modelo</label>
            <select
              value={XModelo}
              onChange={(e) => setXModelo(e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="55">55 — NF-e</option>
              <option value="65">65 — NFC-e</option>
            </select>
          </div>

          {/* Série */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Série</label>
            <input
              type="text"
              maxLength={3}
              value={XSerie}
              onChange={(e) => setXSerie(e.target.value)}
              placeholder="001"
              className="border border-border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {XConfigItems.filter(c => c.modelo === XModelo).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {XConfigItems.filter(c => c.modelo === XModelo).map(c => (
                  <button
                    key={c.fiscal_config_item_id}
                    onClick={() => setXSerie(c.serie)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  >
                    {c.serie}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nr Ini */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nº Inicial</label>
            <input
              type="number"
              min={1}
              value={XNrIni}
              onChange={(e) => setXNrIni(e.target.value)}
              placeholder="1"
              className="border border-border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Nr Fin */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nº Final</label>
            <input
              type="number"
              min={1}
              value={XNrFin}
              onChange={(e) => setXNrFin(e.target.value)}
              placeholder="1"
              className="border border-border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Justificativa */}
        <div className="flex flex-col gap-1 mt-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Justificativa <span className="text-rose-500">*</span>
            <span className="ml-1 font-normal normal-case">({XJustificativa.length}/255 — mín. 15)</span>
          </label>
          <textarea
            value={XJustificativa}
            onChange={(e) => setXJustificativa(e.target.value)}
            maxLength={255}
            rows={2}
            placeholder="Ex.: Numeração não utilizada por problema de conexão com a SEFAZ..."
            className="border border-border rounded-md px-2 py-1.5 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={XSaving}
            className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors"
          >
            {XSaving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              : <><FileX className="w-4 h-4" /> Inutilizar Numeração</>
            }
          </button>
        </div>
      </div>

      {/* Histórico */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">Histórico de Inutilizações</h3>
          <button
            onClick={carregarHistorico}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${XLoadingHist ? "animate-spin" : ""}`} />
          </button>
        </div>

        {XLoadingHist ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : XHistorico.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma inutilização registrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Data</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Modelo</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Série</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Nº Ini</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Nº Fin</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Protocolo</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Retorno SEFAZ</th>
                </tr>
              </thead>
              <tbody>
                {XHistorico.map((h, idx) => (
                  <tr
                    key={h.inutilizacao_id}
                    className={`border-t border-border ${idx % 2 ? "bg-muted/20" : ""}`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-foreground">{h.modelo}</td>
                    <td className="px-3 py-2 text-center font-mono text-foreground">{h.serie}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{h.nr_ini}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{h.nr_fin}</td>
                    <td className="px-3 py-2 font-mono text-foreground whitespace-nowrap">
                      {h.nr_protocolo || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`flex items-center gap-1 font-bold ${stColor(h.st_inutilizacao)}`}>
                        {h.st_inutilizacao === "CONCLUIDO" && <CheckCircle2 className="w-3 h-3" />}
                        {h.st_inutilizacao === "ERRO" && <AlertTriangle className="w-3 h-3" />}
                        {h.st_inutilizacao === "PENDENTE" && <Loader2 className="w-3 h-3 animate-spin" />}
                        {stLabel(h.st_inutilizacao)}
                        {h.c_stat && <span className="font-normal text-muted-foreground">({h.c_stat})</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs truncate" title={h.x_motivo || ""}>
                      {h.x_motivo || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default NfeInutilizacaoForm;
