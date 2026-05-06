import { motion } from "framer-motion";
import { Bell, Volume2 } from "lucide-react";

const notifications = [
  { name: "Lucas M.", value: "R$ 497,00", time: "agora", method: "PIX", emoji: "🔥" },
  { name: "Ana C.", value: "R$ 1.297,00", time: "2 min", method: "Cartão", emoji: "💳" },
  { name: "Pedro R.", value: "R$ 247,00", time: "5 min", method: "PIX", emoji: "⚡" },
  { name: "Julia S.", value: "R$ 897,00", time: "8 min", method: "PIX", emoji: "🎯" },
];

function NotificationPhoneMockup() {
  return (
    <div className="relative" aria-hidden="true">
      <motion.div
        className="max-w-[300px] mx-auto"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.2 }}
      >
        <div className="bg-gradient-to-b from-[#1A1A1E] to-[#141417] rounded-[32px] border border-white/[0.08] p-2.5 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <div className="h-7 flex items-center justify-center">
            <div className="w-24 h-5 bg-black rounded-full" />
          </div>

          <div className="bg-[#0B0B0D] rounded-2xl overflow-hidden min-h-[420px] relative">
            <div className="flex items-center justify-between px-5 py-2">
              <span className="text-[9px] text-white/60 font-mono font-bold">14:32</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 border border-white/40 rounded-sm flex items-end p-[1px]">
                  <div className="w-full h-[60%] bg-primary rounded-[1px]" />
                </div>
              </div>
            </div>

            <div className="text-center pt-3 pb-5">
              <p className="text-[32px] font-black text-white font-mono tracking-tight">14:32</p>
              <p className="text-[9px] text-[#6A6A75] font-medium">Terça-feira, 31 de março</p>
            </div>

            <div className="px-3 space-y-2">
              {notifications.map((n, i) => (
                <motion.div
                  key={i}
                  className="bg-[#1E1E22]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl px-3.5 py-3"
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 0.5, type: "spring", stiffness: 200 }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-sm">{n.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[8px] font-bold text-primary uppercase tracking-wider">Panttera</p>
                        <p className="text-[7px] text-[#5A5A65]">{n.time}</p>
                      </div>
                      <p className="text-[10px] font-bold text-white">Venda realizada! 🎉</p>
                      <p className="text-[9px] text-[#8A8A95] mt-0.5">
                        {n.name} comprou via {n.method} · <span className="text-primary font-bold font-mono">{n.value}</span>
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              <div className="w-32 h-1 bg-white/20 rounded-full" />
            </div>
          </div>
        </div>
      </motion.div>

      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute top-8 -right-4 w-16 h-16 rounded-full border border-primary/20"
          animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
        />
      ))}

      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[60%] h-[40px] bg-[radial-gradient(ellipse,_rgba(0,230,118,0.15)_0%,_transparent_70%)] blur-xl" />
    </div>
  );
}

const NotificationsSection = () => (
  <section aria-label="Notificações de vendas em tempo real" className="relative z-10 py-28 lg:py-36">
    <div className="container max-w-7xl mx-auto px-6">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="inline-flex items-center gap-2 bg-primary/[0.06] border border-primary/15 rounded-full px-4 py-1.5">
            <Bell className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-[0.15em]">
              Tempo Real
            </span>
          </div>

          <h2 className="font-display text-3xl md:text-[2.75rem] font-black tracking-[-0.03em] leading-[1.08]">
            Notificações em{" "}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #00E676, #00C853, #D4AF37)" }}>
              Tempo Real.
            </span>
          </h2>

          <p className="text-[15px] text-[#9A9AA5] max-w-md leading-[1.8] font-light">
            Com o app da Panttera você acompanha suas vendas em tempo real.{" "}
            <span className="text-white font-medium">Cada venda, um som de Ka-CHING</span> que vicia.
          </p>

          <div className="flex items-center gap-3 bg-[#141417] border border-white/[0.06] rounded-xl px-5 py-3 w-fit">
            <Volume2 className="w-5 h-5 text-primary animate-pulse" aria-hidden="true" />
            <div>
              <p className="text-[12px] font-bold text-white">Ka-CHING! 🔔</p>
              <p className="text-[10px] text-[#6A6A75]">Dopamina de empreendedor em cada venda</p>
            </div>
          </div>

          <div className="flex gap-6 pt-2">
            {[
              { value: "< 1s", label: "Latência" },
              { value: "Push", label: "Notificações" },
              { value: "24/7", label: "Monitoramento" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-lg font-black text-primary font-mono">{s.value}</p>
                <p className="text-[10px] text-[#6A6A75] uppercase tracking-wider font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="relative hidden lg:block">
          <NotificationPhoneMockup />
        </div>
      </div>
    </div>
  </section>
);

export default NotificationsSection;
