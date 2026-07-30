import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

interface IConta {
  conta_id: string;
  empresa_id: number;
  banco_id: string;
  nome_conta: string | null;
  convenio: string | null;
  beneficiario: string | null;
  beneficiario_cnpj: string | null;
  carteira: string | null;
  caminho_remessa: string | null;
  prx_nosso_numero: number | null;
  prx_seq_remessa: number | null;
  cod_cedente: string | null;
  conta_cobranca: string | null;
  conta_corrente: string | null;
  token: string | null;
  ambiente: string | null;
  ativo: string | null;
  conta_dv: string | null;
  local_pagamento1: string | null;
  local_pagamento2: string | null;
  instrucoes: string | null;
  agencia_numero: string | null;
  agencia_dv: string | null;
  beneficiario_nome: string | null;
  documento_especie: string | null;
  beneficiario_email: string | null;
  beneficiario_telefone: string | null;
  beneficiario_logo: string | null;
  beneficiario_logadouro: string | null;
  beneficiario_bairro: string | null;
  beneficiario_municipio: string | null;
  beneficiario_cep: string | null;
  beneficiario_uf: string | null;
  beneficiario_documento: string | null;
  beneficiario_cod_cliente: string | null;
  carteira_modalidade: string | null;
  carteira_tipo: string | null;
  cd_conta: number | null;
  excluido?: boolean | null;
  dt_cadastro?: string | null;
  dt_alteracao?: string | null;
}

const XDefault: Partial<IConta> = {
  excluido: false,
  dt_cadastro: null,
  dt_alteracao: null,
  nome_conta: "",
  banco_id: "",
  agencia_numero: "",
  agencia_dv: "",
  conta_corrente: "",
  conta_dv: "",
  convenio: "",
  ativo: "S",
  cd_conta: null,
  beneficiario: "",
  beneficiario_cnpj: "",
  carteira: "",
  caminho_remessa: "",
  prx_nosso_numero: 1,
  prx_seq_remessa: 1,
  cod_cedente: "",
  conta_cobranca: "",
  token: "",
  ambiente: "2",
  local_pagamento1: "",
  local_pagamento2: "",
  instrucoes: "",
  beneficiario_nome: "",
  documento_especie: "",
  beneficiario_email: "",
  beneficiario_telefone: "",
  beneficiario_logo: "",
  beneficiario_logadouro: "",
  beneficiario_bairro: "",
  beneficiario_municipio: "",
  beneficiario_cep: "",
  beneficiario_uf: "",
  beneficiario_documento: "",
  beneficiario_cod_cliente: "",
  carteira_modalidade: "",
  carteira_tipo: ""
};

const XTabLabels: Record<string, string> = {
  dados_principais: "Dados Principais",
  cobranca_boletos: "Cobrança e Boletos",
  dados_beneficiario: "Dados do Beneficiário",
};

const ContaForm: React.FC = () => {
  const { XEmpresaId, XEmpresas } = useAppContext();
  const [XBancos, setXBancos] = React.useState<{ cd_banco: string; nome: string }[]>([]);
  const [activeTab, setActiveTab] = React.useState<string>("dados_principais");

  React.useEffect(() => {
    async function loadData() {
      const { data: dbBancos } = await supabase
        .from("banco")
        .select("cd_banco, nome")
        .eq("excluido", false)
        .order("nome");
      if (dbBancos) setXBancos(dbBancos);
    }
    loadData();
  }, []);

  const XGridCols = React.useMemo<IGridColumn[]>(() => [
    { key: "cd_conta", label: "Código", width: "80px", align: "right" },
    { key: "nome_conta", label: "Nome da Conta", width: "200px" },
    { key: "banco_id", label: "Banco", width: "80px" },
    { key: "agencia_numero", label: "Agência", width: "100px" },
    { key: "conta_corrente", label: "Conta Corrente", width: "120px" },
    { 
      key: "ativo", 
      label: "Ativo", 
      width: "80px", 
      align: "center",
      render: (row: IConta) => row.ativo === "S" ? "Sim" : "Não"
    }
  ], []);

  return (
    <StandardCrudForm<IConta>
      config={{
        XTableName: "conta",
        XPrimaryKey: "conta_id",
        XTitle: "Contas Bancárias",
        XEmpresaId,
        XSelectCols: "conta_id,empresa_id,banco_id,nome_conta,convenio,beneficiario,beneficiario_cnpj,carteira,caminho_remessa,prx_nosso_numero,prx_seq_remessa,cod_cedente,conta_cobranca,conta_corrente,token,ambiente,ativo,conta_dv,local_pagamento1,local_pagamento2,instrucoes,agencia_numero,agencia_dv,beneficiario_nome,documento_especie,beneficiario_email,beneficiario_telefone,beneficiario_logo,beneficiario_logadouro,beneficiario_bairro,beneficiario_municipio,beneficiario_cep,beneficiario_uf,beneficiario_documento,beneficiario_cod_cliente,carteira_modalidade,carteira_tipo,cd_conta,excluido,dt_cadastro,dt_alteracao",
        XDefaultRecord: XDefault,
        XOnBeforeSave: async (rec, mode) => {
          if (!rec.nome_conta?.trim()) throw new Error("O nome da conta é obrigatório.");
          if (!rec.banco_id) throw new Error("O banco é obrigatório.");

          // Validar digito da agencia caso seja preenchido
          if (rec.agencia_dv && rec.agencia_dv.trim()) {
            if (!rec.agencia_numero?.trim()) {
              throw new Error("O dígito da agência não pode ser preenchido sem o número da agência.");
            }
            if (!/^[A-Za-z0-9]{1,4}$/.test(rec.agencia_dv)) {
              throw new Error("O dígito verificador da agência deve ser alfanumérico e ter no máximo 4 caracteres.");
            }
          }

          // Validar digito da conta caso seja preenchido
          if (rec.conta_dv && rec.conta_dv.trim()) {
            if (!rec.conta_corrente?.trim()) {
              throw new Error("O dígito da conta não pode ser preenchido sem o número da conta corrente.");
            }
            if (!/^[A-Za-z0-9]{1,7}$/.test(rec.conta_dv)) {
              throw new Error("O dígito verificador da conta deve ser alfanumérico e ter no máximo 7 caracteres.");
            }
          }

          let nextCd = rec.cd_conta;
          if (mode === "insert") {
            const { data, error } = await supabase
              .from("conta")
              .select("cd_conta")
              .eq("empresa_id", XEmpresaId)
              .order("cd_conta", { ascending: false })
              .limit(1);
            if (error) {
              console.error("Erro ao buscar último cd_conta:", error);
            }
            const lastCd = data && data[0] ? data[0].cd_conta : 0;
            nextCd = (lastCd || 0) + 1;
          }

          return {
            ...rec,
            nome_conta: rec.nome_conta.trim().toUpperCase(),
            banco_id: rec.banco_id,
            cd_conta: nextCd,
            conta_id: `${XEmpresaId}-${nextCd}`,
            empresa_id: XEmpresaId,
            excluido: false,
            dt_cadastro: mode === "insert" ? new Date().toLocaleString("sv-SE").replace(" ", "T") : rec.dt_cadastro,
            dt_alteracao: mode === "edit" ? new Date().toLocaleString("sv-SE").replace(" ", "T") : rec.dt_alteracao,
            prx_nosso_numero: rec.prx_nosso_numero ? parseInt(String(rec.prx_nosso_numero)) || 0 : null,
            prx_seq_remessa: rec.prx_seq_remessa ? parseInt(String(rec.prx_seq_remessa)) || 0 : null
          } as IConta;
        }
      }}
      XGridCols={XGridCols}
      XExportTitle="Contas Bancárias"
      renderCadastro={({ record, setField, mode, isEditing }) => {
        const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter") {
            const target = e.target as HTMLElement;
            if (target.tagName !== "INPUT" && target.tagName !== "SELECT" && target.getAttribute("role") !== "checkbox") return;

            e.preventDefault();

            const tabContent = document.getElementById(`tab-content-${activeTab}`);
            if (!tabContent) return;

            const selector = 'input:not([readonly]):not([disabled]), select:not([disabled]), button[role="checkbox"]:not([disabled])';
            const focusableInTab = Array.from(tabContent.querySelectorAll(selector)) as HTMLElement[];

            const index = focusableInTab.indexOf(target);
            if (index > -1) {
              if (index < focusableInTab.length - 1) {
                focusableInTab[index + 1].focus();
              } else {
                if (activeTab === "dados_principais") {
                  setActiveTab("cobranca_boletos");
                  setTimeout(() => {
                    const nextContent = document.getElementById("tab-content-cobranca_boletos");
                    const firstInput = nextContent?.querySelector(selector) as HTMLElement;
                    firstInput?.focus();
                  }, 50);
                } else if (activeTab === "cobranca_boletos") {
                  setActiveTab("dados_beneficiario");
                  setTimeout(() => {
                    const nextContent = document.getElementById("tab-content-dados_beneficiario");
                    const firstInput = nextContent?.querySelector(selector) as HTMLElement;
                    firstInput?.focus();
                  }, 50);
                } else if (activeTab === "dados_beneficiario") {
                  const saveBtn = document.querySelector("button.text-emerald-600, button.text-emerald-500") as HTMLElement;
                  if (saveBtn) {
                    saveBtn.focus();
                  }
                }
              }
            }
          }
        };

        return (
          <div className="space-y-4 pt-3 md:pt-0" onKeyDown={handleKeyDown}>
            {/* Abas no mesmo padrão da tela de clientes */}
            <div className="flex border-b border-border flex-wrap mb-4 bg-card">
              {Object.entries(XTabLabels).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  className={`px-4 py-1.5 text-xs font-medium border-b-2 transition-all ${
                    activeTab === t
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab(t)}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "dados_principais" && (
              <div id="tab-content-dados_principais" className="space-y-4 outline-none">
                <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
                  <div className="w-full md:w-32">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                    <input 
                      type="text" 
                      value={mode === "insert" ? "" : record.cd_conta ?? ""} 
                      readOnly 
                      className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" 
                    />
                  </div>

                  <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Empresa</label>
                    <input 
                      type="text" 
                      value={(() => {
                        const em = XEmpresas.find(e => e.empresa_id === record.empresa_id || e.empresa_id === XEmpresaId);
                        return em ? `${em.empresa_id} - ${em.identificacao}` : String(record.empresa_id || XEmpresaId || "");
                      })()} 
                      readOnly 
                      className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" 
                    />
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Nome da Conta <span className="text-destructive">*</span></label>
                    <input
                      type="text"
                      value={record.nome_conta ?? ""}
                      onChange={e => setField("nome_conta", e.target.value.toUpperCase())}
                      readOnly={!isEditing}
                      autoFocus={isEditing}
                      maxLength={30}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:flex md:gap-4 gap-5">
                  <div className="w-full md:w-64">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Banco <span className="text-destructive">*</span></label>
                    <select
                      value={record.banco_id ?? ""}
                      onChange={e => setField("banco_id", e.target.value)}
                      disabled={!isEditing}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${
                        isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none cursor-pointer" : "bg-secondary text-muted-foreground appearance-none disabled:opacity-100"
                      }`}
                    >
                      <option value="">— Selecione —</option>
                      {XBancos.map(b => (
                        <option key={b.cd_banco} value={b.cd_banco}>
                          {b.cd_banco} - {b.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full md:w-32">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Agência</label>
                    <input
                      type="text"
                      value={record.agencia_numero ?? ""}
                      onChange={e => setField("agencia_numero", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={18}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-20">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Dígito Ag.</label>
                    <input
                      type="text"
                      value={record.agencia_dv ?? ""}
                      onChange={e => setField("agencia_dv", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={4}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Conta Corrente</label>
                    <input
                      type="text"
                      value={record.conta_corrente ?? ""}
                      onChange={e => setField("conta_corrente", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={20}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-20">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Dígito CC</label>
                    <input
                      type="text"
                      value={record.conta_dv ?? ""}
                      onChange={e => setField("conta_dv", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={7}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-32 flex items-end pb-2">
                    {isEditing ? (
                      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <Checkbox
                          checked={record.ativo === "S"}
                          onCheckedChange={(checked) => setField("ativo", checked ? "S" : "N")}
                        />
                        ATIVO
                      </label>
                    ) : (
                      <span className={`text-sm font-medium ${record.ativo === "S" ? "text-success" : "text-destructive"}`}>
                        {record.ativo === "S" ? "✓ ATIVO" : "✗ INATIVO"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "cobranca_boletos" && (
              <div id="tab-content-cobranca_boletos" className="space-y-4 outline-none">
                <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
                  <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Convênio</label>
                    <input
                      type="text"
                      value={record.convenio ?? ""}
                      onChange={e => setField("convenio", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={7}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Cód. Cedente</label>
                    <input
                      type="text"
                      value={record.cod_cedente ?? ""}
                      onChange={e => setField("cod_cedente", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={20}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-28">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Carteira</label>
                    <input
                      type="text"
                      value={record.carteira ?? ""}
                      onChange={e => setField("carteira", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={2}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-36">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Cart. Modalidade</label>
                    <input
                      type="text"
                      value={record.carteira_modalidade ?? ""}
                      onChange={e => setField("carteira_modalidade", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={5}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-36">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Cart. Tipo</label>
                    <input
                      type="text"
                      value={record.carteira_tipo ?? ""}
                      onChange={e => setField("carteira_tipo", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={10}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:flex md:gap-4 gap-5">
                  <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Próx. Nosso Número</label>
                    <input
                      type="number"
                      value={record.prx_nosso_numero === null ? "" : String(record.prx_nosso_numero)}
                      onChange={e => setField("prx_nosso_numero", parseInt(e.target.value) || 0)}
                      readOnly={!isEditing}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Próx. Seq. Remessa</label>
                    <input
                      type="number"
                      value={record.prx_seq_remessa === null ? "" : String(record.prx_seq_remessa)}
                      onChange={e => setField("prx_seq_remessa", parseInt(e.target.value) || 0)}
                      readOnly={!isEditing}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Caminho Remessa</label>
                    <input
                      type="text"
                      value={record.caminho_remessa ?? ""}
                      onChange={e => setField("caminho_remessa", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={255}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:flex md:gap-4 gap-5">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Token de Integração</label>
                    <input
                      type="text"
                      value={record.token ?? ""}
                      onChange={e => setField("token", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={200}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Ambiente</label>
                    <select
                      value={record.ambiente ?? "2"}
                      onChange={e => setField("ambiente", e.target.value)}
                      disabled={!isEditing}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${
                        isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none cursor-pointer" : "bg-secondary text-muted-foreground appearance-none disabled:opacity-100"
                      }`}
                    >
                      <option value="1">1 - Produção</option>
                      <option value="2">2 - Homologação</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:flex md:gap-4 gap-5">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Local de Pagamento 1</label>
                    <input
                      type="text"
                      value={record.local_pagamento1 ?? ""}
                      onChange={e => setField("local_pagamento1", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={58}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Local de Pagamento 2</label>
                    <input
                      type="text"
                      value={record.local_pagamento2 ?? ""}
                      onChange={e => setField("local_pagamento2", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={58}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>
                </div>

                <div className="w-full">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Instruções</label>
                  <input
                    type="text"
                    value={record.instrucoes ?? ""}
                    onChange={e => setField("instrucoes", e.target.value)}
                    readOnly={!isEditing}
                    maxLength={120}
                    className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                  />
                </div>
              </div>
            )}

            {activeTab === "dados_beneficiario" && (
              <div id="tab-content-dados_beneficiario" className="space-y-4 outline-none">
                <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Razão Social Beneficiário</label>
                    <input
                      type="text"
                      value={record.beneficiario_nome ?? ""}
                      onChange={e => setField("beneficiario_nome", e.target.value.toUpperCase())}
                      readOnly={!isEditing}
                      maxLength={40}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-56">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">CNPJ/CPF Beneficiário</label>
                    <input
                      type="text"
                      value={record.beneficiario_documento ?? ""}
                      onChange={e => setField("beneficiario_documento", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={20}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Código Beneficiário</label>
                    <input
                      type="text"
                      value={record.beneficiario_cod_cliente ?? ""}
                      onChange={e => setField("beneficiario_cod_cliente", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={20}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
                  <div className="w-full md:w-32">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">CEP</label>
                    <input
                      type="text"
                      value={record.beneficiario_cep ?? ""}
                      onChange={e => setField("beneficiario_cep", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={14}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Logradouro</label>
                    <input
                      type="text"
                      value={record.beneficiario_logadouro ?? ""}
                      onChange={e => setField("beneficiario_logadouro", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={72}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Bairro</label>
                    <input
                      type="text"
                      value={record.beneficiario_bairro ?? ""}
                      onChange={e => setField("beneficiario_bairro", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={30}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Município</label>
                    <input
                      type="text"
                      value={record.beneficiario_municipio ?? ""}
                      onChange={e => setField("beneficiario_municipio", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={37}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-20">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">UF</label>
                    <input
                      type="text"
                      value={record.beneficiario_uf ?? ""}
                      onChange={e => setField("beneficiario_uf", e.target.value.toUpperCase())}
                      readOnly={!isEditing}
                      maxLength={5}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:flex md:gap-4 gap-5">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">E-mail</label>
                    <input
                      type="email"
                      value={record.beneficiario_email ?? ""}
                      onChange={e => setField("beneficiario_email", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={30}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="w-full md:w-64">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Telefone</label>
                    <input
                      type="text"
                      value={record.beneficiario_telefone ?? ""}
                      onChange={e => setField("beneficiario_telefone", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={21}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">URL Logo do Beneficiário</label>
                    <input
                      type="text"
                      value={record.beneficiario_logo ?? ""}
                      onChange={e => setField("beneficiario_logo", e.target.value)}
                      readOnly={!isEditing}
                      maxLength={255}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }}
    />
  );
};

export default ContaForm;
