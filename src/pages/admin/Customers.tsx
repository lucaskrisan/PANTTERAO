// @ts-nocheck
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, ShoppingBag, Tag, ExternalLink, User } from "lucide-react";

interface OrderRow {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  metadata: Record<string, any> | null;
  product_id: string | null;
  products: { name: string } | null;
}

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  created_at: string;
  orders: OrderRow[];
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Pago", variant: "default" },
  approved: { label: "Aprovado", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  failed: { label: "Falhou", variant: "destructive" },
  refunded: { label: "Reembolsado", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const Customers = () => {
  const { user, isSuperAdmin } = useAuth();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerRow | null>(null);

  useEffect(() => {
    if (user?.id) loadCustomers();
  }, [user?.id]);

  const loadCustomers = async () => {
    if (!user) return;
    let query = supabase
      .from("customers")
      .select("*, orders(id, amount, status, payment_method, created_at, metadata, product_id, products(name))")
      .order("created_at", { ascending: false });
    if (!isSuperAdmin) query = query.eq("user_id", user.id);
    const { data } = await query;
    setCustomers((data as any) || []);
  };

  const filtered = useMemo(() => customers.filter((c) => {
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || c.cpf?.includes(s);
  }), [customers, search]);

  const getUtms = (meta: Record<string, any> | null) => {
    if (!meta) return null;
    const utms: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      if (meta[key]) utms[key] = meta[key];
    }
    return Object.keys(utms).length > 0 ? utms : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Clientes</h1>
        <span className="text-sm text-muted-foreground">{customers.length} clientes</span>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou CPF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">E-mail</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Telefone</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">CPF</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Pedidos</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Total gasto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const paidOrders = (c.orders || []).filter(
                      (o) => o.status === "paid" || o.status === "approved"
                    );
                    const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.amount), 0);
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => setSelected(c)}
                      >
                        <td className="py-3 px-4 font-medium">{c.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{c.email}</td>
                        <td className="py-3 px-4 text-muted-foreground">{c.phone || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{c.cpf || "—"}</td>
                        <td className="py-3 px-4">{c.orders?.length || 0}</td>
                        <td className="py-3 px-4 font-medium text-primary">
                          R$ {totalSpent.toFixed(2).replace(".", ",")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Customer Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  {selected.name}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-2 text-sm">
                <p><span className="text-muted-foreground">E-mail:</span> {selected.email}</p>
                <p><span className="text-muted-foreground">Telefone:</span> {selected.phone || "—"}</p>
                <p><span className="text-muted-foreground">CPF:</span> <span className="font-mono">{selected.cpf || "—"}</span></p>
                <p><span className="text-muted-foreground">Cliente desde:</span> {new Date(selected.created_at).toLocaleDateString("pt-BR")}</p>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                  <ShoppingBag className="w-4 h-4" />
                  Pedidos ({selected.orders?.length || 0})
                </h3>

                {(!selected.orders || selected.orders.length === 0) ? (
                  <p className="text-muted-foreground text-sm">Nenhum pedido encontrado.</p>
                ) : (
                  <div className="space-y-3">
                    {[...selected.orders]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((order) => {
                        const st = statusMap[order.status] || { label: order.status, variant: "secondary" as const };
                        const utms = getUtms(order.metadata);
                        const bumpIds = order.metadata?.bump_product_ids as string[] | null;

                        return (
                          <Card key={order.id} className="border border-border/60">
                            <CardContent className="p-3 space-y-2">
                              {/* Header */}
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-foreground">
                                  R$ {Number(order.amount).toFixed(2).replace(".", ",")}
                                </span>
                                <Badge variant={st.variant}>{st.label}</Badge>
                              </div>

                              {/* Product */}
                              <p className="text-sm">
                                <span className="text-muted-foreground">Produto:</span>{" "}
                                <span className="font-medium">{order.products?.name || "—"}</span>
                              </p>

                              {/* Bumps */}
                              {bumpIds && bumpIds.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  + {bumpIds.length} order bump{bumpIds.length > 1 ? "s" : ""}
                                </p>
                              )}

                              {/* Method + Date */}
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  {order.payment_method === "pix" ? "PIX" : order.payment_method === "credit_card" ? "Cartão" : order.payment_method}
                                  {order.metadata?.installments && Number(order.metadata.installments) > 1
                                    ? ` ${order.metadata.installments}x`
                                    : ""}
                                </span>
                                <span>{new Date(order.created_at).toLocaleString("pt-BR")}</span>
                              </div>

                              {/* UTMs */}
                              {utms && (
                                <div className="pt-1 border-t border-border/40">
                                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                                    <Tag className="w-3 h-3" /> UTMs
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(utms).map(([key, val]) => (
                                      <Badge key={key} variant="outline" className="text-[10px] font-mono">
                                        {key.replace("utm_", "")}: {val}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Customers;
