import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface OrderBumpDialogProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  onSaved: () => void;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

const OrderBumpDialog = ({ open, onClose, productId, onSaved }: OrderBumpDialogProps) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [callToAction, setCallToAction] = useState("Sim, eu aceito essa oferta especial!");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("Adicionar a compra");
  const [useProductImage, setUseProductImage] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    supabase
      .from("products")
      .select("id, name, price, image_url")
      .eq("active", true)
      .eq("user_id", user.id)
      .neq("id", productId)
      .then(({ data }) => setProducts(data || []));
  }, [open, productId, user?.id]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleSave = async () => {
    if (!selectedProductId) {
      toast.error("Selecione um produto");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("order_bumps").insert({
      product_id: productId,
      bump_product_id: selectedProductId,
      title: title || selectedProduct?.name || "",
      description,
      call_to_action: callToAction,
      use_product_image: useProductImage,
      user_id: user?.id,
    });
    if (error) {
      toast.error("Erro ao adicionar order bump");
    } else {
      toast.success("Order bump adicionado!");
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  const handleClose = () => {
    setSelectedProductId("");
    setTitle("");
    setDescription("Adicionar a compra");
    setCallToAction("Sim, eu aceito essa oferta especial!");
    setUseProductImage(true);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar order bump</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <Label className="text-right text-sm">Produto</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <Label className="text-right text-sm">Call to action</Label>
            <Input value={callToAction} onChange={(e) => setCallToAction(e.target.value)} />
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
            <Label className="text-right text-sm">Imagem</Label>
            <div className="flex items-center gap-2">
              <Switch checked={useProductImage} onCheckedChange={setUseProductImage} />
              <span className="text-sm text-muted-foreground">Exibir imagem do produto</span>
            </div>
          </div>

          {/* Preview - always visible */}
          <div className="mt-4">
            <Label className="text-sm text-muted-foreground mb-2 block">Pré-visualização</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 space-y-2">
              <div className="bg-primary text-primary-foreground text-center text-xs font-bold py-2 rounded uppercase">
                {callToAction}
              </div>
              <div className="flex items-center gap-3 p-2">
                {useProductImage && selectedProduct?.image_url && (
                  <img src={selectedProduct.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                )}
                {!useProductImage || !selectedProduct?.image_url ? (
                  <div className="w-10 h-10 rounded bg-destructive/80 flex items-center justify-center text-destructive-foreground text-lg">▶</div>
                ) : null}
                <div className="flex items-center gap-2">
                  <input type="checkbox" disabled className="w-4 h-4" />
                  <span className="text-sm">
                    <strong className="text-primary">{title || selectedProduct?.name || "Nome do produto"}</strong>{" "}
                    {description} - R$ {selectedProduct ? selectedProduct.price.toFixed(2).replace(".", ",") : "0,00"}
                  </span>
                </div>
              </div>
            </div>
          </div>
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

export default OrderBumpDialog;
