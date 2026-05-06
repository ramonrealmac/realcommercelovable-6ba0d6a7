import { useEffect, useRef } from "react";
import { useAppContext, AppProvider } from "@/contexts/AppContext";
import TopBar from "@/components/layout/TopBar";
import TabBar from "@/components/layout/TabBar";
import SidebarMenu from "@/components/layout/SidebarMenu";
import { Palette } from "lucide-react";
import ClienteForm from "@/components/forms/ClienteForm";
import FornecedorForm from "@/components/forms/FornecedorForm";
import ProdutoForm from "@/components/forms/ProdutoForm";
import ServicoForm from "@/components/forms/ServicoForm";
import VendedorForm from "@/components/forms/VendedorForm";
import CondicaoPagamentoForm from "@/components/forms/CondicaoPagamentoForm";
import FormaPagamentoForm from "@/components/forms/FormaPagamentoForm";
import CategoriaProdutoForm from "@/components/forms/CategoriaProdutoForm";
import UnidadeMedidaForm from "@/components/forms/UnidadeMedidaForm";
import TransportadoraForm from "@/components/forms/TransportadoraForm";
import ContaPagarForm from "@/components/forms/ContaPagarForm";
import ContaReceberForm from "@/components/forms/ContaReceberForm";
import MovimentacaoEstoqueForm from "@/components/forms/MovimentacaoEstoqueForm";
import NotaFiscalEntradaForm from "@/components/forms/NotaFiscalEntradaForm";
import NfeRecebidasForm from "@/components/forms/NfeRecebidasForm";
import MdfeForm from "@/components/forms/mdfe/MdfeForm";
import AuthGate from "@/components/auth/AuthGate";
import { useThemeColors } from "@/hooks/useThemeColors";
import RbConexaoForm from "@/rbuilder/components/rb_ConexaoForm";
import RbTemplatePesquisaForm from "@/rbuilder/components/rb_TemplatePesquisaForm";
import RbRelatorioForm from "@/rbuilder/components/rb_RelatorioForm";
import RbReportExecutor from "@/rbuilder/components/rb_ReportExecutor";
import { RpbManager } from "@/report-builder";
import RpbStandaloneExecutor from "@/report-builder/components/executor/RpbStandaloneExecutor";
import ProvedorTestForm from "@/components/forms/ProvedorTestForm";
import PlanoContaForm from "@/components/forms/PlanoContaForm";
import BancoForm from "@/components/forms/BancoForm";
import FiscalRegraForm from "@/components/forms/FiscalRegraForm";
import CfopForm from "@/components/forms/CfopForm";
import ConsultaTitulosReceberForm from "@/components/forms/ConsultaTitulosReceberForm";
import GerarContasReceberForm from "@/components/forms/GerarContasReceberForm";
import ContaReceberDetalheForm from "@/components/forms/ContaReceberDetalheForm";
import FiscalConfigForm from "@/components/forms/FiscalConfigForm";
import BaixaPorClienteForm from "@/components/forms/BaixaPorClienteForm";
import ChatLauncher from "@/components/chat/ChatLauncher";

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
      case "clientes":
        return <ClienteForm />;
      case "fornecedores":
        return <FornecedorForm />;
      case "produtos":
        return <ProdutoForm />;
      case "servicos":
        return <ServicoForm />;
      case "vendedores":
        return <VendedorForm />;
      case "condicoes-pagamento":
        return <CondicaoPagamentoForm />;
      case "formas-pagamento":
        return <FormaPagamentoForm />;
      case "categorias-produto":
        return <CategoriaProdutoForm />;
      case "unidades-medida":
        return <UnidadeMedidaForm />;
      case "transportadoras":
        return <TransportadoraForm />;
      case "contas-pagar":
        return <ContaPagarForm />;
      case "contas-receber":
        return <ContaReceberForm />;
      case "movimentacao-estoque":
        return <MovimentacaoEstoqueForm />;
      case "nfe-entrada":
        return <NotaFiscalEntradaForm />;
      case "nfe-recebidas":
        return <NfeRecebidasForm />;
      case "mdfe":
        return <MdfeForm />;
      case "rb-conexoes":
        return <RbConexaoForm />;
      case "rb-templates":
        return <RbTemplatePesquisaForm />;
      case "rb-relatorios":
        return <RbRelatorioForm />;
      case "rpb-manager":
        return <RpbManager />;
      case "provedor-teste":
        return <ProvedorTestForm />;
      case "plano-contas":
        return <PlanoContaForm />;
      case "bancos":
        return <BancoForm />;
      case "fiscal-regra":
        return <FiscalRegraForm />;
      case "cfop":
        return <CfopForm />;
      case "fiscal-config":
        return <FiscalConfigForm />;
      case "consulta-titulos-receber":
        return <ConsultaTitulosReceberForm />;
      case "gerar-contas-receber":
        return <GerarContasReceberForm />;
      case "conta-receber-detalhe":
        return <ContaReceberDetalheForm empresa_id={params?.empresa_id} financeiro_id={params?.financeiro_id} />;
      case "baixa-por-cliente":
        return <BaixaPorClienteForm />;
      default:
        if (component.startsWith("rpb-exec-")) {
          const XRelId = parseInt(component.replace("rpb-exec-", ""));
          if (!isNaN(XRelId)) return <RpbStandaloneExecutor rpbRelatorioId={XRelId} initialParams={params} />;
        }
        if (component.startsWith("rb-exec-")) {
          const XReportId = parseInt(component.replace("rb-exec-", ""));
          if (!isNaN(XReportId)) return <RbReportExecutor XReportId={XReportId} />;
        }
        return <div className="p-4 text-muted-foreground">Componente não encontrado.</div>;
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
              {renderTabContent(tab.component, tab.params)}
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
