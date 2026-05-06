import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ClipboardList,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Circle,
  
  Copy,
} from "lucide-react";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  category: string | null;
  due_date: string | null;
  created_at: string;
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  critical: { label: "Crítica", color: "bg-destructive text-destructive-foreground" },
  high: { label: "Alta", color: "bg-orange-500 text-white" },
  medium: { label: "Média", color: "bg-primary text-primary-foreground" },
  low: { label: "Baixa", color: "bg-muted text-muted-foreground" },
};

const statusConfig: Record<string, { label: string; icon: any }> = {
  todo: { label: "A fazer", icon: Circle },
  in_progress: { label: "Em andamento", icon: Clock },
  done: { label: "Concluído", icon: CheckCircle2 },
};

const categoryOptions = [
  "Infraestrutura",
  "Feature",
  "Marketing",
  "Financeiro",
  "Integração",
  "UX/Design",
  "Segurança",
  "Geral",
];

const Roadmap = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("Geral");
  const [dueDate, setDueDate] = useState("");

  const loadTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("internal_tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setTasks((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    const { error } = await supabase.from("internal_tasks").insert({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      category,
      due_date: dueDate || null,
      user_id: user?.id,
    } as any);
    if (error) {
      toast.error("Erro ao criar tarefa");
      console.error(error);
    } else {
      toast.success("Tarefa criada!");
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCategory("Geral");
      setDueDate("");
      setDialogOpen(false);
      loadTasks();
    }
  };

  const toggleStatus = async (task: Task) => {
    const nextStatus =
      task.status === "todo"
        ? "in_progress"
        : task.status === "in_progress"
        ? "done"
        : "todo";
    const { error } = await supabase
      .from("internal_tasks")
      .update({ status: nextStatus, updated_at: new Date().toISOString() } as any)
      .eq("id", task.id);
    if (!error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
      );
    }
  };

  const deleteTask = async (id: string) => {
    setDeletingId(id);
    await supabase.from("internal_tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    toast.success("Tarefa removida");
    setDeletingId(null);
  };

  const filtered = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterCategory !== "all" && (t.category || "Geral") !== filterCategory) return false;
    return true;
  });

  // Group filtered tasks by category for the category view
  const groupedByCategory = filtered.reduce<Record<string, Task[]>>((acc, t) => {
    const cat = t.category || "Geral";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const criticalCount = tasks.filter(
    (t) => t.priority === "critical" && t.status !== "done"
  ).length;

  const renderTaskRow = (task: Task) => {
    const StatusIcon = statusConfig[task.status]?.icon || Circle;
    const pConfig = priorityConfig[task.priority] || priorityConfig.medium;
    return (
      <TableRow key={task.id} className={task.status === "done" ? "opacity-50" : ""}>
        <TableCell>
          <Checkbox checked={task.status === "done"} onCheckedChange={() => toggleStatus(task)} />
        </TableCell>
        <TableCell>
          <div className="cursor-pointer" onClick={() => setSelectedTask(task)}>
            <p className={`text-sm font-medium ${task.status === "done" ? "line-through" : ""}`}>{task.title}</p>
            {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
            {task.due_date && <p className="text-[10px] text-muted-foreground mt-0.5">📅 {new Date(task.due_date).toLocaleDateString("pt-BR")}</p>}
          </div>
        </TableCell>
        <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="text-xs">{task.category || "Geral"}</Badge></TableCell>
        <TableCell className="text-center"><Badge className={`text-[10px] ${pConfig.color}`}>{pConfig.label}</Badge></TableCell>
        <TableCell className="text-center hidden sm:table-cell">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <StatusIcon className="w-3.5 h-3.5" />{statusConfig[task.status]?.label || task.status}
          </div>
        </TableCell>
        <TableCell>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task.id)} disabled={deletingId === task.id}>
            {deletingId === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Roadmap Interno
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tarefas e próximos passos — uso interno CEO
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">A Fazer</p>
            <p className="text-2xl font-bold font-display text-foreground mt-1">{todoCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Em Andamento</p>
            <p className="text-2xl font-bold font-display text-primary mt-1">{inProgressCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Concluídos</p>
            <p className="text-2xl font-bold font-display text-primary mt-1">{doneCount}</p>
          </CardContent>
        </Card>
        {criticalCount > 0 && (
          <Card className="border-destructive/30">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-destructive uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Críticas
              </p>
              <p className="text-2xl font-bold font-display text-destructive mt-1">{criticalCount}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {categoryOptions.map((cat) => {
          const catTasks = tasks.filter((t) => (t.category || "Geral") === cat);
          const pending = catTasks.filter((t) => t.status !== "done").length;
          const done = catTasks.filter((t) => t.status === "done").length;
          if (catTasks.length === 0) return null;
          return (
            <Card
              key={cat}
              className={`cursor-pointer transition-all hover:border-primary/50 ${filterCategory === cat ? "border-primary ring-1 ring-primary/30" : "border-border/50"}`}
              onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
            >
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{cat}</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-lg font-bold text-foreground">{pending}</span>
                  <span className="text-[10px] text-muted-foreground">pendentes</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{done} ✓ feitos</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters + Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-display">Tarefas</CardTitle>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="todo">A fazer</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas prioridades</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma tarefa encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                  <TableHead className="text-center">Prioridade</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterCategory === "all" ? (
                  // Grouped by category view
                  Object.entries(groupedByCategory)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([cat, catTasks]) => {
                      const sortedTasks = catTasks.sort((a, b) => {
                        const pOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                        return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
                      });
                      return [
                        <TableRow key={`header-${cat}`} className="bg-muted/30 hover:bg-muted/40">
                          <TableCell colSpan={6} className="py-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                              {cat} ({catTasks.filter(t => t.status !== "done").length} pendentes / {catTasks.length} total)
                            </span>
                          </TableCell>
                        </TableRow>,
                        ...sortedTasks.map((task) => renderTaskRow(task)),
                      ];
                    })
                ) : (
                  // Flat view when specific category selected
                  filtered
                    .sort((a, b) => {
                      const pOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                      return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
                    })
                    .map((task) => renderTaskRow(task))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Título</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Integrar Evolution API v2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Descrição</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes, contexto, links..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Prioridade</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">🔴 Crítica</SelectItem>
                    <SelectItem value="high">🟠 Alta</SelectItem>
                    <SelectItem value="medium">🟢 Média</SelectItem>
                    <SelectItem value="low">⚪ Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Categoria</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Prazo (opcional)</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar Tarefa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask && statusConfig[selectedTask.status] && (() => {
                const Icon = statusConfig[selectedTask.status].icon;
                return <Icon className="w-5 h-5" />;
              })()}
              {selectedTask?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-2">
              {selectedTask.description && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição</label>
                  <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{selectedTask.description}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prioridade</label>
                  <div className="mt-1">
                    <Badge className={`text-xs ${(priorityConfig[selectedTask.priority] || priorityConfig.medium).color}`}>
                      {(priorityConfig[selectedTask.priority] || priorityConfig.medium).label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                  <p className="text-sm mt-1">{statusConfig[selectedTask.status]?.label || selectedTask.status}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoria</label>
                  <p className="text-sm mt-1">{selectedTask.category || "Geral"}</p>
                </div>
              </div>
              {selectedTask.due_date && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prazo</label>
                  <p className="text-sm mt-1">📅 {new Date(selectedTask.due_date).toLocaleDateString("pt-BR")}</p>
                </div>
              )}
              <div className="pt-2 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const text = `${selectedTask.title}${selectedTask.description ? '\n' + selectedTask.description : ''}`;
                    navigator.clipboard.writeText(text);
                    toast.success("Copiado!");
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar tarefa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Roadmap;
