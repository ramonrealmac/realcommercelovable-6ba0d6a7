import React from "react";
import { Plus, SquarePen, Trash2, RefreshCw, Filter, LucideIcon } from "lucide-react";

export interface IGridActionBtn {
  icon: React.ReactNode;
  label: string;          // tooltip
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "success" | "destructive" | "primary" | "warning" | "info" | "nav" | "help" | "log";
  active?: boolean;
}

const GridIconBtn: React.FC<IGridActionBtn> = ({ icon, label, onClick, disabled, variant = "default", active }) => {
  const colorCls =
    variant === "success" ? "text-emerald-600 dark:text-emerald-500" :
    variant === "destructive" ? "text-rose-600 dark:text-rose-500" :
    variant === "warning" ? "text-amber-600 dark:text-amber-500" :
    variant === "primary" || variant === "info" ? "text-sky-600 dark:text-sky-500" :
    variant === "nav" ? "text-indigo-600 dark:text-indigo-500" :
    variant === "log" ? "text-teal-600 dark:text-teal-500" :
    variant === "help" ? "text-slate-500 dark:text-slate-400" :
    "text-slate-600 dark:text-slate-400";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-md transition-all duration-200 hover:bg-accent flex items-center justify-center ${
        active ? "text-amber-600 dark:text-amber-500" : colorCls
      } ${disabled ? "opacity-30 grayscale cursor-not-allowed" : "hover:scale-110 active:scale-95"}`}
    >
      {icon}
    </button>
  );
};

export const GridSeparator: React.FC = () => (
  <div className="w-px h-5 bg-border mx-0.5" />
);

interface IGridActionToolbarProps {
  actions: (IGridActionBtn | null)[];
  count?: string;
  extras?: React.ReactNode;
}

const GridActionToolbar: React.FC<IGridActionToolbarProps> = ({ actions, count, extras }) => {
  return (
    <div className="flex items-center gap-0.5 min-h-[36px]">
      {actions.map((a, i) =>
        a === null
          ? <GridSeparator key={`sep-${i}`} />
          : <GridIconBtn key={`btn-${i}-${a.label}`} {...a} />
      )}
      {extras}
      {count !== undefined && (
        <div className="flex items-center">
          <GridSeparator />
          <span className="text-[11px] font-bold text-slate-500 px-2 whitespace-nowrap uppercase tracking-wider">{count}</span>
        </div>
      )}
    </div>
  );
};

export const gridActions = {
  incluir: (onClick: () => void, disabled = false): IGridActionBtn =>
    ({ icon: <Plus size={16} />, label: "Incluir", onClick, disabled, variant: "success" }),
  alterar: (onClick: () => void, disabled = false): IGridActionBtn =>
    ({ icon: <SquarePen size={16} />, label: "Alterar", onClick, disabled, variant: "warning" }),
  excluir: (onClick: () => void, disabled = false): IGridActionBtn =>
    ({ icon: <Trash2 size={16} />, label: "Excluir", onClick, disabled, variant: "destructive" }),
  atualizar: (onClick: () => void): IGridActionBtn =>
    ({ icon: <RefreshCw size={16} />, label: "Atualizar", onClick, variant: "info" }),
  filtro: (onClick: () => void, active = false): IGridActionBtn =>
    ({ icon: <Filter size={16} />, label: "Filtrar", onClick, active, variant: active ? "warning" : "default" }),
  custom: (icon: LucideIcon, label: string, onClick: () => void, opts: Partial<IGridActionBtn> = {}): IGridActionBtn => {
    const Ico = icon;
    return { icon: <Ico size={16} />, label, onClick, ...opts };
  },
};

export default GridActionToolbar;
