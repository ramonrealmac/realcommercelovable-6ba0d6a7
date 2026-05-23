import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Database, 
  LockKeyhole, 
  Plus, 
  Save, 
  Trash2, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Server,
  KeyRound,
  Terminal,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

interface ConnectionProfile {
  id: string;
  name: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_PUBLISHABLE_KEY: string;
  dbPassword?: string;
  dbPort?: string;
  dbName?: string;
  dbUser?: string;
}

interface SetupWizardProps {
  onConfigureSuccess?: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export default function SetupWizard({ onConfigureSuccess, onClose, showCloseButton = false }: SetupWizardProps) {
  // Authentication / Lock State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // Active .env Connection State
  const [activeConnection, setActiveConnection] = useState<{ url: string; key: string } | null>(null);

  // Connection Profiles List
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");

  // Edit Form State
  const [name, setName] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [dbPort, setDbPort] = useState("5432");
  const [dbName, setDbName] = useState("postgres");
  const [dbUser, setDbUser] = useState("postgres");

  // UI state
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingEnv, setSavingEnv] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // SQL State
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM empresa LIMIT 10;");
  const [sqlResult, setSqlResult] = useState<{
    success: boolean;
    rows: any[];
    fields: string[];
    rowCount: number;
    error?: string;
  } | null>(null);
  const [executingSql, setExecutingSql] = useState(false);

  // Security password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Load configuration on mount
  useEffect(() => {
    if (window.electronAPI) {
      loadActiveConnection();
      loadProfiles();
    }
  }, []);

  const loadActiveConnection = async () => {
    try {
      const config = await window.electronAPI.getEnvConfig();
      if (config.VITE_SUPABASE_URL) {
        setActiveConnection({
          url: config.VITE_SUPABASE_URL,
          key: config.VITE_SUPABASE_PUBLISHABLE_KEY
        });
      }
    } catch (err) {
      console.error("Erro ao carregar conexão ativa:", err);
    }
  };

  const loadProfiles = async () => {
    try {
      const savedProfiles = await window.electronAPI.loadConnections();
      setProfiles(savedProfiles || []);
      if (savedProfiles && savedProfiles.length > 0) {
        // Select the one matching active connection or the first one
        const active = savedProfiles.find(
          (p: any) => p.VITE_SUPABASE_URL === activeConnection?.url
        );
        if (active) {
          handleSelectProfile(active);
        } else {
          handleSelectProfile(savedProfiles[0]);
        }
      } else {
        // Reset form
        clearForm();
      }
    } catch (err) {
      console.error("Erro ao carregar perfis:", err);
    }
  };

  const handleSelectProfile = (profile: ConnectionProfile) => {
    setSelectedProfileId(profile.id);
    setName(profile.name);
    setSupabaseUrl(profile.VITE_SUPABASE_URL);
    setSupabaseKey(profile.VITE_SUPABASE_PUBLISHABLE_KEY);
    setDbPassword(profile.dbPassword || "");
    setDbPort(profile.dbPort || "5432");
    setDbName(profile.dbName || "postgres");
    setDbUser(profile.dbUser || "postgres");
    setSqlResult(null);
  };

  const clearForm = () => {
    setSelectedProfileId("");
    setName("");
    setSupabaseUrl("");
    setSupabaseKey("");
    setDbPassword("");
    setDbPort("5432");
    setDbName("postgres");
    setDbUser("postgres");
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword) {
      toast.error("Insira a senha de administrador.");
      return;
    }
    setSubmittingPassword(true);
    try {
      const isValid = await window.electronAPI.checkAdminPassword(adminPassword);
      if (isValid) {
        setIsAuthenticated(true);
        toast.success("Acesso liberado.");
        // Reload settings in case they loaded blank before auth
        loadActiveConnection();
        loadProfiles();
      } else {
        toast.error("Senha de administrador incorreta.");
      }
    } catch (err) {
      toast.error("Erro ao verificar senha.");
    } finally {
      setSubmittingPassword(false);
    }
  };

  // Profile management
  const handleSaveProfile = async () => {
    if (!name || !supabaseUrl || !supabaseKey) {
      toast.error("Preencha o nome do perfil, URL e chave do Supabase.");
      return;
    }

    try {
      const updatedProfiles = [...profiles];
      const targetId = selectedProfileId || crypto.randomUUID();

      const profileData: ConnectionProfile = {
        id: targetId,
        name,
        VITE_SUPABASE_URL: supabaseUrl.trim(),
        VITE_SUPABASE_PUBLISHABLE_KEY: supabaseKey.trim(),
        dbPassword: dbPassword.trim(),
        dbPort: dbPort.trim(),
        dbName: dbName.trim(),
        dbUser: dbUser.trim()
      };

      const existingIndex = updatedProfiles.findIndex(p => p.id === targetId);
      if (existingIndex >= 0) {
        updatedProfiles[existingIndex] = profileData;
      } else {
        updatedProfiles.push(profileData);
      }

      const res = await window.electronAPI.saveConnections(updatedProfiles);
      if (res.success) {
        toast.success("Perfil de conexão salvo!");
        setProfiles(updatedProfiles);
        setSelectedProfileId(targetId);
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast.error(`Erro ao salvar perfil: ${err.message}`);
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfileId) return;

    try {
      const updatedProfiles = profiles.filter(p => p.id !== selectedProfileId);
      const res = await window.electronAPI.saveConnections(updatedProfiles);
      if (res.success) {
        toast.success("Perfil removido.");
        setProfiles(updatedProfiles);
        clearForm();
        if (updatedProfiles.length > 0) {
          handleSelectProfile(updatedProfiles[0]);
        }
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast.error(`Erro ao excluir perfil: ${err.message}`);
    }
  };

  // Test Supabase Connection
  const handleTestConnection = async () => {
    if (!supabaseUrl || !supabaseKey) {
      toast.error("Informe a URL e a Chave do Supabase para testar.");
      return;
    }

    setTestingConnection(true);
    try {
      // Direct client check in browser/frontend context
      const tempClient = createClient(supabaseUrl.trim(), supabaseKey.trim());
      
      // Perform simple SELECT query on 'empresa'
      const { data, error } = await tempClient
        .from("empresa")
        .select("razao_social")
        .limit(1);

      if (error) {
        throw error;
      }

      const empresaNome = data?.[0]?.razao_social || "(Nenhuma empresa cadastrada)";
      toast.success(`Conexão OK! Banco respondendo. Empresa: ${empresaNome}`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Falha na conexão: ${err.message || "Erro desconhecido"}`);
    } finally {
      setTestingConnection(false);
    }
  };

  // Apply configuration and restart
  const handleApplyConfig = async () => {
    if (!supabaseUrl || !supabaseKey) {
      toast.error("Selecione ou configure um perfil completo.");
      return;
    }

    setSavingEnv(true);
    try {
      // First save profile list to connections
      await handleSaveProfile();

      // Save environment configuration
      const res = await window.electronAPI.saveEnvConfig({
        VITE_SUPABASE_URL: supabaseUrl.trim(),
        VITE_SUPABASE_PUBLISHABLE_KEY: supabaseKey.trim()
      });

      if (res.success) {
        toast.success("Arquivo .env gravado com sucesso! Reiniciando aplicação...");
        setTimeout(() => {
          window.electronAPI.restartApp();
        }, 1500);
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast.error(`Erro ao aplicar configuração: ${err.message}`);
    } finally {
      setSavingEnv(false);
    }
  };

  // Execute SQL Query
  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) {
      toast.error("Digite uma consulta SQL.");
      return;
    }

    const cleanQuery = sqlQuery.trim().toLowerCase();
    
    // Client-side quick check
    const forbiddenRegex = /\b(delete|update|drop|alter|create|insert|truncate|replace|grant|revoke)\b/i;
    if (forbiddenRegex.test(cleanQuery)) {
      toast.error("Comando bloqueado: Apenas consultas SELECT são permitidas por segurança.");
      return;
    }

    if (!cleanQuery.startsWith("select") && !cleanQuery.startsWith("with") && !cleanQuery.startsWith("show") && !cleanQuery.startsWith("explain")) {
      toast.error("Comando bloqueado: Apenas consultas que iniciam com SELECT ou WITH são permitidas.");
      return;
    }

    setExecutingSql(true);
    setSqlResult(null);

    try {
      const activeProfile: ConnectionProfile = {
        id: selectedProfileId,
        name,
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
        dbPassword,
        dbPort,
        dbName,
        dbUser
      };

      const result = await window.electronAPI.executeSqlQuery(activeProfile, sqlQuery);
      if (result.success) {
        setSqlResult({
          success: true,
          rows: result.rows,
          fields: result.fields,
          rowCount: result.rowCount
        });
        toast.success(`Consulta executada! ${result.rowCount} linhas retornadas.`);
      } else {
        setSqlResult({
          success: false,
          rows: [],
          fields: [],
          rowCount: 0,
          error: result.error
        });
        toast.error(`Erro na execução: ${result.error}`);
      }
    } catch (err: any) {
      setSqlResult({
        success: false,
        rows: [],
        fields: [],
        rowCount: 0,
        error: err.message
      });
      toast.error(`Erro: ${err.message}`);
    } finally {
      setExecutingSql(false);
    }
  };

  // Change Admin Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos de senha.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As novas senhas não coincidem.");
      return;
    }

    setChangingPassword(true);
    try {
      // Validate current password
      const isCurrentValid = await window.electronAPI.checkAdminPassword(currentPassword);
      if (!isCurrentValid) {
        toast.error("Senha atual de administrador incorreta.");
        return;
      }

      // Update password
      const res = await window.electronAPI.changeAdminPassword(newPassword);
      if (res.success) {
        toast.success("Senha administrativa alterada com sucesso!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast.error(`Erro ao alterar senha: ${err.message}`);
    } finally {
      setChangingPassword(false);
    }
  };

  // Render Login Lock Page if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100 select-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.8),rgba(2,6,23,1))]" />
        
        <Card className="relative z-10 w-full max-w-md border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl text-slate-200">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 animate-pulse">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">
              Configurações de Banco
            </CardTitle>
            <CardDescription className="text-slate-400">
              Digite a senha de administrador para acessar o configurador do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pass" className="text-slate-300">Senha Admin</Label>
                <div className="relative">
                  <Input
                    id="pass"
                    type={showPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="border-slate-800 bg-slate-950/80 text-white placeholder-slate-600 focus:border-primary/50 focus:ring-primary/20 pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Nota: A senha padrão inicial é "S0ftw@y1".
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  type="submit" 
                  className="w-full bg-primary text-white hover:bg-primary/95 transition-all duration-300" 
                  disabled={submittingPassword}
                >
                  {submittingPassword ? "Validando..." : "Desbloquear Configurações"}
                </Button>
                {showCloseButton && onClose && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    className="border-slate-800 hover:bg-slate-800 text-slate-300"
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 flex-col font-sans select-none">
      {/* Top Banner */}
      <div className="border-b border-slate-900 bg-slate-950/40 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Assistente de Conectividade</h1>
            <p className="text-xs text-slate-400">Gerenciador de Ambientes Supabase & Consultas SQL</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeConnection && (
            <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 rounded-full px-3 py-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Ativo no .env:</span>
              <span className="text-white font-mono font-medium max-w-[200px] truncate">{activeConnection.url}</span>
            </div>
          )}
          {showCloseButton && onClose && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClose}
              className="border-slate-800 hover:bg-slate-800 text-slate-300"
            >
              Fechar Painel
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 gap-6 z-10">
        <Tabs defaultValue="profiles" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 w-full max-w-md mb-6 grid grid-cols-3">
            <TabsTrigger value="profiles" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <Server className="w-4 h-4 mr-2" />
              Conexões
            </TabsTrigger>
            <TabsTrigger value="sql" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <Terminal className="w-4 h-4 mr-2" />
              Consulta SQL
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <KeyRound className="w-4 h-4 mr-2" />
              Segurança
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Profiles Manager */}
          <TabsContent value="profiles" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profile list */}
              <Card className="border-slate-900 bg-slate-900/30 text-slate-200">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base text-white">Perfis Salvos</CardTitle>
                    <CardDescription className="text-xs text-slate-400">Selecione ou adicione conexões</CardDescription>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={clearForm}
                    className="h-8 w-8 p-0 hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="px-3">
                  <div className="space-y-1.5 max-h-[450px] overflow-y-auto pr-1">
                    {profiles.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                        Nenhum perfil cadastrado.
                      </div>
                    ) : (
                      profiles.map((p) => {
                        const isActive = activeConnection?.url === p.VITE_SUPABASE_URL;
                        const isSelected = selectedProfileId === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleSelectProfile(p)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 border ${
                              isSelected 
                                ? "bg-primary/10 border-primary text-white" 
                                : "bg-slate-950/40 border-slate-900 text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                            }`}
                          >
                            <div className="flex flex-col gap-0.5 truncate">
                              <span className="text-sm font-semibold text-white truncate">{p.name}</span>
                              <span className="text-[10px] font-mono truncate max-w-[180px]">{p.VITE_SUPABASE_URL}</span>
                            </div>
                            {isActive && (
                              <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                Ativo
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Edit Form */}
              <Card className="col-span-2 border-slate-900 bg-slate-900/30 text-slate-200">
                <CardHeader>
                  <CardTitle className="text-base text-white">
                    {selectedProfileId ? `Editar Perfil: ${name}` : "Cadastrar Nova Conexão"}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Defina as credenciais para o ambiente Supabase e o banco relacional
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Profile Name */}
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="prof-name" className="text-xs text-slate-400">Nome do Perfil (Ex: Produção, Local)</Label>
                      <Input
                        id="prof-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nome identificador"
                        className="border-slate-800 bg-slate-950/80 text-white focus:border-primary/50"
                      />
                    </div>

                    {/* Supabase URL */}
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="sup-url" className="text-xs text-slate-400">URL do Supabase (VITE_SUPABASE_URL)</Label>
                      <Input
                        id="sup-url"
                        value={supabaseUrl}
                        onChange={(e) => setSupabaseUrl(e.target.value)}
                        placeholder="https://suaprojetoid.supabase.co"
                        className="border-slate-800 bg-slate-950/80 text-white font-mono text-xs focus:border-primary/50"
                      />
                    </div>

                    {/* Supabase ANON KEY */}
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="sup-key" className="text-xs text-slate-400">Chave ANON do Supabase (VITE_SUPABASE_PUBLISHABLE_KEY)</Label>
                      <Input
                        id="sup-key"
                        value={supabaseKey}
                        onChange={(e) => setSupabaseKey(e.target.value)}
                        placeholder="eyJhbGciOi..."
                        className="border-slate-800 bg-slate-950/80 text-white font-mono text-xs focus:border-primary/50"
                      />
                    </div>

                    <div className="md:col-span-2 border-t border-slate-900 my-2 pt-2">
                      <h3 className="text-xs font-semibold text-slate-300 mb-1">Configurações para Execução de SQL</h3>
                      <p className="text-[10px] text-slate-500">Credenciais diretas para a porta PostgreSQL do Supabase (Opcional, apenas se desejar usar a tela SQL)</p>
                    </div>

                    {/* DB Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="db-pass" className="text-xs text-slate-400">Senha do Banco (Postgres)</Label>
                      <Input
                        id="db-pass"
                        type="password"
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                        placeholder="Senha do banco configurada no setup"
                        className="border-slate-800 bg-slate-950/80 text-white focus:border-primary/50"
                      />
                    </div>

                    {/* DB Port */}
                    <div className="space-y-1.5">
                      <Label htmlFor="db-port" className="text-xs text-slate-400">Porta PostgreSQL (Padrão 5432)</Label>
                      <Input
                        id="db-port"
                        value={dbPort}
                        onChange={(e) => setDbPort(e.target.value)}
                        placeholder="5432"
                        className="border-slate-800 bg-slate-950/80 text-white focus:border-primary/50"
                      />
                    </div>

                    {/* DB Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="db-name" className="text-xs text-slate-400">Nome do Banco (Padrão postgres)</Label>
                      <Input
                        id="db-name"
                        value={dbName}
                        onChange={(e) => setDbName(e.target.value)}
                        placeholder="postgres"
                        className="border-slate-800 bg-slate-950/80 text-white focus:border-primary/50"
                      />
                    </div>

                    {/* DB User */}
                    <div className="space-y-1.5">
                      <Label htmlFor="db-user" className="text-xs text-slate-400">Usuário do Banco (Padrão postgres)</Label>
                      <Input
                        id="db-user"
                        value={dbUser}
                        onChange={(e) => setDbUser(e.target.value)}
                        placeholder="postgres"
                        className="border-slate-800 bg-slate-950/80 text-white focus:border-primary/50"
                      />
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-900">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleSaveProfile}
                        className="bg-slate-800 hover:bg-slate-700 text-white gap-2 text-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Salvar Perfil
                      </Button>
                      
                      <Button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testingConnection}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 gap-2 text-xs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                        Testar Conexão (SELECT)
                      </Button>
                      
                      {selectedProfileId && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleDeleteProfile}
                          className="gap-2 text-xs bg-red-950 text-red-300 hover:bg-red-900"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </Button>
                      )}
                    </div>

                    <Button
                      type="button"
                      onClick={handleApplyConfig}
                      disabled={savingEnv}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 text-xs font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Gravar no .env & Reiniciar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: SQL Client Console */}
          <TabsContent value="sql" className="mt-0">
            <div className="grid grid-cols-1 gap-6">
              <Card className="border-slate-900 bg-slate-900/30 text-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs mb-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <strong className="block text-amber-400">Proteção de Escrita Ativa</strong>
                      Apenas consultas de leitura (<code className="font-mono bg-amber-950 px-1 rounded">SELECT</code> ou <code className="font-mono bg-amber-950 px-1 rounded">WITH</code>) são permitidas. Comandos como <code className="font-mono bg-amber-950 px-1 rounded">INSERT, UPDATE, DELETE, DROP, ALTER</code> serão bloqueados preventivamente pelo configurador.
                    </div>
                  </div>
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-primary" />
                    Executar Consulta (SQL) no Banco: <span className="text-primary font-mono">{name || 'Conexão Atual'}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Escreva seu comando SQL abaixo e clique em Executar para consultar o banco relacional PostgreSQL
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Textarea
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      placeholder="SELECT * FROM empresa LIMIT 10;"
                      className="h-32 font-mono text-xs border-slate-800 bg-slate-950/80 text-emerald-400 focus:border-primary/50 focus:ring-primary/20"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Conexão em uso: {supabaseUrl ? `db.${supabaseUrl.match(/https:\/\/([a-z0-9\-]+)\.supabase\.(co|in|net)/)?.[1] || ''}.supabase.co` : '(Sem banco selecionado)'}
                    </span>
                    <Button
                      onClick={handleExecuteSql}
                      disabled={executingSql || !supabaseUrl || !dbPassword}
                      className="bg-primary text-white hover:bg-primary/95 gap-2 text-xs"
                    >
                      <Play className={`w-3.5 h-3.5 ${executingSql ? 'animate-spin' : ''}`} />
                      {executingSql ? "Buscando..." : "Executar Consulta"}
                    </Button>
                  </div>

                  {/* SQL Results Render */}
                  {sqlResult && (
                    <div className="border-t border-slate-900 pt-4 mt-2">
                      <h4 className="text-xs font-bold text-white mb-2">Resultado da Consulta:</h4>
                      
                      {!sqlResult.success ? (
                        <div className="flex items-center gap-2 bg-red-950/50 border border-red-900/50 text-red-400 p-4 rounded-lg text-xs font-mono">
                          <XCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{sqlResult.error}</span>
                        </div>
                      ) : sqlResult.rows.length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-500 border border-slate-800 rounded-lg">
                          A consulta retornou 0 resultados com sucesso.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                            <span>Colunas: {sqlResult.fields.join(", ")}</span>
                            <span>{sqlResult.rowCount} linhas encontradas</span>
                          </div>
                          
                          <div className="max-h-[300px] overflow-auto border border-slate-900 rounded-lg bg-slate-950/40">
                            <Table>
                              <TableHeader className="bg-slate-900/80 sticky top-0">
                                <TableRow className="border-slate-900">
                                  {sqlResult.fields.map((field) => (
                                    <TableHead key={field} className="text-white text-xs font-mono font-semibold py-2 px-3">
                                      {field}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sqlResult.rows.map((row, i) => (
                                  <TableRow key={i} className="border-slate-900 hover:bg-slate-900/20">
                                    {sqlResult.fields.map((field) => {
                                      const val = row[field];
                                      const stringVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
                                      return (
                                        <TableCell key={field} className="text-[11px] font-mono text-slate-300 py-1.5 px-3 max-w-[200px] truncate" title={stringVal}>
                                          {stringVal}
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 3: Security admin password manager */}
          <TabsContent value="security" className="mt-0">
            <div className="grid grid-cols-1 max-w-xl">
              <Card className="border-slate-900 bg-slate-900/30 text-slate-200">
                <CardHeader>
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-primary" />
                    Alterar Senha de Administrador
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Modifique a senha que bloqueia o acesso a este Assistente de Conectividade
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="curr-pass" className="text-xs text-slate-400">Senha Atual</Label>
                      <Input
                        id="curr-pass"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="border-slate-800 bg-slate-950/80 text-white focus:border-primary/50"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="new-pass" className="text-xs text-slate-400">Nova Senha</Label>
                      <Input
                        id="new-pass"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 4 caracteres"
                        className="border-slate-800 bg-slate-950/80 text-white focus:border-primary/50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="conf-pass" className="text-xs text-slate-400">Confirmar Nova Senha</Label>
                      <Input
                        id="conf-pass"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Mínimo 4 caracteres"
                        className="border-slate-800 bg-slate-950/80 text-white focus:border-primary/50"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={changingPassword}
                      className="bg-primary text-white hover:bg-primary/95 text-xs mt-2"
                    >
                      {changingPassword ? "Alterando..." : "Alterar Senha"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
