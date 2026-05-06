import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Menu, Sparkles, X, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";
import type { MemberTranslations } from "@/lib/memberI18n";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  courseTitle: string;
  completedCount: number;
  totalLessons: number;
  progressPercent: number;
  showCatalog: boolean;
  onToggleCatalog: () => void;
  onOpenMobileSidebar: () => void;
  token: string | null;
  t: MemberTranslations;
}

const MemberHeader = memo(function MemberHeader({
  courseTitle, completedCount, totalLessons, progressPercent,
  showCatalog, onToggleCatalog, onOpenMobileSidebar, token, t,
}: Props) {
  const navigate = useNavigate();
  const { isCollaborator, isAdmin, isSuperAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ background: "hsla(220, 20%, 6%, 0.85)", borderColor: "hsl(220 15% 12%)" }}>
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button onClick={onOpenMobileSidebar} className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "hsl(220 18% 14%)" }}>
            <Menu className="w-4 h-4 text-[hsl(0,0%,60%)]" />
          </button>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center bg-gradient-to-br flex-shrink-0" style={{ backgroundImage: "linear-gradient(135deg, hsl(145,65%,42%), hsl(160,70%,36%))" }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-white font-bold text-xs sm:text-sm leading-tight truncate">{courseTitle}</h1>
            <p className="text-[hsl(220,10%,45%)] text-[10px] sm:text-xs">{t.lessonsCount(completedCount, totalLessons)}</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 flex-1 justify-center max-w-md">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(220 18% 14%)" }}>
            <motion.div className="h-full rounded-full" style={{ backgroundImage: "linear-gradient(90deg, hsl(145,65%,42%), hsl(145,80%,60%))" }} initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} transition={{ duration: 1, ease: "easeOut" }} />
          </div>
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: "hsl(145,65%,50%)" }}>{Math.round(progressPercent)}%</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {isSuperAdmin ? (
            <button 
              onClick={() => navigate("/admin")} 
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Painel
            </button>
          ) : isCollaborator ? (
            <button 
              onClick={() => navigate("/admin")} 
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Painel
            </button>
          ) : isAdmin ? (
            <button 
              onClick={() => navigate("/admin")} 
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Painel
            </button>
          ) : null}
          <div className="flex md:hidden">
            <div className="w-9 h-9 relative">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(220,18%,14%)" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(145,65%,42%)" strokeWidth="3" strokeDasharray={`${progressPercent}, 100`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">{Math.round(progressPercent)}%</span>
            </div>
          </div>
          <button onClick={onToggleCatalog} className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]" style={{ background: showCatalog ? "hsl(145,65%,42%)" : "hsl(220 18% 14%)", color: showCatalog ? "white" : "hsl(0 0% 70%)" }}>
            <Crown className="w-4 h-4" />
            <span className="hidden sm:inline">{t.catalog}</span>
          </button>
          <button onClick={() => navigate("/minha-conta" + (token ? `?token=${token}` : ""))} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-[hsl(220,16%,18%)]" style={{ background: "hsl(220 18% 14%)" }} title={t.myCourses}>
            <ArrowLeft className="w-4 h-4 text-[hsl(0,0%,60%)]" />
          </button>
        </div>
      </div>
    </header>
  );
});

export default MemberHeader;