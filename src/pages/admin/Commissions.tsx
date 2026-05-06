import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, Wallet, TrendingUp, History, 
  ArrowUpRight, DollarSign, CheckCircle2, 
  AlertCircle, Send 
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const COMMISSION_RULES = [
  { min: 1, max: 49, rate47: 8, rate67: 12, bonus: 0 },
  { min: 50, max: 99, rate47: 10, rate67: 15, bonus: 500 },
  { min: 100, max: 149, rate47: 12, rate67: 18, bonus: 1500 },
  { min: 150, max: Infinity, rate47: 15, rate67: 22, bonus: 3000 },
];

export default function Commissions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    monthlySales: 0,
    currentEarnings: 0,
    paidEarnings: 0,
    pendingPayouts: 0,
    pixKey: "",
  });
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [requesting, setRequesting] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Fetch Profile for PIX key
      const { data: profile } = await supabase
        .from('profiles')
        .select('pix_key')
        .eq('id', user.id)
        .single();

      // Fetch Monthly Stats via RPC
      const { data: monthlyStats, error: statsErr } = await supabase
        .rpc('get_collaborator_monthly_stats', {
          p_collaborator_id: user.id,
          p_month: startOfMonth.toISOString()
        });

      if (statsErr) throw statsErr;
      const statsData = Array.isArray(monthlyStats) ? monthlyStats[0] : monthlyStats;

      // Fetch Sales attribution
      const { data: attributions, error: salesErr } = await supabase
        .from('sales_recovery_attribution')
        .select('*, orders(amount, created_at, status)')
        .eq('collaborator_id', user.id)
        .order('created_at', { ascending: false });

      if (salesErr) throw salesErr;

      // Fetch Payouts
      const { data: payouts, error: payoutErr } = await supabase
        .from('collaborator_payout_requests')
        .select('*')
        .eq('collaborator_id', user.id)
        .order('created_at', { ascending: false });

      if (payoutErr) throw payoutErr;

      // Calculate stats
      const paid = payouts?.filter(p => p.status === 'paid').reduce((acc, p) => acc + Number(p.amount), 0) || 0;
      const pending = payouts?.filter(p => p.status === 'pending').reduce((acc, p) => acc + Number(p.amount), 0) || 0;

      setStats({
        monthlySales: Number(statsData?.sales_count || 0),
        currentEarnings: Number(statsData?.total_earned || 0) - paid - pending,
        paidEarnings: paid,
        pendingPayouts: pending,
        pixKey: profile?.pix_key || "",
      });

      setSalesHistory(attributions || []);
      setPayoutHistory(payouts || []);
    } catch (error) {
      console.error("Error fetching commissions:", error);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const getCurrentTier = () => {
    return COMMISSION_RULES.find(r => stats.monthlySales >= r.min && stats.monthlySales <= r.max) || COMMISSION_RULES[0];
  };

  const getNextTier = () => {
    return COMMISSION_RULES.find(r => stats.monthlySales < r.min);
  };

  const requestPayout = async () => {
    if (!stats.pixKey) {
      toast.error("Cadastre sua chave PIX primeiro!");
      return;
    }
    if (stats.currentEarnings <= 0) {
      toast.error("Você não possui saldo disponível para saque.");
      return;
    }

    setRequesting(true);
    try {
      const { error } = await supabase
        .from('collaborator_payout_requests')
        .insert({
          collaborator_id: user?.id,
          amount: stats.currentEarnings,
          pix_key: stats.pixKey,
          status: 'pending'
        });

      if (error) throw error;
      toast.success("Solicitação de saque enviada!");
      fetchData();
    } catch (error) {
      console.error("Payout request error:", error);
      toast.error("Erro ao solicitar saque");
    } finally {
      setRequesting(false);
    }
  };

  const savePixKey = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pix_key: stats.pixKey })
        .eq('id', user?.id);
      
      if (error) throw error;
      toast.success("Chave PIX salva com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar chave PIX");
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  const currentTier = getCurrentTier();
  const nextTier = getNextTier();
  const progress = nextTier ? (stats.monthlySales / nextTier.min) * 100 : 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Minhas Comissões</h1>
          <p className="text-muted-foreground">Acompanhe seu desempenho e ganhos na gincana de vendas.</p>
        </div>
        <div className="flex items-center gap-3">
            <Card className="px-4 py-2 flex items-center gap-3 bg-primary/5 border-primary/20">
                <Wallet className="w-5 h-5 text-primary" />
                <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Saldo Disponível</p>
                    <p className="text-xl font-bold">R$ {stats.currentEarnings.toFixed(2)}</p>
                </div>
                <Button size="sm" onClick={requestPayout} disabled={requesting || stats.currentEarnings <= 0}>
                    {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4 mr-1" />}
                    Sacar
                </Button>
            </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 col-span-1 lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" /> Meta do Mês
                </h2>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                    Tier Atual: {currentTier.min}-{currentTier.max === Infinity ? '150+' : currentTier.max} vendas
                </Badge>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span>{stats.monthlySales} vendas este mês</span>
                    <span>{nextTier ? `Próximo bônus em ${nextTier.min} vendas` : 'Meta máxima atingida!'}</span>
                </div>
                <Progress value={progress} className="h-3" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-muted/50 p-3 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">Comissão R$47</p>
                    <p className="text-lg font-bold">R$ {currentTier.rate47}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">Comissão R$67</p>
                    <p className="text-lg font-bold">R$ {currentTier.rate67}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg text-center border border-blue-200">
                    <p className="text-xs text-muted-foreground mb-1">Bônus Meta</p>
                    <p className="text-lg font-bold text-blue-600">R$ {currentTier.bonus}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg text-center border border-green-200">
                    <p className="text-xs text-muted-foreground mb-1">Total Ganho</p>
                    <p className="text-lg font-bold text-green-600">R$ {(stats.currentEarnings + stats.paidEarnings + stats.pendingPayouts).toFixed(2)}</p>
                </div>
            </div>
        </Card>

        <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" /> Configuração de Saque
            </h2>
            <div className="space-y-3">
                <div className="space-y-1">
                    <Label htmlFor="pix">Sua Chave PIX</Label>
                    <div className="flex gap-2">
                        <Input 
                            id="pix" 
                            placeholder="CPF, E-mail ou Telefone" 
                            value={stats.pixKey}
                            onChange={(e) => setStats({...stats, pixKey: e.target.value})}
                        />
                        <Button variant="outline" size="icon" onClick={savePixKey}>
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                        * O pagamento é realizado manualmente pelo financeiro.
                    </p>
                </div>
                
                <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pago:</span>
                        <span className="font-medium">R$ {stats.paidEarnings.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Aguardando:</span>
                        <span className="font-medium text-orange-500">R$ {stats.pendingPayouts.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-muted-foreground" /> Últimas Recuperações
              </h2>
              <div className="space-y-3">
                  {salesHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda recuperada ainda.</p>
                  ) : (
                      salesHistory.slice(0, 5).map((sale) => (
                          <div key={sale.order_id} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg border">
                              <div>
                                  <p className="text-sm font-medium">Pedido #{sale.order_id.split('-')[0]}</p>
                                  <p className="text-xs text-muted-foreground">{format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                              </div>
                              <div className="text-right">
                                  <p className="text-sm font-bold text-green-600">+ R$ {Number(sale.commission_amount).toFixed(2)}</p>
                                  <p className="text-[10px] uppercase text-muted-foreground">Venda R$ {Number(sale.product_price).toFixed(2)}</p>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </Card>

          <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-muted-foreground" /> Histórico de Saques
              </h2>
              <div className="space-y-3">
                  {payoutHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum saque solicitado ainda.</p>
                  ) : (
                      payoutHistory.slice(0, 5).map((payout) => (
                          <div key={payout.id} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg border">
                              <div>
                                  <p className="text-sm font-medium">R$ {Number(payout.amount).toFixed(2)}</p>
                                  <p className="text-xs text-muted-foreground">{format(new Date(payout.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                              </div>
                              <div>
                                  <Badge 
                                    variant={payout.status === 'paid' ? 'default' : payout.status === 'pending' ? 'secondary' : 'destructive'}
                                    className={payout.status === 'paid' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                                  >
                                      {payout.status === 'paid' ? 'Pago' : payout.status === 'pending' ? 'Pendente' : 'Recusado'}
                                  </Badge>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </Card>
      </div>
    </div>
  );
}
