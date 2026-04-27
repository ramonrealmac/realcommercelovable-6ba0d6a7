import { useState, useEffect, useRef } from "react";
import { Menu, Grid3X3, LogOut, KeyRound, Shield, Users, UserCog } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";

const TopBar = () => {
  const { XEmpresaId, setXEmpresaId, setXEmpresaMatrizId, XEmpresas, toggleSidebar, openTab } = useAppContext();

  const [XMenuOpen, setXMenuOpen] = useState(false);
  const [XUserEmail, setXUserEmail] = useState("");
  const [XUserLogin, setXUserLogin] = useState("");
  const [XUserNome, setXUserNome] = useState("");
  const [XUserFoto, setXUserFoto] = useState("");
  const XMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setXUserEmail(session.user.email || "");

      const { data } = await (supabase as any)
        .from("profiles")
        .select("nm_usuario, ds_login, ds_foto")
        .eq("id", session.user.id)
        .maybeSingle();

      if (data) {
        setXUserNome((data as any).nm_usuario || "");
        setXUserLogin((data as any).ds_login || "");
        setXUserFoto((data as any).ds_foto || "");
      }
    };
    loadProfile();
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (XMenuRef.current && !XMenuRef.current.contains(e.target as Node)) {
        setXMenuOpen(false);
      }
    };
    if (XMenuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [XMenuOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const XDisplayName = XUserLogin || XUserEmail || "U";
  const XInitial = (XUserNome || XUserEmail || "U").charAt(0).toUpperCase();

  return (
    <div className="flex items-center h-10 bg-topbar text-topbar-foreground px-2 gap-1 md:gap-2 shrink-0">
      <button onClick={toggleSidebar} className="p-1.5 hover:bg-foreground/10 rounded" title="Menu">
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-1 min-w-0 flex-1 md:flex-none">
        <span className="text-xs opacity-70 hidden md:inline">Emp.</span>
        <select
          value={XEmpresaId}
          onChange={(e) => {
            const id = Number(e.target.value);
            setXEmpresaId(id);
            const emp = XEmpresas.find(x => x.empresa_id === id);
            setXEmpresaMatrizId(emp?.empresa_matriz_id ?? id);
          }}
          className="bg-card text-foreground border border-border rounded px-2 py-0.5 text-sm min-w-0 w-full md:min-w-[192px] md:w-auto truncate"
        >
          {XEmpresas.map(e => (
            <option key={e.empresa_id} value={e.empresa_id}>{e.empresa_id} - {e.identificacao || e.razao_social}</option>
          ))}
        </select>
      </div>

      <div className="hidden md:block flex-1" />

      <button className="p-1.5 hover:bg-foreground/10 rounded" title="Aplicativos">
        <Grid3X3 size={18} />
      </button>

      {/* User avatar + dropdown */}
      <div className="relative" ref={XMenuRef}>
        <button
          onClick={() => setXMenuOpen(p => !p)}
          className="w-8 h-8 rounded-full overflow-hidden border-2 border-primary/50 hover:border-primary transition-colors flex items-center justify-center bg-primary text-primary-foreground text-sm font-bold"
          title={XDisplayName}
        >
          {XUserFoto ? (
            <img
              src={XUserFoto}
              alt="Foto"
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            XInitial
          )}
        </button>

        {XMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            {/* User info header */}
            <div className="px-4 py-3 border-b border-border bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-border flex items-center justify-center bg-primary text-primary-foreground text-sm font-bold shrink-0">
                  {XUserFoto ? (
                    <img src={XUserFoto} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    XInitial
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {XUserNome || XDisplayName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {XUserEmail}
                  </div>
                </div>
              </div>
            </div>

            <div className="py-1">
              <div className="px-4 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Segurança</div>
              <MenuAction
                icon={<UserCog size={14} />}
                label="Perfis de Acesso"
                onClick={() => {
                  openTab({ title: "Perfis de Acesso", component: "PerfilForm" });
                  setXMenuOpen(false);
                }}
              />
              <MenuAction
                icon={<Shield size={14} />}
                label="Controle de Acesso"
                onClick={() => {
                  openTab({ title: "Controle de Acesso", component: "ControleAcessoForm" });
                  setXMenuOpen(false);
                }}
              />
              <MenuAction
                icon={<Users size={14} />}
                label="Usuários"
                onClick={() => {
                  openTab({ title: "Usuários", component: "UsuarioForm" });
                  setXMenuOpen(false);
                }}
              />
              <div className="h-px bg-border mx-2 my-1" />
              <MenuAction
                icon={<KeyRound size={14} />}
                label="Trocar Senha"
                onClick={() => {
                  openTab({ title: "Trocar Senha", component: "TrocaSenhaForm" });
                  setXMenuOpen(false);
                }}
              />
              <div className="h-px bg-border mx-2 my-1" />
              <MenuAction
                icon={<LogOut size={14} />}
                label="Sair do Sistema"
                onClick={handleLogout}
                destructive
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MenuAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}> = ({ icon, label, onClick, destructive }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 w-full px-4 py-2 text-sm transition-colors ${
      destructive
        ? "text-destructive hover:bg-destructive/10"
        : "text-foreground hover:bg-accent"
    }`}
  >
    {icon}
    {label}
  </button>
);

export default TopBar;
