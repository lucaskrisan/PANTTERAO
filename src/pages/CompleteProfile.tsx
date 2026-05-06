import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserPlus, FileText, Phone, ShieldCheck, Loader2 } from "lucide-react";
import { validateCpfCnpj, validatePhone } from "@/lib/validators";

const formatCpfCnpj = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

// Validation now uses shared validators from @/lib/validators

const CompleteProfile = () => {
  const { user, loading: authLoading, refreshRoles, signOut } = useAuth();
  const navigate = useNavigate();
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cpfError, setCpfError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    // If profile is already completed, skip this page and let root resolver decide destination
    let cancelled = false;
    const checkProfile = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("profile_completed")
          .eq("id", user.id)
          .single();
        if (!cancelled && data?.profile_completed === true) {
          navigate("/", { replace: true });
        }
      } catch {
        // stay on page if check fails
      }
    };
    checkProfile();
    return () => { cancelled = true; };
  }, [user, authLoading, navigate]);

  const handleCpfChange = (value: string) => {
    const formatted = formatCpfCnpj(value);
    setCpf(formatted);
    setCpfError("");
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate CPF/CNPJ using shared validator
    const cpfResult = validateCpfCnpj(cpf);
    if (!cpfResult.valid) {
      setCpfError(cpfResult.error);
      return;
    }

    // Validate phone
    const phoneResult = validatePhone(phone);
    if (!phoneResult.valid) {
      toast.error(phoneResult.error);
      return;
    }

    if (!acceptTerms) {
      toast.error("Aceite os termos para continuar");
      return;
    }

    setSaving(true);
    const cleanCpf = cpf.replace(/\D/g, "");
    const cleanPhone = phone.replace(/\D/g, "");
    const { error } = await supabase
      .from("profiles")
      .update({
        cpf: cleanCpf,
        phone: cleanPhone,
        profile_completed: true,
      })
      .eq("id", user!.id);

    if (error) {
      toast.error("Erro ao salvar dados");
      setSaving(false);
      return;
    }

    // Wait a moment for DB trigger to fire, then refresh roles
    await new Promise(r => setTimeout(r, 500));
    await refreshRoles();

    toast.success("Perfil completo! Redirecionando...");
    navigate("/", { replace: true });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const userEmail = user?.email || "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-slate-700/60 rounded-2xl flex items-center justify-center mx-auto border border-slate-600/30">
            <UserPlus className="w-7 h-7 text-slate-300" />
          </div>
          <h1 className="text-2xl font-bold text-white">Complete seu Perfil</h1>
          <p className="text-sm text-slate-400">
            Precisamos de algumas informações adicionais para continuar
          </p>
        </div>

        {/* Account info card */}
        <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-2">Dados da sua conta:</p>
          <p className="text-sm text-white">
            <span className="text-slate-400">Nome:</span> {userName}
          </p>
          <p className="text-sm text-white">
            <span className="text-slate-400">Email:</span> {userEmail}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-white">
              CPF ou CNPJ <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                placeholder="000.000.000-00"
                maxLength={18}
                className={`pl-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-primary ${
                  cpfError ? "border-red-500 focus:border-red-500" : ""
                }`}
                required
              />
            </div>
            {cpfError && <p className="text-xs text-red-400">{cpfError}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-white">
              Telefone <span className="text-red-400">*</span>
            </Label>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 h-12 shrink-0">
                <span className="text-lg">🇧🇷</span>
                <span className="text-sm text-slate-400">+55</span>
              </div>
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="pl-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-primary"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={acceptTerms}
              onCheckedChange={(v) => setAcceptTerms(v === true)}
              className="mt-0.5 border-slate-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <label htmlFor="terms" className="text-sm text-slate-400 leading-relaxed cursor-pointer">
              Ao completar o cadastro, concordo com os{" "}
              <span className="text-white underline">Termos de uso</span> e{" "}
              <span className="text-white underline">Política de privacidade</span>.
            </label>
          </div>

          {/* Info box */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-white">Por que precisamos dessas informações?</span>{" "}
              CPF ou CNPJ e telefone são obrigatórios para utilizar a plataforma. Todos os dados são criptografados e protegidos.
            </p>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-12 text-base font-semibold gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {saving ? "Salvando..." : "Completar Cadastro"}
          </Button>
        </form>

        <p className="text-center text-[11px] text-slate-500">
          Esses dados são necessários para emissão de certificados e notas fiscais.
        </p>

        <div className="text-center pt-2 space-y-2">
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate("/", { replace: true });
            }}
            className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
          >
            Sair da conta
          </button>
          <span className="text-slate-600 mx-2">·</span>
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Tem certeza que deseja excluir sua conta? Esta ação é irreversível.")) return;
              setDeleting(true);
              try {
                const { data, error } = await supabase.functions.invoke("delete-account", { body: {} });
                if (error || !data?.success) {
                  toast.error("Erro ao excluir conta.");
                  setDeleting(false);
                  return;
                }
                await signOut();
                toast.success("Conta excluída.");
                navigate("/", { replace: true });
              } catch {
                toast.error("Erro ao excluir conta.");
                setDeleting(false);
              }
            }}
            disabled={deleting}
            className="text-xs text-red-400/70 hover:text-red-400 underline transition-colors"
          >
            {deleting ? "Excluindo..." : "Excluir minha conta"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;
