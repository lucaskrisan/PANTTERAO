import { memo } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Crown, FileText, Link2, Download, Video, BookOpen, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MemberTranslations } from "@/lib/memberI18n";

interface Lesson { id: string; title: string; content_type: string; content: string | null; file_url: string | null; sort_order: number; }
interface Module { id: string; title: string; description: string | null; sort_order: number; lessons: Lesson[]; }

const contentTypeIcons: Record<string, typeof FileText> = { text: FileText, link: Link2, pdf: Download, video_embed: Video, html: BookOpen };

interface Props {
  modules: Module[];
  activeModuleId: string | null;
  onToggleModule: (moduleId: string | null) => void;
  activeLesson: Lesson | null;
  completedLessons: Set<string>;
  onSelectLesson: (lesson: Lesson) => void;
  otherCoursesCount: number;
  onShowCatalog: () => void;
  t: MemberTranslations;
}

const MemberSidebarContent = memo(function MemberSidebarContent({ modules, activeModuleId, onToggleModule, activeLesson, completedLessons, onSelectLesson, otherCoursesCount, onShowCatalog, t }: Props) {
  return (
    <div className="space-y-2">
      {modules.map((mod, modIndex) => {
        const modCompleted = mod.lessons.filter((l) => completedLessons.has(l.id)).length;
        const modTotal = mod.lessons.length;
        const isOpen = activeModuleId === mod.id;
        return (
          <div key={mod.id} className="rounded-2xl overflow-hidden border transition-colors" style={{ background: "hsl(220 18% 10%)", borderColor: isOpen ? "hsl(145,65%,25%)" : "hsl(220 15% 14%)" }}>
            <button onClick={() => onToggleModule(isOpen ? null : mod.id)} className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-[hsl(220,16%,13%)]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: modCompleted === modTotal && modTotal > 0 ? "hsl(145,65%,42%)" : "hsl(220,18%,16%)", color: modCompleted === modTotal && modTotal > 0 ? "white" : "hsl(220,10%,50%)" }}>
                  {modCompleted === modTotal && modTotal > 0 ? <Trophy className="w-4 h-4" /> : modIndex + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-white font-semibold text-sm block truncate">{mod.title}</span>
                  <span className="text-[hsl(220,10%,40%)] text-xs">{t.lessonsCount(modCompleted, modTotal)}</span>
                </div>
              </div>
              {isOpen ? <ChevronDown className="w-4 h-4 text-[hsl(220,10%,40%)] flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-[hsl(220,10%,40%)] flex-shrink-0" />}
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="mx-4 mb-3 border-t pt-2 space-y-0.5" style={{ borderColor: "hsl(220 15% 14%)" }}>
                    {mod.lessons.map((lesson) => {
                      const isActive = activeLesson?.id === lesson.id;
                      const isCompleted = completedLessons.has(lesson.id);
                      const Icon = contentTypeIcons[lesson.content_type] || FileText;
                      return (
                        <button key={lesson.id} onClick={() => onSelectLesson(lesson)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all" style={{ background: isActive ? "hsl(145,65%,42%)" : "transparent", color: isActive ? "white" : "hsl(0,0%,75%)" }} onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "hsl(220,16%,14%)"; }} onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                          {isCompleted ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? "white" : "hsl(145,65%,50%)" }} /> : <Circle className="w-4 h-4 flex-shrink-0 text-[hsl(220,10%,30%)]" />}
                          <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                          <span className="truncate text-[13px]">{lesson.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      {otherCoursesCount > 0 && (
        <button onClick={onShowCatalog} className="w-full flex items-center gap-3 p-4 rounded-2xl border transition-all hover:scale-[1.01]" style={{ background: "linear-gradient(135deg, hsl(220,18%,10%), hsl(220,15%,12%))", borderColor: "hsl(45,93%,30%)" }}>
          <Crown className="w-5 h-5 text-[hsl(45,93%,55%)]" />
          <div className="text-left">
            <span className="text-white text-sm font-semibold block">{t.exploreMore}</span>
            <span className="text-[hsl(220,10%,40%)] text-xs">{t.available(otherCoursesCount)}</span>
          </div>
        </button>
      )}
    </div>
  );
});

export default MemberSidebarContent;
