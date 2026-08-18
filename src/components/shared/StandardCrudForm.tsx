import React, { useState, useMemo, useEffect, useRef } from "react";
import FormToolbar from "@/components/shared/FormToolbar";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { useCrudController, ICrudConfig, TFormMode } from "@/hooks/useCrudController";
import { useGridFilter } from "@/hooks/useGridFilter";
import { useAppContext } from "@/contexts/AppContext";
import RpbFormReportsButton from "@/report-builder/components/executor/RpbFormReportsButton";

export interface IExtraTab {
  key: string;
  label: string;
  render: (ctx: {
    record: any;
    mode: TFormMode;
    setField: <K extends string>(k: K, v: any) => void;
    setRecord: (r: any) => void;
    isEditing: boolean;
    currentRecord: any | null;
    setInnerTab: (tab: string) => void;
  }) => React.ReactNode;
}

interface StandardCrudFormProps<T extends Record<string, any>> {
  config: ICrudConfig<any>;
  XGridCols: IGridColumn[];
  renderCadastro: (ctx: {
    record: any;
    setField: (k: string, v: any) => void;
    setRecord: (r: any) => void;
    mode: TFormMode;
    isEditing: boolean;
    currentRecord: any | null;
    setInnerTab: (tab: string) => void;
    onSalvar?: () => Promise<void>;
    handleIncluir?: () => void;
    data?: T[];
  }) => React.ReactNode;
  XExtraTabs?: IExtraTab[];
  XExportTitle?: string;
  XAfterInsertTab?: string;
  XRefreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  XInitialId?: any;
  XToolbarExtras?: (ctx: {
    currentRecord: any;
    isEditing: boolean;
    setRecord: (r: any) => void;
    refresh: () => Promise<void>;
    setInnerTab: (tab: string) => void;
    handleIncluir: () => void;
  }) => React.ReactNode;
  XHiddenTabs?: string[] | ((record: any) => string[]);
  XCadastroLabel?: string;
  XCtrl?: any;
}

function StandardCrudForm<T extends Record<string, any>>({
  config, XGridCols, renderCadastro, XExtraTabs = [], XExportTitle, XAfterInsertTab, XRefreshRef, XInitialId, XToolbarExtras, XHiddenTabs = [], XCadastroLabel = "Cadastro", XCtrl
}: StandardCrudFormProps<T>) {
  const { closeTab, XTabs, XActiveTabId } = useAppContext();
  const [XInnerTab, setXInnerTab] = useState<string>("cadastro");
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  
  const wrappedConfig = useMemo(() => ({
    ...config,
    XOnAfterSave: async (rec: any, mode: any) => {
      if (config.XOnAfterSave) await config.XOnAfterSave(rec, mode);
      if (mode === "insert" && XAfterInsertTab) setXInnerTab(XAfterInsertTab);
    },
  }), [config, XAfterInsertTab]);

  const ctrl = XCtrl || useCrudController<any>(wrappedConfig);

  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts listener for the registration screen
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Only proceed if this component is visible in the DOM (not hidden in a tab)
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // 2. Ignore if a dialog or alertdialog modal is open (e.g. search filters, search dialogs, confirmation dialogs)
      if (document.querySelector('[role="dialog"]') !== null || document.querySelector('[role="alertdialog"]') !== null) {
        return;
      }

      // 3. Ignore if key is pressed with modifier keys (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT" ||
        activeElement.getAttribute("contenteditable") === "true"
      );

      // In NAVIGATION (VIEW) mode:
      if (!ctrl.XIsEditing) {
        // If typing in search filters or any other field, ignore navigation shortcuts
        if (isTyping) {
          return;
        }

        if (e.key === "+") {
          e.preventDefault();
          ctrl.handleIncluir();
          setXInnerTab("cadastro");
        } else if (e.key === "*") {
          e.preventDefault();
          ctrl.handleEditar();
          setXInnerTab("cadastro");
        } else if (e.key === "-") {
          e.preventDefault();
          ctrl.handleExcluir();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          ctrl.handleNext();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          ctrl.handlePrev();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          ctrl.handleFirst();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          ctrl.handleLast();
        }
      } 
      // In EDIT/INSERT mode:
      else {
        // Always trigger save (+) and cancel (*) shortcuts even if focused on an input
        if (e.key === "+") {
          e.preventDefault();
          ctrl.handleSalvar();
        } else if (e.key === "*") {
          e.preventDefault();
          ctrl.handleCancelar();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    ctrl.XIsEditing,
    ctrl.handleIncluir,
    ctrl.handleEditar,
    ctrl.handleExcluir,
    ctrl.handleSalvar,
    ctrl.handleCancelar,
    ctrl.handleFirst,
    ctrl.handlePrev,
    ctrl.handleNext,
    ctrl.handleLast,
    setXInnerTab
  ]);

  useEffect(() => {
    if (XRefreshRef) XRefreshRef.current = ctrl.loadData;
  }, [XRefreshRef, ctrl.loadData]);

  const XFilteredData = useGridFilter(ctrl.XData, XSearchFilters, XGridCols);

  const initialIdLoadedRef = useRef<any>(null);

  useEffect(() => {
    if (XInitialId !== undefined && XInitialId !== null && String(XInitialId) !== String(initialIdLoadedRef.current)) {
      if (ctrl.XData.length > 0) {
        const idx = ctrl.XData.findIndex(r => String(r[config.XPrimaryKey]) === String(XInitialId));
        if (idx >= 0) {
          initialIdLoadedRef.current = XInitialId;
          ctrl.setXCurrentIdx(idx);
          ctrl.setXFormMode("view");
          setXInnerTab("cadastro");
        } else {
          // Se não encontrou na lista carregada, busca o registro específico direto no banco pelo ID
          (async () => {
            try {
              let q = (supabase as any)
                .from(config.XTableName)
                .select(config.XSelectCols || "*")
                .eq(config.XPrimaryKey, XInitialId);
              if (config.XSoftDelete !== false) q = q.eq("excluido", false);
              
              const { data, error } = await q.maybeSingle();
              if (data && !error) {
                initialIdLoadedRef.current = XInitialId;
                ctrl.setXData((prev: any[]) => [data, ...prev.filter((r: any) => String(r[config.XPrimaryKey]) !== String(XInitialId))]);
                ctrl.setXCurrentIdx(0);
                ctrl.setXFormMode("view");
                setXInnerTab("cadastro");
                config.XOnAfterLoad?.([data]);
              }
            } catch (err) {
              console.error("Erro ao carregar registro inicial:", err);
            }
          })();
        }
      }
    }
  }, [XInitialId, ctrl.XData, config.XPrimaryKey, config.XTableName, config.XSelectCols, config.XSoftDelete, config.XOnAfterLoad, ctrl.setXCurrentIdx, ctrl.setXFormMode, ctrl.setXData]);

  const handleSelectFromSearch = (row: any) => {
    if (config.XConfirmDiscardOnSelect && ctrl.XIsEditing) {
      const confirmDiscard = window.confirm(
        "Você possui alterações não salvas. Deseja realmente descartar e visualizar o registro selecionado?"
      );
      if (!confirmDiscard) return;
    }
    const idx = ctrl.XData.findIndex(r => String(r[config.XPrimaryKey]) === String(row[config.XPrimaryKey]));
    if (idx >= 0) {
      ctrl.setXCurrentIdx(idx);
      if (config.XResetModeOnSelect) {
        ctrl.setXFormMode("view");
      }
      setXInnerTab("cadastro");
    }
  };

  const handleSair = () => {
    const t = XTabs.find(t => t.id === XActiveTabId);
    if (t) closeTab(t.id);
  };

  const XTabsList = useMemo(
    () => [{ key: "cadastro", label: XCadastroLabel }, ...XExtraTabs.map(t => ({ key: t.key, label: t.label })), { key: "localizar", label: "Localizar" }],
    [XExtraTabs, XCadastroLabel]
  );

  const XActiveRecord: any = ctrl.XIsEditing ? ctrl.XEditRecord : (ctrl.XCurrentRecord || {});
  const XEffectiveCurrentRecord = ctrl.XFormMode === "insert" ? null : ctrl.XCurrentRecord;

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-background" data-form-container>
      <FormToolbar
        XIsEditing={ctrl.XIsEditing}
        XHasRecord={!!ctrl.XCurrentRecord}
        XIsFirst={ctrl.XCurrentIdx === 0}
        XIsLast={ctrl.XCurrentIdx >= ctrl.XData.length - 1}
        onIncluir={() => { ctrl.handleIncluir(); setXInnerTab("cadastro"); }}
        onEditar={() => { ctrl.handleEditar(); setXInnerTab("cadastro"); }}
        XCanEdit={ctrl.XCurrentRecord && config.XCanEdit ? config.XCanEdit(ctrl.XCurrentRecord) : true}
        onSalvar={ctrl.handleSalvar}
        onCancelar={ctrl.handleCancelar}
        onExcluir={ctrl.handleExcluir}
        onFirst={ctrl.handleFirst}
        onPrev={ctrl.handlePrev}
        onNext={ctrl.handleNext}
        onLast={ctrl.handleLast}
        onRefresh={ctrl.handleRefresh}
        onLocalizar={() => setXInnerTab("localizar")}
        onSair={handleSair}
        extras={(
          <div className="flex items-center gap-1">
            {XToolbarExtras && XToolbarExtras({
              currentRecord: ctrl.XCurrentRecord,
              isEditing: ctrl.XIsEditing,
              setRecord: ctrl.setXEditRecord,
              refresh: ctrl.loadData,
              setInnerTab: setXInnerTab,
              handleIncluir: () => { ctrl.handleIncluir(); setXInnerTab("cadastro"); }
            })}
            {(() => {
              const activeTab = XTabs.find(t => t.id === XActiveTabId);
              const actualNmForm = config.XNmForm || activeTab?.component;
              if (!actualNmForm || !ctrl.XCurrentRecord) return null;
              
              return (
                <RpbFormReportsButton 
                  nmForm={actualNmForm} 
                  currentRecord={ctrl.XCurrentRecord} 
                  variant="ghost"
                />
              );
            })()}
          </div>
        )}
      />

      <div className="flex border-b border-border bg-card">
        {XTabsList.filter(t => {
          const hidden = typeof XHiddenTabs === "function" ? XHiddenTabs(XActiveRecord) : XHiddenTabs;
          return !hidden.includes(t.key);
        }).map(t => (
          <button
            key={t.key}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              XInnerTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setXInnerTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6 bg-card">
        {XInnerTab === "cadastro" && renderCadastro({
          record: XActiveRecord,
          setField: ctrl.setField,
          setRecord: ctrl.setXEditRecord,
          mode: ctrl.XFormMode,
          isEditing: ctrl.XIsEditing,
          currentRecord: XEffectiveCurrentRecord,
          setInnerTab: setXInnerTab,
          onSalvar: ctrl.handleSalvar,
          handleIncluir: () => { ctrl.handleIncluir(); setXInnerTab("cadastro"); },
          data: ctrl.XData
        })}

        {XExtraTabs.map(t => XInnerTab === t.key && (
          <div key={t.key}>{t.render({
            record: XActiveRecord,
            mode: ctrl.XFormMode,
            setField: ctrl.setField,
            setRecord: ctrl.setXEditRecord,
            isEditing: ctrl.XIsEditing,
            currentRecord: XEffectiveCurrentRecord,
            setInnerTab: setXInnerTab
          })}</div>
        ))}

        {XInnerTab === "localizar" && (
          <DataGrid
            columns={XGridCols}
            data={XFilteredData}
            showFilters
            filterValues={XSearchFilters}
            onFilterChange={(k, v) => setXSearchFilters(prev => ({ ...prev, [k]: v }))}
            onRowDoubleClick={handleSelectFromSearch}
            maxHeight="500px"
            exportTitle={XExportTitle || config.XTitle}
          />
        )}
      </div>
    </div>
  );
}

export default StandardCrudForm;
