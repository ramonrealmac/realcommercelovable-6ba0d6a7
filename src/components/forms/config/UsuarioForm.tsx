import React, { useState, useCallback, useEffect, useRef } from "react";
import { KeyRound, Upload } from "lucide-react";
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
  id: string;
  email: string;
  nm_usuario: string;
  ds_login: string;
  ds_foto: string;
  fl_autorizado: boolean;
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
  { 
    key: "fl_autorizado", 
    label: "Status", 
    width: "100px",
    render: (row: any) => (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${row.fl_autorizado ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'}`}>
        {row.fl_autorizado ? 'Liberado' : 'Pendente'}
      </span>
    )
  },
];

const XVinculoColumns: IGridColumn[] = [
  { key: "nm_empresa", label: "Empresa", width: "200px" },
  { key: "nm_perfil", label: "Perfil", width: "1fr" },
];

const UsuarioForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  const XEmpresas = dataStore.getEmpresas();

  /* ── State ── */
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

  /* ── CRUD Controller ── */
  const ctrl = useCrudController<IUserRow>({
    XTableName: "profiles",
    XPrimaryKey: "id",
    XTitle: "Gestão de Usuários",
    XDefaultRecord: { id: "", email: "", nm_usuario: "", ds_login: "", ds_foto: "", fl_autorizado: true },
    XSoftDelete: false,
    XSelectCols: "id, email, nm_usuario, ds_login, ds_foto, fl_autorizado, empresa_usuario!inner(empresa_id, fl_excluido)",
    XApplyFilter: (q) => q.eq("empresa_usuario.empresa_id", XEmpresaId).eq("empresa_usuario.fl_excluido", false),
    XOnSave: async (rec, mode) => {
      if (!rec.email?.trim()) throw new Error("E-mail é obrigatório.");
      
      if (mode === "insert") {
        if (!XSenha || XSenha.length < 6) {
          throw new Error("Informe uma senha com no mínimo 6 caracteres.");
        }
        
        // Cria o usuário via Edge Function (evita deslogar o admin)
        const { data: fnData, error: fnErr } = await supabase.functions.invoke("admin-create-user", {
          body: {
            email: rec.email.trim(),
            password: XSenha,
            nm_usuario: rec.nm_usuario?.trim() || "",
            ds_login: rec.ds_login?.trim() || "",
            ds_foto: rec.ds_foto?.trim() || "",
            empresa_id: XEmpresaId,
            fl_autorizado: rec.fl_autorizado !== undefined ? rec.fl_autorizado : true,
          },
        });

        if (fnErr || (fnData as any)?.error) {
          throw new Error(fnErr?.message || (fnData as any)?.error || "falha ao criar usuário");
        }

        const newUserId = (fnData as any)?.user_id;
        if (!newUserId) throw new Error("ID do usuário não retornado pelo servidor.");
        
        toast.success("Usuário criado com sucesso.");
        setXSenha("");

        return {
          id: newUserId,
          email: rec.email.trim(),
          nm_usuario: rec.nm_usuario?.trim() || "",
          ds_login: rec.ds_login?.trim() || "",
          ds_foto: rec.ds_foto?.trim() || "",
          fl_autorizado: rec.fl_autorizado !== undefined ? rec.fl_autorizado : true,
        };
      } else {
        // Edit mode (calling edge function to prevent RLS update errors)
        const { data: fnData, error: fnErr } = await supabase.functions.invoke("admin-create-user", {
          body: {
            action: "update",
            user_id: rec.id,
            email: rec.email,
            nm_usuario: rec.nm_usuario?.trim() || "",
            ds_login: rec.ds_login?.trim() || "",
            ds_foto: rec.ds_foto?.trim() || "",
            fl_autorizado: rec.fl_autorizado,
          },
        });

        if (fnErr || (fnData as any)?.error) {
          throw new Error(fnErr?.message || (fnData as any)?.error || "falha ao atualizar usuário");
        }

        toast.success("Usuário atualizado com sucesso.");
        return rec;
      }
    },
    XOnDelete: async (rec) => {
      if (!confirm(`Deseja remover "${rec.nm_usuario || rec.email}" da empresa?`)) {
        throw new Error("Operação cancelada pelo usuário.");
      }
      
      // Remove o vínculo do usuário com a empresa
      const { error: euErr } = await supabase.from("empresa_usuario")
        .update({ fl_excluido: true })
        .eq("empresa_id", XEmpresaId)
        .eq("user_id", rec.id);
      
      if (euErr) throw euErr;

      // Remove também os vínculos de perfis nesta empresa
      await supabase.from("perfil_usuario")
        .update({ fl_excluido: true })
        .eq("empresa_id", XEmpresaId)
        .eq("user_id", rec.id);
    }
  });

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

  useEffect(() => { loadAllPerfis(); }, [XEmpresaId, loadAllPerfis]);

  /* ── Sync current record to load vinculos ── */
  useEffect(() => {
    if (ctrl.XCurrentRecord && ctrl.XFormMode === "view") {
      loadVinculos(ctrl.XCurrentRecord.id);
    } else if (ctrl.XFormMode === "insert") {
      setXVinculos([]);
      setXSenha("");
    }
  }, [ctrl.XCurrentRecord, ctrl.XFormMode, loadVinculos]);

  /* ── Reset Password ── */
  const handleResetPassword = async (email: string) => {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`E-mail de redefinição enviado para ${email}`);
  };

  /* ── Vinculo Handlers ── */
  const handleVinculoSalvar = async (userId: string) => {
    if (!XEditPerfilId || !userId) return;
    const XPay = { empresa_id: XEditEmpresaId, user_id: userId, perfil_id: Number(XEditPerfilId) };
    if (XVinculoEditMode === "insert") {
      const { error } = await supabase.from("perfil_usuario").insert(XPay);
      if (error) { toast.error("Erro: " + error.message); return; }
    } else if (XVinculoEditMode === "edit" && XSelectedVinculoIdx !== null) {
      await supabase.from("perfil_usuario").update(XPay).eq("perfil_usuario_id", XVinculos[XSelectedVinculoIdx].perfil_usuario_id);
    }
    setXVinculoEditMode("none");
    loadVinculos(userId);
  };

  const handleVinculoExcluir = async (userId: string) => {
    if (XSelectedVinculoIdx === null || !userId) return;
    await supabase.from("perfil_usuario").update({ fl_excluido: true }).eq("perfil_usuario_id", XVinculos[XSelectedVinculoIdx].perfil_usuario_id);
    toast.success("Vínculo removido.");
    loadVinculos(userId);
  };

  const renderCadastro = ({ record, setField, isEditing, mode }: any) => (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-6 p-4 bg-white/40 dark:bg-slate-900/40 rounded-lg border border-border/40">
        <div className="relative group">
          {record.ds_foto ? (
            <img src={record.ds_foto} alt="Foto" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 border-4 border-white flex items-center justify-center text-3xl font-bold text-slate-400">
              {record.nm_usuario ? record.nm_usuario.charAt(0).toUpperCase() : "?"}
            </div>
          )}
          {isEditing && (
            <button 
              type="button"
              onClick={() => XFileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white"
            >
              <Upload size={20} />
            </button>
          )}
          <input 
            ref={XFileInputRef} 
            type="file" 
            accept="image/*" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setXUploading(true);
              try {
                const ext = file.name.split('.').pop() || 'jpg';
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const path = `usuarios/${fileName}`;
                const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
                if (uploadErr) { toast.error("Erro no upload: " + uploadErr.message); return; }
                const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
                setField("ds_foto", urlData.publicUrl);
                toast.success("Foto enviada com sucesso.");
              } finally {
                setXUploading(false);
                if (XFileInputRef.current) XFileInputRef.current.value = "";
              }
            }} 
            className="hidden" 
          />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{record.nm_usuario || "Novo Usuário"}</h3>
          <p className="text-sm text-slate-500">{record.email || "E-mail não informado"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Nome Completo</label>
          <input 
            type="text" 
            value={record.nm_usuario ?? ""} 
            onChange={e => setField("nm_usuario", e.target.value)} 
            disabled={!isEditing} 
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:bg-slate-100" 
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Login / Usuário</label>
          <input 
            type="text" 
            value={record.ds_login ?? ""} 
            onChange={e => setField("ds_login", e.target.value)} 
            disabled={!isEditing} 
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:bg-slate-100" 
          />
        </div>
         <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">E-mail de Acesso</label>
          <input 
            type="email" 
            value={record.email ?? ""} 
            onChange={e => setField("email", e.target.value)} 
            disabled={!isEditing || mode === "edit"} 
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:bg-slate-100" 
          />
        </div>
        <div className="flex items-center gap-2 md:col-span-2 py-2">
          <input 
            type="checkbox" 
            id="fl_autorizado"
            checked={!!record.fl_autorizado} 
            onChange={e => setField("fl_autorizado", e.target.checked)} 
            disabled={!isEditing} 
            className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer disabled:cursor-not-allowed" 
          />
          <label htmlFor="fl_autorizado" className="text-sm font-semibold text-slate-700 dark:text-slate-300 select-none cursor-pointer disabled:cursor-not-allowed">
            Autorizado para Acesso ao Sistema
          </label>
        </div>
        {mode === "insert" && (
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Senha Inicial</label>
            <input 
              type="password" 
              value={XSenha} 
              onChange={e => setXSenha(e.target.value)} 
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" 
              placeholder="Mínimo 6 caracteres" 
            />
          </div>
        )}
      </div>

      {record.id && mode !== "insert" && (
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
                gridActions.excluir(() => { if (confirm("Remover vínculo?")) handleVinculoExcluir(record.id); }, XSelectedVinculoIdx === null),
                gridActions.atualizar(() => loadVinculos(record.id)),
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
                <select value={XEditPerfilId} onChange={e => setXEditPerfilId(e.target.value ? Number(e.target.value) : "")} className="w-full border border-border rounded-md px-2 py-1.5 text-xs bg-card outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Selecione...</option>
                  {XAllPerfis.filter(p => p.empresa_id === XEditEmpresaId).map(p => <option key={p.perfil_id} value={p.perfil_id}>{p.nm_perfil}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleVinculoSalvar(record.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-transparent text-emerald-600 hover:bg-accent transition-all hover:scale-105">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Salvar
                </button>
                <button type="button" onClick={() => setXVinculoEditMode("none")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-transparent text-rose-600 hover:bg-accent transition-all hover:scale-105">
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
            onFilterChange={(k, v) => XVinculoFilterValues && setXVinculoFilterValues(p => ({ ...p, [k]: v }))}
            maxHeight="200px"
          />
        </div>
      )}
    </div>
  );

  return (
    <StandardCrudForm<IUserRow>
      config={{
        XTableName: "profiles",
        XPrimaryKey: "id",
        XTitle: "Gestão de Usuários",
        XDefaultRecord: { id: "", email: "", nm_usuario: "", ds_login: "", ds_foto: "", fl_autorizado: true },
        XSoftDelete: false,
      }}
      XGridCols={XLocalizarColumns}
      XCtrl={ctrl}
      renderCadastro={renderCadastro}
      XToolbarExtras={({ currentRecord, isEditing }) => (
        !isEditing && currentRecord && (
          <button
            type="button"
            onClick={() => handleResetPassword(currentRecord.email)}
            title="Resetar Senha"
            className="p-1.5 rounded transition-colors text-foreground hover:bg-accent flex items-center gap-1 text-xs"
          >
            <KeyRound size={16} />
            <span>Resetar Senha</span>
          </button>
        )
      )}
    />
  );
};

export default UsuarioForm;
