// Lista única de permissões disponíveis para colaboradores
// Cada chave corresponde a uma URL liberada na sidebar/admin
// IMPORTANTE: Marketplace, Minhas Comissões, Produtos (read-only) e WhatsApp pessoal
// são SEMPRE liberados — área nativa de trabalho do colaborador. Não aparecem aqui.

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
  url: string;
  description?: string;
}

export const COLLABORATOR_PERMISSIONS: PermissionDef[] = [
  // Operação — visualização útil para fechar a venda
  { key: "orders", label: "Vendas / Pedidos", group: "Operação", url: "/admin/orders", description: "Ver lista de pedidos da loja" },
  { key: "customers", label: "Clientes", group: "Operação", url: "/admin/customers", description: "Consultar histórico de clientes" },
  { key: "abandoned", label: "Carrinhos Abandonados", group: "Operação", url: "/admin/abandoned", description: "Ver carrinhos para recuperação" },
  { key: "coupons", label: "Cupons", group: "Operação", url: "/admin/coupons", description: "Criar/editar cupons de desconto" },

  // Análise — opcional, para colaboradores mais sêniores
  { key: "analytics", label: "Analytics", group: "Análise", url: "/admin/analytics", description: "Métricas e relatórios" },
  { key: "metrics", label: "Métricas", group: "Análise", url: "/admin/metrics", description: "Indicadores de desempenho" },
];

export const PERMISSION_KEYS = COLLABORATOR_PERMISSIONS.map((p) => p.key);

/** URLs que o colaborador SEMPRE pode acessar (área de trabalho dele) */
export const COLLABORATOR_DEFAULT_URLS = [
  "/admin/marketplace",
  "/admin/minhas-comissoes",
  "/admin/products",   // Read-only: precisa saber o que vende
  "/admin/whatsapp",   // Conexão do WhatsApp pessoal dele
  "/admin/my-account", // Minha conta
];

/** Mapeia uma URL para a chave de permissão correspondente (ou null se não restrita) */
export function urlToPermissionKey(url: string): string | null {
  const match = COLLABORATOR_PERMISSIONS.find((p) => p.url === url);
  return match ? match.key : null;
}

/** True se a URL é sempre liberada para colaborador */
export function isCollaboratorDefaultUrl(url: string): boolean {
  return COLLABORATOR_DEFAULT_URLS.includes(url);
}
