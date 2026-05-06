import { motion } from "framer-motion";
import {
  CreditCard, Globe, BarChart3, Webhook, Mail, Shield,
  Smartphone, ShoppingCart, Bell, Zap, Package, Link2,
} from "lucide-react";

const integrations = [
  { icon: CreditCard, label: "Pagar.me", color: "#00C853" },
  { icon: Globe, label: "Asaas", color: "#00E676" },
  { icon: ShoppingCart, label: "Mercado Pago", color: "#00B0FF" },
  { icon: Zap, label: "Stripe", color: "#6772E5" },
  { icon: BarChart3, label: "Meta Ads", color: "#1877F2" },
  { icon: Mail, label: "Resend", color: "#9A9AA5" },
  { icon: Webhook, label: "Webhooks", color: "#00E676" },
  { icon: Bell, label: "OneSignal", color: "#FF6B6B" },
  { icon: Smartphone, label: "WhatsApp", color: "#25D366" },
  { icon: Shield, label: "PCI DSS", color: "#D4AF37" },
  { icon: Package, label: "Appmax", color: "#FF9800" },
  { icon: Link2, label: "Zapier", color: "#FF4A00" },
];

function IntegrationHub() {
  return (
    <div className="relative w-full max-w-[500px] mx-auto aspect-square hidden lg:flex items-center justify-center" aria-hidden="true">
      {[160, 220].map((r, ri) => (
        <motion.div
          key={ri}
          className="absolute rounded-full border border-white/[0.04]"
          style={{ width: r * 2, height: r * 2 }}
          animate={{ rotate: ri === 0 ? 360 : -360 }}
          transition={{ duration: ri === 0 ? 30 : 45, repeat: Infinity, ease: "linear" }}
        />
      ))}

      <motion.div
        className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-[#0B0B0D] border border-primary/20 flex items-center justify-center shadow-[0_0_60px_rgba(0,230,118,0.2)]"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="text-3xl">🐆</span>
      </motion.div>

      {integrations.slice(0, 8).map((item, i) => {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const radius = 160;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <motion.div
            key={item.label}
            className="absolute z-10"
            style={{ left: `calc(50% + ${x}px - 22px)`, top: `calc(50% + ${y}px - 22px)` }}
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.08, type: "spring" }}
          >
            <motion.div
              className="w-11 h-11 rounded-xl bg-[#141417] border border-white/[0.08] flex items-center justify-center hover:border-white/[0.15] transition-all duration-300 relative group cursor-default"
              whileHover={{ scale: 1.15 }}
            >
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `radial-gradient(circle at center, ${item.color}15 0%, transparent 70%)` }}
              />
              <item.icon className="w-5 h-5 relative z-10" style={{ color: item.color }} />
            </motion.div>
          </motion.div>
        );
      })}

      {integrations.slice(0, 8).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        return (
          <motion.div
            key={`line-${i}`}
            className="absolute z-0"
            style={{
              left: "50%",
              top: "50%",
              width: 140,
              height: 1,
              transformOrigin: "0 0",
              transform: `rotate(${(angle * 180) / Math.PI}deg)`,
            }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-primary/20 to-transparent"
              animate={{ opacity: [0.1, 0.4, 0.1] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

const IntegrationsSection = () => (
  <section aria-label="Integrações com gateways e plataformas" className="relative z-10 py-28 lg:py-36 overflow-hidden">
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
      <div className="w-[500px] h-[500px] bg-[radial-gradient(circle,_rgba(0,230,118,0.06)_0%,_transparent_60%)] blur-3xl" />
    </div>

    <div className="container max-w-7xl mx-auto px-6">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <div>
            <span className="inline-block text-[10px] font-bold text-primary uppercase tracking-[0.25em] mb-5 bg-primary/[0.06] border border-primary/15 rounded-full px-4 py-1.5">
              Ecossistema
            </span>
            <h2 className="text-3xl md:text-[2.75rem] font-black tracking-[-0.03em] leading-[1.08]">
              Conecte-se às principais plataformas{" "}
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #00E676, #00C853, #D4AF37)" }}>
                do mercado.
              </span>
            </h2>
            <p className="text-sm text-[#6A6A75] mt-5 font-light leading-relaxed max-w-lg">
              A Panttera se integra com as ferramentas que você já usa. Dados em tempo real, automações e entrega sem complicação.
            </p>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-6 gap-4 lg:hidden">
            {integrations.map((item, i) => (
              <motion.div
                key={item.label}
                className="group flex flex-col items-center gap-2"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
              >
                <div className="w-14 h-14 rounded-xl bg-[#141417] border border-white/[0.06] flex items-center justify-center">
                  <item.icon className="w-5 h-5 opacity-60" style={{ color: item.color }} aria-hidden="true" />
                </div>
                <span className="text-[8px] text-[#5A5A65] font-semibold uppercase tracking-wider">
                  {item.label}
                </span>
              </motion.div>
            ))}
          </div>

          <motion.p
            className="text-[13px] text-[#6A6A75] font-light"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            Você vende. A tecnologia trabalha junto.{" "}
            <span className="text-primary font-semibold">Só conectar e usar.</span>
          </motion.p>
        </motion.div>

        <IntegrationHub />
      </div>
    </div>
  </section>
);

export default IntegrationsSection;
