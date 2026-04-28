import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { Send, Lock, XCircle, Search, FileText, Activity } from "lucide-react";
import type { IMdfCabecalho, TMdfSt } from "./types";
import {
  MDF_ST_LABELS, MDF_ST_COLORS,
  TP_RODADO_OPTIONS, TP_CARROCERIA_OPTIONS, UF_OPTIONS,
} from "./types";
import MdfNfsTab from "./MdfNfsTab";
import MdfReboquesTab from "./MdfReboquesTab";
import MdfLogTab from "./MdfLogTab";
import { emitirMdfe, encerrarMdfe, cancelarMdfe, consultarMdfe } from "./mdfeService";

const db = supabase as any;

// ── Grid colunas ─────────────────────────────────────────────
const XGridCols: IGridColumn[] = [
  { key: "mdf_cabecalho_id", label: "Nº",       width: "70px",  align: "right" },
  { key: "nr_mdf",           label: "MDF-e",    width: "100px" },
  { key: "serie",            label: "Série",    width: "60px",  align: "center" },
  { key: "dt_emissao",       label: "Emissão",  width: "110px",
    render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
  { key: "placa_veiculo",    label: "Placa",    width: "100px" },
  { key: "uf_ini",           label: "UF Ini",   width: "70px",  align: "center" },
  { key: "uf_fim",           label: "UF Fim",   width: "70px",  align: "center" },
  { key: "st_mdf",           label: "Status",   width: "110px",
    render: r => <span className={MDF_ST_COLORS[r.st_mdf as TMdfSt] || ""}>{MDF_ST_LABELS[r.st_mdf as TMdfSt] || r.st_mdf}</span> },
  { key: "vl_carga",         label: "Vl. Carga", width: "120px", align: "right",
    render: r => Number(r.vl_carga || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
];

const XDefault: Partial<IMdfCabecalho> = {
  nr_mdf: "", serie: "1",
  dt_emissao:    new Date().toISOString().substring(0, 10),
  dt_ini_viagem: new Date().toISOString().substring(0, 10),
  dt_fim_viagem: null,
  uf_ini: "PR", uf_fim: "SP",
  cidades_percurso: "",
  placa_veiculo: "", rntrc_veiculo: "", uf_veiculo: "PR",
  tara_veiculo: 0, cap_kg_veiculo: 0, cap_m3_veiculo: 0,
  tp_rodado: "01", tp_carroceria: "02",
  condutor_nome: "", condutor_cpf: "",
  qt_nf: 0, vl_carga: 0, kg_carga: 0, unid_medida_carga: "KG",
  st_mdf: "A",
  chave_mdf: "", nr_protocolo: "",
  obs_mdf: "",
};

// ── Componente principal ─────────────────────────────────────
const MdfeForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  const XRefreshRef = useRef<(() => Promise<void>) | null>(null);

  // Empresa dados (CNPJ/IE para preencher emissão)
  const [xEmpresaDados, setXEmpresaDados] = useState<{ cnpj: string; ie: string } | null>(null);

  useEffect(() => {
    if (!XEmpresaId) return;
    db.from("empresa")
      .select("cnpj,ie")
      .eq("empresa_id", XEmpresaId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setXEmpresaDados({ cnpj: data.cnpj || "", ie: data.ie || "" });
      });
  }, [XEmpresaId]);

  // ── Ações de transmissão ────────────────────────────────────
  const handleEmitir = useCallback(async (cabId: number) => {
    if (!confirm("Confirma a emissão do MDF-e? O documento será enviado ao SEFAZ via ACBr.")) return;
    toast.loading("Emitindo MDF-e...", { id: "mdf-emit" });
    const res = await emitirMdfe(cabId, XEmpresaId);
    toast.dismiss("mdf-emit");
    if (res.sucesso) {
      toast.success("MDF-e autorizado com sucesso!");
    } else {
      toast.error("Erro na emissão: " + res.mensagem);
    }
    if (XRefreshRef.current) await XRefreshRef.current();
  }, [XEmpresaId]);

  const handleEncerrar = useCallback(async (cabId: number) => {
    if (!confirm("Confirma o encerramento do MDF-e?")) return;
    toast.loading("Encerrando MDF-e...", { id: "mdf-enc" });
    const res = await encerrarMdfe(cabId, XEmpresaId);
    toast.dismiss("mdf-enc");
    res.sucesso ? toast.success("MDF-e encerrado!") : toast.error("Erro: " + res.mensagem);
    if (XRefreshRef.current) await XRefreshRef.current();
  }, [XEmpresaId]);

  const handleCancelar = useCallback(async (cabId: number) => {
    const just = prompt("Informe a justificativa do cancelamento (mín. 15 caracteres):");
    if (!just || just.length < 15) { toast.warning("Justificativa inválida (mín. 15 chars)."); return; }
    toast.loading("Cancelando MDF-e...", { id: "mdf-canc" });
    const res = await cancelarMdfe(cabId, XEmpresaId, just);
    toast.dismiss("mdf-canc");
    res.sucesso ? toast.success("MDF-e cancelado!") : toast.error("Erro: " + res.mensagem);
    if (XRefreshRef.current) await XRefreshRef.current();
  }, [XEmpresaId]);

  const handleConsultar = useCallback(async (cabId: number) => {
    toast.loading("Consultando...", { id: "mdf-cons" });
    const res = await consultarMdfe(cabId, XEmpresaId);
    toast.dismiss("mdf-cons");
    if (res.sucesso) {
      alert("Retorno ACBr:\n\n" + res.mensagem);
    } else {
      toast.error("Erro na consulta: " + res.mensagem);
    }
  }, [XEmpresaId]);

  // ── Helper ──────────────────────────────────────────────────
  const fmt2 = (v: number) =>
    Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <StandardCrudForm<IMdfCabecalho>
      config={{
        XTableName: "mdf_cabecalho",
        XPrimaryKey: "mdf_cabecalho_id",
        XTitle: "MDF-e",
        XOrderBy: "mdf_cabecalho_id",
        XDefaultRecord: {
          ...XDefault,
          empresa_id: XEmpresaId,
          cnpj_emit: xEmpresaDados?.cnpj || "",
          ie_emit:   xEmpresaDados?.ie   || "",
        } as any,
        XEmpresaId,
        XSoftDelete: true,
        XOnBeforeSave: (rec) => {
          if (!rec.nr_mdf?.trim()) throw new Error("Informe o número do MDF-e.");
          if (!rec.dt_emissao)     throw new Error("Informe a data de emissão.");
          if (!rec.placa_veiculo?.trim()) throw new Error("Informe a placa do veículo.");
          if (!rec.condutor_nome?.trim()) throw new Error("Informe o nome do condutor.");
          return {
            ...rec,
            empresa_id:  rec.empresa_id || XEmpresaId,
            cnpj_emit:   xEmpresaDados?.cnpj || rec.cnpj_emit || "",
            ie_emit:     xEmpresaDados?.ie   || rec.ie_emit   || "",
          };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="MDF-e"
      XRefreshRef={XRefreshRef}
      XAfterInsertTab="nfs"
      XExtraTabs={[
        {
          key: "nfs",
          label: "Documentos (NF-e)",
          render: ({ record, currentRecord, isEditing }) => {
            const id = (currentRecord || record)?.mdf_cabecalho_id || null;
            const st = (currentRecord || record)?.st_mdf || "A";
            return (
              <MdfNfsTab
                mdfCabecalhoId={id}
                empresaId={XEmpresaId}
                podeEditar={st === "A"}
              />
            );
          },
        },
        {
          key: "reboques",
          label: "Reboques",
          render: ({ record, currentRecord }) => {
            const id = (currentRecord || record)?.mdf_cabecalho_id || null;
            const st = (currentRecord || record)?.st_mdf || "A";
            return (
              <MdfReboquesTab
                mdfCabecalhoId={id}
                empresaId={XEmpresaId}
                podeEditar={st === "A"}
              />
            );
          },
        },
        {
          key: "log",
          label: "Log Transmissão",
          render: ({ record, currentRecord }) => {
            const id = (currentRecord || record)?.mdf_cabecalho_id || null;
            return <MdfLogTab mdfCabecalhoId={id} />;
          },
        },
      ]}
      renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => {
        const ro = !isEditing;
        const stAtual = (record.st_mdf || "A") as TMdfSt;
        const cabId = currentRecord?.mdf_cabecalho_id || null;
        const podeEmitir    = cabId && stAtual === "A" && !isEditing;
        const podeEncerrar  = cabId && stAtual === "X" && !isEditing;
        const podeCancelar  = cabId && stAtual === "X" && !isEditing;
        const podeConsultar = cabId && (stAtual === "X" || stAtual === "E") && !isEditing;

        return (
          <div className="space-y-4">

            {/* ── Linha 1: Identificação + Status + Ações ── */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Cód.</label>
                <input readOnly value={record.mdf_cabecalho_id ?? (mode === "insert" ? "(Novo)" : "")}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Nº MDF-e <span className="text-destructive">*</span></label>
                <input readOnly={ro} value={record.nr_mdf ?? ""}
                  onChange={e => setField("nr_mdf", e.target.value)}
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
                  value={(record.dt_emissao || "").toString().substring(0, 10)}
                  onChange={e => setField("dt_emissao", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Início Viagem <span className="text-destructive">*</span></label>
                <input type="date" readOnly={ro}
                  value={(record.dt_ini_viagem || "").toString().substring(0, 10)}
                  onChange={e => setField("dt_ini_viagem", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Status</label>
                <input readOnly
                  value={MDF_ST_LABELS[stAtual] || stAtual}
                  className={`w-full border border-border rounded px-2 py-1 text-sm font-semibold bg-secondary ${MDF_ST_COLORS[stAtual]}`} />
              </div>
              {/* Botões de ação */}
              <div className="col-span-2 flex gap-1 flex-wrap items-end">
                {podeEmitir && (
                  <button onClick={() => handleEmitir(cabId!)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700">
                    <Send className="w-3.5 h-3.5" /> Emitir
                  </button>
                )}
                {podeEncerrar && (
                  <button onClick={() => handleEncerrar(cabId!)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">
                    <Lock className="w-3.5 h-3.5" /> Encerrar
                  </button>
                )}
                {podeCancelar && (
                  <button onClick={() => handleCancelar(cabId!)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700">
                    <XCircle className="w-3.5 h-3.5" /> Cancelar
                  </button>
                )}
                {podeConsultar && (
                  <button onClick={() => handleConsultar(cabId!)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-secondary text-secondary-foreground hover:bg-secondary/80">
                    <Activity className="w-3.5 h-3.5" /> Consultar
                  </button>
                )}
              </div>
            </div>

            {/* ── Linha 2: Percurso ── */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">UF Ini (Carregamento) <span className="text-destructive">*</span></label>
                <select disabled={ro} value={record.uf_ini || "PR"}
                  onChange={e => setField("uf_ini", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">UF Fim (Descarregamento) <span className="text-destructive">*</span></label>
                <select disabled={ro} value={record.uf_fim || "SP"}
                  onChange={e => setField("uf_fim", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div className="col-span-8">
                <label className="text-xs text-muted-foreground">Cidades Percurso (separadas por ";")</label>
                <input readOnly={ro} value={record.cidades_percurso ?? ""}
                  onChange={e => setField("cidades_percurso", e.target.value)}
                  placeholder="Ex: PONTA GROSSA;LONDRINA;MARINGA"
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
            </div>

            {/* ── Linha 3: Veículo tração ── */}
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Veículo de Tração</p>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Placa <span className="text-destructive">*</span></label>
                  <input readOnly={ro} value={record.placa_veiculo ?? ""}
                    onChange={e => setField("placa_veiculo", e.target.value.toUpperCase())}
                    className="w-full border border-border rounded px-2 py-1 text-sm font-mono uppercase" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">RNTRC</label>
                  <input readOnly={ro} value={record.rntrc_veiculo ?? ""}
                    onChange={e => setField("rntrc_veiculo", e.target.value)}
                    className="w-full border border-border rounded px-2 py-1 text-sm" />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-muted-foreground">UF</label>
                  <select disabled={ro} value={record.uf_veiculo || "PR"}
                    onChange={e => setField("uf_veiculo", e.target.value)}
                    className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                    {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Tp. Rodado</label>
                  <select disabled={ro} value={record.tp_rodado || "01"}
                    onChange={e => setField("tp_rodado", e.target.value)}
                    className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                    {TP_RODADO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Tp. Carroceria</label>
                  <select disabled={ro} value={record.tp_carroceria || "00"}
                    onChange={e => setField("tp_carroceria", e.target.value)}
                    className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                    {TP_CARROCERIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-muted-foreground">Tara (kg)</label>
                  <input readOnly={ro} type="number" value={record.tara_veiculo ?? 0}
                    onChange={e => setField("tara_veiculo", Number(e.target.value))}
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-muted-foreground">Cap. KG</label>
                  <input readOnly={ro} type="number" value={record.cap_kg_veiculo ?? 0}
                    onChange={e => setField("cap_kg_veiculo", Number(e.target.value))}
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-muted-foreground">Cap. M³</label>
                  <input readOnly={ro} type="number" value={record.cap_m3_veiculo ?? 0}
                    onChange={e => setField("cap_m3_veiculo", Number(e.target.value))}
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
              </div>
            </div>

            {/* ── Linha 4: Condutor ── */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-6">
                <label className="text-xs text-muted-foreground">Condutor — Nome <span className="text-destructive">*</span></label>
                <input readOnly={ro} value={record.condutor_nome ?? ""}
                  onChange={e => setField("condutor_nome", e.target.value.toUpperCase())}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Condutor — CPF</label>
                <input readOnly={ro} value={record.condutor_cpf ?? ""}
                  onChange={e => setField("condutor_cpf", e.target.value.replace(/\D/g, "").substring(0, 11))}
                  placeholder="00000000000"
                  className="w-full border border-border rounded px-2 py-1 text-sm font-mono" />
              </div>
            </div>

            {/* ── Linha 5: Totais de carga ── */}
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Totais da Carga</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Qtd. NF-e</label>
                  <input readOnly={ro} type="number" value={record.qt_nf ?? 0}
                    onChange={e => setField("qt_nf", Number(e.target.value))}
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Vl. Carga (R$)</label>
                  <input readOnly={ro} type="number" value={record.vl_carga ?? 0}
                    onChange={e => setField("vl_carga", Number(e.target.value))}
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Peso (KG)</label>
                  <input readOnly={ro} type="number" value={record.kg_carga ?? 0}
                    onChange={e => setField("kg_carga", Number(e.target.value))}
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Unid. Medida</label>
                  <select disabled={ro} value={record.unid_medida_carga || "KG"}
                    onChange={e => setField("unid_medida_carga", e.target.value)}
                    className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                    <option value="KG">KG</option>
                    <option value="TON">TON</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Linha 6: Chave / Protocolo (autorização) ── */}
            {stAtual !== "A" && (
              <div className="border border-border rounded-lg p-3 bg-card">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dados da Autorização</p>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-7">
                    <label className="text-xs text-muted-foreground">Chave MDF-e (44 dígitos)</label>
                    <input readOnly value={record.chave_mdf ?? ""}
                      className="w-full border border-border rounded px-2 py-1 text-sm font-mono bg-secondary" />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground">Nº Protocolo</label>
                    <input readOnly value={record.nr_protocolo ?? ""}
                      className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Dt. Autorização</label>
                    <input readOnly
                      value={record.dt_autorizacao
                        ? new Date(record.dt_autorizacao).toLocaleString("pt-BR")
                        : ""}
                      className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Observações ── */}
            <div>
              <label className="text-xs text-muted-foreground">Observações / Inf. Adicionais</label>
              <textarea readOnly={ro} value={record.obs_mdf ?? ""}
                onChange={e => setField("obs_mdf", e.target.value)}
                className="w-full border border-border rounded px-2 py-2 text-sm min-h-[60px]" />
            </div>

          </div>
        );
      }}
    />
  );
};

export default MdfeForm;
