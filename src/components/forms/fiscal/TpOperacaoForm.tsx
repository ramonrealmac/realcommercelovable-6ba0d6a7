import React, { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { ICrudConfig } from "@/hooks/useCrudController";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Check, X } from "lucide-react";

interface ITpOperacao {
  tp_operacao_id: number;
  empresa_id: number;
  tp_movimento: string;
  descricao: string;
  gera_financeiro: string;
  gera_nf: string;
  gera_boleto: string;
  altera_estoque: string;
  valida_preco: string;
  plano_id: number | null;
  excluido: boolean;
  dt_cadastro: string | null;
  dt_alteracao: string | null;
}

const MOVIMENTO_LABELS: Record<string, string> = {
  EA: "EA - ENTRADA DE AJUSTE",
  EC: "EC - ENTRADA DE COMPRAS",
  ED: "ED - ENTRADA DEVOLUCAO",
  ET: "ET - ENTRADA TRANSFERENCIA",
  EO: "EO - ENTRADAS OUTRAS",
  SA: "SA - SAIDA AJUSTE",
  SV: "SV - SAIDA VENDAS",
  SD: "SD - SAIDA DEVOLUCAO",
  ST: "ST - SAIDA TRANSFERENCIA",
  SO: "SO - SAIDAS OUTRAS",
};

const FlagBadge: React.FC<{ val: string | null | undefined }> = ({ val }) => {
  const isYes = val === "S";
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
        isYes ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
      }`}
    >
      {isYes ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {isYes ? "Sim" : "Não"}
    </span>
  );
};

const XGridCols: IGridColumn[] = [
  { key: "tp_operacao_id", label: "Código", width: "80px", align: "right" },
  { key: "descricao", label: "Descrição", width: "1.5fr" },
  {
    key: "tp_movimento",
    label: "Movimento",
    width: "220px",
    render: (r) => MOVIMENTO_LABELS[r.tp_movimento] || r.tp_movimento,
  },
  {
    key: "gera_financeiro",
    label: "Financeiro",
    width: "100px",
    align: "center",
    render: (r) => <FlagBadge val={r.gera_financeiro} />,
  },
  {
    key: "gera_nf",
    label: "Gerar NF",
    width: "100px",
    align: "center",
    render: (r) => <FlagBadge val={r.gera_nf} />,
  },
  {
    key: "gera_boleto",
    label: "Boleto",
    width: "100px",
    align: "center",
    render: (r) => <FlagBadge val={r.gera_boleto} />,
  },
  {
    key: "altera_estoque",
    label: "Estoque",
    width: "100px",
    align: "center",
    render: (r) => <FlagBadge val={r.altera_estoque} />,
  },
  {
    key: "valida_preco",
    label: "Val. Preço",
    width: "100px",
    align: "center",
    render: (r) => <FlagBadge val={r.valida_preco} />,
  },
];

const TpOperacaoForm: React.FC = () => {
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find((e) => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz
    ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}`
    : String(XEmpresaMatrizId);

  const [XPlanos, setXPlanos] = useState<{ plano_conta_id: number; nome: string; conta: string }[]>([]);

  useEffect(() => {
    const loadPlanos = async () => {
      const { data, error } = await supabase
        .from("plano_conta")
        .select("plano_conta_id, nome, conta")
        .eq("tp_conta", "A")
        .order("conta");
      if (!error && data) {
        setXPlanos(data);
      }
    };
    loadPlanos();
  }, []);

  const XConfig: ICrudConfig<ITpOperacao> = {
    XTableName: "tp_operacao",
    XPrimaryKey: "tp_operacao_id",
    XTitle: "Tipos de Operações",
    XOrderBy: "tp_operacao_id",
    XEmpresaId: XEmpresaMatrizId,
    XDefaultRecord: {
      descricao: "",
      tp_movimento: "SV",
      gera_financeiro: "N",
      gera_nf: "N",
      gera_boleto: "N",
      altera_estoque: "N",
      valida_preco: "N",
      plano_id: null,
      empresa_id: XEmpresaMatrizId,
    },
    XOnBeforeSave: (rec) => {
      if (!rec.descricao?.trim()) {
        throw new Error("A descrição do tipo de operação é obrigatória.");
      }
      if (!rec.tp_movimento) {
        throw new Error("O tipo de movimento é obrigatório.");
      }
      return {
        ...rec,
        descricao: rec.descricao.trim().toUpperCase(),
      };
    },
  };

  return (
    <StandardCrudForm<ITpOperacao>
      config={XConfig}
      XGridCols={XGridCols}
      XExportTitle="Tipos de Operações"
      renderCadastro={({ record, setField, mode, isEditing }) => (
        <div className="space-y-6">
          {/* Dados Principais */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input
                type="text"
                value={mode === "insert" ? "(Novo)" : record.tp_operacao_id ?? ""}
                readOnly
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
              <input
                type="text"
                value={XEmpLabel}
                readOnly
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary"
              />
            </div>
            <div className="md:col-span-7">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Descrição <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={record.descricao ?? ""}
                onChange={(e) => setField("descricao", e.target.value)}
                readOnly={!isEditing}
                autoFocus={isEditing}
                maxLength={40}
                placeholder="Ex: VENDA DE MERCADORIA ESTADUAL"
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Combo Movimento */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Tipo de Movimento <span className="text-destructive">*</span>
              </label>
              <select
                value={record.tp_movimento ?? "SV"}
                onChange={(e) => setField("tp_movimento", e.target.value)}
                disabled={!isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`}
              >
                <optgroup label="Entradas">
                  <option value="EA">EA - Entrada de Ajuste</option>
                  <option value="EC">EC - Entrada de Compras</option>
                  <option value="ED">ED - Entrada Devolução</option>
                  <option value="ET">ET - Entrada Transferência</option>
                  <option value="EO">EO - Entradas Outras</option>
                </optgroup>
                <optgroup label="Saídas">
                  <option value="SA">SA - Saída Ajuste</option>
                  <option value="SV">SV - Saída Vendas</option>
                  <option value="SD">SD - Saída Devolução</option>
                  <option value="ST">ST - Saída Transferência</option>
                  <option value="SO">SO - Saídas Outras</option>
                </optgroup>
              </select>
            </div>

            {/* Plano de Contas */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Plano de Contas</label>
              <select
                value={record.plano_id ?? ""}
                onChange={(e) => setField("plano_id", e.target.value ? Number(e.target.value) : null)}
                disabled={!isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`}
              >
                <option value="">-- Selecione o Plano de Contas --</option>
                {XPlanos.map((p) => (
                  <option key={p.plano_conta_id} value={p.plano_conta_id}>
                    {p.conta} - {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Painel de Configurações / Flags */}
          <div className="border border-border rounded p-4 bg-muted/20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Parâmetros da Operação
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              {/* Gera Financeiro */}
              <div className="flex flex-col justify-between p-3 border border-border rounded bg-card hover:border-muted-foreground/20 transition-all duration-200 min-h-[100px]">
                <div>
                  <span className="text-xs font-semibold block text-foreground">Gerar Financeiro</span>
                  <span className="text-[10px] text-muted-foreground block mt-1 leading-tight">
                    Lança as parcelas em contas a pagar ou receber.
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {record.gera_financeiro === "S" ? "ATIVADO" : "DESATIVADO"}
                  </span>
                  <Switch
                    disabled={!isEditing}
                    checked={record.gera_financeiro === "S"}
                    onCheckedChange={(checked) => setField("gera_financeiro", checked ? "S" : "N")}
                  />
                </div>
              </div>

              {/* Gerar NF */}
              <div className="flex flex-col justify-between p-3 border border-border rounded bg-card hover:border-muted-foreground/20 transition-all duration-200 min-h-[100px]">
                <div>
                  <span className="text-xs font-semibold block text-foreground">Gerar Nota Fiscal</span>
                  <span className="text-[10px] text-muted-foreground block mt-1 leading-tight">
                    Habilita faturamento e emissão de notas fiscais.
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {record.gera_nf === "S" ? "ATIVADO" : "DESATIVADO"}
                  </span>
                  <Switch
                    disabled={!isEditing}
                    checked={record.gera_nf === "S"}
                    onCheckedChange={(checked) => setField("gera_nf", checked ? "S" : "N")}
                  />
                </div>
              </div>

              {/* Gerar Boleto */}
              <div className="flex flex-col justify-between p-3 border border-border rounded bg-card hover:border-muted-foreground/20 transition-all duration-200 min-h-[100px]">
                <div>
                  <span className="text-xs font-semibold block text-foreground">Gerar Boleto</span>
                  <span className="text-[10px] text-muted-foreground block mt-1 leading-tight">
                    Emite boleto bancário para os títulos gerados.
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {record.gera_boleto === "S" ? "ATIVADO" : "DESATIVADO"}
                  </span>
                  <Switch
                    disabled={!isEditing}
                    checked={record.gera_boleto === "S"}
                    onCheckedChange={(checked) => setField("gera_boleto", checked ? "S" : "N")}
                  />
                </div>
              </div>

              {/* Altera Estoque */}
              <div className="flex flex-col justify-between p-3 border border-border rounded bg-card hover:border-muted-foreground/20 transition-all duration-200 min-h-[100px]">
                <div>
                  <span className="text-xs font-semibold block text-foreground">Movimentar Estoque</span>
                  <span className="text-[10px] text-muted-foreground block mt-1 leading-tight">
                    Movimenta o saldo físico de estoque dos produtos.
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {record.altera_estoque === "S" ? "ATIVADO" : "DESATIVADO"}
                  </span>
                  <Switch
                    disabled={!isEditing}
                    checked={record.altera_estoque === "S"}
                    onCheckedChange={(checked) => setField("altera_estoque", checked ? "S" : "N")}
                  />
                </div>
              </div>

              {/* Valida Preço */}
              <div className="flex flex-col justify-between p-3 border border-border rounded bg-card hover:border-muted-foreground/20 transition-all duration-200 min-h-[100px]">
                <div>
                  <span className="text-xs font-semibold block text-foreground">Validar Preço Mínimo</span>
                  <span className="text-[10px] text-muted-foreground block mt-1 leading-tight">
                    Valida o preço de venda contra a tabela de preços.
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {record.valida_preco === "S" ? "ATIVADO" : "DESATIVADO"}
                  </span>
                  <Switch
                    disabled={!isEditing}
                    checked={record.valida_preco === "S"}
                    onCheckedChange={(checked) => setField("valida_preco", checked ? "S" : "N")}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    />
  );
};

export default TpOperacaoForm;
