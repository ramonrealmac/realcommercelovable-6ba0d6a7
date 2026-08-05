import React, { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { formatMask } from "@/lib/validators";
import { supabase } from "@/integrations/supabase/client";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";

interface IPlanoConta {
  plano_conta_id: number;
  conta: string;
  nome: string;
  tp_conta: string;
  tp_natureza: string;
  empresa_id: number;
}

const XGridCols: IGridColumn[] = [
  { key: "plano_conta_id", label: "Cód", width: "60px", align: "right" },
  { key: "conta", label: "Conta", width: "150px" },
  { key: "nome", label: "Nome", width: "1fr" },
  { key: "tp_conta", label: "Tipo", width: "100px", render: (r) => r.tp_conta === "S" ? "Sintética" : "Analítica" },
  { key: "tp_natureza", label: "Natureza", width: "100px", render: (r) => r.tp_natureza === "R" ? "Receita" : r.tp_natureza === "D" ? "Despesa" : r.tp_natureza },
];

const PlanoContaForm: React.FC = () => {
  const { XEmpresaId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaId);
  const XEmpLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaId);
  
  const [XMascara, setXMascara] = useState("9.99.999.999");

  useEffect(() => {
    // Buscar mascara_plano da empresa atual, com fallback para 9.99.999.999
    const fetchMascara = async () => {
      const { data, error } = await supabase
        .from("empresa")
        .select("mascara_plano")
        .eq("empresa_id", XEmpresaId)
        .single();
      
      if (!error && data && data.mascara_plano) {
        setXMascara(data.mascara_plano);
      }
    };
    fetchMascara();
  }, [XEmpresaId]);

  return (
    <StandardCrudForm<IPlanoConta>
      config={{
        XTableName: "plano_conta",
        XPrimaryKey: "plano_conta_id",
        XOrderBy: "conta",
        XTitle: "Plano de Contas",
        XEmpresaId: XEmpresaId,
        XDefaultRecord: { conta: "", nome: "", tp_conta: "A", tp_natureza: "R" },
        XOnBeforeSave: (rec) => {
          if (!rec.conta?.trim()) throw new Error("A Conta é obrigatória.");
          if (!rec.nome?.trim()) throw new Error("O Nome é obrigatório.");
          return { ...rec, conta: rec.conta.trim(), nome: rec.nome.trim() };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Plano de Contas"
      XToolbarExtras={({ currentRecord, isEditing, setRecord, setInnerTab, handleIncluir }) => {
        const handleCreateSubConta = async () => {
          if (!currentRecord || !currentRecord.conta) {
            toast.error("Selecione uma conta na listagem (Localizar) primeiro.");
            return;
          }

          const parentConta = currentRecord.conta;
          const parts = parentConta.split('.');
          const subIndex = parts.length;
          const maskParts = XMascara.split('.');

          if (subIndex >= maskParts.length) {
            toast.error("Não é possível criar subconta. Limite de níveis da máscara atingido.");
            return;
          }

          const subMask = maskParts[subIndex];

          try {
            // Buscar todos os registros filhos diretos do banco de dados para evitar conflito de concorrência
            const { data, error } = await supabase
              .from("plano_conta")
              .select("conta")
              .eq("empresa_id", XEmpresaId)
              .eq("excluido", false)
              .like("conta", parentConta + ".%");

            if (error) throw new Error(error.message);

            // Filtrar para pegar apenas filhos diretos
            const directChildren = (data || [])
              .map(r => r.conta)
              .filter(c => {
                const cParts = c.split('.');
                return cParts.length === parts.length + 1;
              });

            let maxVal = 0;
            directChildren.forEach(c => {
              const lastPart = c.split('.').pop();
              if (lastPart) {
                const val = parseInt(lastPart, 10);
                if (!isNaN(val) && val > maxVal) {
                  maxVal = val;
                }
              }
            });

            const nextVal = maxVal + 1;
            const nextPart = String(nextVal).padStart(subMask.length, '0');

            if (nextPart.length > subMask.length) {
              toast.error(`Limite numérico excedido para este nível da máscara (${subMask}).`);
              return;
            }

            const nextConta = parentConta + "." + nextPart;

            // Inicia a inclusão
            handleIncluir();

            // Define os valores iniciais da subconta
            setRecord({
              conta: nextConta,
              nome: "",
              tp_conta: "A", // Analítica por padrão para subcontas
              tp_natureza: currentRecord.tp_natureza // Herda a natureza da conta mãe
            });

            setInnerTab("cadastro");
            toast.success(`Nova subconta sugerida: ${nextConta}`);

          } catch (err) {
            console.error("Erro ao gerar subconta:", err);
            toast.error("Erro ao gerar código da subconta.");
          }
        };

        return (
          <button
            type="button"
            disabled={isEditing || !currentRecord}
            onClick={handleCreateSubConta}
            title="Incluir Nova Sub Conta"
            className="flex items-center gap-1.5 text-[11px] bg-primary text-primary-foreground px-3 py-1.5 rounded border border-border hover:opacity-90 transition-opacity font-bold uppercase shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Nova Sub Conta
          </button>
        );
      }}
      renderCadastro={({ record, setField, mode, isEditing, data }) => {
        const handleContaChange = (val: string) => {
          const formatted = formatMask(val, XMascara);
          setField("conta", formatted);
        };

        const getParentConta = (conta: string) => {
          if (!conta) return "";
          const parts = conta.split('.');
          if (parts.length <= 1) return "";
          return parts.slice(0, -1).join('.');
        };

        const parentConta = getParentConta(record.conta ?? "");
        const parentRecord = data?.find(x => x.conta === parentConta);
        const parentLabel = parentRecord ? `${parentRecord.conta} - ${parentRecord.nome}` : parentConta;

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="w-full">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                <input type="text" value={mode === "insert" ? "(Novo)" : record.plano_conta_id ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
              </div>
              <div className="w-full md:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
                <input type="text" value={XEmpLabel} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
              </div>
            </div>

            {parentConta ? (
              <div className="w-full">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Conta Mãe (Informação)</label>
                <input 
                  type="text" 
                  value={parentLabel} 
                  readOnly 
                  disabled
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary opacity-80 cursor-not-allowed" 
                />
              </div>
            ) : null}
            
            <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
              <div className="w-full md:w-48">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Conta <span className="text-destructive">*</span>
                  <span className="text-[10px] text-muted-foreground ml-2">(Masc: {XMascara})</span>
                </label>
                <input
                  type="text"
                  value={record.conta ?? ""}
                  onChange={e => handleContaChange(e.target.value)}
                  readOnly={!isEditing}
                  autoFocus={isEditing}
                  placeholder={XMascara.replace(/9/g, "_")}
                  maxLength={XMascara.length}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nome <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={record.nome ?? ""}
                  onChange={e => setField("nome", e.target.value.toUpperCase())}
                  readOnly={!isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Conta</label>
                <select
                  value={record.tp_conta || "A"}
                  onChange={(e) => setField("tp_conta", e.target.value)}
                  disabled={!isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                >
                  <option value="A">Analítica</option>
                  <option value="S">Sintética</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Natureza</label>
                <select
                  value={record.tp_natureza || "R"}
                  onChange={(e) => setField("tp_natureza", e.target.value)}
                  disabled={!isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                >
                  <option value="R">Receita</option>
                  <option value="D">Despesa</option>
                </select>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
};

export default PlanoContaForm;
