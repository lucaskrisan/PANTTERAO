import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { useSearchParams, useNavigate, NavigateFunction } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { List, Loader2, PlayCircle, Mail, ArrowRight, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import MemberInstallBanner from "@/components/member/MemberInstallBanner";
const NinaChatWidget = lazy(() => import("@/components/member/NinaChatWidget"));
import MemberHeader from "@/components/member/MemberHeader";
import MemberMobileSidebar from "@/components/member/MemberMobileSidebar";
import MemberSidebarContent from "@/components/member/MemberSidebarContent";
import MemberCatalogPanel from "@/components/member/MemberCatalogPanel";
import MemberLessonViewer from "@/components/member/MemberLessonViewer";
import { getMemberTranslations, langFromCurrency, type MemberLang, type MemberTranslations } from "@/lib/memberI18n";

// ─── Restricted Access self-service recovery screen ──────────────────────────
const RestrictedAccessRecovery = ({
  navigate,
  t,
  lang,
}: {
  navigate: NavigateFunction;
  t: MemberTranslations;
  lang: MemberLang;
}) => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error(t.recoverInvalidEmail);
      return;
    }
    setSending(true);
    try {
      await supabase.functions.invoke("recover-member-access", {
        body: { email: trimmed, lang },
      });
    } catch (err) {
      console.error("recover error", err);
    } finally {
      setSent(true);
      toast.success(t.recoverGenericResponse);
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "hsl(220 20% 6%)" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full p-8 sm:p-10 rounded-3xl border"
        style={{ background: "hsl(220 18% 10%)", borderColor: "hsl(220 15% 16%)" }}
      >
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[hsl(145,65%,42%)] to-[hsl(160,70%,36%)] flex items-center justify-center">
          <Mail className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-2">{t.recoverTitle}</h1>
        <p className="text-[hsl(220,10%,60%)] text-sm text-center mb-6">{t.recoverDesc}</p>

        {sent ? (
          <div className="text-center py-4">
            <p className="text-[hsl(145,65%,55%)] text-sm leading-relaxed">{t.recoverGenericResponse}</p>
          </div>
        ) : (
          <form onSubmit={handleRecover} className="space-y-3">
            <label className="block text-xs font-medium text-[hsl(220,10%,70%)]">{t.recoverEmailLabel}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.recoverEmailPlaceholder}
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-[hsl(220,10%,40%)] outline-none transition-all focus:ring-2 focus:ring-[hsl(145,65%,42%)]"
              style={{ background: "hsl(220 18% 14%)", border: "1px solid hsl(220 15% 18%)" }}
            />
            <button
              type="submit"
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
              style={{ backgroundImage: "linear-gradient(135deg, hsl(145,65%,42%), hsl(160,70%,36%))", color: "white" }}
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t.recoverSending}</>
              ) : (
                <><Mail className="w-4 h-4" /> {t.recoverButton}</>
              )}
            </button>
          </form>
        )}

        {/* Portal CTA — Hotmart/Kiwify model */}
        <div className="mt-6 pt-6 border-t" style={{ borderColor: "hsl(220 15% 16%)" }}>
          <div className="flex items-start gap-3 mb-3">
            <GraduationCap className="w-5 h-5 text-[hsl(145,65%,55%)] mt-0.5 shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold">{t.portalCtaTitle}</p>
              <p className="text-[hsl(220,10%,55%)] text-xs mt-1">{t.portalCtaDesc}</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/minha-conta")}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-[hsl(220,16%,18%)]"
            style={{ background: "hsl(220 18% 14%)", color: "white", border: "1px solid hsl(220 15% 18%)" }}
          >
            {t.portalCtaButton} <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => navigate("/")}
          className="w-full mt-4 text-xs text-[hsl(220,10%,50%)] hover:text-[hsl(220,10%,70%)] transition-colors"
        >
          {t.backToHome}
        </button>
      </motion.div>
    </div>
  );
};

interface Lesson { id: string; title: string; content_type: string; content: string | null; file_url: string | null; sort_order: number; }
interface Module { id: string; title: string; description: string | null; sort_order: number; lessons: Lesson[]; }
interface Course { id: string; title: string; description: string | null; cover_image_url: string | null; product_id?: string | null; }
interface MemberAccess { id: string; course_id: string; customer_id: string; }
interface Product { id: string; name: string; description: string | null; price: number; original_price: number | null; image_url: string | null; active: boolean; currency?: string; }
interface OtherCourse { id: string; title: string; description: string | null; cover_image_url: string | null; product_id: string | null; product?: Product | null; hasAccess: boolean; }

const MemberArea = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const langParam = searchParams.get("lang") as MemberLang | null;

  const tokenClient = useMemo(() => {
    if (!token) return supabase;
    return createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { global: { headers: { "x-access-token": token } }, auth: { persistSession: false, autoRefreshToken: false } }
    );
  }, [token]);

  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<MemberAccess | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [otherCourses, setOtherCourses] = useState<OtherCourse[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [lang, setLang] = useState<MemberLang>(langParam || "pt");

  const t = getMemberTranslations(lang);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    loadMemberData();
  }, [token]);

  const loadMemberData = async () => {
    try {
      const { data: accessData, error: accessError } = await tokenClient
        .from("member_access").select("id, course_id, customer_id, expires_at").eq("access_token", token!).maybeSingle();

      if (accessError || !accessData) { toast.error(t.invalidLink); setLoading(false); return; }
      if (accessData.expires_at && new Date(accessData.expires_at) < new Date()) { toast.error(t.accessExpired); setLoading(false); return; }

      setAccess(accessData);

      const { data: customerData } = await tokenClient.from("customers").select("name").eq("id", accessData.customer_id).single();
      if (customerData) setCustomerName(customerData.name.split(" ")[0]);

      const { data: courseData } = await tokenClient.from("courses").select("*, product_id").eq("id", accessData.course_id).single();
      if (courseData) {
        setCourse(courseData);
        // Detect language from product currency if no lang param
        if (!langParam && courseData.product_id) {
          const { data: prodData } = await tokenClient.from("products").select("currency").eq("id", courseData.product_id).maybeSingle();
          if (prodData?.currency) {
            setLang(langFromCurrency(prodData.currency));
          }
        }
      }

      const { data: modulesData } = await tokenClient.from("course_modules").select("*").eq("course_id", accessData.course_id).order("sort_order");

      if (modulesData) {
        const modulesWithLessons: Module[] = [];
        for (const mod of modulesData) {
          const { data: lessonsData } = await tokenClient.from("course_lessons").select("*").eq("module_id", mod.id).order("sort_order");
          modulesWithLessons.push({ ...mod, lessons: lessonsData || [] });
        }
        setModules(modulesWithLessons);
        if (modulesWithLessons.length > 0) {
          setActiveModuleId(modulesWithLessons[0].id);
          if (modulesWithLessons[0].lessons.length > 0) setActiveLesson(modulesWithLessons[0].lessons[0]);
        }
      }

      const { data: progressData } = await tokenClient.from("lesson_progress").select("lesson_id").eq("member_access_id", accessData.id).eq("completed", true);
      if (progressData) setCompletedLessons(new Set(progressData.map((p: any) => p.lesson_id)));

      const { data: allCourses } = await tokenClient.from("courses").select("id, title, description, cover_image_url, product_id, user_id").eq("user_id", courseData?.user_id || "");
      const { data: allAccesses } = await tokenClient.from("member_access").select("course_id").eq("customer_id", accessData.customer_id);
      const accessedCourseIds = new Set((allAccesses || []).map((a: any) => a.course_id));

      if (allCourses) {
        const coursesWithProducts: OtherCourse[] = [];
        for (const c of allCourses) {
          if (c.id === accessData.course_id) continue;
          let product: Product | null = null;
          if (c.product_id) {
            const { data: prodData } = await tokenClient.from("products").select("*").eq("id", c.product_id).eq("active", true).eq("user_id", courseData?.user_id || "").single();
            product = prodData;
          }
          coursesWithProducts.push({ ...c, product, hasAccess: accessedCourseIds.has(c.id) });
        }
        setOtherCourses(coursesWithProducts.filter((c) => c.product || c.hasAccess));
      }
    } catch (err) {
      console.error("Error loading member data:", err);
      toast.error(t.errorLoading);
    }
    setLoading(false);
  };

  const toggleLessonComplete = async (lessonId: string) => {
    if (!access) return;
    const isCompleted = completedLessons.has(lessonId);
    if (isCompleted) {
      await tokenClient.from("lesson_progress").update({ completed: false, completed_at: null }).eq("member_access_id", access.id).eq("lesson_id", lessonId);
      setCompletedLessons((prev) => { const next = new Set(prev); next.delete(lessonId); return next; });
    } else {
      await tokenClient.from("lesson_progress").upsert(
        { member_access_id: access.id, lesson_id: lessonId, completed: true, completed_at: new Date().toISOString() },
        { onConflict: "member_access_id,lesson_id" }
      );
      setCompletedLessons((prev) => new Set(prev).add(lessonId));
    }
  };

  const selectLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setShowMobileSidebar(false);
    const mod = modules.find((m) => m.lessons.some((l) => l.id === lesson.id));
    if (mod) setActiveModuleId(mod.id);
  };

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const progressPercent = totalLessons > 0 ? (completedLessons.size / totalLessons) * 100 : 0;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220 20% 6%)" }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(145,65%,42%)] to-[hsl(160,70%,36%)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
        <p className="text-[hsl(220,10%,55%)] text-sm">{t.loadingContent}</p>
      </motion.div>
    </div>
  );

  if (!token || !access || !course) return <RestrictedAccessRecovery navigate={navigate} t={t} lang={lang} />;

  // Navigation helpers
  const allLessons = modules.flatMap((m) => m.lessons);
  const currentIndex = activeLesson ? allLessons.findIndex((l) => l.id === activeLesson.id) : -1;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;

  return (
    <div className="min-h-screen pb-[env(safe-area-inset-bottom)]" style={{ background: "hsl(220 20% 6%)" }}>
      <MemberHeader
        courseTitle={course.title}
        completedCount={completedLessons.size}
        totalLessons={totalLessons}
        progressPercent={progressPercent}
        showCatalog={showCatalog}
        onToggleCatalog={() => setShowCatalog(!showCatalog)}
        onOpenMobileSidebar={() => setShowMobileSidebar(true)}
        token={token}
        t={t}
      />

      <MemberMobileSidebar open={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} token={token}>
        <MemberSidebarContent
          modules={modules}
          activeModuleId={activeModuleId}
          onToggleModule={setActiveModuleId}
          activeLesson={activeLesson}
          completedLessons={completedLessons}
          onSelectLesson={selectLesson}
          otherCoursesCount={otherCourses.length}
          onShowCatalog={() => { setShowCatalog(true); setShowMobileSidebar(false); }}
          t={t}
        />
      </MemberMobileSidebar>

      <MemberCatalogPanel
        courses={otherCourses}
        customerId={access.customer_id}
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        t={t}
        lang={lang}
      />

      {/* Welcome banner */}
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 pt-4 sm:pt-6 pb-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-white text-base sm:text-xl font-bold">
            {t.welcome(customerName)} 👋
          </h2>
          <p className="text-[hsl(220,10%,45%)] text-xs sm:text-sm mt-0.5">
            {t.continueWhere} • {t.lessonsCompleted(completedLessons.size, totalLessons)}
          </p>
        </motion.div>
      </div>

      {/* Main content */}
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-3 sm:py-4">
        <div className="grid lg:grid-cols-12 gap-4 sm:gap-5">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="lg:sticky lg:top-24">
              <MemberSidebarContent
                modules={modules}
                activeModuleId={activeModuleId}
                onToggleModule={setActiveModuleId}
                activeLesson={activeLesson}
                completedLessons={completedLessons}
                onSelectLesson={selectLesson}
                otherCoursesCount={otherCourses.length}
                onShowCatalog={() => setShowCatalog(true)}
                t={t}
              />
            </div>
          </aside>

          {/* Main content area */}
          <main className="lg:col-span-8 xl:col-span-9">
            {activeLesson ? (
              <>
                <MemberLessonViewer
                  lesson={activeLesson}
                  isCompleted={completedLessons.has(activeLesson.id)}
                  onToggleComplete={toggleLessonComplete}
                  accessId={access.id}
                  customerName={customerName || (lang === "en" ? "Student" : "Aluno")}
                  tokenClient={tokenClient}
                  accessToken={token || undefined}
                  t={t}
                />

                {/* Navigation */}
                <div className="flex items-center justify-between mt-4 gap-2">
                  {prevLesson ? (
                    <button onClick={() => selectLesson(prevLesson)} className="flex items-center gap-2 px-3 sm:px-4 py-3 rounded-xl text-xs sm:text-sm transition-all hover:bg-[hsl(220,16%,14%)]" style={{ color: "hsl(0,0%,60%)" }}>
                      {t.previous}
                    </button>
                  ) : <div />}
                  {nextLesson && (
                    <button onClick={() => selectLesson(nextLesson)} className="flex items-center gap-2 px-4 sm:px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all hover:scale-[1.02]" style={{ backgroundImage: "linear-gradient(135deg, hsl(145,65%,42%), hsl(160,70%,36%))", color: "white" }}>
                      {t.nextLesson}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl border p-8 sm:p-12 text-center"
                style={{ background: "hsl(220 18% 10%)", borderColor: "hsl(220 15% 14%)" }}
              >
                <div className="w-16 sm:w-20 h-16 sm:h-20 mx-auto mb-4 sm:mb-6 rounded-2xl flex items-center justify-center" style={{ background: "hsl(220,18%,14%)" }}>
                  <PlayCircle className="w-8 sm:w-10 h-8 sm:h-10 text-[hsl(145,65%,42%)]" />
                </div>
                <h3 className="text-white text-base sm:text-lg font-bold mb-2">{t.selectLesson}</h3>
                <p className="text-[hsl(220,10%,45%)] text-xs sm:text-sm">{t.selectLessonDesc}</p>
                <button onClick={() => setShowMobileSidebar(true)}
                  className="lg:hidden mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold"
                  style={{ backgroundImage: "linear-gradient(135deg, hsl(145,65%,42%), hsl(160,70%,36%))", color: "white" }}
                >
                  <List className="w-4 h-4" /> {t.viewLessons}
                </button>
              </motion.div>
            )}
          </main>
        </div>
      </div>
      <MemberInstallBanner />
      {token && access && course && (
        <Suspense fallback={null}>
          <NinaChatWidget
            accessToken={token}
            courseId={course.id}
            activeLessonId={activeLesson?.id}
            studentName={customerName || (lang === "en" ? "Student" : "Aluna")}
            lang={lang}
          />
        </Suspense>
      )}
    </div>
  );
};

export default MemberArea;
