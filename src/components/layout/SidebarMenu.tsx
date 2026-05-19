import { useState, useEffect, useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { X, ChevronRight, ChevronDown, FileBarChart, Search, ChevronsDown, ChevronsUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MENU_CONFIG, MenuItem } from "@/config/menuConfig";
import { ScrollArea } from "@/components/ui/scroll-area";
import { rbFetchRelatorios } from "@/rbuilder/services/rb_reportService";
import type { IRbRelatorio } from "@/rbuilder/models/rb_types";
import { rpbListRelatorios } from "@/report-builder/services/rpbService";
import type { IRpbRelatorio } from "@/report-builder/types";
import { supabase } from "@/integrations/supabase/client";

const MenuItemNode = ({
  item,
  depth = 0,
  openTab,
  closeSidebar,
  forceExpand = false,
  lastAction = null,
}: {
  item: MenuItem;
  depth?: number;
  openTab: (tab: { title: string; component: string }) => void;
  closeSidebar: () => void;
  forceExpand?: boolean;
  lastAction?: { type: 'expand' | 'collapse', ts: number } | null;
}) => {
  const [expanded, setExpanded] = useState(forceExpand);
  const [appliedActionTs, setAppliedActionTs] = useState(0);

  // Sync with search-based forceExpand
  useEffect(() => {
    if (forceExpand) setExpanded(true);
  }, [forceExpand]);

  // Sync with global expand/collapse buttons
  useEffect(() => {
    if (lastAction && lastAction.ts > appliedActionTs) {
      setExpanded(lastAction.type === 'expand');
      setAppliedActionTs(lastAction.ts);
    }
  }, [lastAction, appliedActionTs]);

  const hasChildren = !!item.children?.length;
  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div>
        <button
          className="flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded hover:bg-accent text-left"
          style={{ paddingLeft: `${12 + depth * 14}px` }}
          onClick={() => setExpanded((p) => !p)}
        >
          <Icon size={14} className="text-primary shrink-0" />
          <span className="flex-1 truncate">{item.title}</span>
          {expanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
        </button>
        {expanded && (
          <div>
            {item.children!.map((child) => (
              <MenuItemNode
                key={child.id}
                item={child}
                depth={depth + 1}
                openTab={openTab}
                closeSidebar={closeSidebar}
                forceExpand={forceExpand}
                lastAction={lastAction}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded hover:bg-accent text-left"
      style={{ paddingLeft: `${12 + depth * 14}px` }}
      onClick={() => {
        openTab({ title: item.title, component: item.id });
        closeSidebar();
      }}
    >
      <Icon size={14} className="text-primary shrink-0" />
      <span className="truncate">{item.title}</span>
    </button>
  );
};

const SidebarMenu = () => {
  const { XSidebarOpen, closeSidebar, openTab, XEmpresaMatrizId, XEmpresaId } = useAppContext();
  const [XRbRelatorios, setXRbRelatorios] = useState<IRbRelatorio[]>([]);
  const [XRpbRelatorios, setXRpbRelatorios] = useState<IRpbRelatorio[]>([]);
  const [XSearch, setXSearch] = useState("");
  const [XLastAction, setXLastAction] = useState<{ type: 'expand' | 'collapse', ts: number } | null>(null);
  const [XSystemVersion, setXSystemVersion] = useState("v1.15.0");

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const { data, error } = await supabase
          .from("sistema_versoes")
          .select("versao")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data?.versao) {
          setXSystemVersion(`v${data.versao}`);
        }
      } catch (err) {
        console.error("Erro ao carregar versao do sistema:", err);
      }
    };
    loadVersion();
  }, []);

  useEffect(() => {
    if (XSidebarOpen && XEmpresaMatrizId > 0) {
      rbFetchRelatorios(XEmpresaMatrizId).then(setXRbRelatorios);
    }
    if (XSidebarOpen && XEmpresaId > 0) {
      rpbListRelatorios(XEmpresaId).then(setXRpbRelatorios);
    }
  }, [XSidebarOpen, XEmpresaMatrizId, XEmpresaId]);

  // Build dynamic menu for rbuilder reports grouped by menu/submenu
  const XRbMenuItems = useMemo(() => {
    if (!Array.isArray(XRbRelatorios) || XRbRelatorios.length === 0) return [];
    
    const XGrouped: Record<string, Record<string, IRbRelatorio[]>> = {};
    for (const r of XRbRelatorios) {
      if (!r) continue;
      const XMenu = r.menu || "Geral";
      const XSubmenu = r.submenu || "";
      if (!XGrouped[XMenu]) XGrouped[XMenu] = {};
      if (!XGrouped[XMenu][XSubmenu]) XGrouped[XMenu][XSubmenu] = [];
      XGrouped[XMenu][XSubmenu].push(r);
    }

    const XItems: MenuItem[] = [];
    for (const [XMenu, XSubmenus] of Object.entries(XGrouped)) {
      const XChildren: MenuItem[] = [];
      for (const [XSubmenu, XRels] of Object.entries(XSubmenus)) {
        const XSortedRels = [...XRels].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        
        if (XSubmenu) {
          XChildren.push({
            id: `rb-sub-${XMenu}-${XSubmenu}`,
            title: XSubmenu,
            icon: FileBarChart,
            children: XSortedRels.map(r => ({
              id: `rb-exec-${r.rb_relatorio_id}`,
              title: r.nome,
              icon: FileBarChart,
            })),
          });
        } else {
          for (const r of XSortedRels) {
            XChildren.push({
              id: `rb-exec-${r.rb_relatorio_id}`,
              title: r.nome,
              icon: FileBarChart,
            });
          }
        }
      }
      XItems.push({
        id: `rb-menu-${XMenu}`,
        title: XMenu,
        icon: FileBarChart,
        children: XChildren,
      });
    }
    return XItems;
  }, [XRbRelatorios]);

  // Inject dynamic reports into the menu config
  const XMenuConfig = useMemo(() => {
    return (MENU_CONFIG || []).map(item => {
      if (item.id === "relatorios-menu") {
        const XRpbCategories: Record<string, IRpbRelatorio[]> = {};
        if (Array.isArray(XRpbRelatorios)) {
          XRpbRelatorios.forEach(r => {
            if (!r) return;
            const cat = r.categoria || "Geral";
            if (!XRpbCategories[cat]) XRpbCategories[cat] = [];
            XRpbCategories[cat].push(r);
          });
        }

        const XRpbCategoryItems: MenuItem[] = Object.entries(XRpbCategories).map(([cat, rels]) => ({
          id: `rpb-cat-${cat}`,
          title: cat,
          icon: FileBarChart,
          children: rels.map(r => ({
            id: `rpb-exec-${r.rpb_relatorio_id}`,
            title: r.nome,
            icon: FileBarChart,
          })),
        }));

        const XStaticChildren = (item.children || []).filter(c => c && c.id !== "rbuilder");
        const XRBuilderChildren = [...XRbMenuItems, ...XRpbCategoryItems];

        return {
          ...item,
          children: [
            ...XStaticChildren,
            {
              id: "rbuilder",
              title: "RBuilder",
              icon: FileBarChart,
              children: XRBuilderChildren,
            },
          ],
        };
      }
      return item;
    });
  }, [XRbMenuItems, XRpbRelatorios]);

  const XFilteredMenu = useMemo(() => {
    if (!XSearch.trim()) return XMenuConfig;
    const q = XSearch.toLowerCase();

    const filterItems = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        const matchesSelf = item.title.toLowerCase().includes(q);
        const filteredChildren = item.children ? filterItems(item.children) : undefined;
        const hasVisibleChildren = filteredChildren && filteredChildren.length > 0;

        if (matchesSelf || hasVisibleChildren) {
          return { ...item, children: filteredChildren };
        }
        return null;
      }).filter(Boolean) as MenuItem[];
    };

    return filterItems(XMenuConfig);
  }, [XMenuConfig, XSearch]);

  if (!XSidebarOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-foreground/30 z-40" onClick={closeSidebar} />
      <div className="fixed left-0 top-0 bottom-0 w-72 bg-card shadow-lg z-50 animate-slide-in flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-border bg-topbar text-topbar-foreground">
          <span className="font-semibold text-sm">Menu Principal</span>
          <button onClick={closeSidebar} className="p-1 hover:bg-foreground/10 rounded">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 border-b border-border bg-muted/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar no menu..." 
              className="pl-9 pr-16 h-9 text-xs bg-background"
              value={XSearch}
              onChange={(e) => setXSearch(e.target.value)}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {XSearch && (
                <button 
                  onClick={() => setXSearch("")}
                  className="p-1 hover:bg-foreground/10 rounded mr-1"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
              <button 
                onClick={() => setXLastAction({ type: 'expand', ts: Date.now() })}
                title="Expandir tudo"
                className="p-1 hover:bg-foreground/10 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronsDown size={14} />
              </button>
              <button 
                onClick={() => setXLastAction({ type: 'collapse', ts: Date.now() })}
                title="Recolher tudo"
                className="p-1 hover:bg-foreground/10 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronsUp size={14} />
              </button>
            </div>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {XFilteredMenu.map((item) => (
              <MenuItemNode
                key={item.id}
                item={item}
                openTab={openTab}
                closeSidebar={closeSidebar}
                forceExpand={!!XSearch}
                lastAction={XLastAction}
              />
            ))}
            {XFilteredMenu.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Nenhum item encontrado.
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-3 border-t border-border bg-muted/20 text-[10px] text-muted-foreground flex justify-between items-center shrink-0">
          <span className="font-semibold tracking-wider uppercase opacity-75">RealSys AI</span>
          <span className="font-mono font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded shadow-sm">{XSystemVersion}</span>
        </div>
      </div>
    </>
  );
};

export default SidebarMenu;
