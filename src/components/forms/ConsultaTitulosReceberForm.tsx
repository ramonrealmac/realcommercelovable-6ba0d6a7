import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Eye, Plus, HandCoins, RefreshCw, Filter as FilterIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { type IGridColumn } from "@/components/grid/DataGrid";

type SituacaoOpt = "A VENCER" | "PAGTO PARCIAL" | "VENCIDO" | "BAIXADO" | "CANCELADO";
const SITUACOES: SituacaoOpt[] = ["A VENCER", "PAGTO PARCIAL", "VENCIDO", "BAIXADO", "CANCELADO"];

interface IRow {
  empresa_id: number | null;
  financeiro_id: number | null;
  empresa: string;
  titulo: string | null;
  cliente: string;
  vl_a_pagar: number | null;
  vl_pago: number | null;
  dt_emissao: string | null;
  dt_vencto: string | null;
  dias_atraso: number | null;
  situacao: string | null;
}

interface IClienteOpt { cadastro_id: number; nome: string; }
interface IPlanoOpt { plano_id: number; nome: string; }

const fmtMoney = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
};

const ConsultaTitulosReceberForm: React.FC = () => {
  const { openTab } = useAppContext();

  const [XClientes, setXClientes] = useState<IClienteOpt[]>([]);
  const [XPlanos, setXPlanos] = useState<IPlanoOpt[]>([]);

  const [XClienteId, setXClienteId] = useState<string>("");
  const [XDtEmissao, setXDtEmissao] = useState<string>("");
  const [XDtVencto, setXDtVencto] = useState<string>("");
  const [XSituacao, setXSituacao] = useState<string>("");
  const [XPlanoId, setXPlanoId] = useState<string>("");

  const [XRows, setXRows] = useState<IRow[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);

  // Carregar listas dos filtros
  useEffect(() => {
    (async () => {
      const { data: cliData } = await supabase
        .from("cadastro")
        .select("cadastro_id, nome_fantasia, tipo_cadastro")
        .in("tipo_cadastro", ["C", "A"])
        .order("cadastro_id");
      setXClientes(
        (cliData ?? []).map((c: any) => ({
          cadastro_id: c.cadastro_id,
          nome: `${c.cadastro_id} - ${c.nome_fantasia ?? ""}`,
        }))
      );

      const { data: plData } = await supabase
        .from("plano")
        .select("plano_id, nome, tp_conta, natureza")
        .eq("tp_conta", "R")
        .eq("natureza", "A")
        .order("nome");
      setXPlanos((plData ?? []).map((p: any) => ({ plano_id: p.plano_id, nome: p.nome })));
    })();
  }, []);

  const loadGrid = useCallback(async () => {
    setXLoading(true);
    try {
      let q = supabase
        .from("financeiro_view")
        .select("empresa_id, financeiro_id, documento, cadastro_id, vl_a_pagar, vl_pago, dt_emissao, dt_vencto, dias_atraso, situacao, plano_id, tp_conta")
        .eq("tp_conta", "R")
        .order("dt_emissao", { ascending: false })
        .limit(1000);

      if (XClienteId) q = q.eq("cadastro_id", Number(XClienteId));
      if (XDtEmissao) q = q.eq("dt_emissao", XDtEmissao);
      if (XDtVencto) q = q.eq("dt_vencto", XDtVencto);
      if (XSituacao) q = q.eq("situacao", XSituacao);
      if (XPlanoId) q = q.eq("plano_id", Number(XPlanoId));

      const { data, error } = await q;
      if (error) throw error;

      const empIds = Array.from(new Set((data ?? []).map((r: any) => r.empresa_id).filter(Boolean)));
      const cadIds = Array.from(new Set((data ?? []).map((r: any) => r.cadastro_id).filter(Boolean)));

      const [empRes, cadRes] = await Promise.all([
        empIds.length
          ? supabase.from("empresa").select("empresa_id, razao_social").in("empresa_id", empIds as number[])
          : Promise.resolve({ data: [] as any[] } as any),
        cadIds.length
          ? supabase.from("cadastro").select("cadastro_id, razao_social").in("cadastro_id", cadIds as number[])
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      const empMap = new Map<number, string>((empRes.data ?? []).map((e: any) => [e.empresa_id, e.razao_social]));
      const cadMap = new Map<number, string>((cadRes.data ?? []).map((c: any) => [c.cadastro_id, c.razao_social]));

      const rows: IRow[] = (data ?? []).map((r: any) => ({
        empresa_id: r.empresa_id,
        financeiro_id: r.financeiro_id,
        empresa: empMap.get(r.empresa_id) ?? "",
        titulo: r.documento,
        cliente: `${r.cadastro_id ?? ""} - ${cadMap.get(r.cadastro_id) ?? ""}`,
        vl_a_pagar: r.vl_a_pagar,
        vl_pago: r.vl_pago,
        dt_emissao: r.dt_emissao,
        dt_vencto: r.dt_vencto,
        dias_atraso: r.dias_atraso,
        situacao: r.situacao,
      }));
      setXRows(rows);
    } catch (e: any) {
      console.error("Erro ao carregar títulos:", e);
    } finally {
      setXLoading(false);
    }
  }, [XClienteId, XDtVencto, XSituacao, XPlanoId]);

  useEffect(() => { loadGrid(); }, [loadGrid]);

  // Atualiza a grade automaticamente quando uma baixa for registrada/excluída em outra aba
  useEffect(() => {
    const handler = () => { loadGrid(); };
    window.addEventListener("financeiro:baixa-changed", handler);
    return () => window.removeEventListener("financeiro:baixa-changed", handler);
  }, [loadGrid]);

  const openTitulo = useCallback((row: IRow) => {
    if (!row.financeiro_id) return;
    openTab({
      title: `Conta a Receber ${row.titulo ?? ""}`,
      component: "conta-receber-detalhe",
      params: { empresa_id: row.empresa_id, financeiro_id: row.financeiro_id },
    });
  }, [openTab]);

  const rowColor = (sit: string | null | undefined) => {
    const s = (sit ?? "").toUpperCase();
    if (s === "BAIXADO") return "text-emerald-600 dark:text-emerald-400";
    if (s === "VENCIDO") return "text-red-600 dark:text-red-400";
    return "";
  };

  const XCols: IGridColumn[] = useMemo(() => [
    {
      key: "_acoes", label: "", width: "44px", align: "center",
      render: (r: IRow) => (
        <button
          onClick={(e) => { e.stopPropagation(); openTitulo(r); }}
          title="Visualizar título"
          className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-accent text-sky-600"
        >
          <Eye size={14} />
        </button>
      ),
    },
    { key: "empresa", label: "Empresa", width: "1.2fr",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{r.empresa}</span> },
    { key: "titulo", label: "Título", width: "120px",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{r.titulo}</span> },
    { key: "cliente", label: "Cliente", width: "2fr",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{r.cliente}</span> },
    { key: "vl_a_pagar", label: "Vlr. a Pagar", width: "110px", align: "right",
      getValue: (r: IRow) => Number(r.vl_a_pagar ?? 0),
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{fmtMoney(r.vl_a_pagar)}</span> },
    { key: "vl_pago", label: "Vlr. Pago", width: "110px", align: "right",
      getValue: (r: IRow) => Number(r.vl_pago ?? 0),
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{fmtMoney(r.vl_pago)}</span> },
    { key: "dt_emissao", label: "Dt. Emissão", width: "100px", align: "center",
      getValue: (r: IRow) => r.dt_emissao ?? "",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{fmtDate(r.dt_emissao)}</span> },
    { key: "dt_vencto", label: "Dt. Vencto", width: "100px", align: "center",
      getValue: (r: IRow) => r.dt_vencto ?? "",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{fmtDate(r.dt_vencto)}</span> },
    { key: "dias_atraso", label: "Atraso", width: "70px", align: "right",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{r.dias_atraso ?? 0}</span> },
    { key: "situacao", label: "Situação", width: "120px",
      render: (r: IRow) => <span className={`font-semibold ${rowColor(r.situacao)}`}>{r.situacao}</span> },
  ], [openTitulo]);

  const clearFilters = () => {
    setXClienteId(""); setXDtVencto(""); setXSituacao(""); setXPlanoId("");
  };

  return (
    <div className="p-3 h-full overflow-auto">
      <div className="mb-2">
        <h2 className="text-base font-semibold">Consulta de Títulos</h2>
      </div>

      {/* Filtros */}
      <div className="border border-border rounded-md p-3 mb-3 bg-card">
        <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
          <FilterIcon size={12} /> Filtros
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cliente</label>
            <select
              value={XClienteId}
              onChange={(e) => setXClienteId(e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card"
            >
              <option value="">Todos</option>
              {XClientes.map(c => (
                <option key={c.cadastro_id} value={c.cadastro_id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Dt. Vencimento</label>
            <input
              type="date"
              value={XDtVencto}
              onChange={(e) => setXDtVencto(e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Situação</label>
            <select
              value={XSituacao}
              onChange={(e) => setXSituacao(e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card"
            >
              <option value="">Todas</option>
              {SITUACOES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Plano de Contas</label>
            <select
              value={XPlanoId}
              onChange={(e) => setXPlanoId(e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card"
            >
              <option value="">Todos</option>
              {XPlanos.map(p => (
                <option key={p.plano_id} value={p.plano_id}>{p.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-accent"
          >Limpar</button>
          <button
            onClick={loadGrid}
            disabled={XLoading}
            className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <RefreshCw size={12} className={XLoading ? "animate-spin" : ""} /> Aplicar
          </button>
        </div>
      </div>

      <DataGrid
        columns={XCols}
        data={XRows}
        selectedIdx={XSelectedIdx}
        onRowClick={(_r, i) => setXSelectedIdx(i)}
        onRowDoubleClick={(r) => openTitulo(r as IRow)}
        exportTitle="Consulta de Títulos a Receber"
        maxHeight="calc(100vh - 320px)"
        toolbarLeft={
          <>
            <button
              onClick={loadGrid}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent"
              title="Atualizar"
            >
              <RefreshCw size={14} className={XLoading ? "animate-spin" : ""} /> Atualizar
            </button>
            <button
              onClick={() => openTab({ title: "Gerar Contas a Receber", component: "gerar-contas-receber" })}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              <Plus size={14} /> Novo Contas a Receber
            </button>
            <button
              onClick={() => openTab({ title: "Baixa por Cliente", component: "baixa-por-cliente" })}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent"
            >
              <HandCoins size={14} /> Baixa por Cliente
            </button>
          </>
        }
      />
    </div>
  );
};

export default ConsultaTitulosReceberForm;
