import React, { useState, useCallback } from "react";
import { Save, LogOut, KeyRound } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TrocaSenhaForm: React.FC = () => {
  const { closeTab, XTabs, XActiveTabId } = useAppContext();

  const [XSenhaAtual, setXSenhaAtual] = useState("");
  const [XNovaSenha, setXNovaSenha] = useState("");
  const [XConfirmaSenha, setXConfirmaSenha] = useState("");
  const [XSaving, setXSaving] = useState(false);

  const handleSair = () => {
    const XTab = XTabs.find(t => t.id === XActiveTabId);
    if (XTab) closeTab(XTab.id);
  };

  const handleSalvar = useCallback(async () => {
    if (!XSenhaAtual.trim()) {
      toast.error("Informe a senha atual.");
      return;
    }
    if (!XNovaSenha || XNovaSenha.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (XNovaSenha !== XConfirmaSenha) {
      toast.error("A confirmação da senha não confere.");
      return;
    }

    setXSaving(true);
    try {
      // Verify current password by re-authenticating
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        toast.error("Sessão inválida. Faça login novamente.");
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: XSenhaAtual,
      });

      if (signInErr) {
        toast.error("Senha atual incorreta.");
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: XNovaSenha,
      });

      if (error) {
        toast.error("Erro ao trocar senha: " + error.message);
        return;
      }

      toast.success("Senha alterada com sucesso!");
      setXSenhaAtual("");
      setXNovaSenha("");
      setXConfirmaSenha("");
    } finally {
      setXSaving(false);
    }
  }, [XSenhaAtual, XNovaSenha, XConfirmaSenha]);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card">
        <ToolbarBtn icon={<Save size={16} />} label="Salvar" onClick={handleSalvar} color="success" disabled={XSaving} />
        <ToolbarBtn icon={<LogOut size={16} />} label="Sair" onClick={handleSair} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-md space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Trocar Senha</h2>
              <p className="text-xs text-muted-foreground">Informe a senha atual e defina uma nova senha.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Senha Atual <span className="text-destructive">*</span>
            </label>
            <input
              type="password"
              value={XSenhaAtual}
              onChange={e => setXSenhaAtual(e.target.value)}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none"
              placeholder="Digite sua senha atual"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Nova Senha <span className="text-destructive">*</span>
            </label>
            <input
              type="password"
              value={XNovaSenha}
              onChange={e => setXNovaSenha(e.target.value)}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Confirmar Nova Senha <span className="text-destructive">*</span>
            </label>
            <input
              type="password"
              value={XConfirmaSenha}
              onChange={e => setXConfirmaSenha(e.target.value)}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none"
              placeholder="Repita a nova senha"
              onKeyDown={e => { if (e.key === "Enter") handleSalvar(); }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

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

export default TrocaSenhaForm;
