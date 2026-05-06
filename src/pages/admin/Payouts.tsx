import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Loader2, Wallet, CheckCircle, XCircle, 
  ExternalLink, User, ShieldCheck 
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Payouts() {
  const { isSuperAdmin, user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchData = async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collaborator_payout_requests')
        .select('*, profiles:collaborator_id(full_name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching payouts:", error);
      toast.error("Erro ao carregar solicitações de saque");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isSuperAdmin]);

  const updateStatus = async (id: string, status: 'paid' | 'rejected') => {
    setProcessing(id);
    try {
      const { error } = await supabase
        .from('collaborator_payout_requests')
        .update({ 
          status, 
          processed_at: new Date().toISOString(),
          processed_by: user?.id
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(status === 'paid' ? "Saque marcado como pago!" : "Saque recusado.");
      fetchData();
    } catch (error) {
      console.error("Update status error:", error);
      toast.error("Erro ao atualizar status");
    } finally {
      setProcessing(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <p>Acesso restrito ao Super Admin.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> Gestão de Saques
          </h1>
          <p className="text-muted-foreground">Administre as solicitações de pagamento dos colaboradores.</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p>Nenhuma solicitação de saque encontrada.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Chave PIX</TableHead>
                <TableHead>Data Solicitação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {(req.profiles?.full_name || req.profiles?.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{req.profiles?.full_name || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground">{req.profiles?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">R$ {Number(req.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted p-1 rounded">{req.pix_key}</code>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(req.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={req.status === 'paid' ? 'default' : req.status === 'pending' ? 'secondary' : 'destructive'}
                      className={req.status === 'paid' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {req.status === 'paid' ? 'Pago' : req.status === 'pending' ? 'Pendente' : 'Recusado'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => updateStatus(req.id, 'paid')}
                          disabled={processing === req.id}
                        >
                          {processing === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive hover:bg-destructive/5"
                          onClick={() => updateStatus(req.id, 'rejected')}
                          disabled={processing === req.id}
                        >
                          {processing === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {req.processed_at && format(new Date(req.processed_at), "dd/MM", { locale: ptBR })}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
