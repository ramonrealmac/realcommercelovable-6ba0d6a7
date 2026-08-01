import { useEffect, useRef, lazy, Suspense, memo } from "react";
import { useAppContext, AppProvider } from "@/contexts/AppContext";
import TopBar from "@/components/layout/TopBar";
import TabBar from "@/components/layout/TabBar";
import SidebarMenu from "@/components/layout/SidebarMenu";
import { Palette, Loader2 } from "lucide-react";

// --- Lazy Loaded Forms ---
const CadastroCompletoForm = lazy(() => import("@/components/forms/parceiros/CadastroCompletoForm"));
const CartaCorrecaoForm = lazy(() => import("@/components/forms/nfe/CartaCorrecaoForm"));
const FornecedorTransportadorForm = lazy(() => import("@/components/forms/parceiros/FornecedorTransportadorForm"));
const FuncionarioForm = lazy(() => import("@/components/forms/parceiros/FuncionarioForm"));
const CadastroGrupoForm = lazy(() => import("@/components/forms/parceiros/CadastroGrupoForm"));
const ProdutoForm = lazy(() => import("@/components/forms/produtos/ProdutoForm"));
const LinhaProdutoForm = lazy(() => import("@/components/forms/produtos/LinhaProdutoForm"));
const GrupoProdutosForm = lazy(() => import("@/components/forms/produtos/GrupoProdutosForm"));
const SubgrupoProdutosForm = lazy(() => import("@/components/forms/produtos/SubgrupoProdutosForm"));
const UnidadeForm = lazy(() => import("@/components/forms/produtos/UnidadeForm"));
const TabelaPrecoForm = lazy(() => import("@/components/forms/produtos/TabelaPrecoForm"));
const EstoqueForm = lazy(() => import("@/components/forms/estoques/EstoqueForm"));
const DepositoForm = lazy(() => import("@/components/forms/estoques/DepositoForm"));
const EstadoForm = lazy(() => import("@/components/forms/enderecos/EstadoForm"));
const CidadeForm = lazy(() => import("@/components/forms/enderecos/CidadeForm"));
const RotaForm = lazy(() => import("@/components/forms/enderecos/RotaForm"));
const BancoForm = lazy(() => import("@/components/forms/financeiro/BancoForm"));
const ContaForm = lazy(() => import("@/components/forms/financeiro/ContaForm"));
const CondicaoPagamentoForm = lazy(() => import("@/components/forms/financeiro/CondicaoPagamentoForm"));
const PlanoContaForm = lazy(() => import("@/components/forms/financeiro/PlanoContaForm"));
const PortadorForm = lazy(() => import("@/components/forms/financeiro/PortadorForm"));
const OperadoraForm = lazy(() => import("@/components/forms/financeiro/OperadoraForm"));
const BandeiraForm = lazy(() => import("@/components/forms/financeiro/BandeiraForm"));
const TpOperacaoForm = lazy(() => import("@/components/forms/fiscal/TpOperacaoForm"));
const CfopForm = lazy(() => import("@/components/forms/fiscal/CfopForm"));
const FiscalGrupoProdutoForm = lazy(() => import("@/components/forms/fiscal/FiscalGrupoProdutoForm"));
const FiscalRegraForm = lazy(() => import("@/components/forms/fiscal/FiscalRegraForm"));
const PedidoForm = lazy(() => import("@/components/forms/pedido/PedidoForm"));
const NotaFiscalEntradaForm = lazy(() => import("@/components/forms/nfe/NotaFiscalEntradaForm"));
const NfeRecebidasForm = lazy(() => import("@/components/forms/nfe/NfeRecebidasForm"));
const DevolucaoNfeEntradaForm = lazy(() => import("@/components/forms/nfe/DevolucaoNfeEntradaForm"));
const DevolucaoNfeSaidaForm = lazy(() => import("@/components/forms/nfe/DevolucaoNfeSaidaForm"));
const ListaNfeEmitidaForm = lazy(() => import("@/components/forms/nfe/ListaNfeEmitidaForm"));
const NfeEmitidaForm = lazy(() => import("@/components/forms/nfe/NfeEmitidaForm"));
const OutrasNotasForm = lazy(() => import("@/components/forms/nfe/OutrasNotasForm"));
const ConsultaTitulosReceberForm = lazy(() => import("@/components/forms/financeiro/ConsultaTitulosReceberForm"));
const BaixaPorClienteForm = lazy(() => import("@/components/forms/financeiro/BaixaPorClienteForm"));
const GerarContasReceberForm = lazy(() => import("@/components/forms/financeiro/GerarContasReceberForm"));
const ConsultaTitulosPagarForm = lazy(() => import("@/components/forms/financeiro/ConsultaTitulosPagarForm"));
const GerarContasPagarForm = lazy(() => import("@/components/forms/financeiro/GerarContasPagarForm"));
const BaixaPorFornecedorForm = lazy(() => import("@/components/forms/financeiro/BaixaPorFornecedorForm"));
const LiberacaoPedidosForm = lazy(() => import("@/components/forms/financeiro/LiberacaoPedidosForm"));
const MontagemRotaForm = lazy(() => import("@/components/forms/entrega/MontagemRotaForm"));
const RotasMontadasForm = lazy(() => import("@/components/forms/entrega/RotasMontadasForm"));
const FiscalConfigForm = lazy(() => import("@/components/forms/fiscal/FiscalConfigForm"));
const MdfeForm = lazy(() => import("@/modules/mdfe/components/MdfeForm"));
const ListaMdfeForm = lazy(() => import("@/modules/mdfe/components/ListaMdfeForm"));
const EmpresaForm = lazy(() => import("@/components/forms/config/EmpresaForm"));
const PerfilForm = lazy(() => import("@/components/forms/config/PerfilForm"));
const ControleAcessoForm = lazy(() => import("@/components/forms/config/ControleAcessoForm"));
const UsuarioForm = lazy(() => import("@/components/forms/config/UsuarioForm"));
const TrocaSenhaForm = lazy(() => import("@/components/forms/config/TrocaSenhaForm"));
const ConsultaEstoqueForm = lazy(() => import("@/components/forms/estoques/ConsultaEstoqueForm"));
const AjusteEstoqueForm = lazy(() => import("@/components/forms/ajuste/AjusteEstoqueForm"));
const InventarioEmBreve = lazy(() => import("@/components/forms/ajuste/InventarioEmBreve"));
const ImportacaoForm = lazy(() => import("@/components/forms/config/ImportacaoForm"));
const SistemaVersoesForm = lazy(() => import("@/components/forms/config/SistemaVersoesForm"));
const BackupForm = lazy(() => import("@/components/forms/config/BackupForm"));
const NfeInutilizacaoForm = lazy(() => import("@/components/forms/nfe/NfeInutilizacaoForm"));
const RbReportExecutor = lazy(() => import("@/rbuilder/components/rb_ReportExecutor"));
const RpbManager = lazy(() => import("@/report-builder").then(m => ({ default: m.RpbManager })));
const RpbStandaloneExecutor = lazy(() => import("@/report-builder/components/executor/RpbStandaloneExecutor"));

// --- PDV Lazy Imports ---
const PdvTela = lazy(() => import("@/components/forms/pdv/PdvTela"));
const AberturaCaixaForm = lazy(() => import("@/components/forms/pdv/AberturaCaixaForm"));
const PdvCaixaForm = lazy(() => import("@/components/forms/pdv/PdvCaixaForm"));
const FechamentoCaixaForm = lazy(() => import("@/components/forms/pdv/FechamentoCaixaForm"));
const SuprimentoSangriaForm = lazy(() => import("@/components/forms/pdv/SuprimentoSangriaForm"));

// --- Core Eager Imports ---
import AuthGate from "@/components/auth/AuthGate";
import { useThemeColors } from "@/hooks/useThemeColors";
import ChatLauncher from "@/components/chat/ChatLauncher";

const TabLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background/50 backdrop-blur-sm">
    <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
    <span className="text-sm font-medium">Carregando módulo...</span>
  </div>
);

// Componente estável: evita desmontagem ao re-renderizar AppContent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TabContent = memo(({ component, params }: { component: string; params?: any }) => {
  const renderContent = () => {
    switch (component) {
      case "cadastro-completo": return <CadastroCompletoForm formTitle="Cadastros" />;
      case "fornecedores-transportadores": return <FornecedorTransportadorForm />;
      case "funcionarios": return <FuncionarioForm />;
      case "grupo-cadastros": return <CadastroGrupoForm />;
      case "produtos": return <ProdutoForm initialProductId={params?.produto_id} />;
      case "linhas-produtos": return <LinhaProdutoForm />;
      case "grupo-produtos": return <GrupoProdutosForm />;
      case "subgrupo-produtos": return <SubgrupoProdutosForm />;
      case "unidades": return <UnidadeForm />;
      case "tabelas-preco": return <TabelaPrecoForm />;
      case "estoque": return <EstoqueForm />;
      case "depositos": return <DepositoForm />;
      case "estados": return <EstadoForm />;
      case "cidades": return <CidadeForm />;
      case "rotas": return <RotaForm />;
      case "bancos": return <BancoForm />;
      case "contas": return <ContaForm />;
      case "portadores": return <PortadorForm />;
      case "cond-pagamento": return <CondicaoPagamentoForm />;
      case "operadoras-cartoes": return <OperadoraForm />;
      case "bandeiras-cartoes": return <BandeiraForm />;
      case "plano-contas": return <PlanoContaForm />;
      case "tipo-operacoes": return <TpOperacaoForm />;
      case "cfop": return <CfopForm />;
      case "fiscal-grupo-produtos": return <FiscalGrupoProdutoForm />;
      case "fiscal-regras": return <FiscalRegraForm />;
      case "pedidos": return <PedidoForm />;
      case "nova-entrada": return <NotaFiscalEntradaForm />;
      case "minhas-entradas": return <NotaFiscalEntradaForm />;
      case "nfe-recebidas": return <NfeRecebidasForm />;
      case "devolucao-nfe-entrada": return <DevolucaoNfeEntradaForm initialNfeId={params?.nfe_cabecalho_id} />;
      case "devolucao-nfe-saida":
      case "devolucao-nfe-saida-fiscal": return <DevolucaoNfeSaidaForm initialNfeId={params?.nfe_cabecalho_id} />;
      case "nfe-emitidas": return <ListaNfeEmitidaForm initialFilterId={params?.nfe_cabecalho_id} />;
      case "nfe-form": return <NfeEmitidaForm initialId={params?.nfe_cabecalho_id} />;
      case "outras-notas": return <OutrasNotasForm initialId={params?.nfe_cabecalho_id} />;
      case "consulta-titulos-receber": return <ConsultaTitulosReceberForm />;
      case "gerar-contas-receber": return <GerarContasReceberForm />;
      case "baixa-por-cliente": return <BaixaPorClienteForm />;
      case "consulta-titulos-pagar": return <ConsultaTitulosPagarForm />;
      case "gerar-contas-pagar": return <GerarContasPagarForm />;
      case "baixa-por-fornecedor": return <BaixaPorFornecedorForm />;
      case "liberacao-pedidos": return <LiberacaoPedidosForm />;
      case "montagem-rota": return <MontagemRotaForm />;
      case "rotas-montadas": return <RotasMontadasForm />;
      case "fiscal-config": return <FiscalConfigForm />;
      case "mdfe-lista": return <ListaMdfeForm />;
      case "mdfe-form": return <MdfeForm initialId={params?.mdf_manifesto_id} />;
      case "empresas": return <EmpresaForm />;
      case "PerfilForm": return <PerfilForm />;
      case "ControleAcessoForm": return <ControleAcessoForm />;
      case "UsuarioForm": return <UsuarioForm />;
      case "cce": return <CartaCorrecaoForm initialNfeId={params?.nfe_cabecalho_id} />;
      case "nfe-inutilizacao": return <NfeInutilizacaoForm initialData={params} />;
      case "TrocaSenhaForm": return <TrocaSenhaForm />;
      case "importacao": return <ImportacaoForm />;
      case "sistema-versoes": return <SistemaVersoesForm />;
      case "backup-config": return <BackupForm />;
      case "rpb-relatorios": return <RpbManager />;
      case "consulta-estoque": return <ConsultaEstoqueForm />;
      case "ajuste-estoque": return <AjusteEstoqueForm />;
      case "inventario": return <InventarioEmBreve />;
      // PDV
      case "abertura-caixa": return <AberturaCaixaForm />;
      case "pdv-caixa": return <PdvCaixaForm initialFuncionarioId={params?.funcionario_id} initialDtAbertura={params?.dt_abertura} />;
      case "fechamento-caixa": return <FechamentoCaixaForm initialAberturaId={params?.caixa_abertura_id} initialDtAbertura={params?.dt_abertura} />;
      case "suprimento-caixa": return <SuprimentoSangriaForm tipo="SUP" />;
      case "sangria-caixa": return <SuprimentoSangriaForm tipo="SAN" />;
      default: {
        if (component.startsWith("rpb-exec-")) {
          const XRelId = parseInt(component.replace("rpb-exec-", ""));
          if (!isNaN(XRelId)) return <RpbStandaloneExecutor rpbRelatorioId={XRelId} initialParams={params} />;
        }
        if (component.startsWith("rb-exec-")) {
          const XReportId = parseInt(component.replace("rb-exec-", ""));
          if (!isNaN(XReportId)) return <RbReportExecutor XReportId={XReportId} />;
        }
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center opacity-50">
              <Palette className="w-8 h-8" />
            </div>
            <div>
              <p className="font-semibold">Componente não implementado ou em desenvolvimento.</p>
              <p className="text-xs">ID: {component}</p>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <Suspense fallback={<TabLoadingFallback />}>
      {renderContent()}
    </Suspense>
  );
});
TabContent.displayName = "TabContent";

const AppContent = () => {
  const { XTabs, XActiveTabId, openTab, XEmpresaId, setXLogomarca, XLogomarca } = useAppContext();
  const XInitRef = useRef(false);

  // Load theme colors based on selected empresa
  const { XLogomarca: XThemeLogomarca } = useThemeColors(XEmpresaId);

  useEffect(() => {
    if (XThemeLogomarca !== undefined) {
      setXLogomarca(XThemeLogomarca);
    }
  }, [XThemeLogomarca, setXLogomarca]);


  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <TabBar />
      <SidebarMenu />
      <div className="flex-1 overflow-hidden relative">
        <div className="relative z-10 h-full">
          {XTabs.map(tab => (
            <div
              key={`${tab.id}-${XEmpresaId}`}
              className={`h-full ${tab.id === XActiveTabId ? "block" : "hidden"}`}
            >
              <TabContent key={`${tab.component}-${XEmpresaId}`} component={tab.component} params={tab.params} />
            </div>
          ))}
          {XTabs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-8 text-center">
              {XThemeLogomarca || XLogomarca ? (
                <div className="animate-in fade-in zoom-in duration-1000">
                  <img
                    src={XThemeLogomarca || XLogomarca}
                    alt="Logo"
                    className="max-w-[600px] max-h-[400px] object-contain opacity-80 select-none pointer-events-none"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted flex items-center justify-center opacity-20">
                    <Palette className="w-8 h-8" />
                  </div>
                  <span>Use o menu para abrir um formulário.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <ChatLauncher />
    </div>
  );
};

const Index = () => (
  <AppProvider>
    <AuthGateWrapper />
  </AppProvider>
);

const AuthGateWrapper = () => {
  const { setXEmpresaId, setXEmpresaMatrizId, setXEmpresas } = useAppContext();

  return (
    <AuthGate
      onEmpresaSelected={(empresa, allEmpresas) => {
        setXEmpresaId(empresa.empresa_id);
        setXEmpresaMatrizId(empresa.empresa_matriz_id ?? empresa.empresa_id);
        setXEmpresas(allEmpresas);
      }}
    >
      <AppContent />
    </AuthGate>
  );
};

export default Index;
