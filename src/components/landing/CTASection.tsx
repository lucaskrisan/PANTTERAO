import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const CTASection = () => (
  <section id="cta" aria-label="Criar conta grátis na Panttera" className="relative z-10 py-32 overflow-hidden">
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse,_rgba(0,230,118,0.08)_0%,_transparent_60%)] blur-3xl" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,_rgba(212,175,55,0.05)_0%,_transparent_60%)] blur-3xl" />
    </div>

    <div className="container max-w-3xl mx-auto px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-8"
      >
        <h2 className="text-3xl md:text-[2.75rem] lg:text-[3.5rem] font-black tracking-[-0.04em] leading-[1.05] font-display">
          Pronto para vender como{" "}
          <span
            className="text-transparent bg-clip-text italic"
            style={{ backgroundImage: "linear-gradient(95deg, #00E676 0%, #00C853 40%, #D4AF37 100%)" }}
          >
            predador?
          </span>
        </h2>

        <p className="text-[#6A6A75] max-w-md mx-auto text-[15px] font-light leading-relaxed">
          Crie sua conta gratuita agora e tenha seu checkout profissional no ar em minutos.
        </p>

        <Link to="/login?signup=true">
          <Button className="h-[64px] px-16 bg-gradient-to-r from-primary to-[#00C853] hover:from-[#00C853] hover:to-primary text-primary-foreground font-extrabold rounded-2xl text-[16px] shadow-[0_4px_60px_rgba(0,230,118,0.4)] hover:shadow-[0_8px_80px_rgba(0,230,118,0.6)] hover:scale-[1.03] transition-all duration-500 mt-4 group">
            Criar Conta Grátis
            <ArrowRight className="w-5 h-5 ml-2.5 group-hover:translate-x-2 transition-transform duration-300" aria-hidden="true" />
          </Button>
        </Link>

        <div className="flex items-center justify-center gap-8 pt-4 flex-wrap">
          {["R$ 0,99 por venda", "Recursos Exclusivos", "Setup em 5 min"].map((t) => (
            <span key={t} className="flex items-center gap-2.5 text-[11px] text-[#6A6A75] uppercase tracking-[0.15em] font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary to-gold" aria-hidden="true" />
              {t}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

export default CTASection;
