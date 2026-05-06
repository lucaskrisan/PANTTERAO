import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface UpsellOfferDialogProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  onSaved: () => void;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

const UpsellOfferDialog = ({ open, onClose, productId, onSaved }: UpsellOfferDialogProps) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("Oferta especial por tempo limitado!");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    supabase
      .from("products")
      .select("id, name, price")
      .eq("active", true)
      .eq("user_id", user.id)
      .neq("id", productId)
      .then(({ data }) => setProducts(data || []));
  }, [open, productId, user?.id]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const discount = Number(discountPercent) || 0;
  const finalPrice = selectedProduct
    ? Math.round(selectedProduct.price * (1 - discount / 100) * 100) / 100
    : 0;

  const handleSave = async () => {
    if (!selectedProductId) {
      toast.error("Selecione um produto");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("upsell_offers" as any).insert({
      product_id: productId,
      upsell_product_id: selectedProductId,
      title: title || selectedProduct?.name || "",
      description,
      discount_percent: discount,
      user_id: user?.id,
    });
    if (error) {
      toast.error("Erro ao adicionar upsell");
      console.error(error);
    } else {
      toast.success("Upsell adicionado!");
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  const handleClose = () => {
    setSelectedProductId("");
    setTitle("");
    setDescription("Oferta especial por tempo limitado!");
    setDiscountPercent("0");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar upsell pós-compra</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <Label className="text-right text-sm">Produto</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — R$ {p.price.toFixed(2).replace(".", ",")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <Label className="text-right text-sm">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do produto" />
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <Label className="text-right text-sm">Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <Label className="text-right text-sm">Desconto %</Label>
            <Input
              type="number"
              min="0"
              max="90"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              className="w-24"
            />
          </div>

          {selectedProduct && (
            <div className="mt-4 border-2 border-dashed border-border rounded-lg p-4">
              <Label className="text-sm text-muted-foreground mb-2 block">Pré-visualização</Label>
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 space-y-2">
                <p className="text-xs font-bold text-primary uppercase tracking-wide">
                  🎁 Oferta exclusiva para você!
                </p>
                <p className="font-semibold text-foreground">
                  {title || selectedProduct.name}
                </p>
                <p className="text-sm text-muted-foreground">{description}</p>
                <div className="flex items-center gap-2">
                  {discount > 0 && (
                    <span className="text-sm line-through text-muted-foreground">
                      R$ {selectedProduct.price.toFixed(2).replace(".", ",")}
                    </span>
                  )}
                  <span className="text-lg font-bold text-primary">
                    R$ {finalPrice.toFixed(2).replace(".", ",")}
                  </span>
                  {discount > 0 && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      -{discount}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpsellOfferDialog;
