import { motion } from "framer-motion";
import { Check, X, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const rows = [
  { feature: "Checkout otimizado para conversão", us: true, them: false },
  { feature: "Rastreamento DUAL ✓ (Pixel + CAPI)", us: true, them: false },
  { feature: "Área de membros integrada", us: true, them: false },
  { feature: "One-click upsell", us: true, them: "parcial" },
  { feature: "Multi-gateway (4+)", us: true, them: false },
  { feature: "Builder visual de checkout", us: true, them: false },
  { feature: "Dashboard em tempo real", us: true, them: true },
  { feature: "Notificações push de venda", us: true, them: false },
  { feature: "Webhooks com HMAC", us: true, them: "parcial" },
  { feature: "Mensalidade", us: "GRÁTIS", them: "R$ 497+/mês" },
  { feature: "Taxa por venda", us: "R$ 0,99 fixo", them: "até 10%" },
];

const ComparisonSection = () => (
  <section className="relative z-10 py-32">
    <div className="container max-w-4xl mx-auto px-6">
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <span className="inline-block text-[10px] font-bold text-primary uppercase tracking-[0.25em] mb-5 bg-primary/[0.06] border border-primary/15 rounded-full px-4 py-1.5">
          Comparativo real
        </span>
        <h2 className="text-3xl md:text-[2.75rem] font-black tracking-[-0.025em] leading-[1.1]">
          Eles cobram caro.{" "}
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #00E676, #00C853, #D4AF37)' }}>
            Nós entregamos mais.
          </span>
        </h2>
        <p className="text-sm text-[#6A6A75] mt-4 font-light">Veja por que produtores inteligentes estão migrando.</p>
      </motion.div>

      <motion.div
        className="rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.01]"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Table header */}
        <div className="grid grid-cols-3 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="p-4 pl-6 text-[11px] text-[#6A6A75] uppercase tracking-[0.15em] font-medium">Recurso</div>
          <div className="p-4 text-center">
            <span className="text-[11px] font-bold text-primary uppercase tracking-[0.15em]">Panttera</span>
          </div>
          <div className="p-4 text-center">
            <span className="text-[11px] font-bold text-[#3A3A40] uppercase tracking-[0.15em]">Outros</span>
          </div>
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <div
            key={row.feature}
            className={`grid grid-cols-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${i === rows.length - 1 ? "border-b-0 bg-primary/[0.03]" : ""}`}
          >
            <div className="p-4 pl-6 text-[13px] text-white/80 font-light">{row.feature}</div>
            <div className="p-4 flex items-center justify-center">
              {row.us === true ? (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-primary" />
                </div>
              ) : (
                <span className="text-[13px] font-bold text-primary">{row.us}</span>
              )}
            </div>
            <div className="p-4 flex items-center justify-center">
              {row.them === true ? (
                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#6A6A75]" />
                </div>
              ) : row.them === false ? (
                <div className="w-6 h-6 rounded-full bg-red-500/5 flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-red-400/60" />
                </div>
              ) : (
                <span className="text-[12px] text-[#6A6A75]">{row.them}</span>
              )}
            </div>
          </div>
        ))}
      </motion.div>

      {/* CTA under table */}
      <motion.div
        className="text-center mt-10"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4 }}
      >
        <Link to="/login?signup=true">
          <Button className="h-12 px-8 bg-primary hover:bg-[#00C853] text-primary-foreground font-bold rounded-full text-[13px] shadow-[0_4px_30px_rgba(0,230,118,0.3)] hover:shadow-[0_4px_45px_rgba(0,230,118,0.5)] transition-all duration-300 group">
            Migrar agora — é grátis
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </motion.div>
    </div>
  </section>
);

export default ComparisonSection;
