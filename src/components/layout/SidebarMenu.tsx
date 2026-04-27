import { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { X, ChevronRight, ChevronDown, FileBarChart } from "lucide-react";
import { MENU_CONFIG, MenuItem } from "@/config/menuConfig";
import { ScrollArea } from "@/components/ui/scroll-area";
import { rbFetchRelatorios } from "@/rbuilder/services/rb_reportService";
import type { IRbRelatorio } from "@/rbuilder/models/rb_types";

const MenuItemNode = ({
  item,
  depth = 0,
  openTab,
  closeSidebar,
}: {
  item: MenuItem;
  depth?: number;
  openTab: (tab: { title: string; component: string }) => void;
  closeSidebar: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
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
  const { XSidebarOpen, closeSidebar, openTab, XEmpresaMatrizId } = useAppContext();
  const [XRbRelatorios, setXRbRelatorios] = useState<IRbRelatorio[]>([]);

  useEffect(() => {
    if (XSidebarOpen && XEmpresaMatrizId > 0) {
      rbFetchRelatorios(XEmpresaMatrizId).then(setXRbRelatorios);
    }
  }, [XSidebarOpen, XEmpresaMatrizId]);

  // Build dynamic menu for rbuilder reports grouped by menu/submenu
  const XRbMenuItems = (() => {
    const XGrouped: Record<string, Record<string, IRbRelatorio[]>> = {};
    for (const r of XRbRelatorios) {
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
        if (XSubmenu) {
          XChildren.push({
            id: `rb-sub-${XMenu}-${XSubmenu}`,
            title: XSubmenu,
            icon: FileBarChart,
            children: XRels.sort((a, b) => a.ordem - b.ordem).map(r => ({
              id: `rb-exec-${r.rb_relatorio_id}`,
              title: r.nome,
              icon: FileBarChart,
            })),
          });
        } else {
          for (const r of XRels.sort((a, b) => a.ordem - b.ordem)) {
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
  })();

  // Inject dynamic reports into the menu config
  const XMenuConfig = MENU_CONFIG.map(item => {
    if (item.id === "relatorios-menu" && XRbMenuItems.length > 0) {
      // Find the "rbuilder" static entry and replace with dynamic children
      const XStaticChildren = (item.children || []).filter(c => c.id !== "rbuilder");
      return {
        ...item,
        children: [
          ...XStaticChildren,
          {
            id: "rbuilder",
            title: "RBuilder",
            icon: FileBarChart,
            children: XRbMenuItems,
          },
        ],
      };
    }
    return item;
  });

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
        <ScrollArea className="flex-1">
          <div className="p-2">
            {XMenuConfig.map((item) => (
              <MenuItemNode
                key={item.id}
                item={item}
                openTab={openTab}
                closeSidebar={closeSidebar}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </>
  );
};

export default SidebarMenu;
