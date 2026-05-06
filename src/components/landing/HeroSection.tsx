import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import panteraMascot from "@/assets/pantera-mascot.png";
import HeroSparkles from "./hero/HeroSparkles";
import HeroLaptopMockup from "./hero/HeroLaptopMockup";
import { useState } from "react";

const HeroSection = () => {
  const [email, setEmail] = useState("");

  return (
    <section
      aria-label="Seção principal — Checkout de Alta Conversão"
      className="relative z-10 overflow-hidden min-h-[100vh] flex flex-col justify-center"
    >
      <HeroSparkles />

      {/* Multi-layer aurora glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <motion.div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1600px] h-[900px] opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 20%, rgba(0,230,118,0.15) 0%, rgba(0,200,83,0.05) 30%, rgba(212,175,55,0.04) 50%, transparent 70%)",
          }}
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.25, 0.45, 0.25],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/4 right-0 w-[600px] h-[600px] opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 60%)",
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      <div className="container max-w-7xl mx-auto px-6 pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left */}
          <motion.div
            className="space-y-8 relative"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 bg-primary/[0.06] border border-primary/15 rounded-full px-4 py-1.5"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-[0.15em]">
                Plataforma #1 de Checkout
              </span>
            </motion.div>

            {/* Mascot with glow ring */}
            <div className="relative w-fit">
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-gold/20 blur-3xl"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden="true"
              />
              <motion.img
                src={panteraMascot}
                alt="Panttera — Plataforma de Checkout de Alta Conversão para Infoprodutores"
                className="relative w-28 h-28 md:w-36 md:h-36 drop-shadow-[0_0_50px_rgba(0,230,118,0.4)]"
                width={144}
                height={144}
                initial={{ opacity: 0, scale: 0.5, rotate: -15 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 1, delay: 0.2, type: "spring", stiffness: 100 }}
              />
            </div>

            <h1 className="font-display text-[2.75rem] md:text-[3.5rem] lg:text-[4.25rem] font-black leading-[1.02] tracking-[-0.04em]">
              Venda com o
              <br />
              <motion.span
                className="text-transparent bg-clip-text inline-block"
                style={{ backgroundImage: "linear-gradient(95deg, #00E676 0%, #00C853 40%, #D4AF37 100%)" }}
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 6, repeat: Infinity }}
              >
                instinto de um
              </motion.span>
              <br />
              <motion.span
                className="text-transparent bg-clip-text inline-block"
                style={{
                  backgroundImage: "linear-gradient(95deg, #00E676 0%, #00C853 40%, #D4AF37 100%)",
                  backgroundSize: "200% 100%",
                }}
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 6, repeat: Infinity, delay: 0.5 }}
              >
                predador.
              </motion.span>
            </h1>

            <p className="text-[16px] text-muted-foreground max-w-md leading-[1.85] font-light">
              Mais controle, mais conversão,{" "}
              <span className="text-foreground font-semibold">menos gambiarra.</span> O checkout que
              produtores inteligentes usam para dominar o mercado.
            </p>

            {/* Email capture */}
            <form
              className="flex flex-col sm:flex-row gap-3 max-w-md"
              onSubmit={(e) => e.preventDefault()}
              aria-label="Criar conta grátis"
            >
              <div className="relative flex-1">
                <label htmlFor="hero-email" className="sr-only">Seu melhor e-mail</label>
                <input
                  id="hero-email"
                  type="email"
                  placeholder="Seu melhor e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-[56px] w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 focus:bg-white/[0.06] transition-all duration-300"
                />
              </div>
              <Link to={`/login?signup=true${email ? `&email=${encodeURIComponent(email)}` : ""}`}>
                <Button className="h-[56px] px-8 bg-gradient-to-r from-primary to-[#00C853] hover:from-[#00C853] hover:to-primary text-primary-foreground font-extrabold rounded-xl text-[14px] shadow-[0_4px_40px_rgba(0,230,118,0.35)] hover:shadow-[0_8px_60px_rgba(0,230,118,0.55)] transition-all duration-500 w-full sm:w-auto whitespace-nowrap group">
                  Criar conta grátis
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1.5 transition-transform" aria-hidden="true" />
                </Button>
              </Link>
            </form>

            {/* Trust signals */}
            <div className="flex items-center gap-6 pt-1">
            {[
                { icon: Shield, label: "Criptografado" },
                { icon: Zap, label: "R$ 0,99/venda" },
                { icon: Sparkles, label: "Sem mensalidade" },
              ].map((t) => (
                <span key={t.label} className="flex items-center gap-2 text-[11px] text-[#6A6A75] font-medium">
                  <t.icon className="w-3 h-3 text-primary/50" aria-hidden="true" />
                  {t.label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right — Laptop mockup */}
          <div className="relative hidden lg:block" aria-hidden="true">
            <HeroLaptopMockup />

            {/* Floating sale notification */}
            <motion.div
              className="absolute -right-4 top-8 bg-[#141417]/95 border border-primary/20 rounded-2xl px-5 py-4 shadow-[0_12px_40px_rgba(0,230,118,0.12)] backdrop-blur-xl z-20"
              initial={{ opacity: 0, x: 50, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.8, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center">
                  <span className="text-base">🎉</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-primary">Venda realizada 🔥</p>
                  <p className="text-xl font-black text-foreground font-mono">R$ 750,00</p>
                  <p className="text-[9px] text-muted-foreground">PIX · há 12 segundos</p>
                </div>
              </div>
            </motion.div>

            {/* Second floating notification */}
            <motion.div
              className="absolute -left-8 bottom-20 bg-[#141417]/95 border border-gold/15 rounded-2xl px-5 py-4 shadow-[0_12px_40px_rgba(212,175,55,0.08)] backdrop-blur-xl z-20"
              initial={{ opacity: 0, x: -50, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.8, delay: 2.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/15 flex items-center justify-center">
                  <span className="text-base">⚡</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gold">Conversão recorde</p>
                  <p className="text-xl font-black text-foreground font-mono">34.2%</p>
                  <p className="text-[9px] text-muted-foreground">Checkout otimizado</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Partners bar */}
      <aside className="border-t border-white/[0.04] bg-white/[0.01] backdrop-blur-sm py-8" aria-label="Integrações parceiras">
        <div className="container max-w-7xl mx-auto px-6">
          <p className="text-center text-[10px] text-[#4A4A55] uppercase tracking-[0.3em] mb-5 font-semibold">
            Integrado com as maiores plataformas
          </p>
          <div className="flex items-center justify-center gap-8 md:gap-14 flex-wrap">
            {["Mercado Pago", "Asaas", "Appmax", "PCI DSS", "Pagar.me", "Stripe", "Meta"].map((name, i) => (
              <motion.span
                key={name}
                className="text-[11px] md:text-[13px] font-bold text-[#3A3A45] uppercase tracking-[0.15em] hover:text-[#6A6A75] transition-colors duration-500 cursor-default"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 + i * 0.08 }}
              >
                {name}
              </motion.span>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
};

export default HeroSection;
