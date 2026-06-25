import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import { Loader2 } from "lucide-react";
import SelecionarCaixaDialog from "./SelecionarCaixaDialog";
import PdvTela from "./PdvTela";
import type { IPdvCaixa, IPdvCaixaAbertura } from "./types";

const db = supabase as any;

interface IProps {
  initialFuncionarioId?: number;
  initialDtAbertura?: string;
}

const PdvCaixaForm: React.FC<IProps> = ({ initialFuncionarioId, initialDtAbertura }) => {
  const { XEmpresaId } = useAppContext();
  const [XStep, setXStep] = useState<"loading" | "selecionar" | "pdv">(
    initialFuncionarioId ? "loading" : "selecionar"
  );
  const [XCaixa, setXCaixa] = useState<IPdvCaixa | null>(null);
  const [XAbertura, setXAbertura] = useState<IPdvCaixaAbertura | null>(null);
  const [XDtMov, setXDtMov] = useState<string>("");

  useEffect(() => {
    if (initialFuncionarioId) {
      (async () => {
        try {
          // Fetch employee (caixa) details
          const { data: func, error: funcError } = await db.from("funcionario")
            .select(`
              funcionario_id, cd_funcionario, nome, tamanho_fonte_pedidos, tamanho_fonte_produtos, tempo_refresh_pdv, 
              caixa_inf_vend, caixa_cnc_venda, caixa_edit_venda,
              nfe_config_item, nfce_config_item
            `)
            .eq("funcionario_id", initialFuncionarioId)
            .single();
          
          if (funcError || !func) {
            setXStep("selecionar");
            return;
          }

          // Fetch config names if any
          const configIds = [func.nfe_config_item, func.nfce_config_item].filter(Boolean);
          let configMap: Record<number, string> = {};
          if (configIds.length > 0) {
            const { data: configs } = await db.from("fiscal_config_item")
              .select("fiscal_config_item_id, nome")
              .in("fiscal_config_item_id", configIds);
            
            (configs || []).forEach((c: any) => {
              configMap[c.fiscal_config_item_id] = c.nome;
            });
          }

          const caixaObj: IPdvCaixa = {
            ...func,
            nfe_nome: configMap[func.nfe_config_item] || "",
            nfce_nome: configMap[func.nfce_config_item] || ""
          };

          // Fetch active opening
          const { data: aberts, error: abertError } = await db.from("caixa_abertura")
            .select("*")
            .eq("empresa_id", XEmpresaId)
            .eq("funcionario_id", initialFuncionarioId)
            .eq("status", "A")
            .order("caixa_abertura_id", { ascending: false })
            .limit(1);

          if (abertError || !aberts || aberts.length === 0) {
            setXStep("selecionar");
            return;
          }

          const aberturaObj = aberts[0] as IPdvCaixaAbertura;
          const dtAb = initialDtAbertura || String(aberturaObj.dt_abertura).slice(0, 10);

          setXCaixa(caixaObj);
          setXAbertura(aberturaObj);
          setXDtMov(dtAb);
          setXStep("pdv");
        } catch (err) {
          console.error("Auto login error in PdvCaixaForm", err);
          setXStep("selecionar");
        }
      })();
    }
  }, [initialFuncionarioId, initialDtAbertura, XEmpresaId]);

  if (XStep === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background/50 backdrop-blur-sm">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <span className="text-sm font-medium">Entrando no caixa...</span>
      </div>
    );
  }

  if (XStep === "selecionar" || !XCaixa || !XAbertura) {
    return (
      <SelecionarCaixaDialog
        onEntrar={({ caixa, abertura, dtMovimento }) => {
          setXCaixa(caixa);
          setXAbertura(abertura);
          setXDtMov(dtMovimento);
          setXStep("pdv");
        }}
        onCancelar={() => { /* tab fica vazia; usuário fecha aba pelo TabBar */ }}
      />
    );
  }

  return (
    <PdvTela
      caixa={XCaixa}
      abertura={XAbertura}
      dtMovimento={XDtMov}
      onSair={() => { setXStep("selecionar"); setXCaixa(null); setXAbertura(null); }}
    />
  );
};

export default PdvCaixaForm;
