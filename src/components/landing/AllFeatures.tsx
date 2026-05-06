import {
  BarChart3, Globe, ShoppingCart, Users, Layers, Webhook,
  Bell, Mail, TrendingUp, FileText, Shield, MousePointer2,
} from "lucide-react";
import { motion } from "framer-motion";
import { SectionHeader } from "./FeaturesGrid";
import whatsappIcon from "@/assets/whatsapp-icon.png";

const WhatsAppFeatureIcon = ({ className }: { className?: string }) => (
  <img src={whatsappIcon} alt="WhatsApp" className={className} />
);

const allFeatures = [
  { icon: BarChart3, title: "Dashboard em tempo real", desc: "Cada venda aparece ao vivo. Com notificação Ka-CHING que vicia." },
  { icon: Globe, title: "Multi-gateway inteligente", desc: "Pagar.me, Asaas, Mercado Pago e Stripe. Failover automático." },
  { icon: ShoppingCart, title: "Recuperação de carrinho", desc: "Captura quem desistiu e traz de volta. Dinheiro que ia pro lixo." },
  { icon: Users, title: "Cupons estratégicos", desc: "Cupons por produto com limite, validade e rastreamento de uso." },
  { icon: Layers, title: "Order bumps", desc: "Ofertas complementares no checkout. +23% de ticket médio." },
  { icon: Webhook, title: "Webhooks HMAC", desc: "Integre com qualquer plataforma com segurança militar." },
  { icon: Bell, title: "Push em tempo real", desc: "Cada venda grita no seu celular. Dopamina pura, 24/7." },
  { icon: Mail, title: "E-mails automáticos", desc: "Confirmação, acesso, lembrete. Tudo no piloto automático." },
  { icon: TrendingUp, title: "Atribuição UTM", desc: "Saiba exatamente qual campanha trouxe cada centavo." },
  { icon: FileText, title: "Relatórios cirúrgicos", desc: "Métricas por método, chargeback, reembolso. Dados que decidem." },
  { icon: Shield, title: "Segurança blindada", desc: "RLS, SSL, antifraude. Seu dinheiro protegido em todos os gateways." },
  { icon: WhatsAppFeatureIcon, title: "WhatsApp (em breve)", desc: "Recuperação e entrega via WhatsApp. O canal que todo mundo usa." },
  { icon: MousePointer2, title: "Clonador & Quiz", desc: "Clone qualquer página e construa quizzes lucrativos em segundos." },
];

const AllFeatures = () => (
  <section id="all-features" aria-label="Todas as funcionalidades da plataforma" className="relative z-10 container max-w-7xl mx-auto px-6 py-32">
    <SectionHeader
      badge="Arsenal completo"
      title="Tudo que um "
      highlight="predador precisa."
      subtitle="18+ funcionalidades que plataformas de R$ 497/mês nem sonham em oferecer. E na Panttera é grátis."
    />
    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-20" role="list">
      {allFeatures.map((f, i) => (
        <motion.article
          key={f.title}
          role="listitem"
          className="group bg-white/[0.015] border border-white/[0.04] rounded-xl p-5 hover:border-primary/15 hover:bg-white/[0.03] transition-all duration-500"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.4, delay: i * 0.03 }}
        >
          <f.icon className="w-[18px] h-[18px] text-primary/40 mb-3 group-hover:text-primary transition-colors duration-300" aria-hidden="true" />
          <h3 className="text-[13px] font-bold text-white mb-1 tracking-tight">{f.title}</h3>
          <p className="text-[12px] text-[#6A6A75] leading-relaxed font-light">{f.desc}</p>
        </motion.article>
      ))}
    </div>
  </section>
);

export default AllFeatures;
