import { Link } from "react-router-dom";
import panteraMascot from "@/assets/pantera-mascot.png";

const LandingFooter = () => (
  <footer className="relative z-10 border-t border-white/[0.06] bg-[#070709] py-16">
    <div className="container max-w-7xl mx-auto px-6">
      {/* Top row */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-10">
        <Link to="/" className="flex items-center gap-3" aria-label="Panttera — Voltar ao início">
          <img
            src={panteraMascot}
            alt="Logo Panttera"
            className="w-9 h-9 drop-shadow-[0_0_15px_rgba(0,230,118,0.3)]"
            width={36}
            height={36}
            loading="lazy"
          />
          <span className="text-base font-bold text-foreground">
            Pant<span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #00E676, #D4AF37)" }}>tera</span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm" aria-label="Links legais">
          <Link to="/privacidade" className="text-muted-foreground hover:text-primary transition-colors duration-300">
            Política de Privacidade
          </Link>
          <Link to="/termos" className="text-muted-foreground hover:text-primary transition-colors duration-300">
            Termos de Serviço
          </Link>
          <Link to="/cookies" className="text-muted-foreground hover:text-primary transition-colors duration-300">
            Cookies
          </Link>
          <Link to="/isencao-financeira" className="text-muted-foreground hover:text-primary transition-colors duration-300">
            Isenção Financeira
          </Link>
          <Link to="/produtos-proibidos" className="text-muted-foreground hover:text-primary transition-colors duration-300">
            Produtos Proibidos
          </Link>
        </nav>
      </div>

      <div className="border-t border-white/[0.06] mb-8" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} Panttera · Move money like a predator.
        </p>
        <div className="flex items-center gap-6 text-xs">
          <Link to="/login" className="text-muted-foreground hover:text-primary transition-colors duration-300">
            Entrar
          </Link>
          <Link to="/login?signup=true" className="text-primary font-semibold hover:text-primary/80 transition-colors duration-300">
            Criar conta grátis
          </Link>
        </div>
      </div>
    </div>
  </footer>
);

export default LandingFooter;
