import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import type { INfeXmlDuplicata } from "./types";
import { CreditCard, Calendar, DollarSign, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

const db = supabase as any;

const fmt2 = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateBR = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  const clean = dateStr.substring(0, 10);
  if (!clean.includes("-")) return clean;
  const [year, month, day] = clean.split("-");
  return `${day}/${month}/${year}`;
};

export interface ITituloRow {
  id: string | number;
  parcela: number | string;
  documento: string;
  dt_emissao: string;
  dt_vencto: string;
  vl_titulo: number;
  vl_pago?: number;
  status: string;
  origem: "FINANCEIRO" | "XML";
}

interface NfeTitulosTabProps {
  nfeCabecalhoId: number | null;
  empresaId: number;
  nrNota?: string;
  cadastroId?: number | null;
  duplicatasXml?: INfeXmlDuplicata[];
  vlTotalNf?: number;
  dtEmissao?: string;
  dtEntrada?: string;
  podeEditar?: boolean;
}

const NfeTitulosTab: React.FC<NfeTitulosTabProps> = ({
  nfeCabecalhoId,
  empresaId,
  nrNota,
  cadastroId,
  duplicatasXml = [],
  vlTotalNf = 0,
  dtEmissao,
  dtEntrada,
  podeEditar = false,
}) => {
  const [XList, setXList] = useState<ITituloRow[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);

  const loadTitulos = useCallback(async () => {
    setXLoading(true);
    try {
      let rows: ITituloRow[] = [];

      // 1. Tenta carregar do banco de dados (tabela financeiro)
      if (nrNota && cadastroId) {
        const { data: finData, error } = await db.from("financeiro")
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("tp_conta", "P")
          .eq("documento", String(nrNota))
          .eq("cadastro_id", cadastroId)
          .order("parcela");

        if (!error && finData && finData.length > 0) {
          rows = finData.map((f: any) => ({
            id: f.financeiro_id,
            parcela: f.parcela || 1,
            documento: f.documento || String(nrNota),
            dt_emissao: f.dt_emissao,
            dt_vencto: f.dt_vencto,
            vl_titulo: Number(f.vl_titulo || 0),
            vl_pago: Number(f.vl_pago || 0),
            status: f.status || "A",
            origem: "FINANCEIRO",
          }));
        }
      }

      // 2. Se não encontrou no financeiro, usa os dados do XML importado ou gera previsão
      if (rows.length === 0) {
        if (duplicatasXml && duplicatasXml.length > 0) {
          rows = duplicatasXml.map((dup, idx) => ({
            id: `xml-${idx}`,
            parcela: parseInt(String(dup.n_dup).replace(/\D/g, ""), 10) || (idx + 1),
            documento: nrNota || "PREVISÃO",
            dt_emissao: dtEmissao || new Date().toISOString().substring(0, 10),
            dt_vencto: dup.dt_vencto,
            vl_titulo: Number(dup.v_dup || 0),
            vl_pago: 0,
            status: "PENDENTE_ESCRITURACAO",
            origem: "XML",
          }));
        } else if (vlTotalNf > 0) {
          rows = [{
            id: "xml-total",
            parcela: 1,
            documento: nrNota || "PREVISÃO",
            dt_emissao: dtEmissao || new Date().toISOString().substring(0, 10),
            dt_vencto: dtEntrada || dtEmissao || new Date().toISOString().substring(0, 10),
            vl_titulo: vlTotalNf,
            vl_pago: 0,
            status: "PENDENTE_ESCRITURACAO",
            origem: "XML",
          }];
        }
      }

      setXList(rows);
    } catch (e) {
      console.error("[NfeTitulosTab] Erro ao carregar títulos:", e);
    } finally {
      setXLoading(false);
    }
  }, [nfeCabecalhoId, empresaId, nrNota, cadastroId, duplicatasXml, vlTotalNf, dtEmissao, dtEntrada]);

  useEffect(() => {
    loadTitulos();
  }, [loadTitulos]);

  const totalTitulos = useMemo(() => {
    return XList.reduce((acc, item) => acc + item.vl_titulo, 0);
  }, [XList]);

  const gridColumns = useMemo<IGridColumn[]>(() => {
    return [
      { key: "parcela", label: "Parc.", width: "70px", align: "center" },
      { key: "documento", label: "Nº Título", width: "110px" },
      {
        key: "dt_emissao",
        label: "Dt. Emissão",
        width: "110px",
        align: "center",
        render: (r) => formatDateBR(r.dt_emissao),
      },
      {
        key: "dt_vencto",
        label: "Vencimento",
        width: "120px",
        align: "center",
        render: (r) => (
          <span className="font-semibold text-foreground">
            {formatDateBR(r.dt_vencto)}
          </span>
        ),
      },
      {
        key: "vl_titulo",
        label: "Valor Título",
        width: "130px",
        align: "right",
        render: (r) => (
          <span className="font-bold text-primary">
            R$ {fmt2(r.vl_titulo)}
          </span>
        ),
      },
      {
        key: "status",
        label: "Situação",
        width: "180px",
        align: "center",
        render: (r) => {
          if (r.status === "B" || (r.vl_pago && r.vl_pago >= r.vl_titulo)) {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> BAIXADO
              </span>
            );
          }
          if (r.status === "C") {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                <AlertTriangle className="w-3.5 h-3.5" /> CANCELADO
              </span>
            );
          }
          if (r.status === "PENDENTE_ESCRITURACAO") {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Clock className="w-3.5 h-3.5" /> AGUARDANDO ESCRITURAÇÃO
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
              <Clock className="w-3.5 h-3.5" /> ABERTO (CONTAS A PAGAR)
            </span>
          );
        },
      },
    ];
  }, []);

  return (
    <div className="space-y-4">
      {/* Card de Resumo do Financeiro */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 sm:col-span-6 md:col-span-4 p-3 bg-card rounded-lg border border-border flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total de Títulos</p>
            <p className="text-lg font-bold text-foreground mt-0.5">R$ {fmt2(totalTitulos)}</p>
          </div>
          <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="col-span-12 sm:col-span-6 md:col-span-4 p-3 bg-card rounded-lg border border-border flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Quantidade de Parcelas</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{XList.length} parcela(s)</p>
          </div>
          <div className="p-2.5 bg-secondary text-secondary-foreground rounded-lg">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Grid de Títulos */}
      <DataGrid
        columns={gridColumns}
        data={XList}
        maxHeight="340px"
        exportTitle="Títulos da NF-e"
        showRecordCount={false}
        selectedIdx={XSelectedIdx}
        onRowClick={(_, idx) => setXSelectedIdx(idx)}
        toolbarLeft={
          <GridActionToolbar
            actions={[
              gridActions.atualizar(loadTitulos),
            ]}
            count={`${XList.length} título(s)`}
          />
        }
      />
    </div>
  );
};

export default NfeTitulosTab;
