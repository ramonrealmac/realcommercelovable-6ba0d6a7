import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Atualiza o estado para que a próxima renderização mostre a UI de fallback.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in React ErrorBoundary:", error, errorInfo);
    toast.error("Ocorreu um erro interno no sistema. Nossa equipe foi notificada.");
    
    // Aqui no futuro podemos enviar para Sentry ou uma tabela do Supabase (ex: log_erros_frontend)
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReset = () => {
    // Força o reload da página para limpar estados corrompidos
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card p-8 rounded-xl shadow-lg border border-border text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Ops! Algo deu errado.</h1>
              <p className="text-muted-foreground text-sm">
                Uma instabilidade inesperada ocorreu na interface. Tente recarregar a página para voltar ao trabalho.
              </p>
            </div>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="text-left bg-muted p-4 rounded-md overflow-auto max-h-48 text-xs font-mono text-muted-foreground border border-border">
                <p className="font-semibold text-red-500 mb-2">{this.state.error.message}</p>
                <p>{this.state.error.stack}</p>
              </div>
            )}

            <Button onClick={this.handleReset} className="w-full flex items-center gap-2" size="lg">
              <RefreshCw className="w-4 h-4" />
              Recarregar Sistema
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
