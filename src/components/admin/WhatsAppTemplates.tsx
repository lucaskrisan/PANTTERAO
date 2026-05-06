// @ts-nocheck
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  MessageSquare,
  QrCode,
  Send,
  ShoppingCart,
  Sparkles,
  UserPlus,
  Workflow,
  Zap,
  Copy,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const FlowCanvas = lazy(() => import("./whatsapp-flow/FlowCanvas"));

interface Template {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
  active: boolean;
  flow_nodes: any[];
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "boas_vindas", label: "Boas-vindas", icon: UserPlus },
  { value: "abandono", label: "Abandono", icon: ShoppingCart },
  { value: "confirmacao", label: "Confirmação", icon: CreditCard },
  { value: "lembrete_pix", label: "Lembrete PIX", icon: QrCode },
  { value: "acesso", label: "Acesso", icon: Send },
  { value: "geral", label: "Geral", icon: MessageSquare },
];

const createEmptyTemplate = (): Template => ({
  id: `__new__-${Date.now()}`,
  name: "",
  category: "geral",
  body: "Olá {nome}, obrigado por adquirir o {produto}!",
  variables: [],
  active: true,
  flow_nodes: [],
  created_at: "",
  updated_at: "",
});

const extractVariables = (text: string) => {
  const matches = text.match(/\{[a-z_]+\}/g);
  return matches ? [...new Set(matches)] : [];
};

const TemplateFlowPreview = () => (
  <div className="mt-5 rounded-[22px] border border-border/60 bg-background/60 p-4">
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
        <Zap className="h-4 w-4" />
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-gold/70 to-gold/10" />
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
        <MessageSquare className="h-4 w-4" />
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-gold/70 to-gold/10" />
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
        <Workflow className="h-4 w-4" />
      </div>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-3 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
      <span>Disparo</span>
      <span>Mensagem</span>
      <span>Fluxo</span>
    </div>
  </div>
);

const TemplateCard = ({
  onDelete,
  onOpen,
  template,
}: {
  onDelete: (template: Template) => void;
  onOpen: (template: Template) => void;
  onDuplicate: (template: Template) => void;
  template: Template;
}) => {
  const category = CATEGORIES.find((item) => item.value === template.category) || CATEGORIES[CATEGORIES.length - 1];
  const Icon = category.icon;

  return (
    <motion.button
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col overflow-hidden rounded-[32px] border border-border/60 bg-card/95 p-6 text-left shadow-sm transition-all hover:-translate-y-1.5 hover:border-gold/40 hover:shadow-[0_32px_80px_hsl(var(--gold)/0.12)]"
      initial={{ opacity: 0, y: 16 }}
      onClick={() => onOpen(template)}
      type="button"
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-gold/30 via-gold to-gold/30 opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold shadow-lg transition-transform group-hover:scale-110">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold text-foreground">{template.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{category.label}</p>
          </div>
        </div>

        <Badge variant={template.active ? "default" : "secondary"}>{template.active ? "Ativo" : "Inativo"}</Badge>
      </div>

      <div className="mt-6 rounded-2xl border border-border/40 bg-background/40 p-5 backdrop-blur-sm">
        <p className="line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80">{template.body}</p>
      </div>

      <div className="mt-4 flex items-center gap-2 overflow-hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
          <Zap className="h-3.5 w-3.5" />
        </div>
        <div className="h-px w-10 bg-gradient-to-r from-gold/80 to-gold/15" />
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
          <MessageSquare className="h-3.5 w-3.5" />
        </div>
        <div className="h-px w-10 bg-gradient-to-r from-gold/80 to-gold/15" />
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1">{template.variables.length} variáveis</span>
          <button
            className="rounded-full border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(template);
            }}
            title="Duplicar"
            type="button"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            className="rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(template);
            }}
            type="button"
          >
            Excluir
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {template.variables.slice(0, 3).map((variable) => (
            <span key={variable} className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-[11px] font-mono text-gold">
              {variable}
            </span>
          ))}
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-medium text-gold transition-transform group-hover:translate-x-0.5">
          Abrir builder
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </motion.button>
  );
};

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="overflow-hidden rounded-[32px] border border-border/60 bg-card/95">
    <div className="grid gap-0 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="p-8 sm:p-10">
        <Badge className="border-gold/25 bg-gold/10 text-gold" variant="outline">
          <Sparkles className="mr-1.5 h-3 w-3" />
          Experiência premium
        </Badge>
        <h3 className="mt-5 max-w-xl font-display text-3xl font-semibold leading-tight text-foreground">
          Crie templates como fluxos visuais: cards claros, nós conectados e configuração prazerosa.
        </h3>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          Nada de modal simples e cara de iniciante — aqui o template já nasce dentro do builder visual, com autoridade e clareza.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button className="gap-2 border border-gold/20 bg-gold text-background hover:bg-gold/90" onClick={onCreate}>
            <Workflow className="h-4 w-4" />
            Criar no builder visual
          </Button>
          <Button className="gap-2" onClick={onCreate} variant="outline">
            <CheckCircle2 className="h-4 w-4" />
            Abrir canvas agora
          </Button>
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/50 p-8 xl:border-l xl:border-t-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold/80">Preview do fluxo</p>
        <TemplateFlowPreview />
        <div className="mt-5 space-y-3">
          {[
            "Cards organizados por categoria",
            "Nós conectados visualmente",
            "Configuração lateral instantânea",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <p className="text-sm text-foreground">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const WhatsAppTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [builderTemplate, setBuilderTemplate] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar templates");
    } else {
      setTemplates((data || []).map((item: any) => ({
        ...item,
        variables: item.variables || [],
        flow_nodes: item.flow_nodes || [],
      })));
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const groupedTemplates = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        ...category,
        items: templates.filter((template) => template.category === category.value),
      })).filter((category) => category.items.length > 0),
    [templates],
  );

  const openBuilderForNew = () => setBuilderTemplate(createEmptyTemplate());
  const openBuilderForTemplate = (template: Template) => setBuilderTemplate(template);

  const handleSave = async ({ template, nodes }: { template: Pick<Template, "id" | "name" | "category" | "body" | "active">; nodes?: any[] }) => {
    if (!user) return;
    if (!template.name.trim() || !template.body.trim()) {
      toast.error("Preencha nome e mensagem principal");
      return;
    }

    setSaving(true);
    const payload = {
      name: template.name.trim(),
      category: template.category,
      body: template.body.trim(),
      active: template.active,
      user_id: user.id,
      variables: extractVariables(template.body),
      flow_nodes: nodes || [],
      updated_at: new Date().toISOString(),
    };

    const isNew = template.id.startsWith("__new__");
    const query = isNew
      ? supabase.from("whatsapp_templates").insert(payload).select().single()
      : supabase.from("whatsapp_templates").update(payload).eq("id", template.id).select().single();

    const { data, error } = await query;

    if (error) {
      toast.error("Não foi possível salvar o template");
      setSaving(false);
      return;
    }

    const normalized = { ...data, variables: data.variables || [], flow_nodes: data.flow_nodes || [] } as Template;
    setBuilderTemplate(normalized);
    toast.success(isNew ? "Template criado no builder" : "Template atualizado");
    await fetchTemplates();
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const { error } = await supabase.from("whatsapp_templates").delete().eq("id", deleteTarget.id);

    if (error) {
      toast.error("Erro ao excluir template");
      return;
    }

    if (builderTemplate?.id === deleteTarget.id) setBuilderTemplate(null);
    setDeleteTarget(null);
    toast.success("Template excluído");
    await fetchTemplates();
  };

  const handleDuplicate = async (template: Template) => {
    if (!user) return;
    setSaving(true);
    const payload = {
      name: `${template.name} (Cópia)`,
      category: template.category,
      body: template.body,
      active: template.active,
      user_id: user.id,
      variables: template.variables,
      flow_nodes: template.flow_nodes,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("whatsapp_templates").insert(payload);

    if (error) {
      toast.error("Erro ao duplicar template");
    } else {
      toast.success("Template duplicado com sucesso");
      await fetchTemplates();
    }
    setSaving(false);
  };

  if (builderTemplate) {
    return (
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
        <FlowCanvas
          categories={CATEGORIES.map(({ value, label }) => ({ value, label }))}
          isNew={builderTemplate.id.startsWith("__new__")}
          onBack={() => setBuilderTemplate(null)}
          onDelete={builderTemplate.id.startsWith("__new__") ? undefined : () => setDeleteTarget(builderTemplate)}
          onSave={handleSave}
          saving={saving}
          template={builderTemplate}
          initialNodes={builderTemplate.flow_nodes}
        />

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir template?</AlertDialogTitle>
              <AlertDialogDescription>Essa ação remove este fluxo visual permanentemente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Suspense>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-[32px] border border-border/60 bg-card/95 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <Badge className="border-gold/25 bg-gold/10 text-gold" variant="outline">
            <Workflow className="mr-1.5 h-3 w-3" />
            Templates em cards + fluxo visual
          </Badge>
          <h2 className="mt-4 font-display text-3xl font-semibold text-foreground">Templates com autoridade visual</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Organizados por cards, com abertura direta em um builder visual de nós conectados — sem aparência amadora.
          </p>
        </div>

        <Button className="gap-2 border border-gold/20 bg-gold text-background hover:bg-gold/90" onClick={openBuilderForNew}>
          <Workflow className="h-4 w-4" />
          Novo template visual
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <EmptyState onCreate={openBuilderForNew} />
      ) : (
        <div className="space-y-10">
          {groupedTemplates.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.value} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-foreground">{group.label}</h3>
                    <p className="text-sm text-muted-foreground">{group.items.length} template{group.items.length > 1 ? "s" : ""} nesta categoria</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
                  {group.items.map((template) => (
                    <TemplateCard
                      key={template.id}
                      onDelete={setDeleteTarget}
                      onOpen={openBuilderForTemplate}
                      onDuplicate={handleDuplicate}
                      template={template}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação remove este fluxo visual permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WhatsAppTemplates;
