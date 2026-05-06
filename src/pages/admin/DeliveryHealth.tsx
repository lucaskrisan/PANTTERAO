import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Mail, 
  ExternalLink, 
  User, 
  Package,
  AlertTriangle,
  Clock,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DeliveryItem {
  id: string;
  created_at: string;
  status: string;
  payment_method: string;
  customer_name: string;
  customer_email: string;
  product_name: string;
  delivery_method: string;
  has_access: boolean;
  emails_sent: number;
  last_email_status: string | null;
}

const DeliveryHealth = () => {
  const { user, isSuperAdmin } = useAuth();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["delivery-health-orders"],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(`
          id, 
          status, 
          created_at, 
          payment_method,
          customer:customers(name, email),
          product:products(name, delivery_method, user_id)
        `)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(40);

      if (!isSuperAdmin) {
        query = query.eq("user_id", user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enhance with delivery checks
      const enhanced = await Promise.all((data || []).map(async (order: any) => {
        const prod = order.product as any;
        const cust = order.customer as any;
        
        let hasAccess = false;
        if (prod?.delivery_method === 'panttera') {
          const { count } = await supabase
            .from('member_access')
            .select('id', { count: 'exact', head: true })
            .eq('customer_id', order.customer_id)
            .eq('course_id', (await supabase.from('courses').select('id').eq('product_id', order.product_id).limit(1).maybeSingle()).data?.id);
          hasAccess = (count || 0) > 0;
        }

        const { data: emails } = await supabase
          .from('email_logs')
          .select('status')
          .eq('order_id', order.id)
          .eq('email_type', 'access_link')
          .order('created_at', { ascending: false });

        return {
          id: order.id,
          created_at: order.created_at,
          status: order.status,
          payment_method: order.payment_method,
          customer_name: cust?.name || "Desconhecido",
          customer_email: cust?.email || "Sem e-mail",
          product_name: prod?.name || "Produto Removido",
          delivery_method: prod?.delivery_method || "appsell",
          has_access: hasAccess,
          emails_sent: emails?.length || 0,
          last_email_status: emails?.[0]?.status || null,
        } as DeliveryItem;
      }));

      return enhanced;
    },
    enabled: !!user,
  });

  const handleRetry = async (orderId: string) => {
    setRetryingId(orderId);
    try {
      const { data, error } = await supabase.functions.invoke("retry-delivery", {
        body: { order_id: orderId },
      });

      if (error) throw error;
      
      toast.success("Entrega reprocessada com sucesso!");
      refetch();
    } catch (err: any) {
      console.error("Retry error:", err);
      toast.error("Erro ao reprocessar: " + err.message);
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (order: DeliveryItem) => {
    if (order.delivery_method === 'panttera') {
      if (order.has_access) {
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1"><CheckCircle2 className="w-3 h-3" /> Acesso OK</Badge>;
      }
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1"><AlertTriangle className="w-3 h-3" /> Sem Acesso</Badge>;
    } else {
      // AppSell delivery is harder to track perfectly, but we can see if it was triggered (logs)
      // or assume it's OK if we don't have errors.
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1"><ExternalLink className="w-3 h-3" /> AppSell</Badge>;
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
        <h2 className="text-xl font-semibold text-white">Acesso Restrito</h2>
        <p className="text-muted-foreground">Esta ferramenta está disponível apenas para administradores da plataforma.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Saúde de Entregas
          </h1>
          <p className="text-muted-foreground text-sm">Monitore a entrega automática de acessos e materiais para seus clientes.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          disabled={isLoading}
          className="bg-white/5 hover:bg-white/10"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Vendas Pagas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{orders?.length || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Últimos 40 pedidos confirmados</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entregas Panttera</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {orders?.filter(o => o.delivery_method === 'panttera' && o.has_access).length || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Acessos à área de membros ativos</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alertas de Falha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">
              {orders?.filter(o => o.delivery_method === 'panttera' && !o.has_access).length || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Vendas pagas sem acesso provisionado</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-base">Histórico Recente de Entregas</CardTitle>
          <CardDescription>Acompanhe o status de provisionamento em tempo real.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando pedidos...</div>
            ) : orders?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhuma venda paga encontrada recentemente.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {orders?.map((order) => (
                  <div key={order.id} className="p-4 hover:bg-white/5 transition-colors group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded-full shrink-0 ${order.has_access || order.delivery_method === 'appsell' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white truncate max-w-[200px]">{order.customer_name}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{order.customer_email}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {order.product_name}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(order.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                            <span className="flex items-center gap-1"><Activity className="w-3 h-3 uppercase" /> {order.payment_method}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-auto">
                        <div className="flex flex-col items-end gap-1">
                          {getStatusBadge(order)}
                          {order.emails_sent > 0 && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                              <Mail className="w-2.5 h-2.5" /> Email enviado ({order.last_email_status})
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/10"
                          onClick={() => handleRetry(order.id)}
                          disabled={retryingId === order.id}
                        >
                          <RefreshCw className={`w-4 h-4 ${retryingId === order.id ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeliveryHealth;
