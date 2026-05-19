import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import NfeItensTab from "./NfeItensTab";
import NfePagamentoTab from "./NfePagamentoTab";
import type { INfeCabecalho, TNfeSt } from "./types";
import { NFE_ST_LABELS } from "./types";
import { Search, Send } from "lucide-react";
import { formatCPFCNPJ } from "@/lib/validators";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";

const db = supabase as any;

interface IClienteInfo { id: number; cnpj: string; razao: string; }

const XGridCols: IGridColumn[] = [
  { key: "nfe_cabecalho_id", label: "ID",      width: "60px",  align: "right" },
  { key: "pedido_id",        label: "Pedido",  width: "80px",  align: "right", render: r => r.pedido_id || r.movimento_id || "" },
  { key: "tp_nf",            label: "Tipo",    width: "70px",  render: r => r.tp_nf === 0 ? "Entrada" : "Saída" },
  { key: "nr_nota",          label: "Nota",    width: "90px" },
  { key: "serie",            label: "Série",   width: "50px",  align: "center" },
  { key: "modelo",           label: "Mod.",    width: "50px",  align: "center" },
  { key: "dt_emissao",       label: "Emissão", width: "100px", render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
  { key: "_dest",            label: "Destinatário", width: "2fr", getValue: (r: any) => r._dest_razao || "", render: (r: any) => r._dest_razao || (r.cadastro_id ? `#${r.cadastro_id}` : "") },
  { 
    key: "st_nf", 
    label: "Status", 
    width: "100px", 
    render: r => {
      const label = NFE_ST_LABELS[r.st_nf as TNfeSt] || r.st_nf;
      const colors: any = {
        "E": "bg-green-100 text-green-700",
        "C": "bg-red-100 text-red-700",
        "D": "bg-orange-100 text-orange-700",
        "R": "bg-red-100 text-red-700",
        "A": "bg-blue-100 text-blue-700",
        "1": "bg-green-100 text-green-700",
        "2": "bg-orange-100 text-orange-700",
      };
      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colors[r.st_nf] || "bg-gray-100 text-gray-600"}`}>
          {label}
        </span>
      );
    }
  },
  { key: "vl_total_nf",      label: "Total",   width: "110px", align: "right", render: r => Number(r.vl_total_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
  { key: "chave_nfe",        label: "Chave de Acesso", width: "300px", render: r => <span className="font-mono text-[10px]">{r.chave_nfe}</span> },
];

const XDefault: Partial<INfeCabecalho> = {
  origem_inclusao: "M",
  st_nf: "A",
  tp_nf: 1, // 1 = saída
  fin_nfe: 1,
  tp_emis: 1,
  modelo: "55",
  nat_op: "Venda de Mercadoria",
  nr_nota: "",
  serie: "1",
  chave_nfe: "",
  nr_protocolo: "",
  vl_produto: 0, vl_desconto: 0, vl_frete: 0, vl_seguro: 0, vl_despesa: 0,
  vl_ipi: 0, vl_icms_st: 0, vl_pis: 0, vl_cofins: 0,
  vl_ibs: 0, vl_cbs: 0, vl_is: 0, vl_total_nf: 0,
  obs_nf: "",
  dt_emissao: new Date().toISOString().substring(0, 10),
  dt_saida: new Date().toISOString().substring(0, 10),
};

const NfeEmitidaForm: React.FC<{ initialId?: number }> = ({ initialId }) => {
  const { XEmpresaId, XEmpresaMatrizId } = useAppContext();

  const [XClienteCache, setXClienteCache] = useState<Record<number, IClienteInfo>>({});
  const [XDepositos, setXDepositos] = useState<{ deposito_id: number; nome: string }[]>([]);
  const XClienteCacheRef = useRef<Record<number, IClienteInfo>>(XClienteCache);
  useEffect(() => { XClienteCacheRef.current = XClienteCache; }, [XClienteCache]);

  const XRefreshRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    db.from("deposito").select("deposito_id,nome").eq("excluido", false).order("nome")
      .then(({ data }: any) => setXDepositos(data || []));
  }, [XEmpresaId]);

  const ensureClienteInfo = useCallback(async (ids: number[]) => {
    const faltando = ids.filter(id => id && !XClienteCacheRef.current[id]);
    if (!faltando.length) return;
    const { data } = await db.from("cadastro")
      .select("cadastro_id,cnpj,razao_social")
      .in("cadastro_id", faltando);
    if (data) {
      setXClienteCache(prev => {
        const next = { ...prev };
        for (const c of data as any[]) {
          next[c.cadastro_id] = { id: c.cadastro_id, cnpj: c.cnpj || "", razao: c.razao_social || "" };
        }
        return next;
      });
    }
  }, []);

  const gridCols = useMemo(() => XGridCols.map(c =>
    c.key === "_dest" ? { ...c, getValue: (r: any) => XClienteCache[r.cadastro_id]?.razao || "" } : c
  ), [XClienteCache]);

  const fmt2 = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const fmtInput = (v: any) => (v === 0 || v === "0" || v === "" || v === undefined || v === null) ? "" : String(v).replace(".", ",");
  const parseNum = (v: any) => {
    if (v === undefined || v === null || v === "") return 0;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };
  const handleBlur = (key: string, record: any, setField: any) => {
    const current = record[key];
    if (current === undefined || current === null || current === "") return;
    setField(key, parseNum(current).toFixed(2).replace(".", ","));
  };

  return (
    <StandardCrudForm<INfeCabecalho>
      config={{
        XTableName: "fiscal_nfe_cabecalho",
        XPrimaryKey: "nfe_cabecalho_id",
        XTitle: "NF-e Emitidas",
        XDefaultRecord: { ...XDefault, empresa_id: XEmpresaId } as any,
        XEmpresaId,
        XSelectCols: "*",
        XOrderBy: "nfe_cabecalho_id",
        XSoftDelete: false,
        XApplyFilter: (q) => q, // Remove filter to show both Entry/Exit or allow user to filter
        XCanEdit: (rec: any) => !["E", "C", "D", "1", "2"].includes(String(rec.st_nf)),
        XOnAfterLoad: (rows: any[]) => {
          const ids = [...new Set(rows.map(r => r.cadastro_id).filter(Boolean))] as number[];
          if (ids.length) ensureClienteInfo(ids);
        },
        XOnBeforeSave: (rec: any) => {
          if (rec.tp_nf === undefined || rec.tp_nf === null) rec.tp_nf = 1;
          return { ...rec, empresa_id: rec.empresa_id || XEmpresaId };
        },
      }}
      XGridCols={gridCols}
      XExportTitle="NF-e Emitidas"
      XAfterInsertTab="itens"
      XRefreshRef={XRefreshRef}
      XInitialId={initialId}
      XToolbarExtras={({ currentRecord, isEditing, refresh }) => {
        if (!currentRecord || isEditing) return null;
        const st = String(currentRecord.st_nf || "");
        // Permite enviar quando: Aberta (A), Rejeitada (R/3) ou em re-tentativa
        const podeEnviar = ["A", "R", "3", "P"].includes(st) && Number(currentRecord.tp_nf) === 1;
        if (!podeEnviar) return null;
        return (
          <button
            type="button"
            onClick={async () => {
              if (!confirm(`Enviar NF-e #${currentRecord.nfe_cabecalho_id} para a SEFAZ via fiscal-worker?`)) return;
              const tid = toast.loading("Enviando para fila do fiscal-worker...");
              try {
                const res = await fiscalEmissaoService.retransmitirDocumento(
                  currentRecord.nfe_cabecalho_id,
                  XEmpresaId
                );
                toast.dismiss(tid);
                if (res.success) {
                  toast.success(`Evento #${res.fiscal_evento_id} enfileirado. Aguarde o fiscal-worker processar.`);
                  await refresh();
                } else {
                  toast.error("Falha: " + (res.message || "Erro desconhecido"));
                }
              } catch (e: any) {
                toast.dismiss(tid);
                toast.error("Erro: " + e.message);
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 shadow-sm"
            title="Cria evento PENDENTE no fiscal_evento para que o fiscal-worker transmita a NF-e à SEFAZ"
          >
            <Send className="w-3.5 h-3.5" /> ENVIAR SEFAZ
          </button>
        );
      }}
      XExtraTabs={[
        {
          key: "itens", label: "Itens da NF-e",
          render: ({ record, currentRecord }) => {
            const id = (currentRecord || record)?.nfe_cabecalho_id || null;
            const st = (currentRecord || record)?.st_nf || "A";
            const podeEditar = !["E", "C", "D", "1", "2"].includes(String(st));
            return (
              <NfeItensTab nfeCabecalhoId={id} empresaId={XEmpresaId} podeEditar={podeEditar} />
            );
          },
        },
        {
          key: "pagamentos", label: "Pagamentos",
          render: ({ record, currentRecord }) => {
            const id = (currentRecord || record)?.nfe_cabecalho_id || null;
            const st = (currentRecord || record)?.st_nf || "A";
            const podeEditar = !["E", "C", "D", "1", "2"].includes(String(st));
            return <NfePagamentoTab nfeCabecalhoId={id} podeEditar={podeEditar} />;
          },
        },
        {
          key: "adicionais", label: "Dados Adicionais",
          render: ({ record, setField, isEditing }) => {
            const ro = !isEditing;
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-6">
                    <label className="text-xs text-muted-foreground">Chave NF-e (44 dígitos)</label>
                    <input readOnly={ro} value={record.chave_nfe ?? ""} onChange={e => setField("chave_nfe" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm font-mono" />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground">Nº Protocolo</label>
                    <input readOnly={ro} value={record.nr_protocolo ?? ""} onChange={e => setField("nr_protocolo" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground">Recibo SEFAZ</label>
                    <input readOnly value={record.recibo_sefaz ?? ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground">cStat</label>
                    <input readOnly value={record.c_stat ?? ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                  </div>
                  <div className="col-span-9">
                    <label className="text-xs text-muted-foreground">Motivo SEFAZ</label>
                    <input readOnly value={record.x_motivo ?? ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Observações da NF-e</label>
                  <textarea readOnly={ro} value={record.obs_nf ?? ""} onChange={e => setField("obs_nf" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-2 text-sm min-h-[100px]" />
                </div>

                {/* Cancelamento */}
                <div className="border border-border rounded p-3 bg-card">
                  <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Cancelamento</p>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs text-muted-foreground">Dt. Cancelamento</label>
                      <input readOnly value={(record as any).dt_cancelamento ? new Date((record as any).dt_cancelamento).toLocaleString("pt-BR") : ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-muted-foreground">Protocolo Cancel.</label>
                      <input readOnly value={(record as any).protocolo_cancelamento ?? ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary font-mono" />
                    </div>
                    <div className="col-span-6">
                      <label className="text-xs text-muted-foreground">Motivo Cancelamento</label>
                      <input readOnly={ro} value={(record as any).motivo_cancelamento ?? ""} onChange={e => setField("motivo_cancelamento" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                    </div>
                  </div>
                </div>

                {/* XML */}
                <div>
                  <label className="text-xs text-muted-foreground">XML da NF-e</label>
                  <textarea readOnly value={record.xml_nf ?? ""} className="w-full border border-border rounded px-2 py-2 text-[10px] font-mono min-h-[120px] bg-secondary/50" />
                </div>
              </div>
            );
          },
        },
      ]}
      renderCadastro={({ record, setField, mode, isEditing }) => {
        const ro = !isEditing;
        const stAtual = (record.st_nf || "A") as TNfeSt;

        return (
          <div className="space-y-4">
            {/* Linha 1 */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">ID</label>
                <input readOnly value={record.nfe_cabecalho_id ?? (mode === "insert" ? "(Novo)" : "")} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Pedido</label>
                <input readOnly value={(record as any).pedido_id ?? (record as any).movimento_id ?? ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right" title="Nº do pedido (movimento) que originou esta nota" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Tipo de Nota</label>
                <select disabled={ro} value={record.tp_nf ?? 1} onChange={e => setField("tp_nf" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value={1}>1 - Saída</option>
                  <option value={0}>0 - Entrada</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Origem</label>
                <input readOnly value={record.origem_inclusao === "X" ? "XML" : "Manual"} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-center" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Modelo</label>
                <select disabled={ro} value={record.modelo ?? 55} onChange={e => setField("modelo" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value={55}>55</option>
                  <option value={65}>65</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Nº Nota <span className="text-destructive">*</span></label>
                <input readOnly={ro} type="number" value={record.nr_nota || ""} onChange={e => setField("nr_nota" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Série</label>
                <input readOnly={ro} type="number" value={record.serie || ""} onChange={e => setField("serie" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm text-center" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Dt. Emissão <span className="text-destructive">*</span></label>
                <input type="date" readOnly={ro} value={(record.dt_emissao || "").toString().substring(0, 10)} onChange={e => setField("dt_emissao" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Dt. Saída</label>
                <input type="date" readOnly={ro} value={(record.dt_saida || "").toString().substring(0, 10)} onChange={e => setField("dt_saida" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Dt. Entrada</label>
                <input type="date" readOnly={ro} value={((record as any).dt_entrada || "").toString().substring(0, 10)} onChange={e => setField("dt_entrada" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <input readOnly value={NFE_ST_LABELS[stAtual] || stAtual} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
              </div>
            </div>

            {/* Linha 2: Destinatário + Depósito */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-8">
                <label className="text-xs text-muted-foreground">Destinatário <span className="text-destructive">*</span></label>
                <div className="flex gap-1">
                  <input
                    readOnly
                    value={record.cadastro_id ? (XClienteCache[record.cadastro_id]?.razao || `#${record.cadastro_id}`) : ""}
                    placeholder="Selecione o destinatário..."
                    className="flex-1 border border-border rounded px-2 py-1 text-sm bg-secondary"
                  />
                  {isEditing && (
                    <button
                      type="button"
                      onClick={async () => {
                        const val = prompt("Digite o CNPJ/CPF ou parte da Razão Social:");
                        if (!val) return;
                        const digits = val.replace(/\D/g, "");
                        let q = db.from("cadastro").select("cadastro_id,cnpj,razao_social")
                          .eq("empresa_id", XEmpresaMatrizId).eq("excluido", false);
                        if (digits.length >= 8) q = q.ilike("cnpj", `%${digits}%`);
                        else q = q.ilike("razao_social", `%${val}%`);
                        const { data } = await q.limit(10);
                        if (!data?.length) { toast.warning("Nenhum cadastro encontrado."); return; }
                        const opcoes = data.map((c: any) => `${c.cadastro_id} — ${formatCPFCNPJ(c.cnpj)} — ${c.razao_social}`).join("\n");
                        const escolha = prompt(`Escolha (informe o código):\n${opcoes}`);
                        if (!escolha) return;
                        const id = parseInt(escolha);
                        if (!id) return;
                        const found = data.find((c: any) => c.cadastro_id === id);
                        if (found) {
                          setXClienteCache(prev => ({ ...prev, [id]: { id, cnpj: found.cnpj, razao: found.razao_social } }));
                          setField("cadastro_id" as any, id as any);
                        }
                      }}
                      className="px-2 py-1 border border-border rounded bg-card hover:bg-accent"
                      title="Pesquisar destinatário"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="col-span-4">
                <label className="text-xs text-muted-foreground">Depósito de Saída</label>
                <select disabled={ro} value={record.deposito_id ?? ""} onChange={e => setField("deposito_id" as any, (e.target.value ? Number(e.target.value) : null) as any)} className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                  <option value="">— Selecione —</option>
                  {XDepositos.map(d => <option key={d.deposito_id} value={d.deposito_id}>{d.nome}</option>)}
                </select>
              </div>
            </div>

            {/* Linha 3: Natureza Operação + Finalidade + Tipo Emissão */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-6">
                <label className="text-xs text-muted-foreground">Natureza da Operação <span className="text-destructive">*</span></label>
                <input readOnly={ro} value={record.nat_op ?? ""} onChange={e => setField("nat_op" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Finalidade NF-e</label>
                <select disabled={ro} value={record.fin_nfe ?? 1} onChange={e => setField("fin_nfe" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value={1}>1 - Normal</option>
                  <option value={2}>2 - Complementar</option>
                  <option value={3}>3 - Ajuste</option>
                  <option value={4}>4 - Devolução</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Tipo Emissão</label>
                <select disabled={ro} value={record.tp_emis ?? 1} onChange={e => setField("tp_emis" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value={1}>1 - Normal</option>
                  <option value={2}>2 - Contingência FS-IA</option>
                  <option value={4}>4 - Contingência EPEC</option>
                  <option value={9}>9 - Contingência off-line NFC-e</option>
                </select>
              </div>
            </div>

            {/* Totais */}
            <div className="border border-border rounded p-3 bg-card">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide font-bold">Totais da Nota Fiscal</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
                {[
                  { label: "Produtos", key: "vl_produto" },
                  { label: "Desconto", key: "vl_desconto" },
                  { label: "Frete",    key: "vl_frete"    },
                  { label: "Seguro",   key: "vl_seguro"   },
                  { label: "Despesa",  key: "vl_despesa"  },
                  { label: "Outros",   key: "vl_outro"    },
                  { label: "Base Cálc.", key: "vl_bc"     },
                  { label: "ICMS",     key: "vl_icms"     },
                  { label: "ICMS Deson.", key: "vl_icms_deson" },
                  { label: "ICMS-ST",  key: "vl_icms_st"  },
                  { label: "FCP",      key: "vl_fcp"      },
                  { label: "FCP-ST",   key: "vl_fcp_st"   },
                  { label: "FCP-ST Ret.", key: "vl_fcp_st_ret" },
                  { label: "IPI",      key: "vl_ipi"      },
                  { label: "IPI Devol.", key: "vl_ipi_devol" },
                  { label: "II",       key: "vl_ii"       },
                  { label: "PIS",      key: "vl_pis"      },
                  { label: "COFINS",   key: "vl_cofins"   },
                  { label: "IBS",      key: "vl_ibs"      },
                  { label: "CBS",      key: "vl_cbs"      },
                  { label: "IS",       key: "vl_is"       },
                ].map(f => (
                  <div key={f.key} className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted-foreground uppercase font-semibold">{f.label}</label>
                    <input
                      type="text"
                      readOnly={ro}
                      value={ro ? fmt2(Number((record as any)[f.key] || 0)) : fmtInput((record as any)[f.key] || 0)}
                      onBlur={() => handleBlur(f.key, record, setField)}
                      onChange={e => {
                        const val = e.target.value.replace(/\./g, "").replace(",", ".");
                        setField(f.key as any, val as any);
                      }}
                      className={`w-full border border-border rounded px-2 py-1.5 text-xs text-right font-mono ${ro ? "bg-secondary/50" : "bg-card"}`}
                    />
                  </div>
                ))}
                <div className="col-span-2 lg:col-span-1 flex flex-col justify-end">
                  <label className="text-xs font-black text-primary uppercase">TOTAL NOTA</label>
                  <input
                    readOnly
                    value={fmt2(Number(record.vl_total_nf || 0))}
                    className="w-full border-2 border-primary/40 rounded px-2 py-1.5 text-sm font-black text-right bg-primary/10 text-primary font-mono shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
};

export default NfeEmitidaForm;
