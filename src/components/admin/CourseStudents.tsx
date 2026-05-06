import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthOrigin } from "@/lib/getAuthOrigin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Plus, Trash2, Search, Loader2, Send, Globe, Layout, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Student {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  created_at: string;
  total_lessons: number;
  completed_lessons: number;
  access_token: string;
}

interface CourseStudentsProps {
  courseId: string;
}

const PAGE_SIZE = 50;

const CourseStudents = ({ courseId }: CourseStudentsProps) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", cpf: "", phone: "", deliveryType: "panttera" as "panttera" | "appsell" });
  const [adding, setAdding] = useState(false);
  const [resending, setResending] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch member_access and course_modules in parallel
      let query = supabase
        .from("member_access")
        .select("id, customer_id, created_at, access_token, customers!inner(name, email)", { count: "exact" })
        .eq("course_id", courseId);

      if (search.trim()) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`, { foreignTable: 'customers' });
      }

      const [accessResult, modulesResult] = await Promise.all([
        query
          .order("created_at", { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
        supabase
          .from("course_modules")
          .select("id")
          .eq("course_id", courseId)
      ]);

      if (accessResult.error) throw accessResult.error;
      const accessData = accessResult.data || [];
      setTotalCount(accessResult.count || 0);

      if (accessData.length === 0) {
        setStudents([]);
        return;
      }

      // 2. Fetch lessons and progress in parallel
      const moduleIds = (modulesResult.data || []).map((m) => m.id);
      const accessIds = accessData.map((a) => a.id);

      const [lessonsResult, progressResult] = await Promise.all([
        moduleIds.length > 0 
          ? supabase
            .from("course_lessons")
            .select("id", { count: "exact", head: true })
            .in("module_id", moduleIds)
          : Promise.resolve({ count: 0 }),
        supabase
          .from("lesson_progress")
          .select("member_access_id")
          .in("member_access_id", accessIds)
          .eq("completed", true)
      ]);

      const totalLessons = lessonsResult.count || 0;
      const completedMap: Record<string, number> = {};
      (progressResult.data || []).forEach((p) => {
        completedMap[p.member_access_id] = (completedMap[p.member_access_id] || 0) + 1;
      });

      const studentList: Student[] = accessData.map((a: any) => ({
        id: a.id,
        customer_id: a.customer_id,
        customer_name: a.customers?.name || "—",
        customer_email: a.customers?.email || "—",
        created_at: a.created_at,
        total_lessons: totalLessons,
        completed_lessons: completedMap[a.id] || 0,
        access_token: a.access_token,
      }));

      setStudents(studentList);
    } catch (err: any) {
      console.error("[CourseStudents] loadStudents error:", err);
      toast.error("Erro ao carregar alunos");
    } finally {
      setLoading(false);
    }
  }, [courseId, page, search]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadStudents();
    }, 300);
    return () => clearTimeout(t);
  }, [loadStudents]);

  // Reset to page 0 when search changes
  useEffect(() => {
    setPage(0);
  }, [search]);

  const addStudent = async () => {
    if (!addForm.name || !addForm.email) {
      toast.error("Nome e email são obrigatórios");
      return;
    }

    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let customerId: string;
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("email", addForm.email)
        .maybeSingle();

      if (existing) {
        customerId = existing.id;
      } else {
        const { data: newCustomer, error: custErr } = await supabase
          .from("customers")
          .insert({
            name: addForm.name,
            email: addForm.email,
            cpf: addForm.cpf || null,
            phone: addForm.phone || null,
          })
          .select("id")
          .single();

        if (custErr) throw custErr;
        customerId = newCustomer.id;
      }

      if (addForm.deliveryType === "panttera") {
        const { data: existingAccess } = await supabase
          .from("member_access")
          .select("id")
          .eq("customer_id", customerId)
          .eq("course_id", courseId)
          .maybeSingle();

        if (existingAccess) {
          toast.error("Este aluno já tem acesso a este curso");
          setAdding(false);
          return;
        }

        const { data: newAccess, error: accessErr } = await supabase
          .from("member_access")
          .insert({
            customer_id: customerId,
            course_id: courseId,
          })
          .select("access_token")
          .single();

        if (accessErr) throw accessErr;

        const accessUrl = `${getAuthOrigin()}/membros?token=${newAccess.access_token}`;
        
        try {
          const { data: emailResult, error: emailErr } = await supabase.functions.invoke("send-access-link", {
            body: {
              customer_id: customerId,
              course_id: courseId,
              access_token: newAccess.access_token,
            },
          });
          if (emailErr) {
            toast.success("Aluno adicionado! Link copiado.", { description: accessUrl });
          } else {
            toast.success(`Email enviado para ${addForm.email}!`);
          }
        } catch {
          toast.success("Aluno adicionado! Link copiado.", { description: accessUrl });
        }
        navigator.clipboard.writeText(accessUrl).catch(() => {});
      } else {
        const { data: courseData } = await supabase
          .from("courses")
          .select("product_id")
          .eq("id", courseId)
          .single();

        const { data: order, error: orderErr } = await supabase
          .from("orders")
          .insert({
            customer_id: customerId,
            product_id: courseData?.product_id || null,
            user_id: user?.id,
            amount: 0,
            status: "paid",
            payment_method: "manual_entry",
            metadata: { 
              manual_entry: true,
              customer_name: addForm.name,
              customer_email: addForm.email
            }
          })
          .select("id")
          .single();

        if (orderErr) throw orderErr;

        const { data: notifyData, error: notifyErr } = await supabase.functions.invoke("appsell-notify", {
          body: {
            event: "order.paid",
            order_id: order.id,
            user_id: user?.id
          }
        });

        if (notifyErr) throw notifyErr;

        if (notifyData?.skipped) {
          toast.error(
            "Integração AppSell não encontrada ou inativa. " +
            "Verifique em Configurações → AppSell."
          );
          return;
        }

        if (!notifyData?.success) {
          toast.error(
            `AppSell retornou erro: ${notifyData?.appsell_response || "resposta desconhecida"}`
          );
          return;
        }

        toast.success(`Aluno enviado para o AppSell com sucesso!`);
      }

      setAddDialogOpen(false);
      setAddForm({ name: "", email: "", cpf: "", phone: "", deliveryType: "panttera" });
      loadStudents();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao adicionar aluno: " + err.message);
    } finally {
      setAdding(false);
    }
  };

  const removeStudent = async (accessId: string, name: string) => {
    if (!confirm(`Remover o acesso de ${name} a este curso?`)) return;

    const { error } = await supabase
      .from("member_access")
      .delete()
      .eq("id", accessId);

    if (error) {
      toast.error("Erro ao remover aluno");
      return;
    }

    toast.success("Acesso removido");
    loadStudents();
  };

  const resendAccess = async (student: Student) => {
    setResending(student.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-access-link", {
        body: {
          customer_id: student.customer_id,
          course_id: courseId,
          access_token: student.access_token,
        },
      });
      if (error) throw error;
      const accessUrl = `${getAuthOrigin()}/membros?token=${student.access_token}`;
      if (data?.email_sent === false) {
        navigator.clipboard.writeText(accessUrl).catch(() => {});
        toast.success("Link copiado! (Verifique domínio no Resend para enviar emails)", {
          duration: 8000,
          description: accessUrl,
        });
      } else {
        toast.success(`Email reenviado para ${student.customer_email}!`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao reenviar email de acesso");
    } finally {
      setResending(null);
    }
  };

  const avgProgress = students.length > 0
    ? students.reduce((sum, s) => {
        const pct = s.total_lessons > 0 
          ? (s.completed_lessons / s.total_lessons) * 100 
          : 0;
        return sum + pct;
      }, 0) / students.length
    : 0;

  const completionRate = students.length > 0
    ? (students.filter((s) => s.total_lessons > 0 && s.completed_lessons >= s.total_lessons).length / students.length) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-bold text-foreground">Alunos</h2>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Adicionar aluno
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Número de alunos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{avgProgress.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">média dos usuários</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{completionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">concluíram o curso</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {totalCount === 0
                ? "Nenhum aluno neste curso. Adicione o primeiro!"
                : "Nenhum aluno encontrado."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
              <span>Nome</span>
              <span className="w-32 text-center">Progresso</span>
              <span className="w-8" />
              <span className="w-8" />
            </div>
            {students.map((s) => {
              const pct = s.total_lessons > 0 ? (s.completed_lessons / s.total_lessons) * 100 : 0;
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 border-t"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.customer_email}</p>
                  </div>
                  <div className="w-32 flex items-center gap-2">
                    <Progress value={pct} className="flex-1 h-2" />
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary hover:text-primary"
                    title="Reenviar email de acesso"
                    disabled={resending === s.id}
                    onClick={() => resendAccess(s)}
                  >
                    {resending === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeStudent(s.id, s.customer_name)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-2 text-sm text-muted-foreground">
            <span>
              Exibindo {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount} alunos
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
              >
                Próxima <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Adicionar Aluno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Destino do Acesso</Label>
              <RadioGroup 
                value={addForm.deliveryType} 
                onValueChange={(v: "panttera" | "appsell") => setAddForm({ ...addForm, deliveryType: v })}
                className="grid grid-cols-2 gap-3"
              >
                <div>
                  <RadioGroupItem value="panttera" id="panttera" className="peer sr-only" />
                  <Label
                    htmlFor="panttera"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Layout className="mb-2 h-5 w-5" />
                    <span className="text-xs font-bold">Panttera</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="appsell" id="appsell" className="peer sr-only" />
                  <Label
                    htmlFor="appsell"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Globe className="mb-2 h-5 w-5" />
                    <span className="text-xs font-bold">AppSell</span>
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-[10px] text-muted-foreground px-1">
                {addForm.deliveryType === "panttera" 
                  ? "O aluno receberá um e-mail com o link da área de membros interna." 
                  : "O aluno será enviado para a AppSell para entrega externa."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <Button onClick={addStudent} disabled={adding} className="w-full">
              {adding && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Adicionar Aluno
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseStudents;