import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ICondicao {
  condicao_id: number;
  descricao: string;
  tipo_prazo: string | null;
  qtd_parcelas: number | null;
  prazo_1: number; prazo_2: number; prazo_3: number; prazo_4: number;
  prazo_5: number; prazo_6: number; prazo_7: number; prazo_8: number;
  prazo_9: number; prazo_10: number; prazo_11: number; prazo_12: number;
  empresa_id: number;
}

const XGridCols: IGridColumn[] = [
  { key: "condicao_id", label: "Código", width: "80px", align: "right" },
  { key: "descricao", label: "Descrição", width: "200px" },
  { key: "tipo_prazo", label: "Tipo Prazo", width: "120px" },
  { key: "qtd_parcelas", label: "Parcelas", width: "80px", align: "center" },
];

const TIPO_PRAZO_OPTIONS = [
  { v: "", l: "— Nenhum —" },
  { v: "01", l: "01 - Dinheiro" },
  { v: "02", l: "02 - Cheque" },
  { v: "03", l: "03 - Cartão de Crédito" },
  { v: "04", l: "04 - Cartão de Débito" },
  { v: "05", l: "05 - Cartão da Loja / Crediário Digital" },
  { v: "10", l: "10 - Vale Alimentação" },
  { v: "11", l: "11 - Vale Refeição" },
  { v: "12", l: "12 - Vale Presente" },
  { v: "13", l: "13 - Vale Combustível" },
  { v: "14", l: "14 - Duplicata Mercantil" },
  { v: "15", l: "15 - Boleto Bancário" },
  { v: "16", l: "16 - Depósito Bancário" },
  { v: "17", l: "17 - PIX Dinâmico" },
  { v: "18", l: "18 - Transferência Bancária / Carteira Digital" },
  { v: "19", l: "19 - Fidelidade / Cashback" },
  { v: "20", l: "20 - PIX Estático" },
  { v: "21", l: "21 - Crédito em Loja" },
  { v: "22", l: "22 - Pagamento Eletrônico não informado" },
  { v: "23", l: "23 - PIX Automático" },
  { v: "24", l: "24 - TEF – Book Transfer" },
  { v: "90", l: "90 - Sem pagamento" },
  { v: "91", l: "91 - Pagamento posterior (a prazo)" },
  { v: "99", l: "99 - Outros" },
];

const PRAZO_KEYS = ["prazo_1","prazo_2","prazo_3","prazo_4","prazo_5","prazo_6","prazo_7","prazo_8","prazo_9","prazo_10","prazo_11","prazo_12"] as const;

const XDefault: Partial<ICondicao> = {
  descricao: "", tipo_prazo: null, qtd_parcelas: null,
  prazo_1: 0, prazo_2: 0, prazo_3: 0, prazo_4: 0, prazo_5: 0, prazo_6: 0,
  prazo_7: 0, prazo_8: 0, prazo_9: 0, prazo_10: 0, prazo_11: 0, prazo_12: 0,
};

const CondicaoPagamentoForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  return (
    <StandardCrudForm<ICondicao>
      config={{
        XTableName: "condicao_pagamento",
        XPrimaryKey: "condicao_id",
        XTitle: "Condições de Pagamento",
        XEmpresaId,
        XDefaultRecord: XDefault,
        XOnBeforeSave: (rec) => {
          if (!rec.descricao?.trim()) throw new Error("A descrição é obrigatória.");
          const out: any = {
            ...rec,
            descricao: rec.descricao.trim(),
            tipo_prazo: rec.tipo_prazo || null,
          };
          PRAZO_KEYS.forEach(k => { out[k] = parseInt(String(out[k] ?? 0)) || 0; });
          return out;
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Condições de Pagamento"
      renderCadastro={({ record, setField, mode, isEditing }) => (
        <div className="space-y-4 pt-3 md:pt-0">
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-5">
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input type="text" value={mode === "insert" ? "(Novo)" : record.condicao_id ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={record.descricao ?? ""}
                onChange={e => setField("descricao", e.target.value.toUpperCase())}
                readOnly={!isEditing}
                autoFocus={isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
              />
            </div>
            <div className="w-full md:w-24">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Parcelas</label>
              <input
                type="number"
                value={String(record.qtd_parcelas ?? "")}
                onChange={e => setField("qtd_parcelas", parseInt(e.target.value) || null as any)}
                readOnly={!isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
              />
            </div>
            <div className="w-full md:w-52">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Prazo</label>
              {isEditing ? (
                <Select value={record.tipo_prazo || "__none__"} onValueChange={v => setField("tipo_prazo", v === "__none__" ? null : v as any)}>
                  <SelectTrigger className="h-[34px] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_PRAZO_OPTIONS.map(o => <SelectItem key={o.v || "__none__"} value={o.v || "__none__"}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <input type="text" value={TIPO_PRAZO_OPTIONS.find(o => o.v === record.tipo_prazo)?.l || record.tipo_prazo || ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Prazos em dias (por parcela)</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-x-3 gap-y-5">
              {PRAZO_KEYS.map((k, i) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{i + 1}ª Parcela</label>
                  <input
                    type="number"
                    value={String((record as any)[k] ?? 0)}
                    onChange={e => setField(k, parseInt(e.target.value) || 0 as any)}
                    readOnly={!isEditing}
                    className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    />
  );
};

export default CondicaoPagamentoForm;
