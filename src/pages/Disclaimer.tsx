import { Link } from "react-router-dom";
import { ArrowLeft, DollarSign, Cpu, CreditCard, Gavel, ShieldAlert, AlertTriangle, Users, ShieldCheck, Ban, Mail } from "lucide-react";
import panteraMascot from "@/assets/pantera-mascot.png";

const Section = ({ number, title, icon: Icon, children }: { number: string; title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <section className="group">
    <div className="flex items-start gap-4 mb-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-mono text-sm font-bold">
        {number}
      </div>
      <div className="flex items-center gap-2.5 pt-2">
        <Icon className="w-5 h-5 text-primary/70" />
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
    </div>
    <div className="ml-14 text-muted-foreground text-sm leading-relaxed space-y-3">
      {children}
    </div>
  </section>
);

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5 pl-1">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2">
        <span className="w-1 h-1 rounded-full bg-primary/60 mt-2 flex-shrink-0" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const Disclaimer = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-50 backdrop-blur-2xl bg-background/80 border-b border-border">
      <div className="container max-w-4xl mx-auto flex items-center justify-between px-6 h-16">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Voltar</span>
        </Link>
        <div className="flex items-center gap-2">
          <img src={panteraMascot} alt="" className="w-7 h-7" />
          <span className="text-sm font-bold text-muted-foreground">Pantera<span className="text-primary">Pay</span></span>
        </div>
      </div>
    </header>

    {/* ===== AVISO DE ISENÇÃO FINANCEIRA ===== */}
    <div className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(151_100%_45%/0.06)_0%,_transparent_60%)]" />
      <div className="container max-w-4xl mx-auto px-6 py-16 relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">Aviso de Isenção Financeira</h1>
        <p className="text-muted-foreground text-sm">Última atualização: 2026</p>
      </div>
    </div>

    <div className="container max-w-4xl mx-auto px-6 py-12 space-y-12">
      <Section number="01" title="Natureza Tecnológica da Plataforma" icon={Cpu}>
        <p>A PanteraPay é uma plataforma tecnológica que fornece infraestrutura digital para criação de checkouts e automação de pagamentos.</p>
        <p className="font-bold text-foreground">A PanteraPay não é instituição financeira e não presta serviços financeiros.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="02" title="Processamento de Pagamentos" icon={CreditCard}>
        <p>Todos os pagamentos realizados através de checkouts criados na plataforma são processados diretamente por provedores financeiros ou gateways de pagamento terceirizados.</p>
        <p>A PanteraPay:</p>
        <BulletList items={["Não processa pagamentos", "Não recebe valores de transações", "Não mantém custódia de dinheiro", "Não participa do fluxo financeiro"]} />
        <div className="bg-card border border-border rounded-lg p-4 my-3">
          <p className="text-xs font-mono text-muted-foreground">Fluxo de pagamento:</p>
          <p className="text-sm font-bold text-foreground mt-1">Comprador → Gateway de Pagamento → Vendedor</p>
        </div>
        <p>A PanteraPay atua apenas como camada tecnológica de integração.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="03" title="Disputas Financeiras" icon={Gavel}>
        <p>Qualquer disputa relacionada a pagamentos, incluindo:</p>
        <BulletList items={["Estornos", "Chargebacks", "Retenções de valores", "Bloqueios financeiros"]} />
        <p>deve ser resolvida diretamente entre:</p>
        <BulletList items={["Comprador", "Vendedor", "Gateway de pagamento utilizado"]} />
        <p className="font-bold text-foreground">A PanteraPay não participa dessas disputas.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="04" title="Limitação de Responsabilidade" icon={ShieldAlert}>
        <p>A PanteraPay não se responsabiliza por:</p>
        <BulletList items={["Falhas de gateways de pagamento", "Bloqueios de valores por instituições financeiras", "Atrasos de processamento de pagamentos", "Decisões tomadas por provedores financeiros"]} />
      </Section>
    </div>

    {/* ===== POLÍTICA DE DISPUTAS E CHARGEBACK ===== */}
    <div className="border-t-4 border-primary/20">
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(151_100%_45%/0.06)_0%,_transparent_60%)]" />
        <div className="container max-w-4xl mx-auto px-6 py-16 relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">Política de Disputas e Chargeback</h2>
          <p className="text-muted-foreground text-sm">Última atualização: 2026</p>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-6 py-12 space-y-12">
        <Section number="01" title="Natureza das Disputas" icon={Gavel}>
          <p>A PanteraPay atua apenas como infraestrutura tecnológica e não participa das transações financeiras entre compradores e vendedores.</p>
          <p>Dessa forma, disputas comerciais devem ser tratadas diretamente entre as partes envolvidas.</p>
        </Section>

        <div className="border-t border-border/50" />

        <Section number="02" title="Chargebacks" icon={CreditCard}>
          <p>Chargebacks ocorrem quando o comprador contesta uma transação junto à operadora de cartão ou ao gateway de pagamento.</p>
          <p>O processamento de chargebacks é responsabilidade exclusiva do:</p>
          <BulletList items={["Gateway de pagamento", "Emissor do cartão", "Vendedor responsável pela venda"]} />
          <p className="font-bold text-foreground">A PanteraPay não processa nem interfere em processos de chargeback.</p>
        </Section>

        <div className="border-t border-border/50" />

        <Section number="03" title="Responsabilidade do Vendedor" icon={Users}>
          <p>O vendedor é responsável por:</p>
          <BulletList items={["Fornecer informações claras sobre o produto ou serviço", "Cumprir prazos de entrega", "Manter políticas de reembolso adequadas", "Responder solicitações de consumidores"]} />
          <p>Altas taxas de chargeback podem resultar em <strong className="text-foreground">suspensão da conta</strong> na plataforma.</p>
        </Section>

        <div className="border-t border-border/50" />

        <Section number="04" title="Medidas Preventivas" icon={ShieldCheck}>
          <p>Para reduzir disputas, recomenda-se que vendedores:</p>
          <BulletList items={["Utilizem descrições claras de produtos", "Mantenham canais de suporte ao consumidor", "Evitem promessas irreais", "Mantenham transparência nas políticas comerciais"]} />
        </Section>

        <div className="border-t border-border/50" />

        <Section number="05" title="Suspensão por Risco" icon={Ban}>
          <p>A PanteraPay poderá suspender contas que apresentem:</p>
          <BulletList items={["Volume excessivo de disputas", "Denúncias recorrentes", "Comportamento suspeito de fraude"]} />
          <p>Essa medida visa proteger a integridade da plataforma.</p>
        </Section>
      </div>
    </div>

    <footer className="border-t border-border py-8">
      <div className="container max-w-4xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={panteraMascot} alt="" className="w-6 h-6" />
          <span className="text-xs font-bold text-muted-foreground">Pantera<span className="text-primary">Pay</span></span>
        </div>
        <p className="text-[11px] text-muted-foreground">© {new Date().getFullYear()} PanteraPay</p>
      </div>
    </footer>
  </div>
);

export default Disclaimer;
