import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import panteraMascot from "@/assets/pantera-mascot.png";
import { useState, useEffect } from "react";

const LandingHeader = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#0B0B0D]/80 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
          : "bg-transparent"
      }`}
    >
      <nav className="container max-w-7xl mx-auto flex items-center justify-between px-6 h-[72px]" aria-label="Navegação principal">
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link to="/" className="flex items-center gap-3" aria-label="Panttera — Voltar ao início">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl animate-pulse" aria-hidden="true" />
              <img
                src={panteraMascot}
                alt="Logo Panttera"
                className="relative w-10 h-10 drop-shadow-[0_0_20px_rgba(0,230,118,0.5)]"
                width={40}
                height={40}
              />
            </div>
            <span className="font-display font-extrabold text-xl tracking-tight">
              Pant<span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #00E676, #D4AF37)" }}>tera</span>
            </span>
          </Link>
        </motion.div>
        <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#7A7A85]">
          {[
            { href: "#global-sales", label: "Global" },
            { href: "#features", label: "Recursos" },
            { href: "#showcase", label: "Plataforma" },
            { href: "#pricing", label: "Preços" },
            { href: "#cta", label: "Contato" },
          ].map((link, i) => (
            <motion.a
              key={link.href}
              href={link.href}
              className="relative hover:text-white transition-colors duration-300 group"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-gradient-to-r from-primary to-gold group-hover:w-full transition-all duration-300" aria-hidden="true" />
            </motion.a>
          ))}
        </div>

        <motion.div
          className="hidden md:flex items-center gap-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Link to="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#9A9AA5] hover:text-white hover:bg-white/5 text-[13px] font-medium rounded-lg px-5"
            >
              Entrar
            </Button>
          </Link>
          <Link to="/login?signup=true">
            <Button
              size="sm"
              className="bg-gradient-to-r from-primary to-[#00C853] hover:from-[#00C853] hover:to-primary text-primary-foreground font-bold rounded-xl px-6 text-[13px] shadow-[0_0_30px_rgba(0,230,118,0.3)] hover:shadow-[0_0_50px_rgba(0,230,118,0.5)] transition-all duration-500 group"
            >
              Começar Grátis
              <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </Button>
          </Link>
        </motion.div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            className="md:hidden bg-[#0B0B0D]/95 backdrop-blur-2xl border-t border-white/[0.06] px-6 py-6 space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            role="navigation"
            aria-label="Menu mobile"
          >
            {[
              { href: "#global-sales", label: "Global" },
              { href: "#features", label: "Recursos" },
              { href: "#showcase", label: "Plataforma" },
              { href: "#pricing", label: "Preços" },
              { href: "#cta", label: "Contato" },
            ].map((l) => (
              <a key={l.label} href={l.href} className="block text-sm text-[#9A9AA5] hover:text-white py-2" onClick={() => setMobileOpen(false)}>
                {l.label}
              </a>
            ))}
            <div className="flex gap-3 pt-2">
              <Link to="/login" className="flex-1">
                <Button variant="outline" className="w-full border-white/10 text-white">Entrar</Button>
              </Link>
              <Link to="/login?signup=true" className="flex-1">
                <Button className="w-full bg-primary text-primary-foreground font-bold">Criar Conta</Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default LandingHeader;
