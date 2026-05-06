import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

const badges = [
  { milestone: "R$ 10 mil", color: "from-[#C0C0C0] to-[#8A8A8A]", label: "Prata", shadow: "rgba(192,192,192,0.2)" },
  { milestone: "R$ 50 mil", color: "from-[#6A6A75] to-[#3A3A40]", label: "Grafite", shadow: "rgba(106,106,117,0.2)" },
  { milestone: "R$ 100 mil", color: "from-[#6A6A75] to-[#3A3A40]", label: "Grafite Elite", shadow: "rgba(106,106,117,0.3)" },
  { milestone: "R$ 500 mil", color: "from-[#D4AF37] to-[#B8860B]", label: "Gold", shadow: "rgba(212,175,55,0.3)" },
  { milestone: "R$ 1M", color: "from-[#D4AF37] to-[#F4D06F]", label: "Gold Pro", shadow: "rgba(212,175,55,0.4)" },
  { milestone: "R$ 10M", color: "from-[#0B0B0D] via-[#D4AF37] to-[#0B0B0D]", label: "Black Gold", shadow: "rgba(212,175,55,0.5)" },
];

const AchievementsSection = () => (
  <section aria-label="Premiações e reconhecimento por vendas" className="relative z-10 py-28 lg:py-36 overflow-hidden">
    <div className="container max-w-6xl mx-auto px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="space-y-5 mb-16"
      >
        <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-4 py-1.5 mx-auto">
          <Trophy className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
          <span className="text-[11px] font-semibold text-gold uppercase tracking-[0.15em]">
            Premiações
          </span>
        </div>
        <h2 className="text-3xl md:text-[2.75rem] font-black tracking-[-0.025em] leading-[1.1]">
          Premiações de{" "}
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #D4AF37, #F4D06F)' }}>
            reconhecimento.
          </span>
        </h2>
        <p className="text-sm text-[#6A6A75] font-light max-w-md mx-auto leading-relaxed">
          Cada meta batida é celebrada. Placas exclusivas para quem domina o jogo.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" role="list">
        {badges.map((b, i) => (
          <motion.article
            key={b.milestone}
            role="listitem"
            className="group relative"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
          >
            <div
              className="relative bg-[#141417] border border-white/[0.06] rounded-2xl p-5 hover:border-gold/20 transition-all duration-500 overflow-hidden"
              style={{ boxShadow: `0 10px 40px ${b.shadow}` }}
            >
              <div className={`w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br ${b.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                <Trophy className="w-7 h-7 text-white/90" aria-hidden="true" />
              </div>
              <p className="text-[14px] font-black text-white font-mono tracking-tight">{b.milestone}</p>
              <p className="text-[9px] text-[#6A6A75] uppercase tracking-[0.15em] mt-1 font-medium">{b.label}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  </section>
);

export default AchievementsSection;
