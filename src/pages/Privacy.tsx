import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Eye, Database, Share2, Cookie, Lock, Clock, UserCheck, Globe, Scale, RefreshCw, Mail, Building } from "lucide-react";
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

const Privacy = () => (
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
            <Shield className="w-6 h-6 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">Política de Privacidade</h1>
        <p className="text-muted-foreground text-sm">Última atualização: 2026</p>
      </div>
    </div>

    <div className="container max-w-4xl mx-auto px-6 py-12 space-y-12">
      <Section number="01" title="Introdução" icon={Eye}>
        <p>A presente Política de Privacidade descreve como a plataforma PanteraPay coleta, utiliza, armazena e protege dados pessoais de seus usuários.</p>
        <div className="bg-card border border-border rounded-lg p-5 space-y-2">
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
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Endereço</span>
            <p className="text-foreground font-medium">Rua Jorge Abrao Aued, 225 · Jardim Yolanda · São José do Rio Preto – SP · CEP 15061-560</p>
          </div>
        </div>
        <p>Ao utilizar a plataforma PanteraPay, o usuário declara ciência e concordância com esta Política.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="02" title="Dados Coletados" icon={Database}>
        <p className="font-medium text-foreground/80">2.1 Dados fornecidos pelo usuário</p>
        <p>Podemos coletar informações fornecidas diretamente pelo usuário, incluindo:</p>
        <BulletList items={["Nome completo", "Endereço de e-mail", "Número de telefone", "CPF ou CNPJ", "Endereço", "Informações comerciais", "Dados de conta e login"]} />
        <p>Esses dados são necessários para criação e manutenção da conta na plataforma.</p>

        <p className="font-medium text-foreground/80 pt-2">2.2 Dados de transação</p>
        <p>Durante o uso da plataforma, podem ser coletados dados relacionados a pedidos e transações, como:</p>
        <BulletList items={["Identificação do pedido", "Valor da transação", "Status do pagamento", "Histórico de pedidos", "Dados de integração com gateways de pagamento"]} />
        <div className="bg-card border border-primary/20 rounded-lg p-4">
          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Importante</p>
          <p>A PanteraPay <strong className="text-foreground">não armazena</strong> dados completos de cartão de crédito ou credenciais financeiras sensíveis. Essas informações são processadas diretamente por provedores de pagamento terceirizados.</p>
        </div>

        <p className="font-medium text-foreground/80 pt-2">2.3 Dados de navegação</p>
        <p>Podemos coletar automaticamente:</p>
        <BulletList items={["Endereço IP", "Tipo de dispositivo", "Sistema operacional", "Navegador utilizado", "Páginas acessadas", "Tempo de navegação", "Identificadores de cookies"]} />
        <p>Esses dados ajudam a melhorar a segurança e a experiência da plataforma.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="03" title="Finalidade do Uso dos Dados" icon={Eye}>
        <p>Os dados coletados podem ser utilizados para:</p>
        <BulletList items={["Criação e gestão de contas", "Processamento e gestão de pedidos", "Suporte ao usuário", "Comunicação sobre serviços da plataforma", "Prevenção de fraudes", "Cumprimento de obrigações legais", "Melhoria da plataforma e dos serviços"]} />
        <p className="font-bold text-foreground">A PanteraPay não vende dados pessoais a terceiros.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="04" title="Compartilhamento de Dados" icon={Share2}>
        <p>Os dados podem ser compartilhados com terceiros apenas quando necessário para operação da plataforma. Isso inclui:</p>
        <BulletList items={["Gateways de pagamento", "Provedores de infraestrutura em nuvem", "Ferramentas de análise de dados", "Sistemas antifraude", "Serviços de envio de e-mail"]} />
        <p>Entre os provedores que podem receber dados operacionais estão:</p>
        <BulletList items={["Stripe", "Mercado Pago", "Pagar.me", "Efí Bank", "Serviços de hospedagem em nuvem", "Plataformas de analytics"]} />
        <p>Esses terceiros possuem suas próprias políticas de privacidade.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="05" title="Cookies e Tecnologias de Rastreamento" icon={Cookie}>
        <p>A PanteraPay utiliza cookies e tecnologias similares para:</p>
        <BulletList items={["Autenticação de usuários", "Análise de tráfego", "Personalização da experiência", "Prevenção de fraudes"]} />
        <p>O usuário pode gerenciar cookies diretamente nas configurações de seu navegador.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="06" title="Segurança das Informações" icon={Lock}>
        <p>A PanteraPay adota medidas técnicas e organizacionais adequadas para proteger dados pessoais, incluindo:</p>
        <BulletList items={["Criptografia de dados", "Controle de acesso", "Monitoramento de segurança", "Infraestrutura segura em nuvem"]} />
        <p>Apesar dos esforços, nenhum sistema digital é completamente imune a riscos.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="07" title="Retenção de Dados" icon={Clock}>
        <p>Os dados pessoais são armazenados apenas pelo tempo necessário para:</p>
        <BulletList items={["Cumprimento das finalidades descritas nesta Política", "Obrigações legais ou regulatórias", "Prevenção de fraudes e disputas"]} />
        <p>Após esse período, os dados poderão ser anonimizados ou excluídos.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="08" title="Direitos do Titular dos Dados" icon={UserCheck}>
        <p>De acordo com a legislação aplicável, o usuário pode solicitar:</p>
        <BulletList items={["Confirmação da existência de tratamento de dados", "Acesso aos dados pessoais", "Correção de dados incompletos ou desatualizados", "Anonimização ou exclusão de dados", "Portabilidade de dados", "Revogação do consentimento"]} />
        <p>Solicitações podem ser feitas através do e-mail de contato informado abaixo.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="09" title="Transferência Internacional de Dados" icon={Globe}>
        <p>Alguns serviços utilizados pela PanteraPay podem estar localizados fora do Brasil.</p>
        <p>Nesses casos, garantimos que os dados sejam tratados conforme padrões adequados de proteção e segurança.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="10" title="Conformidade Legal" icon={Scale}>
        <p>A presente Política segue os princípios da:</p>
        <BulletList items={["Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018)", "Legislação brasileira de proteção ao consumidor", "Boas práticas internacionais de proteção de dados"]} />
      </Section>

      <div className="border-t border-border/50" />

      <Section number="11" title="Atualizações desta Política" icon={RefreshCw}>
        <p>A PanteraPay pode atualizar esta Política de Privacidade a qualquer momento.</p>
        <p>A versão mais recente estará sempre disponível na plataforma.</p>
        <p>O uso contínuo da plataforma implica concordância com eventuais atualizações.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="12" title="Contato" icon={Mail}>
        <p>Para dúvidas, solicitações ou exercício de direitos relacionados a dados pessoais:</p>
        <div className="bg-card border border-border rounded-lg p-5 space-y-2">
          <p className="text-foreground font-medium">📧 suporte@panterapay.com</p>
          <p className="text-sm">PanteraPay · Rua Jorge Abrao Aued, 225 · Jardim Yolanda · São José do Rio Preto – SP · CEP 15061-560 · Brasil</p>
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

export default Privacy;
