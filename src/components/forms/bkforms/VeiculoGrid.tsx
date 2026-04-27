import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { Checkbox } from "@/components/ui/checkbox";

const db = supabase as any;

interface IVeiculo {
  veiculo_id: number;
  placa: string;
  descricao: string;
  marca: string;
  modelo: string;
  ativo: boolean;
  cadastro_id: number;
  empresa_id: number;
}

interface VeiculoGridProps {
  XEmpresaId: number;
  XCadastroId: number;
}

const XVeiculoColumns: IGridColumn[] = [
  { key: "veiculo_id", label: "Código", width: "80px", align: "right" },
  { key: "placa", label: "Placa", width: "120px" },
  { key: "descricao", label: "Descrição", width: "1fr" },
  { key: "marca", label: "Marca", width: "120px" },
  { key: "modelo", label: "Modelo", width: "120px" },
  { key: "ativo", label: "Ativo", width: "80px", align: "center", render: (r: IVeiculo) => r.ativo ? "Sim" : "Não" },
];

const VeiculoGrid: React.FC<VeiculoGridProps> = ({ XEmpresaId, XCadastroId }) => {
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
  const [XEditAtivo, setXEditAtivo] = useState(true);

  const loadData = useCallback(async () => {
    const { data } = await db
      .from("veiculo")
      .select("*")
      .eq("cadastro_id", XCadastroId)
      .eq("empresa_id", XEmpresaId)
      .eq("excluido", false)
      .order("veiculo_id");
    setXVeiculos(data || []);
  }, [XEmpresaId, XCadastroId]);

  useEffect(() => {
    loadData();
    setXSelectedIdx(null);
    setXEditMode("none");
  }, [XEmpresaId, XCadastroId, loadData]);

  const XFiltered = XVeiculos.filter(v => {
    const fc = XFilterValues["veiculo_id"] || "";
    const fp = XFilterValues["placa"] || "";
    const fd = XFilterValues["descricao"] || "";
    const fm = XFilterValues["marca"] || "";
    const fmo = XFilterValues["modelo"] || "";
    const fa = XFilterValues["ativo"] || "";
    if (fc && !String(v.veiculo_id).includes(fc)) return false;
    if (fp && !v.placa.toLowerCase().includes(fp.toLowerCase())) return false;
    if (fd && !v.descricao.toLowerCase().includes(fd.toLowerCase())) return false;
    if (fm && !v.marca.toLowerCase().includes(fm.toLowerCase())) return false;
    if (fmo && !v.modelo.toLowerCase().includes(fmo.toLowerCase())) return false;
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
    setXEditAtivo(true);
  };

  const handleEditar = () => {
    if (!XSelectedVeiculo) return;
    setXEditMode("edit");
    setXEditPlaca(XSelectedVeiculo.placa);
    setXEditDescricao(XSelectedVeiculo.descricao);
    setXEditMarca(XSelectedVeiculo.marca);
    setXEditModelo(XSelectedVeiculo.modelo);
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
      ativo: XEditAtivo,
      cadastro_id: XCadastroId,
      empresa_id: XEmpresaId,
    };

    if (XEditMode === "insert") {
      const { error } = await db.from("veiculo").insert({ ...XPayload, dt_cadastro: new Date().toISOString() });
      if (error) { toast.error("Erro ao incluir veículo."); return; }
      toast.success("Veículo incluído com sucesso.");
    } else if (XEditMode === "edit" && XSelectedVeiculo) {
      const { error } = await db.from("veiculo").update({ ...XPayload, dt_alteracao: new Date().toISOString() }).eq("veiculo_id", XSelectedVeiculo.veiculo_id);
      if (error) { toast.error("Erro ao alterar veículo."); return; }
      toast.success("Veículo alterado com sucesso.");
    }
    setXEditMode("none");
    loadData();
  };

  const handleExcluir = async () => {
    if (!XSelectedVeiculo) return;
    if (confirm(`Excluir veículo "${XSelectedVeiculo.placa}"?`)) {
      await db.from("veiculo").update({ excluido: true }).eq("veiculo_id", XSelectedVeiculo.veiculo_id);
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
        <div className="flex flex-wrap items-end gap-2 p-2 bg-accent rounded border border-border">
          <span className="text-xs font-medium text-muted-foreground w-16 self-center">
            {XEditMode === "insert" ? "Novo:" : "Editar:"}
          </span>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Placa</label>
            <input
              type="text"
              placeholder="Placa"
              value={XEditPlaca}
              onChange={(e) => setXEditPlaca(e.target.value.toUpperCase())}
              maxLength={10}
              className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-28"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSalvar(); if (e.key === "Escape") setXEditMode("none"); }}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Descrição</label>
            <input
              type="text"
              placeholder="Descrição"
              value={XEditDescricao}
              onChange={(e) => setXEditDescricao(e.target.value.toUpperCase())}
              className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-48"
              onKeyDown={(e) => { if (e.key === "Enter") handleSalvar(); if (e.key === "Escape") setXEditMode("none"); }}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Marca</label>
            <input
              type="text"
              placeholder="Marca"
              value={XEditMarca}
              onChange={(e) => setXEditMarca(e.target.value.toUpperCase())}
              className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-28"
              onKeyDown={(e) => { if (e.key === "Enter") handleSalvar(); if (e.key === "Escape") setXEditMode("none"); }}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Modelo</label>
            <input
              type="text"
              placeholder="Modelo"
              value={XEditModelo}
              onChange={(e) => setXEditModelo(e.target.value.toUpperCase())}
              className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-28"
              onKeyDown={(e) => { if (e.key === "Enter") handleSalvar(); if (e.key === "Escape") setXEditMode("none"); }}
            />
          </div>
          <div className="flex flex-col gap-0.5 items-center">
            <label className="text-[10px] text-muted-foreground">Ativo</label>
            <Checkbox checked={XEditAtivo} onCheckedChange={(c) => setXEditAtivo(!!c)} />
          </div>
          <button onClick={handleSalvar} className="px-3 py-1 text-xs bg-success text-success-foreground rounded hover:opacity-90">
            Salvar
          </button>
          <button onClick={() => setXEditMode("none")} className="px-3 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:opacity-90">
            Cancelar
          </button>
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
            setXEditMarca(v.marca);
            setXEditModelo(v.modelo);
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
