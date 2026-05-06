// @ts-nocheck
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Send, DollarSign, Eye, Search, Filter, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { EmailPreviewModal } from "@/components/admin/EmailPreviewModal";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";

const EMAIL_TYPE_LABELS: Record<string, string> = {
  pix_generated: "PIX Gerado",
  pix_reminder: "Lembrete PIX",
  access_link: "Link de Acesso",
  payment_confirmed: "Pagamento Confirmado",
  transactional: "Transacional",
};

const SOURCE_LABELS: Record<string, string> = {
  "create-pix-payment": "Checkout PIX",
  "send-pix-reminder": "Lembrete PIX",
  "send-access-link": "Acesso Manual",
  "asaas-webhook": "Webhook Asaas",
  "pagarme-webhook": "Webhook Pagar.me",
};

const COST_PER_EMAIL = 0.00115; // ~$0.00115 USD per email (Resend free tier = 100/day, then ~$1.15/1000)

export default function Emails() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [previewEmail, setPreviewEmail] = useState<any>(null);
  const [period, setPeriod] = useState<string>("current");

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["email-logs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Period filtering for cost dashboard
  const getPeriodDates = () => {
    const now = new Date();
    if (period === "current") return { start: startOfMonth(now), end: endOfMonth(now) };
    if (period === "last") {
      const last = subMonths(now, 1);
      return { start: startOfMonth(last), end: endOfMonth(last) };
    }
    return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
  };

  const { start: periodStart, end: periodEnd } = getPeriodDates();

  const periodEmails = emails.filter((e) => {
    const d = new Date(e.created_at);
    return d >= periodStart && d <= periodEnd;
  });

  const filteredEmails = emails.filter((e) => {
    const matchesSearch =
      !search ||
      e.to_email?.toLowerCase().includes(search.toLowerCase()) ||
      e.to_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.subject?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || e.email_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalEmails = periodEmails.length;
  const estimatedCost = (totalEmails * COST_PER_EMAIL).toFixed(2);
  const emailsByType = periodEmails.reduce<Record<string, number>>((acc, e) => {
    acc[e.email_type] = (acc[e.email_type] || 0) + 1;
    return acc;
  }, {});

  const todayEmails = emails.filter(
    (e) => new Date(e.created_at).toDateString() === new Date().toDateString()
  ).length;

  const deliveredCount = periodEmails.filter((e) => ["delivered", "opened", "clicked"].includes(e.status)).length;
  const openedCount = periodEmails.filter((e) => ["opened", "clicked"].includes(e.status)).length;
  const clickedCount = periodEmails.filter((e) => e.status === "clicked").length;
  const bouncedCount = periodEmails.filter((e) => e.status === "bounced").length;
  const deliveryRate = totalEmails > 0 ? ((deliveredCount / totalEmails) * 100).toFixed(1) : "0";
  const openRate = deliveredCount > 0 ? ((openedCount / deliveredCount) * 100).toFixed(1) : "0";
  const clickRate = openedCount > 0 ? ((clickedCount / openedCount) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Emails</h1>
        <p className="text-muted-foreground">Histórico de emails enviados e custos</p>
      </div>

      {/* Cost Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total no Período</p>
                <p className="text-2xl font-bold text-foreground">{totalEmails}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Send className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Enviados Hoje</p>
                <p className="text-2xl font-bold text-foreground">{todayEmails}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Custo Estimado</p>
                <p className="text-2xl font-bold text-foreground">$ {estimatedCost}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Por Tipo</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(emailsByType).slice(0, 3).map(([type, count]) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {EMAIL_TYPE_LABELS[type] || type}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Tracking Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Entrega</p>
              <p className="text-xl font-bold text-foreground">{deliveryRate}%</p>
              <p className="text-xs text-muted-foreground">{deliveredCount} de {totalEmails}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Abertura</p>
              <p className="text-xl font-bold text-foreground">{openRate}%</p>
              <p className="text-xs text-muted-foreground">{openedCount} abertos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Cliques</p>
              <p className="text-xl font-bold text-foreground">{clickRate}%</p>
              <p className="text-xs text-muted-foreground">{clickedCount} clicados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Bounce</p>
              <p className="text-xl font-bold text-destructive">{bouncedCount}</p>
              <p className="text-xs text-muted-foreground">rejeitados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mês Atual</SelectItem>
            <SelectItem value="last">Mês Anterior</SelectItem>
            <SelectItem value="quarter">Últimos 3 Meses</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {format(periodStart, "dd/MM/yyyy")} — {format(periodEnd, "dd/MM/yyyy")}
        </span>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" /> Emails Enviados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email, nome ou assunto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="pix_generated">PIX Gerado</SelectItem>
                <SelectItem value="pix_reminder">Lembrete PIX</SelectItem>
                <SelectItem value="access_link">Link de Acesso</SelectItem>
                <SelectItem value="payment_confirmed">Pagamento Confirmado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : filteredEmails.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum email encontrado</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(email.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{email.to_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{email.to_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm">
                        {email.subject}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {EMAIL_TYPE_LABELS[email.email_type] || email.email_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {SOURCE_LABELS[email.source] || email.source || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            email.status === "clicked" || email.status === "opened" ? "default" :
                            email.status === "delivered" ? "secondary" :
                            email.status === "sent" ? "outline" :
                            email.status === "bounced" || email.status === "failed" || email.status === "complained" ? "destructive" :
                            "outline"
                          }
                          className="text-xs"
                        >
                          {email.status === "sent" ? "📤 Enviado" :
                           email.status === "delivered" ? "✅ Entregue" :
                           email.status === "opened" ? "👁 Aberto" :
                           email.status === "clicked" ? "🔗 Clicado" :
                           email.status === "bounced" ? "❌ Bounce" :
                           email.status === "failed" ? "⚠️ Falhou" :
                           email.status === "complained" ? "🚫 Spam" :
                           email.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {email.html_body && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPreviewEmail(email)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Preview & Edit Modal */}
      {previewEmail && (
        <EmailPreviewModal
          open={!!previewEmail}
          onOpenChange={(open) => { if (!open) setPreviewEmail(null); }}
          subject={previewEmail.subject || ""}
          body={previewEmail.html_body || ""}
          fullHtml={previewEmail.html_body || ""}
          to={previewEmail.to_email || ""}
          customerName={previewEmail.to_name || "Cliente"}
          productName={
            EMAIL_TYPE_LABELS[previewEmail.email_type] || previewEmail.email_type
          }
          orderId={previewEmail.order_id}
          emailType={previewEmail.email_type}
          onSend={async (subject, body) => {
            if (!previewEmail.order_id) {
              toast.error("Este email não tem um pedido associado para reenvio");
              return;
            }
            const { error } = await supabase.functions.invoke("send-pix-reminder", {
              body: {
                order_id: previewEmail.order_id,
                subject,
                body,
              },
            });
            if (error) {
              toast.error("Falha ao reenviar email");
              throw error;
            }
            toast.success("Email reenviado com sucesso!");
          }}
        />
      )}
    </div>
  );
}
