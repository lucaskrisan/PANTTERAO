import { motion } from "framer-motion";

export default function HeroLaptopMockup() {
  return (
    <div className="relative">
      <div className="relative mx-auto" style={{ perspective: "1200px" }}>
        <motion.div
          className="relative"
          initial={{ opacity: 0, rotateY: -8, rotateX: 5 }}
          animate={{ opacity: 1, rotateY: -3, rotateX: 2 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Screen bezel */}
          <div className="bg-[#1a1a1e] rounded-t-xl p-[6px] border border-white/[0.08] shadow-[0_-10px_60px_rgba(0,230,118,0.08)]">
            {/* Screen */}
            <div className="bg-background rounded-lg overflow-hidden">
              {/* Top bar */}
              <div className="h-7 bg-card flex items-center px-3 gap-1.5 border-b border-border">
                <div className="w-2 h-2 rounded-full bg-[#FF5F57]" />
                <div className="w-2 h-2 rounded-full bg-[#FFBD2E]" />
                <div className="w-2 h-2 rounded-full bg-[#28C840]" />
                <div className="ml-3 h-3.5 w-36 rounded bg-secondary flex items-center justify-center">
                  <span className="text-[7px] text-muted-foreground font-mono">app.panttera.com.br</span>
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-primary/10" />
                    <div className="h-2.5 w-20 rounded bg-secondary" />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-5 w-14 rounded bg-secondary" />
                    <div className="h-5 w-14 rounded bg-primary/20" />
                  </div>
                </div>

                {/* Revenue section */}
                <div className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-[7px] text-muted-foreground uppercase tracking-wider">Faturamento Total</p>
                  <p className="text-lg font-black text-foreground font-mono mt-0.5">R$ 127.390,00</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="text-[7px] text-primary font-bold">↑ 34.2%</div>
                    <div className="text-[7px] text-muted-foreground">vs. mês anterior</div>
                  </div>
                </div>

                {/* Chart */}
                <div className="bg-card rounded-lg p-3 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[7px] text-muted-foreground uppercase tracking-wider">Vendas (7 dias)</div>
                    <div className="flex gap-1">
                      {["1D", "7D", "1M"].map((l) => (
                        <span
                          key={l}
                          className={`text-[6px] px-1.5 py-0.5 rounded ${l === "7D" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Chart bars */}
                  <div className="h-16 flex items-end gap-[3px]">
                    {[30, 45, 55, 40, 70, 85, 65, 90, 75, 95, 88, 78, 92, 60, 82].map((h, i) => (
                      <motion.div
                        key={i}
                        className="flex-1 rounded-t-sm bg-gradient-to-t from-primary/40 to-primary/80"
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.6, delay: 0.8 + i * 0.04 }}
                      />
                    ))}
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "Vendas", value: "847", color: "text-primary" },
                    { label: "PIX", value: "94%", color: "text-primary" },
                    { label: "Cartão", value: "91%", color: "text-[#00C853]" },
                    { label: "Ticket", value: "R$ 257", color: "text-[#D4AF37]" },
                  ].map((m) => (
                    <div key={m.label} className="bg-secondary rounded p-2 text-center border border-border">
                      <p className="text-[6px] text-muted-foreground uppercase">{m.label}</p>
                      <p className={`text-[10px] font-black font-mono mt-0.5 ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Laptop base */}
          <div className="h-3 bg-gradient-to-b from-[#2A2A2F] to-secondary rounded-b-xl mx-4 border-x border-b border-border" />
          <div className="h-1.5 bg-secondary rounded-b-2xl mx-16 border-x border-b border-border" />
        </motion.div>
      </div>

      {/* Glow under laptop */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[80%] h-[40px] bg-[radial-gradient(ellipse,_rgba(0,230,118,0.15)_0%,_transparent_70%)] blur-xl" />
    </div>
  );
}
