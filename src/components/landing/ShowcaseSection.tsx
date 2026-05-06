import { motion } from "framer-motion";
import { QrCode, Receipt, Users } from "lucide-react";

/* ── Laptop Mockup (showcase) ── */
function ShowcaseLaptop() {
  return (
    <div className="relative" aria-hidden="true">
      <motion.div
        initial={{ opacity: 0, rotateY: 5, rotateX: 3 }}
        whileInView={{ opacity: 1, rotateY: 2, rotateX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
      >
        <div className="bg-[#1a1a1e] rounded-t-xl p-[5px] border border-white/[0.08] shadow-[0_20px_80px_rgba(0,230,118,0.06)]">
          <div className="bg-[#0B0B0D] rounded-lg overflow-hidden">
            {/* Top bar */}
            <div className="h-6 bg-[#141417] flex items-center px-3 gap-1.5 border-b border-white/[0.04]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF5F57]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#28C840]" />
            </div>

            <div className="p-4 space-y-2.5">
              <div className="bg-[#141417] rounded-lg p-3 border border-white/[0.04]">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[6px] text-[#6A6A75] uppercase tracking-wider">Receita Acumulada</p>
                    <p className="text-xl font-black text-white font-mono">R$ 2.390.000</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[6px] text-[#6A6A75] uppercase tracking-wider">Conversão</p>
                    <p className="text-xl font-black text-primary font-mono">34.2%</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#141417] rounded-lg p-3 border border-white/[0.04] h-20">
                <svg viewBox="0 0 200 50" className="w-full h-full" preserveAspectRatio="none" role="img" aria-label="Gráfico de receita crescente">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00E676" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#00E676" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,40 Q20,35 40,30 T80,25 T120,15 T160,20 T200,8" fill="none" stroke="#00E676" strokeWidth="1.5" />
                  <path d="M0,40 Q20,35 40,30 T80,25 T120,15 T160,20 T200,8 V50 H0 Z" fill="url(#chartGrad)" />
                </svg>
              </div>

              <div className="space-y-1">
                {[
                  { name: "Curso Expert", v: "R$ 745.000", s: "paid", pct: "94%" },
                  { name: "Mentoria Pro", v: "R$ 328.500", s: "paid", pct: "91%" },
                  { name: "E-book Elite", v: "R$ 127.300", s: "paid", pct: "88%" },
                ].map((row) => (
                  <div key={row.name} className="flex items-center justify-between bg-[#1E1E22] rounded px-2 py-1.5 border border-white/[0.02]">
                    <span className="text-[7px] text-white/80">{row.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] text-primary font-mono font-bold">{row.v}</span>
                      <span className="text-[6px] text-[#6A6A75]">{row.pct}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="h-2.5 bg-gradient-to-b from-[#2A2A2F] to-[#1E1E22] rounded-b-xl mx-4 border-x border-b border-white/[0.06]" />
        <div className="h-1 bg-[#1E1E22] rounded-b-2xl mx-16 border-x border-b border-white/[0.04]" />
      </motion.div>

      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-[2px] h-[2px] rounded-full bg-primary/50"
          style={{ left: `${10 + Math.random() * 80}%`, top: `${10 + Math.random() * 80}%` }}
          animate={{ opacity: [0, 0.8, 0], scale: [0, 1.5, 0] }}
          transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }}
        />
      ))}
    </div>
  );
}

const ShowcaseSection = () => (
  <section id="showcase" aria-label="Dashboard e controle total da plataforma" className="relative z-10 py-28 lg:py-36 overflow-hidden">
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-[radial-gradient(circle,_rgba(0,230,118,0.04)_0%,_transparent_60%)] blur-3xl" />
    </div>

    <div className="container max-w-7xl mx-auto px-6">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          className="space-y-7"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="font-display text-3xl md:text-[2.75rem] font-black tracking-[-0.025em] leading-[1.1]">
            Uma plataforma,
            <br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #00E676, #00C853, #D4AF37)' }}>
              controle total.
            </span>
          </h2>

          <p className="text-[15px] text-[#9A9AA5] max-w-md leading-[1.8] font-light">
            Mercado Pago, Asaas, Pagar.me e Stripe. Receba via PIX, cartão ou boleto.{" "}
            <span className="text-white font-medium">Tudo em um único dashboard</span> com rastreamento perfeito de cada conversão.
          </p>

          <div className="flex flex-wrap gap-3">
            {[
              { icon: QrCode, label: "PIX" },
              { icon: Receipt, label: "Boleto" },
              { icon: Users, label: "Área de Membros" },
            ].map((pill) => (
              <div
                key={pill.label}
                className="flex items-center gap-2.5 bg-[#1E1E22] border border-white/[0.06] rounded-lg px-4 py-2.5 hover:border-primary/20 transition-all duration-300"
              >
                <pill.icon className="w-4 h-4 text-primary/70" aria-hidden="true" />
                <span className="text-[13px] font-medium text-white">{pill.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <ShowcaseLaptop />
      </div>
    </div>
  </section>
);

export default ShowcaseSection;
