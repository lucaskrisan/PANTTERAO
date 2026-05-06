import {
  BookOpen,
  Mail,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Settings,
  LogOut,
  CreditCard,
  GraduationCap,
  ChevronDown,
  Crown,
  Wallet,
  Bell,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  ShieldBan,
  Webhook,
  Smartphone,
  Globe,
  Zap,
  User,
  Paintbrush,
  Key,
  Activity,
  TrendingUp,
  Tag,
  ClipboardList,
  Sparkles,
  Beaker,
  Cpu,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import PwaInstallBanner from "./PwaInstallBanner";
import { useCollaboratorPermissions } from "@/hooks/useCollaboratorPermissions";
import { urlToPermissionKey, isCollaboratorDefaultUrl } from "@/lib/collaboratorPermissions";

/* ── Seções do menu ────────────────────────────────── */

// 0. GINCANA (Colaboradores e Admins)
const gincanaItems = [
  { title: "Marketplace", url: "/admin/marketplace", icon: ShoppingCart },
  { title: "Minhas Comissões", url: "/admin/minhas-comissoes", icon: TrendingUp },
];

// "Meu Canal" — área pessoal do colaborador
const meuCanalItems = [
  { title: "Produtos da loja", url: "/admin/products", icon: Package },
  { title: "Meu WhatsApp", url: "/admin/whatsapp", icon: MessageSquare },
  { title: "Minha Conta", url: "/admin/my-account", icon: User },
];

// 1. PRINCIPAL — operações diárias, acesso imediato
const principalItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Vendas", url: "/admin/orders", icon: ShoppingCart },
  { title: "Produtos", url: "/admin/products", icon: Package },
  { title: "Clientes", url: "/admin/customers", icon: Users },
];

// 2. VENDAS — ferramentas de conversão e receita
const vendasItems = [
  { title: "Checkouts", url: "/admin/settings", icon: Paintbrush },
  { title: "Carrinhos Abandonados", url: "/admin/abandoned", icon: ShoppingCart },
  { title: "Upsell", url: "/admin/upsell", icon: Zap },
  { title: "Cupons", url: "/admin/coupons", icon: Tag },
];

// 3. CONTEÚDO — entrega e engajamento
const conteudoItems = [
  { title: "Área de Membros", url: "/admin/courses", icon: GraduationCap },
  { title: "Avaliações", url: "/admin/reviews", icon: MessageCircle },
];

// 4. ANÁLISE — dados e relatórios
const analiseItems = [
  { title: "Analytics", url: "/admin/analytics", icon: Activity },
  { title: "Métricas", url: "/admin/metrics", icon: TrendingUp },
  { title: "Financeiro", url: "/admin/financeiro", icon: Wallet },
];

// 5. MARKETING — ferramentas de tração e apps
const marketingItems = [
  { title: "Apps", url: "/admin/integrations", icon: Zap },
  { title: "WhatsApp", url: "/admin/whatsapp", icon: MessageSquare },
  { title: "Pixels Espelho", url: "/admin/pixel-mirrors", icon: Zap },
  { title: "Testes A/B", url: "/admin/ab-tests", icon: Beaker },
];

// 6. CONFIGURAÇÕES — collapsible, menos frequente
const configItems = [
  { title: "Gateways", url: "/admin/gateway-management", icon: CreditCard },
  { title: "Domínios", url: "/admin/domains", icon: Globe },
  { title: "Webhook", url: "/admin/webhooks", icon: Webhook },
  { title: "Notificações", url: "/admin/notifications", icon: Bell },
  { title: "Minha conta", url: "/admin/my-account", icon: User },
];

// Item exclusivo super_admin dentro de config
const configSuperAdminOnly = [];

// 7. SUPER ADMIN — organizado por seções
const superAdminAutomacao = [
  { title: "Nina IA", url: "/admin/maria-ia", icon: Sparkles },
  { title: "Central de E-mails", url: "/admin/email-templates", icon: Mail },
  { title: "Controle de Carrinhos", url: "/admin/cart-control", icon: ShoppingCart },
  { title: "Saúde de Entregas", url: "/admin/delivery-health", icon: Activity },
];

const superAdminGestao = [
  { title: "Revisão Produtos", url: "/admin/product-review", icon: ShieldCheck },
  { title: "Verificação Produtores", url: "/admin/verification-review", icon: User },
  { title: "Painel Plataforma", url: "/admin/platform", icon: Crown },
  { title: "Colaboradores (Admin)", url: "/admin/colaboradores", icon: Users },
  { title: "Gestão de Saques", url: "/admin/gestao-saques", icon: Wallet },
  { title: "Billing", url: "/admin/billing", icon: Wallet },
];

const superAdminSeguranca = [
  { title: "Blacklist", url: "/admin/blacklist", icon: ShieldBan },
  { title: "API Keys", url: "/admin/api-keys", icon: Key },
  { title: "Fiscalizar", url: "/admin/health", icon: ShieldCheck },
];

const superAdminRecursos = [
  { title: "Roadmap", url: "/admin/roadmap", icon: ClipboardList },
  { title: "Manual Técnico", url: "/admin/manual", icon: BookOpen },
];

/* ── Componente ────────────────────────────────────── */

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user, isSuperAdmin, isCollaborator } = useAuth();
  const { permissions } = useCollaboratorPermissions(user?.id, isCollaborator && !isSuperAdmin);
  const isPureCollaborator = isCollaborator && !isSuperAdmin;
  const [configOpen, setConfigOpen] = useState(() =>
    configItems.some((item) => location.pathname === item.url)
  );

  // Filtra itens conforme permissões do colaborador (super_admin vê tudo)
  const filterByPerm = (items: { title: string; url: string; icon: any }[]) => {
    if (isSuperAdmin) return items;
    if (isCollaborator) {
      return items.filter((it) => {
        if (it.url === "/admin") return false;
        if (isCollaboratorDefaultUrl(it.url)) return true;
        const key = urlToPermissionKey(it.url);
        return key ? permissions?.[key] === true : false;
      });
    }
    // Producers (non-collaborators) see standard items, but NEVER marketplace/meu-canal items
    return items.filter(it =>
      !gincanaItems.some(g => g.url === it.url) &&
      !meuCanalItems.some(g => g.url === it.url)
    );
  };

  // Esconde grupos inteiros para colaborador puro (área limpa, foco em vendas)
  const isPureCollab = isPureCollaborator;

  const renderItems = (rawItems: { title: string; url: string; icon: any }[]) => {
    const items = filterByPerm(rawItems);
    if (items.length === 0) return null;
    return (
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild>
              <NavLink
                to={item.url}
                end={item.url === "/admin"}
                className="hover:bg-sidebar-accent/60 rounded-md transition-colors"
                activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold"
              >
                <item.icon className="mr-3 h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-sm">{item.title}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  };

  const renderSectionLabel = (label: string) =>
    !collapsed ? (
      <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50 px-1">
        {label}
      </span>
    ) : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed ? (
              <div className="flex items-center gap-2.5 px-1 py-3">
                <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-xs font-bold shadow-lg">
                  P
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-display font-bold text-sidebar-accent-foreground text-sm leading-tight">
                    PanteraPay
                  </span>
                  <span className="text-[10px] text-sidebar-foreground truncate max-w-[130px]">
                    {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Produtor"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-2">
                <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-xs font-bold">
                  P
                </div>
              </div>
            )}
          </SidebarGroupLabel>
        </SidebarGroup>

        {/* 0. GINCANA (Visible only to Collaborators and Super Admins) */}
        {(isSuperAdmin || isCollaborator) && (
          <SidebarGroup>
            <SidebarGroupLabel>{renderSectionLabel("Gincana de Vendas")}</SidebarGroupLabel>
            <SidebarGroupContent>{renderItems(gincanaItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* 0.5 MEU CANAL — apenas para colaborador puro */}
        {isPureCollab && (
          <SidebarGroup>
            <SidebarGroupLabel>{renderSectionLabel("Meu Canal")}</SidebarGroupLabel>
            <SidebarGroupContent>{renderItems(meuCanalItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* 1. PRINCIPAL */}
        <SidebarGroup>
          <SidebarGroupLabel>{renderSectionLabel("Principal")}</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(principalItems)}</SidebarGroupContent>
        </SidebarGroup>

        {/* 2. VENDAS */}
        <SidebarGroup>
          <SidebarGroupLabel>{renderSectionLabel("Vendas")}</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(vendasItems)}</SidebarGroupContent>
        </SidebarGroup>

        {/* 3. CONTEÚDO (oculto para colaborador puro) */}
        {!isPureCollab && (
          <SidebarGroup>
            <SidebarGroupLabel>{renderSectionLabel("Conteúdo")}</SidebarGroupLabel>
            <SidebarGroupContent>{renderItems(conteudoItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* 4. ANÁLISE */}
        <SidebarGroup>
          <SidebarGroupLabel>{renderSectionLabel("Análise")}</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(analiseItems)}</SidebarGroupContent>
        </SidebarGroup>

        {/* 5. MARKETING (oculto para colaborador puro) */}
        {!isPureCollab && (
          <SidebarGroup>
            <SidebarGroupLabel>{renderSectionLabel("Marketing")}</SidebarGroupLabel>
            <SidebarGroupContent>{renderItems(marketingItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* 6. CONFIGURAÇÕES (oculto para colaborador puro) */}
        {!isPureCollab && (
          <SidebarGroup>
            <SidebarGroupLabel>{renderSectionLabel("Geral")}</SidebarGroupLabel>
            <SidebarGroupContent>
              {collapsed ? (
                renderItems([...configItems, ...(isSuperAdmin ? configSuperAdminOnly : [])])
              ) : (
                <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-sidebar-accent/60 transition-colors text-sm text-sidebar-foreground">
                    <Settings className="h-4 w-4 mr-1 shrink-0" />
                    <span>Configurações</span>
                    <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform duration-200 ${configOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-2 mt-1">
                    {renderItems([...configItems, ...(isSuperAdmin ? configSuperAdminOnly : [])])}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* 6. SUPER ADMIN — seções organizadas */}
        {isSuperAdmin && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>
                {!collapsed && (
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50 flex items-center gap-1.5 px-1">
                    <Crown className="w-3 h-3 text-checkout-badge" /> Automação
                  </span>
                )}
              </SidebarGroupLabel>
              <SidebarGroupContent>{renderItems(superAdminAutomacao)}</SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>
                {renderSectionLabel("Gestão")}
              </SidebarGroupLabel>
              <SidebarGroupContent>{renderItems(superAdminGestao)}</SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>
                {renderSectionLabel("Segurança")}
              </SidebarGroupLabel>
              <SidebarGroupContent>{renderItems(superAdminSeguranca)}</SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>
                {renderSectionLabel("Recursos")}
              </SidebarGroupLabel>
              <SidebarGroupContent>{renderItems(superAdminRecursos)}</SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <PwaInstallBanner userId={user?.id} collapsed={collapsed} />
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = "/minha-conta"}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60 mb-1"
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            {!collapsed && "Painel do Aluno"}
          </Button>
        )}
        {!collapsed && user && (
          <p className="text-[11px] text-sidebar-foreground/60 truncate px-3 mb-1">{user.email}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground hover:text-destructive hover:bg-sidebar-accent/60"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
