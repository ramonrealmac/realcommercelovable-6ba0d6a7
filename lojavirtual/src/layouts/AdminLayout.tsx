import { useAuth } from '@/contexts/AuthContext';
import { TabProvider, useTabs } from '@/contexts/TabContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard, Package, Layers, Users, ShoppingCart, ClipboardList,
  Warehouse, Settings, FileText, LogOut, X, Wifi, Menu, UtensilsCrossed,
  PanelLeftClose, UserCog,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import Dashboard from '@/pages/admin/Dashboard';
import Produtos from '@/pages/admin/Produtos';
import GrupoProdutos from '@/pages/admin/GrupoProdutos';
import Clientes from '@/pages/admin/Clientes';
import Pedidos from '@/pages/admin/Pedidos';
import PDV from '@/pages/admin/PDV';
import Estoque from '@/pages/admin/Estoque';
import Parametros from '@/pages/admin/Parametros';
import Relatorios from '@/pages/admin/Relatorios';
import Usuarios from '@/pages/admin/Usuarios';

const MODULE_COMPONENTS: Record<string, React.ComponentType> = {
  dashboard: Dashboard, produtos: Produtos, 'grupo-produtos': GrupoProdutos,
  clientes: Clientes, pedidos: Pedidos, pdv: PDV, estoque: Estoque,
  parametros: Parametros, relatorios: Relatorios, usuarios: Usuarios,
};

interface NavItem { id: string; title: string; icon: any; adminOnly?: boolean; }

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
  { id: 'pdv', title: 'PDV', icon: ShoppingCart },
  { id: 'pedidos', title: 'Pedidos', icon: ClipboardList },
  { id: 'produtos', title: 'Produtos', icon: Package, adminOnly: true },
  { id: 'grupo-produtos', title: 'Grupos', icon: Layers, adminOnly: true },
  { id: 'clientes', title: 'Clientes', icon: Users, adminOnly: true },
  { id: 'estoque', title: 'Estoque', icon: Warehouse, adminOnly: true },
  { id: 'relatorios', title: 'Relatórios', icon: FileText, adminOnly: true },
  { id: 'usuarios', title: 'Usuários', icon: UserCog, adminOnly: true },
  { id: 'parametros', title: 'Parâmetros', icon: Settings, adminOnly: true },
];

function AdminContent() {
  const { user, role, isAdmin, signOut, loading } = useAuth();
  const { tabs, activeTabId, openTab, closeTab, setActiveTab } = useTabs();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const visibleNav = NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin);

  const handleNavClick = (item: NavItem) => {
    openTab({ id: item.id, title: item.title, icon: item.icon });
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-sidebar flex flex-col border-r transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className={`p-3 flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-sm truncate text-sidebar-foreground">Lanchonete Escolar</h2>
              <span className="text-xs text-sidebar-foreground/60 flex items-center gap-1">
                <Wifi className="w-3 h-3 text-green-500" /> Online
              </span>
            </div>
          )}
        </div>

        <Separator />

        <ScrollArea className="flex-1 py-2">
          <nav className={`space-y-1 ${sidebarCollapsed ? 'px-1' : 'px-2'}`}>
            {visibleNav.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                title={sidebarCollapsed ? item.title : undefined}
                className={`w-full flex items-center gap-3 rounded-lg text-sm transition-colors ${
                  sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
                } ${
                  activeTabId === item.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && item.title}
              </button>
            ))}
          </nav>
        </ScrollArea>

        <Separator />

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex justify-center py-2">
          <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? 'Expandir' : 'Recolher'}>
            <PanelLeftClose className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {!sidebarCollapsed && (
          <>
            <Separator />
            <div className="p-3">
              <div className="text-xs text-sidebar-foreground/60 mb-2 truncate px-1">
                {user.email} <span className="font-semibold text-primary">({role})</span>
              </div>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
                <LogOut className="w-4 h-4" /> Sair
              </Button>
            </div>
          </>
        )}
        {sidebarCollapsed && (
          <div className="p-2 flex justify-center">
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair"><LogOut className="w-4 h-4" /></Button>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b bg-background flex items-center px-2 gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>

          <div className="flex-1 flex items-center gap-0.5 overflow-x-auto">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors shrink-0 ${
                  activeTabId === tab.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded p-0.5 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto relative">
          {tabs.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center space-y-3">
                <UtensilsCrossed className="w-16 h-16 mx-auto opacity-20" />
                <p className="text-lg">Selecione um módulo no menu lateral</p>
              </div>
            </div>
          )}
          {tabs.map((tab) => {
            const Comp = MODULE_COMPONENTS[tab.id];
            if (!Comp) return null;
            return (
              <div key={tab.id} className={activeTabId === tab.id ? '' : 'hidden'}>
                <Comp />
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <TabProvider>
      <AdminContent />
    </TabProvider>
  );
}
