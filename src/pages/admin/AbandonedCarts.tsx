import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Download, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
  Filter, Search, ShoppingBag, Mail, RefreshCw,
} from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AbandonedCart {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  payment_method: string | null;
  recovered: boolean;
  created_at: string;
  updated_at: string;
  product_id: string;
  email_recovery_status: string | null;
  checkout_step: string | null;
  products?: { name: string } | null;
}

const ITEMS_PER_PAGE = 20;

const AbandonedCarts = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, isCollaborator } = useAuth();
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Recovery settings
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailDelay, setEmailDelay] = useState("30");
  const [emailSubject, setEmailSubject] = useState("Você esqueceu algo no carrinho 🛒");
  const [emailHeading, setEmailHeading] = useState("Você esqueceu algo no carrinho 🛒");
  const [emailButtonText, setEmailButtonText] = useState("Finalizar compra →");
  const [emailButtonColor, setEmailButtonColor] = useState("#22c55e");
  const [secondEmailEnabled, setSecondEmailEnabled] = useState(true);
  const [secondEmailDelay, setSecondEmailDelay] = useState("24");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappDelay, setWhatsappDelay] = useState("15");
  const [whatsappMessage, setWhatsappMessage] = useState("Olá {nome}! 🛒 Vi que você deixou alguns itens no carrinho. Use o cupom VOLTEJA para ganhar 10% de desconto e finalizar sua compra agora: {link}");

  // Filters
  const [filterRecovered, setFilterRecovered] = useState<boolean[]>([]);
  const [filterEmailStatus, setFilterEmailStatus] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState<"from" | "to" | null>(null);

  // Load recovery settings
  useEffect(() => {
    const loadSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("cart_recovery_settings")
        .select("email_enabled, email_delay_minutes, email_subject, email_heading, email_button_text, email_button_color, second_email_enabled, second_email_delay_hours, whatsapp_enabled, whatsapp_delay_minutes, whatsapp_message_template")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setEmailEnabled(data.email_enabled);
        setEmailDelay(String(data.email_delay_minutes));
        if (data.email_subject) setEmailSubject(data.email_subject);
        if (data.email_heading) setEmailHeading(data.email_heading);
        if (data.email_button_text) setEmailButtonText(data.email_button_text);
        if (data.email_button_color) setEmailButtonColor(data.email_button_color);
        setSecondEmailEnabled(data.second_email_enabled ?? true);
        if (data.second_email_delay_hours) setSecondEmailDelay(String(data.second_email_delay_hours));
        setWhatsappEnabled(data.whatsapp_enabled ?? false);
        if (data.whatsapp_delay_minutes) setWhatsappDelay(String(data.whatsapp_delay_minutes));
        if (data.whatsapp_message_template) setWhatsappMessage(data.whatsapp_message_template);
      }
    };
    loadSettings();
  }, []);

  const saveRecoverySetting = async (field: string, value: boolean | number | string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      user_id: user.id,
      [field]: value,
    };
    const { error } = await supabase
      .from("cart_recovery_settings")
      .upsert(payload as any, { onConflict: "user_id" });
    if (error) {
      toast.error("Erro ao salvar configuração");
    } else {
      toast.success("Configuração salva!");
    }
  };

  const loadCarts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("abandoned_carts")
      .select("id, customer_name, customer_email, customer_phone, payment_method, recovered, created_at, updated_at, product_id, email_recovery_status, checkout_step, products(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    setCarts((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadCarts();
  }, []);

  const filtered = useMemo(() => {
    let result = carts;

    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        (c.customer_name || "").toLowerCase().includes(s) ||
        (c.customer_email || "").toLowerCase().includes(s) ||
        (c.customer_phone || "").includes(s) ||
        c.id.slice(0, 8).includes(s.replace("#", ""))
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter(c => new Date(c.updated_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(c => new Date(c.updated_at) <= to);
    }

    if (filterRecovered.length > 0 && filterRecovered.length < 2) {
      const wantRecovered = filterRecovered[0];
      result = result.filter(c => c.recovered === wantRecovered);
    }

    if (filterEmailStatus.length > 0) {
      result = result.filter(c => {
        if (filterEmailStatus.includes("sent") && c.email_recovery_status === "sent") return true;
        if (filterEmailStatus.includes("error") && c.email_recovery_status === "error") return true;
        if (filterEmailStatus.includes("none") && !c.email_recovery_status) return true;
        return false;
      });
    }

    // Prioritize abandoned (non-recovered) first, then by date desc
    result = [...result].sort((a, b) => {
      if (a.recovered !== b.recovered) return a.recovered ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [carts, search, dateFrom, dateTo, filterRecovered, filterEmailStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, filterRecovered, filterEmailStatus]);

  const exportCSV = () => {
    const rows = [["Checkout", "Data", "Nome", "Email", "Celular", "Status Email", "Recuperado"]];
    filtered.forEach(c => {
      rows.push([
        "#" + c.id.slice(0, 8),
        format(new Date(c.created_at), "dd/MM/yyyy HH:mm"),
        c.customer_name || "",
        c.customer_email || "",
        c.customer_phone || "",
        c.email_recovery_status || "não enviado",
        c.recovered ? "Recuperado" : "Não Recuperado",
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `checkouts-abandonados-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const openWhatsApp = (phone: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) return;
    const clean = phone.replace(/\D/g, "");
    const number = clean.startsWith("55") ? clean : `55${clean}`;
    const msg = encodeURIComponent("Olá! Vi que você se interessou pelo nosso produto. Posso te ajudar?");
    window.open(`https://wa.me/${number}?text=${msg}`, "_blank");
  };

  const toggleRecoveredFilter = (val: boolean) => {
    setFilterRecovered(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const toggleEmailFilter = (val: string) => {
    setFilterEmailStatus(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const clearFilters = () => {
    setFilterRecovered([]);
    setFilterEmailStatus([]);
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const emailDot = (status: string | null) => {
    if (status === "sent") return "bg-green-500";
    if (status === "error") return "bg-red-500";
    return "bg-gray-400";
  };

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push(-1, totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1, -1);
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1, -1, page - 1, page, page + 1, -2, totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-4">
      {/* Recovery Settings Card - Super Admin only */}
      {isSuperAdmin && !isCollaborator && (
        <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-5 h-5 text-primary" />
            Recuperação automática por e-mail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={emailEnabled}
                onCheckedChange={(checked) => {
                  setEmailEnabled(checked);
                  saveRecoverySetting("email_enabled", checked);
                }}
              />
              <Label className="text-sm font-medium cursor-pointer">
                Ativar recuperação por e-mail
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Enviar após:</Label>
              <Select
                value={emailDelay}
                onValueChange={(val) => {
                  setEmailDelay(val);
                  saveRecoverySetting("email_delay_minutes", Number(val));
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                  <SelectItem value="360">6 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Template Customization */}
          {emailEnabled && (
            <div className="mt-4 pt-4 border-t border-border space-y-3">
              <p className="text-sm font-medium text-foreground">Personalizar e-mail</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Assunto do e-mail</Label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    onBlur={() => saveRecoverySetting("email_subject", emailSubject)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Título do e-mail</Label>
                  <Input
                    value={emailHeading}
                    onChange={(e) => setEmailHeading(e.target.value)}
                    onBlur={() => saveRecoverySetting("email_heading", emailHeading)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Texto do botão</Label>
                  <Input
                    value={emailButtonText}
                    onChange={(e) => setEmailButtonText(e.target.value)}
                    onBlur={() => saveRecoverySetting("email_button_text", emailButtonText)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cor do botão</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={emailButtonColor}
                      onChange={(e) => {
                        setEmailButtonColor(e.target.value);
                        saveRecoverySetting("email_button_color", e.target.value);
                      }}
                      className="w-8 h-8 rounded border border-border cursor-pointer"
                    />
                    <Input
                      value={emailButtonColor}
                      onChange={(e) => setEmailButtonColor(e.target.value)}
                      onBlur={() => saveRecoverySetting("email_button_color", emailButtonColor)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Second Reminder */}
              <div className="pt-3 border-t border-border">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={secondEmailEnabled}
                    onCheckedChange={(checked) => {
                      setSecondEmailEnabled(checked);
                      saveRecoverySetting("second_email_enabled", checked);
                    }}
                  />
                  <Label className="text-sm font-medium cursor-pointer">
                    Enviar 2º lembrete (última chance)
                  </Label>
                </div>
                {secondEmailEnabled && (
                  <div className="flex items-center gap-2 mt-2 ml-10">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Enviar após:</Label>
                    <Select
                      value={secondEmailDelay}
                      onValueChange={(val) => {
                        setSecondEmailDelay(val);
                        saveRecoverySetting("second_email_delay_hours", Number(val));
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12 horas</SelectItem>
                        <SelectItem value="24">24 horas</SelectItem>
                        <SelectItem value="48">48 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* WhatsApp Recovery */}
              <div className="pt-4 mt-4 border-t border-border space-y-3">
                <p className="text-sm font-medium text-foreground">Recuperação por WhatsApp</p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={whatsappEnabled}
                      onCheckedChange={(checked) => {
                        setWhatsappEnabled(checked);
                        saveRecoverySetting("whatsapp_enabled", checked);
                      }}
                    />
                    <Label className="text-sm font-medium cursor-pointer">
                      Ativar recuperação por WhatsApp
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Enviar após:</Label>
                    <Select
                      value={whatsappDelay}
                      onValueChange={(val) => {
                        setWhatsappDelay(val);
                        saveRecoverySetting("whatsapp_delay_minutes", Number(val));
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 min</SelectItem>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {whatsappEnabled && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Template da mensagem (use {"{nome}"} e {"{link}"})</Label>
                    <textarea
                      value={whatsappMessage}
                      onChange={(e) => setWhatsappMessage(e.target.value)}
                      onBlur={() => saveRecoverySetting("whatsapp_message_template", whatsappMessage)}
                      className="w-full min-h-[100px] p-3 text-sm rounded-md border border-input bg-background"
                      placeholder="Olá {nome}! Vi que você esqueceu alguns itens..."
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Checkouts Abandonados</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadCarts} disabled={loading} title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCSV}>
            <Download className="w-4 h-4" />
            Exportar
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Mais filtros
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[340px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Mais filtros</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Última atualização</h4>
                  <div className="flex items-center gap-2">
                    <Popover open={datePickerOpen === "from"} onOpenChange={(o) => setDatePickerOpen(o ? "from" : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d || undefined); setDatePickerOpen(null); }} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                    <span className="text-muted-foreground text-xs">—</span>
                    <Popover open={datePickerOpen === "to"} onOpenChange={(o) => setDatePickerOpen(o ? "to" : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                          {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d || undefined); setDatePickerOpen(null); }} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Status do e-mail</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={filterEmailStatus.includes("sent")} onCheckedChange={() => toggleEmailFilter("sent")} />
                      Enviado
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={filterEmailStatus.includes("error")} onCheckedChange={() => toggleEmailFilter("error")} />
                      Erro
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={filterEmailStatus.includes("none")} onCheckedChange={() => toggleEmailFilter("none")} />
                      Não enviado
                    </label>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Status da recuperação</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={filterRecovered.includes(true)} onCheckedChange={() => toggleRecoveredFilter(true)} />
                      Recuperado
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={filterRecovered.includes(false)} onCheckedChange={() => toggleRecoveredFilter(false)} />
                      Não recuperado
                    </label>
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={clearFilters}>
                  Limpar todos os filtros
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>


      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Procurar Checkouts"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando...</div>
      ) : paginated.length === 0 ? (
        <div className="py-12 text-center">
          <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum checkout abandonado encontrado.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Checkout</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número de telefone</TableHead>
                  <TableHead>Status do e-mail</TableHead>
                  <TableHead className="text-right">Status da recuperação</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(cart => (
                  <TableRow
                    key={cart.id}
                    className="cursor-pointer border-l-2 border-l-transparent hover:bg-muted/50 hover:border-l-primary/40 transition-colors"
                    onClick={() => navigate(`/admin/abandoned-carts/${cart.id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      #{cart.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(cart.created_at), "MMMM dd, yyyy h:mma", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{cart.customer_name || "—"}</p>
                        {cart.customer_email && (
                          <p className="text-xs text-muted-foreground">{cart.customer_email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {cart.customer_phone ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{cart.customer_phone}</span>
                          <button
                            onClick={(e) => openWhatsApp(cart.customer_phone, e)}
                            className="text-green-500 hover:text-green-600"
                            title="WhatsApp"
                          >
                            <WhatsAppIcon className="h-5 w-5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-3 h-3 rounded-full ${emailDot(cart.email_recovery_status)}`} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={cart.recovered ? "default" : "destructive"}>
                        {cart.recovered ? "✅ Recuperado" : "🛒 Abandonado"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-border">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(1)}>
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {getPageNumbers().map((p, i) =>
                p < 0 ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={page === p ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AbandonedCarts;
