import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { ToolbarBtn } from "@/components/shared/FormToolbar";
import { Lock, Building2, Store } from "lucide-react";
import TransferenciaEstoqueItensGrid, { ITransferenciaItemRow } from "./TransferenciaEstoqueItensGrid";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const db = supabase as any;

export interface ITransferenciaHeader {
  transferencia_id?: number;
  nr_transferencia?: number;
  empresa_origem_id: number;
  empresa_destino_id: number;
  deposito_origem_id: number;
  deposito_destino_id: number;
  dt_transferencia: string;
  observacao: string;
  st_transferencia: "ABERTA" | "FINALIZADA";
  usuario_cadastro?: string;
  usuario_finalizacao?: string;
  dt_criacao?: string;
  dt_finalizacao?: string;
  excluido?: boolean;
}

interface IEmpresaLookup {
  empresa_id: number;
  razao_social: string;
  nome_fantasia: string;
}

interface IDepositoLookup {
  deposito_id: number;
  nome: string;
  empresa_id: number;
}

interface IContentProps {
  record: any;
  setRecord: (r: any) => void;
  isEditing: boolean;
  isNew: boolean;
  refresh: () => Promise<void>;
  empresasLookup: IEmpresaLookup[];
  depositosOrigemLookup: IDepositoLookup[];
  depositosDestinoLookup: IDepositoLookup[];
  carregarDepositosOrigem: (id: number) => Promise<void>;
  carregarDepositosDestino: (id: number) => Promise<void>;
  itens: ITransferenciaItemRow[];
  setItens: React.Dispatch<React.SetStateAction<ITransferenciaItemRow[]>>;
  refreshCrudRef: React.MutableRefObject<(() => Promise<void>) | null>;
  setInnerTab: (tab: string) => void;
  onSalvar?: () => Promise<any>;
}

function TransferenciaFormContent({
  record,
  setRecord,
  isEditing,
  isNew,
  refresh,
  empresasLookup,
  depositosOrigemLookup,
  depositosDestinoLookup,
  carregarDepositosOrigem,
  carregarDepositosDestino,
  itens,
  setItens,
  refreshCrudRef,
  setInnerTab,
  onSalvar,
}: IContentProps) {
  const origemRef = useRef<HTMLSelectElement>(null);
  const destinoRef = useRef<HTMLSelectElement>(null);
  const depOrigemRef = useRef<HTMLSelectElement>(null);
  const depDestinoRef = useRef<HTMLSelectElement>(null);
  const obsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshCrudRef.current = refresh;
  }, [refresh, refreshCrudRef]);

  // Carregar depósitos de origem estritamente da filial de origem selecionada
  useEffect(() => {
    if (record?.empresa_origem_id) {
      carregarDepositosOrigem(record.empresa_origem_id);
    } else {
      carregarDepositosOrigem(0);
    }
  }, [record?.empresa_origem_id, carregarDepositosOrigem]);

  // Carregar depósitos de destino estritamente da filial de destino selecionada
  useEffect(() => {
    if (record?.empresa_destino_id) {
      carregarDepositosDestino(record.empresa_destino_id);
    } else {
      carregarDepositosDestino(0);
    }
  }, [record?.empresa_destino_id, carregarDepositosDestino]);

  const podeEditar = isEditing && record?.st_transferencia !== "FINALIZADA";
  const isFinalizada = record?.st_transferencia === "FINALIZADA" || record?.st_transferencia === "FECHADA";

  const handleObsKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      try {
        if (onSalvar) {
          await onSalvar();
        }
      } catch (err: any) {
        toast.error(err.message || "Erro ao salvar transferência.");
        return;
      }
      setInnerTab("itens");
    }
  };

  return (
    <div className="space-y-4">
      {/* Formulário Principal (Cabeçalho) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 border rounded-lg bg-card/40">
        
        {/* LINHA 1: Filial de Origem (5) | Filial de Destino (5) | Status (2) */}
        
        {/* Filial de Origem */}
        <div className="md:col-span-5 space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Building2 size={13} className="text-primary" />
            Filial de Origem *
          </label>
          <select
            ref={origemRef}
            disabled={!podeEditar}
            value={record?.empresa_origem_id || ""}
            onChange={(e) => {
              const val = Number(e.target.value);
              setRecord((r: any) => ({ ...r, empresa_origem_id: val, deposito_origem_id: 0 }));
              carregarDepositosOrigem(val);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                depOrigemRef.current?.focus();
              }
            }}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">-- Selecione a Filial de Origem --</option>
            {empresasLookup.map((emp) => (
              <option key={emp.empresa_id} value={emp.empresa_id}>
                {emp.empresa_id} - {emp.nome_fantasia || emp.razao_social}
              </option>
            ))}
          </select>
        </div>

        {/* Filial de Destino */}
        <div className="md:col-span-5 space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Building2 size={13} className="text-primary" />
            Filial de Destino *
          </label>
          <select
            ref={destinoRef}
            disabled={!podeEditar}
            value={record?.empresa_destino_id || ""}
            onChange={(e) => {
              const val = Number(e.target.value);
              setRecord((r: any) => ({ ...r, empresa_destino_id: val, deposito_destino_id: 0 }));
              carregarDepositosDestino(val);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                depDestinoRef.current?.focus();
              }
            }}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">-- Selecione a Filial de Destino --</option>
            {empresasLookup
              .filter(emp => emp.empresa_id !== record?.empresa_origem_id)
              .map((emp) => (
                <option key={emp.empresa_id} value={emp.empresa_id}>
                  {emp.empresa_id} - {emp.nome_fantasia || emp.razao_social}
                </option>
              ))}
          </select>
        </div>

        {/* Status (Fundo branco, texto vermelho se ABERTA, verde se FECHADA) */}
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex justify-between items-center">
            <span>Status</span>
            {record?.nr_transferencia ? (
              <span className="font-bold text-primary text-xs">Nº {record.nr_transferencia}</span>
            ) : null}
          </label>
          <div className="h-9 px-3 rounded-md border border-input flex items-center justify-center font-bold text-xs force-bg-white">
            <span className={isFinalizada ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}>
              {isFinalizada ? "FECHADA" : "ABERTA"}
            </span>
          </div>
        </div>

        {/* LINHA 2: Depósito de Origem (5) | Depósito de Destino (5) | Data e Hora (2) */}

        {/* Estoque / Depósito Origem */}
        <div className="md:col-span-5 space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Store size={13} className="text-primary" />
            Depósito de Origem *
          </label>
          <select
            ref={depOrigemRef}
            disabled={!podeEditar || !record?.empresa_origem_id}
            value={record?.deposito_origem_id || ""}
            onChange={(e) => setRecord((r: any) => ({ ...r, deposito_origem_id: Number(e.target.value) }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                destinoRef.current?.focus();
              }
            }}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">-- Selecione o Depósito de Origem --</option>
            {depositosOrigemLookup.map((dep) => (
              <option key={dep.deposito_id} value={dep.deposito_id}>
                {dep.deposito_id} - {dep.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Estoque / Depósito Destino */}
        <div className="md:col-span-5 space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Store size={13} className="text-primary" />
            Depósito de Destino *
          </label>
          <select
            ref={depDestinoRef}
            disabled={!podeEditar || !record?.empresa_destino_id}
            value={record?.deposito_destino_id || ""}
            onChange={(e) => setRecord((r: any) => ({ ...r, deposito_destino_id: Number(e.target.value) }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                obsRef.current?.focus();
              }
            }}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">-- Selecione o Depósito de Destino --</option>
            {depositosDestinoLookup.map((dep) => (
              <option key={dep.deposito_id} value={dep.deposito_id}>
                {dep.deposito_id} - {dep.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Data e Hora (Fundo Branco Puro) */}
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground block">
            Data / Hora
          </label>
          <div className="flex h-9 w-full rounded-md border border-input bg-white px-2 py-2 text-xs text-foreground font-medium items-center">
            {record?.dt_transferencia ? new Date(record.dt_transferencia).toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR")}
          </div>
        </div>

        {/* LINHA 3: Observação (12 - Linha Toda) */}
        <div className="md:col-span-12 space-y-1">
          <label className="text-xs font-medium text-muted-foreground block">
            Observação
          </label>
          <Input
            ref={obsRef}
            disabled={!podeEditar}
            value={record?.observacao || ""}
            onChange={(e) => setRecord((r: any) => ({ ...r, observacao: e.target.value }))}
            onKeyDown={handleObsKeyDown}
            placeholder="Observação ou motivo da transferência (Pressione Enter para salvar e ir para Itens)..."
            className="h-9 text-sm w-full"
          />
        </div>
      </div>
    </div>
  );
}

export default function TransferenciaEstoqueForm() {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas, XUsuario } = useAppContext();
  const [empresasLookup, setEmpresasLookup] = useState<IEmpresaLookup[]>([]);
  const [depositosOrigemLookup, setDepositosOrigemLookup] = useState<IDepositoLookup[]>([]);
  const [depositosDestinoLookup, setDepositosDestinoLookup] = useState<IDepositoLookup[]>([]);
  const [itens, setItens] = useState<ITransferenciaItemRow[]>([]);
  
  const refreshCrudRef = useRef<(() => Promise<void>) | null>(null);

  const XMatrizId = useMemo(() => XEmpresaMatrizId || XEmpresaId, [XEmpresaMatrizId, XEmpresaId]);

  const XGroupEmpresaIds = useMemo(() => {
    if (!XEmpresas?.length) return [XEmpresaId];
    return XEmpresas
      .filter(e => e.empresa_matriz_id === XMatrizId || e.empresa_id === XMatrizId)
      .map(e => e.empresa_id);
  }, [XEmpresas, XMatrizId, XEmpresaId]);

  // Carregar lista de filiais pertencentes ao mesmo grupo da empresa logada
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await db.from("empresa")
          .select("empresa_id, razao_social, nome_fantasia, empresa_matriz_id")
          .eq("excluido", false)
          .order("nome_fantasia");

        if (!error && data) {
          const filtered = data.filter((e: any) =>
            e.empresa_id === XMatrizId || e.empresa_matriz_id === XMatrizId
          );
          setEmpresasLookup(filtered);
        } else if (XEmpresas?.length) {
          const filtered = XEmpresas.filter(e =>
            e.empresa_id === XMatrizId || e.empresa_matriz_id === XMatrizId
          );
          setEmpresasLookup(filtered.map(e => ({
            empresa_id: e.empresa_id,
            razao_social: e.razao_social,
            nome_fantasia: e.nome_fantasia || e.razao_social
          })));
        }
      } catch (err) {
        console.error("Erro ao carregar empresas do grupo:", err);
      }
    })();
  }, [XEmpresas, XMatrizId]);

  // Carregar depósitos de origem filtrados estritamente pela Filial Origem
  const carregarDepositosOrigem = useCallback(async (empresaOrigemId: number) => {
    const id = Number(empresaOrigemId);
    if (!id) {
      setDepositosOrigemLookup([]);
      return;
    }
    const { data, error } = await db.from("deposito")
      .select("deposito_id, nome, empresa_id, st_privado")
      .eq("empresa_id", id)
      .eq("excluido", false)
      .order("nome");

    if (error) {
      console.warn("Erro ao carregar depósitos de origem:", error.message);
    }

    setDepositosOrigemLookup(data || []);
  }, []);

  // Carregar depósitos de destino filtrados estritamente pela Filial Destino
  const carregarDepositosDestino = useCallback(async (empresaDestinoId: number) => {
    const id = Number(empresaDestinoId);
    if (!id) {
      setDepositosDestinoLookup([]);
      return;
    }
    const { data, error } = await db.from("deposito")
      .select("deposito_id, nome, empresa_id, st_privado")
      .eq("empresa_id", id)
      .eq("excluido", false)
      .order("nome");

    if (error) {
      console.warn("Erro ao carregar depósitos de destino:", error.message);
    }

    setDepositosDestinoLookup(data || []);
  }, []);

  // Carregar itens salvos quando o registro atual mudar
  const carregarItensTransferencia = useCallback(async (transferenciaId: number) => {
    if (!transferenciaId) {
      setItens([]);
      return;
    }
    try {
      const { data, error } = await db.from("transferencia_item")
        .select(`
          transferencia_item_id,
          transferencia_id,
          produto_id,
          qt_transferir,
          produto:produto_id (
            cd_produto,
            nome
          )
        `)
        .eq("transferencia_id", transferenciaId)
        .eq("excluido", false)
        .order("transferencia_item_id");

      if (error) {
        toast.error("Erro ao carregar itens da transferência: " + error.message);
        return;
      }

      const formatted: ITransferenciaItemRow[] = (data || []).map((it: any) => ({
        transferencia_item_id: it.transferencia_item_id,
        transferencia_id: it.transferencia_id,
        produto_id: it.produto_id,
        cd_produto: it.produto?.cd_produto || it.produto_id,
        nm_produto: it.produto?.nome || `Produto #${it.produto_id}`,
        qt_transferir: Number(it.qt_transferir || 0),
      }));

      setItens(formatted);
    } catch (err: any) {
      console.error("Erro ao carregar itens:", err);
    }
  }, []);

  // Finalização Atômica via RPC
  const handleFinalizarTransferencia = useCallback(async (transferenciaId: number) => {
    if (!transferenciaId) {
      toast.error("Salve a transferência antes de finalizar.");
      return;
    }

    if (itens.length === 0) {
      toast.error("Informe pelo menos um produto.");
      return;
    }

    if (!confirm("Deseja realmente finalizar esta Transferência de Estoque entre Filiais?\n\nEsta ação efetuará a transferência física de estoque entre os depósitos e filiais selecionados. Não poderá ser alterada ou desfeita!")) {
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user?.email || XUsuario?.email || "SISTEMA";

    toast.loading("Processando e efetuando transferência física de estoque...", { id: "finalizar-transf" });

    try {
      const { data, error } = await db.rpc("fu_finalizar_transferencia_estoque", {
        _transferencia_id: transferenciaId,
        _usuario_email: userEmail,
      });

      if (error) {
        toast.error("Erro no banco de dados: " + error.message, { id: "finalizar-transf" });
        return;
      }

      if (data?.error) {
        toast.error(data.error, { id: "finalizar-transf", duration: 8000 });
        return;
      }

      toast.success(data?.message || "Transferência finalizada com sucesso!", { id: "finalizar-transf" });

      if (refreshCrudRef.current) {
        await refreshCrudRef.current();
      }
    } catch (err: any) {
      toast.error("Erro inesperado ao finalizar transferência: " + err.message, { id: "finalizar-transf" });
    }
  }, [itens.length, XUsuario?.email]);

  // Colunas do DataGrid de pesquisa/listagem
  const buildGridCols = useMemo((): IGridColumn[] => [
    {
      key: "nr_transferencia",
      label: "Nº Transferência",
      width: "130px",
      align: "right",
      render: r => `#${r.nr_transferencia || r.transferencia_id}`
    },
    {
      key: "dt_transferencia",
      label: "Data / Hora",
      width: "150px",
      render: r => r.dt_transferencia ? new Date(r.dt_transferencia).toLocaleString("pt-BR") : ""
    },
    {
      key: "empresa_origem_id",
      label: "Filial Origem",
      width: "2fr",
      render: r => {
        const emp = empresasLookup.find(e => e.empresa_id === r.empresa_origem_id);
        return emp ? (emp.nome_fantasia || emp.razao_social) : `Empresa #${r.empresa_origem_id}`;
      }
    },
    {
      key: "empresa_destino_id",
      label: "Filial Destino",
      width: "2fr",
      render: r => {
        const emp = empresasLookup.find(e => e.empresa_id === r.empresa_destino_id);
        return emp ? (emp.nome_fantasia || emp.razao_social) : `Empresa #${r.empresa_destino_id}`;
      }
    },
    {
      key: "st_transferencia",
      label: "Status",
      width: "120px",
      align: "center",
      render: r => (
        <Badge variant={r.st_transferencia === "FINALIZADA" ? "default" : "secondary"}>
          {r.st_transferencia === "FINALIZADA" ? "FECHADA" : "ABERTA"}
        </Badge>
      )
    },
    {
      key: "observacao",
      label: "Observação",
      width: "2fr"
    }
  ], [empresasLookup]);

  // Record Default inicial (sem autoseleção de empresas/depósitos)
  const XDefaultRecord: Partial<ITransferenciaHeader> = useMemo(() => ({
    empresa_origem_id: 0,
    empresa_destino_id: 0,
    deposito_origem_id: 0,
    deposito_destino_id: 0,
    dt_transferencia: new Date().toISOString().substring(0, 16),
    observacao: "",
    st_transferencia: "ABERTA",
  }), []);

  return (
    <StandardCrudForm<ITransferenciaHeader>
      XToolbarExtras={({ currentRecord, isEditing }) => {
        if (!currentRecord?.transferencia_id || isEditing) return null;
        const isAberto = currentRecord.st_transferencia === "ABERTA";

        return (
          <>
            {isAberto && (
              <ToolbarBtn
                icon={<Lock size={18} />}
                label="Finalizar Transferência"
                onClick={() => handleFinalizarTransferencia(currentRecord.transferencia_id!)}
                color="success"
              />
            )}
          </>
        );
      }}
      XHiddenTabs={[]}
      XCadastroLabel="Dados Principais"
      XAfterInsertTab="itens"
      config={{
        XTableName: "transferencia",
        XPrimaryKey: "transferencia_id",
        XTitle: "Transferência de Estoque entre Filiais",
        XDefaultRecord: XDefaultRecord as any,
        XSelectCols: "*",
        XOrderBy: "transferencia_id",
        XApplyFilter: (q) => {
          const ids = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];
          return q.or(`empresa_origem_id.in.(${ids.join(",")}),empresa_destino_id.in.(${ids.join(",")})`);
        },
        XOnRecordLoaded: async (record) => {
          if (record?.empresa_origem_id) carregarDepositosOrigem(record.empresa_origem_id);
          if (record?.empresa_destino_id) carregarDepositosDestino(record.empresa_destino_id);
          if (record?.transferencia_id) {
            await carregarItensTransferencia(record.transferencia_id);
          } else {
            setItens([]);
          }
        },
        XOnBeforeSave: async (rec, mode) => {
          if (!rec.empresa_origem_id) throw new Error("Selecione a filial de origem.");
          if (!rec.empresa_destino_id) throw new Error("Selecione a filial de destino.");
          if (rec.empresa_origem_id === rec.empresa_destino_id) {
            throw new Error("A filial de origem deve ser diferente da filial de destino.");
          }
          if (!rec.deposito_origem_id) throw new Error("Selecione o estoque de origem.");
          if (!rec.deposito_destino_id) throw new Error("Selecione o estoque de destino.");

          if (mode === "edit" && rec.st_transferencia === "FINALIZADA") {
            throw new Error("A transferência já foi finalizada e não permite alterações.");
          }

          const { data: userData } = await supabase.auth.getUser();

          const clean = { ...rec };
          if (mode === "insert") {
            delete clean.transferencia_id;
            clean.st_transferencia = "ABERTA";
            clean.usuario_cadastro = userData.user?.email || XUsuario?.email || "SISTEMA";
            clean.dt_criacao = new Date().toISOString();
          }

          return clean;
        },
        XOnAfterSave: async (rec) => {
          const transfId = rec.transferencia_id;
          if (!transfId) return;

          // Salvar/Sincronizar itens na tabela transferencia_item
          await db.from("transferencia_item")
            .delete()
            .eq("transferencia_id", transfId);

          if (itens.length > 0) {
            const toInsert = itens.map(it => ({
              transferencia_id: transfId,
              produto_id: it.produto_id,
              qt_transferir: it.qt_transferir,
              excluido: false,
            }));

            const { error } = await db.from("transferencia_item").insert(toInsert);
            if (error) {
              toast.error("Erro ao salvar itens da transferência: " + error.message);
              return;
            }
          }

          await carregarItensTransferencia(transfId);
        },
        XSoftDelete: false,
      }}
      XGridCols={buildGridCols}
      XExportTitle="Transferências de Estoque"
      XExtraTabs={[
        {
          key: "itens",
          label: "Itens da Transferência",
          render: ({ record, currentRecord, mode }) => {
            const transf = (mode === "insert" ? record : (currentRecord || record)) as ITransferenciaHeader;
            const podeEditar = transf?.st_transferencia !== "FINALIZADA";
            return (
              <TransferenciaEstoqueItensGrid
                transferenciaId={transf?.transferencia_id || null}
                podeEditar={podeEditar}
                empresaOrigemId={transf?.empresa_origem_id}
                depositoOrigemId={transf?.deposito_origem_id}
                items={itens}
                setItems={setItens}
              />
            );
          },
        },
      ]}
      renderCadastro={({ record, setRecord, isEditing, isNew, refresh, setInnerTab, onSalvar }: any) => (
        <TransferenciaFormContent
          record={record}
          setRecord={setRecord}
          isEditing={isEditing}
          isNew={isNew}
          refresh={refresh}
          empresasLookup={empresasLookup}
          depositosOrigemLookup={depositosOrigemLookup}
          depositosDestinoLookup={depositosDestinoLookup}
          carregarDepositosOrigem={carregarDepositosOrigem}
          carregarDepositosDestino={carregarDepositosDestino}
          itens={itens}
          setItens={setItens}
          refreshCrudRef={refreshCrudRef}
          setInnerTab={setInnerTab}
          onSalvar={onSalvar}
        />
      )}
    />
  );
}
