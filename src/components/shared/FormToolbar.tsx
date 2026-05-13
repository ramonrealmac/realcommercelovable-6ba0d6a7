import React from "react";
import { 
  Plus, SquarePen, Save, X, Trash2, 
  ChevronLeft, ChevronsLeft, ChevronRight, ChevronsRight, 
  RefreshCw, Search, LogOut, FileText, HelpCircle 
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const ToolbarBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: "success" | "destructive" | "default" | "warning" | "info" | "nav" | "help" | "log";
}> = ({ icon, label, onClick, disabled, color = "default" }) => {
  
  const XColorClass = 
    color === "success" ? "text-emerald-600 dark:text-emerald-500" :
    color === "destructive" ? "text-rose-600 dark:text-rose-500" :
    color === "warning" ? "text-amber-600 dark:text-amber-500" :
    color === "info" ? "text-sky-600 dark:text-sky-500" :
    color === "nav" ? "text-indigo-500 dark:text-indigo-400" :
    color === "help" ? "text-slate-400 dark:text-slate-500" :
    color === "log" ? "text-teal-600 dark:text-teal-500" :
    "text-slate-600 dark:text-slate-400";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-accent flex items-center justify-center ${XColorClass} ${
              disabled ? "opacity-30 grayscale cursor-not-allowed" : "hover:scale-110 active:scale-95"
            }`}
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const ToolbarSeparator: React.FC = () => (
  <div className="w-px h-6 bg-border mx-1" />
);

interface FormToolbarProps {
  XIsEditing: boolean;
  XHasRecord: boolean;
  XIsFirst: boolean;
  XIsLast: boolean;
  onIncluir: () => void;
  onEditar: () => void;
  onSalvar: () => void;
  onCancelar: () => void;
  onExcluir: () => void;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onRefresh: () => void;
  onLocalizar: () => void;
  onSair: () => void;
  onLog?: () => void;
  onHelp?: () => void;
  XCanEdit?: boolean;
  extras?: React.ReactNode;
}

const FormToolbar: React.FC<FormToolbarProps> = ({
  XIsEditing, XHasRecord, XIsFirst, XIsLast,
  onIncluir, onEditar, onSalvar, onCancelar, onExcluir,
  onFirst, onPrev, onNext, onLast, onRefresh, onLocalizar, onSair,
  onLog, onHelp, XCanEdit = true, extras
}) => {
  return (
    <div className="flex items-center gap-0.5 p-1 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 overflow-x-auto no-scrollbar">
      {!XIsEditing ? (
        <>
          <ToolbarBtn icon={<Plus size={18} />} label="Incluir (Ins)" onClick={onIncluir} color="success" />
          <ToolbarBtn icon={<SquarePen size={18} />} label="Alterar (F2)" onClick={onEditar} disabled={!XHasRecord || !XCanEdit} color="warning" />
          <ToolbarBtn icon={<Trash2 size={18} />} label="Excluir (Del)" onClick={onExcluir} disabled={!XHasRecord || !XCanEdit} color="destructive" />
          <ToolbarSeparator />
          <ToolbarBtn icon={<ChevronsLeft size={18} />} label="Primeiro" onClick={onFirst} disabled={XIsFirst || !XHasRecord} color="nav" />
          <ToolbarBtn icon={<ChevronLeft size={18} />} label="Anterior" onClick={onPrev} disabled={XIsFirst || !XHasRecord} color="nav" />
          <ToolbarBtn icon={<ChevronRight size={18} />} label="Próximo" onClick={onNext} disabled={XIsLast || !XHasRecord} color="nav" />
          <ToolbarBtn icon={<ChevronsRight size={18} />} label="Último" onClick={onLast} disabled={XIsLast || !XHasRecord} color="nav" />
          <ToolbarSeparator />
          <ToolbarBtn icon={<RefreshCw size={18} />} label="Atualizar (F5)" onClick={onRefresh} color="info" />
          <ToolbarBtn icon={<Search size={18} />} label="Localizar (F3)" onClick={onLocalizar} color="info" />
          {onLog && <ToolbarBtn icon={<FileText size={18} />} label="Log de Operações" onClick={onLog} color="log" />}
        </>
      ) : (
        <>
          <ToolbarBtn icon={<Save size={18} />} label="Salvar (F10)" onClick={onSalvar} color="success" />
          <ToolbarBtn icon={<X size={18} />} label="Cancelar (Esc)" onClick={onCancelar} color="destructive" />
        </>
      )}
      <ToolbarSeparator />
      {extras}
      <ToolbarSeparator />
      <ToolbarBtn icon={<HelpCircle size={18} />} label="Ajuda (F1)" onClick={onHelp || (() => {})} color="help" />
      <ToolbarBtn icon={<LogOut size={18} />} label="Sair (Esc)" onClick={onSair} color="destructive" />
    </div>
  );
};

export default FormToolbar;
