import { Link } from "react-router-dom";
import { ArrowLeft, Ban, Target, ShieldX, Fingerprint, DollarSign, AlertOctagon, Flame, TriangleAlert, Eye, Users, RefreshCw, Mail } from "lucide-react";
import panteraMascot from "@/assets/pantera-mascot.png";

const Section = ({ number, title, icon: Icon, children }: { number: string; title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <section className="group">
    <div className="flex items-start gap-4 mb-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-mono text-sm font-bold">{number}</div>
      <div className="flex items-center gap-2.5 pt-2">
        <Icon className="w-5 h-5 text-primary/70" />
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
    </div>
    <div className="ml-14 text-muted-foreground text-sm leading-relaxed space-y-3">{children}</div>
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

const ProhibitedContent = () => (
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

    <div className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(151_100%_45%/0.06)_0%,_transparent_60%)]" />
      <div className="container max-w-4xl mx-auto px-6 py-16 relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Ban className="w-6 h-6 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">Política de Conteúdo e Produtos Proibidos</h1>
        <p className="text-muted-foreground text-sm">Última atualização: 2026</p>
      </div>
    </div>

    <div className="container max-w-4xl mx-auto px-6 py-12 space-y-12">
      <Section number="01" title="Objetivo" icon={Target}>
        <p>Esta Política define quais tipos de produtos, serviços ou conteúdos não podem ser comercializados ou promovidos utilizando a plataforma PanteraPay.</p>
        <p>A finalidade é manter a integridade da plataforma, cumprir a legislação aplicável e reduzir riscos de fraude ou atividades ilícitas.</p>
        <p>Ao utilizar a plataforma PanteraPay, o usuário concorda em respeitar integralmente esta Política.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="02" title="Produtos e Serviços Ilegais" icon={ShieldX}>
        <p>É estritamente proibido utilizar a plataforma para comercializar ou promover qualquer produto ou serviço ilegal segundo a legislação brasileira ou internacional. Isso inclui, mas não se limita a:</p>
        <BulletList items={["Drogas ilícitas ou substâncias controladas sem autorização legal", "Armas de fogo, munições ou explosivos", "Documentos falsificados", "Produtos contrabandeados", "Bens roubados ou obtidos ilegalmente", "Softwares piratas ou conteúdo pirateado"]} />
      </Section>

      <div className="border-t border-border/50" />

      <Section number="03" title="Produtos Falsificados ou que Violam Propriedade Intelectual" icon={Fingerprint}>
        <p>Não é permitido vender produtos que infrinjam direitos de terceiros, incluindo:</p>
        <BulletList items={["Produtos falsificados", "Uso indevido de marcas registradas", "Reprodução não autorizada de conteúdo protegido por direitos autorais", "Distribuição ilegal de materiais digitais"]} />
      </Section>

      <div className="border-t border-border/50" />

      <Section number="04" title="Esquemas Financeiros e Fraudes" icon={DollarSign}>
        <p>A PanteraPay proíbe a utilização da plataforma para promover ou operar:</p>
        <BulletList items={["Esquemas de pirâmide", "Esquemas Ponzi", "Investimentos fraudulentos", "Promessas de ganhos financeiros irreais", "Golpes ou estelionato"]} />
      </Section>

      <div className="border-t border-border/50" />

      <Section number="05" title="Conteúdo Enganoso ou Fraudulento" icon={AlertOctagon}>
        <p>Não é permitido utilizar a plataforma para promover:</p>
        <BulletList items={["Informações falsas ou enganosas", "Promessas impossíveis de cumprir", "Ofertas que induzam o consumidor ao erro", "Manipulação fraudulenta de avaliações ou depoimentos"]} />
      </Section>

      <div className="border-t border-border/50" />

      <Section number="06" title="Conteúdo Prejudicial ou Abusivo" icon={Flame}>
        <p>É proibido utilizar a plataforma para promover conteúdos que envolvam:</p>
        <BulletList items={["Violência ou incitação à violência", "Discurso de ódio", "Discriminação racial, religiosa ou de gênero", "Exploração ou abuso de menores"]} />
      </Section>

      <div className="border-t border-border/50" />

      <Section number="07" title="Atividades de Alto Risco" icon={TriangleAlert}>
        <p>Determinados tipos de produtos ou serviços podem ser classificados como alto risco e poderão ser restringidos ou analisados caso a caso pela PanteraPay. Exemplos incluem:</p>
        <BulletList items={["Serviços financeiros não regulamentados", "Jogos de azar ilegais", "Produtos que exijam licenças específicas", "Medicamentos controlados"]} />
      </Section>

      <div className="border-t border-border/50" />

      <Section number="08" title="Monitoramento e Fiscalização" icon={Eye}>
        <p>A PanteraPay poderá realizar monitoramento manual ou automatizado para identificar violações desta Política.</p>
        <p>Caso sejam detectadas atividades proibidas, a plataforma poderá:</p>
        <BulletList items={["Suspender temporariamente a conta do usuário", "Remover conteúdos ou ofertas", "Encerrar permanentemente o acesso à plataforma", "Cooperar com autoridades competentes"]} />
      </Section>

      <div className="border-t border-border/50" />

      <Section number="09" title="Responsabilidade do Usuário" icon={Users}>
        <p>O usuário é o único responsável por garantir que os produtos ou serviços oferecidos por meio da plataforma:</p>
        <BulletList items={["Estejam em conformidade com a legislação aplicável", "Respeitem direitos de terceiros", "Sejam apresentados de forma clara e verdadeira"]} />
        <p>A PanteraPay não assume responsabilidade pelas atividades comerciais realizadas por usuários.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="10" title="Atualizações desta Política" icon={RefreshCw}>
        <p>A PanteraPay poderá atualizar esta Política de Conteúdo e Produtos Proibidos a qualquer momento.</p>
        <p>A versão mais recente estará sempre disponível na plataforma.</p>
        <p>O uso contínuo da plataforma implica aceitação das atualizações.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="11" title="Contato" icon={Mail}>
        <p>Em caso de dúvidas relacionadas a esta Política:</p>
        <div className="bg-card border border-border rounded-lg p-5 space-y-2">
          <p className="text-foreground font-medium">📧 suporte@panterapay.com</p>
          <div className="text-sm space-y-1">
            <p>Operado por: <strong className="text-foreground">Paola Rosso Pilecco Krisan</strong></p>
            <p>CNPJ: <span className="font-mono text-foreground">54.005.643/0001-57</span></p>
            <p>Rua Jorge Abrao Aued, 225 · Jardim Yolanda · São José do Rio Preto – SP · CEP 15061-560 · Brasil</p>
          </div>
        </div>
      </Section>
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

export default ProhibitedContent;
