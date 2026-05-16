import { useEffect, useRef, lazy, Suspense } from "react";
import { useAppContext, AppProvider } from "@/contexts/AppContext";
import TopBar from "@/components/layout/TopBar";
import TabBar from "@/components/layout/TabBar";
import SidebarMenu from "@/components/layout/SidebarMenu";
import { Palette, Loader2 } from "lucide-react";

// --- Lazy Loaded Forms ---
const CadastroCompletoForm = lazy(() => import("@/components/forms/CadastroCompletoForm"));
const CartaCorrecaoForm = lazy(() => import("@/components/forms/CartaCorrecaoForm"));
const FornecedorTransportadorForm = lazy(() => import("@/components/forms/FornecedorTransportadorForm"));
const FuncionarioForm = lazy(() => import("@/components/forms/FuncionarioForm"));
const CadastroGrupoForm = lazy(() => import("@/components/forms/CadastroGrupoForm"));
const ProdutoForm = lazy(() => import("@/components/forms/ProdutoForm"));
const LinhaProdutoForm = lazy(() => import("@/components/forms/LinhaProdutoForm"));
const GrupoProdutosForm = lazy(() => import("@/components/forms/GrupoProdutosForm"));
const UnidadeForm = lazy(() => import("@/components/forms/UnidadeForm"));
const EstoqueForm = lazy(() => import("@/components/forms/EstoqueForm"));
const DepositoForm = lazy(() => import("@/components/forms/DepositoForm"));
const EstadoForm = lazy(() => import("@/components/forms/EstadoForm"));
const CidadeForm = lazy(() => import("@/components/forms/CidadeForm"));
const RotaForm = lazy(() => import("@/components/forms/RotaForm"));
const BancoForm = lazy(() => import("@/components/forms/BancoForm"));
const CondicaoPagamentoForm = lazy(() => import("@/components/forms/CondicaoPagamentoForm"));
const PlanoContaForm = lazy(() => import("@/components/forms/PlanoContaForm"));
const CfopForm = lazy(() => import("@/components/forms/CfopForm"));
const FiscalGrupoProdutoForm = lazy(() => import("@/components/forms/FiscalGrupoProdutoForm"));
const FiscalRegraForm = lazy(() => import("@/components/forms/FiscalRegraForm"));
const PedidoForm = lazy(() => import("@/components/forms/PedidoForm"));
const NotaFiscalEntradaForm = lazy(() => import("@/components/forms/NotaFiscalEntradaForm"));
const NfeRecebidasForm = lazy(() => import("@/components/forms/NfeRecebidasForm"));
const DevolucaoNfeEntradaForm = lazy(() => import("@/components/forms/DevolucaoNfeEntradaForm"));
const DevolucaoNfeSaidaForm = lazy(() => import("@/components/forms/DevolucaoNfeSaidaForm"));
const ListaNfeEmitidaForm = lazy(() => import("@/components/forms/ListaNfeEmitidaForm"));
const NfeEmitidaForm = lazy(() => import("@/components/forms/NfeEmitidaForm"));
const ConsultaTitulosReceberForm = lazy(() => import("@/components/forms/ConsultaTitulosReceberForm"));
const BaixaPorClienteForm = lazy(() => import("@/components/forms/BaixaPorClienteForm"));
const FiscalConfigForm = lazy(() => import("@/components/forms/FiscalConfigForm"));
const MdfeForm = lazy(() => import("@/modules/mdfe/components/MdfeForm"));
const ListaMdfeForm = lazy(() => import("@/modules/mdfe/components/ListaMdfeForm"));
const EmpresaForm = lazy(() => import("@/components/forms/EmpresaForm"));
const PerfilForm = lazy(() => import("@/components/forms/PerfilForm"));
const ControleAcessoForm = lazy(() => import("@/components/forms/ControleAcessoForm"));
const UsuarioForm = lazy(() => import("@/components/forms/UsuarioForm"));
const TrocaSenhaForm = lazy(() => import("@/components/forms/TrocaSenhaForm"));
const ProvedorTestForm = lazy(() => import("@/components/forms/ProvedorTestForm"));
const ConsultaEstoqueForm = lazy(() => import("@/components/forms/ConsultaEstoqueForm"));
const NfeInutilizacaoForm = lazy(() => import("@/components/forms/NfeInutilizacaoForm"));
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

  const renderTabContent = (component: string, params?: any) => {
    switch (component) {
      case "cadastro-completo":
        return <CadastroCompletoForm formTitle="Cadastros" />;
      case "fornecedores-transportadores":
        return <FornecedorTransportadorForm />;
      case "funcionarios":
        return <FuncionarioForm />;
      case "grupo-cadastros":
        return <CadastroGrupoForm />;
      case "produtos":
        return <ProdutoForm />;
      case "linhas-produtos":
        return <LinhaProdutoForm />;
      case "grupo-produtos":
        return <GrupoProdutosForm />;
      case "unidades":
        return <UnidadeForm />;
      case "estoque":
        return <EstoqueForm />;
      case "depositos":
        return <DepositoForm />;
      case "estados":
        return <EstadoForm />;
      case "cidades":
        return <CidadeForm />;
      case "rotas":
        return <RotaForm />;
      case "bancos":
        return <BancoForm />;
      case "cond-pagamento":
        return <CondicaoPagamentoForm />;
      case "plano-contas":
        return <PlanoContaForm />;
      case "cfop":
        return <CfopForm />;
      case "fiscal-grupo-produtos":
        return <FiscalGrupoProdutoForm />;
      case "fiscal-regras":
        return <FiscalRegraForm />;
      case "pedidos":
        return <PedidoForm />;
      case "nova-entrada":
      case "minhas-entradas":
        return <NotaFiscalEntradaForm />;
      case "nfe-recebidas":
        return <NfeRecebidasForm />;
      case "devolucao-nfe-entrada":
        return <DevolucaoNfeEntradaForm />;
      case "devolucao-nfe-saida":
      case "devolucao-nfe-saida-fiscal":
        return <DevolucaoNfeSaidaForm initialNfeId={params?.nfe_cabecalho_id} />;
      case "nfe-emitidas":
        return <ListaNfeEmitidaForm initialFilterId={params?.nfe_cabecalho_id} />;
      case "nfe-form":
        return <NfeEmitidaForm initialId={params?.nfe_cabecalho_id} />;
      case "consulta-titulos-receber":
        return <ConsultaTitulosReceberForm />;
      case "baixa-por-cliente":
        return <BaixaPorClienteForm />;
      case "fiscal-config":
        return <FiscalConfigForm />;
      case "mdfe-lista":
        return <ListaMdfeForm />;
      case "mdfe-form":
        return <MdfeForm initialId={params?.mdf_manifesto_id} />;
      case "empresas":
        return <EmpresaForm />;
      case "PerfilForm":
        return <PerfilForm />;
      case "ControleAcessoForm":
        return <ControleAcessoForm />;
      case "UsuarioForm":
        return <UsuarioForm />;
      case "cce":
        return <CartaCorrecaoForm initialNfeId={params?.nfe_cabecalho_id} />;
      case "nfe-inutilizacao":
        return <NfeInutilizacaoForm initialData={params} />;
      case "TrocaSenhaForm":
        return <TrocaSenhaForm />;
      case "provedor-test":
        return <ProvedorTestForm />;
      case "rpb-relatorios":
        return <RpbManager />;
      case "consulta-estoque":
        return <ConsultaEstoqueForm />;

      // PDV cases
      case "pdv":
        return <PdvCaixaForm />;
      case "abertura-caixa":
        return <AberturaCaixaForm />;
      case "pdv-caixa":
        return <PdvCaixaForm />;
      case "fechamento-caixa":
        return <FechamentoCaixaForm />;
      case "suprimento-caixa":
        return <SuprimentoSangriaForm tipo="SUP" />;
      case "sangria-caixa":
        return <SuprimentoSangriaForm tipo="SAN" />;

      default:
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
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <TabBar />
      <SidebarMenu />
      <div className="flex-1 overflow-hidden relative">
        <div className="relative z-10 h-full">
          {XTabs.map(tab => (
            <div
              key={tab.id}
              className={`h-full ${tab.id === XActiveTabId ? "block" : "hidden"}`}
            >
              <Suspense fallback={<TabLoadingFallback />}>
                {renderTabContent(tab.component, tab.params)}
              </Suspense>
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
