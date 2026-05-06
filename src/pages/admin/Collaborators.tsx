import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Pencil, Trash2, Users, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { COLLABORATOR_PERMISSIONS, PERMISSION_KEYS } from "@/lib/collaboratorPermissions";

interface Collaborator {
  user_id: string;
  full_name: string;
  email: string;
  permissions: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
}

export default function Collaborators() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [list, setList] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Collaborator | null>(null);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    permissions: {} as Record<string, boolean>,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    console.log("Invoking list-collaborators...");
    try {
      const { data, error } = await supabase.functions.invoke("list-collaborators");
      console.log("list-collaborators response:", { data, error });
      if (error || data?.error) {
        toast.error(data?.error || "Erro ao carregar colaboradores");
        console.error("Collaborators load error:", error || data?.error);
      } else {
        setList(data?.collaborators || []);
      }
    } catch (err) {
      console.error("Critical error loading collaborators:", err);
      toast.error("Erro crítico ao carregar colaboradores");
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ email: "", full_name: "", permissions: {} });
    setOpen(true);
  };

  const openEdit = (c: Collaborator) => {
    setEditing(c);
    setForm({ email: c.email, full_name: c.full_name, permissions: c.permissions || {} });
    setOpen(true);
  };

  const togglePerm = (key: string) => {
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  };

  const toggleAll = (val: boolean) => {
    const all: Record<string, boolean> = {};
    PERMISSION_KEYS.forEach((k) => (all[k] = val));
    setForm((f) => ({ ...f, permissions: all }));
  };

  const save = async () => {
    if (!form.email || !form.full_name) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("create-collaborator", {
      body: {
        email: form.email,
        full_name: form.full_name,
        permissions: form.permissions,
      },
    });
    setSaving(false);
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao salvar colaborador");
      return;
    }
    toast.success(editing ? "Colaborador atualizado" : "Colaborador cadastrado — convite enviado");
    setOpen(false);
    load();
  };

  const toggleActive = async (c: Collaborator) => {
    const { error } = await supabase
      .from("collaborator_permissions")
      .update({ is_active: !c.is_active })
      .eq("user_id", c.user_id);
    if (error) toast.error("Erro ao atualizar status");
    else load();
  };

  const remove = async (c: Collaborator) => {
    if (!confirm(`Remover acesso de ${c.full_name || c.email}?`)) return;
    const { data, error } = await supabase.functions.invoke("remove-collaborator", {
      body: { user_id: c.user_id },
    });
    if (error || data?.error) {
      toast.error("Erro ao remover");
    } else {
      toast.success("Colaborador removido");
      load();
    }
  };

  if (authLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  if (!isSuperAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <p>Acesso restrito ao Super Admin.</p>
      </Card>
    );
  }

  const grouped = COLLABORATOR_PERMISSIONS.reduce((acc, p) => {
    (acc[p.group] ||= []).push(p);
    return acc;
  }, {} as Record<string, typeof COLLABORATOR_PERMISSIONS>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Colaboradores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre membros da equipe e controle exatamente o que cada um pode acessar.
          </p>
        </div>
        <Button onClick={load} variant="ghost" size="icon" disabled={loading} className="h-9 w-9">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Novo Colaborador
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum colaborador cadastrado ainda.</p>
            <Button variant="outline" className="mt-4" onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Cadastrar primeiro colaborador
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Permissões</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => {
                const count = Object.values(c.permissions || {}).filter(Boolean).length;
                return (
                  <TableRow key={c.user_id}>
                    <TableCell className="font-medium">{c.full_name || "—"}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{count} de {PERMISSION_KEYS.length} áreas</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar colaborador" : "Novo colaborador"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome completo</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Maria Silva"
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  disabled={!!editing}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="maria@empresa.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base">Permissões de acesso</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toggleAll(true)}>
                    Marcar todas
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleAll(false)}>
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="space-y-4 border rounded-lg p-4">
                {Object.entries(grouped).map(([group, items]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {group}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((p) => (
                        <label
                          key={p.key}
                          className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-2"
                        >
                          <Checkbox
                            checked={!!form.permissions[p.key]}
                            onCheckedChange={() => togglePerm(p.key)}
                          />
                          <span className="text-sm">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!editing && (
              <p className="text-xs text-muted-foreground">
                Um e-mail de convite será enviado para o colaborador definir a própria senha.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Salvar alterações" : "Cadastrar e convidar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
