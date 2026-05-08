import { useEffect, useRef } from "react";
import { useAppContext, AppProvider } from "@/contexts/AppContext";
import TopBar from "@/components/layout/TopBar";
import TabBar from "@/components/layout/TabBar";
import SidebarMenu from "@/components/layout/SidebarMenu";
import { Palette } from "lucide-react";

// Imports corrigidos baseados nos arquivos reais
import CadastroCompletoForm from "@/components/forms/CadastroCompletoForm";
import FornecedorTransportadorForm from "@/components/forms/FornecedorTransportadorForm";
import FuncionarioForm from "@/components/forms/FuncionarioForm";
import CadastroGrupoForm from "@/components/forms/CadastroGrupoForm";
import ProdutoForm from "@/components/forms/ProdutoForm";
import LinhaProdutoForm from "@/components/forms/LinhaProdutoForm";
import GrupoProdutosForm from "@/components/forms/GrupoProdutosForm";
import UnidadeForm from "@/components/forms/UnidadeForm";
import EstoqueForm from "@/components/forms/EstoqueForm";
import DepositoForm from "@/components/forms/DepositoForm";
import EstadoForm from "@/components/forms/EstadoForm";
import CidadeForm from "@/components/forms/CidadeForm";
import RotaForm from "@/components/forms/RotaForm";
import BancoForm from "@/components/forms/BancoForm";
import CondicaoPagamentoForm from "@/components/forms/CondicaoPagamentoForm";
import PlanoContaForm from "@/components/forms/PlanoContaForm";
import CfopForm from "@/components/forms/CfopForm";
import FiscalRegraForm from "@/components/forms/FiscalRegraForm";
import PedidoForm from "@/components/forms/PedidoForm";
import NotaFiscalEntradaForm from "@/components/forms/NotaFiscalEntradaForm";
import NfeRecebidasForm from "@/components/forms/NfeRecebidasForm";
import NfeEmtidaForm from "@/components/forms/NfeEmtidaForm";
import ConsultaTitulosReceberForm from "@/components/forms/ConsultaTitulosReceberForm";
import BaixaPorClienteForm from "@/components/forms/BaixaPorClienteForm";
import FiscalConfigForm from "@/components/forms/FiscalConfigForm";
import MdfeForm from "@/components/forms/mdfe/MdfeForm";
import EmpresaForm from "@/components/forms/EmpresaForm";
import PerfilForm from "@/components/forms/PerfilForm";
import ControleAcessoForm from "@/components/forms/ControleAcessoForm";
import UsuarioForm from "@/components/forms/UsuarioForm";
import TrocaSenhaForm from "@/components/forms/TrocaSenhaForm";
import ProvedorTestForm from "@/components/forms/ProvedorTestForm";
import AuthGate from "@/components/auth/AuthGate";
import { useThemeColors } from "@/hooks/useThemeColors";
import RbReportExecutor from "@/rbuilder/components/rb_ReportExecutor";
import { RpbManager } from "@/report-builder";
import RpbStandaloneExecutor from "@/report-builder/components/executor/RpbStandaloneExecutor";
import ChatLauncher from "@/components/chat/ChatLauncher";

// PDV Imports
import PdvTela from "@/components/forms/pdv/PdvTela";
import AberturaCaixaForm from "@/components/forms/pdv/AberturaCaixaForm";
import PdvCaixaForm from "@/components/forms/pdv/PdvCaixaForm";
import FechamentoCaixaForm from "@/components/forms/pdv/FechamentoCaixaForm";
import SuprimentoSangriaForm from "@/components/forms/pdv/SuprimentoSangriaForm";

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
        return <CadastroCompletoForm />;
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
      case "fiscal-regras":
        return <FiscalRegraForm />;
      case "pedidos":
        return <PedidoForm />;
      case "nova-entrada":
      case "minhas-entradas":
        return <NotaFiscalEntradaForm />;
      case "nfe-recebidas":
        return <NfeRecebidasForm />;
      case "nfe-emitidas":
      case "nfe-nfce":
        return <NfeEmtidaForm />;
      case "consulta-titulos-receber":
        return <ConsultaTitulosReceberForm />;
      case "baixa-por-cliente":
        return <BaixaPorClienteForm />;
      case "fiscal-config":
        return <FiscalConfigForm />;
      case "mdfe":
        return <MdfeForm />;
      case "empresas":
        return <EmpresaForm />;
      case "PerfilForm":
        return <PerfilForm />;
      case "ControleAcessoForm":
        return <ControleAcessoForm />;
      case "UsuarioForm":
        return <UsuarioForm />;
      case "TrocaSenhaForm":
        return <TrocaSenhaForm />;
      case "provedor-test":
        return <ProvedorTestForm />;
      case "rpb-relatorios":
        return <RpbManager />;
      
      // PDV cases
      case "pdv":
        return <PdvTela />;
      case "abertura-caixa":
        return <AberturaCaixaForm />;
      case "pdv-caixa":
        return <PdvCaixaForm />;
      case "fechamento-caixa":
        return <FechamentoCaixaForm />;
      case "suprimento-caixa":
      case "sangria-caixa":
        return <SuprimentoSangriaForm />;

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
