import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, X } from "lucide-react";

export interface ICargoRow {
  cargo_id: number;
  cargo_descricao: string;
  pc_desc_maximo_av?: number;
  pc_desc_maximo_prz?: number;
}

interface CargoSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (cargo: ICargoRow) => void;
  empresaMatrizId: number;
}

const fmt2 = (v: number | null | undefined) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CargoSearchDialog: React.FC<CargoSearchDialogProps> = ({
  open,
  onClose,
  onSelect,
  empresaMatrizId,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<ICargoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchCargos = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    let query = (supabase as any)
      .from("cargo")
      .select("cargo_id, cargo_descricao, pc_desc_maximo_av, pc_desc_maximo_prz")
      .eq("cargo_empresa_id", empresaMatrizId)
      .eq("excluido", false)
      .order("cargo_descricao");

    if (searchTerm.trim()) {
      const term = `%${searchTerm.trim().toUpperCase()}%`;
      query = query.or(`cargo_descricao.ilike.${term}`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setRows(data);
      setSelectedIdx(data.length > 0 ? 0 : null);
    } else {
      setRows([]);
      setSelectedIdx(null);
    }
    setLoading(false);
  }, [open, empresaMatrizId, searchTerm]);

  useEffect(() => {
    if (open) {
      setSearchTerm("");
      fetchCargos();
    }
  }, [open, fetchCargos]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rows.length > 0) {
        setSelectedIdx(prev => (prev === null || prev >= rows.length - 1 ? 0 : prev + 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length > 0) {
        setSelectedIdx(prev => (prev === null || prev <= 0 ? rows.length - 1 : prev - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIdx !== null && rows[selectedIdx]) {
        onSelect(rows[selectedIdx]);
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-card border-border shadow-2xl">
        <DialogHeader className="p-4 border-b border-border bg-secondary/30 flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Search size={18} className="text-primary" />
            Localizar Cargo
          </DialogTitle>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </DialogHeader>

        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite para pesquisar por descrição do cargo... (Enter para selecionar, Esc para fechar)"
              autoFocus
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-card focus:ring-2 focus:ring-ring outline-none"
            />
          </div>

          <div
            ref={listRef}
            className="border border-border rounded-md max-h-[300px] overflow-y-auto divide-y divide-border bg-card"
          >
            {loading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Carregando cargos...</div>
            ) : rows.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Nenhum cargo encontrado.</div>
            ) : (
              rows.map((cargo, idx) => (
                <div
                  key={cargo.cargo_id}
                  onClick={() => {
                    onSelect(cargo);
                    onClose();
                  }}
                  className={`p-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                    selectedIdx === idx ? "bg-primary/15 text-primary font-semibold" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      #{cargo.cargo_id}
                    </span>
                    <span>{cargo.cargo_descricao}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-x-3">
                    <span>À Vista: {fmt2(cargo.pc_desc_maximo_av)}%</span>
                    <span>À Prazo: {fmt2(cargo.pc_desc_maximo_prz)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-4 py-2 border-t border-border bg-muted/20 flex justify-between text-xs text-muted-foreground">
          <span>Seta para cima/baixo seleciona • Enter confirma</span>
          <button
            onClick={onClose}
            className="px-3 py-1 border border-border rounded bg-card hover:bg-accent text-foreground"
          >
            Cancelar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CargoSearchDialog;
