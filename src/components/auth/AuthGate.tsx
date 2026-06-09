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
import { useThemeColors } from "@/hooks/useThemeColors";

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
  const [rawSession, setRawSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [XIsSuperuser, setXIsSuperuser] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Empresa selection state
  const [XEmpresasVinculadas, setXEmpresasVinculadas] = useState<IEmpresaVinculada[]>([]);
  const [XLoadingEmpresas, setXLoadingEmpresas] = useState(false);
  const [XEmpresaSelecionada, setXEmpresaSelecionada] = useState<number | null>(null);
  const [XEmpresaConfirmada, setXEmpresaConfirmada] = useState(false);

  // Self-signup state
  const [nmUsuario, setNmUsuario] = useState("");
  const [dsLogin, setDsLogin] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const { XLogomarca } = useThemeColors(XEmpresaConfirmada ? 0 : 1);

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 14) val = val.substring(0, 14);
    
    // Formata como XX.XXX.XXX/XXXX-XX
    if (val.length > 12) {
      val = val.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5");
    } else if (val.length > 8) {
      val = val.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
    } else if (val.length > 5) {
      val = val.replace(/^(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
    } else if (val.length > 2) {
      val = val.replace(/^(\d{2})(\d{0,3})/, "$1.$2");
    }
    setCnpj(val);
  };

  const isValidCNPJ = (val: string): boolean => {
    const cleanVal = val.replace(/[^\d]+/g, "");
    if (cleanVal.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cleanVal)) return false;

    let tamanho = cleanVal.length - 2;
    let numeros = cleanVal.substring(0, tamanho);
    const digitos = cleanVal.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += Number(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== Number(digitos.charAt(0))) return false;

    tamanho = tamanho + 1;
    numeros = cleanVal.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += Number(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== Number(digitos.charAt(1))) return false;

    return true;
  };

  interface AuthResult {
    isAuthorized: boolean;
    isSuperuser: boolean;
  }

  const checkUserAuthorized = async (userId: string): Promise<AuthResult> => {
    // Timeout de segurança de 6 segundos para a consulta do banco (aumentado para comportar retentativa)
    const timeoutPromise = new Promise<AuthResult>((resolve) =>
      setTimeout(() => {
        console.warn("[AuthGate] A consulta de autorização excedeu o limite de 6s. Fallback para não autorizado.");
        resolve({ isAuthorized: false, isSuperuser: false });
      }, 6000)
    );

    const queryPromise = (async () => {
      try {
        let { data, error } = await supabase
          .from("profiles")
          .select("fl_autorizado, fl_superuser")
          .eq("id", userId)
          .single();
        
        // Se falhar (por exemplo, race condition onde o cabeçalho de autenticação do token do cliente ainda está sendo configurado)
        if (error) {
          console.warn("[AuthGate] Falha na primeira tentativa de verificar autorização, tentando novamente em 500ms...", error.message);
          await new Promise((resolve) => setTimeout(resolve, 500));
          const retry = await supabase
            .from("profiles")
            .select("fl_autorizado, fl_superuser")
            .eq("id", userId)
            .single();
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.error("Erro ao verificar autorização:", error);
          return { isAuthorized: false, isSuperuser: false };
        }
        return {
          isAuthorized: (data as any)?.fl_autorizado ?? false,
          isSuperuser: (data as any)?.fl_superuser ?? false
        };
      } catch (err) {
        console.error("Exceção na consulta de autorização:", err);
        return { isAuthorized: false, isSuperuser: false };
      }
    })();

    return Promise.race([queryPromise, timeoutPromise]);
  };

  // Verify authorization whenever rawSession changes
  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!rawSession) {
        setSession(null);
        setLoadingSession(false);
        return;
      }

      setLoadingSession(true);
      try {
        const { isAuthorized, isSuperuser } = await checkUserAuthorized(rawSession.user.id);
        if (!active) return;

        if (!isAuthorized) {
          toast.error("Acesso pendente de liberação pelo administrador.");
          setAuthError("Seu acesso foi criado com sucesso, mas está aguardando a liberação de um administrador da sua empresa para entrar.");
          // Executa signOut em background
          supabase.auth.signOut().catch((err) => {
            console.error("Erro ao desconectar usuário não autorizado:", err);
          });
          setSession(null);
        } else {
          setAuthError(null);
          setXIsSuperuser(isSuperuser);
          setSession(rawSession);
        }
      } catch (err) {
        console.error("Erro ao verificar autorização no useEffect:", err);
        setSession(null);
      } finally {
        if (active) {
          setLoadingSession(false);
        }
      }
    };

    verify();

    return () => {
      active = false;
    };
  }, [rawSession]);

  useEffect(() => {
    let active = true;

    // Timeout geral de 3 segundos para garantir que o loader desapareça
    const fallbackTimer = setTimeout(() => {
      if (active) {
        console.warn("[AuthGate] Timeout geral de inicialização de sessão atingido. Desativando loader.");
        setLoadingSession(false);
      }
    }, 3000);

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      try {
        if (data.session) {
          setRawSession(data.session);
        } else {
          setLoadingSession(false);
        }
      } catch (err) {
        console.error("Erro no getSession inicial:", err);
        setLoadingSession(false);
      } finally {
        clearTimeout(fallbackTimer);
      }
    }).catch((err) => {
      console.error("Erro catastrófico ao obter sessão inicial:", err);
      clearTimeout(fallbackTimer);
      if (active) setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      try {
        setRawSession(nextSession);
      } catch (err) {
        console.error("Erro no onAuthStateChange:", err);
      } finally {
        if (active) {
          clearTimeout(fallbackTimer);
          // Reset empresa selection on logout
          if (!nextSession) {
            setXEmpresasVinculadas([]);
            setXEmpresaSelecionada(null);
            setXEmpresaConfirmada(false);
            setLoadingSession(false);
          }
        }
      }
    });

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Load empresas vinculadas when session is available
  useEffect(() => {
    if (!session || XEmpresaConfirmada) return;

    const loadEmpresas = async () => {
      setXLoadingEmpresas(true);
      try {
        console.log("[AuthGate] Iniciando carregamento de empresas para o usuário:", session.user.id);
        
        let XList: IEmpresaVinculada[] = [];

        if (XIsSuperuser) {
          console.log("[AuthGate] Usuário é superusuário. Carregando todas as empresas.");
          const { data: XEmpresas, error: XEmpError } = await (supabase as any)
            .from("empresa")
            .select("empresa_id, razao_social, nome_fantasia, empresa_matriz_id, identificacao")
            .eq("excluido", false)
            .order("razao_social");

          if (XEmpError) {
            console.error("[AuthGate] Erro ao buscar todas as empresas:", XEmpError);
            throw XEmpError;
          }
          XList = (XEmpresas || []) as IEmpresaVinculada[];
        } else {
          // Get empresa_usuario links for this user
          const { data: XLinks, error: XLinkError } = await (supabase as any)
            .from("empresa_usuario")
            .select("empresa_id")
            .eq("user_id", session.user.id)
            .eq("fl_excluido", false);

          if (XLinkError) {
            console.error("[AuthGate] Erro ao buscar vínculos:", XLinkError);
            throw XLinkError;
          }

          console.log("[AuthGate] Vínculos encontrados:", XLinks?.length || 0);

          if (!XLinks || XLinks.length === 0) {
            setXEmpresasVinculadas([]);
            return;
          }

          const XEmpresaIds = XLinks.map((l: any) => l.empresa_id);

          const { data: XEmpresas, error: XEmpError } = await (supabase as any)
            .from("empresa")
            .select("empresa_id, razao_social, nome_fantasia, empresa_matriz_id, identificacao")
            .in("empresa_id", XEmpresaIds)
            .eq("excluido", false)
            .order("razao_social");

          if (XEmpError) {
            console.error("[AuthGate] Erro ao buscar detalhes das empresas:", XEmpError);
            throw XEmpError;
          }

          XList = (XEmpresas || []) as IEmpresaVinculada[];
        }

        console.log("[AuthGate] Empresas carregadas com sucesso:", XList.length);
        setXEmpresasVinculadas(XList);

        // Auto-select if only one empresa
        if (XList.length === 1) {
          console.log("[AuthGate] Auto-selecionando única empresa disponível:", XList[0].empresa_id);
          setXEmpresaSelecionada(XList[0].empresa_id);
          setXEmpresaConfirmada(true);
          onEmpresaSelected?.(XList[0], XList);
        }
      } catch (e: any) {
        console.error("❌ Erro fatal ao carregar empresas:", e);
        toast.error("Erro ao carregar lista de empresas. Tente recarregar a página.");
      } finally {
        setXLoadingEmpresas(false);
      }
    };

    loadEmpresas();
  }, [session, XEmpresaConfirmada, XIsSuperuser]);

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

    if (mode === "signup") {
      if (!nmUsuario.trim() || !dsLogin.trim() || !cnpj.trim()) {
        toast.error("Preencha todos os campos obrigatórios (Nome, Usuário e CNPJ).");
        return;
      }
      if (!isValidCNPJ(cnpj)) {
        toast.error("CNPJ inválido.");
        return;
      }
    }

    setSubmitting(true);
    setAuthError(null);

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

      // MODO SIGNUP (AUTO-CADASTRO via Edge Function)
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("admin-create-user", {
        body: {
          action: "self-register",
          email: email.trim(),
          password,
          nm_usuario: nmUsuario.trim(),
          ds_login: dsLogin.trim(),
          cnpj: cnpj.trim(),
        },
      });

      if (fnErr || (fnData as any)?.error) {
        console.error("Erro no self-register:", fnErr || (fnData as any)?.error);
        toast.error(fnErr?.message || (fnData as any)?.error || "Erro no pós-cadastro. Fale com um administrador.");
        return;
      }

      const isFirst = (fnData as any)?.is_first;
      const isAuthorized = (fnData as any)?.fl_autorizado;

      if (isFirst) {
        toast.success("Conta criada! Você é o administrador desta empresa. Confirme seu e-mail para logar.");
      } else {
        toast.success("Conta criada! Seu acesso foi registrado e aguarda liberação de um administrador. Confirme seu e-mail.");
      }

      setMode("signin");
      // Limpa os campos
      setNmUsuario("");
      setDsLogin("");
      setCnpj("");
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
              <img src={XLogomarca || logoRealsys} alt="RealSys" className="h-20 max-w-[200px] object-contain rounded-lg" />
            </div>
            <div className="space-y-1 text-center">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {authError && (
              <div className="p-3 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-900/50 leading-relaxed">
                {authError}
              </div>
            )}

            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="auth-name">Nome Completo</Label>
                  <Input
                    id="auth-name"
                    type="text"
                    value={nmUsuario}
                    onChange={(event) => setNmUsuario(event.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="auth-username">Nome de Usuário (Login)</Label>
                  <Input
                    id="auth-username"
                    type="text"
                    value={dsLogin}
                    onChange={(event) => setDsLogin(event.target.value)}
                    placeholder="ex: joao.silva"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auth-cnpj">CNPJ da Empresa</Label>
                  <Input
                    id="auth-cnpj"
                    type="text"
                    value={cnpj}
                    onChange={handleCnpjChange}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </>
            )}

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
      <div className="flex min-h-screen items-center justify-center bg-background px-4 flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-sm font-bold">Carregando empresas...</p>
          <p className="text-[10px] text-muted-foreground mt-1">Verificando conexão com o banco de dados Supabase</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="mt-4">
          Recarregar Página
        </Button>
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
              <img src={XLogomarca || logoRealsys} alt="RealSys" className="h-20 max-w-[200px] object-contain rounded-lg" />
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
              <img src={XLogomarca || logoRealsys} alt="RealSys" className="h-20 max-w-[200px] object-contain rounded-lg" />
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
