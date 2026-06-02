import React, { useCallback, useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { Send, Lock, XCircle } from "lucide-react";
import { mdfeEmissaoService } from "../services/mdfeEmissaoService";

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

const validarObrigatoriedadesTransporte = async (rec: any) => {
  const tpTransp = rec.tp_transportador;
  const tpEmit = rec.tp_emitente ?? "1";

  // Se tpTransp não for informado, mas tpEmit for 1 ou 3, tpTransp é obrigatório.
  if (!tpTransp && tpEmit !== "2") {
    throw new Error("Tipo de Transportador é obrigatório para Prestadores de Serviço de Transporte (tpEmit 1 ou 3).");
  }

  if (!tpTransp) {
    return;
  }

  // Se o manifesto já foi salvo e possui ID, validamos o veículo e o transportador
  if (rec.mdf_manifesto_id) {
    const { data: veic } = await supabase
      .from("fiscal_mdf_veiculo")
      .select("mdf_veiculo_id")
      .eq("mdf_manifesto_id", rec.mdf_manifesto_id)
      .eq("tp_veiculo", "TRACAO")
      .eq("excluido", false);

    const temTracao = veic && veic.length > 0;

    if (temTracao) {
      if (!rec.transp_cnpj_cpf || !rec.transp_cnpj_cpf.trim()) {
        throw new Error("CNPJ/CPF do Transportador é obrigatório (vincule um veículo de tração com proprietário cadastrado).");
      }
      const cleanTransp = rec.transp_cnpj_cpf.replace(/\D/g, "");

      // TAC (2) exige CPF do transportador
      if (tpTransp === "2") {
        if (cleanTransp.length !== 11) {
          throw new Error("Para TAC, o documento do transportador deve ser um CPF (11 dígitos).");
        }
      } else {
        // ETC (1) e CTC (3) exigem CNPJ do transportador
        if (cleanTransp.length !== 14) {
          throw new Error("Para ETC/CTC, o documento do transportador deve ser um CNPJ (14 dígitos).");
        }
      }
    }
  }

  // Regras específicas de TAC (2)
  if (tpTransp === "2") {
    // Contratante obrigatório
    if (!rec.contratante_cnpj_cpf || !rec.contratante_cnpj_cpf.trim()) {
      throw new Error("CNPJ/CPF do Contratante é obrigatório para TAC.");
    }
    if (!rec.contratante_nome || !rec.contratante_nome.trim()) {
      throw new Error("Nome do Contratante é obrigatório para TAC.");
    }

    // Vale-Pedágio obrigatório
    if (rec.mdf_manifesto_id) {
      const { data: vales } = await supabase
        .from("fiscal_mdf_componente")
        .select("mdf_componente_id")
        .eq("mdf_manifesto_id", rec.mdf_manifesto_id)
        .eq("tp_componente", "01")
        .eq("excluido", false);
      
      if (!vales || vales.length === 0) {
        throw new Error("Vale-Pedágio (Componente de Pagamento '01') é obrigatório para TAC.");
      }
    }
  }
};

const XDefault = {
  numero: "", serie: "1", modelo: "58",
  dt_emissao: new Date().toISOString().substring(0, 10),
  dt_viagem:  new Date().toISOString().substring(0, 10),
  hr_viagem: "00:00:00",
  modalidade: "1", tp_emitente: "1", tp_transportador: "",
  rntrc: "",
  ufini: "", uffim: "", unidade: "KG",
  peso_total: 0, valor_total: 0, qtd_nfe: 0, status: "D",
  ciot: "", ciot_cnpj_cpf: "", contratante_cnpj_cpf: "", contratante_nome: "", transp_cnpj_cpf: "",
};

const isInfPagMandatory = (record: any) => {
  if (!record) return false;
  const modal = record.modalidade ?? "1"; // "1" = Rodoviário
  const qtdDfe = Number(record.qtd_nfe ?? 0);
  const tpEmit = Number(record.tp_emitente ?? 1);
  const tpTransp = record.tp_transportador;

  if (modal !== "1") return false;
  if (qtdDfe !== 1) return false;

  if (tpEmit === 1) return true;
  if (tpEmit === 2 && tpTransp && String(tpTransp).trim() !== "") return true;
  if (tpEmit === 3) return true;

  return false;
};

interface IProps {
  initialId?: number;
}

const MdfeForm: React.FC<IProps> = ({ initialId }) => {
  const { XEmpresaId } = useAppContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XRefreshRef = useRef<any>(null);
  const [selectedCadastroId, setSelectedCadastroId] = useState<number | null>(null);
  const [refreshMotoristasTrigger, setRefreshMotoristasTrigger] = useState(0);

  const handleTransmitir = useCallback(async (manifestoId: number) => {
    if (!confirm("Confirma a emissão do MDF-e? O documento será enviado ao SEFAZ via ACBr.")) return;
    toast.loading("Transmitindo MDF-e...", { id: "mdf-tx" });
    try {
      // 1. Validar se o manifesto está pronto para transmissão
      const { data: manifesto, error: errMdf } = await supabase
        .from("fiscal_mdf_manifesto")
        .select("tp_transportador, transp_cnpj_cpf, contratante_cnpj_cpf, contratante_nome")
        .eq("mdf_manifesto_id", manifestoId)
        .single();
      
      if (errMdf || !manifesto) throw new Error("Manifesto não localizado.");

      if (manifesto.tp_transportador) {
        // Verificar se há veículo TRACAO cadastrado
        const { data: veiculoTracao } = await supabase
          .from("fiscal_mdf_veiculo")
          .select("veiculo_id")
          .eq("mdf_manifesto_id", manifestoId)
          .eq("tp_veiculo", "TRACAO")
          .eq("excluido", false)
          .maybeSingle();

        if (!veiculoTracao) {
          throw new Error("É obrigatório adicionar um Veículo do tipo TRAÇÃO no manifesto antes de transmitir.");
        }

        if (!manifesto.transp_cnpj_cpf || !manifesto.transp_cnpj_cpf.trim()) {
          throw new Error("O CNPJ/CPF do Transportador é obrigatório. Certifique-se de que o Proprietário do Veículo de Tração possui um documento (CNPJ/CPF) cadastrado.");
        }

        if (manifesto.tp_transportador === "2") { // TAC
          if (!manifesto.contratante_cnpj_cpf || !manifesto.contratante_nome) {
            throw new Error("CNPJ/CPF e Nome do Contratante são obrigatórios para TAC.");
          }
        }
      }

      const res = await mdfeEmissaoService.emitirMdfe(manifestoId, XEmpresaId);
      if (res.success) {
        toast.success(res.mensagem || "MDF-e transmitido com sucesso!");
        XRefreshRef.current?.();
      } else {
        toast.error(res.mensagem || "Erro na transmissão");
      }
    } catch (e: unknown) {
      const errorObj = e as Error;
      toast.error(errorObj.message || "Erro na transmissão");
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        XDefaultRecord: { ...XDefault, empresa_id: XEmpresaId } as any,
        XOnBeforeSave: async (rec) => {
          if (!rec.ufini?.trim()) throw new Error("UF Inicial é obrigatória.");
          if (!rec.uffim?.trim()) throw new Error("UF Final é obrigatória.");
          if (!rec.dt_emissao)   throw new Error("Data de Emissão é obrigatória.");
          if (!rec.dt_viagem)    throw new Error("Data da Viagem é obrigatória.");
          if (!rec.hr_viagem)    throw new Error("Hora da Viagem é obrigatória.");
          
          if (rec.tp_transportador) {
            // Contratante: Buscar da tabela 'empresa'
            const { data: empData } = await supabase
              .from("empresa")
              .select("cnpj, razao_social")
              .eq("empresa_id", XEmpresaId)
              .single();

            if (empData) {
              rec.contratante_cnpj_cpf = empData.cnpj;
              rec.contratante_nome = empData.razao_social;
            }

            // Transportador: Buscar a partir do veículo TRACAO do manifesto
            if (rec.mdf_manifesto_id) {
              const { data: veiculoTracao } = await supabase
                .from("fiscal_mdf_veiculo")
                .select("veiculo_id")
                .eq("mdf_manifesto_id", rec.mdf_manifesto_id)
                .eq("tp_veiculo", "TRACAO")
                .eq("excluido", false)
                .maybeSingle();

              if (veiculoTracao) {
                const { data: cadVeiculo } = await supabase
                  .from("cadastro_veiculo")
                  .select("cadastro_id")
                  .eq("veiculo_id", veiculoTracao.veiculo_id)
                  .maybeSingle();

                if (cadVeiculo && cadVeiculo.cadastro_id) {
                  const { data: cadastro } = await supabase
                    .from("cadastro")
                    .select("cnpj, rntrc")
                    .eq("cadastro_id", cadVeiculo.cadastro_id)
                    .maybeSingle();

                  if (cadastro) {
                    if (cadastro.cnpj) rec.transp_cnpj_cpf = cadastro.cnpj;
                    if (cadastro.rntrc) rec.rntrc = cadastro.rntrc;
                  }
                }
              }
            }
          } else {
            rec.transp_cnpj_cpf = null;
            rec.contratante_cnpj_cpf = null;
            rec.contratante_nome = null;
            rec.rntrc = null;
          }

          await validarObrigatoriedadesTransporte(rec);
          
          // Lógica de Sequencial Automático (apenas na inclusão)
          if (!rec.mdf_manifesto_id) {
            const { data: { user } } = await supabase.auth.getUser();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: func } = await supabase.from("funcionario").select("mdf_config_item").eq("usr_id", (user as any)?.usr_id || 0).maybeSingle();
            
            let configId = func?.mdf_config_item;
            if (!configId) {
              const { data: defCfg } = await supabase.from("fiscal_config_item")
                .select("fiscal_config_item_id")
                .eq("empresa_id", XEmpresaId)
                .eq("modelo", "58")
                .limit(1).maybeSingle();
              configId = defCfg?.fiscal_config_item_id;
            }

            if (!configId) throw new Error("Configuração de série/sequencial de MDF-e não localizada para esta empresa.");

            // Buscar e incrementar o número atomicamente (ou quase)
            const { data: cfg, error: errCfg } = await supabase.from("fiscal_config_item")
              .select("sequencia, serie")
              .eq("fiscal_config_item_id", configId)
              .single();

            if (errCfg || !cfg) throw new Error("Erro ao obter sequencial: " + errCfg?.message);

            rec.numero = cfg.sequencia;
            rec.serie = cfg.serie;
            rec.codigo_numerico = Math.floor(Math.random() * 90000000) + 10000000;

            // Incrementar para o próximo
            await supabase.from("fiscal_config_item")
              .update({ sequencia: Number(cfg.sequencia) + 1 })
              .eq("fiscal_config_item_id", configId);
          }

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
      XAfterInsertTab="percurso"
      XCadastroLabel="Dados Gerais"
      XHiddenTabs={(rec) => {
        const mandatory = isInfPagMandatory(rec);
        return !mandatory ? ["pagamento", "componentes", "parcelas"] : [];
      }}
      XExtraTabs={[
        {
          key: "percurso", label: "Percurso",
          render: ({ currentRecord, record, setField, isEditing }) => (
            <MdfPercursoTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={currentRecord?.status === "D"}
              record={record}
              setField={setField}
              isEditing={isEditing}
            />
          ),
        },
        {
          key: "docs", label: "Documentos",
          render: ({ currentRecord }) => (
            <MdfDocumentosTab
              mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
              empresaId={XEmpresaId}
              podeEditar={currentRecord?.status === "D"}
            />
          ),
        },
        {
          key: "veiculos", label: "Veículos / Motoristas",
          render: ({ currentRecord }) => (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="border border-border rounded p-4 bg-card/20 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-3">Veículos</h3>
                <MdfVeiculosTab
                  mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
                  empresaId={XEmpresaId}
                  podeEditar={currentRecord?.status === "D"}
                  onTracaoCadastroIdChange={setSelectedCadastroId}
                  onMotoristasChanged={() => setRefreshMotoristasTrigger(p => p + 1)}
                />
              </div>
              <div className="border border-border rounded p-4 bg-card/20 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-3">Motoristas</h3>
                <MdfMotoristasTab
                  mdfManifestoId={currentRecord?.mdf_manifesto_id ?? null}
                  empresaId={XEmpresaId}
                  podeEditar={currentRecord?.status === "D"}
                  veiculoCadastroId={selectedCadastroId}
                  refreshTrigger={refreshMotoristasTrigger}
                />
              </div>
            </div>
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
                <label className="text-xs text-muted-foreground">Número</label>
                <input readOnly
                  value={record.numero ?? ""}
                  placeholder="Automático"
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary font-bold text-primary" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Série</label>
                <input readOnly
                  value={record.serie ?? ""}
                  placeholder="Auto"
                  className="w-full border border-border rounded px-2 py-1 text-sm text-center bg-secondary" />
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

            {/* ── Linha 2: Viagem + Modalidade ── */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Dt. Viagem <span className="text-destructive">*</span></label>
                <input type="date" readOnly={ro}
                  value={String(record.dt_viagem || "").substring(0, 10)}
                  onChange={e => setField("dt_viagem", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Hora Viagem <span className="text-destructive">*</span></label>
                <input type="time" readOnly={ro}
                  value={record.hr_viagem ?? "00:00:00"}
                  onChange={e => setField("hr_viagem", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-3">
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
              <div className="col-span-3">
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
              <div className="col-span-6">
                <label className="text-xs text-muted-foreground">Tipo Emitente <span className="text-destructive">*</span></label>
                <select disabled={ro} value={record.tp_emitente ?? "1"}
                  onChange={e => setField("tp_emitente", e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="1">1 - Prestador de serviço de transporte</option>
                  <option value="2">2 - Transportador de carga própria</option>
                  <option value="3">3 - Prestador de serviço de transporte (Carga própria)</option>
                </select>
              </div>
              <div className="col-span-6">
                <label className="text-xs text-muted-foreground">
                  Tipo Transportador {record.tp_emitente !== "2" && <span className="text-destructive">*</span>}
                </label>
                <select disabled={ro} value={record.tp_transportador ?? ""}
                  onChange={e => setField("tp_transportador", e.target.value || null)}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="">(Não Informado / Carga Própria)</option>
                  <option value="1">1 - ETC (Empresa de Transporte de Cargas)</option>
                  <option value="2">2 - TAC (Transportador Autônomo de Cargas)</option>
                  <option value="3">3 - CTC (Cooperativa de Transporte de Cargas)</option>
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
            {/* ── Dados Fiscais (SEFAZ) ── */}
            {(record.chave_acesso || record.numero_protocolo) && (
              <div className="border border-green-200 rounded p-3 bg-green-50/30">
                <p className="text-xs font-bold text-green-700 mb-2 uppercase tracking-wide">Dados de Autorização (SEFAZ)</p>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-8">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Chave de Acesso</label>
                    <input readOnly value={record.chave_acesso || ""} 
                      className="w-full border border-green-200 rounded px-2 py-1 text-xs font-mono bg-white text-green-800" />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Protocolo</label>
                    <input readOnly value={record.numero_protocolo || ""} 
                      className="w-full border border-green-200 rounded px-2 py-1 text-xs font-mono bg-white text-green-800" />
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      }}
    />
  );
};

export default MdfeForm;
