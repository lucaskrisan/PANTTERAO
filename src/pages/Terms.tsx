import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Scale, FileText, Users, AlertTriangle, Lock, Globe, Database, Ban, Brain, RefreshCw, MapPin, Building, Mail } from "lucide-react";
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

const Terms = () => (
  <div className="min-h-screen bg-background text-foreground">
    {/* Header */}
    <header className="sticky top-0 z-50 backdrop-blur-2xl bg-background/80 border-b border-border">
      <div className="container max-w-4xl mx-auto flex items-center justify-between px-6 h-16">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Voltar</span>
        </Link>
        <div className="flex items-center gap-2">
          <img src={panteraMascot} alt="" className="w-7 h-7" />
          <span className="text-sm font-bold text-muted-foreground">
            Pantera<span className="text-primary">Pay</span>
          </span>
        </div>
      </div>
    </header>

    {/* Hero */}
    <div className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(151_100%_45%/0.06)_0%,_transparent_60%)]" />
      <div className="container max-w-4xl mx-auto px-6 py-16 relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Scale className="w-6 h-6 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
          Termos de Uso
        </h1>
        <p className="text-muted-foreground text-sm">
          Última atualização: 2026
        </p>
      </div>
    </div>

    {/* Content */}
    <div className="container max-w-4xl mx-auto px-6 py-12 space-y-12">
      <Section number="01" title="Aceitação dos Termos" icon={FileText}>
        <p>Ao acessar ou utilizar a plataforma PanteraPay ("Plataforma"), o usuário declara ter lido, compreendido e aceitado integralmente os presentes Termos de Uso, bem como a Política de Privacidade aplicável.</p>
        <p>Caso o usuário não concorde com qualquer condição aqui descrita, deverá interromper imediatamente o uso da Plataforma.</p>
        <p>O uso contínuo da Plataforma implica aceitação automática de quaisquer atualizações destes Termos.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="02" title="Natureza da Plataforma" icon={Globe}>
        <p className="font-medium text-foreground/80">2.1 Objeto</p>
        <p>A PanteraPay é uma plataforma tecnológica que fornece infraestrutura digital para:</p>
        <BulletList items={[
          "Criação de páginas de checkout",
          "Automação de pagamentos",
          "Integração com gateways de pagamento",
          "Rastreamento de conversões",
          "Gestão de pedidos",
          "Integração com ferramentas externas",
        ]} />
        <p>A Plataforma opera sob o modelo Software as a Service (SaaS).</p>

        <p className="font-medium text-foreground/80 pt-2">2.2 Natureza Tecnológica</p>
        <p>A PanteraPay <strong className="text-foreground">NÃO</strong> é:</p>
        <BulletList items={[
          "Instituição financeira",
          "Instituição de pagamento",
          "Gateway de pagamento",
          "Processadora de pagamentos",
          "Custodiante de valores",
          "Intermediadora financeira",
        ]} />
        <p>A Plataforma não recebe, não armazena e não movimenta valores financeiros pertencentes a usuários ou terceiros.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="03" title="Processamento de Pagamentos" icon={Shield}>
        <p>Todos os pagamentos realizados através de checkouts criados na Plataforma são processados diretamente por gateways de pagamento ou provedores financeiros terceirizados, tais como:</p>
        <BulletList items={["Pagar.me", "Mercado Pago", "Stripe", "Efí Bank", "PushInPay", "Ou outros provedores compatíveis"]} />
        <div className="bg-card border border-border rounded-lg p-4 my-3">
          <p className="text-xs font-mono text-muted-foreground">Fluxo financeiro padrão:</p>
          <p className="text-sm font-bold text-foreground mt-1">Comprador → Gateway de Pagamento → Vendedor</p>
        </div>
        <p>A PanteraPay não participa do fluxo financeiro das transações, atuando apenas como camada tecnológica de integração e automação.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="04" title="Relação Comercial entre Usuários" icon={Users}>
        <p>A PanteraPay não participa das relações comerciais entre compradores e vendedores.</p>
        <p>A Plataforma não cria, não controla e não valida:</p>
        <BulletList items={[
          "Produtos ou serviços comercializados",
          "Descrições ou promessas de ofertas",
          "Preços praticados",
          "Prazos de entrega",
          "Políticas de garantia ou reembolso",
        ]} />
        <p>Qualquer disputa envolvendo não entrega, defeito, propaganda enganosa, chargeback, estorno ou reembolso deve ser resolvida diretamente entre comprador e vendedor ou junto ao gateway de pagamento utilizado.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="05" title="Isenção de Responsabilidade" icon={AlertTriangle}>
        <p>A PanteraPay não se responsabiliza por:</p>
        <BulletList items={[
          "Qualidade ou legalidade de produtos vendidos",
          "Cumprimento de ofertas comerciais",
          "Atrasos ou falhas na entrega de produtos",
          "Fraudes cometidas por usuários",
          "Retenção de valores por gateways ou instituições financeiras",
          "Chargebacks ou estornos",
          "Falhas em serviços de terceiros",
        ]} />
        <p>A responsabilidade sobre as atividades comerciais realizadas através da Plataforma é exclusiva do usuário vendedor.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="06" title="Conduta do Usuário" icon={Ban}>
        <p>É estritamente proibido utilizar a Plataforma para:</p>
        <BulletList items={[
          "Fraudes ou estelionato",
          "Venda de produtos ilegais",
          "Esquemas de pirâmide ou Ponzi",
          "Marketing enganoso",
          "Violação de direitos autorais",
          "Qualquer atividade ilícita",
        ]} />
        <p>Caso sejam identificadas atividades suspeitas, a PanteraPay poderá suspender contas, bloquear acessos, encerrar permanentemente usuários e cooperar com autoridades competentes.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="07" title="Responsabilidade do Usuário" icon={Users}>
        <p>O usuário é o único responsável por:</p>
        <BulletList items={[
          "Legalidade de seus produtos ou serviços",
          "Cumprimento de obrigações com consumidores",
          "Pagamento de tributos e impostos",
          "Cumprimento da legislação vigente",
          "Veracidade das informações fornecidas",
        ]} />
        <p>A PanteraPay não assume responsabilidade civil ou criminal decorrente das atividades realizadas pelos usuários.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="08" title="Integrações com Serviços de Terceiros" icon={Globe}>
        <p>A Plataforma poderá integrar serviços externos, incluindo:</p>
        <BulletList items={[
          "Gateways de pagamento",
          "Sistemas antifraude",
          "Ferramentas de e-mail",
          "Serviços de análise de dados",
          "Provedores de infraestrutura em nuvem",
        ]} />
        <p>A PanteraPay não controla nem garante a disponibilidade ou segurança desses serviços. Problemas decorrentes de serviços de terceiros são de responsabilidade exclusiva dos respectivos fornecedores.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="09" title="Privacidade e Dados" icon={Lock}>
        <p>A PanteraPay realiza coleta e tratamento de dados conforme sua Política de Privacidade, em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018).</p>
        <p>A Plataforma pode armazenar:</p>
        <BulletList items={["Logs de acesso", "Registros operacionais", "Metadados de transações", "Registros de segurança"]} />
        <p>Essas informações podem ser utilizadas para prevenção de fraudes, auditoria, segurança da plataforma e melhoria dos serviços.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="10" title="Limitação de Responsabilidade" icon={Shield}>
        <p>Em nenhuma hipótese a responsabilidade da PanteraPay excederá o valor pago pelo usuário à Plataforma nos últimos 12 meses de uso.</p>
        <p>A PanteraPay não será responsável por:</p>
        <BulletList items={["Perdas financeiras", "Lucros cessantes", "Interrupção de negócios", "Danos indiretos ou consequenciais"]} />
        <p>decorrentes do uso da Plataforma.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="11" title="Suspensão ou Encerramento de Conta" icon={Ban}>
        <p>A PanteraPay poderá suspender ou encerrar contas que:</p>
        <BulletList items={[
          "Violem estes Termos",
          "Apresentem comportamento suspeito",
          "Causem danos à Plataforma",
          "Recebam volume anormal de reclamações ou chargebacks",
        ]} />
        <p>O encerramento poderá ocorrer sem aviso prévio, a critério exclusivo da Plataforma.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="12" title="Propriedade Intelectual" icon={Brain}>
        <p>Todo o sistema PanteraPay, incluindo software, interface, layout, código-fonte e identidade visual, é protegido por direitos autorais e propriedade intelectual.</p>
        <p>É proibida qualquer tentativa de engenharia reversa, cópia ou utilização não autorizada da Plataforma.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="13" title="Atualizações dos Termos" icon={RefreshCw}>
        <p>A PanteraPay poderá atualizar estes Termos a qualquer momento.</p>
        <p>As alterações entrarão em vigor imediatamente após publicação na Plataforma.</p>
        <p>O uso contínuo da Plataforma implica aceitação das atualizações.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="14" title="Lei Aplicável e Foro" icon={Scale}>
        <p>Estes Termos são regidos pelas leis da República Federativa do Brasil.</p>
        <p>Fica eleito o foro da comarca de <strong className="text-foreground">São José do Rio Preto – SP</strong>, com exclusão de qualquer outro, por mais privilegiado que seja.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="15" title="Informações da Empresa" icon={Building}>
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Razão Social</span>
              <p className="text-foreground font-medium">Paola Rosso Pilecco Krisan</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Nome Fantasia</span>
              <p className="text-foreground font-medium">Zin Marketing</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">CNPJ</span>
              <p className="text-foreground font-mono font-medium">54.005.643/0001-57</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Inscrição Estadual</span>
              <p className="text-foreground font-mono font-medium">150.607.610.118</p>
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Endereço</span>
            <p className="text-foreground font-medium">Rua Jorge Abrao Aued, 225 · Jardim Yolanda</p>
            <p className="text-foreground font-medium">São José do Rio Preto – SP · CEP 15061-560 · Brasil</p>
          </div>
        </div>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="16" title="Contato" icon={Mail}>
        <p>Em caso de dúvidas, solicitações ou suporte:</p>
        <div className="bg-card border border-border rounded-lg p-5 space-y-2">
          <p className="text-foreground font-medium">📧 suporte@panterapay.com</p>
          <p className="text-sm">PanteraPay · Rua Jorge Abrao Aued, 225 · Jardim Yolanda · São José do Rio Preto – SP · CEP 15061-560</p>
        </div>
      </Section>
    </div>

    {/* Footer */}
    <footer className="border-t border-border py-8">
      <div className="container max-w-4xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={panteraMascot} alt="" className="w-6 h-6" />
          <span className="text-xs font-bold text-muted-foreground">
            Pantera<span className="text-primary">Pay</span>
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">© {new Date().getFullYear()} PanteraPay</p>
      </div>
    </footer>
  </div>
);

export default Terms;
