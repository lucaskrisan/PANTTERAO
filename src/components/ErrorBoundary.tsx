import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import {
  isDynamicImportFailure,
  recoverFromDynamicImportFailure,
} from "@/lib/dynamicImportRecovery";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);

    if (isDynamicImportFailure(error)) {
      recoverFromDynamicImportFailure();
    }
  }

  handleReload = () => {
    if (isDynamicImportFailure(this.state.error)) {
      const recovered = recoverFromDynamicImportFailure();
      if (recovered) return;
    }

    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorMessage = this.state.error?.message || "Erro desconhecido";
      const errorStack = this.state.error?.stack || "";

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>

          {/* Detalhes técnicos do erro (sempre visíveis para diagnóstico) */}
          <details className="mt-2 max-w-2xl w-full text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
              Ver detalhes técnicos
            </summary>
            <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono text-foreground/80 overflow-auto max-h-64">
              <p className="font-semibold text-destructive break-all">{errorMessage}</p>
              {errorStack && (
                <pre className="mt-2 text-[10px] whitespace-pre-wrap break-all opacity-70">
                  {errorStack.split("\n").slice(0, 8).join("\n")}
                </pre>
              )}
            </div>
          </details>

          <div className="flex gap-2">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Recarregar
            </button>
            <button
              onClick={() => {
                window.location.href = "/login";
              }}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
            >
              Voltar ao login
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
