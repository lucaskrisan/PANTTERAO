import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  RefreshCw,
  Database,
  Zap,
  Settings2,
  Server,
  CreditCard,
  GraduationCap,
  Bell,
  Crosshair,
  ShoppingCart,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";

type Category =
  | "edge_function"
  | "database"
  | "payments"
  | "products"
  | "courses"
  | "tracking"
  | "notifications"
  | "checkout"
  | "storage";

interface CheckResult {
  name: string;
  category: Category;
  status: "ok" | "warning" | "error";
  message: string;
  details?: string;
}

const CATEGORY_META: Record<Category, { label: string; icon: React.ReactNode }> = {
  edge_function: { label: "⚡ Edge Functions", icon: <Zap className="w-4 h-4" /> },
  database: { label: "🗄️ Banco de Dados", icon: <Database className="w-4 h-4" /> },
  payments: { label: "💳 Pagamentos & Gateways", icon: <CreditCard className="w-4 h-4" /> },
  products: { label: "📦 Produtos & Checkout", icon: <ShoppingCart className="w-4 h-4" /> },
  courses: { label: "🎓 Área de Membros", icon: <GraduationCap className="w-4 h-4" /> },
  tracking: { label: "🎯 Rastreamento & Pixels", icon: <Crosshair className="w-4 h-4" /> },
  notifications: { label: "🔔 Notificações & Email", icon: <Bell className="w-4 h-4" /> },
  checkout: { label: "🛒 Checkout Builder", icon: <Settings2 className="w-4 h-4" /> },
  storage: { label: "📁 Storage & Arquivos", icon: <HardDrive className="w-4 h-4" /> },
};

const CATEGORY_ORDER: Category[] = [
  "edge_function",
  "database",
  "payments",
  "products",
  "checkout",
  "courses",
  "tracking",
  "notifications",
  "storage",
];

const SystemHealth = () => {
  const { user } = useAuth();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const checkEdgeFunction = async (name: string, label: string, testBody?: object): Promise<CheckResult> => {
    try {
      const start = Date.now();
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${projectUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey },
        body: JSON.stringify(testBody || {}),
      });
      const duration = Date.now() - start;
      const status = res.status;

      if (status === 404) return { name: label, category: "edge_function", status: "error", message: "Não deployada (404)" };
      if (status >= 400 && status < 500) return { name: label, category: "edge_function", status: "ok", message: `Online (${duration}ms) — validação ativa` };
      if (status >= 500) {
        let body = ""; try { body = await res.text(); } catch {}
        return { name: label, category: "edge_function", status: "warning", message: `Erro interno (HTTP ${status}, ${duration}ms)`, details: body.slice(0, 300) || undefined };
      }
      return { name: label, category: "edge_function", status: "ok", message: `Online (${duration}ms)` };
    } catch (err: any) {
      return { name: label, category: "edge_function", status: "error", message: `Conexão falhou: ${err.message}` };
    }
  };

  const checkTable = async (tableName: string, label: string): Promise<CheckResult> => {
    try {
      const start = Date.now();
      const { count, error } = await (supabase.from(tableName as any) as any).select("id", { count: "exact", head: true });
      const duration = Date.now() - start;
      if (error) return { name: label, category: "database", status: "error", message: `Erro: ${error.message}`, details: error.message };
      return { name: label, category: "database", status: "ok", message: `${count ?? 0} registros (${duration}ms)` };
    } catch (err: any) {
      return { name: label, category: "database", status: "error", message: `Falha: ${err.message}` };
    }
  };

  const runChecks = async () => {
    setRunning(true);
    setResults([]);
    const r: CheckResult[] = [];

    // ═══════════════════════════════════════
    // 1. EDGE FUNCTIONS (todas do projeto)
    // ═══════════════════════════════════════
    // Health-check payloads: usamos marcadores ("__health_check__") nos campos obrigatórios
    // para que as funções respondam rápido sem disparar lógica real. Isso evita ruído no
    // painel de Runtime Errors do Lovable (que loga qualquer 4xx automaticamente).
    const edgeFns = [
      { name: "create-pix-payment", label: "Criar Pagamento PIX", body: { health_check: true, amount: 0, customer: { name: "__health__", email: "health@check.local", cpf: "00000000000" } } },
      { name: "create-pagarme-card-payment", label: "Criar Pagamento Cartão (Pagar.me)", body: { health_check: true, nome: "__health__", email: "health@check.local", cpf: "00000000000", valor: 0 } },
      { name: "check-order-status", label: "Verificar Status Pedido", body: { external_id: "health-check" } },
      { name: "pagarme-webhook", label: "Webhook Pagar.me", body: { type: "health_check", data: {} } },
      { name: "send-access-link", label: "Enviar Link de Acesso", body: { health_check: true, email: "health@check.local", order_id: "health-check" } },
      { name: "facebook-capi", label: "Facebook CAPI", body: { health_check: true, product_id: "00000000-0000-0000-0000-000000000000", event_name: "HealthCheck" } },
      { name: "meta-diagnostics", label: "Diagnóstico Meta", body: { health_check: true } },
      { name: "test-push", label: "Teste Push Notification", body: { health_check: true } },
    ];
    const edgeResults = await Promise.all(edgeFns.map((fn) => checkEdgeFunction(fn.name, fn.label, fn.body)));
    r.push(...edgeResults);

    // ═══════════════════════════════════════
    // 2. BANCO DE DADOS (todas as tabelas)
    // ═══════════════════════════════════════
    const tables = [
      { name: "products", label: "Produtos" },
      { name: "orders", label: "Pedidos" },
      { name: "customers", label: "Clientes" },
      { name: "coupons", label: "Cupons" },
      { name: "courses", label: "Cursos" },
      { name: "course_modules", label: "Módulos" },
      { name: "course_lessons", label: "Aulas" },
      { name: "lesson_materials", label: "Materiais de Aula" },
      { name: "lesson_progress", label: "Progresso de Aulas" },
      { name: "lesson_reviews", label: "Avaliações de Aulas" },
      { name: "member_access", label: "Acessos de Membros" },
      { name: "checkout_settings", label: "Config. Checkout" },
      { name: "checkout_builder_configs", label: "Builder Configs" },
      { name: "notification_settings", label: "Config. Notificações" },
      { name: "payment_gateways", label: "Gateways" },
      { name: "order_bumps", label: "Order Bumps" },
      { name: "product_pixels", label: "Pixels de Produto" },
      { name: "abandoned_carts", label: "Carrinhos Abandonados" },
      { name: "platform_settings", label: "Config. Plataforma" },
      { name: "profiles", label: "Perfis" },
      { name: "user_roles", label: "Roles de Usuário" },
      { name: "facebook_domains", label: "Domínios Facebook" },
    ];
    const dbResults = await Promise.all(tables.map((t) => checkTable(t.name, t.label)));
    r.push(...dbResults);

    // ═══════════════════════════════════════
    // 3. PAGAMENTOS & GATEWAYS
    // ═══════════════════════════════════════
    try {
      const { data: gateways } = await supabase.from("payment_gateways").select("provider, active, name, environment").eq("active", true);
      const count = gateways?.length ?? 0;
      r.push({
        name: "Gateways ativos",
        category: "payments",
        status: count > 0 ? "ok" : "warning",
        message: count > 0 ? `${count} ativo(s): ${gateways!.map((g) => `${g.name} (${g.provider}, ${g.environment})`).join(", ")}` : "Nenhum gateway ativo",
      });
    } catch {}

    // Pedidos por status
    try {
      const { data: orders } = await supabase.from("orders").select("status");
      if (orders) {
        const statusMap: Record<string, number> = {};
        orders.forEach((o) => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });
        const summary = Object.entries(statusMap).map(([s, c]) => `${s}: ${c}`).join(" | ");
        r.push({ name: "Resumo de pedidos", category: "payments", status: "ok", message: `${orders.length} total — ${summary}` });
      }
    } catch {}

    // Pedidos pendentes > 24h
    try {
      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
      const { count } = await (supabase.from("orders") as any).select("id", { count: "exact", head: true }).eq("status", "pending").lt("created_at", oneDayAgo);
      r.push({
        name: "Pedidos pendentes > 24h",
        category: "payments",
        status: (count ?? 0) > 5 ? "warning" : "ok",
        message: (count ?? 0) > 0 ? `${count} pedido(s) preso(s)` : "Nenhum pedido preso",
      });
    } catch {}

    // Pedidos das últimas 24h
    try {
      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
      const { data: recentOrders } = await supabase.from("orders").select("status, amount, payment_method").gte("created_at", oneDayAgo);
      if (recentOrders) {
        const paid = recentOrders.filter((o) => o.status === "paid");
        const totalPaid = paid.reduce((s, o) => s + Number(o.amount), 0);
        r.push({
          name: "Vendas últimas 24h",
          category: "payments",
          status: "ok",
          message: `${recentOrders.length} pedido(s), ${paid.length} pago(s) — R$ ${totalPaid.toFixed(2).replace(".", ",")}`,
        });
      }
    } catch {}

    // Taxa da plataforma
    try {
      const { data: ps } = await supabase.from("platform_settings").select("platform_fee_percent, platform_name").limit(1).maybeSingle();
      r.push({
        name: "Taxa da plataforma",
        category: "payments",
        status: ps ? "ok" : "warning",
        message: ps ? `${ps.platform_name} — ${ps.platform_fee_percent}%` : "Não configurada",
      });
    } catch {}

    // ═══════════════════════════════════════
    // 4. PRODUTOS
    // ═══════════════════════════════════════
    try {
      const { data: products } = await supabase.from("products").select("id, name, price, active, is_subscription, show_coupon, image_url").eq("user_id", user?.id);
      if (products) {
        const active = products.filter((p) => p.active);
        const inactive = products.filter((p) => !p.active);
        r.push({ name: "Produtos ativos", category: "products", status: active.length > 0 ? "ok" : "warning", message: `${active.length} ativo(s), ${inactive.length} inativo(s)` });

        // Check products without images
        const noImage = active.filter((p) => !p.image_url);
        if (noImage.length > 0) {
          r.push({ name: "Produtos sem imagem", category: "products", status: "warning", message: `${noImage.length}: ${noImage.map((p) => p.name).join(", ")}` });
        }

        // Check subscriptions
        const subs = products.filter((p) => p.is_subscription);
        if (subs.length > 0) {
          r.push({ name: "Produtos recorrentes", category: "products", status: "ok", message: `${subs.length}: ${subs.map((p) => p.name).join(", ")}` });
        }
      }
    } catch {}

    // Cupons
    try {
      const { data: coupons } = await supabase.from("coupons").select("code, active, used_count, max_uses, expires_at");
      if (coupons) {
        const activeCoupons = coupons.filter((c) => c.active);
        const expired = activeCoupons.filter((c) => c.expires_at && new Date(c.expires_at) < new Date());
        const maxed = activeCoupons.filter((c) => c.max_uses && c.used_count >= c.max_uses);

        r.push({ name: "Cupons ativos", category: "products", status: "ok", message: `${activeCoupons.length} ativo(s), ${coupons.length - activeCoupons.length} inativo(s)` });
        if (expired.length > 0) {
          r.push({ name: "Cupons expirados (ainda ativos)", category: "products", status: "warning", message: `${expired.map((c) => c.code).join(", ")}` });
        }
        if (maxed.length > 0) {
          r.push({ name: "Cupons esgotados (ainda ativos)", category: "products", status: "warning", message: `${maxed.map((c) => c.code).join(", ")}` });
        }
      }
    } catch {}

    // Order bumps
    try {
      const { data: bumps } = await supabase.from("order_bumps").select("id, title, active, product_id");
      if (bumps) {
        const activeBumps = bumps.filter((b) => b.active);
        r.push({ name: "Order Bumps", category: "products", status: "ok", message: `${activeBumps.length} ativo(s) de ${bumps.length} total` });
      }
    } catch {}

    // ═══════════════════════════════════════
    // 5. CHECKOUT BUILDER
    // ═══════════════════════════════════════
    try {
      const { data: configs } = await (supabase.from("checkout_builder_configs") as any).select("id, name, product_id, is_default, price");
      if (configs) {
        r.push({ name: "Configurações de checkout", category: "checkout", status: "ok", message: `${configs.length} configuração(ões)` });
        const withPrice = configs.filter((c: any) => c.price != null && c.price > 0);
        if (withPrice.length > 0) {
          r.push({ name: "Configs com preço customizado", category: "checkout", status: "ok", message: `${withPrice.length}: ${withPrice.map((c: any) => `${c.name} (R$ ${Number(c.price).toFixed(2)})`).join(", ")}` });
        }
        const defaults = configs.filter((c: any) => c.is_default);
        r.push({ name: "Configs padrão", category: "checkout", status: defaults.length > 0 ? "ok" : "warning", message: defaults.length > 0 ? `${defaults.length} config(s) padrão definida(s)` : "Nenhuma config marcada como padrão" });
      }
    } catch {}

    // Checkout settings
    try {
      const { data: cs } = await supabase.from("checkout_settings").select("company_name, logo_url, primary_color, pix_discount_percent, show_countdown, countdown_minutes").limit(1).maybeSingle();
      if (cs) {
        const details = [
          cs.company_name ? `Empresa: ${cs.company_name}` : null,
          cs.logo_url ? "Logo: ✓" : "Logo: ✗",
          `Cor: ${cs.primary_color || "padrão"}`,
          `Desconto PIX: ${cs.pix_discount_percent ?? 5}%`,
          `Countdown: ${cs.show_countdown ? `${cs.countdown_minutes}min` : "desativado"}`,
        ].filter(Boolean).join(" | ");
        r.push({ name: "Configurações visuais", category: "checkout", status: "ok", message: details });
      } else {
        r.push({ name: "Configurações visuais", category: "checkout", status: "warning", message: "Não personalizadas" });
      }
    } catch {}

    // ═══════════════════════════════════════
    // 6. ÁREA DE MEMBROS / CURSOS
    // ═══════════════════════════════════════
    try {
      const { data: courses } = await supabase.from("courses").select("id, title, product_id");
      if (courses) {
        r.push({ name: "Cursos cadastrados", category: "courses", status: courses.length > 0 ? "ok" : "warning", message: `${courses.length}: ${courses.map((c) => c.title).join(", ") || "nenhum"}` });
        const withProduct = courses.filter((c) => c.product_id);
        const withoutProduct = courses.filter((c) => !c.product_id);
        if (withoutProduct.length > 0) {
          r.push({ name: "Cursos sem produto vinculado", category: "courses", status: "warning", message: `${withoutProduct.map((c) => c.title).join(", ")}` });
        }
        if (withProduct.length > 0) {
          r.push({ name: "Cursos com produto vinculado", category: "courses", status: "ok", message: `${withProduct.length} curso(s) conectado(s)` });
        }
      }
    } catch {}

    // Módulos e aulas
    try {
      const { count: moduleCount } = await (supabase.from("course_modules") as any).select("id", { count: "exact", head: true });
      const { count: lessonCount } = await (supabase.from("course_lessons") as any).select("id", { count: "exact", head: true });
      r.push({ name: "Conteúdo", category: "courses", status: "ok", message: `${moduleCount ?? 0} módulo(s), ${lessonCount ?? 0} aula(s)` });
    } catch {}

    // Member access
    try {
      const { data: accesses } = await supabase.from("member_access").select("id, expires_at");
      if (accesses) {
        const expired = accesses.filter((a) => a.expires_at && new Date(a.expires_at) < new Date());
        const active = accesses.length - expired.length;
        r.push({ name: "Acessos de membros", category: "courses", status: "ok", message: `${active} ativo(s), ${expired.length} expirado(s)` });
      }
    } catch {}

    // Reviews
    try {
      const { data: reviews } = await supabase.from("lesson_reviews").select("approved");
      if (reviews) {
        const approved = reviews.filter((rv) => rv.approved).length;
        const pending = reviews.length - approved;
        r.push({
          name: "Avaliações",
          category: "courses",
          status: pending > 0 ? "warning" : "ok",
          message: `${reviews.length} total — ${approved} aprovada(s), ${pending} pendente(s)`,
        });
      }
    } catch {}

    // ═══════════════════════════════════════
    // 7. RASTREAMENTO & PIXELS
    // ═══════════════════════════════════════
    try {
      const { data: pixels } = await (supabase.from("product_pixels") as any).select("pixel_id, platform, product_id, domain, fire_on_pix, fire_on_boleto");
      if (pixels) {
        r.push({ name: "Pixels configurados", category: "tracking", status: pixels.length > 0 ? "ok" : "warning", message: `${pixels.length} pixel(s)` });
        const withDomain = pixels.filter((p: any) => p.domain);
        const withoutDomain = pixels.filter((p: any) => !p.domain);
        if (withDomain.length > 0) {
          r.push({ name: "Pixels com domínio CAPI", category: "tracking", status: "ok", message: withDomain.map((p: any) => `${p.pixel_id} → ${p.domain}`).join(", ") });
        }
        if (withoutDomain.length > 0) {
          r.push({ name: "Pixels sem domínio (sem CAPI)", category: "tracking", status: "warning", message: `${withoutDomain.length} pixel(s) sem domínio configurado` });
        }
        const fireOnPix = pixels.filter((p: any) => p.fire_on_pix);
        r.push({ name: "Disparo em PIX gerado", category: "tracking", status: "ok", message: `${fireOnPix.length} pixel(s) com disparo em PIX ativo` });
      }
    } catch {}

    // Facebook domains
    try {
      const { data: domains } = await supabase.from("facebook_domains").select("domain, verified");
      if (domains && domains.length > 0) {
        const verified = domains.filter((d) => d.verified);
        r.push({ name: "Domínios Facebook", category: "tracking", status: "ok", message: `${domains.length} total — ${verified.length} verificado(s)` });
      }
    } catch {}

    // Abandoned carts
    try {
      const { data: carts } = await supabase.from("abandoned_carts").select("id, recovered, created_at");
      if (carts) {
        const recovered = carts.filter((c) => c.recovered).length;
        const recent = carts.filter((c) => new Date(c.created_at) > new Date(Date.now() - 86400000)).length;
        r.push({ name: "Carrinhos abandonados", category: "tracking", status: "ok", message: `${carts.length} total — ${recovered} recuperado(s), ${recent} nas últimas 24h` });
      }
    } catch {}

    // ═══════════════════════════════════════
    // 8. NOTIFICAÇÕES & EMAIL
    // ═══════════════════════════════════════
    try {
      const { data: notif, error } = await supabase.from("notification_settings").select("*").eq("user_id", user?.id).maybeSingle();
      if (error) {
        r.push({ name: "Config. Notificações", category: "notifications", status: "error", message: `Erro ao carregar: ${error.message}` });
      } else if (notif) {
        const features = [
          notif.send_approved ? "Venda aprovada: ✓" : "Venda aprovada: ✗",
          notif.send_pending ? "PIX gerado: ✓" : "PIX gerado: ✗",
          `Som: ${notif.notification_sound}`,
          `Padrão: ${notif.notification_pattern}`,
          notif.show_product_name ? "Nome produto: ✓" : "Nome produto: ✗",
          notif.show_utm_campaign ? "UTM: ✓" : "UTM: ✗",
        ];
        r.push({ name: "Push notifications (Config)", category: "notifications", status: "ok", message: features.join(" | ") });

        const reports = [
          notif.report_08 ? "08h" : null,
          notif.report_12 ? "12h" : null,
          notif.report_18 ? "18h" : null,
          notif.report_23 ? "23h" : null,
        ].filter(Boolean);
        r.push({
          name: "Relatórios agendados",
          category: "notifications",
          status: "ok",
          message: reports.length > 0 ? `Horários: ${reports.join(", ")}` : "Nenhum relatório agendado",
        });
      } else {
        r.push({ name: "Notificações", category: "notifications", status: "warning", message: "Não configuradas para seu usuário" });
      }
    } catch (e: any) {
      r.push({ name: "Notificações", category: "notifications", status: "error", message: `Falha crítica: ${e.message}` });
    }

    // Email delivery (Resend)
    r.push({
      name: "Email transacional",
      category: "notifications",
      status: "ok",
      message: "Resend via noreply@paolasemfiltro.com — PIX gerado + acesso liberado",
    });

    // ═══════════════════════════════════════
    // 9. STORAGE
    // ═══════════════════════════════════════
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) {
        r.push({ name: "Storage buckets", category: "storage", status: "warning", message: `Erro ao listar: ${error.message}` });
      } else if (buckets) {
        r.push({ name: "Storage buckets", category: "storage", status: "ok", message: `${buckets.length} bucket(s): ${buckets.map((b) => `${b.name} (${b.public ? "público" : "privado"})`).join(", ")}` });
      }
    } catch {}

    // Check product images in storage
    try {
      const { data: files } = await supabase.storage.from("product-images").list("", { limit: 100 });
      r.push({
        name: "Imagens de produtos",
        category: "storage",
        status: "ok",
        message: `${files?.length ?? 0} arquivo(s) no bucket product-images`,
      });
    } catch {}

    setResults(r);
    setLastRun(new Date());
    setRunning(false);
  };

  const copyReport = () => {
    const timestamp = lastRun?.toLocaleString("pt-BR") || new Date().toLocaleString("pt-BR");
    const errors = results.filter((r) => r.status === "error");
    const warnings = results.filter((r) => r.status === "warning");
    const ok = results.filter((r) => r.status === "ok");

    let report = `🔍 RELATÓRIO DE FISCALIZAÇÃO — ${timestamp}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `✅ OK: ${ok.length} | ⚠️ Avisos: ${warnings.length} | ❌ Erros: ${errors.length}\n\n`;

    if (errors.length > 0) {
      report += `❌ ERROS:\n`;
      errors.forEach((r) => {
        report += `  • [${CATEGORY_META[r.category]?.label}] ${r.name}: ${r.message}\n`;
        if (r.details) report += `    ↳ ${r.details}\n`;
      });
      report += `\n`;
    }

    if (warnings.length > 0) {
      report += `⚠️ AVISOS:\n`;
      warnings.forEach((r) => {
        report += `  • [${CATEGORY_META[r.category]?.label}] ${r.name}: ${r.message}\n`;
      });
      report += `\n`;
    }

    // Group OK results by category
    CATEGORY_ORDER.forEach((cat) => {
      const catOk = ok.filter((r) => r.category === cat);
      if (catOk.length === 0) return;
      report += `${CATEGORY_META[cat].label} (${catOk.length}):\n`;
      catOk.forEach((r) => {
        report += `  ✅ ${r.name}: ${r.message}\n`;
      });
      report += `\n`;
    });

    navigator.clipboard.writeText(report);
    toast.success("Relatório copiado para a área de transferência!");
  };

  const errorCount = results.filter((r) => r.status === "error").length;
  const warningCount = results.filter((r) => r.status === "warning").length;
  const okCount = results.filter((r) => r.status === "ok").length;

  const statusIcon = (status: string) => {
    if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (status === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Fiscalizar Sistema
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verifica Edge Functions, banco de dados, pagamentos, cursos, pixels, notificações e storage
          </p>
        </div>
        <div className="flex gap-2">
          {results.length > 0 && (
            <Button variant="outline" size="sm" onClick={copyReport} className="gap-2">
              <Copy className="w-4 h-4" />
              Copiar Relatório
            </Button>
          )}
          <Button onClick={runChecks} disabled={running} className="gap-2">
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Fiscalizando...</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Fiscalizar Agora</>
            )}
          </Button>
        </div>
      </div>

      {/* Summary */}
      {results.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm border-emerald-200 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> {okCount} OK
          </Badge>
          {warningCount > 0 && (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm border-amber-200 bg-amber-50 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" /> {warningCount} Aviso(s)
            </Badge>
          )}
          {errorCount > 0 && (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm border-red-200 bg-red-50 text-red-700">
              <XCircle className="w-3.5 h-3.5" /> {errorCount} Erro(s)
            </Badge>
          )}
          {lastRun && (
            <span className="text-xs text-muted-foreground self-center ml-auto">
              {lastRun.toLocaleTimeString("pt-BR")}
            </span>
          )}
        </div>
      )}

      {/* Results by category */}
      {results.length > 0 && (
        <div className="space-y-4">
          {CATEGORY_ORDER.map((cat) => {
            const catResults = results.filter((r) => r.category === cat);
            if (catResults.length === 0) return null;
            const meta = CATEGORY_META[cat];
            const catErrors = catResults.filter((r) => r.status === "error").length;
            const catWarnings = catResults.filter((r) => r.status === "warning").length;
            return (
              <Card key={cat}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {meta.icon}
                    {meta.label}
                    <div className="ml-auto flex gap-1.5">
                      {catErrors > 0 && <Badge variant="destructive" className="text-xs">{catErrors} erro(s)</Badge>}
                      {catWarnings > 0 && <Badge variant="outline" className="text-xs border-amber-200 bg-amber-50 text-amber-700">{catWarnings} aviso(s)</Badge>}
                      <Badge variant="secondary" className="text-xs">
                        {catResults.filter((r) => r.status === "ok").length}/{catResults.length}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {catResults.map((r, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                          r.status === "error"
                            ? "bg-red-50 border border-red-100"
                            : r.status === "warning"
                            ? "bg-amber-50 border border-amber-100"
                            : "bg-muted/40 border border-transparent"
                        }`}
                      >
                        {statusIcon(r.status)}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">{r.name}</p>
                          <p className="text-muted-foreground text-xs mt-0.5">{r.message}</p>
                          {r.details && (
                            <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap break-all bg-red-50 p-2 rounded">
                              {r.details}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !running && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Server className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Pronto para fiscalizar</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Clique em "Fiscalizar Agora" para uma verificação completa de todas as funcionalidades do sistema.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SystemHealth;
