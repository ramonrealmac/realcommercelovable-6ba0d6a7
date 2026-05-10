import React, { useState, useMemo, useEffect } from "react";
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
  }) => React.ReactNode;
  XExtraTabs?: IExtraTab[];
  XExportTitle?: string;
  XAfterInsertTab?: string;
  XRefreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  XInitialId?: any;
}

function StandardCrudForm<T extends Record<string, any>>({
  config, XGridCols, renderCadastro, XExtraTabs = [], XExportTitle, XAfterInsertTab, XRefreshRef, XInitialId,
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

  const ctrl = useCrudController<any>(wrappedConfig);

  useEffect(() => {
    if (XRefreshRef) XRefreshRef.current = ctrl.loadData;
  }, [XRefreshRef, ctrl.loadData]);

  const XFilteredData = useGridFilter(ctrl.XData, XSearchFilters);

  useEffect(() => {
    if (XInitialId && ctrl.XData.length > 0) {
      const idx = ctrl.XData.findIndex(r => r[config.XPrimaryKey] === XInitialId);
      if (idx >= 0) {
        ctrl.setXCurrentIdx(idx);
        setXInnerTab("cadastro");
      }
    }
  }, [XInitialId, ctrl.XData, config.XPrimaryKey]);

  const handleSelectFromSearch = (row: any) => {
    const idx = ctrl.XData.findIndex(r => r[config.XPrimaryKey] === row[config.XPrimaryKey]);
    if (idx >= 0) { ctrl.setXCurrentIdx(idx); setXInnerTab("cadastro"); }
  };

  const handleSair = () => {
    const t = XTabs.find(t => t.id === XActiveTabId);
    if (t) closeTab(t.id);
  };

  const XTabsList = useMemo(
    () => [{ key: "cadastro", label: "Cadastro" }, ...XExtraTabs.map(t => ({ key: t.key, label: t.label })), { key: "localizar", label: "Localizar" }],
    [XExtraTabs]
  );

  const XActiveRecord: any = ctrl.XIsEditing ? ctrl.XEditRecord : (ctrl.XCurrentRecord || {});
  const XEffectiveCurrentRecord = ctrl.XFormMode === "insert" ? null : ctrl.XCurrentRecord;

  return (
    <div className="flex flex-col h-full bg-background" data-form-container>
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
        extras={(() => {
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
      />

      <div className="flex border-b border-border bg-card">
        {XTabsList.map(t => (
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
        })}

        {XExtraTabs.map(t => XInnerTab === t.key && (
          <div key={t.key}>{t.render({
            record: XActiveRecord,
            mode: ctrl.XFormMode,
            setField: ctrl.setField,
            setRecord: ctrl.setXEditRecord,
            isEditing: ctrl.XIsEditing,
            currentRecord: XEffectiveCurrentRecord,
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
