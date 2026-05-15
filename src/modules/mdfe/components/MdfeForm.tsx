import React, { useCallback, useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { Send, Lock, XCircle } from "lucide-react";
import { mdfeEmissaoService } from "../services/mdfeEmissaoService";

import MdfCarregaTab from "./tabs/MdfCarregaTab";
import MdfDescarregaTab from "./tabs/MdfDescarregaTab";
import MdfDocumentosTab from "./tabs/MdfDocumentosTab";
import MdfVeiculosTab from "./tabs/MdfVeiculosTab";
import MdfMotoristasTab from "./tabs/MdfMotoristasTab";
import MdfPercursoTab from "./tabs/MdfPercursoTab";
import MdfPagamentoTab from "./tabs/MdfPagamentoTab";
import MdfComponenteTab from "./tabs/MdfComponenteTab";
import MdfParcelasTab from "./tabs/MdfParcelasTab";
import MdfHistoricoTab from "./tabs/MdfHistoricoTab";

type TMdfSt = "D" | "A" | "E" | "C" | "R" | "G";

const ST_LABELS: Record<TMdfSt, string> = {
  D: "Digitação",
  G: "XML Gerado",
  A: "Autorizado",
  E: "Encerrado",
  C: "Cancelado",
  R: "Rejeitado",
};

const ST_COLORS: Record<TMdfSt, string> = {
  D: "text-yellow-600",
  G: "text-blue-600",
  A: "text-green-600",
  E: "text-purple-600",
  C: "text-red-600",
  R: "text-orange-600",
};

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const XGridCols: IGridColumn[] = [
  { key: "mdf_manifesto_id", label: "Cód.", width: "70px", align: "right" },
  { key: "numero",           label: "Número",  width: "90px" },
  { key: "serie",            label: "Série",   width: "60px", align: "center" },
  { key: "dt_emissao",       label: "Emissão", width: "110px",
    render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
  { key: "ufini",  label: "UF Ini", width: "70px", align: "center" },
  { key: "uffim",  label: "UF Fim", width: "70px", align: "center" },
  { key: "qtd_nfe", label: "NF-e", width: "70px", align: "right" },
  { key: "peso_total", label: "Peso (KG)", width: "100px", align: "right",
    render: r => Number(r.peso_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 3 }) },
  { key: "valor_total", label: "Valor (R$)", width: "120px", align: "right",
    render: r => Number(r.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
  { key: "status", label: "Status", width: "100px",
    render: r => <span className={ST_COLORS[r.status as TMdfSt] || ""}>{ST_LABELS[r.status as TMdfSt] || r.status}</span> },
];

const XDefault = {
  numero: "", serie: "1", modelo: "58",
  dt_emissao: new Date().toISOString().substring(0, 10),
  dt_viagem:  new Date().toISOString().substring(0, 10),
  hr_viagem: "00:00:00",
  modalidade: "1", tp_emitente: "1", tp_transportador: "1",
  ufini: "", uffim: "", unidade: "KG",
  peso_total: 0, valor_total: 0, qtd_nfe: 0, status: "D",
};

interface IProps {
  initialId?: number;
}

const MdfeForm: React.FC<IProps> = ({ initialId }) => {
  const { XEmpresaId } = useAppContext();
  const XRefreshRef = useRef<any>(null);

  const handleTransmitir = useCallback(async (manifestoId: number) => {
    if (!confirm("Confirma a emissão do MDF-e? O documento será enviado ao SEFAZ via ACBr.")) return;
    toast.loading("Transmitindo MDF-e...", { id: "mdf-tx" });
    try {
      const res = await mdfeEmissaoService.emitirMdfe(manifestoId, XEmpresaId);
      if (res.success) {
        toast.success(res.mensagem || "MDF-e transmitido com sucesso!");
        XRefreshRef.current?.();
      } else {
        toast.error(res.mensagem || "Erro na transmissão");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro na transmissão");
    } finally {
      toast.dismiss("mdf-tx");
    }
  }, [XEmpresaId]);

  const handleEncerrar = useCallback(async (manifestoId: number) => {
    toast.info("Para encerrar, utilize o Gerenciador Fiscal de MDF-e.");
  }, []);

  const handleCancelar = useCallback(async (manifestoId: number) => {
    const just = prompt("Informe a justificativa do cancelamento (mín. 15 caracteres):");
    if (!just || just.length < 15) { toast.warning("Justificativa inválida (mín. 15 caracteres)."); return; }
    
    // TODO: Implementar cancelamento via fiscal_evento no service
    const { error } = await supabase.from("fiscal_mdf_manifesto").update({ status: "C" }).eq("mdf_manifesto_id", manifestoId);
    if (error) { toast.error("Erro ao cancelar: " + error.message); return; }
    toast.success("MDF-e cancelado!");
    XRefreshRef.current?.();
  }, []);

  return (
    <StandardCrudForm
      config={{
        XTableName: "fiscal_mdf_manifesto",
        XPrimaryKey: "mdf_manifesto_id",
        XTitle: "MDF-e — Manifesto Eletrônico",
        XEmpresaId,
        XSoftDelete: true,
        XOrderBy: "mdf_manifesto_id",
        XInitialId: initialId,
        XDefaultRecord: { ...XDefault, empresa_id: XEmpresaId } as any,
        XOnBeforeSave: (rec) => {
          if (!rec.ufini?.trim()) throw new Error("UF Inicial é obrigatória.");
          if (!rec.uffim?.trim()) throw new Error("UF Final é obrigatória.");
          if (!rec.dt_emissao)   throw new Error("Data de Emissão é obrigatória.");
          if (!rec.dt_viagem)    throw new Error("Data da Viagem é obrigatória.");
          if (!rec.hr_viagem)    throw new Error("Hora da Viagem é obrigatória.");
          
          return {
            ...rec,
            empresa_id: XEmpresaId,
            excluido: rec.excluido ?? false,
            dt_cadastro: rec.mdf_manifesto_id ? undefined : new Date().toISOString(),
            dt_alteracao: new Date().toISOString(),
          };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="MDF-e"
      XRefreshRef={XRefreshRef}
      XAfterInsertTab="carrega"
      XExtraTabs={[
        {
          key: "carrega", label: "Carregamento",
          render: ({ currentRecord }) => (
            <MdfCarregaTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={currentRecord?.status === "D"}
            />
          ),
        },
        {
          key: "descarrega", label: "Descarregamento",
          render: ({ currentRecord }) => (
            <MdfDescarregaTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={currentRecord?.status === "D"}
            />
          ),
        },
        {
          key: "docs", label: "Documentos (NF-e)",
          render: ({ currentRecord }) => (
            <MdfDocumentosTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={currentRecord?.status === "D"}
            />
          ),
        },
        {
          key: "veiculos", label: "Veículos",
          render: ({ currentRecord }) => (
            <MdfVeiculosTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={currentRecord?.status === "D"}
            />
          ),
        },
        {
          key: "motoristas", label: "Motoristas",
          render: ({ currentRecord }) => (
            <MdfMotoristasTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={currentRecord?.status === "D"}
            />
          ),
        },
        {
          key: "percurso", label: "Percurso (UF)",
          render: ({ currentRecord }) => (
            <MdfPercursoTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={currentRecord?.status === "D"}
            />
          ),
        },
        {
          key: "pagamento", label: "Pagamento",
          render: ({ currentRecord }) => (
            <MdfPagamentoTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={currentRecord?.status === "D"}
            />
          ),
        },
        {
          key: "componentes", label: "Componentes",
          render: ({ currentRecord }) => (
            <MdfComponenteTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={currentRecord?.status === "D"}
            />
          ),
        },
        {
          key: "parcelas", label: "Parcelas",
          render: ({ currentRecord }) => (
            <MdfParcelasTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={currentRecord?.status === "D"}
            />
          ),
        },
        {
          key: "historico", label: "Histórico / XML",
          render: ({ currentRecord }) => (
            <MdfHistoricoTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={false}
            />
          ),
        },
      ]}
      renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => {
        const ro = !isEditing;
        const st = (record.status || "D") as TMdfSt;
        const mdfId = currentRecord?.mdf_manifesto_id ?? null;
        const podeTransmitir = mdfId && st === "D" && !isEditing;
        const podeEncerrar   = mdfId && st === "A" && !isEditing;
        const podeCancelar   = mdfId && (st === "A" || st === "E") && !isEditing;

        return (
          <div className="space-y-4">

            {/* ── Linha 1: Identificação + Status + Ações ── */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Cód.</label>
                <input readOnly
                  value={mdfId ?? (mode === "insert" ? "(Novo)" : "")}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Modelo</label>
                <input readOnly={ro} value={record.modelo ?? "58"}
                  onChange={e => setField("modelo", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm text-center" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Número <span className="text-destructive">*</span></label>
                <input readOnly={ro} value={record.numero ?? ""}
                  onChange={e => setField("numero", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Série</label>
                <input readOnly={ro} value={record.serie ?? "1"}
                  onChange={e => setField("serie", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm text-center" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Dt. Emissão <span className="text-destructive">*</span></label>
                <input type="date" readOnly={ro}
                  value={String(record.dt_emissao || "").substring(0, 10)}
                  onChange={e => setField("dt_emissao", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Status</label>
                <input readOnly
                  value={ST_LABELS[st] || st}
                  className={`w-full border border-border rounded px-2 py-1 text-sm font-semibold bg-secondary ${ST_COLORS[st] || ""}`} />
              </div>
              <div className="col-span-3 flex gap-2 items-end flex-wrap">
                {podeTransmitir && (
                  <button onClick={() => handleTransmitir(mdfId!)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-green-600 text-white text-xs hover:bg-green-700">
                    <Send className="w-3.5 h-3.5" /> Transmitir
                  </button>
                )}
                {podeEncerrar && (
                  <button onClick={() => handleEncerrar(mdfId!)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700">
                    <Lock className="w-3.5 h-3.5" /> Encerrar
                  </button>
                )}
                {podeCancelar && (
                  <button onClick={() => handleCancelar(mdfId!)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-600 text-white text-xs hover:bg-red-700">
                    <XCircle className="w-3.5 h-3.5" /> Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* ── Linha 2: Viagem + UFs + Modalidade ── */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Dt. Viagem <span className="text-destructive">*</span></label>
                <input type="date" readOnly={ro}
                  value={String(record.dt_viagem || "").substring(0, 10)}
                  onChange={e => setField("dt_viagem", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Hora Viagem <span className="text-destructive">*</span></label>
                <input type="time" readOnly={ro}
                  value={record.hr_viagem ?? "00:00:00"}
                  onChange={e => setField("hr_viagem", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">UF Inicial <span className="text-destructive">*</span></label>
                <select disabled={ro} value={record.ufini ?? ""}
                  onChange={e => setField("ufini", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="">— UF —</option>
                  {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">UF Final <span className="text-destructive">*</span></label>
                <select disabled={ro} value={record.uffim ?? ""}
                  onChange={e => setField("uffim", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="">— UF —</option>
                  {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Modalidade</label>
                <select disabled={ro} value={record.modalidade ?? "1"}
                  onChange={e => setField("modalidade", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="1">1 - Rodoviário</option>
                  <option value="2">2 - Aéreo</option>
                  <option value="3">3 - Aquaviário</option>
                  <option value="4">4 - Ferroviário</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Unidade Medida</label>
                <select disabled={ro} value={record.unidade ?? "KG"}
                  onChange={e => setField("unidade", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="KG">KG</option>
                  <option value="TON">TON</option>
                </select>
              </div>
            </div>

            {/* ── Linha 3: Tipo Emitente / Transportador ── */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-4">
                <label className="text-xs text-muted-foreground">Tipo Emitente <span className="text-destructive">*</span></label>
                <select disabled={ro} value={record.tp_emitente ?? "1"}
                  onChange={e => setField("tp_emitente", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="1">1 - Prestador de serviço de transporte</option>
                  <option value="2">2 - Transportador de carga própria</option>
                  <option value="3">3 - Prestador de serviço de transporte (Carga própria)</option>
                </select>
              </div>
              <div className="col-span-4">
                <label className="text-xs text-muted-foreground">Tipo Transportador <span className="text-destructive">*</span></label>
                <select disabled={ro} value={record.tp_transportador ?? "1"}
                  onChange={e => setField("tp_transportador", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="1">1 - ETC</option>
                  <option value="2">2 - TAC</option>
                  <option value="3">3 - CTC</option>
                </select>
              </div>
            </div>

            {/* ── Totais ── */}
            <div className="border border-border rounded p-3 bg-card">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Totais do Manifesto</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Qtd. NF-e <span className="text-destructive">*</span></label>
                  <input type="number" readOnly={ro} value={record.qtd_nfe ?? 0}
                    onChange={e => setField("qtd_nfe", Number(e.target.value))}
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Peso Total (KG) <span className="text-destructive">*</span></label>
                  <input type="number" readOnly={ro} value={record.peso_total ?? 0}
                    onChange={e => setField("peso_total", e.target.value)}
                    step="0.001"
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor Total (R$) <span className="text-destructive">*</span></label>
                  <input type="number" readOnly={ro} value={record.valor_total ?? 0}
                    onChange={e => setField("valor_total", e.target.value)}
                    step="0.01"
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
              </div>
            </div>

          </div>
        );
      }}
    />
  );
};

export default MdfeForm;
