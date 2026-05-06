// @ts-nocheck
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { User, Mail, Phone, KeyRound, Trash2, Loader2 } from "lucide-react";
import ProducerVerification from "@/components/admin/ProducerVerification";

const MyAccount = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || "");
      setPhone(user.user_metadata?.phone || "");
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName, phone },
    });
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Dados salvos com sucesso");
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) {
      toast.error("Erro ao enviar email");
    } else {
      toast.success("Email de redefinição enviado");
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: {},
      });

      if (error || !data?.success) {
        toast.error("Erro ao excluir conta. Tente novamente.");
        setDeleting(false);
        return;
      }

      await signOut();
      toast.success("Conta excluída com sucesso.");
      navigate("/", { replace: true });
    } catch {
      toast.error("Erro ao excluir conta.");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Configurações da Conta</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie suas informações pessoais e de contato</p>
      </div>

      {/* Personal Info */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <User className="w-4 h-4" /> Informações Pessoais
          </CardTitle>
          <p className="text-xs text-muted-foreground">Atualize seus dados pessoais e de contato</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Apelido</Label>
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Como você gostaria de ser chamado" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">E-mail</Label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <Input value={user?.email || ""} disabled className="opacity-60" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Telefone</Label>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} size="sm">Salvar alterações</Button>
            <Button variant="outline" size="sm" onClick={() => { setFullName(user?.user_metadata?.full_name || ""); setPhone(user?.user_metadata?.phone || ""); }}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>

      {/* KYC Verification */}
      <ProducerVerification />

      {/* Password */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Alteração de Senha
          </CardTitle>
          <p className="text-xs text-muted-foreground">Receba um e-mail para redefinir sua senha</p>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={handleResetPassword}>Alterar Senha</Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" /> Excluir Conta
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Esta ação é irreversível. Todos os seus dados, produtos, pedidos e configurações serão permanentemente excluídos.
          </p>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir minha conta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    Esta ação <strong>não pode ser desfeita</strong>. Isso irá excluir permanentemente:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>Sua conta e perfil</li>
                    <li>Todos os produtos e cursos</li>
                    <li>Histórico de pedidos e clientes</li>
                    <li>Configurações de checkout e pixels</li>
                    <li>Todos os dados associados</li>
                  </ul>
                  <p className="pt-2">
                    Digite <strong>EXCLUIR</strong> para confirmar:
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="EXCLUIR"
                    className="mt-2"
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "EXCLUIR" || deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    "Excluir permanentemente"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyAccount;
