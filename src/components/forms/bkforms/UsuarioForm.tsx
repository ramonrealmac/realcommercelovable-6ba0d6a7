import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Plus, Save, Pencil, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  Trash2, RefreshCw, Search, List, HelpCircle, LogOut, KeyRound, Upload, Filter
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { usePerfis } from "@/hooks/useAccessControl";
import { dataStore } from "@/data/store";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
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

type TFormMode = "view" | "edit" | "insert";

const UsuarioForm: React.FC = () => {
  const { XEmpresaId, closeTab, XTabs, XActiveTabId } = useAppContext();
  const { XPerfis } = usePerfis(XEmpresaId);
  const XEmpresas = dataStore.getEmpresas();

  /* ── State ── */
  const [XFormMode, setXFormMode] = useState<TFormMode>("view");
  const [XInnerTab, setXInnerTab] = useState<"cadastro" | "localizar">("localizar");
  const [XUsers, setXUsers] = useState<IUserRow[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState(0);
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XSelectedGridIdx, setXSelectedGridIdx] = useState<number | null>(null);

  /* ── Edit fields ── */
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

  /* ── All perfis (for all empresas) ── */
  const [XAllPerfis, setXAllPerfis] = useState<{ perfil_id: number; nm_perfil: string; empresa_id: number; fl_administrador: boolean }[]>([]);

  const XCurrent = XUsers[XCurrentIdx] || null;
  const XIsEditing = XFormMode === "edit" || XFormMode === "insert";

  /* ── Load all perfis ── */
  const loadAllPerfis = useCallback(async () => {
    const { data } = await supabase
      .from("perfil")
      .select("perfil_id, nm_perfil, empresa_id, fl_administrador")
      .eq("fl_excluido", false)
      .order("empresa_id")
      .order("nm_perfil");
    setXAllPerfis(data || []);
  }, []);

  /* ── Load users linked to empresa ── */
  const loadData = useCallback(async () => {
    const { data: XEuData } = await supabase
      .from("empresa_usuario")
      .select("user_id")
      .eq("empresa_id", XEmpresaId)
      .eq("fl_excluido", false);

    if (!XEuData || XEuData.length === 0) {
      setXUsers([]);
      return;
    }

    const XUserIds = XEuData.map(eu => eu.user_id);

    const { data: XProfileData } = await (supabase as any)
      .from("profiles")
      .select("id, email, nm_usuario, ds_login, ds_foto")
      .in("id", XUserIds);

    setXUsers((XProfileData || []).map((p: any) => ({
      user_id: p.id,
      email: p.email || "",
      nm_usuario: p.nm_usuario || "",
      ds_login: p.ds_login || "",
      ds_foto: p.ds_foto || "",
    })));
  }, [XEmpresaId]);

  /* ── Load vinculos for current user ── */
  const loadVinculos = useCallback(async (XUserId: string) => {
    const { data } = await supabase
      .from("perfil_usuario")
      .select("perfil_usuario_id, empresa_id, perfil_id, perfil(nm_perfil)")
      .eq("user_id", XUserId)
      .eq("fl_excluido", false)
      .order("empresa_id");

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

  useEffect(() => { loadData(); loadAllPerfis(); }, [loadData, loadAllPerfis]);

  /* ── Sync current record to fields ── */
  useEffect(() => {
    if (XCurrent && XFormMode === "view") {
      setXNmUsuario(XCurrent.nm_usuario);
      setXDsLogin(XCurrent.ds_login);
      setXEmail(XCurrent.email);
      setXDsFoto(XCurrent.ds_foto);
      setXSenha("");
      loadVinculos(XCurrent.user_id);
    }
    if (!XCurrent) {
      setXVinculos([]);
    }
    setXSelectedVinculoIdx(null);
    setXVinculoEditMode("none");
  }, [XCurrent, XFormMode, loadVinculos]);

  /* ── Auth check ── */
  const ensureAuth = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { toast.error("Faça login primeiro."); return false; }
    return true;
  }, []);

  /* ── Photo upload ── */
  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const XFile = e.target.files?.[0];
    if (!XFile) return;

    const XMaxSize = 2 * 1024 * 1024; // 2MB
    if (XFile.size > XMaxSize) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }

    setXUploading(true);
    try {
      const XExt = XFile.name.split('.').pop() || 'jpg';
      const XFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${XExt}`;
      const XPath = `usuarios/${XFileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(XPath, XFile, { upsert: true });

      if (uploadErr) { toast.error("Erro no upload: " + uploadErr.message); return; }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(XPath);
      setXDsFoto(urlData.publicUrl);
      toast.success("Foto enviada com sucesso.");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setXUploading(false);
      if (XFileInputRef.current) XFileInputRef.current.value = "";
    }
  }, []);

  /* ── CRUD handlers ── */
  const handleInsert = () => {
    setXFormMode("insert");
    setXNmUsuario("");
    setXDsLogin("");
    setXEmail("");
    setXDsFoto("");
    setXSenha("");
    setXVinculos([]);
    setXInnerTab("cadastro");
  };

  const handleEdit = () => {
    if (!XCurrent) return;
    setXFormMode("edit");
    setXNmUsuario(XCurrent.nm_usuario);
    setXDsLogin(XCurrent.ds_login);
    setXEmail(XCurrent.email);
    setXDsFoto(XCurrent.ds_foto);
    setXSenha("");
    setXInnerTab("cadastro");
  };

  const handleCancel = () => {
    setXFormMode("view");
    if (XCurrent) {
      setXNmUsuario(XCurrent.nm_usuario);
      setXDsLogin(XCurrent.ds_login);
      setXEmail(XCurrent.email);
      setXDsFoto(XCurrent.ds_foto);
    }
    setXSenha("");
  };

  const handleSave = useCallback(async () => {
    if (!XEmail.trim()) { toast.error("E-mail é obrigatório."); return; }
    if (!(await ensureAuth())) return;

    if (XFormMode === "insert") {
      if (!XSenha || XSenha.length < 6) {
        toast.error("Informe uma senha com no mínimo 6 caracteres.");
        return;
      }

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: XEmail.trim(),
        password: XSenha,
        options: { emailRedirectTo: window.location.origin },
      });

      if (signUpErr) { toast.error("Erro ao criar usuário: " + signUpErr.message); return; }

      const XNewUserId = signUpData.user?.id;
      if (!XNewUserId) { toast.error("Erro: ID do usuário não retornado."); return; }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.warning("Sessão alterada. Faça login novamente.");
        return;
      }

      await (supabase as any).from("profiles").upsert({
        id: XNewUserId,
        email: XEmail.trim(),
        nm_usuario: XNmUsuario.trim(),
        ds_login: XDsLogin.trim(),
        ds_foto: XDsFoto.trim(),
      }, { onConflict: "id" });

      await supabase.from("empresa_usuario").insert({
        empresa_id: XEmpresaId,
        user_id: XNewUserId,
      });

      toast.success("Usuário criado e vinculado com sucesso.");
    } else if (XFormMode === "edit" && XCurrent) {
      const { error } = await (supabase as any).from("profiles")
        .update({
          nm_usuario: XNmUsuario.trim(),
          ds_login: XDsLogin.trim(),
          ds_foto: XDsFoto.trim(),
        })
        .eq("id", XCurrent.user_id);

      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
      toast.success("Usuário atualizado.");
    }

    setXFormMode("view");
    setXSenha("");
    await loadData();
  }, [XFormMode, XEmail, XSenha, XNmUsuario, XDsLogin, XDsFoto, XCurrent, XEmpresaId, ensureAuth, loadData]);

  const handleDelete = useCallback(async () => {
    if (!XCurrent) return;
    if (!(await ensureAuth())) return;
    if (!confirm(`Deseja remover "${XCurrent.nm_usuario || XCurrent.email}" da empresa?`)) return;

    await supabase.from("empresa_usuario")
      .update({ fl_excluido: true })
      .eq("empresa_id", XEmpresaId)
      .eq("user_id", XCurrent.user_id);

    await supabase.from("perfil_usuario")
      .update({ fl_excluido: true })
      .eq("empresa_id", XEmpresaId)
      .eq("user_id", XCurrent.user_id);

    toast.success("Usuário removido da empresa.");
    await loadData();
    if (XCurrentIdx > 0) setXCurrentIdx(XCurrentIdx - 1);
  }, [XCurrent, XEmpresaId, ensureAuth, loadData, XCurrentIdx]);

  const handleResetPassword = useCallback(async () => {
    if (!XCurrent?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(XCurrent.email, {
      redirectTo: window.location.origin,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`E-mail de redefinição enviado para ${XCurrent.email}`);
  }, [XCurrent]);

  /* ── Navigation ── */
  const handleFirst = () => setXCurrentIdx(0);
  const handlePrev = () => setXCurrentIdx(Math.max(0, XCurrentIdx - 1));
  const handleNext = () => setXCurrentIdx(Math.min(XUsers.length - 1, XCurrentIdx + 1));
  const handleLast = () => setXCurrentIdx(XUsers.length - 1);

  const handleRefresh = async () => {
    await loadData();
    await loadAllPerfis();
    toast.info("Dados recarregados.");
  };

  const handleSair = () => {
    const XTab = XTabs.find(t => t.id === XActiveTabId);
    if (XTab) closeTab(XTab.id);
  };

  /* ── Vinculo grid handlers (SubgrupoGrid pattern) ── */
  const XFilteredVinculos = XVinculos.filter(v => {
    const fe = XVinculoFilterValues["empresa_id"] || "";
    const fp = XVinculoFilterValues["nm_perfil"] || "";
    if (fe && !String(v.empresa_id).includes(fe)) return false;
    if (fp && !v.nm_perfil.toLowerCase().includes(fp.toLowerCase())) return false;
    return true;
  });

  const XSelectedVinculo = XSelectedVinculoIdx !== null ? XFilteredVinculos[XSelectedVinculoIdx] : null;

  const XPerfisForEmpresa = XAllPerfis.filter(p => p.empresa_id === XEditEmpresaId);

  const handleVinculoIncluir = () => {
    setXVinculoEditMode("insert");
    setXEditEmpresaId(XEmpresaId);
    setXEditPerfilId("");
  };

  const handleVinculoEditar = () => {
    if (!XSelectedVinculo) return;
    setXVinculoEditMode("edit");
    setXEditEmpresaId(XSelectedVinculo.empresa_id);
    setXEditPerfilId(XSelectedVinculo.perfil_id);
  };

  const handleVinculoSalvar = useCallback(async () => {
    if (!XEditPerfilId) { toast.error("Selecione um perfil."); return; }
    if (!XCurrent) return;
    if (!(await ensureAuth())) return;

    if (XVinculoEditMode === "insert") {
      // Check duplicate
      const XDup = XVinculos.find(v => v.perfil_id === Number(XEditPerfilId) && v.empresa_id === XEditEmpresaId);
      if (XDup) { toast.error("Este perfil já está vinculado nesta empresa."); return; }

      // Ensure user is linked to empresa
      const { data: euCheck } = await supabase
        .from("empresa_usuario")
        .select("empresa_usuario_id")
        .eq("empresa_id", XEditEmpresaId)
        .eq("user_id", XCurrent.user_id)
        .eq("fl_excluido", false)
        .maybeSingle();

      if (!euCheck) {
        await supabase.from("empresa_usuario").insert({
          empresa_id: XEditEmpresaId,
          user_id: XCurrent.user_id,
        });
      }

      const { error } = await supabase.from("perfil_usuario").insert({
        empresa_id: XEditEmpresaId,
        user_id: XCurrent.user_id,
        perfil_id: Number(XEditPerfilId),
      });
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Perfil vinculado.");
    } else if (XVinculoEditMode === "edit" && XSelectedVinculo) {
      const { error } = await supabase.from("perfil_usuario")
        .update({
          empresa_id: XEditEmpresaId,
          perfil_id: Number(XEditPerfilId),
        })
        .eq("perfil_usuario_id", XSelectedVinculo.perfil_usuario_id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Vínculo atualizado.");
    }

    setXVinculoEditMode("none");
    setXSelectedVinculoIdx(null);
    await loadVinculos(XCurrent.user_id);
  }, [XVinculoEditMode, XEditEmpresaId, XEditPerfilId, XCurrent, XVinculos, XSelectedVinculo, ensureAuth, loadVinculos]);

  const handleVinculoExcluir = useCallback(async () => {
    if (!XSelectedVinculo || !XCurrent) return;
    if (!(await ensureAuth())) return;
    if (!confirm("Remover este perfil do usuário?")) return;

    const { error } = await supabase.from("perfil_usuario")
      .update({ fl_excluido: true })
      .eq("perfil_usuario_id", XSelectedVinculo.perfil_usuario_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Perfil removido.");
    setXSelectedVinculoIdx(null);
    await loadVinculos(XCurrent.user_id);
  }, [XSelectedVinculo, XCurrent, ensureAuth, loadVinculos]);

  /* ── Localizar: select from grid ── */
  const handleSelectFromSearch = (_row: any, idx: number) => {
    setXCurrentIdx(idx);
    setXInnerTab("cadastro");
    setXFormMode("view");
  };

  // Use empresas from dataStore for the combo

  return (
    <div className="flex flex-col h-full bg-card">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card">
        {!XIsEditing ? (
          <>
            <ToolbarBtn icon={<Plus size={16} />} label="Incluir" onClick={handleInsert} color="success" />
            <ToolbarBtn icon={<Pencil size={16} />} label="Editar" onClick={handleEdit} disabled={!XCurrent} />
            <ToolbarSep />
            <ToolbarBtn icon={<ChevronsLeft size={16} />} label="Primeiro" onClick={handleFirst} disabled={XCurrentIdx === 0} />
            <ToolbarBtn icon={<ChevronLeft size={16} />} label="Anterior" onClick={handlePrev} disabled={XCurrentIdx === 0} />
            <ToolbarBtn icon={<ChevronRight size={16} />} label="Próximo" onClick={handleNext} disabled={XCurrentIdx >= XUsers.length - 1} />
            <ToolbarBtn icon={<ChevronsRight size={16} />} label="Último" onClick={handleLast} disabled={XCurrentIdx >= XUsers.length - 1} />
            <ToolbarSep />
            <ToolbarBtn icon={<Trash2 size={16} />} label="Excluir" onClick={handleDelete} disabled={!XCurrent} color="destructive" />
            <ToolbarBtn icon={<KeyRound size={16} />} label="Resetar Senha" onClick={handleResetPassword} disabled={!XCurrent} />
            <ToolbarBtn icon={<RefreshCw size={16} />} label="Recarregar" onClick={handleRefresh} />
            <ToolbarBtn icon={<Search size={16} />} label="Localizar" onClick={() => setXInnerTab("localizar")} />
            <ToolbarBtn icon={<List size={16} />} label="Log" onClick={() => toast.info("Log de operações")} />
            <ToolbarBtn icon={<HelpCircle size={16} />} label="Ajuda" onClick={() => toast.info("Ajuda do formulário")} />
            <ToolbarBtn icon={<LogOut size={16} />} label="Sair" onClick={handleSair} />
          </>
        ) : (
          <>
            <ToolbarBtn icon={<Save size={16} />} label="Salvar" onClick={handleSave} color="success" />
            <ToolbarBtn icon={<LogOut size={16} />} label="Cancelar" onClick={handleCancel} color="destructive" />
          </>
        )}
      </div>

      {/* ── Inner tabs ── */}
      <div className="flex border-b border-border bg-card">
        <button
          className={`px-4 py-1.5 text-sm font-medium border-b-2 ${
            XInnerTab === "cadastro" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setXInnerTab("cadastro")}
        >
          Cadastro
        </button>
        <button
          className={`px-4 py-1.5 text-sm font-medium border-b-2 ${
            XInnerTab === "localizar" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setXInnerTab("localizar")}
        >
          <Search size={14} className="inline mr-1" />Localizar
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-4">
        {XInnerTab === "cadastro" ? (
          <div className="space-y-4">
            {XCurrent && XFormMode === "view" && (
              <div className="text-xs text-muted-foreground">ID: {XCurrent.user_id.substring(0, 8)}...</div>
            )}

            {/* ── User fields ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              {/* Foto com upload */}
              <div className="md:col-span-2 flex items-center gap-4">
                <div className="shrink-0">
                  {XDsFoto ? (
                    <img
                      src={XDsFoto}
                      alt="Foto do usuário"
                      className="w-20 h-20 rounded-full object-cover border-2 border-border"
                      onError={e => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).className = "w-20 h-20 rounded-full bg-muted border-2 border-border flex items-center justify-center"; }}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-muted border-2 border-border flex items-center justify-center text-muted-foreground text-2xl font-bold">
                      {XNmUsuario ? XNmUsuario.charAt(0).toUpperCase() : "?"}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium text-muted-foreground">Foto do Usuário</label>
                  <input
                    ref={XFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={!XIsEditing || XUploading}
                    className="hidden"
                  />
                  <button
                    onClick={() => XFileInputRef.current?.click()}
                    disabled={!XIsEditing || XUploading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Upload size={14} />
                    {XUploading ? "Enviando..." : "Upload Foto"}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Nome do Usuário
                </label>
                <input
                  type="text"
                  value={XNmUsuario}
                  onChange={e => setXNmUsuario(e.target.value)}
                  disabled={!XIsEditing}
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:bg-secondary disabled:cursor-not-allowed"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Login
                </label>
                <input
                  type="text"
                  value={XDsLogin}
                  onChange={e => setXDsLogin(e.target.value)}
                  disabled={!XIsEditing}
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:bg-secondary disabled:cursor-not-allowed"
                  placeholder="Login do usuário (ou use o e-mail)"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  E-mail <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={XEmail}
                  onChange={e => setXEmail(e.target.value)}
                  disabled={!XIsEditing || XFormMode === "edit"}
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:bg-secondary disabled:cursor-not-allowed"
                  placeholder="usuario@empresa.com"
                />
              </div>

              {XFormMode === "insert" && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Senha <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="password"
                    value={XSenha}
                    onChange={e => setXSenha(e.target.value)}
                    className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}
            </div>

            {/* ── Vinculos sub-grid (padrão SubgrupoGrid) ── */}
            {XCurrent && XFormMode !== "insert" && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Empresas e Perfis Vinculados
                </div>

                {/* Grid toolbar */}
                <div className="flex items-center gap-1">
                  <GridBtn icon={<Plus size={14} />} label="Incluir" onClick={handleVinculoIncluir} color="success" />
                  <GridBtn icon={<Pencil size={14} />} label="Alterar" onClick={handleVinculoEditar} disabled={!XSelectedVinculo} color="primary" />
                  <GridBtn icon={<Trash2 size={14} />} label="Excluir" onClick={handleVinculoExcluir} disabled={!XSelectedVinculo} color="destructive" />
                  <GridBtn icon={<RefreshCw size={14} />} label="Atualizar" onClick={() => XCurrent && loadVinculos(XCurrent.user_id)} />
                  <GridBtn icon={<Filter size={14} />} label="Filtrar" onClick={() => setXShowVinculoFilters(!XShowVinculoFilters)} active={XShowVinculoFilters} />
                </div>

                {/* Inline edit row */}
                {XVinculoEditMode !== "none" && (
                  <div className="flex items-center gap-2 p-2 bg-accent rounded border border-border flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground w-16">
                      {XVinculoEditMode === "insert" ? "Novo:" : "Editar:"}
                    </span>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Empresa</label>
                      <select
                        value={XEditEmpresaId}
                        onChange={e => { setXEditEmpresaId(Number(e.target.value)); setXEditPerfilId(""); }}
                        className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring"
                      >
                        {XEmpresas.map(e => (
                          <option key={e.EMPRESA_ID} value={e.EMPRESA_ID}>{e.NM_RAZAO_SOCIAL}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Perfil</label>
                      <select
                        value={XEditPerfilId}
                        onChange={e => setXEditPerfilId(e.target.value ? Number(e.target.value) : "")}
                        className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring min-w-[180px]"
                      >
                        <option value="">Selecione...</option>
                        {XPerfisForEmpresa.map(p => (
                          <option key={p.perfil_id} value={p.perfil_id}>
                            {p.nm_perfil} {p.fl_administrador ? "(Admin)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end gap-1 ml-auto">
                      <button onClick={handleVinculoSalvar} className="px-3 py-1 text-xs bg-success text-success-foreground rounded hover:opacity-90">
                        Salvar
                      </button>
                      <button onClick={() => setXVinculoEditMode("none")} className="px-3 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:opacity-90">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <DataGrid
                  columns={XVinculoColumns}
                  data={XFilteredVinculos}
                  selectedIdx={XSelectedVinculoIdx}
                  onRowClick={(_, idx) => setXSelectedVinculoIdx(idx)}
                  onRowDoubleClick={(_, idx) => {
                    setXSelectedVinculoIdx(idx);
                    const v = XFilteredVinculos[idx];
                    if (v) {
                      setXVinculoEditMode("edit");
                      setXEditEmpresaId(v.empresa_id);
                      setXEditPerfilId(v.perfil_id);
                    }
                  }}
                  showFilters={XShowVinculoFilters}
                  filterValues={XVinculoFilterValues}
                  onFilterChange={(k, v) => setXVinculoFilterValues(prev => ({ ...prev, [k]: v }))}
                  maxHeight="200px"
                  exportTitle="Vínculos do Usuário"
                />
              </div>
            )}
          </div>
        ) : (
          /* ── Localizar ── */
          <DataGrid
            columns={XLocalizarColumns}
            data={XUsers}
            selectedIdx={XSelectedGridIdx}
            onRowClick={(_, idx) => { setXSelectedGridIdx(idx); setXCurrentIdx(idx); }}
            onRowDoubleClick={handleSelectFromSearch}
            showFilters
            filterValues={XSearchFilters}
            onFilterChange={(k, v) => setXSearchFilters(prev => ({ ...prev, [k]: v }))}
            maxHeight="400px"
            exportTitle="Usuários"
          />
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-border bg-muted text-xs text-muted-foreground shrink-0">
        <span>Total: {XUsers.length} registro(s) | Vínculos: {XVinculos.length}</span>
        <span>{XFormMode === "insert" ? "Incluindo" : XFormMode === "edit" ? "Editando" : "Visualizando"}</span>
      </div>
    </div>
  );
};

/* ── Toolbar helpers ── */
const ToolbarBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: "success" | "destructive" | "default";
}> = ({ icon, label, onClick, disabled, color = "default" }) => {
  const XColorClass =
    color === "success" ? "text-success hover:bg-success/10" :
    color === "destructive" ? "text-destructive hover:bg-destructive/10" :
    "text-foreground hover:bg-accent";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-1.5 rounded transition-colors ${XColorClass} ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
    >
      {icon}
    </button>
  );
};

const ToolbarSep = () => <div className="w-px h-5 bg-border mx-0.5" />;

const GridBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
  active?: boolean;
}> = ({ icon, label, onClick, disabled, color = "default", active }) => {
  const XColorMap: Record<string, string> = {
    success: "bg-success text-success-foreground hover:opacity-90",
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
    default: `bg-secondary text-secondary-foreground hover:bg-accent ${active ? "ring-2 ring-ring" : ""}`,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-1.5 rounded transition-colors ${XColorMap[color] || XColorMap.default} ${
        disabled ? "opacity-30 cursor-not-allowed" : ""
      }`}
    >
      {icon}
    </button>
  );
};

export default UsuarioForm;
