import { memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";

interface BumpProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

interface OrderBump {
  id: string;
  call_to_action: string;
  title: string;
  description: string;
  use_product_image: boolean;
  bump_product: BumpProduct;
}

interface Props {
  bumps: OrderBump[];
  selectedBumps: Set<string>;
  onToggle: (bumpId: string) => void;
  installments?: string;
  isUSD?: boolean;
}

const OrderBumps = memo(function OrderBumps({ bumps, selectedBumps, onToggle, installments = "1", isUSD = false }: Props) {
  if (bumps.length === 0) return null;

  const fmt = (v: number) =>
    isUSD ? `$${v.toFixed(2)}` : `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <div className="space-y-3">
      {bumps.map((bump) => (
        <div
          key={bump.id}
          onClick={() => onToggle(bump.id)}
          className={`border-2 border-dashed rounded-lg overflow-hidden cursor-pointer transition-all ${
            selectedBumps.has(bump.id)
              ? "border-[#007185] bg-[#F7FAFA]"
              : "border-[#D5D9D9] bg-white"
          }`}
        >
          <div className="bg-[#FFF8E1] text-[#B12704] text-center text-xs font-bold py-2 uppercase tracking-wide">
            {bump.call_to_action}
          </div>
          <div className="flex items-start gap-3 p-4">
            <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
              <span className="text-[#B12704] text-lg leading-none">➜</span>
              <Checkbox
                checked={selectedBumps.has(bump.id)}
                className="border-[#007185] data-[state=checked]:bg-[#007185] pointer-events-none"
                tabIndex={-1}
              />
            </div>
            {bump.use_product_image && bump.bump_product?.image_url && (
              <img
                src={bump.bump_product.image_url}
                alt=""
                className="w-14 h-14 rounded-md object-contain bg-[#F7FAFA] p-1 shrink-0 border border-[#D5D9D9]"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <strong className="text-[#007185] underline">
                  {bump.title || bump.bump_product?.name}:
                </strong>{" "}
                <span className="text-[#0F1111]">{bump.description}</span>
                {bump.bump_product?.price && (
                  <span className="text-[#565959]">
                    {" "}— {isUSD ? "Add to order" : "Adicionar a compra"} ·{" "}
                    {!isUSD && installments !== "1"
                      ? `${installments}x de ${fmt(bump.bump_product.price / Number(installments || 1))}`
                      : fmt(bump.bump_product.price)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

export default OrderBumps;
