import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, GraduationCap, BookOpen, FileText, Users, ChevronUp, ChevronDown } from "lucide-react";
import LessonMaterialsManager from "@/components/admin/LessonMaterialsManager";
import { toast } from "sonner";
import CourseStudents from "@/components/admin/CourseStudents";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
}

interface Lesson {
  id: string;
  title: string;
  content: string | null;
  content_type: string;
  file_url: string | null;
  sort_order: number;
  module_id: string;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  course_id: string;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  product_id: string | null;
  cover_image_url: string | null;
}

const Courses = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  // Forms
  const [courseForm, setCourseForm] = useState({ title: "", description: "", product_id: "" });
  const [moduleForm, setModuleForm] = useState({ title: "", description: "" });
  const [lessonForm, setLessonForm] = useState({ title: "", content: "", content_type: "text", file_url: "" });
  const [parentModuleId, setParentModuleId] = useState<string>("");

  useEffect(() => {
    loadCourses();
    loadProducts();
  }, []);

  const loadProducts = async () => {
    if (!user) return;
    const { data } = await supabase.from("products").select("id, name, image_url").eq("user_id", user.id).order("name");
    setProducts(data || []);
  };

  const loadCourses = async () => {
    if (!user) return;
    const { data } = await supabase.from("courses").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setCourses(data || []);
    setLoading(false);
  };

  const loadModules = async (courseId: string) => {
    const { data: modulesData } = await supabase
      .from("course_modules")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order");

    if (!modulesData) { setModules([]); return; }

    const moduleIds = modulesData.map((m) => m.id);
    const { data: lessonsData } = await supabase
      .from("course_lessons")
      .select("*")
      .in("module_id", moduleIds)
      .order("sort_order");

    const modulesWithLessons: Module[] = modulesData.map((m) => ({
      ...m,
      lessons: (lessonsData || []).filter((l) => l.module_id === m.id),
    }));

    setModules(modulesWithLessons);
  };

  const selectCourse = (course: Course) => {
    setSelectedCourse(course);
    loadModules(course.id);
  };

  // COURSE CRUD
  const openNewCourse = () => {
    setEditingCourse(null);
    setCourseForm({ title: "", description: "", product_id: "" });
    setCourseDialogOpen(true);
  };

  const openEditCourse = (c: Course) => {
    setEditingCourse(c);
    setCourseForm({ title: c.title, description: c.description || "", product_id: c.product_id || "" });
    setCourseDialogOpen(true);
  };

  const saveCourse = async () => {
    if (!courseForm.title) { toast.error("Título obrigatório"); return; }
    const payload = {
      title: courseForm.title,
      description: courseForm.description || null,
      product_id: courseForm.product_id || null,
      updated_at: new Date().toISOString(),
    };

    if (editingCourse) {
      const { error } = await supabase.from("courses").update(payload).eq("id", editingCourse.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Curso atualizado!");
    } else {
      const { error } = await supabase.from("courses").insert({ ...payload, user_id: user?.id });
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Curso criado!");
    }
    setCourseDialogOpen(false);
    loadCourses();
    if (selectedCourse && editingCourse?.id === selectedCourse.id) {
      setSelectedCourse({ ...selectedCourse, ...payload });
    }
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("Excluir este curso e todo seu conteúdo?")) return;
    await supabase.from("courses").delete().eq("id", id);
    toast.success("Curso excluído");
    if (selectedCourse?.id === id) { setSelectedCourse(null); setModules([]); }
    loadCourses();
  };

  // MODULE CRUD
  const openNewModule = () => {
    setEditingModule(null);
    setModuleForm({ title: "", description: "" });
    setModuleDialogOpen(true);
  };

  const openEditModule = (m: Module) => {
    setEditingModule(m);
    setModuleForm({ title: m.title, description: m.description || "" });
    setModuleDialogOpen(true);
  };

  const saveModule = async () => {
    if (!courseForm.title && !moduleForm.title) { toast.error("Título obrigatório"); return; }
    if (!selectedCourse) return;

    if (editingModule) {
      const { error } = await supabase.from("course_modules").update({
        title: moduleForm.title,
        description: moduleForm.description || null,
      }).eq("id", editingModule.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Módulo atualizado!");
    } else {
      const maxOrder = modules.length > 0 ? Math.max(...modules.map((m) => m.sort_order)) + 1 : 0;
      const { error } = await supabase.from("course_modules").insert({
        title: moduleForm.title,
        description: moduleForm.description || null,
        course_id: selectedCourse.id,
        sort_order: maxOrder,
      });
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Módulo criado!");
    }
    setModuleDialogOpen(false);
    loadModules(selectedCourse.id);
  };

  const deleteModule = async (id: string) => {
    if (!confirm("Excluir este módulo e suas aulas?")) return;
    await supabase.from("course_modules").delete().eq("id", id);
    toast.success("Módulo excluído");
    if (selectedCourse) loadModules(selectedCourse.id);
  };

  // LESSON CRUD
  const openNewLesson = (moduleId: string) => {
    setEditingLesson(null);
    setParentModuleId(moduleId);
    setLessonForm({ title: "", content: "", content_type: "text", file_url: "" });
    setLessonDialogOpen(true);
  };

  const openEditLesson = (l: Lesson) => {
    setEditingLesson(l);
    setParentModuleId(l.module_id);
    setLessonForm({
      title: l.title,
      content: l.content || "",
      content_type: l.content_type,
      file_url: l.file_url || "",
    });
    setLessonDialogOpen(true);
  };

  const youtubeToEmbed = (url: string): string => {
    try {
      const u = new URL(url);
      let videoId = "";
      if (u.hostname.includes("youtu.be")) {
        videoId = u.pathname.slice(1);
      } else if (u.searchParams.get("v")) {
        videoId = u.searchParams.get("v")!;
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    } catch { return url; }
  };

  const saveLesson = async () => {
    if (!lessonForm.title) { toast.error("Título obrigatório"); return; }
    if (!selectedCourse) return;

    const contentValue = lessonForm.content_type === "video_embed"
      ? youtubeToEmbed(lessonForm.content || "")
      : (lessonForm.content || null);

    if (editingLesson) {
      const { error } = await supabase.from("course_lessons").update({
        title: lessonForm.title,
        content: contentValue,
        content_type: lessonForm.content_type,
        file_url: lessonForm.file_url || null,
      }).eq("id", editingLesson.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Aula atualizada!");
    } else {
      const mod = modules.find((m) => m.id === parentModuleId);
      const maxOrder = mod && mod.lessons.length > 0 ? Math.max(...mod.lessons.map((l) => l.sort_order)) + 1 : 0;
      const { error } = await supabase.from("course_lessons").insert({
        title: lessonForm.title,
        content: contentValue,
        content_type: lessonForm.content_type,
        file_url: lessonForm.file_url || null,
        module_id: parentModuleId,
        sort_order: maxOrder,
      });
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Aula criada!");
    }
    setLessonDialogOpen(false);
    loadModules(selectedCourse.id);
  };

  const deleteLesson = async (id: string) => {
    if (!confirm("Excluir esta aula?")) return;
    await supabase.from("course_lessons").delete().eq("id", id);
    toast.success("Aula excluída");
    if (selectedCourse) loadModules(selectedCourse.id);
  };

  const moveModule = async (index: number, direction: "up" | "down") => {
    if (!selectedCourse) return;
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= modules.length) return;
    const a = modules[index];
    const b = modules[swapIdx];
    await Promise.all([
      supabase.from("course_modules").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("course_modules").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    loadModules(selectedCourse.id);
  };

  const moveLesson = async (mod: Module, lessonIndex: number, direction: "up" | "down") => {
    if (!selectedCourse) return;
    const swapIdx = direction === "up" ? lessonIndex - 1 : lessonIndex + 1;
    if (swapIdx < 0 || swapIdx >= mod.lessons.length) return;
    const a = mod.lessons[lessonIndex];
    const b = mod.lessons[swapIdx];
    await Promise.all([
      supabase.from("course_lessons").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("course_lessons").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    loadModules(selectedCourse.id);
  };

  // --- LIST VIEW (no course selected) ---
  if (!selectedCourse) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">Cursos</h1>
          <Button onClick={openNewCourse} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Curso
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : courses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum curso cadastrado. Crie seu primeiro curso!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const linkedProduct = products.find((p) => p.id === c.product_id);
              const coverImage = c.cover_image_url || linkedProduct?.image_url;
              return (
                <Card
                  key={c.id}
                  className="group cursor-pointer overflow-hidden border-border/60 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                  onClick={() => selectCourse(c)}
                >
                  {/* Image area - padronizada */}
                  <div className="relative h-40 overflow-hidden bg-muted">
                    {coverImage ? (
                      <img
                        src={coverImage}
                        alt={c.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-secondary">
                        <GraduationCap className="w-12 h-12 text-muted-foreground/40" />
                      </div>
                    )}
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-1.5">
                      <h3 className="font-display font-bold text-foreground text-sm leading-tight line-clamp-1">{c.title}</h3>
                      {c.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{c.description}</p>
                      )}
                    </div>
                    {linkedProduct && (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                        <BookOpen className="w-3 h-3" />
                        {linkedProduct.name}
                      </span>
                    )}
                    <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm" onClick={() => openEditCourse(c)} className="gap-1.5 text-xs h-8 flex-1">
                        <Pencil className="w-3 h-3" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteCourse(c.id)} className="gap-1.5 text-xs h-8 flex-1 text-destructive hover:text-destructive hover:border-destructive/50">
                        <Trash2 className="w-3 h-3" /> Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Course Dialog */}
        <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editingCourse ? "Editar Curso" : "Novo Curso"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Vincular a Produto</Label>
                <Select value={courseForm.product_id} onValueChange={(v) => setCourseForm({ ...courseForm, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum produto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Ao vincular a um produto, o acesso ao curso será liberado após a compra.</p>
              </div>
              <Button onClick={saveCourse} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // --- DETAIL VIEW (course selected) ---
  const linkedProduct = products.find((p) => p.id === selectedCourse.product_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedCourse(null); setModules([]); }}>
          ← Voltar
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-foreground">{selectedCourse.title}</h1>
          {linkedProduct && (
            <span className="text-xs text-muted-foreground">Produto: {linkedProduct.name}</span>
          )}
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content" className="gap-2">
            <BookOpen className="w-4 h-4" /> Conteúdo
          </TabsTrigger>
          <TabsTrigger value="students" className="gap-2">
            <Users className="w-4 h-4" /> Alunos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewModule} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Módulo
            </Button>
          </div>

      {modules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum módulo. Crie o primeiro módulo deste curso!</p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {modules.map((mod, modIdx) => (
            <AccordionItem key={mod.id} value={mod.id} className="border rounded-xl px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 flex-1 text-left">
                  <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-5 w-5" disabled={modIdx === 0} onClick={() => moveModule(modIdx, "up")}>
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" disabled={modIdx === modules.length - 1} onClick={() => moveModule(modIdx, "down")}>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full w-7 h-7 flex items-center justify-center">
                    {modIdx + 1}
                  </span>
                  <div>
                    <p className="font-display font-semibold text-foreground text-sm">{mod.title}</p>
                    <p className="text-xs text-muted-foreground">{mod.lessons.length} aula{mod.lessons.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="flex gap-2 mb-4">
                  <Button variant="outline" size="sm" onClick={() => openEditModule(mod)} className="gap-1">
                    <Pencil className="w-3 h-3" /> Editar Módulo
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteModule(mod.id)} className="gap-1 text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" /> Excluir
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openNewLesson(mod.id)} className="gap-1 ml-auto">
                    <Plus className="w-3 h-3" /> Nova Aula
                  </Button>
                </div>

                {mod.lessons.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma aula neste módulo.</p>
                ) : (
                  <div className="space-y-2">
                    {mod.lessons.map((lesson, lesIdx) => (
                      <div key={lesson.id} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5">
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={lesIdx === 0} onClick={() => moveLesson(mod, lesIdx, "up")}>
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={lesIdx === mod.lessons.length - 1} onClick={() => moveLesson(mod, lesIdx, "down")}>
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </div>
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{lesson.content_type === "text" ? "Texto" : lesson.content_type === "video" ? "Vídeo" : lesson.content_type === "video_embed" ? "YouTube" : lesson.content_type === "pdf" ? "PDF" : lesson.content_type === "html" ? "HTML" : lesson.content_type}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLesson(lesson)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteLesson(lesson.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
        </TabsContent>

        <TabsContent value="students" className="mt-6">
          <CourseStudents courseId={selectedCourse.id} />
        </TabsContent>
      </Tabs>

      {/* Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editingModule ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título do Módulo</Label>
              <Input value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Textarea value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} rows={2} />
            </div>
            <Button onClick={saveModule} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editingLesson ? "Editar Aula" : "Nova Aula"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título da Aula</Label>
              <Input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Conteúdo</Label>
              <Select value={lessonForm.content_type} onValueChange={(v) => setLessonForm({ ...lessonForm, content_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="video">Vídeo (URL)</SelectItem>
                  <SelectItem value="video_embed">Vídeo YouTube</SelectItem>
                  <SelectItem value="pdf">PDF (URL)</SelectItem>
                  <SelectItem value="html">HTML Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {lessonForm.content_type === "text" ? (
              <div className="space-y-1.5">
                <Label>Conteúdo</Label>
                <Textarea value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} rows={6} />
              </div>
            ) : lessonForm.content_type === "video_embed" ? (
              <div className="space-y-1.5">
                <Label>URL do YouTube</Label>
                <Input value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
                <p className="text-xs text-muted-foreground">Cole a URL do vídeo do YouTube. A conversão para embed é automática.</p>
              </div>
            ) : lessonForm.content_type === "html" ? (
              <div className="space-y-1.5">
                <Label>Código HTML</Label>
                <Textarea
                  value={lessonForm.content}
                  onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                  rows={10}
                  placeholder={'<iframe src="https://..." width="100%" height="700px" frameborder="0"></iframe>'}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">Cole HTML, iframes do Google AI Studio, Notion, Canva ou qualquer embed. O código será renderizado diretamente na área de membros.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>{lessonForm.content_type === "video" ? "URL do Vídeo" : "URL do PDF"}</Label>
                <Input value={lessonForm.file_url} onChange={(e) => setLessonForm({ ...lessonForm, file_url: e.target.value })} placeholder="https://..." />
              </div>
            )}
            <Button onClick={saveLesson} className="w-full">Salvar</Button>

            {/* Materials manager - only show when editing existing lesson */}
            {editingLesson && (
              <LessonMaterialsManager lessonId={editingLesson.id} />
            )}
           </div>
         </DialogContent>
       </Dialog>

      {/* Course Dialog (for edit from detail) */}
      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editingCourse ? "Editar Curso" : "Novo Curso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Vincular a Produto</Label>
              <Select value={courseForm.product_id} onValueChange={(v) => setCourseForm({ ...courseForm, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveCourse} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Courses;
