import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper functions to clean old database values to 2-digit codes
const cleanRodado = (v: string | null | undefined): string => {
  if (!v) return "01";
  const match = String(v).match(/^(\d{2})/);
  return match ? match[1] : "01";
};

const cleanCarroceria = (v: string | null | undefined): string => {
  if (!v) return "00";
  const match = String(v).match(/^(\d{2})/);
  return match ? match[1] : "00";
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface IVeiculo {
  veiculo_id: number;
  placa: string;
  descricao: string;
  marca: string;
  modelo: string;
  renavam: string;
  tara: number;
  capacidade_kg: number;
  tp_rodado: string;
  tp_carroceria: string;
  uf: string;
  tp_veiculo: string;
  ativo: boolean;
  cadastro_id: number;
  empresa_id: number;
}

interface VeiculoGridProps {
  XEmpresaId: number;
  XCadastroId?: number;
  tempVeiculos?: IVeiculo[];
  onChangeTempVeiculos?: (veiculos: IVeiculo[]) => void;
}

const XVeiculoColumns: IGridColumn[] = [
  { key: "veiculo_id", label: "Código", width: "80px", align: "right" },
  { key: "placa", label: "Placa", width: "100px" },
  { key: "tp_veiculo", label: "Tipo", width: "90px" },
  { key: "descricao", label: "Descrição", width: "1fr" },
  { key: "uf", label: "UF", width: "50px", align: "center" },
  { key: "ativo", label: "Ativo", width: "70px", align: "center", render: (r: IVeiculo) => r.ativo ? "Sim" : "Não" },
];

const VeiculoGrid: React.FC<VeiculoGridProps> = ({ 
  XEmpresaId, 
  XCadastroId,
  tempVeiculos,
  onChangeTempVeiculos
}) => {
  const [XVeiculos, setXVeiculos] = useState<IVeiculo[]>([]);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XFilterValues, setXFilterValues] = useState<Record<string, string>>({});
  const [XEditMode, setXEditMode] = useState<"none" | "insert" | "edit">("none");
  const [XShowFilters, setXShowFilters] = useState(true);

  // Edit fields
  const [XEditPlaca, setXEditPlaca] = useState("");
  const [XEditDescricao, setXEditDescricao] = useState("");
  const [XEditMarca, setXEditMarca] = useState("");
  const [XEditModelo, setXEditModelo] = useState("");
  const [XEditRenavam, setXEditRenavam] = useState("");
  const [XEditTara, setXEditTara] = useState("0");
  const [XEditCapacidade, setXEditCapacidade] = useState("0");
  const [XEditTpRodado, setXEditTpRodado] = useState("01");
  const [XEditTpCarroceria, setXEditTpCarroceria] = useState("00");
  const [XEditUf, setXEditUf] = useState("");
  const [XEditTpVeiculo, setXEditTpVeiculo] = useState("TRACAO");
  const [XEditAtivo, setXEditAtivo] = useState(true);

  const loadData = useCallback(async () => {
    if (!XCadastroId) return;
    try {
      const { data, error } = await db
        .from("cadastro_veiculo")
        .select("*")
        .eq("cadastro_id", XCadastroId)
        .eq("excluido", false)
        .order("veiculo_id");
      if (error) {
        console.error("Erro ao carregar veículos:", error);
        toast.error("Erro ao carregar veículos: " + error.message);
        return;
      }
      console.log("Veículos carregados com sucesso:", data);
      setXVeiculos(data || []);
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Exceção ao carregar veículos:", errorObj);
      toast.error("Erro ao carregar veículos: " + errorObj.message);
    }
  }, [XCadastroId]);

  useEffect(() => {
    if (XCadastroId) {
      loadData();
    } else if (tempVeiculos) {
      setXVeiculos(tempVeiculos);
    }
    setXSelectedIdx(null);
    setXEditMode("none");
  }, [XEmpresaId, XCadastroId, loadData, tempVeiculos]);

  const XFiltered = XVeiculos.filter(v => {
    const fc = XFilterValues["veiculo_id"] || "";
    const fp = XFilterValues["placa"] || "";
    const fd = XFilterValues["descricao"] || "";
    const fa = XFilterValues["ativo"] || "";
    if (fc && !String(v.veiculo_id).includes(fc)) return false;
    if (fp && !(v.placa || "").toLowerCase().includes(fp.toLowerCase())) return false;
    if (fd && !(v.descricao || "").toLowerCase().includes(fd.toLowerCase())) return false;
    if (fa) {
      const XAtivoStr = v.ativo ? "sim" : "não";
      if (!XAtivoStr.includes(fa.toLowerCase())) return false;
    }
    return true;
  });

  const XSelectedVeiculo = XSelectedIdx !== null ? XFiltered[XSelectedIdx] : null;

  const handleIncluir = () => {
    setXEditMode("insert");
    setXEditPlaca("");
    setXEditDescricao("");
    setXEditMarca("");
    setXEditModelo("");
    setXEditRenavam("");
    setXEditTara("0");
    setXEditCapacidade("0");
    setXEditTpRodado("01");
    setXEditTpCarroceria("00");
    setXEditUf("");
    setXEditTpVeiculo("TRACAO");
    setXEditAtivo(true);
  };

  const handleEditar = () => {
    if (!XSelectedVeiculo) return;
    setXEditMode("edit");
    setXEditPlaca(XSelectedVeiculo.placa);
    setXEditDescricao(XSelectedVeiculo.descricao);
    setXEditMarca(XSelectedVeiculo.marca || "");
    setXEditModelo(XSelectedVeiculo.modelo || "");
    setXEditRenavam(XSelectedVeiculo.renavam || "");
    setXEditTara(String(XSelectedVeiculo.tara || 0));
    setXEditCapacidade(String(XSelectedVeiculo.capacidade_kg || 0));
    setXEditTpRodado(cleanRodado(XSelectedVeiculo.tp_rodado));
    setXEditTpCarroceria(cleanCarroceria(XSelectedVeiculo.tp_carroceria));
    setXEditUf(XSelectedVeiculo.uf || "");
    setXEditTpVeiculo(XSelectedVeiculo.tp_veiculo || "TRACAO");
    setXEditAtivo(XSelectedVeiculo.ativo);
  };

  const handleSalvar = async () => {
    if (!XEditPlaca.trim()) {
      toast.error("A placa do veículo é obrigatória.");
      return;
    }

    const XPayload = {
      placa: XEditPlaca.toUpperCase().trim(),
      descricao: XEditDescricao.toUpperCase().trim(),
      marca: XEditMarca.toUpperCase().trim(),
      modelo: XEditModelo.toUpperCase().trim(),
      renavam: XEditRenavam.trim(),
      tara: parseInt(XEditTara) || 0,
      capacidade_kg: parseInt(XEditCapacidade) || 0,
      tp_rodado: XEditTpRodado,
      tp_carroceria: XEditTpCarroceria,
      uf: XEditUf.toUpperCase().trim(),
      tp_veiculo: XEditTpVeiculo,
      ativo: XEditAtivo,
      cadastro_id: XCadastroId || 0,
      empresa_id: XEmpresaId,
      excluido: false,
    };

    if (!XCadastroId) {
      // Memory-only mode for new records
      if (XEditMode === "insert") {
        const newV: IVeiculo = {
          ...XPayload,
          veiculo_id: -Math.floor(Math.random() * 1000000), // temp negative ID
        };
        if (onChangeTempVeiculos && tempVeiculos) {
          onChangeTempVeiculos([...tempVeiculos, newV]);
        }
        toast.success("Veículo adicionado temporariamente.");
      } else if (XEditMode === "edit" && XSelectedVeiculo) {
        if (onChangeTempVeiculos && tempVeiculos) {
          const updated = tempVeiculos.map(v => 
            v.veiculo_id === XSelectedVeiculo.veiculo_id ? { ...v, ...XPayload } : v
          );
          onChangeTempVeiculos(updated);
        }
        toast.success("Veículo alterado temporariamente.");
      }
      setXEditMode("none");
      return;
    }

    // Database mode
    try {
      if (XEditMode === "insert") {
        const { error } = await db.from("cadastro_veiculo").insert({ ...XPayload, dt_cadastro: new Date().toISOString() });
        if (error) { toast.error("Erro ao incluir veículo: " + error.message); return; }
        toast.success("Veículo incluído com sucesso.");
      } else if (XEditMode === "edit" && XSelectedVeiculo) {
        const { error } = await db.from("cadastro_veiculo").update({ ...XPayload, dt_alteracao: new Date().toISOString() }).eq("veiculo_id", XSelectedVeiculo.veiculo_id);
        if (error) { toast.error("Erro ao alterar veículo: " + error.message); return; }
        toast.success("Veículo alterado com sucesso.");
      }
      setXEditMode("none");
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Exceção ao salvar veículo:", errorObj);
      toast.error("Erro ao salvar veículo: " + errorObj.message);
    }
  };

  const handleExcluir = async () => {
    if (!XSelectedVeiculo) return;

    if (!XCadastroId) {
      // Memory-only mode
      if (confirm(`Remover veículo "${XSelectedVeiculo.placa}"?`)) {
        if (onChangeTempVeiculos && tempVeiculos) {
          const filtered = tempVeiculos.filter(v => v.veiculo_id !== XSelectedVeiculo.veiculo_id);
          onChangeTempVeiculos(filtered);
        }
        toast.success("Veículo removido.");
        setXSelectedIdx(null);
      }
      return;
    }

    if (confirm(`Excluir veículo "${XSelectedVeiculo.placa}"?`)) {
      await db.from("cadastro_veiculo").update({ excluido: true }).eq("veiculo_id", XSelectedVeiculo.veiculo_id);
      toast.success("Veículo excluído.");
      setXSelectedIdx(null);
      loadData();
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setXFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const XToolbar = (
    <GridActionToolbar
      actions={[
        gridActions.incluir(handleIncluir),
        gridActions.alterar(handleEditar, !XSelectedVeiculo),
        null,
        gridActions.excluir(handleExcluir, !XSelectedVeiculo),
        gridActions.atualizar(loadData),
        gridActions.filtro(() => setXShowFilters(!XShowFilters), XShowFilters),
      ]}
      count={`${XFiltered.length} registro(s)`}
    />
  );

  return (
    <div className="space-y-2">
      {/* Edit row (inline) */}
      {XEditMode !== "none" && (
        <div className="space-y-3 p-3 bg-slate-50/50 dark:bg-slate-900/50 rounded border border-border/60">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground">Placa *</label>
              <input
                type="text"
                value={XEditPlaca}
                onChange={(e) => setXEditPlaca(e.target.value.toUpperCase())}
                maxLength={10}
                className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-28"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground">UF</label>
              <input
                type="text"
                value={XEditUf}
                onChange={(e) => setXEditUf(e.target.value.toUpperCase())}
                maxLength={2}
                className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-12 text-center"
              />
            </div>
            <div className="flex flex-col gap-0.5 w-32">
              <label className="text-[10px] text-muted-foreground">Tipo</label>
              <Select value={XEditTpVeiculo} onValueChange={setXEditTpVeiculo}>
                <SelectTrigger className="h-[30px] text-xs bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRACAO">TRAÇÃO</SelectItem>
                  <SelectItem value="REBOQUE">REBOQUE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground">RENAVAM</label>
              <input
                type="text"
                value={XEditRenavam}
                onChange={(e) => setXEditRenavam(e.target.value.replace(/\D/g, ""))}
                maxLength={11}
                className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-32"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground">Descrição</label>
              <input
                type="text"
                value={XEditDescricao}
                onChange={(e) => setXEditDescricao(e.target.value.toUpperCase())}
                className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-56"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground">Tara (KG)</label>
              <input
                type="number"
                value={XEditTara}
                onChange={(e) => setXEditTara(e.target.value)}
                className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-24 text-right"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground">Capac. (KG)</label>
              <input
                type="number"
                value={XEditCapacidade}
                onChange={(e) => setXEditCapacidade(e.target.value)}
                className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-24 text-right"
              />
            </div>
            <div className="flex flex-col gap-0.5 w-44">
              <label className="text-[10px] text-muted-foreground">Rodado</label>
              <Select value={XEditTpRodado} onValueChange={setXEditTpRodado}>
                <SelectTrigger className="h-[30px] text-xs bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="01">01 - TRUCK</SelectItem>
                  <SelectItem value="02">02 - TOCO</SelectItem>
                  <SelectItem value="03">03 - CAVALO MECÂNICO</SelectItem>
                  <SelectItem value="04">04 - VAN</SelectItem>
                  <SelectItem value="05">05 - UTILITÁRIO</SelectItem>
                  <SelectItem value="06">06 - OUTROS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-0.5 w-48">
              <label className="text-[10px] text-muted-foreground">Carroceria</label>
              <Select value={XEditTpCarroceria} onValueChange={setXEditTpCarroceria}>
                <SelectTrigger className="h-[30px] text-xs bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="00">00 - NÃO APLICÁVEL</SelectItem>
                  <SelectItem value="01">01 - ABERTA</SelectItem>
                  <SelectItem value="02">02 - FECHADA/BAÚ</SelectItem>
                  <SelectItem value="03">03 - GRANELEIRA</SelectItem>
                  <SelectItem value="04">04 - PORTA CONTAINER</SelectItem>
                  <SelectItem value="05">05 - SIDER</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-0.5 items-center pb-1">
              <label className="text-[10px] text-muted-foreground">Ativo</label>
              <Checkbox checked={XEditAtivo} onCheckedChange={(c) => setXEditAtivo(!!c)} />
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleSalvar}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm"
              >
                Salvar
              </button>
              <button
                onClick={() => setXEditMode("none")}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-rose-600 hover:bg-accent transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <DataGrid
        columns={XVeiculoColumns}
        data={XFiltered}
        selectedIdx={XSelectedIdx}
        onRowClick={(_row, idx) => setXSelectedIdx(idx)}
        onRowDoubleClick={(_row, idx) => {
          setXSelectedIdx(idx);
          const v = XFiltered[idx];
          if (v) {
            setXEditMode("edit");
            setXEditPlaca(v.placa);
            setXEditDescricao(v.descricao);
            setXEditMarca(v.marca || "");
            setXEditModelo(v.modelo || "");
            setXEditRenavam(v.renavam || "");
            setXEditTara(String(v.tara || 0));
            setXEditCapacidade(String(v.capacidade_kg || 0));
            setXEditTpRodado(cleanRodado(v.tp_rodado));
            setXEditTpCarroceria(cleanCarroceria(v.tp_carroceria));
            setXEditUf(v.uf || "");
            setXEditTpVeiculo(v.tp_veiculo || "TRACAO");
            setXEditAtivo(v.ativo);
          }
        }}
        showFilters={XShowFilters}
        filterValues={XFilterValues}
        onFilterChange={handleFilterChange}
        maxHeight="250px"
        exportTitle="Veículos"
        toolbarLeft={XToolbar}
        showRecordCount={false}
      />
    </div>
  );
};

export default VeiculoGrid;
