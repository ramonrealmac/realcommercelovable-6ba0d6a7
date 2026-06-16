/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  RefreshCw, 
  MapPinned, 
  Truck, 
  User, 
  PlusCircle, 
  ArrowRight, 
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { type IGridColumn } from "@/components/grid/DataGrid";
import { toast } from "sonner";
import { formatCPFCNPJ } from "@/lib/validators";

const db = supabase as any;

interface IVeiculo {
  veiculo_id: number;
  placa: string;
  descricao: string | null;
  marca: string | null;
  modelo: string | null;
}

interface IMotorista {
  motorista_id: number;
  nome: string;
  cpf: string;
  telefone: string | null;
}

interface IRota {
  rota_id: number;
  descricao: string;
}

interface IOrderRow {
  movimento_id: number;
  nr_movimento: number;
  dt_emissao: string | null;
  dt_entrega: string | null;
  cadastro_id: number | null;
  vl_movimento: number | null;
  st_entrega: string | null;
  st_entregue: string | null;
  st_pedido: string | null;
  clientInfo?: {
    cadastro_id: number;
    cd_cadastro: number | null;
    cnpj: string | null;
    razao_social: string;
    fone_geral: string | null;
    endereco_bairro: string;
    endereco_cidade_id: number | null;
    rota_id: number | null;
    cidade: string;
    uf: string;
  };
}

const fmtMoney = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
};

const MontagemRotaForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();

  // Header State
  const [XVeiculos, setXVeiculos] = useState<IVeiculo[]>([]);
  const [XMotoristas, setXMotoristas] = useState<IMotorista[]>([]);
  const [XRotas, setXRotas] = useState<IRota[]>([]);

  const [XSelectedVeiculoId, setXSelectedVeiculoId] = useState<string>("");
  const [XSelectedMotoristaId, setXSelectedMotoristaId] = useState<string>("");
  const [XRotaText, setXRotaText] = useState<string>("");
  const [XObservacoes, setXObservacoes] = useState<string>("");

  // Orders State
  const [XRows, setXRows] = useState<IOrderRow[]>([]);
  const [XSelectedIds, setXSelectedIds] = useState<number[]>([]);
  const [XOrderSequences, setXOrderSequences] = useState<Record<number, number>>({});
  const [XLoading, setXLoading] = useState<boolean>(false);
  const [XSaving, setXSaving] = useState<boolean>(false);

  // Filters State
  const [XFilterCidade, setXFilterCidade] = useState<string>("");
  const [XFilterUf, setXFilterUf] = useState<string>("");
  const [XFilterRota, setXFilterRota] = useState<string>("");

  // Load auxiliary lists (vehicles, drivers, routes)
  const loadAuxiliaryData = useCallback(async () => {
    if (!XEmpresaId) return;
    try {
      // 1. Veiculos
      const { data: veicData } = await db.from("cadastro_veiculo")
        .select("veiculo_id, placa, descricao, marca, modelo")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .eq("ativo", true);
      setXVeiculos(veicData || []);

      // 2. Motoristas
      const { data: motData } = await db.from("cadastro_motorista")
        .select("motorista_id, nome, cpf, telefone")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .eq("ativo", true);
      setXMotoristas(motData || []);

      // 3. Rotas
      const { data: rotaData } = await db.from("rota")
        .select("rota_id, descricao")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false);
      setXRotas(rotaData || []);

    } catch (e: any) {
      console.error("Erro ao carregar dados auxiliares:", e);
    }
  }, [XEmpresaId]);

  // Load pending orders ready for delivery
  const loadPendingOrders = useCallback(async () => {
    if (!XEmpresaId) return;
    setXLoading(true);
    try {
      const { data, error } = await db.from("movimento")
        .select("movimento_id, nr_movimento, dt_emissao, dt_entrega, cadastro_id, vl_movimento, st_entrega, st_entregue, st_pedido, st_bloqueado, empresa_id")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .eq("st_bloqueado", "N") // Apenas liberados
        .in("st_pedido", ["F", "R"]) // Faturado ou Recebido no Caixa
        .in("st_entrega", ["S", "P"]) // Sim ou Parcial
        .in("st_entregue", ["N", "P"]) // Não entregue ou Parcialmente entregue
        .order("nr_movimento", { ascending: false });

      if (error) throw error;

      const rows: IOrderRow[] = data || [];

      // Fetch client info
      const cadIds = Array.from(new Set(rows.map(r => r.cadastro_id).filter(Boolean)));
      if (cadIds.length > 0) {
        const { data: cadRes } = await db.from("cadastro")
          .select("cadastro_id, cd_cadastro, cnpj, razao_social, fone_geral, endereco_bairro, endereco_cidade_id, rota_id, cidade:endereco_cidade_id(descricao, estado_id)")
          .in("cadastro_id", cadIds);
        
        const cadMap = new Map<number, any>((cadRes || []).map((c: any) => [c.cadastro_id, c]));
        
        rows.forEach(r => {
          if (r.cadastro_id && cadMap.has(r.cadastro_id)) {
            const c = cadMap.get(r.cadastro_id);
            r.clientInfo = {
              cadastro_id: c.cadastro_id,
              cd_cadastro: c.cd_cadastro,
              cnpj: c.cnpj,
              razao_social: c.razao_social,
              fone_geral: c.fone_geral,
              endereco_bairro: c.endereco_bairro || "",
              endereco_cidade_id: c.endereco_cidade_id,
              rota_id: c.rota_id,
              cidade: c.cidade?.descricao || "",
              uf: c.cidade?.estado_id || ""
            };
          }
        });
      }

      setXRows(rows);
    } catch (e: any) {
      console.error("Erro ao carregar pedidos pendentes:", e);
      toast.error("Erro ao carregar pedidos pendentes: " + e.message);
    } finally {
      setXLoading(false);
    }
  }, [XEmpresaId]);

  useEffect(() => {
    loadAuxiliaryData();
    loadPendingOrders();
  }, [loadAuxiliaryData, loadPendingOrders]);

  // Transfer actions
  const handleAddToMinuta = (movId: number) => {
    setXSelectedIds(prev => {
      if (prev.includes(movId)) return prev;
      const nextSeq = Object.keys(XOrderSequences).length + 1;
      setXOrderSequences(old => ({ ...old, [movId]: nextSeq }));
      return [...prev, movId];
    });
  };

  const handleRemoveFromMinuta = (movId: number) => {
    setXSelectedIds(prev => {
      const newSeqs = { ...XOrderSequences };
      delete newSeqs[movId];
      // Re-sequence remaining
      const remaining = prev.filter(id => id !== movId);
      const updatedSeqs: Record<number, number> = {};
      remaining.forEach((id, index) => {
        updatedSeqs[id] = index + 1;
      });
      setXOrderSequences(updatedSeqs);
      return remaining;
    });
  };

  const handleAddAllFiltered = (filteredRows: IOrderRow[]) => {
    setXSelectedIds(prev => {
      const toAdd = filteredRows.filter(r => !prev.includes(r.movimento_id));
      if (toAdd.length === 0) return prev;

      const newSeqs = { ...XOrderSequences };
      let currSeq = Object.keys(newSeqs).length;

      toAdd.forEach(r => {
        currSeq++;
        newSeqs[r.movimento_id] = currSeq;
      });

      setXOrderSequences(newSeqs);
      return [...prev, ...toAdd.map(r => r.movimento_id)];
    });
    toast.info(`${filteredRows.length} pedido(s) adicionado(s) à minuta.`);
  };

  const handleRemoveAllSelected = () => {
    setXSelectedIds([]);
    setXOrderSequences({});
  };

  const handleSequenceChange = (movId: number, val: string) => {
    const num = parseInt(val) || 0;
    setXOrderSequences(prev => ({ ...prev, [movId]: num }));
  };

  // Submit / Save Route
  const handleGerarMinuta = async () => {
    if (!XEmpresaId) return;
    if (XSelectedIds.length === 0) {
      toast.warning("Adicione pelo menos um pedido à minuta.");
      return;
    }

    setXSaving(true);
    try {
      // 1. Insert the entrega record
      const insertData: any = {
        empresa_id: XEmpresaId,
        dt_inicio: new Date().toISOString(),
        rota: XRotaText.trim() || "Rota Não Definida",
        observacoes: XObservacoes.trim(),
        status: "Pendente",
      };

      if (XSelectedVeiculoId) insertData.veiculo_id = parseInt(XSelectedVeiculoId);
      if (XSelectedMotoristaId) insertData.motorista_id = parseInt(XSelectedMotoristaId);

      const { data: entData, error: entErr } = await db.from("entrega")
        .insert(insertData)
        .select()
        .single();

      if (entErr) throw entErr;

      // 2. Insert entrega_items
      const itemsToInsert = XSelectedIds.map(movId => ({
        entrega_id: entData.entrega_id,
        movimento_id: movId,
        empresa_id: XEmpresaId,
        status_entrega: "Pendente",
        ordem_sequencia: XOrderSequences[movId] || 0
      }));

      const { error: itemsErr } = await db.from("entrega_item").insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      // 3. Update st_entregue in movimento to 'P' (Parcialmente/Em rota)
      const { error: movErr } = await db.from("movimento")
        .update({ st_entregue: "P", dt_alteracao: new Date().toISOString() })
        .in("movimento_id", XSelectedIds);
      if (movErr) throw movErr;

      toast.success(`Minuta de Entrega #${entData.cd_entrega} gerada com sucesso contendo ${XSelectedIds.length} parada(s).`);

      // Clear fields
      setXSelectedVeiculoId("");
      setXSelectedMotoristaId("");
      setXRotaText("");
      setXObservacoes("");
      setXSelectedIds([]);
      setXOrderSequences({});
      
      // Reload
      await loadPendingOrders();

    } catch (e: any) {
      console.error("Erro ao gerar minuta de entrega:", e);
      toast.error("Erro ao gerar minuta de entrega: " + e.message);
    } finally {
      setXSaving(false);
    }
  };

  // Filter lists from XRows (only pending ones)
  const XAvailableList = useMemo(() => {
    return XRows.filter(r => !XSelectedIds.includes(r.movimento_id));
  }, [XRows, XSelectedIds]);

  const XCidades = useMemo(() => {
    return Array.from(new Set(XAvailableList.map(r => r.clientInfo?.cidade).filter(Boolean))).sort();
  }, [XAvailableList]);

  const XUfs = useMemo(() => {
    return Array.from(new Set(XAvailableList.map(r => r.clientInfo?.uf).filter(Boolean))).sort();
  }, [XAvailableList]);

  const XRotasFiltro = useMemo(() => {
    return Array.from(new Set(XAvailableList.map(r => {
      if (!r.clientInfo?.rota_id) return null;
      const rt = XRotas.find(x => x.rota_id === r.clientInfo.rota_id);
      return rt ? rt.descricao : null;
    }).filter(Boolean))).sort();
  }, [XAvailableList, XRotas]);

  // Apply filters
  const filteredAvailableRows = useMemo(() => {
    return XAvailableList.filter(r => {
      if (XFilterCidade && r.clientInfo?.cidade !== XFilterCidade) return false;
      if (XFilterUf && r.clientInfo?.uf !== XFilterUf) return false;
      if (XFilterRota) {
        const rt = XRotas.find(x => x.rota_id === r.clientInfo?.rota_id);
        if (!rt || rt.descricao !== XFilterRota) return false;
      }
      return true;
    });
  }, [XAvailableList, XFilterCidade, XFilterUf, XFilterRota, XRotas]);

  // Selected orders for Grid 2
  const selectedRows = useMemo(() => {
    const rows = XRows.filter(r => XSelectedIds.includes(r.movimento_id));
    return rows.sort((a, b) => {
      const seqA = XOrderSequences[a.movimento_id] ?? 9999;
      const seqB = XOrderSequences[b.movimento_id] ?? 9999;
      return seqA - seqB;
    });
  }, [XRows, XSelectedIds, XOrderSequences]);

  // Grid 1 Columns (Available)
  const XColsAvailable: IGridColumn[] = useMemo(() => [
    {
      key: "_action", label: "Ação", width: "70px", align: "center",
      render: (r: any) => (
        <button
          onClick={() => handleAddToMinuta(r.movimento_id)}
          className="p-1 rounded bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center"
          title="Adicionar à Minuta"
        >
          <ArrowRight size={14} />
        </button>
      )
    },
    { key: "nr_movimento", label: "Pedido", width: "90px", align: "right" },
    { key: "razao_social", label: "Razão Social", width: "1.5fr", render: (r: any) => r.clientInfo?.razao_social ?? "" },
    { key: "cidade", label: "Cidade", width: "120px", render: (r: any) => r.clientInfo?.cidade ?? "" },
    { key: "uf", label: "UF", width: "50px", align: "center", render: (r: any) => r.clientInfo?.uf ?? "" },
    { 
      key: "rota", label: "Rota Cliente", width: "120px",
      render: (r: any) => {
        if (!r.clientInfo?.rota_id) return "";
        const rt = XRotas.find(x => x.rota_id === r.clientInfo.rota_id);
        return rt ? rt.descricao : "";
      }
    },
    { key: "vl_movimento", label: "Valor", width: "100px", align: "right", render: (r: any) => fmtMoney(r.vl_movimento) },
  ], [XRotas]);

  // Grid 2 Columns (Selected)
  const XColsSelected: IGridColumn[] = useMemo(() => [
    {
      key: "_action", label: "Remover", width: "80px", align: "center",
      render: (r: any) => (
        <button
          onClick={() => handleRemoveFromMinuta(r.movimento_id)}
          className="p-1 rounded bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all flex items-center justify-center"
          title="Remover da Minuta"
        >
          <ArrowLeft size={14} />
        </button>
      )
    },
    {
      key: "ordem_sequencia", label: "Parada", width: "80px", align: "center",
      render: (r: any) => (
        <input
          type="number"
          value={XOrderSequences[r.movimento_id] ?? ""}
          onChange={(e) => handleSequenceChange(r.movimento_id, e.target.value)}
          className="w-12 border border-border rounded px-1 py-0.5 text-center text-xs bg-card outline-none focus:ring-1 focus:ring-ring"
          min="1"
        />
      )
    },
    { key: "nr_movimento", label: "Pedido", width: "90px", align: "right" },
    { key: "razao_social", label: "Razão Social", width: "1.5fr", render: (r: any) => r.clientInfo?.razao_social ?? "" },
    { key: "cidade", label: "Cidade", width: "110px", render: (r: any) => r.clientInfo?.cidade ?? "" },
    { key: "vl_movimento", label: "Valor", width: "100px", align: "right", render: (r: any) => fmtMoney(r.vl_movimento) },
  ], [XOrderSequences]);

  return (
    <div className="p-4 h-full overflow-auto space-y-4 bg-background">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Montagem da Rota (Minutas de Entrega)</h2>
          <p className="text-xs text-muted-foreground">Adicione os pedidos da fila à minuta de entrega e ordene a sequência de paradas.</p>
        </div>
        <button
          onClick={loadPendingOrders}
          disabled={XLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-all"
        >
          <RefreshCw size={13} className={XLoading ? "animate-spin" : ""} /> Atualizar Fila
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        
        {/* Config / Metadata Sidebar (1/5 cols) */}
        <div className="xl:col-span-1 border border-border rounded-lg bg-card shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border pb-2 text-primary font-bold text-sm">
            <MapPinned size={16} /> Configurações da Rota
          </div>

          {/* VEICULO */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <Truck size={13} /> Veículo
            </label>
            <select
              value={XSelectedVeiculoId}
              onChange={(e) => setXSelectedVeiculoId(e.target.value)}
              className="border border-border rounded px-2 py-1.5 text-sm bg-card outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">-- Selecionar Veículo --</option>
              {XVeiculos.map(v => (
                <option key={v.veiculo_id} value={v.veiculo_id}>
                  {v.placa} {v.descricao ? `- ${v.descricao}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* MOTORISTA */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <User size={13} /> Motorista
            </label>
            <select
              value={XSelectedMotoristaId}
              onChange={(e) => setXSelectedMotoristaId(e.target.value)}
              className="border border-border rounded px-2 py-1.5 text-sm bg-card outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">-- Selecionar Motorista --</option>
              {XMotoristas.map(m => (
                <option key={m.motorista_id} value={m.motorista_id}>
                  {m.nome} ({formatCPFCNPJ(m.cpf)})
                </option>
              ))}
            </select>
          </div>

          {/* ROTA */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <MapPinned size={13} /> Rota / Destino
            </label>
            <input
              type="text"
              list="rotas-sugeridas"
              placeholder="Digite ou selecione"
              value={XRotaText}
              onChange={(e) => setXRotaText(e.target.value)}
              className="border border-border rounded px-2 py-1.5 text-sm bg-card outline-none focus:ring-2 focus:ring-ring"
            />
            <datalist id="rotas-sugeridas">
              {XRotas.map(r => (
                <option key={r.rota_id} value={r.descricao} />
              ))}
            </datalist>
          </div>

          {/* OBSERVAÇÕES */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-semibold">Observações</label>
            <textarea
              rows={3}
              placeholder="Observações da rota..."
              value={XObservacoes}
              onChange={(e) => setXObservacoes(e.target.value)}
              className="border border-border rounded px-2 py-1.5 text-sm bg-card outline-none focus:ring-2 focus:ring-ring resize-none text-xs"
            />
          </div>

          {/* SUBMIT */}
          <button
            onClick={handleGerarMinuta}
            disabled={XSaving || XSelectedIds.length === 0}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-primary text-primary-foreground hover:bg-primary/95 font-bold text-xs shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {XSaving ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Gerando Rota...
              </>
            ) : (
              <>
                <PlusCircle size={14} /> Confirmar Minuta ({XSelectedIds.length})
              </>
            )}
          </button>
        </div>

        {/* Available and Selected Grids (4/5 cols) */}
        <div className="xl:col-span-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Grid 1: Pedidos Disponíveis */}
          <div className="flex flex-col gap-3 border border-border rounded-lg bg-card shadow-sm p-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <ClipboardList size={16} className="text-muted-foreground" /> Pedidos Disponíveis ({filteredAvailableRows.length})
              </span>
              <button
                onClick={() => handleAddAllFiltered(filteredAvailableRows)}
                disabled={filteredAvailableRows.length === 0}
                className="text-[10px] bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-2 py-1 rounded transition-all font-semibold"
              >
                Adicionar Filtrados
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-3 gap-2 bg-muted/30 p-2 rounded border border-border">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Filter size={8} /> Cidade
                </label>
                <select
                  value={XFilterCidade}
                  onChange={(e) => setXFilterCidade(e.target.value)}
                  className="border border-border rounded px-1 py-1 text-xs bg-card outline-none"
                >
                  <option value="">Todas</option>
                  {XCidades.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Filter size={8} /> UF
                </label>
                <select
                  value={XFilterUf}
                  onChange={(e) => setXFilterUf(e.target.value)}
                  className="border border-border rounded px-1 py-1 text-xs bg-card outline-none"
                >
                  <option value="">Todas</option>
                  {XUfs.map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Filter size={8} /> Rota
                </label>
                <select
                  value={XFilterRota}
                  onChange={(e) => setXFilterRota(e.target.value)}
                  className="border border-border rounded px-1 py-1 text-xs bg-card outline-none"
                >
                  <option value="">Todas</option>
                  {XRotasFiltro.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid View */}
            <div className="flex-1 min-h-[350px] overflow-hidden border border-border rounded bg-background">
              <DataGrid
                columns={XColsAvailable}
                data={filteredAvailableRows}
                maxHeight="calc(100vh - 330px)"
                exportTitle="Fila de Pedidos Disponiveis"
              />
            </div>
          </div>

          {/* Grid 2: Minuta / Pedidos Selecionados */}
          <div className="flex flex-col gap-3 border border-border rounded-lg bg-card shadow-sm p-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <ChevronRight size={16} className="text-primary" /> Pedidos na Minuta ({selectedRows.length})
              </span>
              <button
                onClick={handleRemoveAllSelected}
                disabled={selectedRows.length === 0}
                className="text-[10px] bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground px-2 py-1 rounded transition-all font-semibold flex items-center gap-1"
              >
                <Trash2 size={10} /> Limpar Tudo
              </button>
            </div>

            {/* Description placeholder */}
            <div className="text-[10px] text-muted-foreground bg-muted/10 p-2 rounded border border-border leading-relaxed">
              Ordene as paradas definindo o número na coluna <strong>Parada</strong>. Os pedidos serão processados nesta sequência.
            </div>

            {/* Grid View */}
            <div className="flex-1 min-h-[350px] overflow-hidden border border-border rounded bg-background">
              <DataGrid
                columns={XColsSelected}
                data={selectedRows}
                maxHeight="calc(100vh - 330px)"
                exportTitle="Pedidos na Minuta"
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default MontagemRotaForm;
