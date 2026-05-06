// @ts-nocheck
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Mail, Search, Eye, LayoutTemplate, Shield, ShoppingCart,
  Send, AlertTriangle, Ban, TrendingUp, Clock
} from "lucide-react";
import { format, subDays, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Template Definitions ─────────────────────────── */

interface TemplateInfo {
  id: string;
  name: string;
  category: "auth" | "transactional";
  language?: "pt-BR" | "en" | "both";
  description: string;
  subject: string;
  previewHtml: string;
}

const LOGO_URL = "https://vipltojtcrqatwvzobro.supabase.co/storage/v1/object/public/email-assets/pantera-mascot.png";

const baseStyles = `
  body { margin:0; padding:0; background:#ffffff; font-family:'Inter','Helvetica Neue',Arial,sans-serif; }
  .container { padding:32px 28px; max-width:480px; margin:0 auto; }
  .logo { margin-bottom:24px; }
  h1 { font-family:'Space Grotesk','Inter',Arial,sans-serif; font-size:24px; font-weight:bold; color:#0B0B0D; margin:0 0 20px; }
  .text { font-size:15px; color:#55575d; line-height:1.6; margin:0 0 24px; }
  .btn { display:inline-block; background:#00E676; color:#000; font-size:15px; font-weight:bold; border-radius:8px; padding:14px 28px; text-decoration:none; }
  .footer { font-size:12px; color:#9B9BA3; margin:32px 0 0; }
  .link { color:#00E676; text-decoration:underline; }
  .code { font-family:'JetBrains Mono',Courier,monospace; font-size:28px; font-weight:bold; color:#00E676; margin:0 0 30px; letter-spacing:4px; }
`;

const wrap = (inner: string) => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>${baseStyles}</style></head><body><div class="container"><img src="${LOGO_URL}" width="48" height="48" class="logo" />${inner}</div></body></html>`;

const TEMPLATES: TemplateInfo[] = [
  {
    id: "signup",
    name: "Confirmação de Cadastro",
    category: "auth",
    description: "Enviado quando um novo usuário se cadastra para verificar o e-mail.",
    subject: "Falta um clique para ativar sua conta — PanteraPay",
    previewHtml: wrap(`
      <h1>Bem-vindo à elite digital.</h1>
      <p class="text">Sua conta na <a href="#" class="link"><strong>PanteraPay</strong></a> foi criada com sucesso.</p>
      <p class="text">Confirme o e-mail <a href="#" class="link">usuario@exemplo.com</a> para desbloquear acesso total à plataforma:</p>
      <a href="#" class="btn">Ativar Minha Conta</a>
      <p class="footer">Não reconhece este cadastro? Ignore este e-mail — nenhuma ação será tomada.</p>
    `),
  },
  {
    id: "recovery",
    name: "Redefinição de Senha",
    category: "auth",
    description: "Enviado quando o usuário solicita redefinição de senha.",
    subject: "Solicitação de nova senha — PanteraPay",
    previewHtml: wrap(`
      <h1>Crie sua nova senha agora.</h1>
      <p class="text">Recebemos sua solicitação para redefinir a senha da conta PanteraPay. Clique abaixo para criar uma nova senha segura — o link é válido por tempo limitado.</p>
      <a href="#" class="btn">Redefinir Minha Senha</a>
      <p class="footer">Se você não fez essa solicitação, desconsidere — sua conta permanece protegida.</p>
    `),
  },
  {
    id: "magic-link",
    name: "Link Mágico",
    category: "auth",
    description: "Enviado para login sem senha via link mágico.",
    subject: "Acesso instantâneo à sua conta — PanteraPay",
    previewHtml: wrap(`
      <h1>Seu acesso exclusivo está pronto.</h1>
      <p class="text">Um clique e você está dentro. Use o botão abaixo para entrar na sua conta PanteraPay — sem precisar de senha. O link expira em minutos.</p>
      <a href="#" class="btn">Entrar Agora</a>
      <p class="footer">Não solicitou este acesso? Desconsidere com segurança — nenhuma ação será tomada.</p>
    `),
  },
  {
    id: "invite",
    name: "Convite",
    category: "auth",
    description: "Enviado quando um usuário é convidado para a plataforma.",
    subject: "Convite exclusivo para a PanteraPay",
    previewHtml: wrap(`
      <h1>Você foi selecionado.</h1>
      <p class="text">Alguém da <a href="#" class="link"><strong>PanteraPay</strong></a> confiou em você e liberou seu acesso à plataforma. Aceite o convite abaixo para criar sua conta e começar agora.</p>
      <a href="#" class="btn">Aceitar Convite</a>
      <p class="footer">Não esperava este convite? Ignore com segurança — nenhuma conta será criada.</p>
    `),
  },
  {
    id: "email-change",
    name: "Alteração de E-mail",
    category: "auth",
    description: "Enviado quando o usuário solicita alteração de e-mail.",
    subject: "Confirme seu novo e-mail — PanteraPay",
    previewHtml: wrap(`
      <h1>Confirme a troca de e-mail.</h1>
      <p class="text">Você solicitou a alteração do e-mail da sua conta PanteraPay:</p>
      <p class="text">De <a href="#" class="link"><strong>antigo@exemplo.com</strong></a> → <a href="#" class="link"><strong>novo@exemplo.com</strong></a></p>
      <p class="text">Confirme clicando abaixo. Após a confirmação, o acesso será vinculado ao novo endereço.</p>
      <a href="#" class="btn">Confirmar Novo E-mail</a>
      <p class="footer">Não reconhece essa solicitação? Proteja sua conta imediatamente alterando sua senha.</p>
    `),
  },
  {
    id: "reauthentication",
    name: "Código de Verificação (2FA)",
    category: "auth",
    description: "Enviado para reautenticação com código OTP.",
    subject: "Código de segurança — PanteraPay",
    previewHtml: wrap(`
      <h1>Verificação de segurança.</h1>
      <p class="text">Insira o código abaixo para confirmar que é você. Ele expira em poucos minutos.</p>
      <p class="code">847291</p>
      <p class="footer">Não solicitou este código? Ignore — sua conta continua segura.</p>
    `),
  },
  {
    id: "purchase-confirmation",
    name: "Pedido Confirmado",
    category: "transactional",
    description: "Enviado automaticamente após confirmação de pagamento (Asaas, Pagar.me, Stripe).",
    subject: '✅ Pagamento confirmado — Acesso liberado',
    previewHtml: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Pagamento confirmado.</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Seu acesso já está liberado.</p>
        </div>
        <div style="padding:32px 40px;">
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">Olá <strong>João</strong>,</p>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">Parabéns pela decisão. Seu pagamento foi processado e o acesso ao produto está disponível imediatamente.</p>
          <div style="background:#f9fafb;border-radius:8px;padding:24px;margin:0 0 24px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Produto</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">Curso Premium</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">Investimento</td><td style="padding:8px 0;color:#22c55e;font-size:18px;font-weight:700;text-align:right;border-top:1px solid #e5e7eb;">R$ 297,00</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">Pagamento</td><td style="padding:8px 0;color:#111827;font-size:14px;text-align:right;border-top:1px solid #e5e7eb;">PIX</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">Data</td><td style="padding:8px 0;color:#111827;font-size:14px;text-align:right;border-top:1px solid #e5e7eb;">15 de abril de 2026</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">Pedido</td><td style="padding:8px 0;color:#111827;font-size:12px;text-align:right;border-top:1px solid #e5e7eb;font-family:monospace;">A1B2C3D4</td></tr>
            </table>
          </div>
          <p style="color:#6b7280;font-size:14px;line-height:1.5;margin:0 0 8px;">Dúvidas? Responda este e-mail — estamos prontos para ajudar.</p>
        </div>
        <div style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">Obrigado por confiar na PanteraPay 💚</p>
        </div>
      </div>
    </body></html>`,
  },
  {
    id: "pix-generated",
    name: "PIX Gerado",
    category: "transactional",
    description: "Enviado quando um pagamento PIX é gerado no checkout.",
    subject: "PIX gerado — Finalize em poucos segundos",
    previewHtml: wrap(`
      <h1>Seu PIX está pronto.</h1>
      <p class="text">O pagamento foi gerado com sucesso. Escaneie o QR Code ou copie o código Pix para finalizar — é rápido e seguro.</p>
      <div style="background:#f9fafb;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
        <p style="font-size:14px;color:#6b7280;margin:0 0 8px;">Investimento:</p>
        <p style="font-size:24px;font-weight:bold;color:#22c55e;margin:0;">R$ 97,00</p>
      </div>
      <a href="#" class="btn">Pagar Agora</a>
      <p class="footer">⏱ O PIX expira em 30 minutos. Após o pagamento, seu acesso é liberado automaticamente.</p>
    `),
  },
  {
    id: "pix-reminder",
    name: "Lembrete de PIX",
    category: "transactional",
    description: "Enviado como lembrete para pagamentos PIX pendentes.",
    subject: "⏰ Seu PIX ainda está pendente",
    previewHtml: wrap(`
      <h1>Você está quase lá.</h1>
      <p class="text">Notamos que seu pagamento PIX ainda não foi concluído. O acesso ao produto será liberado imediatamente após a confirmação.</p>
      <a href="#" class="btn">Finalizar Pagamento</a>
      <p class="footer">Já realizou o pagamento? Desconsidere — a confirmação pode levar alguns instantes.</p>
    `),
  },
  {
    id: "access-link",
    name: "Link de Acesso (Pós-Compra)",
    category: "transactional",
    description: "Enviado automaticamente após confirmação do pagamento com link para área de membros.",
    subject: "🔑 Acesso liberado — Entre agora",
    previewHtml: wrap(`
      <h1>Acesso liberado. É só entrar.</h1>
      <p class="text">Seu pagamento foi confirmado e o conteúdo exclusivo já está disponível na área de membros. Clique abaixo para começar.</p>
      <a href="#" class="btn">Acessar Meu Conteúdo</a>
      <p class="footer">Salve este e-mail — você pode usar este link para acessar quando quiser.</p>
    `),
  },
  {
    id: "abandoned-cart",
    name: "Carrinho Abandonado",
    category: "transactional",
    language: "both",
    description: "Enviado para recuperação de carrinhos abandonados no checkout. Bilíngue: BR para produtos em R$, EN para produtos em USD.",
    subject: "Você esqueceu algo no carrinho 🛒",
    previewHtml: wrap(`
      <h1>Reservamos sua vaga.</h1>
      <p class="text">Você iniciou uma compra mas não finalizou. O produto ainda está disponível — mas não garantimos por muito tempo.</p>
      <a href="#" class="btn">Garantir Minha Vaga</a>
      <p class="footer">Vagas limitadas. Após o encerramento, o acesso não poderá ser garantido.</p>
    `),
  },
  {
    id: "purchase-confirmation-en",
    name: "Order Confirmed (USD)",
    category: "transactional",
    language: "en",
    description: "Sent to customers after a successful USD payment via Stripe. Auto-localized from product currency.",
    subject: "✅ Order confirmed — \"Your Product\"",
    previewHtml: wrap(`
      <h1>✅ Order Confirmed!</h1>
      <p class="text">Hi <strong>Customer</strong>, your payment was successfully processed.</p>
      <p class="text"><strong>Product:</strong> Your Product<br/><strong>Amount:</strong> $97.00<br/><strong>Payment:</strong> Credit Card</p>
      <a href="#" class="btn">🚀 Access your purchase</a>
      <p class="footer">Save this email — it confirms your purchase.</p>
    `),
  },
  {
    id: "access-link-en",
    name: "Access Granted (USD)",
    category: "transactional",
    language: "en",
    description: "Sent to USD course buyers (Stripe) with the member-area access link. Also dispatched on manual resend from the admin panel.",
    subject: "🎉 Access granted — \"Your Course\"",
    previewHtml: wrap(`
      <h1>🎉 Your access is ready!</h1>
      <p class="text">Hi <strong>Customer</strong>, your access to <strong>"Your Course"</strong> is ready! Click the button below to dive into the content.</p>
      <a href="#" class="btn">Access Course</a>
      <p class="footer">Save this email — it contains your access link.</p>
    `),
  },
  {
    id: "abandoned-cart-en",
    name: "Cart Recovery (USD)",
    category: "transactional",
    language: "en",
    description: "Sent to USD checkout abandoners. Auto-localized from product currency.",
    subject: "You left something in your cart 🛒",
    previewHtml: wrap(`
      <h1>You left something behind.</h1>
      <p class="text">Hi Customer, we noticed you didn't finish your purchase. Your cart is still waiting for you!</p>
      <a href="#" class="btn">Complete purchase →</a>
      <p class="footer">If you've already completed your purchase, please ignore this email.</p>
    `),
  },
];

/* ── Status helpers ─────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  sent: { label: "📤 Enviado", color: "outline" },
  delivered: { label: "✅ Entregue", color: "secondary" },
  opened: { label: "👁 Aberto", color: "default" },
  clicked: { label: "🔗 Clicado", color: "default" },
  bounced: { label: "❌ Bounce", color: "destructive" },
  failed: { label: "⚠️ Falhou", color: "destructive" },
  complained: { label: "🚫 Spam", color: "destructive" },
  pending: { label: "⏳ Pendente", color: "outline" },
  dlq: { label: "💀 DLQ", color: "destructive" },
  suppressed: { label: "🚫 Suprimido", color: "destructive" },
};

/* ── Page Component ─────────────────────────────────── */

export default function EmailTemplates() {
  const { user } = useAuth();
  const [tab, setTab] = useState("templates");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [previewTemplate, setPreviewTemplate] = useState<TemplateInfo | null>(null);
  const [logSearch, setLogSearch] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState<string>("all");
  const [logPeriod, setLogPeriod] = useState<string>("7d");

  // email_send_log (queue-based)
  const { data: sendLog = [] } = useQuery({
    queryKey: ["email-send-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // email_logs (legacy Resend-based)
  const { data: emailLogs = [] } = useQuery({
    queryKey: ["email-logs-all"],
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

  // suppressed_emails
  const { data: suppressedEmails = [] } = useQuery({
    queryKey: ["suppressed-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppressed_emails")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Filter templates
  const filteredTemplates = TEMPLATES.filter(
    (t) => categoryFilter === "all" || t.category === categoryFilter
  );

  // Period filter for logs
  const periodStart = useMemo(() => {
    if (logPeriod === "24h") return subHours(new Date(), 24);
    if (logPeriod === "7d") return subDays(new Date(), 7);
    if (logPeriod === "30d") return subDays(new Date(), 30);
    return subDays(new Date(), 7);
  }, [logPeriod]);

  // Deduplicate send_log by message_id
  const deduplicatedLog = useMemo(() => {
    const map = new Map<string, any>();
    for (const row of sendLog) {
      const key = row.message_id || row.id;
      const existing = map.get(key);
      if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
        map.set(key, row);
      }
    }
    return Array.from(map.values());
  }, [sendLog]);

  const periodLogs = deduplicatedLog.filter(
    (l) => new Date(l.created_at) >= periodStart
  );

  const filteredLogs = periodLogs.filter((l) => {
    const matchSearch = !logSearch ||
      l.recipient_email?.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.template_name?.toLowerCase().includes(logSearch.toLowerCase());
    const matchStatus = logStatusFilter === "all" || l.status === logStatusFilter;
    return matchSearch && matchStatus;
  });

  // Stats
  const stats = useMemo(() => {
    const total = periodLogs.length;
    const sent = periodLogs.filter((l) => l.status === "sent").length;
    const failed = periodLogs.filter((l) => ["dlq", "failed"].includes(l.status)).length;
    const suppressed = periodLogs.filter((l) => l.status === "suppressed").length;
    return { total, sent, failed, suppressed };
  }, [periodLogs]);

  // Legacy stats
  const legacyStats = useMemo(() => {
    const total = emailLogs.length;
    const delivered = emailLogs.filter((e) => ["delivered", "opened", "clicked"].includes(e.status)).length;
    const bounced = emailLogs.filter((e) => e.status === "bounced").length;
    return { total, delivered, bounced };
  }, [emailLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutTemplate className="h-6 w-6 text-primary" />
          Central de E-mails
        </h1>
        <p className="text-muted-foreground">
          Visualize todos os templates, logs de envio e e-mails suprimidos da plataforma.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><LayoutTemplate className="h-4 w-4 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Templates</p>
                <p className="text-xl font-bold">{TEMPLATES.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg"><Send className="h-4 w-4 text-blue-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Fila ({logPeriod})</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg"><TrendingUp className="h-4 w-4 text-emerald-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Resend (total)</p>
                <p className="text-xl font-bold">{legacyStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg"><AlertTriangle className="h-4 w-4 text-red-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Falhas</p>
                <p className="text-xl font-bold text-destructive">{stats.failed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg"><Ban className="h-4 w-4 text-amber-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Suprimidos</p>
                <p className="text-xl font-bold">{suppressedEmails.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates" className="gap-1.5"><LayoutTemplate className="w-3.5 h-3.5" />Templates</TabsTrigger>
          <TabsTrigger value="queue-log" className="gap-1.5"><Clock className="w-3.5 h-3.5" />Fila de Envio</TabsTrigger>
          <TabsTrigger value="resend-log" className="gap-1.5"><Mail className="w-3.5 h-3.5" />Resend Log</TabsTrigger>
          <TabsTrigger value="suppressed" className="gap-1.5"><Ban className="w-3.5 h-3.5" />Suprimidos</TabsTrigger>
        </TabsList>

        {/* ── TAB: Templates ─────────────────────────── */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                <SelectItem value="auth">🔐 Autenticação</SelectItem>
                <SelectItem value="transactional">📧 Transacionais</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {filteredTemplates.length} template(s)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((t) => (
              <Card key={t.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setPreviewTemplate(t)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {t.category === "auth" ? (
                        <Shield className="h-4 w-4 text-blue-500 shrink-0" />
                      ) : (
                        <ShoppingCart className="h-4 w-4 text-emerald-500 shrink-0" />
                      )}
                      <CardTitle className="text-sm">{t.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.language === "en" && (
                        <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">🌎 EN</Badge>
                      )}
                      {t.language === "both" && (
                        <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/30">🌐 BR/EN</Badge>
                      )}
                      {(!t.language || t.language === "pt-BR") && t.category === "transactional" && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">🇧🇷 BR</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {t.category === "auth" ? "Auth" : "Transacional"}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-1">{t.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="border border-border rounded-lg overflow-hidden bg-white h-32 relative">
                    <iframe
                      srcDoc={t.previewHtml}
                      className="w-full h-full pointer-events-none"
                      title={t.name}
                      sandbox=""
                      style={{ transform: "scale(0.45)", transformOrigin: "top left", width: "222%", height: "222%" }}
                    />
                    <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-colors flex items-center justify-center">
                      <Eye className="h-6 w-6 text-transparent group-hover:text-foreground/60 transition-colors" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    <strong>Assunto:</strong> {t.subject}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── TAB: Queue Log ─────────────────────────── */}
        <TabsContent value="queue-log" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por email ou template..." value={logSearch} onChange={(e) => setLogSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="dlq">DLQ</SelectItem>
                <SelectItem value="suppressed">Suprimidos</SelectItem>
                <SelectItem value="failed">Falhas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={logPeriod} onValueChange={setLogPeriod}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Últimas 24h</SelectItem>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredLogs.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">Nenhum registro na fila para o período selecionado.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.slice(0, 100).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(l.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{l.template_name}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{l.recipient_email}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_CONFIG[l.status]?.color as any || "outline"} className="text-xs">
                          {STATUS_CONFIG[l.status]?.label || l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                        {l.error_message || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Resend Log (Legacy) ─────────────── */}
        <TabsContent value="resend-log" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Histórico de e-mails enviados diretamente via Resend (webhooks de pagamento, lembretes PIX, etc.)
          </p>
          {emailLogs.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">Nenhum e-mail registrado via Resend.</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.slice(0, 100).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(e.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{e.to_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{e.to_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{e.subject}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{e.email_type}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.source || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_CONFIG[e.status]?.color as any || "outline"} className="text-xs">
                          {STATUS_CONFIG[e.status]?.label || e.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Suppressed ─────────────────────── */}
        <TabsContent value="suppressed" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            E-mails bloqueados automaticamente por bounce, reclamação de spam ou descadastramento.
          </p>
          {suppressedEmails.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">Nenhum e-mail suprimido.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppressedEmails.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm font-medium">{s.email}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-xs">{s.reason}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(o) => !o && setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewTemplate?.category === "auth" ? (
                <Shield className="h-5 w-5 text-blue-500" />
              ) : (
                <ShoppingCart className="h-5 w-5 text-emerald-500" />
              )}
              {previewTemplate?.name}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {previewTemplate?.category === "auth" ? "Autenticação" : "Transacional"}
              </Badge>
              <span className="text-xs text-muted-foreground">{previewTemplate?.description}</span>
            </div>
          </DialogHeader>
          <div className="space-y-3 flex-1 min-h-0 overflow-auto">
            <div className="px-3 py-2 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground">Assunto</p>
              <p className="text-sm font-medium text-foreground">{previewTemplate?.subject}</p>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <iframe
                srcDoc={previewTemplate?.previewHtml || ""}
                className="w-full h-[450px] bg-white"
                title="Template preview"
                sandbox=""
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}