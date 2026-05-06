import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";

import panteraMascot from "@/assets/pantera-mascot.png";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight, CheckCircle2, BarChart3, GraduationCap, ChevronLeft } from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { supabase } from "@/integrations/supabase/client";
import { validateCpfCnpj, validatePhone } from "@/lib/validators";
import { getAuthOrigin } from "@/lib/getAuthOrigin";

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

const Login = () => {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("signup") === "true");
  const [accountType, setAccountType] = useState<'producer' | 'customer' | null>(
    searchParams.get("signup") === "true" ? 'producer' : null
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Verify Turnstile token server-side (skip if no token or bypass)
      if (turnstileToken && turnstileToken !== "bypass") {
        try {
          const { data: verification, error: verifyError } = await supabase.functions.invoke('verify-turnstile', {
            body: { token: turnstileToken },
          });
          if (verifyError || !verification?.success) {
            console.warn("[Login] Turnstile verification failed, allowing graceful degradation");
          }
        } catch (e) {
          console.warn("[Login] Turnstile check error, skipping:", e);
        }
      }

      if (isSignUp) {
        if (!acceptTerms) {
          toast.error("Aceite os termos para continuar");
          setLoading(false);
          return;
        }

        // Validate CPF/CNPJ
        const cpfResult = validateCpfCnpj(cpf);
        if (!cpfResult.valid) {
          setCpfError(cpfResult.error);
          setLoading(false);
          return;
        }

        // Validate phone
        const phoneResult = validatePhone(phone);
        if (!phoneResult.valid) {
          setPhoneError(phoneResult.error);
          setLoading(false);
          return;
        }

        // Validate full name (at least 2 words)
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length < 2 || nameParts.some(p => p.length < 2)) {
          toast.error("Informe seu nome completo (nome e sobrenome)");
          setLoading(false);
          return;
        }

        await signUp(email, password, fullName, { phone, cpf });
        // Don't auto-login — email confirmation may be required
        toast.success("Conta criada! Verifique seu e-mail para confirmar o cadastro.", { duration: 8000 });
        setLoading(false);
        setIsSignUp(false); // Switch to login view
      } else if (accountType === 'customer') {
        const { error } = await supabase.functions.invoke("recover-member-access", {
          body: { email: email.trim().toLowerCase() }
        });
        if (error) throw error;
        toast.success("Se esse e-mail tem uma compra ativa, você receberá o link de acesso em instantes. Verifique sua caixa de entrada e spam.", { duration: 6000 });
        setLoading(false);
        return;
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      const msg = err.message || "Erro na autenticação";
      if (msg.includes("Email not confirmed")) {
        toast.error("E-mail ainda não confirmado. Verifique sua caixa de entrada.");
      } else {
        toast.error(msg);
      }
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* LEFT — Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-24 overflow-y-auto relative">
        {/* Subtle ambient glow */}
        <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full blur-[160px] opacity-[0.04] pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }} />

        <motion.div
          className="w-full max-w-[460px] mx-auto"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <img src={panteraMascot} alt="PanteraPay" className="w-10 h-10 drop-shadow-[0_0_16px_hsl(var(--primary)/0.4)]" />
            <span className="font-display font-extrabold text-xl tracking-tight text-foreground">
              Pantera<span className="text-primary">Pay</span>
            </span>
          </div>

          {/* Role selector step (login only, no accountType chosen yet) */}
          {!isSignUp && !accountType ? (
            <motion.div
              key="role-selector"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8">
                <h1 className="text-3xl font-black text-foreground tracking-[-0.02em] leading-tight">
                  Bem-vindo de volta
                </h1>
                <p className="text-muted-foreground mt-2 text-[15px]">
                  Como você acessa a PanteraPay?
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setAccountType('producer')}
                  className="w-full flex items-center gap-4 p-5 rounded-xl border border-border/50 bg-card/40 hover:border-primary/40 hover:bg-card/60 transition-all duration-200 group text-left"
                >
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 shrink-0">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-bold text-foreground">Sou Produtor</p>
                    <p className="text-[13px] text-muted-foreground/60">Painel, produtos e relatórios de venda</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                </button>

                <button
                  onClick={() => setAccountType('customer')}
                  className="w-full flex items-center gap-4 p-5 rounded-xl border border-border/50 bg-card/40 hover:border-primary/40 hover:bg-card/60 transition-all duration-200 group text-left"
                >
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 shrink-0">
                    <GraduationCap className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-bold text-foreground">Sou Aluno / Cliente</p>
                    <p className="text-[13px] text-muted-foreground/60">Acesse seus cursos e conteúdos</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                </button>
              </div>

              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => { setIsSignUp(true); setAccountType('producer'); }}
                  className="text-[13px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Novo na PanteraPay? <span className="text-primary font-semibold">Criar conta grátis</span>
                </button>
              </div>

              <div className="mt-6 text-center text-[12px] text-muted-foreground/40">
                Ao continuar você concorda com os{" "}
                <a href="/termos" className="text-primary/70 hover:text-primary underline">Termos</a> e a{" "}
                <a href="/privacidade" className="text-primary/70 hover:text-primary underline">Privacidade</a>.
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="login-form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Back button (login mode) */}
              {!isSignUp && accountType && (
                <button
                  type="button"
                  onClick={() => setAccountType(null)}
                  className="flex items-center gap-1.5 text-[13px] text-muted-foreground/60 hover:text-muted-foreground transition-colors mb-6"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </button>
              )}

              {/* Heading */}
              <div className="mb-8">
                <h1 className="text-3xl font-black text-foreground tracking-[-0.02em] leading-tight">
                  {isSignUp ? "Crie sua conta" : accountType === 'customer' ? "Acesso do Aluno" : "Acesso do Produtor"}
                </h1>
                <p className="text-muted-foreground mt-2 text-[15px]">
                  {isSignUp
                    ? "Comece a vender em minutos. Sem taxa de adesão."
                    : "Entre na sua conta para continuar."}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-[13px] font-medium text-muted-foreground">Nome completo</Label>
                    <Input
                      id="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Como gostaria de ser chamado"
                      className="h-[52px] bg-card/40 border-border/50 rounded-xl text-[14px] placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-card/60 transition-all duration-200"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[13px] font-medium text-muted-foreground">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="h-[52px] bg-card/40 border-border/50 rounded-xl text-[14px] placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-card/60 transition-all duration-200"
                    required
                  />
                </div>

                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[13px] font-medium text-muted-foreground">Telefone</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 border border-border/50 rounded-xl px-3.5 h-[52px] shrink-0 bg-card/40">
                        <span className="text-base">🇧🇷</span>
                        <span className="text-[13px] text-muted-foreground/60">+55</span>
                      </div>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => { setPhone(formatPhone(e.target.value)); setPhoneError(""); }}
                        placeholder="(11) 96123-4567"
                        maxLength={15}
                        className={`h-[52px] bg-card/40 border-border/50 rounded-xl text-[14px] placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-card/60 transition-all duration-200 flex-1 ${phoneError ? "border-red-500 focus:border-red-500" : ""}`}
                        required
                      />
                    </div>
                    {phoneError && <p className="text-xs text-red-400">{phoneError}</p>}
                  </div>
                )}

                {(!isSignUp && accountType === 'customer') ? null : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-[13px] font-medium text-muted-foreground">Senha</Label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!email) {
                              toast.error("Digite seu e-mail primeiro");
                              return;
                            }
                            try {
                              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                                redirectTo: `${getAuthOrigin()}/reset-password`,
                              });
                              if (error) throw error;
                              toast.success("Link de redefinição enviado! Verifique seu e-mail.", { duration: 6000 });
                            } catch (err: any) {
                              toast.error(err.message || "Erro ao enviar link de redefinição");
                            }
                          }}
                          className="text-[12px] text-primary/70 hover:text-primary font-medium transition-colors"
                        >
                          Esqueceu?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="pr-11 h-[52px] bg-card/40 border-border/50 rounded-xl text-[14px] placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-card/60 transition-all duration-200"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="cpf" className="text-[13px] font-medium text-muted-foreground">CPF ou CNPJ</Label>
                      <Input
                        id="cpf"
                        value={cpf}
                        onChange={(e) => { setCpf(formatCpfCnpj(e.target.value)); setCpfError(""); }}
                        placeholder="000.000.000-00"
                        maxLength={18}
                        className={`h-[52px] bg-card/40 border-border/50 rounded-xl text-[14px] placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-card/60 transition-all duration-200 ${cpfError ? "border-red-500 focus:border-red-500" : ""}`}
                        required
                      />
                      {cpfError && <p className="text-xs text-red-400">{cpfError}</p>}
                    </div>

                    <div className="flex items-start gap-3 pt-1">
                      <Checkbox
                        id="terms"
                        checked={acceptTerms}
                        onCheckedChange={(v) => setAcceptTerms(v === true)}
                        className="mt-0.5 border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <label htmlFor="terms" className="text-[13px] text-muted-foreground/70 leading-relaxed cursor-pointer">
                        Concordo com os{" "}
                        <a href="/termos" className="text-primary/80 hover:text-primary font-medium transition-colors">Termos de Serviço</a> e{" "}
                        <a href="/privacidade" className="text-primary/80 hover:text-primary font-medium transition-colors">Política de Privacidade</a>.
                      </label>
                    </div>
                  </>
                )}

                {/* Invisible Turnstile — runs in background */}
                <TurnstileWidget onVerify={handleTurnstileVerify} onExpire={handleTurnstileExpire} />

                <Button
                  type="submit"
                  className="w-full h-[52px] font-bold text-[14px] rounded-xl gap-2 mt-1 shadow-[0_0_30px_hsl(var(--primary)/0.15)] hover:shadow-[0_0_40px_hsl(var(--primary)/0.25)] transition-all duration-300"
                  disabled={loading}
                >
                  {loading ? "Aguarde..." : (isSignUp ? "Criar conta grátis" : (accountType === 'customer' ? "Reenviar meu link de acesso" : "Entrar"))}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    if (!isSignUp) setAccountType('producer');
                    else setAccountType(null);
                  }}
                  className="text-[13px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  {isSignUp ? (
                    <>Já tem conta? <span className="text-primary font-semibold">Entrar</span></>
                  ) : (
                    <>Novo por aqui? <span className="text-primary font-semibold">Criar conta grátis</span></>
                  )}
                </button>
              </div>

              {accountType === 'customer' && !isSignUp && (
                <div className="mt-4 text-center text-[12px] text-muted-foreground/40">
                  Se você é um comprador, acesse seus produtos pelo link enviado por e-mail.
                </div>
              )}

              <div className="mt-10 flex items-center justify-center gap-4 text-[11px] text-muted-foreground/30">
                <a href="/termos" className="hover:text-muted-foreground/60 cursor-pointer transition-colors">Termos</a>
                <span>·</span>
                <a href="/privacidade" className="hover:text-muted-foreground/60 cursor-pointer transition-colors">Privacidade</a>
                <span>·</span>
                <span className="hover:text-muted-foreground/60 cursor-pointer transition-colors">Suporte</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* RIGHT — Authority panel */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden">
        <div className="absolute inset-0 bg-card/30" />

        {/* Glow orbs */}
        <motion.div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(142 71% 45% / 0.06) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />

        <div className="relative z-10 flex flex-col justify-center p-12 xl:p-20 w-full">
          {/* Headline */}
          <motion.div
            className="space-y-6 max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-[0.1em]">Plataforma ativa</span>
            </div>

            <h2 className="text-[2.5rem] xl:text-[3rem] font-black text-foreground leading-[1.05] tracking-[-0.03em] font-display">
              Venda mais com{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[hsl(142,71%,65%)]">
                infraestrutura
              </span>{" "}
              de verdade.
            </h2>

            <p className="text-muted-foreground/70 text-[15px] leading-relaxed">
              Multi-gateway, checkout otimizado, rastreamento perfeito e área de membros — tudo integrado.
            </p>
          </motion.div>

          {/* Social proof cards */}
          <motion.div
            className="mt-12 space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {[
              { metric: "99.9%", label: "Uptime garantido", desc: "Infraestrutura enterprise" },
              { metric: "<2s", label: "PIX confirmado", desc: "Aprovação instantânea" },
              { metric: "+34%", label: "Mais conversão", desc: "Checkout otimizado" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                className="flex items-center gap-4 p-4 rounded-2xl bg-card/40 border border-border/30 backdrop-blur-sm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">
                  <span className="text-lg font-black text-primary font-mono">{item.metric}</span>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-foreground">{item.label}</p>
                  <p className="text-[12px] text-muted-foreground/50">{item.desc}</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-primary/40 ml-auto shrink-0" />
              </motion.div>
            ))}
          </motion.div>

          {/* Trust bar */}
          <motion.div
            className="mt-12 pt-8 border-t border-border/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/30 font-semibold mb-4">Integrado com</p>
            <div className="flex items-center gap-6">
              {["Stripe", "Mercado Pago", "Asaas", "Pagar.me"].map((name) => (
                <span key={name} className="text-[11px] font-bold text-muted-foreground/25 uppercase tracking-wide">
                  {name}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;
