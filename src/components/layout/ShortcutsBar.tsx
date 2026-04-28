import { useEffect, useMemo, useRef, useState } from "react";
import { Pin, Search, X } from "lucide-react";
import { MENU_CONFIG, MenuItem, getLeafItems } from "@/config/menuConfig";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_PREFIX = "x_shortcuts_v1::";

const ShortcutsBar = () => {
  const { openTab } = useAppContext();
  const [XUserId, setXUserId] = useState<string>("anon");
  const [XShortcuts, setXShortcuts] = useState<string[]>([]); // list of leaf menu ids
  const [XPickerOpen, setXPickerOpen] = useState(false);
  const [XSearch, setXSearch] = useState("");
  const XRef = useRef<HTMLDivElement>(null);

  // Load user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setXUserId(session.user.id);
    });
  }, []);

  // Load shortcuts from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + XUserId);
      if (raw) setXShortcuts(JSON.parse(raw));
    } catch {}
  }, [XUserId]);

  const persist = (list: string[]) => {
    setXShortcuts(list);
    try {
      localStorage.setItem(STORAGE_PREFIX + XUserId, JSON.stringify(list));
    } catch {}
  };

  // Flat leaf menu items (have a component / open tab)
  const XAllLeaves = useMemo(() => getLeafItems(MENU_CONFIG), []);
  const XLeafById = useMemo(() => {
    const m = new Map<string, MenuItem>();
    for (const l of XAllLeaves) m.set(l.id, l);
    return m;
  }, [XAllLeaves]);

  const XPinned = useMemo(
    () => XShortcuts.map(id => XLeafById.get(id)).filter(Boolean) as MenuItem[],
    [XShortcuts, XLeafById]
  );

  const XFiltered = useMemo(() => {
    const q = XSearch.trim().toLowerCase();
    if (!q) return XAllLeaves;
    return XAllLeaves.filter(l => l.title.toLowerCase().includes(q));
  }, [XAllLeaves, XSearch]);

  // Close picker on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (XRef.current && !XRef.current.contains(e.target as Node)) {
        setXPickerOpen(false);
      }
    };
    if (XPickerOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [XPickerOpen]);

  const togglePin = (id: string) => {
    if (XShortcuts.includes(id)) {
      persist(XShortcuts.filter(s => s !== id));
    } else {
      persist([...XShortcuts, id]);
    }
  };

  const handleOpen = (item: MenuItem) => {
    openTab({ title: item.title, component: item.id });
  };

  return (
    <div className="flex items-center gap-1 relative" ref={XRef}>
      {/* Pinned shortcuts (icon-only) */}
      <div className="hidden sm:flex items-center gap-0.5 max-w-[40vw] overflow-x-auto">
        {XPinned.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleOpen(item)}
              className="p-1.5 hover:bg-foreground/10 rounded shrink-0"
              title={item.title}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      {/* Pin manager button */}
      <button
        onClick={() => setXPickerOpen(p => !p)}
        className={`p-1.5 rounded transition-colors ${
          XPickerOpen ? "bg-foreground/20" : "hover:bg-foreground/10"
        }`}
        title="Gerenciar atalhos"
      >
        <Pin size={18} />
      </button>

      {XPickerOpen && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-[70vh] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden flex flex-col text-foreground">
          <div className="px-3 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
            <span className="text-sm font-medium">Atalhos</span>
            <button
              onClick={() => setXPickerOpen(false)}
              className="p-1 hover:bg-accent rounded"
              title="Fechar"
            >
              <X size={14} />
            </button>
          </div>
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={XSearch}
                onChange={e => setXSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-7 pr-2 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {XFiltered.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                Nenhum item encontrado.
              </div>
            )}
            {XFiltered.map(item => {
              const Icon = item.icon;
              const pinned = XShortcuts.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => togglePin(item.id)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-accent ${
                    pinned ? "bg-accent/40" : ""
                  }`}
                >
                  <Icon size={14} className="text-primary shrink-0" />
                  <span className="flex-1 truncate">{item.title}</span>
                  <Pin
                    size={13}
                    className={pinned ? "text-primary fill-primary" : "text-muted-foreground"}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShortcutsBar;
