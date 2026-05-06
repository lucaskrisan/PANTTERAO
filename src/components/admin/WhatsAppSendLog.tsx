// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Loader2, MessageSquare, CheckCircle2, XCircle, RefreshCw, 
  ChevronLeft, ChevronRight, Check, CheckCheck, Search, Filter, 
  Calendar as CalendarIcon, Eye, EyeOff 
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  tenant_id: string;
  order_id: string | null;
  customer_phone: string;
  template_category: string;
  message_body: string;
  status: string;
  delivery_status: string;
  error_message: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

const PAGE_SIZE = 15;

const CATEGORY_LABELS: Record<string, string> = {
  confirmacao: "Confirmação",
  boas_vindas: "Boas-vindas",
  abandono: "Abandono",
  lembrete_pix: "Lembrete PIX",
  acesso: "Acesso",
  geral: "Geral",
};

const DeliveryIcon = ({ delivery_status, delivered_at, read_at }: { delivery_status: string; delivered_at: string | null; read_at: string | null }) => {
  const tooltipMap: Record<string, string> = {
    sent: "Enviado ao servidor",
    server: "Recebido pelo WhatsApp",
    delivered: delivered_at ? `Entregue em ${format(new Date(delivered_at), "dd/MM HH:mm")}` : "Entregue",
    read: read_at ? `Lido em ${format(new Date(read_at), "dd/MM HH:mm")}` : "Lido",
    failed: "Falha na entrega",
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            {delivery_status === "read" ? (
              <CheckCheck className="h-4 w-4 text-blue-500" />
            ) : delivery_status === "delivered" ? (
              <CheckCheck className="h-4 w-4 text-muted-foreground" />
            ) : delivery_status === "server" ? (
              <Check className="h-4 w-4 text-muted-foreground" />
            ) : delivery_status === "failed" ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Check className="h-4 w-4 text-muted-foreground/50" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipMap[delivery_status] || delivery_status}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const WhatsAppSendLog = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [showFullPhone, setShowFullPhone] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  const handleRetry = async (log: LogEntry) => {
    if (!user) return;
    setRetrying(log.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Use send-whatsapp-message for simple text retry
      const res = await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          to_number: log.customer_phone,
          message: log.message_body,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.error || !res.data?.success) {
        const errorMsg = res.error?.message || res.data?.details || res.data?.error || "Erro desconhecido";
        toast.error("Erro ao reenviar: " + errorMsg);
      } else {
        toast.success("Mensagem reenviada com sucesso!");
        fetchLogs(); // Refresh to show new log entry if applicable
      }
    } catch (error: any) {
      toast.error("Erro no reenvio: " + error.message);
    } finally {
      setRetrying(null);
    }
  };

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("whatsapp_send_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }
    if (filterCategory !== "all") {
      query = query.eq("template_category", filterCategory);
    }
    if (search) {
      query = query.or(`customer_phone.ilike.%${search}%,message_body.ilike.%${search}%,order_id.ilike.%${search}%`);
    }
    if (date) {
      const start = startOfDay(date).toISOString();
      const end = endOfDay(date).toISOString();
      query = query.gte("created_at", start).lte("created_at", end);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching logs:", error);
    } else {
      setLogs((data || []) as LogEntry[]);
      setHasMore(count ? count > (page + 1) * PAGE_SIZE : false);
    }
    setLoading(false);
  }, [user, page, filterStatus, filterCategory, search, date]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const maskPhone = (phone: string) => {
    if (showFullPhone) return phone;
    const d = phone.replace(/\D/g, "");
    if (d.length >= 10) {
      return `${d.slice(0, 4)}****${d.slice(-2)}`;
    }
    return "****";
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2 font-display">
                <MessageSquare className="w-5 h-5 text-gold" />
                Histórico de Envios
              </CardTitle>
              <CardDescription>
                Acompanhe em tempo real o status de cada mensagem enviada.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowFullPhone(!showFullPhone)}
                title={showFullPhone ? "Mascarar números" : "Mostrar números completos"}
              >
                {showFullPhone ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => { setPage(0); fetchLogs(); }}>
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Sincronizar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="relative col-span-1 md:col-span-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Telefone, mensagem..."
                className="pl-9 h-9 text-xs"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
            
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(0); }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todas Categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 text-xs justify-start text-left font-normal w-full",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : "Filtrar por data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setPage(0); }}
                  initialFocus
                  locale={ptBR}
                />
                {date && (
                  <div className="p-2 border-t flex justify-center">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDate(undefined); setPage(0); }}>
                      Limpar data
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Nenhum envio registrado ainda.
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Telefone</TableHead>
                    <TableHead className="text-xs">Categoria</TableHead>
                    <TableHead className="text-xs">Mensagem</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs w-[50px]">Entrega</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM HH:mm")}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {maskPhone(log.customer_phone)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {CATEGORY_LABELS[log.template_category] || log.template_category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={log.message_body}>
                        {log.message_body.slice(0, 60)}...
                      </TableCell>
                      <TableCell>
                        {log.status === "sent" ? (
                          <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Enviado
                          </Badge>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="gap-1 text-[10px] w-fit" title={log.error_message || ""}>
                                <XCircle className="h-3 w-3" />
                                Falhou
                              </Badge>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-muted-foreground hover:text-gold"
                                onClick={() => handleRetry(log)}
                                disabled={!!retrying}
                                title="Reenviar agora"
                              >
                                {retrying === log.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                            {log.error_message && (
                              <p className="text-[10px] text-red-400/80 mt-0.5 max-w-[200px] truncate" title={log.error_message}>
                                {log.error_message}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.status === "sent" && (
                          <DeliveryIcon
                            delivery_status={log.delivery_status || "sent"}
                            delivered_at={log.delivered_at}
                            read_at={log.read_at}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Check className="h-3 w-3 text-muted-foreground/50" /> Enviado</span>
              <span className="flex items-center gap-1"><CheckCheck className="h-3 w-3 text-muted-foreground" /> Entregue</span>
              <span className="flex items-center gap-1"><CheckCheck className="h-3 w-3 text-blue-500" /> Lido</span>
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">Página {page + 1}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppSendLog;
