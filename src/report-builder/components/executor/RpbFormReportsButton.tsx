import React, { useState, useEffect } from 'react';
import { Printer, ChevronDown, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppContext } from '@/contexts/AppContext';
import { IRpbRelatorio } from '@/report-builder/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface Props {
  nmForm: string;
  currentRecord?: Record<string, any>;
  variant?: "default" | "outline" | "secondary" | "ghost";
  label?: string;
}

const RpbFormReportsButton: React.FC<Props> = ({ 
  nmForm, 
  currentRecord, 
  variant = "outline",
  label = "Imprimir"
}) => {
  const { XEmpresaId, openTab } = useAppContext();
  const [reports, setReports] = useState<IRpbRelatorio[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (nmForm && XEmpresaId) {
      setLoading(true);
      (async () => {
        const { data } = await supabase
          .from('rpb_relatorio')
          .select('*')
          .eq('empresa_id', XEmpresaId)
          .eq('nm_form', nmForm)
          .eq('excluido', false)
          .order('nome');
        
        if (data) setReports(data as IRpbRelatorio[]);
        setLoading(false);
      })();
    }
  }, [nmForm, XEmpresaId]);

  const handleOpenReport = (rel: IRpbRelatorio) => {
    openTab({
      title: rel.nome,
      component: `rpb-exec-${rel.rpb_relatorio_id}`,
      params: currentRecord // Passa o registro atual como parâmetros iniciais
    });
  };

  if (reports.length === 0 && !loading) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className="gap-2" disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          <span className="hidden sm:inline">{label}</span>
          <ChevronDown size={14} className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Relatórios de {nmForm}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {reports.map(rel => (
          <DropdownMenuItem 
            key={rel.rpb_relatorio_id} 
            onClick={() => handleOpenReport(rel)}
            className="gap-2 cursor-pointer"
          >
            <FileText size={14} className="text-muted-foreground" />
            <span className="truncate">{rel.nome}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RpbFormReportsButton;
