import React, { createContext, useContext, useState, useCallback } from "react";

export interface AppTab {
  id: string;
  title: string;
  component: string;
}

export interface IEmpresaOption {
  empresa_id: number;
  razao_social: string;
  nome_fantasia: string;
  empresa_matriz_id: number | null;
  identificacao: string;
}

interface AppContextType {
  XEmpresaId: number;
  setXEmpresaId: (id: number) => void;
  XEmpresaMatrizId: number;
  setXEmpresaMatrizId: (id: number) => void;
  XEmpresas: IEmpresaOption[];
  setXEmpresas: (list: IEmpresaOption[]) => void;
  XTabs: AppTab[];
  XActiveTabId: string | null;
  openTab: (tab: Omit<AppTab, "id">) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  XSidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  XLogomarca: string;
  setXLogomarca: (url: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

let XTabCounter = 0;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [XEmpresaId, setXEmpresaId] = useState(0);
  const [XEmpresaMatrizId, setXEmpresaMatrizId] = useState(0);
  const [XEmpresas, setXEmpresas] = useState<IEmpresaOption[]>([]);
  const [XTabs, setXTabs] = useState<AppTab[]>([]);
  const [XActiveTabId, setXActiveTabId] = useState<string | null>(null);
  const [XSidebarOpen, setXSidebarOpen] = useState(false);
  const [XLogomarca, setXLogomarca] = useState("");

  const openTab = useCallback((tab: Omit<AppTab, "id">) => {
    const XExisting = XTabs.find(t => t.component === tab.component);
    if (XExisting) {
      setXActiveTabId(XExisting.id);
      return;
    }
    const XNewId = `tab-${++XTabCounter}`;
    const XNewTab: AppTab = { ...tab, id: XNewId };
    setXTabs(prev => [...prev, XNewTab]);
    setXActiveTabId(XNewId);
  }, [XTabs]);

  const closeTab = useCallback((id: string) => {
    setXTabs(prev => {
      const XFiltered = prev.filter(t => t.id !== id);
      if (XActiveTabId === id) {
        const XIdx = prev.findIndex(t => t.id === id);
        const XNewActive = XFiltered[Math.min(XIdx, XFiltered.length - 1)];
        setXActiveTabId(XNewActive?.id || null);
      }
      return XFiltered;
    });
  }, [XActiveTabId]);

  const toggleSidebar = useCallback(() => setXSidebarOpen(p => !p), []);
  const closeSidebar = useCallback(() => setXSidebarOpen(false), []);

  return (
    <AppContext.Provider value={{
      XEmpresaId, setXEmpresaId,
      XEmpresaMatrizId, setXEmpresaMatrizId,
      XEmpresas, setXEmpresas,
      XTabs, XActiveTabId, openTab, closeTab, setActiveTab: setXActiveTabId,
      XSidebarOpen, toggleSidebar, closeSidebar,
      XLogomarca, setXLogomarca,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
};
