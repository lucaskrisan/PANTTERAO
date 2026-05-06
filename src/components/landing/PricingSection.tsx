import { motion } from "framer-motion";
import { Check, Zap, Star, Shield, Crown, ArrowRight, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "PANTTERA BABY",
    description: "O início da jornada.",
    price: "Grátis",
    monthlyPrice: 0,
    annualPrice: 0,
    commission: "3%",
    fixedFee: "R$ 0,99",
    features: [
      "10 Produtos",
      "3 Webhooks",
      "Histórico Carrinhos: 45 dias",
      "Clonador & Pressel (1 página)",
      "Recuperação WhatsApp Automática",
      "Suporte Especializado",
    ],
    buttonText: "Começar Grátis",
    icon: Star,
    color: "from-orange-400 to-orange-600",
    popular: false,
  },
  {
    name: "PANTTERA ALPHA",
    description: "Liderando o bando.",
    price: "R$ 97",
    monthlyPrice: 97,
    annualPrice: 77, // R$ 77/mês no anual
    commission: "2.5%",
    fixedFee: "R$ 0,99",
    features: [
      "Produtos Ilimitados",
      "Clonador & Pressel (10 páginas)",
      "Quiz Builder (3 funis)",
      "GatFlow: Automação WhatsApp",
      "Histórico Carrinhos: 90 dias",
      "Pixel Espelho (Mirror Pixel)",
      "Teste A/B de Checkout",
    ],
    buttonText: "Assinar Alpha",
    icon: Zap,
    color: "from-primary to-[#00C853]",
    popular: true,
  },
  {
    name: "PANTTERA APEX",
    description: "O topo da cadeia alimentar.",
    price: "R$ 247",
    monthlyPrice: 247,
    annualPrice: 197,
    commission: "2%",
    fixedFee: "R$ 0,99",
    features: [
      "Tudo do Alpha +",
      "Clonador & Pressel Ilimitados",
      "Quiz Builder Ilimitado",
      "Checkout Personalizado Pro",
      "Recuperação de Boletos Ativa",
      "Gerente de Conta Dedicado",
    ],
    buttonText: "Assinar Apex",
    icon: Shield,
    color: "from-blue-500 to-indigo-600",
    popular: false,
  },
  {
    name: "PANTTERA BLACK",
    description: "Soberano. Domínio total.",
    price: "R$ 497",
    monthlyPrice: 497,
    annualPrice: 397,
    commission: "1.5%",
    fixedFee: "R$ 0,99",
    features: [
      "Tudo do Apex +",
      "Histórico Vitalício",
      "Área de Membros Estilo Netflix",
      "GatFlow Unlimited (Tudo Ilimitado)",
      "Clonador, Pressel & Quiz s/ Limites",
      "Taxa Exclusiva de 1.5%",
      "Suporte Ultra-Prioritário",
    ],
    buttonText: "Assinar Black",
    icon: Crown,
    color: "from-gray-800 to-black",
    popular: false,
    isBlack: true,
  },
];

const PricingSection = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  return (
    <section
      id="pricing"
      aria-label="Preços e planos da plataforma Panttera"
      className="relative z-10 py-28 lg:py-36 overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-[radial-gradient(ellipse,_rgba(0,230,118,0.06)_0%,_transparent_60%)] blur-3xl" />
      </div>

      <div className="container max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          className="text-center mb-12 space-y-5"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-block text-[10px] font-bold text-primary uppercase tracking-[0.25em] mb-2 bg-primary/[0.06] border border-primary/15 rounded-full px-4 py-1.5">
            Escolha seu Plano
          </span>
          <h2 className="text-3xl md:text-[2.75rem] lg:text-[3.5rem] font-black tracking-[-0.04em] leading-[1.05] font-display">
            Selecione o plano ideal para{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(90deg, #00E676, #00C853, #D4AF37)" }}
            >
              o seu negócio.
            </span>
          </h2>
          <p className="text-sm text-[#6A6A75] font-light max-w-lg mx-auto leading-relaxed">
            Nomes fortes para quem quer dominar o mercado. Evolua sua operação conforme sua escala.
          </p>

          {/* Billing Switch */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={cn("text-sm font-medium transition-colors", billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground")}>
              Mensal
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
              className="relative w-14 h-7 bg-white/5 border border-white/10 rounded-full transition-colors focus:outline-none"
            >
              <motion.div
                animate={{ x: billingCycle === "monthly" ? 4 : 32 }}
                className="w-5 h-5 bg-primary rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={cn("text-sm font-medium transition-colors", billingCycle === "annual" ? "text-foreground" : "text-muted-foreground")}>
              Anual <span className="text-primary text-[10px] font-bold bg-primary/10 px-2 py-0.5 rounded-full ml-1">ECONOMIZE 20%</span>
            </span>
          </div>
        </motion.div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={cn(
                "relative flex flex-col h-full rounded-3xl border transition-all duration-300 group",
                plan.popular ? "border-primary/50 bg-[#141417]/90 scale-105 z-10 shadow-[0_20px_50px_rgba(0,230,118,0.15)]" : "border-white/[0.08] bg-[#141417]/60 hover:border-white/20",
                plan.isBlack && "bg-black/80 border-gray-800"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Mais Popular
                </div>
              )}

              <div className="p-8 pb-6 border-b border-white/[0.06]">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br", plan.color)}>
                  <plan.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className={cn("text-xl font-black font-display tracking-tight mb-1", plan.isBlack ? "text-white" : "text-foreground")}>
                  {plan.name}
                </h3>
                <p className="text-xs text-[#6A6A75] font-light mb-6">
                  {plan.description}
                </p>
                
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-foreground">
                    {typeof plan.price === "string" && isNaN(Number(plan.price.replace("R$ ", ""))) 
                      ? plan.price 
                      : `R$ ${billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice}`}
                  </span>
                  {typeof plan.price === "number" || !isNaN(Number(plan.price.replace("R$ ", ""))) ? (
                    <span className="text-[#6A6A75] text-xs">/mês</span>
                  ) : null}
                </div>
                
                <div className="mt-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold text-lg">{plan.commission}</span>
                    <span className="text-[10px] text-[#6A6A75] uppercase tracking-wider">Comissão por venda</span>
                  </div>
                  <div className="text-[11px] text-[#6A6A75]">
                    + {plan.fixedFee} fixo por venda aprovada
                  </div>
                </div>
              </div>

              <div className="p-8 flex-grow space-y-4">
                <p className="text-[10px] text-[#6A6A75] uppercase tracking-[0.15em] font-bold">
                  Recursos Inclusos:
                </p>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="mt-1 w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-primary" />
                      </div>
                      <span className="text-[13px] text-white/70 font-light leading-tight">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-8 pt-0 mt-auto">
                <Link to="/login?signup=true" className="block w-full">
                  <Button 
                    className={cn(
                      "w-full h-12 font-bold rounded-xl text-[14px] transition-all duration-300 group",
                      plan.popular 
                        ? "bg-gradient-to-r from-primary to-[#00C853] text-primary-foreground shadow-[0_10px_30px_rgba(0,230,118,0.3)] hover:shadow-[0_15px_40px_rgba(0,230,118,0.5)]" 
                        : "bg-white/5 border border-white/10 hover:bg-white/10 text-white",
                      plan.isBlack && "bg-white text-black hover:bg-white/90"
                    )}
                  >
                    {plan.buttonText}
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Transparency footer */}
        <motion.div
          className="mt-20 p-8 rounded-3xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="flex items-start gap-4 max-w-2xl">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Info className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-foreground mb-1">Custo Fixo de Infraestrutura</h4>
                <p className="text-sm text-[#6A6A75] font-light leading-relaxed">
                  O valor de <strong>R$ 0,99</strong> por venda é nosso custo fixo para garantir que cada transação tenha a melhor infraestrutura do mercado, 
                  com rastreamento Dual Pixel + CAPI e notificações em tempo real. Você paga apenas por vendas aprovadas.
                </p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-[10px] text-[#4A4A55] uppercase tracking-widest font-bold mb-2">Segurança Garantida</p>
              <div className="flex gap-4">
                <Shield className="w-8 h-8 text-white/10" />
                <Zap className="w-8 h-8 text-white/10" />
                <Star className="w-8 h-8 text-white/10" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;