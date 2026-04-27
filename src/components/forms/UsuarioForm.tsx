import React, { useState, useCallback, useEffect, useRef } from "react";
import { Plus, SquarePen, Trash2, RefreshCw, Filter, KeyRound, Upload } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { usePerfis } from "@/hooks/useAccessControl";
import { dataStore } from "@/data/store";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { useCrudController } from "@/hooks/useCrudController";
import { toast } from "sonner";

/* ── Types ── */
interface IUserRow {
  user_id: string;
  email: string;
  nm_usuario: string;
  ds_login: string;
  ds_foto: string;
}

interface IVinculoRow {
  perfil_usuario_id: number;
  empresa_id: number;
  perfil_id: number;
  nm_perfil: string;
  nm_empresa: string;
}

/* ── Grid columns ── */
const XLocalizarColumns: IGridColumn[] = [
  { key: "email", label: "E-mail", width: "1fr" },
  { key: "nm_usuario", label: "Nome", width: "1fr" },
  { key: "ds_login", label: "Login", width: "120px" },
];

const XVinculoColumns: IGridColumn[] = [
  { key: "nm_empresa", label: "Empresa", width: "200px" },
  { key: "nm_perfil", label: "Perfil", width: "1fr" },
];

const UsuarioForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  const { XPerfis } = usePerfis(XEmpresaId);
  const XEmpresas = dataStore.getEmpresas();

  /* ── CRUD Controller ── */
  const ctrl = useCrudController<IUserRow>({
    tableName: "profiles",
    empresaFieldName: "id",
  });

  /* ── State ── */
  const [XNmUsuario, setXNmUsuario] = useState("");
  const [XDsLogin, setXDsLogin] = useState("");
  const [XEmail, setXEmail] = useState("");
  const [XDsFoto, setXDsFoto] = useState("");
  const [XSenha, setXSenha] = useState("");
  const [XUploading, setXUploading] = useState(false);
  const XFileInputRef = useRef<HTMLInputElement>(null);

  /* ── Vinculos sub-grid ── */
  const [XVinculos, setXVinculos] = useState<IVinculoRow[]>([]);
  const [XSelectedVinculoIdx, setXSelectedVinculoIdx] = useState<number | null>(null);
  const [XVinculoFilterValues, setXVinculoFilterValues] = useState<Record<string, string>>({});
  const [XShowVinculoFilters, setXShowVinculoFilters] = useState(false);
  const [XVinculoEditMode, setXVinculoEditMode] = useState<"none" | "insert" | "edit">("none");
  const [XEditEmpresaId, setXEditEmpresaId] = useState<number>(XEmpresaId);
  const [XEditPerfilId, setXEditPerfilId] = useState<number | "">("");

  const [XAllPerfis, setXAllPerfis] = useState<{ perfil_id: number; nm_perfil: string; empresa_id: number; fl_administrador: boolean }[]>([]);

  /* ── Load data ── */
  const loadData = useCallback(async () => {
    const { data: XEuData } = await supabase.from("empresa_usuario").select("user_id").eq("empresa_id", XEmpresaId).eq("fl_excluido", false);
    if (!XEuData || XEuData.length === 0) { ctrl.setXData([]); return; }
    const XUserIds = XEuData.map(eu => eu.user_id);
    const { data: XProfileData } = await (supabase as any).from("profiles").select("id, email, nm_usuario, ds_login, ds_foto").in("id", XUserIds);
    const XRows = (XProfileData || []).map((p: any) => ({
      user_id: p.id,
      email: p.email || "",
      nm_usuario: p.nm_usuario || "",
      ds_login: p.ds_login || "",
      ds_foto: p.ds_foto || "",
    }));
    ctrl.setXData(XRows);
  }, [XEmpresaId, ctrl.setXData]);

  const loadAllPerfis = useCallback(async () => {
    const { data } = await supabase.from("perfil").select("perfil_id, nm_perfil, empresa_id, fl_administrador").eq("fl_excluido", false).order("empresa_id").order("nm_perfil");
    setXAllPerfis(data || []);
  }, []);

  const loadVinculos = useCallback(async (XUserId: string) => {
    const { data } = await supabase.from("perfil_usuario").select("perfil_usuario_id, empresa_id, perfil_id, perfil(nm_perfil)").eq("user_id", XUserId).eq("fl_excluido", false).order("empresa_id");
    if (!data) { setXVinculos([]); return; }
    const XEmpList = dataStore.getEmpresas();
    setXVinculos(data.map((pu: any) => {
      const XEmp = XEmpList.find(e => e.EMPRESA_ID === pu.empresa_id);
      return {
        perfil_usuario_id: pu.perfil_usuario_id,
        empresa_id: pu.empresa_id,
        perfil_id: pu.perfil_id,
        nm_perfil: pu.perfil?.nm_perfil || "",
        nm_empresa: XEmp?.NM_RAZAO_SOCIAL || `Empresa ${pu.empresa_id}`,
      };
    }));
  }, []);

  useEffect(() => { loadData(); loadAllPerfis(); }, [XEmpresaId]);

  /* ── Sync current record ── */
  useEffect(() => {
    if (ctrl.XCurrentRecord && ctrl.XFormMode === "view") {
      setXNmUsuario(ctrl.XCurrentRecord.nm_usuario);
      setXDsLogin(ctrl.XCurrentRecord.ds_login);
      setXEmail(ctrl.XCurrentRecord.email);
      setXDsFoto(ctrl.XCurrentRecord.ds_foto);
      setXSenha("");
      loadVinculos(ctrl.XCurrentRecord.user_id);
    } else if (ctrl.XFormMode === "insert") {
      setXNmUsuario(""); setXDsLogin(""); setXEmail(""); setXDsFoto(""); setXSenha(""); setXVinculos([]);
    }
  }, [ctrl.XCurrentRecord, ctrl.XFormMode, loadVinculos]);

  /* ── Handlers ── */
  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const XFile = e.target.files?.[0];
    if (!XFile) return;
    setXUploading(true);
    try {
      const XExt = XFile.name.split('.').pop() || 'jpg';
      const XFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${XExt}`;
      const XPath = `usuarios/${XFileName}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(XPath, XFile, { upsert: true });
      if (uploadErr) { toast.error("Erro no upload: " + uploadErr.message); return; }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(XPath);
      setXDsFoto(urlData.publicUrl);
      toast.success("Foto enviada com sucesso.");
    } finally {
      setXUploading(false);
      if (XFileInputRef.current) XFileInputRef.current.value = "";
    }
  }, []);

  const handleSalvar = async () => {
    if (!XEmail.trim()) { toast.error("E-mail é obrigatório."); return; }
    if (ctrl.XFormMode === "insert") {
      if (!XSenha || XSenha.length < 6) { toast.error("Informe uma senha com no mínimo 6 caracteres."); return; }
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email: XEmail.trim(), password: XSenha });
      if (signUpErr) { toast.error("Erro ao criar usuário: " + signUpErr.message); return; }
      const XNewUserId = signUpData.user?.id;
      if (!XNewUserId) return;
      await (supabase as any).from("profiles").upsert({ id: XNewUserId, email: XEmail.trim(), nm_usuario: XNmUsuario.trim(), ds_login: XDsLogin.trim(), ds_foto: XDsFoto.trim() }, { onConflict: "id" });
      await supabase.from("empresa_usuario").insert({ empresa_id: XEmpresaId, user_id: XNewUserId });
      toast.success("Usuário criado com sucesso.");
    } else if (ctrl.XFormMode === "edit" && ctrl.XCurrentRecord) {
      const { error } = await (supabase as any).from("profiles").update({ nm_usuario: XNmUsuario.trim(), ds_login: XDsLogin.trim(), ds_foto: XDsFoto.trim() }).eq("id", ctrl.XCurrentRecord.user_id);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
      toast.success("Usuário atualizado.");
    }
    ctrl.setXFormMode("view");
    await loadData();
  };

  const handleExcluir = async () => {
    if (!ctrl.XCurrentRecord) return;
    if (!confirm(`Deseja remover "${ctrl.XCurrentRecord.nm_usuario || ctrl.XCurrentRecord.email}" da empresa?`)) return;
    await supabase.from("empresa_usuario").update({ fl_excluido: true }).eq("empresa_id", XEmpresaId).eq("user_id", ctrl.XCurrentRecord.user_id);
    toast.success("Usuário removido da empresa.");
    await loadData();
  };

  /* ── Vinculo Handlers ── */
  const handleVinculoSalvar = async () => {
    if (!XEditPerfilId || !ctrl.XCurrentRecord) return;
    const XPay = { empresa_id: XEditEmpresaId, user_id: ctrl.XCurrentRecord.user_id, perfil_id: Number(XEditPerfilId) };
    if (XVinculoEditMode === "insert") {
      const { error } = await supabase.from("perfil_usuario").insert(XPay);
      if (error) { toast.error("Erro: " + error.message); return; }
    } else if (XVinculoEditMode === "edit" && XSelectedVinculoIdx !== null) {
      await supabase.from("perfil_usuario").update(XPay).eq("perfil_usuario_id", XVinculos[XSelectedVinculoIdx].perfil_usuario_id);
    }
    setXVinculoEditMode("none");
    loadVinculos(ctrl.XCurrentRecord.user_id);
  };

  const handleVinculoExcluir = async () => {
    if (XSelectedVinculoIdx === null || !ctrl.XCurrentRecord) return;
    await supabase.from("perfil_usuario").update({ fl_excluido: true }).eq("perfil_usuario_id", XVinculos[XSelectedVinculoIdx].perfil_usuario_id);
    toast.success("Vínculo removido.");
    loadVinculos(ctrl.XCurrentRecord.user_id);
  };

  const renderCadastro = () => (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-6 p-4 bg-white/40 dark:bg-slate-900/40 rounded-lg border border-border/40">
        <div className="relative group">
          {XDsFoto ? (
            <img src={XDsFoto} alt="Foto" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 border-4 border-white flex items-center justify-center text-3xl font-bold text-slate-400">
              {XNmUsuario ? XNmUsuario.charAt(0).toUpperCase() : "?"}
            </div>
          )}
          {ctrl.XIsEditing && (
            <button 
              onClick={() => XFileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white"
            >
              <Upload size={20} />
            </button>
          )}
          <input ref={XFileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{XNmUsuario || "Novo Usuário"}</h3>
          <p className="text-sm text-slate-500">{XEmail || "E-mail não informado"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Nome Completo</label>
          <input type="text" value={XNmUsuario} onChange={e => setXNmUsuario(e.target.value)} disabled={!ctrl.XIsEditing} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:bg-slate-100" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Login / Usuário</label>
          <input type="text" value={XDsLogin} onChange={e => setXDsLogin(e.target.value)} disabled={!ctrl.XIsEditing} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:bg-slate-100" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">E-mail de Acesso</label>
          <input type="email" value={XEmail} onChange={e => setXEmail(e.target.value)} disabled={!ctrl.XIsEditing || ctrl.XFormMode === "edit"} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:bg-slate-100" />
        </div>
        {ctrl.XFormMode === "insert" && (
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Senha Inicial</label>
            <input type="password" value={XSenha} onChange={e => setXSenha(e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" placeholder="Mínimo 6 caracteres" />
          </div>
        )}
      </div>

      {ctrl.XCurrentRecord && ctrl.XFormMode !== "insert" && (
        <div className="space-y-3 pt-4 border-t border-border">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <KeyRound size={14} className="text-amber-500" /> Empresas e Permissões
          </h4>
          
          <div className="flex items-center gap-1">
            <GridActionToolbar
              actions={[
                gridActions.incluir(() => setXVinculoEditMode("insert")),
                gridActions.alterar(() => setXVinculoEditMode("edit"), XSelectedVinculoIdx === null),
                null,
                gridActions.excluir(() => { if (confirm("Remover vínculo?")) handleVinculoExcluir(); }, XSelectedVinculoIdx === null),
                gridActions.atualizar(() => loadVinculos(ctrl.XCurrentRecord!.user_id)),
                gridActions.filtro(() => setXShowVinculoFilters(!XShowVinculoFilters), XShowVinculoFilters),
              ]}
            />
          </div>

          {XVinculoEditMode !== "none" && (
            <div className="flex items-end gap-3 p-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-border/60">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Empresa</label>
                <select value={XEditEmpresaId} onChange={e => setXEditEmpresaId(Number(e.target.value))} className="w-full border border-border rounded-md px-2 py-1.5 text-xs bg-card outline-none focus:ring-2 focus:ring-ring">
                  {XEmpresas.map(e => <option key={e.EMPRESA_ID} value={e.EMPRESA_ID}>{e.NM_RAZAO_SOCIAL}</option>)}
                </select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Perfil de Acesso</label>
                <select value={XEditPerfilId} onChange={e => setXEditPerfilId(Number(e.target.value))} className="w-full border border-border rounded-md px-2 py-1.5 text-xs bg-card outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Selecione...</option>
                  {XAllPerfis.filter(p => p.empresa_id === XEditEmpresaId).map(p => <option key={p.perfil_id} value={p.perfil_id}>{p.nm_perfil}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleVinculoSalvar} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-transparent text-emerald-600 hover:bg-accent transition-all hover:scale-105">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Salvar
                </button>
                <button onClick={() => setXVinculoEditMode("none")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-transparent text-rose-600 hover:bg-accent transition-all hover:scale-105">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Cancelar
                </button>
              </div>
            </div>
          )}

          <DataGrid
            columns={XVinculoColumns}
            data={XVinculos}
            selectedIdx={XSelectedVinculoIdx}
            onRowClick={(_, i) => setXSelectedVinculoIdx(i)}
            showFilters={XShowVinculoFilters}
            filterValues={XVinculoFilterValues}
            onFilterChange={(k, v) => setXVinculoFilterValues(p => ({ ...p, [k]: v }))}
            maxHeight="200px"
          />
        </div>
      )}
    </div>
  );

  return (
    <StandardCrudForm
      ctrl={ctrl}
      title="Gestão de Usuários"
      onSalvar={handleSalvar}
      onExcluir={handleExcluir}
      onRefresh={loadData}
      renderCadastro={renderCadastro}
      localizarColumns={XLocalizarColumns}
    />
  );
};

export default UsuarioForm;
