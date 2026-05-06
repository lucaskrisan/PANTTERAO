import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Zap, Plus, Trash2, Loader2, Package, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import UpsellOfferDialog from "@/components/admin/UpsellOfferDialog";

interface UpsellOffer {
  id: string;
  product_id: string;
  upsell_product_id: string;
  title: string;
  description: string;
  discount_percent: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

const Upsell = () => {
  const { user } = useAuth();
  const [offers, setOffers] = useState<UpsellOffer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProductId, setFilterProductId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [{ data: offersData }, { data: productsData }] = await Promise.all([
      supabase.from("upsell_offers").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, price").eq("user_id", user!.id).eq("active", true),
    ]);
    setOffers((offersData as any[]) || []);
    setProducts(productsData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getProductName = (id: string) =>
    products.find((p) => p.id === id)?.name || "Produto removido";

  const getProductPrice = (id: string) =>
    products.find((p) => p.id === id)?.price || 0;

  const toggleActive = async (offer: UpsellOffer) => {
    const { error } = await supabase
      .from("upsell_offers")
      .update({ active: !offer.active } as any)
      .eq("id", offer.id);
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      setOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, active: !o.active } : o))
      );
      toast.success(offer.active ? "Upsell desativado" : "Upsell ativado");
    }
  };

  const deleteOffer = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("upsell_offers").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      setOffers((prev) => prev.filter((o) => o.id !== id));
      toast.success("Upsell excluído");
    }
    setDeletingId(null);
  };

  const handleNewUpsell = () => {
    if (products.length === 0) {
      toast.error("Crie pelo menos um produto antes de configurar upsells");
      return;
    }
    if (!selectedProductId && filterProductId !== "all") {
      setSelectedProductId(filterProductId);
    } else if (products.length > 0) {
      setSelectedProductId(products[0].id);
    }
    setDialogOpen(true);
  };

  const filteredOffers =
    filterProductId === "all"
      ? offers
      : offers.filter((o) => o.product_id === filterProductId);

  const activeCount = offers.filter((o) => o.active).length;
  const totalDiscount =
    offers.length > 0
      ? (offers.reduce((s, o) => s + o.discount_percent, 0) / offers.length).toFixed(0)
      : "0";

  // Products that have at least one upsell
  const productsWithUpsell = new Set(offers.map((o) => o.product_id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Upsell One-Click
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ofertas pós-compra sem reentrada de dados — aumente o ticket médio
          </p>
        </div>
        <Button onClick={handleNewUpsell} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nova Oferta
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de Ofertas</p>
            <p className="text-2xl font-bold font-display text-foreground mt-1">{offers.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ofertas Ativas</p>
            <p className="text-2xl font-bold font-display text-primary mt-1">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Desconto Médio</p>
            <p className="text-2xl font-bold font-display text-foreground mt-1">{totalDiscount}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter + Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-display">Ofertas Configuradas</CardTitle>
            <Select value={filterProductId} onValueChange={setFilterProductId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar por produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Nenhuma oferta de upsell configurada</p>
              <p className="text-xs text-muted-foreground mb-4">
                Crie uma oferta para aumentar o ticket médio após a compra
              </p>
              <Button variant="outline" size="sm" onClick={handleNewUpsell}>
                <Plus className="w-4 h-4 mr-2" />
                Criar primeira oferta
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto Principal</TableHead>
                  <TableHead className="hidden sm:table-cell"></TableHead>
                  <TableHead>Produto Upsell</TableHead>
                  <TableHead className="text-center">Desconto</TableHead>
                  <TableHead className="text-center">Preço Final</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOffers.map((offer) => {
                  const upsellPrice = getProductPrice(offer.upsell_product_id);
                  const finalPrice = Math.round(upsellPrice * (1 - offer.discount_percent / 100) * 100) / 100;
                  return (
                    <TableRow key={offer.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate max-w-[160px]">
                            {getProductName(offer.product_id)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-center">
                        <ArrowRight className="w-4 h-4 text-muted-foreground mx-auto" />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium truncate max-w-[160px]">
                            {offer.title || getProductName(offer.upsell_product_id)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {offer.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {offer.discount_percent > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            -{offer.discount_percent}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-semibold text-primary">
                          R$ {finalPrice.toFixed(2).replace(".", ",")}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={offer.active}
                          onCheckedChange={() => toggleActive(offer)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteOffer(offer.id)}
                          disabled={deletingId === offer.id}
                        >
                          {deletingId === offer.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      {selectedProductId && (
        <UpsellOfferDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setSelectedProductId("");
          }}
          productId={selectedProductId}
          onSaved={loadData}
        />
      )}
    </div>
  );
};

export default Upsell;
