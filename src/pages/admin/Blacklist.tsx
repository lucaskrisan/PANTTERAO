import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, ShieldBan, Plus, Search } from "lucide-react";
import { toast } from "sonner";

interface BlacklistEntry {
  id: string;
  type: string;
  value: string;
  reason: string | null;
  created_at: string;
}

const Blacklist = () => {
  const queryClient = useQueryClient();
  const [newType, setNewType] = useState<string>("cpf");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");
  const [search, setSearch] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["fraud-blacklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fraud_blacklist" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BlacklistEntry[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const cleanValue = newType === "cpf"
        ? newValue.replace(/\D/g, "")
        : newValue.toLowerCase().trim();

      if (!cleanValue) throw new Error("Valor obrigatório");

      if (newType === "cpf" && cleanValue.length !== 11) {
        throw new Error("CPF deve ter 11 dígitos");
      }

      if (newType === "email" && !cleanValue.includes("@")) {
        throw new Error("Email inválido");
      }

      const { error } = await supabase
        .from("fraud_blacklist" as any)
        .insert({
          type: newType,
          value: cleanValue,
          reason: newReason || null,
        } as any);

      if (error) {
        if (error.code === "23505") throw new Error("Este valor já está na blacklist");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud-blacklist"] });
      setNewValue("");
      setNewReason("");
      toast.success("Adicionado à blacklist");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fraud_blacklist" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud-blacklist"] });
      toast.success("Removido da blacklist");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const filtered = entries.filter(
    (e) =>
      e.value.includes(search.toLowerCase()) ||
      (e.reason || "").toLowerCase().includes(search.toLowerCase())
  );

  const formatCpf = (v: string) =>
    v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldBan className="h-6 w-6 text-red-500" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Blacklist Anti-Fraude</h1>
          <p className="text-sm text-muted-foreground">
            CPFs e e-mails bloqueados não conseguem finalizar compras em nenhum gateway.
          </p>
        </div>
      </div>

      {/* Add new */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Adicionar à blacklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder={newType === "cpf" ? "000.000.000-00" : "email@exemplo.com"}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1"
            />

            <Input
              placeholder="Motivo (opcional)"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="flex-1"
            />

            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !newValue}
              variant="destructive"
              className="shrink-0"
            >
              {addMutation.isPending ? "Salvando..." : "Bloquear"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Bloqueados ({entries.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {entries.length === 0
                ? "Nenhum CPF ou e-mail bloqueado ainda."
                : "Nenhum resultado encontrado."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant={entry.type === "cpf" ? "destructive" : "secondary"}>
                          {entry.type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.type === "cpf" && entry.value.length === 11
                          ? formatCpf(entry.value)
                          : entry.value}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {entry.reason || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(entry.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMutation.mutate(entry.id)}
                          disabled={removeMutation.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Blacklist;
