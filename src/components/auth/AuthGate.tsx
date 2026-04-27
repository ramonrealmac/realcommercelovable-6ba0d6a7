import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoRealsys from "@/assets/logo_realsys.jpg";

type AuthMode = "signin" | "signup";

interface IEmpresaVinculada {
  empresa_id: number;
  razao_social: string;
  nome_fantasia: string;
  empresa_matriz_id: number | null;
  identificacao: string;
}

interface AuthGateProps {
  children: React.ReactNode;
  onEmpresaSelected?: (empresa: IEmpresaVinculada, allEmpresas: IEmpresaVinculada[]) => void;
}

const AuthGate = ({ children, onEmpresaSelected }: AuthGateProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Empresa selection state
  const [XEmpresasVinculadas, setXEmpresasVinculadas] = useState<IEmpresaVinculada[]>([]);
  const [XLoadingEmpresas, setXLoadingEmpresas] = useState(false);
  const [XEmpresaSelecionada, setXEmpresaSelecionada] = useState<number | null>(null);
  const [XEmpresaConfirmada, setXEmpresaConfirmada] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
      // Reset empresa selection on logout
      if (!nextSession) {
        setXEmpresasVinculadas([]);
        setXEmpresaSelecionada(null);
        setXEmpresaConfirmada(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load empresas vinculadas when session is available
  useEffect(() => {
    if (!session || XEmpresaConfirmada) return;

    const loadEmpresas = async () => {
      setXLoadingEmpresas(true);
      try {
        // Get empresa_usuario links for this user
        const { data: XLinks } = await (supabase as any)
          .from("empresa_usuario")
          .select("empresa_id")
          .eq("user_id", session.user.id)
          .eq("fl_excluido", false);

        if (!XLinks || XLinks.length === 0) {
          setXEmpresasVinculadas([]);
          setXLoadingEmpresas(false);
          return;
        }

        const XEmpresaIds = XLinks.map((l: any) => l.empresa_id);

        const { data: XEmpresas } = await (supabase as any)
          .from("empresa")
          .select("empresa_id, razao_social, nome_fantasia, empresa_matriz_id, identificacao")
          .in("empresa_id", XEmpresaIds)
          .eq("excluido", false)
          .order("razao_social");

        const XList = (XEmpresas || []) as IEmpresaVinculada[];
        setXEmpresasVinculadas(XList);

        // Auto-select if only one empresa
        if (XList.length === 1) {
          setXEmpresaSelecionada(XList[0].empresa_id);
          setXEmpresaConfirmada(true);
          onEmpresaSelected?.(XList[0], XList);
        }
      } catch (e) {
        console.error("Erro ao carregar empresas:", e);
      }
      setXLoadingEmpresas(false);
    };

    loadEmpresas();
  }, [session, XEmpresaConfirmada]);

  const title = useMemo(
    () => (mode === "signin" ? "Entrar no sistema" : "Criar acesso"),
    [mode],
  );

  const description = useMemo(
    () =>
      mode === "signin"
        ? "Faça login para usar os cadastros protegidos pelo backend."
        : "Crie sua conta para acessar o módulo com permissões seguras.",
    [mode],
  );

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Informe e-mail e senha.");
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        // Upsert profile so email is available for lookups
        const { data: { session: loginSession } } = await supabase.auth.getSession();
        if (loginSession) {
          await (supabase as any).from("profiles").upsert({
            id: loginSession.user.id,
            email: loginSession.user.email,
          }, { onConflict: "id" });
        }
        toast.success("Login realizado com sucesso.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.session) {
        await (supabase as any).from("profiles").upsert({
          id: data.session.user.id,
          email: data.session.user.email,
        }, { onConflict: "id" });
        toast.success("Conta criada e autenticada com sucesso.");
        return;
      }

      toast.success("Conta criada. Confirme seu e-mail para entrar.");
      setMode("signin");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmarEmpresa = () => {
    if (!XEmpresaSelecionada) {
      toast.error("Selecione uma empresa para continuar.");
      return;
    }
    const XEmp = XEmpresasVinculadas.find(e => e.empresa_id === XEmpresaSelecionada);
    if (XEmp) {
      setXEmpresaConfirmada(true);
      onEmpresaSelected?.(XEmp, XEmpresasVinculadas);
    }
  };

  if (loadingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validando acesso...
        </div>
      </div>
    );
  }

  // Not logged in → show login form
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-md border-border bg-card shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-col items-center gap-3">
              <img src={logoRealsys} alt="RealSys" className="h-20 w-20 object-contain rounded-lg" />
            </div>
            <div className="space-y-1 text-center">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">E-mail</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-password">Senha</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setMode((current) => (current === "signin" ? "signup" : "signin"))}
                disabled={submitting}
              >
                {mode === "signin" ? "Criar acesso" : "Já tenho conta"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Sem login, o backend bloqueia gravações por segurança.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logged in but loading empresas
  if (XLoadingEmpresas) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando empresas...
        </div>
      </div>
    );
  }

  // Logged in but no empresas linked
  if (XEmpresasVinculadas.length === 0 && !XEmpresaConfirmada) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-md border-border bg-card shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-col items-center gap-3">
              <img src={logoRealsys} alt="RealSys" className="h-20 w-20 object-contain rounded-lg" />
            </div>
            <div className="space-y-1 text-center">
              <CardTitle>Sem empresa vinculada</CardTitle>
              <CardDescription>
                Seu usuário não está vinculado a nenhuma empresa. Solicite ao administrador que vincule seu acesso.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}>
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logged in, has empresas, but hasn't selected yet
  if (!XEmpresaConfirmada) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-md border-border bg-card shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-col items-center gap-3">
              <img src={logoRealsys} alt="RealSys" className="h-20 w-20 object-contain rounded-lg" />
            </div>
            <div className="space-y-1 text-center">
              <CardTitle>Selecione a empresa</CardTitle>
              <CardDescription>Escolha a empresa para iniciar o trabalho.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <select
                value={XEmpresaSelecionada || ""}
                onChange={(e) => setXEmpresaSelecionada(Number(e.target.value))}
                className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="">(Selecione)</option>
                {XEmpresasVinculadas.map(emp => (
                  <option key={emp.empresa_id} value={emp.empresa_id}>
                    {emp.razao_social}{emp.nome_fantasia ? ` — ${emp.nome_fantasia}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button className="w-full" onClick={handleConfirmarEmpresa}>
              Continuar
            </Button>
            <Button variant="outline" className="w-full" onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}>
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // All good → render children
  return <>{children}</>;
};

export default AuthGate;
