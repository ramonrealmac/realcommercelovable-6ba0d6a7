import { useEffect, useRef } from "react";
import TopBar from "@/components/layout/TopBar";
import TabBar from "@/components/layout/TabBar";
import SidebarMenu from "@/components/layout/SidebarMenu";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import GrupoProdutosForm from "@/components/forms/GrupoProdutosForm";
import ClienteForm from "@/components/forms/ClienteForm";
import FornecedorTransportadorForm from "@/components/forms/FornecedorTransportadorForm";
import CadastroGrupoForm from "@/components/forms/CadastroGrupoForm";
import CondicaoPagamentoForm from "@/components/forms/CondicaoPagamentoForm";
import PerfilForm from "@/components/forms/PerfilForm";
import ControleAcessoForm from "@/components/forms/ControleAcessoForm";
import UsuarioForm from "@/components/forms/UsuarioForm";
import TrocaSenhaForm from "@/components/forms/TrocaSenhaForm";
import EmpresaForm from "@/components/forms/EmpresaForm";
import CidadeForm from "@/components/forms/CidadeForm";
import EstadoForm from "@/components/forms/EstadoForm";
import RotaForm from "@/components/forms/RotaForm";
import LinhaProdutoForm from "@/components/forms/LinhaProdutoForm";
import UnidadeForm from "@/components/forms/UnidadeForm";
import DepositoForm from "@/components/forms/DepositoForm";
import EstoqueForm from "@/components/forms/EstoqueForm";
import ProdutoForm from "@/components/forms/ProdutoForm";
import PedidoForm from "@/components/forms/PedidoForm";
import PdvCaixaForm from "@/components/forms/pdv/PdvCaixaForm";
import FechamentoCaixaForm from "@/components/forms/pdv/FechamentoCaixaForm";
import AberturaCaixaForm from "@/components/forms/pdv/AberturaCaixaForm";
import SuprimentoSangriaForm from "@/components/forms/pdv/SuprimentoSangriaForm";
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
import ProvedorTestForm from "@/components/forms/ProvedorTestForm";

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

  const renderTabContent = (component: string) => {
    switch (component) {
      case "GrupoProdutosForm":
      case "grupo-produtos":
        return <GrupoProdutosForm />;
      case "cadastro-completo":
        return <ClienteForm />;
      case "fornecedores-transportadores":
        return <FornecedorTransportadorForm />;
      case "grupo-cadastros":
        return <CadastroGrupoForm />;
      case "cond-pagamento":
        return <CondicaoPagamentoForm />;
      case "PerfilForm":
        return <PerfilForm />;
      case "ControleAcessoForm":
        return <ControleAcessoForm />;
      case "UsuarioForm":
        return <UsuarioForm />;
      case "TrocaSenhaForm":
        return <TrocaSenhaForm />;
      case "empresas":
        return <EmpresaForm />;
      case "estados":
        return <EstadoForm />;
      case "cidades":
        return <CidadeForm />;
      case "rotas":
        return <RotaForm />;
      case "linhas-produtos":
        return <LinhaProdutoForm />;
      case "unidades":
        return <UnidadeForm />;
      case "depositos":
        return <DepositoForm />;
      case "estoque":
        return <EstoqueForm />;
      case "produtos":
        return <ProdutoForm />;
      case "pdv":
        return <PedidoForm />;
      case "nova-entrada":
      case "minhas-entradas":
        return <NotaFiscalEntradaForm />;
      case "nfe-recebidas":
        return <NfeRecebidasForm />;
      case "pdv-caixa":
        return <PdvCaixaForm />;
      case "fechamento-caixa":
        return <FechamentoCaixaForm />;
      case "abertura-caixa":
        return <AberturaCaixaForm />;
      case "suprimento-caixa":
        return <SuprimentoSangriaForm tipo="SUP" />;
      case "sangria-caixa":
        return <SuprimentoSangriaForm tipo="SAN" />;
      case "rb-conexoes":
        return <RbConexaoForm />;
      case "rb-templates":
        return <RbTemplatePesquisaForm />;
      case "rb-relatorios":
        return <RbRelatorioForm />;
      case "mdfe":
        return <MdfeForm />;
      case "rpb-relatorios":
        return <RpbManager />;
      case "provedor-test":
        return <ProvedorTestForm />;
      default:
        if (component.startsWith("rb-exec-")) {
          const XReportId = parseInt(component.replace("rb-exec-", ""));
          if (!isNaN(XReportId)) return <RbReportExecutor XReportId={XReportId} />;
        }
        return <div className="p-4 text-muted-foreground">Componente não encontrado.</div>;
    }
  };

  useEffect(() => {
    if (!XInitRef.current) {
      XInitRef.current = true;
      openTab({ title: "Grupos de Produtos", component: "GrupoProdutosForm" });
    }
  }, [openTab]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <TabBar />
      <SidebarMenu />
      <div
        className="flex-1 overflow-hidden relative"
        style={XLogomarca ? {
          backgroundImage: `url(${XLogomarca})`,
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        } : undefined}
      >
        {/* Semi-transparent overlay when logomarca is present */}
        {XLogomarca && (
          <div className="absolute inset-0 bg-background/85 pointer-events-none z-0" />
        )}
        <div className="relative z-10 h-full">
          {XTabs.map(tab => (
            <div
              key={tab.id}
              className={`h-full ${tab.id === XActiveTabId ? "block" : "hidden"}`}
            >
              {renderTabContent(tab.component)}
            </div>
          ))}
          {XTabs.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Use o menu para abrir um formulário.
            </div>
          )}
        </div>
      </div>
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
