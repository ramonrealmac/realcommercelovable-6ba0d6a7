/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    checkEnvStatus: () => Promise<{ configured: boolean; url: string }>;
    getEnvConfig: () => Promise<{ VITE_SUPABASE_URL: string; VITE_SUPABASE_PUBLISHABLE_KEY: string; VITE_SUPABASE_PROJECT_ID: string }>;
    saveEnvConfig: (config: { VITE_SUPABASE_URL: string; VITE_SUPABASE_PUBLISHABLE_KEY: string }) => Promise<{ success: boolean; error?: string }>;
    loadConnections: () => Promise<any[]>;
    saveConnections: (connections: any[]) => Promise<{ success: boolean; error?: string }>;
    checkAdminPassword: (password: string) => Promise<boolean>;
    changeAdminPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
    executeSqlQuery: (connection: any, query: string) => Promise<{ success: boolean; rows: any[]; fields: string[]; rowCount: number; error?: string }>;
    restartApp: () => void;
  };
}

