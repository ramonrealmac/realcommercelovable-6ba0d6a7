import React, { useState, useEffect, useRef } from "react";
import { Star, X, Plus, ChevronRight } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { MENU_CONFIG, getLeafItems, type MenuItem } from "@/config/menuConfig";
import { supabase } from "@/integrations/supabase/client";

// ── Tipos ─────────────────────────────────────────────────────
interface IShortcut {
  id: string;
  title: string;
}

const STORAGE_KEY_PREFIX = "rc_shortcuts_";
const ALL_LEAVES = getLeafItems(MENU_CONFIG);

// ── Hook: atalhos por usuário (localStorage) ───────────────────
function useShortcuts() {
  const [userId, setUserId]       = useState<string>("guest");
  const [shortcuts, setShortcuts] = useState<IShortcut[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? "guest";
      setUserId(uid);
      try {
        const stored = localStorage.getItem(STORAGE_KEY_PREFIX + uid);
        setShortcuts(stored ? JSON.parse(stored) : []);
      } catch {
        setShortcuts([]);
      }
    });
  }, []);

  const persist = (list: IShortcut[]) => {
    setShortcuts(list);
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, JSON.stringify(list));
  };

  const add    = (item: MenuItem) => {
    if (shortcuts.find(s => s.id === item.id)) return;
    persist([...shortcuts, { id: item.id, title: item.title }]);
  };
  const remove = (id: string) => persist(shortcuts.filter(s => s.id !== id));

  return { shortcuts, add, remove };
}

// ── Sub-componente: item/submenu recursivo no picker ──────────
const PickerNode: React.FC<{
  item: MenuItem;
  depth?: number;
  onSelect: (item: MenuItem) => void;
  pinnedIds: Set<string>;
}> = ({ item, depth = 0, onSelect, pinnedIds }) => {
  const [open, setOpen] = useState(false);
  const hasChildren     = !!item.children?.length;
  const Icon            = item.icon;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(p => !p)}
          className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs hover:bg-accent text-left transition-colors"
          style={{ paddingLeft: `${12 + depth * 14}px` }}
        >
          <Icon size={13} className="text-muted-foreground shrink-0" />
          <span className="flex-1 truncate font-medium">{item.title}</span>
          <ChevronRight
            size={12}
            className={`text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
        {open && item.children!.map(child => (
          <PickerNode
            key={child.id}
            item={child}
            depth={depth + 1}
            onSelect={onSelect}
            pinnedIds={pinnedIds}
          />
        ))}
      </div>
    );
  }

  const pinned = pinnedIds.has(item.id);
  return (
    <button
      onClick={() => !pinned && onSelect(item)}
      disabled={pinned}
      className={`flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-left transition-colors ${
        pinned
          ? "text-muted-foreground/50 cursor-default"
          : "hover:bg-accent"
      }`}
      style={{ paddingLeft: `${12 + depth * 14}px` }}
    >
      <Icon size={13} className={pinned ? "text-muted-foreground/40" : "text-muted-foreground"} />
      <span className="flex-1 truncate">{item.title}</span>
      {pinned && <Star size={10} className="text-amber-400 shrink-0" />}
    </button>
  );
};

// ── Componente principal ───────────────────────────────────────
const QuickAccessBar: React.FC = () => {
  const { openTab }                       = useAppContext();
  const { shortcuts, add, remove }        = useShortcuts();
  const [showPicker, setShowPicker]       = useState(false);
  const [editMode, setEditMode]           = useState(false);
  const [search, setSearch]               = useState("");
  const pickerRef                         = useRef<HTMLDivElement>(null);

  // Fecha picker ao clicar fora
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const pinnedIds  = new Set(shortcuts.map(s => s.id));

  // Filtra por busca (folhas apenas quando há texto)
  const searchResults = search.trim()
    ? ALL_LEAVES.filter(l => l.title.toLowerCase().includes(search.toLowerCase()))
    : null;

  const handleSelect = (item: MenuItem) => {
    add(item);
    // Não fecha — permite adicionar vários de uma vez
  };

  const handleShortcutClick = (sc: IShortcut) => {
    if (editMode) return;
    openTab({ title: sc.title, component: sc.id });
  };

  return (
    <div className="flex items-center gap-0.5 min-w-0 flex-1 overflow-hidden">

      {/* ── Atalhos pinados ───────────────────────────────────── */}
      {shortcuts.map(sc => {
        const leaf = ALL_LEAVES.find(l => l.id === sc.id);
        const Icon = leaf?.icon;
        return (
          <div key={sc.id} className="relative flex items-center group shrink-0">
            <button
              onClick={() => handleShortcutClick(sc)}
              title={sc.title}
              className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded transition-all text-topbar-foreground/80 hover:bg-foreground/10 hover:text-topbar-foreground whitespace-nowrap max-w-[130px]"
            >
              {Icon && <Icon size={13} className="shrink-0" />}
              <span className="truncate hidden lg:inline">{sc.title}</span>
            </button>

            {/* Botão remover — só aparece no hover ou modo edição */}
            {editMode ? (
              <button
                onClick={() => remove(sc.id)}
                title="Remover atalho"
                className="ml-0.5 text-rose-400 hover:text-rose-500 transition-colors"
              >
                <X size={11} />
              </button>
            ) : (
              <button
                onClick={() => remove(sc.id)}
                title="Remover atalho"
                className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 bg-rose-500 text-white rounded-full z-10"
              >
                <X size={8} />
              </button>
            )}
          </div>
        );
      })}

      {/* ── Divisor ───────────────────────────────────────────── */}
      {shortcuts.length > 0 && <div className="w-px h-4 bg-topbar-foreground/20 mx-1 shrink-0" />}

      {/* ── Botão adicionar atalho ────────────────────────────── */}
      <div className="relative shrink-0" ref={pickerRef}>
        <button
          onClick={() => { setShowPicker(p => !p); setSearch(""); }}
          title="Adicionar atalho de acesso rápido"
          className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded transition-all ${
            showPicker
              ? "bg-foreground/15 text-topbar-foreground"
              : "text-topbar-foreground/50 hover:bg-foreground/10 hover:text-topbar-foreground"
          }`}
        >
          <Star size={13} />
          {shortcuts.length === 0 && (
            <span className="hidden md:inline text-[11px]">Atalhos</span>
          )}
          <Plus size={10} />
        </button>

        {/* ── Dropdown picker ───────────────────────────────── */}
        {showPicker && (
          <div className="absolute left-0 top-full mt-1 w-64 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <Star size={13} className="text-amber-500 shrink-0" />
                <input
                  autoFocus
                  placeholder="Buscar ou navegar no menu..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Conteúdo */}
            <div className="max-h-72 overflow-y-auto py-1">
              {searchResults ? (
                // Modo busca: lista flat de folhas filtradas
                searchResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum item encontrado.</p>
                ) : (
                  searchResults.map(item => {
                    const pinned = pinnedIds.has(item.id);
                    const Icon   = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => !pinned && handleSelect(item)}
                        disabled={pinned}
                        className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors ${
                          pinned ? "text-muted-foreground/50 cursor-default" : "hover:bg-accent"
                        }`}
                      >
                        <Icon size={13} className={pinned ? "text-muted-foreground/40" : "text-muted-foreground"} />
                        <span className="flex-1 truncate">{item.title}</span>
                        {pinned && <Star size={10} className="text-amber-400" />}
                      </button>
                    );
                  })
                )
              ) : (
                // Modo árvore: menu hierárquico completo
                MENU_CONFIG.map(item => (
                  <PickerNode
                    key={item.id}
                    item={item}
                    onSelect={handleSelect}
                    pinnedIds={pinnedIds}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {shortcuts.length > 0 && (
              <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground">
                {shortcuts.length} atalho(s) • Passe o mouse sobre um atalho para remover
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickAccessBar;
