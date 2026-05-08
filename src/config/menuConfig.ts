import type { LucideIcon } from "lucide-react";

import {
  Home,
  Users,
  UserPlus,
  UsersRound,
  Contact,
  Building2,
  Truck,
  Package,
  ShoppingCart as CartFlatbed,
  AlignJustify,
  Box,
  Boxes,
  BoxSelect,
  Truck as Dolly,
  Store,
  MapPin,
  Navigation,
  Car,
  DollarSign,
  Landmark,
  CreditCard,
  Wallet,
  FileText,
  AlignLeft,
  ArrowRightLeft,
  Percent,
  BarChart3,
  Plus,
  ArrowUpFromLine,
  ArrowDownToLine,
  FilePen,
  BadgeDollarSign,
  ClipboardList,
  MapPinned,
  TruckIcon,
  Route,
  FileDown,
  FileUp,
  BarChart,
  ShoppingCart,
  Package2,
  Settings2,
  FolderOpen,
  Folder,
  Filter,
  Key,
  Warehouse,
  Layers,
  FileBarChart,
  ClipboardCheck,
  Activity,
  Monitor,
  Receipt,
  Lock,
  Unlock,
  Calculator,
} from "lucide-react";

export interface MenuItem {
  id: string;
  title: string;
  icon: LucideIcon;
  children?: MenuItem[];
  adminOnly?: boolean;
}

export const MENU_CONFIG: MenuItem[] = [
  { id: "dashboard", title: "Início", icon: Home },
  {
    id: "cadastros",
    title: "1. Cadastros",
    icon: Users,
    adminOnly: true,
    children: [
      {
        id: "cad-clientes",
        title: "Parceiros",
        icon: UsersRound,
        children: [
          /*  { id: "clientes", title: "Cadastro Resumido", icon: UserPlus },*/
          { id: "cadastro-completo", title: "Clientes", icon: Contact },
          { id: "fornecedores-transportadores", title: "Fornecedores/Transportadores", icon: Truck },
          { id: "funcionarios", title: "Funcionários", icon: Contact },
          { id: "grupo-cadastros", title: "Grupos de Parceiros", icon: UsersRound },
        ],
      },
      {
        id: "cad-produtos",
        title: "Produtos",
        icon: Package,
        children: [
          { id: "produtos", title: "Produtos", icon: CartFlatbed },
          { id: "linhas-produtos", title: "Linhas de Produtos", icon: AlignJustify },
          { id: "grupo-produtos", title: "Grupos de Produtos", icon: Box },
          { id: "unidades", title: "Unidades", icon: Layers },
        ],
      },
      {
        id: "cad-estoques",
        title: "Estoques",
        icon: BoxSelect,
        children: [
          { id: "estoque", title: "Meus Estoques", icon: Dolly },
          { id: "depositos", title: "Depósitos", icon: Store },
        ],
      },
      {
        id: "cad-enderecos",
        title: "Endereços e Rotas",
        icon: MapPin,
        children: [
          { id: "estados", title: "Estados", icon: MapPin },
          { id: "cidades", title: "Cidades", icon: Navigation },
          { id: "rotas", title: "Rotas", icon: Route },
        ],
      },
      {
        id: "cad-tabelas-preco",
        title: "Tabelas de Preço",
        icon: DollarSign,
        children: [{ id: "tabelas-preco", title: "Tabelas", icon: AlignJustify }],
      },
      {
        id: "cad-financeiro",
        title: "Financeiro",
        icon: Landmark,
        children: [
          { id: "bancos", title: "Bancos", icon: Landmark },
          { id: "contas", title: "Contas", icon: ArrowRightLeft },
          { id: "portadores", title: "Portadores", icon: Wallet },
          { id: "cond-pagamento", title: "Condições de Pagamento", icon: CreditCard },
          { id: "plano-contas", title: "Plano de Contas", icon: AlignLeft },
          { id: "tipo-operacoes", title: "Tipos de Operações", icon: AlignLeft },
          { id: "tipo-pag-rec", title: "Tipo Pag./Recebimento", icon: ArrowRightLeft },
          { id: "comissoes", title: "Comissões", icon: Percent },
        ],
      },
      {
        id: "cad-tributacoes",
        title: "Tributações",
        icon: BarChart3,
        children: [
          { id: "cfop", title: "CFOP", icon: Plus },
          { id: "fiscal-regras", title: "Regras Fiscais", icon: AlignLeft },
        ],
      },
    ],
  },
  {
    id: "movimentacoes",
    title: "2. Movimentações",
    icon: ArrowRightLeft,
    children: [
      {
        id: "mov-saidas",
        title: "Saídas",
        icon: ArrowUpFromLine,
        children: [
          { id: "pdv", title: "Novo Pedido", icon: FilePen },
          { id: "finalizar-venda", title: "Finalizar Venda", icon: BadgeDollarSign },
          { id: "pedidos", title: "Meus Pedidos", icon: ClipboardList },
          {
            id: "mov-entregas",
            title: "Entregas",
            icon: TruckIcon,
            children: [
              { id: "montagem-rota", title: "Montagem da Rota", icon: MapPinned },
              { id: "rotas-montadas", title: "Rotas Montadas", icon: Route },
            ],
          },
        ],
      },
      {
        id: "mov-entradas",
        title: "Entradas",
        icon: ArrowDownToLine,
        children: [
          { id: "nova-entrada", title: "Nova Entrada", icon: FilePen },
          { id: "minhas-entradas", title: "Minhas Entradas", icon: ClipboardCheck },
          { id: "nfe-recebidas", title: "NF-e Recebidas (DFe)", icon: FileDown },
        ],
      },
    ],
  },
  {
    id: "financeiro",
    title: "3. Financeiro",
    icon: BadgeDollarSign,
    children: [
      { id: "mov-financeiras", title: "Movimentações Financeiras", icon: BarChart3 },
      {
        id: "contas-receber",
        title: "Contas a Receber",
        icon: FileUp,
        children: [
          { id: "consulta-titulos-receber", title: "Consulta de Títulos", icon: FileText },
        ],
      },
      { id: "contas-pagar", title: "Contas a Pagar", icon: FileDown },
      { id: "emissao-boletos", title: "Emissão de Boletos", icon: FileText },
    ],
  },
  {
    id: "caixa-pdv",
    title: "4. Caixa/PDV",
    icon: Monitor,
    children: [
      { id: "abertura-caixa", title: "4.1. Abertura de Caixa", icon: Unlock },
      { id: "pdv-caixa", title: "4.2. PDV/Caixa", icon: Calculator },
      { id: "suprimento-caixa", title: "4.3. Suprimento", icon: ArrowDownToLine },
      { id: "sangria-caixa", title: "4.4. Sangria", icon: ArrowUpFromLine },
      { id: "fechamento-caixa", title: "4.5. Fechamento", icon: Lock },
    ],
  },
  {
    id: "fiscal",
    title: "5. Fiscal",
    icon: Receipt,
    children: [
      { id: "fiscal-config", title: "Configurações Fiscais", icon: Settings2 },
      {
        id: "nfe-group",
        title: "NFe / NFCe",
        icon: FileText,
        children: [
          { id: "nfe-emitidas", title: "Gerenciador Fiscal", icon: FileText },
          { id: "nfe-form", title: "Notas Emitidas", icon: FilePen },
          { id: "cce", title: "Carta de Correção", icon: FilePen },
        ]
      },
      { id: "mdfe", title: "Mdfe", icon: FileText },
      { id: "cte", title: "Cte", icon: FileText },
    ],
  },
  {
    id: "relatorios-menu",
    title: "6. Relatórios",
    icon: FileBarChart,
    children: [
      { id: "rel-contas-receber", title: "Relatórios - Contas a Receber", icon: FileUp },
      { id: "rel-contas-pagar", title: "Relatórios - Contas a Pagar", icon: FileDown },
      { id: "relatorios", title: "Relatórios - Vendas", icon: ShoppingCart },
      { id: "rel-produtos", title: "Relatórios - Produtos", icon: Package2 },
    ],
  },
  {
    id: "configuracoes",
    title: "7. Configurações",
    icon: Settings2,
    adminOnly: true,
    children: [
      { id: "empresas", title: "Empresas", icon: Building2 },
      { id: "grupo-relatorios", title: "Grupo de Relatórios", icon: Folder },
      { id: "config-relatorios", title: "Relatórios", icon: FolderOpen },
      { id: "rpb-relatorios", title: "Report Builder Pro", icon: FileBarChart },
      { id: "parametros", title: "Parâmetros", icon: Settings2 },
      { id: "licencas", title: "Ativar Licenças", icon: Key },
      { id: "provedor-test", title: "Teste Provedor", icon: Activity },
    ],
  },
];

/** Flat list of all leaf menu IDs (items that open a tab) */
export function getLeafItems(items: MenuItem[], visited = new Set<string>()): MenuItem[] {
  const result: MenuItem[] = [];
  if (!Array.isArray(items)) return result;
  
  for (const item of items) {
    if (!item || visited.has(item.id)) continue;
    visited.add(item.id);
    if (item.children && Array.isArray(item.children) && item.children.length > 0) {
      result.push(...getLeafItems(item.children, visited));
    } else {
      result.push(item);
    }
  }
  return result;
}
