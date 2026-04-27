import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ICondicao {
  condicao_id: number;
  descricao: string;
  tp_doc: string;
  prazo_1: number; prazo_2: number; prazo_3: number; prazo_4: number;
  prazo_5: number; prazo_6: number; prazo_7: number; prazo_8: number;
  prazo_9: number; prazo_10: number; prazo_11: number; prazo_12: number;
  empresa_id: number;
}

const XGridCols: IGridColumn[] = [
  { key: "condicao_id", label: "Código", width: "80px", align: "right" },
  { key: "descricao", label: "Descrição", width: "1fr" },
  { key: "tp_doc", label: "Tipo Doc.", width: "100px" },
];

const TP_DOC_OPTIONS = [
  { v: "", l: "— Nenhum —" },
  { v: "DM", l: "Duplicata Mercantil" },
  { v: "NP", l: "Nota Promissória" },
  { v: "RC", l: "Recibo" },
  { v: "BO", l: "Boleto" },
  { v: "CH", l: "Cheque" },
  { v: "DI", l: "Dinheiro" },
  { v: "CC", l: "Cartão Crédito" },
  { v: "CD", l: "Cartão Débito" },
  { v: "PIX", l: "PIX" },
];

const PRAZO_KEYS = ["prazo_1","prazo_2","prazo_3","prazo_4","prazo_5","prazo_6","prazo_7","prazo_8","prazo_9","prazo_10","prazo_11","prazo_12"] as const;

const XDefault: Partial<ICondicao> = {
  descricao: "", tp_doc: "",
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
          const out: any = { ...rec, descricao: rec.descricao.trim(), tp_doc: rec.tp_doc || "" };
          PRAZO_KEYS.forEach(k => { out[k] = parseInt(String(out[k] ?? 0)) || 0; });
          return out;
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Condições de Pagamento"
      renderCadastro={({ record, setField, mode, isEditing }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
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
            <div className="w-full md:w-48">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo Documento</label>
              {isEditing ? (
                <Select value={record.tp_doc || "__none__"} onValueChange={v => setField("tp_doc", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-[34px] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TP_DOC_OPTIONS.map(o => <SelectItem key={o.v || "__none__"} value={o.v || "__none__"}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <input type="text" value={TP_DOC_OPTIONS.find(o => o.v === record.tp_doc)?.l || record.tp_doc || ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Prazos (dias)</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
