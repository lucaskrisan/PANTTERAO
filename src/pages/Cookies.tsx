import { Link } from "react-router-dom";
import { ArrowLeft, Cookie, Shield, BarChart3, Settings, Share2, SlidersHorizontal, CheckCircle, RefreshCw, Mail } from "lucide-react";
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

const Cookies = () => (
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
            <Cookie className="w-6 h-6 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">Política de Cookies</h1>
        <p className="text-muted-foreground text-sm">Última atualização: 2026</p>
      </div>
    </div>

    <div className="container max-w-4xl mx-auto px-6 py-12 space-y-12">
      <Section number="01" title="O que são Cookies" icon={Cookie}>
        <p>Cookies são pequenos arquivos de texto armazenados no navegador ou dispositivo do usuário quando ele acessa um site ou plataforma online.</p>
        <p>Esses arquivos permitem reconhecer o usuário, melhorar a experiência de navegação e coletar informações para funcionamento adequado da plataforma.</p>
        <p>A PanteraPay utiliza cookies para garantir segurança, desempenho e personalização da experiência.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="02" title="Como Utilizamos Cookies" icon={Settings}>
        <p>A plataforma PanteraPay utiliza cookies para:</p>
        <BulletList items={["Manter sessões de login ativas", "Garantir segurança e autenticação de usuários", "Melhorar o desempenho da plataforma", "Analisar comportamento de navegação", "Medir desempenho de páginas e checkouts", "Prevenir fraudes e acessos não autorizados"]} />
      </Section>

      <div className="border-t border-border/50" />

      <Section number="03" title="Tipos de Cookies Utilizados" icon={SlidersHorizontal}>
        <p className="font-medium text-foreground/80">3.1 Cookies Essenciais</p>
        <p>Esses cookies são necessários para o funcionamento básico da plataforma. Sem eles, algumas funcionalidades podem não funcionar corretamente.</p>
        <BulletList items={["Autenticação de login", "Segurança de sessão", "Gerenciamento de conta"]} />

        <p className="font-medium text-foreground/80 pt-2">3.2 Cookies de Desempenho</p>
        <p>Esses cookies ajudam a entender como os usuários interagem com a plataforma. Eles permitem identificar:</p>
        <BulletList items={["Páginas mais acessadas", "Tempo de navegação", "Possíveis erros técnicos"]} />
        <p>Essas informações são utilizadas para melhorar o desempenho da plataforma.</p>

        <p className="font-medium text-foreground/80 pt-2">3.3 Cookies de Funcionalidade</p>
        <p>Permitem que a plataforma lembre preferências do usuário, como:</p>
        <BulletList items={["Idioma", "Configurações da conta", "Preferências de navegação"]} />

        <p className="font-medium text-foreground/80 pt-2">3.4 Cookies de Análise e Marketing</p>
        <p>Alguns cookies podem ser utilizados para análise de dados e integração com ferramentas externas de medição e publicidade. Essas tecnologias podem incluir ferramentas de análise fornecidas por terceiros.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="04" title="Cookies de Terceiros" icon={Share2}>
        <p>A PanteraPay pode utilizar serviços de terceiros que também utilizam cookies, incluindo ferramentas de análise, infraestrutura ou integração de serviços.</p>
        <p>Entre os possíveis fornecedores estão:</p>
        <BulletList items={["Serviços de analytics", "Ferramentas de monitoramento de desempenho", "Plataformas de publicidade", "Provedores de infraestrutura"]} />
        <p>Esses terceiros possuem suas próprias políticas de privacidade e cookies.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="05" title="Gerenciamento de Cookies" icon={BarChart3}>
        <p>O usuário pode controlar ou desativar cookies diretamente nas configurações de seu navegador.</p>
        <p>A maioria dos navegadores permite:</p>
        <BulletList items={["Bloquear cookies", "Excluir cookies armazenados", "Receber alertas antes de armazenamento de cookies"]} />
        <p>No entanto, a desativação de alguns cookies pode impactar o funcionamento adequado da plataforma.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="06" title="Consentimento" icon={CheckCircle}>
        <p>Ao continuar utilizando a plataforma PanteraPay, o usuário concorda com o uso de cookies conforme descrito nesta Política.</p>
        <p>Quando exigido pela legislação aplicável, o usuário poderá receber aviso ou banner de consentimento antes da coleta de determinados cookies.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="07" title="Atualizações desta Política" icon={RefreshCw}>
        <p>A PanteraPay poderá atualizar esta Política de Cookies a qualquer momento.</p>
        <p>A versão mais recente estará sempre disponível na plataforma.</p>
      </Section>

      <div className="border-t border-border/50" />

      <Section number="08" title="Contato" icon={Mail}>
        <p>Em caso de dúvidas relacionadas ao uso de cookies ou privacidade de dados:</p>
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

export default Cookies;
