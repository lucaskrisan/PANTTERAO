import { motion } from "framer-motion";
import { Shield, Zap, TrendingUp, Clock } from "lucide-react";

const stats = [
  { value: "R$ 12M+", label: "Processados na plataforma", icon: TrendingUp },
  { value: "94%", label: "Taxa de aprovação PIX", icon: Zap },
  { value: "< 800ms", label: "Tempo de carregamento", icon: Clock },
  { value: "100%", label: "Deduplicação DUAL ✓", icon: Shield },
];

const logos = [
  "Pagar.me", "Asaas", "Mercado Pago", "Stripe", "Meta Ads", "PCI DSS"
];

const SocialProof = () => (
  <section id="proof" className="relative z-10 border-y border-white/[0.04]">
    {/* Partners ticker */}
    <div className="border-b border-white/[0.04] py-5 overflow-hidden">
      <div className="container max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#6A6A75] uppercase tracking-[0.2em] font-medium whitespace-nowrap mr-8">
            Integrado com
          </span>
          <div className="flex items-center gap-10 md:gap-16 flex-wrap justify-end">
            {logos.map((name, i) => (
              <motion.span
                key={name}
                className="text-[11px] font-bold text-[#3A3A40] uppercase tracking-[0.2em] hover:text-primary/60 transition-colors duration-500"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                {name}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Stats */}
    <div className="py-20">
      <div className="container max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              className="text-center group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="w-10 h-10 mx-auto mb-4 rounded-xl bg-primary/[0.06] border border-primary/10 flex items-center justify-center group-hover:bg-primary/[0.1] group-hover:border-primary/20 transition-all duration-500">
                <s.icon className="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-[#6A6A75] tracking-tight font-mono">
                {s.value}
              </p>
              <p className="text-[11px] text-[#6A6A75] mt-2.5 uppercase tracking-[0.15em] font-medium">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>

    {/* Social proof banner */}
    <div className="border-t border-white/[0.04] py-6 bg-primary/[0.02]">
      <div className="container max-w-7xl mx-auto px-6">
        <motion.p
          className="text-center text-[13px] text-[#9A9AA5] font-light"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          "Migrei para o PanteraPay e minhas vendas{" "}
          <span className="text-primary font-semibold">subiram 47% no primeiro mês.</span>{" "}
          Nunca mais volto." — <span className="text-white/80 font-medium">@rodrigo.mkt</span>
        </motion.p>
      </div>
    </div>
  </section>
);

export default SocialProof;
