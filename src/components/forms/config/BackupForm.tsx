import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Database, 
  FolderOpen, 
  RefreshCw, 
  Play, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Server, 
  Calendar,
  AlertCircle,
  FileDown,
  Copy,
  Terminal,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ElectronAPI {
  selectDirectory: () => Promise<string | undefined>;
}

interface CustomWindow {
  electronAPI?: ElectronAPI;
}

interface SysConfig {
  id: string;
  db_server_host: string;
  db_server_port: string;
  db_name: string;
  db_port: string;
  db_version: string;
  backup_folder_path: string;
  backup_periodicity: string;
  backup_time: string;
  system_folder_path: string;
  supabase_folder_path: string;
}

interface BackupLog {
  id: string;
  backup_type: string;
  status: string;
  file_name: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

const BackupForm: React.FC = () => {
  // States
  const [config, setConfig] = useState<SysConfig>({
    id: "00000000-0000-0000-0000-000000000000",
    db_server_host: "localhost",
    db_server_port: "5432",
    db_name: "postgres",
    db_port: "5432",
    db_version: "1.15.0",
    backup_folder_path: "",
    backup_periodicity: "manual",
    backup_time: "03:00",
    system_folder_path: "",
    supabase_folder_path: ""
  });
  
  const [systemVersion, setSystemVersion] = useState<string>("1.15.0");
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  
  // Local only states (not stored in DB)
  const [dbPassword, setDbPassword] = useState<string>("");
  const [scriptType, setScriptType] = useState<"windows" | "linux">("windows");
  
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [triggeringBackup, setTriggeringBackup] = useState<string | null>(null); // 'database' | 'system'
  
  const customWindow = typeof window !== "undefined" ? (window as unknown as CustomWindow) : null;
  const isElectron = !!customWindow?.electronAPI;

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch system config
      const { data: configData, error: configError } = await supabase
        .from("sys_config")
        .select("*")
        .eq("id", "00000000-0000-0000-0000-000000000000")
        .maybeSingle();

      if (configError) throw configError;
      if (configData) {
        // Fallback for fields added in subsequent migrations
        setConfig({
          id: configData.id,
          db_server_host: configData.db_server_host || "localhost",
          db_server_port: configData.db_server_port || "5432",
          db_name: configData.db_name || "postgres",
          db_port: configData.db_port || "5432",
          db_version: configData.db_version || "1.15.0",
          backup_folder_path: configData.backup_folder_path || "",
          backup_periodicity: configData.backup_periodicity || "manual",
          backup_time: configData.backup_time || "03:00",
          system_folder_path: configData.system_folder_path || "",
          supabase_folder_path: configData.supabase_folder_path || ""
        });
      } else {
        // If not found, insert default and set state
        const defaultConfig = {
          id: "00000000-0000-0000-0000-000000000000",
          db_server_host: "localhost",
          db_server_port: "5432",
          db_name: "postgres",
          db_port: "5432",
          db_version: "1.15.0",
          backup_folder_path: "",
          backup_periodicity: "manual",
          backup_time: "03:00",
          system_folder_path: "",
          supabase_folder_path: ""
        };
        await supabase.from("sys_config").insert(defaultConfig);
        setConfig(defaultConfig);
      }

      // 2. Fetch latest system version from sistema_versoes
      const { data: versionData } = await supabase
        .from("sistema_versoes")
        .select("versao")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (versionData?.versao) {
        setSystemVersion(versionData.versao);
      }

      // 3. Fetch recent backup logs
      const { data: logsData, error: logsError } = await supabase
        .from("sys_backup_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(15);
      
      if (logsError) throw logsError;
      setBackupLogs((logsData as BackupLog[]) || []);

    } catch (error: unknown) {
      console.error("Error loading backup params:", error);
      toast.error("Erro ao carregar dados de configuração e backup. Verifique se as tabelas sys_config e sys_backup_log foram criadas no Supabase.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save Settings
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from("sys_config")
        .update({
          db_server_host: config.db_server_host,
          db_server_port: config.db_server_port,
          db_name: config.db_name,
          db_port: config.db_port,
          db_version: config.db_version,
          backup_folder_path: config.backup_folder_path,
          backup_periodicity: config.backup_periodicity,
          backup_time: config.backup_time,
          system_folder_path: config.system_folder_path,
          supabase_folder_path: config.supabase_folder_path,
          updated_at: new Date().toISOString()
        })
        .eq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;
      toast.success("Parâmetros do sistema e banco atualizados com sucesso!");
    } catch (error: unknown) {
      console.error("Error saving config:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Falha ao salvar configurações: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Open Directory Dialog in Electron
  const handleSelectFolder = async (field: "backup" | "system" | "supabase") => {
    if (!isElectron) {
      toast.info("Seletor de pastas nativo disponível apenas no aplicativo desktop.");
      return;
    }
    
    try {
      const selectedPath = await customWindow?.electronAPI?.selectDirectory();
      if (selectedPath) {
        if (field === "backup") {
          setConfig(prev => ({ ...prev, backup_folder_path: selectedPath }));
        } else if (field === "system") {
          setConfig(prev => ({ ...prev, system_folder_path: selectedPath }));
        } else if (field === "supabase") {
          setConfig(prev => ({ ...prev, supabase_folder_path: selectedPath }));
        }
        toast.success(`Pasta selecionada: ${selectedPath}`);
      }
    } catch (error) {
      console.error("Error selecting folder:", error);
      toast.error("Falha ao abrir o seletor de pastas.");
    }
  };

  // Trigger Manual Backup
  const handleRunBackup = async (type: "database" | "system") => {
    setTriggeringBackup(type);
    try {
      const { data, error } = await supabase
        .from("sys_backup_log")
        .insert({
          backup_type: type,
          status: "pending",
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success(`Backup do ${type === "database" ? "Banco de Dados" : "Sistema"} enfileirado com sucesso.`);
      setBackupLogs(prev => [data as BackupLog, ...prev]);
    } catch (error: unknown) {
      console.error("Error running backup:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao disparar backup: ${errorMessage}`);
    } finally {
      setTriggeringBackup(null);
    }
  };

  // Format File Size
  const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return "-";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Format date helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  // Generate Backup Automation Scripts
  const handleDownloadScript = () => {
    const time = config.backup_time || "03:00";
    const sysPath = config.system_folder_path || "";
    const supaPath = config.supabase_folder_path || "";
    const backupPath = config.backup_folder_path || "";
    const dbHost = config.db_server_host;
    const dbPort = config.db_server_port;
    const dbName = config.db_name;
    const dbPortNum = config.db_port;
    const dbPass = dbPassword || "SUA_SENHA_AQUI";

    if (!backupPath) {
      toast.warning("Por favor, preencha o caminho da pasta de backup antes de gerar o script.");
      return;
    }

    const formattedSysPath = scriptType === "windows" ? sysPath.replace(/\//g, "\\") : sysPath.replace(/\\/g, "/");
    const formattedSupaPath = scriptType === "windows" ? supaPath.replace(/\//g, "\\") : supaPath.replace(/\\/g, "/");
    const formattedBackupPath = scriptType === "windows" ? backupPath.replace(/\//g, "\\") : backupPath.replace(/\\/g, "/");

    let scriptContent = "";
    let fileName = "";
    let mimeType = "";

    const supaUrl = import.meta.env.VITE_SUPABASE_URL || "";
    const supaKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

    if (scriptType === "windows") {
      fileName = "automacao_backup_realsys.bat";
      mimeType = "text/plain";
      scriptContent = `@echo off
:: Script de Backup Automatico - RealSys
:: Gerado em: ${new Date().toLocaleDateString("pt-BR")}

set DB_HOST=${dbHost}
set DB_PORT=${dbPortNum}
set DB_NAME=${dbName}
set DB_USER=postgres
set DB_PASSWORD=${dbPass}
set BACKUP_DIR=${formattedBackupPath}
set SYSTEM_DIR=${formattedSysPath}
set SUPABASE_DIR=${formattedSupaPath}
set SUPABASE_URL=${supaUrl}
set SUPABASE_KEY=${supaKey}

:: Obter carimbo de data e hora para os arquivos
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (set mytime=%%a%%b)
set FILE_SUFFIX=%mydate%_%mytime%

echo ==============================================
echo [1/3] Realizando backup do Banco de Dados...
echo ==============================================
set PGPASSWORD=%DB_PASSWORD%
pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -F c -b -v -f "%BACKUP_DIR%\\db_backup_%FILE_SUFFIX%.sql" %DB_NAME%

if %ERRORLEVEL% neq 0 (
  echo ERRO: Falha ao gerar o dump do banco de dados.
  curl -X POST "%SUPABASE_URL%/rest/v1/sys_backup_log" ^
    -H "apikey: %SUPABASE_KEY%" ^
    -H "Authorization: Bearer %SUPABASE_KEY%" ^
    -H "Content-Type: application/json" ^
    -d "{\\"backup_type\\":\\"database\\", \\"status\\":\\"failed\\", \\"error_message\\":\\"pg_dump exit code %ERRORLEVEL%\\"}"
) else (
  for %%I in ("%BACKUP_DIR%\\db_backup_%FILE_SUFFIX%.sql") do set FILE_SIZE=%%~zI
  curl -X POST "%SUPABASE_URL%/rest/v1/sys_backup_log" ^
    -H "apikey: %SUPABASE_KEY%" ^
    -H "Authorization: Bearer %SUPABASE_KEY%" ^
    -H "Content-Type: application/json" ^
    -d "{\\"backup_type\\":\\"database\\", \\"status\\":\\"success\\", \\"file_name\\":\\"db_backup_%FILE_SUFFIX%.sql\\", \\"file_size_bytes\\":%FILE_SIZE%}"
)

echo ==============================================
echo [2/3] Compactando pasta de arquivos do Sistema...
echo ==============================================
if exist "%SYSTEM_DIR%" (
    tar -czf "%BACKUP_DIR%\\system_backup_%FILE_SUFFIX%.tar.gz" -C "%SYSTEM_DIR%" .
    if %ERRORLEVEL% neq 0 (
      curl -X POST "%SUPABASE_URL%/rest/v1/sys_backup_log" ^
        -H "apikey: %SUPABASE_KEY%" ^
        -H "Authorization: Bearer %SUPABASE_KEY%" ^
        -H "Content-Type: application/json" ^
        -d "{\\"backup_type\\":\\"system\\", \\"status\\":\\"failed\\", \\"error_message\\":\\"tar system files exit code %ERRORLEVEL%\\"}"
    ) else (
      for %%I in ("%BACKUP_DIR%\\system_backup_%FILE_SUFFIX%.tar.gz") do set FILE_SIZE=%%~zI
      curl -X POST "%SUPABASE_URL%/rest/v1/sys_backup_log" ^
        -H "apikey: %SUPABASE_KEY%" ^
        -H "Authorization: Bearer %SUPABASE_KEY%" ^
        -H "Content-Type: application/json" ^
        -d "{\\"backup_type\\":\\"system\\", \\"status\\":\\"success\\", \\"file_name\\":\\"system_backup_%FILE_SUFFIX%.tar.gz\\", \\"file_size_bytes\\":%FILE_SIZE%}"
    )
) else (
    echo AVISO: Pasta de origem do sistema nao encontrada.
)

echo ==============================================
echo [3/3] Compactando pasta de arquivos do Supabase...
echo ==============================================
if exist "%SUPABASE_DIR%" (
    tar -czf "%BACKUP_DIR%\\supabase_backup_%FILE_SUFFIX%.tar.gz" -C "%SUPABASE_DIR%" .
    if %ERRORLEVEL% neq 0 (
      curl -X POST "%SUPABASE_URL%/rest/v1/sys_backup_log" ^
        -H "apikey: %SUPABASE_KEY%" ^
        -H "Authorization: Bearer %SUPABASE_KEY%" ^
        -H "Content-Type: application/json" ^
        -d "{\\"backup_type\\":\\"system\\", \\"status\\":\\"failed\\", \\"error_message\\":\\"tar supabase volumes exit code %ERRORLEVEL%\\"}"
    ) else (
      for %%I in ("%BACKUP_DIR%\\supabase_backup_%FILE_SUFFIX%.tar.gz") do set FILE_SIZE=%%~zI
      curl -X POST "%SUPABASE_URL%/rest/v1/sys_backup_log" ^
        -H "apikey: %SUPABASE_KEY%" ^
        -H "Authorization: Bearer %SUPABASE_KEY%" ^
        -H "Content-Type: application/json" ^
        -d "{\\"backup_type\\":\\"system\\", \\"status\\":\\"success\\", \\"file_name\\":\\"supabase_backup_%FILE_SUFFIX%.tar.gz\\", \\"file_size_bytes\\":%FILE_SIZE%}"
    )
) else (
    echo AVISO: Pasta de origem do Supabase nao encontrada.
)

echo Backup concluido com sucesso em %DATE% %TIME%!
`;
    } else {
      fileName = "automacao_backup_realsys.sh";
      mimeType = "text/x-sh";
      scriptContent = `#!/bin/bash
# Script de Backup Automático - RealSys
# Gerado em: ${new Date().toLocaleDateString("pt-BR")}

DB_HOST="${dbHost}"
DB_PORT="${dbPortNum}"
DB_NAME="${dbName}"
DB_USER="postgres"
DB_PASSWORD="${dbPass}"
BACKUP_DIR="${formattedBackupPath}"
SYSTEM_DIR="${formattedSysPath}"
SUPABASE_DIR="${formattedSupaPath}"
SUPABASE_URL="${supaUrl}"
SUPABASE_KEY="${supaKey}"

FILE_SUFFIX=$(date +%Y-%m-%d_%H%M)

echo "=============================================="
echo "[1/3] Realizando backup do Banco de Dados..."
echo "=============================================="
export PGPASSWORD="$DB_PASSWORD"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -F c -b -v -f "$BACKUP_DIR/db_backup_$FILE_SUFFIX.sql" "$DB_NAME"
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "ERRO: Falha ao gerar o dump do banco de dados."
  curl -X POST "$SUPABASE_URL/rest/v1/sys_backup_log" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\\"backup_type\\":\\"database\\", \\"status\\":\\"failed\\", \\"error_message\\":\\"pg_dump exit code $EXIT_CODE\\"}"
else
  FILE_SIZE=$(stat -c%s "$BACKUP_DIR/db_backup_$FILE_SUFFIX.sql")
  curl -X POST "$SUPABASE_URL/rest/v1/sys_backup_log" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\\"backup_type\\":\\"database\\", \\"status\\":\\"success\\", \\"file_name\\":\\"db_backup_$FILE_SUFFIX.sql\\", \\"file_size_bytes\\":$FILE_SIZE}"
fi

echo "=============================================="
echo "[2/3] Compactando pasta de arquivos do Sistema..."
echo "=============================================="
if [ -d "$SYSTEM_DIR" ]; then
    tar -czf "$BACKUP_DIR/system_backup_$FILE_SUFFIX.tar.gz" -C "$SYSTEM_DIR" .
    EXIT_CODE=$?
    if [ $EXIT_CODE -ne 0 ]; then
      curl -X POST "$SUPABASE_URL/rest/v1/sys_backup_log" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\\"backup_type\\":\\"system\\", \\"status\\":\\"failed\\", \\"error_message\\":\\"tar system files exit code $EXIT_CODE\\"}"
    else
      FILE_SIZE=$(stat -c%s "$BACKUP_DIR/system_backup_$FILE_SUFFIX.tar.gz")
      curl -X POST "$SUPABASE_URL/rest/v1/sys_backup_log" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\\"backup_type\\":\\"system\\", \\"status\\":\\"success\\", \\"file_name\\":\\"system_backup_$FILE_SUFFIX.tar.gz\\", \\"file_size_bytes\\":$FILE_SIZE}"
    fi
else
    echo "AVISO: Pasta de origem do sistema não encontrada."
fi

echo "=============================================="
echo "[3/3] Compactando pasta de arquivos do Supabase..."
echo "=============================================="
if [ -d "$SUPABASE_DIR" ]; then
    tar -czf "$BACKUP_DIR/supabase_backup_$FILE_SUFFIX.tar.gz" -C "$SUPABASE_DIR" .
    EXIT_CODE=$?
    if [ $EXIT_CODE -ne 0 ]; then
      curl -X POST "$SUPABASE_URL/rest/v1/sys_backup_log" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\\"backup_type\\":\\"system\\", \\"status\\":\\"failed\\", \\"error_message\\":\\"tar supabase volumes exit code $EXIT_CODE\\"}"
    else
      FILE_SIZE=$(stat -c%s "$BACKUP_DIR/supabase_backup_$FILE_SUFFIX.tar.gz")
      curl -X POST "$SUPABASE_URL/rest/v1/sys_backup_log" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\\"backup_type\\":\\"system\\", \\"status\\":\\"success\\", \\"file_name\\":\\"supabase_backup_$FILE_SUFFIX.tar.gz\\", \\"file_size_bytes\\":$FILE_SIZE}"
    fi
else
    echo "AVISO: Pasta de origem do Supabase não encontrada."
fi

echo "Backup concluído com sucesso em $(date)"
`;
    }

    const blob = new Blob([scriptContent], { type: `${mimeType};charset=utf-8;` });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Script ${fileName} baixado com sucesso!`);
  };

  // Get Scheduling commands
  const getSchedulingCommand = () => {
    const time = config.backup_time || "03:00";
    const periodicity = config.backup_periodicity;
    const backupPath = config.backup_folder_path || "C:\\backups";
    
    if (periodicity === "manual") {
      return "Periodicidade definida como 'Manual'. Altere para Diário, Semanal ou Mensal para obter o comando de agendamento.";
    }

    if (scriptType === "windows") {
      const scriptPath = `${backupPath.replace(/\//g, "\\")}\\automacao_backup_realsys.bat`;
      let sc = "DAILY";
      if (periodicity === "weekly") sc = "WEEKLY";
      if (periodicity === "monthly") sc = "MONTHLY";
      return `schtasks /create /tn "RealSysBackup" /tr "${scriptPath}" /sc ${sc} /st ${time} /ru SYSTEM /f`;
    } else {
      const [hour, minute] = time.split(":");
      let cronTime = `${minute || "0"} ${hour || "3"} * * *`;
      if (periodicity === "weekly") cronTime = `${minute || "0"} ${hour || "3"} * * 0`;
      if (periodicity === "monthly") cronTime = `${minute || "0"} ${hour || "3"} 1 * *`;
      const linuxPath = `${backupPath.replace(/\\/g, "/")}/automacao_backup_realsys.sh`;
      return `(crontab -l 2>/dev/null; echo "${cronTime} chmod +x ${linuxPath} && ${linuxPath}") | crontab -`;
    }
  };

  const handleCopyCommand = () => {
    const command = getSchedulingCommand();
    if (config.backup_periodicity === "manual") {
      toast.warning("Altere a periodicidade de manual para gerar um comando copiável.");
      return;
    }
    navigator.clipboard.writeText(command);
    toast.success("Comando copiado para a área de transferência!");
  };

  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
  const suggestedHost = projectRef ? `db.${projectRef}.supabase.co` : "";

  // Check version alignment
  const isAligned = config.db_version.trim() === systemVersion.trim();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background p-8 gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-semibold">Carregando painel de backup...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto p-6 gap-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border pb-6 gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-500" />
            <span className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">Administração de Sistema</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Configuração de Backup & Banco</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os dados de conexão do servidor de banco de dados, diretórios de cópias de segurança e agendamentos.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={fetchData}
          className="text-xs font-semibold uppercase h-10 px-4 flex items-center gap-2 self-start md:self-auto hover:border-indigo-500/40"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sincronizar
        </Button>
      </div>

      {/* Alignment Alert Banner */}
      <div className="grid grid-cols-1 gap-6">
        {isAligned ? (
          <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-800 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <h4 className="font-bold text-sm">Banco de Dados Alinhado</h4>
              <p className="text-xs mt-0.5 opacity-90">
                A versão do banco de dados (v{config.db_version}) está perfeitamente sincronizada com a versão atual do sistema (v{systemVersion}). Todas as migrações necessárias estão aplicadas.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-800 dark:text-amber-300 animate-pulse">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
            <div>
              <h4 className="font-bold text-sm">Desalinhamento Detectado</h4>
              <p className="text-xs mt-0.5 opacity-90">
                A versão registrada no banco (v{config.db_version}) é diferente da versão do executável do sistema (v{systemVersion}). Verifique se há migrações pendentes ou atualize o campo de versão após realizar correções estruturais manuais.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection & Configuration Form Card */}
        <Card className="lg:col-span-2 border-border/80 bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" /> Parâmetros de Instalação e Banco
            </CardTitle>
            <CardDescription>Configure os caminhos locais e as chaves de conexão do banco de dados PostgreSQL.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveConfig} className="flex flex-col gap-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* DB Server Host */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Servidor do Banco (Endereço Host)</label>
                  <Input 
                    value={config.db_server_host} 
                    onChange={e => setConfig(prev => ({ ...prev, db_server_host: e.target.value }))}
                    placeholder="localhost ou IP do servidor"
                    required
                    className="focus-visible:ring-indigo-500/30"
                  />
                  {suggestedHost && config.db_server_host === "localhost" && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfig(prev => ({
                          ...prev,
                          db_server_host: suggestedHost,
                          db_server_port: "5432",
                          db_name: "postgres",
                          db_port: "5432"
                        }));
                        toast.success("Parâmetros do Supabase preenchidos! Lembre-se de salvar.");
                      }}
                      className="text-[10px] text-indigo-500 hover:text-indigo-600 font-bold underline mt-1 self-start flex items-center gap-1 transition-all"
                    >
                      ✨ Preencher automaticamente com banco na nuvem (.env)
                    </button>
                  )}
                </div>
                
                {/* DB Server Port */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Porta do Servidor</label>
                  <Input 
                    value={config.db_server_port} 
                    onChange={e => setConfig(prev => ({ ...prev, db_server_port: e.target.value }))}
                    placeholder="Ex: 5432"
                    required
                    className="focus-visible:ring-indigo-500/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* DB Name */}
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Nome do Banco de Dados</label>
                  <Input 
                    value={config.db_name} 
                    onChange={e => setConfig(prev => ({ ...prev, db_name: e.target.value }))}
                    placeholder="Ex: realcommerce"
                    required
                    className="focus-visible:ring-indigo-500/30"
                  />
                </div>

                {/* DB Port */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Porta do Banco</label>
                  <Input 
                    value={config.db_port} 
                    onChange={e => setConfig(prev => ({ ...prev, db_port: e.target.value }))}
                    placeholder="Ex: 5432"
                    required
                    className="focus-visible:ring-indigo-500/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* DB Version input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Versão Registrada do Banco</label>
                  <Input 
                    value={config.db_version} 
                    onChange={e => setConfig(prev => ({ ...prev, db_version: e.target.value }))}
                    placeholder="Ex: 1.15.0"
                    required
                    className="focus-visible:ring-indigo-500/30 font-mono font-bold"
                  />
                </div>

                {/* DB Version alignment indicator */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase font-sans">Versão do Executável do Sistema</label>
                  <Input 
                    value={systemVersion} 
                    disabled 
                    className="bg-muted text-muted-foreground font-mono font-bold select-none cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="border-t border-border/60 pt-4 mt-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Diretórios e Caminhos no Servidor</h4>
                
                <div className="grid grid-cols-1 gap-4">
                  {/* Backup Folder Path input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Pasta Local de Destino do Backup</label>
                    <div className="flex gap-2">
                      <Input 
                        value={config.backup_folder_path} 
                        onChange={e => setConfig(prev => ({ ...prev, backup_folder_path: e.target.value }))}
                        placeholder="Ex: C:/Caminho/Da/Pasta/De/Backup"
                        required
                        className="flex-1 focus-visible:ring-indigo-500/30 font-mono text-xs"
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => handleSelectFolder("backup")}
                        className="flex items-center gap-1.5 text-xs font-semibold shrink-0 hover:border-indigo-500/40"
                        title={isElectron ? "Selecionar pasta" : "Seletor nativo requer o App Desktop"}
                      >
                        <FolderOpen className="w-4 h-4 text-indigo-500" />
                        {isElectron ? "Procurar..." : "Navegador"}
                      </Button>
                    </div>
                  </div>

                  {/* System Origin Folder Path */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Pasta de Origem do Sistema (Arquivos / Container)</label>
                    <div className="flex gap-2">
                      <Input 
                        value={config.system_folder_path} 
                        onChange={e => setConfig(prev => ({ ...prev, system_folder_path: e.target.value }))}
                        placeholder="Ex: C:/Projetos/Realcommerce"
                        className="flex-1 focus-visible:ring-indigo-500/30 font-mono text-xs"
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => handleSelectFolder("system")}
                        className="flex items-center gap-1.5 text-xs font-semibold shrink-0 hover:border-indigo-500/40"
                        title={isElectron ? "Selecionar pasta" : "Seletor nativo requer o App Desktop"}
                      >
                        <FolderOpen className="w-4 h-4 text-indigo-500" />
                        {isElectron ? "Procurar..." : "Navegador"}
                      </Button>
                    </div>
                  </div>

                  {/* Supabase Origin Folder Path */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Pasta de Origem do Supabase (Dados / Container)</label>
                    <div className="flex gap-2">
                      <Input 
                        value={config.supabase_folder_path} 
                        onChange={e => setConfig(prev => ({ ...prev, supabase_folder_path: e.target.value }))}
                        placeholder="Ex: C:/Projetos/Realcommerce/supabase"
                        className="flex-1 focus-visible:ring-indigo-500/30 font-mono text-xs"
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => handleSelectFolder("supabase")}
                        className="flex items-center gap-1.5 text-xs font-semibold shrink-0 hover:border-indigo-500/40"
                        title={isElectron ? "Selecionar pasta" : "Seletor nativo requer o App Desktop"}
                      >
                        <FolderOpen className="w-4 h-4 text-indigo-500" />
                        {isElectron ? "Procurar..." : "Navegador"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action save button */}
              <div className="flex justify-end mt-2">
                <Button 
                  type="submit" 
                  disabled={saving} 
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Parâmetros
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>

        {/* Manual Actions Card */}
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Play className="w-4 h-4 text-indigo-500" /> Ações de Backup Manual
            </CardTitle>
            <CardDescription>Inicie imediatamente a cópia de segurança do sistema.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            
            <div className="flex flex-col p-4 bg-muted/30 border border-border/60 rounded-lg gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Database className="w-4 h-4 text-indigo-500" /> Banco de Dados
              </div>
              <p className="text-xs text-muted-foreground leading-normal">
                Gera um dump <code>.sql</code> completo contendo todas as tabelas, schemas, triggers e dados do Supabase.
              </p>
              <Button 
                onClick={() => handleRunBackup("database")}
                disabled={triggeringBackup !== null}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase py-2 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {triggeringBackup === "database" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-indigo-400" />}
                Executar Backup do Banco
              </Button>
            </div>

            <div className="flex flex-col p-4 bg-muted/30 border border-border/60 rounded-lg gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <FileText className="w-4 h-4 text-indigo-500" /> Arquivos do Sistema
              </div>
              <p className="text-xs text-muted-foreground leading-normal">
                Compacta em <code>.tar.gz</code> o diretório de dados do sistema, volumes de upload e arquivos estáticos configurados.
              </p>
              <Button 
                onClick={() => handleRunBackup("system")}
                disabled={triggeringBackup !== null}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase py-2 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {triggeringBackup === "system" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-indigo-400" />}
                Executar Backup do Sistema
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Task scheduler and script downloader section */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" /> ⏰ Automação e Agendamento no Sistema Operacional
            </CardTitle>
            <CardDescription>
              Configure o agendamento e faça o download do script para execução programada automática no seu servidor.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              {/* Periodicity Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Automação / Periodicidade</label>
                <select 
                  value={config.backup_periodicity}
                  onChange={e => setConfig(prev => ({ ...prev, backup_periodicity: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="manual">Manual (Sem automação)</option>
                  <option value="daily">Diário (Todos os dias)</option>
                  <option value="weekly">Semanal (Uma vez por semana)</option>
                  <option value="monthly">Mensal (Uma vez por mês)</option>
                </select>
              </div>

              {/* Time picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Horário de Execução</label>
                <Input 
                  type="time" 
                  value={config.backup_time}
                  onChange={e => setConfig(prev => ({ ...prev, backup_time: e.target.value }))}
                  className="focus-visible:ring-indigo-500/30"
                  disabled={config.backup_periodicity === "manual"}
                />
              </div>

              {/* Temp Database password input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                  Senha do Banco <Shield className="w-3.5 h-3.5 text-amber-500" title="Apenas para uso local no script" />
                </label>
                <Input 
                  type="password" 
                  value={dbPassword}
                  onChange={e => setDbPassword(e.target.value)}
                  placeholder="Redigite para o script"
                  className="focus-visible:ring-indigo-500/30 font-mono text-xs"
                />
              </div>

              {/* Script Type selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Sistema do Servidor</label>
                <select 
                  value={scriptType}
                  onChange={e => setScriptType(e.target.value as "windows" | "linux")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="windows">Windows (.bat)</option>
                  <option value="linux">Linux (.sh)</option>
                </select>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col md:flex-row gap-4 border-t border-border/60 pt-4">
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Terminal className="w-4 h-4 text-indigo-500" /> Comando de Agendamento no Sistema
                </span>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 bg-muted px-3 py-2.5 rounded border border-border/60 font-mono text-xs text-foreground/80 break-all select-all flex items-center min-h-[38px]">
                    {getSchedulingCommand()}
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCopyCommand}
                    className="shrink-0 hover:border-indigo-500/40"
                    title="Copiar comando"
                    disabled={config.backup_periodicity === "manual"}
                  >
                    <Copy className="w-4 h-4 text-indigo-500" />
                  </Button>
                </div>
              </div>

              <div className="shrink-0 flex items-end">
                <Button 
                  onClick={handleDownloadScript}
                  className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all h-10"
                >
                  <FileDown className="w-4 h-4" />
                  Gerar e Baixar Script
                </Button>
              </div>
            </div>

            {/* Instructions box */}
            {config.backup_periodicity !== "manual" && (
              <div className="bg-muted/40 p-4 border border-border/60 rounded-lg text-xs leading-relaxed text-muted-foreground flex flex-col gap-2">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-indigo-500" /> Instruções de Ativação do Agendamento:
                </span>
                {scriptType === "windows" ? (
                  <ol className="list-decimal pl-4 space-y-1.5">
                    <li>Insira a senha do banco acima e clique em <b>Gerar e Baixar Script</b> para fazer o download do arquivo <code>automacao_backup_realsys.bat</code>.</li>
                    <li>Mova o arquivo baixado para o diretório de destino configurado (ex: <code>{config.backup_folder_path || "C:\\backups"}</code>).</li>
                    <li>Copie o comando gerado acima clicando no botão de cópia.</li>
                    <li>Abra o menu iniciar, digite <b>Prompt de Comando (CMD)</b>, clique com o botão direito e selecione <b>Executar como Administrador</b>.</li>
                    <li>Cole o comando no terminal e pressione Enter. A tarefa diária será adicionada com sucesso rodando em segundo plano.</li>
                  </ol>
                ) : (
                  <ol className="list-decimal pl-4 space-y-1.5">
                    <li>Insira a senha do banco acima e clique em <b>Gerar e Baixar Script</b> para baixar o arquivo <code>automacao_backup_realsys.sh</code>.</li>
                    <li>Envie o arquivo para o seu servidor Linux no diretório correto (ex: <code>{config.backup_folder_path || "/var/backups"}</code>).</li>
                    <li>Copie o comando de cron gerado acima.</li>
                    <li>Acesse o terminal do seu servidor Linux como usuário padrão ou root.</li>
                    <li>Cole e execute o comando copiado. Ele adicionará o script automaticamente no crontab e concederá permissões de execução.</li>
                  </ol>
                )}
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      {/* Backup Execution Logs Table */}
      <Card className="border-border/80 bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Histórico de Execuções de Backup
            </CardTitle>
            <CardDescription>Acompanhe o andamento dos backups automáticos e manuais em execução no servidor.</CardDescription>
          </div>
          
          <Badge className="bg-muted hover:bg-muted text-muted-foreground border border-border px-2.5 py-1 text-xs shrink-0 font-mono font-bold uppercase">
            Últimas 15 operações
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto w-full border border-border/60 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold uppercase text-[10px] tracking-wider select-none">
                  <th className="p-3">Data de Início</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Nome do Arquivo</th>
                  <th className="p-3 text-right">Tamanho</th>
                  <th className="p-3">Fim / Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {backupLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                      Nenhum registro de backup foi encontrado.
                    </td>
                  </tr>
                ) : (
                  backupLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/15 transition-colors font-medium">
                      
                      {/* Started Date */}
                      <td className="p-3 text-xs font-semibold text-muted-foreground font-mono">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
                          {formatDate(log.started_at)}
                        </div>
                      </td>
                      
                      {/* Type Badge */}
                      <td className="p-3">
                        <Badge variant="outline" className="font-bold text-[10px] uppercase font-mono px-2 py-0.5 shadow-sm border-indigo-500/20 bg-indigo-500/5 text-indigo-600">
                          {log.backup_type === "database" ? "Banco (SQL)" : "Sistema"}
                        </Badge>
                      </td>
                      
                      {/* Status */}
                      <td className="p-3">
                        {log.status === "success" && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/15 font-bold uppercase text-[9px] tracking-wide">
                            Sucesso
                          </Badge>
                        )}
                        {log.status === "failed" && (
                          <Badge className="bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 font-bold uppercase text-[9px] tracking-wide">
                            Falha
                          </Badge>
                        )}
                        {log.status === "pending" && (
                          <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/15 font-bold uppercase text-[9px] tracking-wide animate-pulse">
                            Pendente
                          </Badge>
                        )}
                        {log.status === "in_progress" && (
                          <Badge className="bg-sky-500/10 text-sky-600 border border-sky-500/20 hover:bg-sky-500/15 font-bold uppercase text-[9px] tracking-wide animate-pulse">
                            Processando
                          </Badge>
                        )}
                      </td>
                      
                      {/* File Name */}
                      <td className="p-3 text-xs font-mono font-semibold max-w-[200px] truncate text-foreground/90" title={log.file_name || ""}>
                        <div className="flex items-center gap-1.5">
                          <FileDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                          {log.file_name || "Gerando..."}
                        </div>
                      </td>
                      
                      {/* File Size */}
                      <td className="p-3 text-right text-xs font-mono font-semibold text-muted-foreground">
                        {formatBytes(log.file_size_bytes)}
                      </td>
                      
                      {/* Error / Completed time */}
                      <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.status === "failed" ? (
                          <span className="text-destructive font-bold flex items-center gap-1" title={log.error_message || ""}>
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {log.error_message || "Erro desconhecido"}
                          </span>
                        ) : (
                          <span>{log.completed_at ? formatDate(log.completed_at) : "-"}</span>
                        )}
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupForm;
