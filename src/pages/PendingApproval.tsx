import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, Zap, Mail } from "lucide-react";

const PendingApproval = () => {
  const { user, signOut, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  // If they become admin, redirect
  if (!loading && isAdmin) {
    navigate("/admin", { replace: true });
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xl font-bold text-foreground tracking-tight">PanteraPay</span>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-5">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">
              Conta criada com sucesso!
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sua conta foi registrada. Um administrador precisa aprovar seu acesso ao painel de produtor.
              Você será notificado assim que o acesso for liberado.
            </p>
          </div>

          {user?.email && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg py-2.5 px-4">
              <Mail className="w-4 h-4 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
          )}

          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sair e voltar ao início
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Se você é um comprador, acesse seus produtos pelo link enviado por e-mail.
        </p>
      </div>
    </div>
  );
};

export default PendingApproval;
