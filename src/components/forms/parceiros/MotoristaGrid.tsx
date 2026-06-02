import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface IMotorista {
  motorista_id: number;
  cpf: string;
  nome: string;
  telefone: string;
  chave_pix: string;
  cadastro_id: number;
  empresa_id: number;
}

interface MotoristaGridProps {
  XEmpresaId: number;
  XCadastroId?: number;
  tempMotoristas?: IMotorista[];
  onChangeTempMotoristas?: (motoristas: IMotorista[]) => void;
}

const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, "").substring(0, 11);
  if (d.length <= 9) return d;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const XMotoristaColumns: IGridColumn[] = [
  { key: "motorista_id", label: "Código", width: "80px", align: "right" },
  { key: "cpf", label: "CPF", width: "130px", render: (r: IMotorista) => r.cpf ? formatCPF(r.cpf) : "" },
  { key: "nome", label: "Nome", width: "2fr" },
  { key: "telefone", label: "Telefone", width: "120px" },
  { key: "chave_pix", label: "Chave PIX", width: "1.5fr" },
];

const MotoristaGrid: React.FC<MotoristaGridProps> = ({
  XEmpresaId,
  XCadastroId,
  tempMotoristas,
  onChangeTempMotoristas
}) => {
  const [XMotoristas, setXMotoristas] = useState<IMotorista[]>([]);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XFilterValues, setXFilterValues] = useState<Record<string, string>>({});
  const [XEditMode, setXEditMode] = useState<"none" | "insert" | "edit">("none");
  const [XShowFilters, setXShowFilters] = useState(true);

  // Edit fields
  const [XEditCpf, setXEditCpf] = useState("");
  const [XEditNome, setXEditNome] = useState("");
  const [XEditTelefone, setXEditTelefone] = useState("");
  const [XEditPix, setXEditPix] = useState("");

  const loadData = useCallback(async () => {
    if (!XCadastroId) return;
    try {
      const { data, error } = await db
        .from("cadastro_motorista")
        .select("*")
        .eq("cadastro_id", XCadastroId)
        .eq("excluido", false)
        .order("motorista_id");
      if (error) {
        console.error("Erro ao carregar motoristas:", error);
        toast.error("Erro ao carregar motoristas: " + error.message);
        return;
      }
      setXMotoristas(data || []);
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Exceção ao carregar motoristas:", errorObj);
      toast.error("Erro ao carregar motoristas: " + errorObj.message);
    }
  }, [XCadastroId]);

  useEffect(() => {
    if (XCadastroId) {
      loadData();
    } else if (tempMotoristas) {
      setXMotoristas(tempMotoristas);
    }
    setXSelectedIdx(null);
    setXEditMode("none");
  }, [XEmpresaId, XCadastroId, loadData, tempMotoristas]);

  const XFiltered = XMotoristas.filter(m => {
    const fc = XFilterValues["motorista_id"] || "";
    const fcpf = XFilterValues["cpf"] || "";
    const fn = XFilterValues["nome"] || "";
    const ft = XFilterValues["telefone"] || "";
    
    if (fc && !String(m.motorista_id).includes(fc)) return false;
    if (fcpf && !(m.cpf || "").includes(fcpf.replace(/\D/g, ""))) return false;
    if (fn && !(m.nome || "").toLowerCase().includes(fn.toLowerCase())) return false;
    if (ft && !(m.telefone || "").toLowerCase().includes(ft.toLowerCase())) return false;
    return true;
  });

  const XSelectedMotorista = XSelectedIdx !== null ? XFiltered[XSelectedIdx] : null;

  const handleIncluir = () => {
    setXEditMode("insert");
    setXEditCpf("");
    setXEditNome("");
    setXEditTelefone("");
    setXEditPix("");
  };

  const handleEditar = () => {
    if (!XSelectedMotorista) return;
    setXEditMode("edit");
    setXEditCpf(XSelectedMotorista.cpf);
    setXEditNome(XSelectedMotorista.nome);
    setXEditTelefone(XSelectedMotorista.telefone || "");
    setXEditPix(XSelectedMotorista.chave_pix || "");
  };

  const handleSalvar = async () => {
    const cpfClean = XEditCpf.replace(/\D/g, "");
    if (cpfClean.length !== 11) {
      toast.error("CPF inválido. Deve possuir 11 dígitos.");
      return;
    }
    if (!XEditNome.trim()) {
      toast.error("O nome do motorista é obrigatório.");
      return;
    }

    const XPayload = {
      cpf: cpfClean,
      nome: XEditNome.toUpperCase().trim(),
      telefone: XEditTelefone.trim(),
      chave_pix: XEditPix.trim(),
      cadastro_id: XCadastroId || 0,
      empresa_id: XEmpresaId,
      excluido: false,
    };

    if (!XCadastroId) {
      // Memory-only mode for new records
      if (XEditMode === "insert") {
        const newM: IMotorista = {
          ...XPayload,
          motorista_id: -Math.floor(Math.random() * 1000000), // temp negative ID
        };
        if (onChangeTempMotoristas && tempMotoristas) {
          onChangeTempMotoristas([...tempMotoristas, newM]);
        }
        toast.success("Motorista adicionado temporariamente.");
      } else if (XEditMode === "edit" && XSelectedMotorista) {
        if (onChangeTempMotoristas && tempMotoristas) {
          const updated = tempMotoristas.map(m =>
            m.motorista_id === XSelectedMotorista.motorista_id ? { ...m, ...XPayload } : m
          );
          onChangeTempMotoristas(updated);
        }
        toast.success("Motorista alterado temporariamente.");
      }
      setXEditMode("none");
      return;
    }

    // Database mode
    try {
      if (XEditMode === "insert") {
        const { error } = await db
          .from("cadastro_motorista")
          .insert({ ...XPayload, dt_cadastro: new Date().toISOString() });
        if (error) {
          toast.error("Erro ao incluir motorista: " + error.message);
          return;
        }
        toast.success("Motorista incluído com sucesso.");
      } else if (XEditMode === "edit" && XSelectedMotorista) {
        const { error } = await db
          .from("cadastro_motorista")
          .update({ ...XPayload, dt_alteracao: new Date().toISOString() })
          .eq("motorista_id", XSelectedMotorista.motorista_id);
        if (error) {
          toast.error("Erro ao alterar motorista: " + error.message);
          return;
        }
        toast.success("Motorista alterado com sucesso.");
      }
      setXEditMode("none");
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Erro ao salvar motorista:", errorObj);
      toast.error("Erro ao salvar motorista: " + errorObj.message);
    }
  };

  const handleExcluir = async () => {
    if (!XSelectedMotorista) return;

    if (!XCadastroId) {
      // Memory-only mode
      if (confirm(`Remover motorista "${XSelectedMotorista.nome}"?`)) {
        if (onChangeTempMotoristas && tempMotoristas) {
          const filtered = tempMotoristas.filter(m => m.motorista_id !== XSelectedMotorista.motorista_id);
          onChangeTempMotoristas(filtered);
        }
        toast.success("Motorista removido.");
        setXSelectedIdx(null);
      }
      return;
    }

    if (confirm(`Excluir motorista "${XSelectedMotorista.nome}"?`)) {
      try {
        const { error } = await db
          .from("cadastro_motorista")
          .update({ excluido: true, dt_alteracao: new Date().toISOString() })
          .eq("motorista_id", XSelectedMotorista.motorista_id);
        if (error) {
          toast.error("Erro ao excluir motorista: " + error.message);
          return;
        }
        toast.success("Motorista excluído com sucesso.");
        setXSelectedIdx(null);
        await loadData();
      } catch (err: unknown) {
        const errorObj = err as Error;
        console.error("Erro ao excluir motorista:", errorObj);
        toast.error("Erro ao excluir motorista: " + errorObj.message);
      }
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setXFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const XToolbar = (
    <GridActionToolbar
      actions={[
        gridActions.incluir(handleIncluir),
        gridActions.alterar(handleEditar, !XSelectedMotorista),
        null,
        gridActions.excluir(handleExcluir, !XSelectedMotorista),
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
              <label className="text-[10px] text-muted-foreground">CPF *</label>
              <input
                type="text"
                value={XEditCpf}
                onChange={(e) => setXEditCpf(e.target.value.replace(/\D/g, "").substring(0, 11))}
                maxLength={14}
                placeholder="Apenas números"
                className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-36"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground">Nome *</label>
              <input
                type="text"
                value={XEditNome}
                onChange={(e) => setXEditNome(e.target.value.toUpperCase())}
                className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-64"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground">Telefone</label>
              <input
                type="text"
                value={XEditTelefone}
                onChange={(e) => setXEditTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-36"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground">Chave PIX</label>
              <input
                type="text"
                value={XEditPix}
                onChange={(e) => setXEditPix(e.target.value)}
                className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-48"
              />
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
        columns={XMotoristaColumns}
        data={XFiltered}
        selectedIdx={XSelectedIdx}
        onRowClick={(_row, idx) => setXSelectedIdx(idx)}
        onRowDoubleClick={(_row, idx) => {
          setXSelectedIdx(idx);
          const m = XFiltered[idx];
          if (m) {
            setXEditMode("edit");
            setXEditCpf(m.cpf);
            setXEditNome(m.nome);
            setXEditTelefone(m.telefone || "");
            setXEditPix(m.chave_pix || "");
          }
        }}
        showFilters={XShowFilters}
        filterValues={XFilterValues}
        onFilterChange={handleFilterChange}
        maxHeight="250px"
        exportTitle="Motoristas"
        toolbarLeft={XToolbar}
        showRecordCount={false}
      />
    </div>
  );
};

export default MotoristaGrid;
