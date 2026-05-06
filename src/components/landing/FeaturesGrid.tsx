import { CreditCard, QrCode, GraduationCap, Paintbrush, Sparkles, Target, Layers } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: CreditCard,
    title: "Checkout ultra-conversivo",
    desc: "Otimizado para maximizar vendas com timer, prova social e design que elimina objeções antes do clique.",
  },
  {
    icon: QrCode,
    title: "PIX, cartão e boleto",
    desc: "Aceita todos os métodos de pagamento. PIX com 94% de aprovação e desconto inteligente integrado.",
  },
  {
    icon: GraduationCap,
    title: "Área de membros integrada",
    desc: "Entregue cursos, módulos e materiais automaticamente após a compra. Zero trabalho manual.",
  },
  {
    icon: Paintbrush,
    title: "Builder visual de checkout",
    desc: "Monte seu checkout perfeito em minutos. Drag & drop, sem código, sem depender de ninguém.",
  },
  {
    icon: Sparkles,
    title: "One-click upsell",
    desc: "Ofertas pós-compra sem redigitar dados. Aumente o ticket médio em até 37% automaticamente.",
  },
  {
    icon: Target,
    title: "Rastreamento avançado Meta",
    desc: "Pixel + CAPI com deduplicação DUAL ✓ e EMQ otimizado. Cada centavo de anúncio rastreado.",
  },
  {
    icon: Layers,
    title: "GatFlow: Máquina de Vendas",
    desc: "Clonador de páginas, construtor de Pressel e Quiz Builder integrados para escalar seu funil sem limites.",
  },
];

export function SectionHeader({ title, highlight, subtitle, badge }: { title: string; highlight: string; subtitle: string; badge?: string }) {
  return (
    <motion.div
      className="max-w-2xl"
      initial={{ opacity: 0, y: 25 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {badge && (
        <span className="inline-block text-[10px] font-bold text-primary uppercase tracking-[0.25em] mb-5 bg-primary/[0.06] border border-primary/15 rounded-full px-4 py-1.5">
          {badge}
        </span>
      )}
      <h2 className="text-3xl md:text-[2.75rem] font-black tracking-[-0.025em] leading-[1.1]">
        {title}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#00C853] to-gold">
          {highlight}
        </span>
      </h2>
      <p className="text-sm text-[#6A6A75] mt-5 font-light leading-relaxed max-w-lg">{subtitle}</p>
    </motion.div>
  );
}

const FeaturesGrid = () => (
  <section id="features" aria-label="Recursos principais da Panttera" className="relative z-10 container max-w-7xl mx-auto px-6 py-28">
    <SectionHeader
      title="Uma plataforma, "
      highlight="controle total."
      subtitle="Tudo que você precisa para vender online com alta performance."
    />
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-16" role="list">
      {features.map((f, i) => (
        <FeatureCard key={f.title} {...f} index={i} />
      ))}
    </div>
  </section>
);

function FeatureCard({ icon: Icon, title, desc, index }: { icon: any; title: string; desc: string; index: number }) {
  return (
    <motion.article
      role="listitem"
      className="group relative bg-white/[0.02] border border-white/[0.05] rounded-2xl p-7 hover:border-primary/20 hover:bg-white/[0.04] transition-all duration-500 overflow-hidden cursor-default"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" aria-hidden="true" />
      <div className="relative z-10">
        <div className="w-12 h-12 bg-primary/[0.08] border border-primary/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary/[0.12] group-hover:border-primary/20 transition-all duration-500">
          <Icon className="w-5 h-5 text-primary/80 group-hover:text-primary transition-colors duration-300" aria-hidden="true" />
        </div>
        <h3 className="font-bold text-[15px] text-white mb-2 tracking-tight">{title}</h3>
        <p className="text-[13px] text-[#6A6A75] leading-relaxed font-light">{desc}</p>
      </div>
    </motion.article>
  );
}

export default FeaturesGrid;
