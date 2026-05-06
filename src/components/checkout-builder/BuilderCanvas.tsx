// @ts-nocheck
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { BuilderComponent } from "./types";
import ComponentPreview from "./ComponentPreview";

function SortableItem({
  component,
  onRemove,
  onSelect,
  isSelected,
}: {
  component: BuilderComponent;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  isSelected: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: component.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(component.id)}
      className={`group relative border rounded-lg p-3 transition-colors cursor-pointer ${
        isSelected
          ? "border-[#007185] ring-2 ring-[#007185]/20"
          : "border-transparent hover:border-[#D5D9D9]"
      }`}
    >
      <div className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button {...attributes} {...listeners} className="cursor-grab p-0.5 text-[#565959] hover:text-[#0F1111]">
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="absolute -right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(component.id); }}
          className="p-1 rounded text-[#565959] hover:text-[#B12704] hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <ComponentPreview component={component} />
    </div>
  );
}

function DropZone({
  zone,
  components,
  selectedId,
  onRemove,
  onSelect,
  label,
  className,
}: {
  zone: string;
  components: BuilderComponent[];
  selectedId: string | null;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  label: string;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zone });
  const ids = components.map((c) => c.id);

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] rounded-lg border-2 border-dashed transition-colors p-2 ${
        isOver ? "border-[#007185] bg-[#F7FAFA]" : "border-[#D5D9D9]/50"
      } ${className || ""}`}
    >
      {components.length === 0 && (
        <p className="text-xs text-[#007185]/60 text-center py-6">{label}</p>
      )}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {components.map((c) => (
            <SortableItem
              key={c.id}
              component={c}
              onRemove={onRemove}
              onSelect={onSelect}
              isSelected={selectedId === c.id}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

interface BuilderCanvasProps {
  components: BuilderComponent[];
  selectedId: string | null;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  isMobile: boolean;
  productImageUrl?: string | null;
  productName?: string;
}

const BuilderCanvas = ({ components, selectedId, onRemove, onSelect, isMobile, productImageUrl, productName }: BuilderCanvasProps) => {
  const topComponents = components.filter((c) => c.zone === "top").sort((a, b) => a.order - b.order);
  const leftComponents = components.filter((c) => c.zone === "left").sort((a, b) => a.order - b.order);
  const rightComponents = components.filter((c) => c.zone === "right").sort((a, b) => a.order - b.order);

  return (
    <div
      className={`mx-auto rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.05)] overflow-hidden w-full ${isMobile ? "max-w-[375px]" : "max-w-[900px]"}`}
      style={{ backgroundColor: "#F2F4F8", fontFamily: "Arial, sans-serif" }}
    >
      {/* Topbar preview */}
      <div style={{ backgroundColor: "#232F3E" }} className="text-white text-center py-2 text-xs font-bold tracking-wide">
        🛒 Seu pedido está reservado — Complete o checkout!
      </div>
      <div className="h-1" style={{ background: "linear-gradient(90deg, #FFD814, #e77600, #FFD814)" }} />

      {/* White card container */}
      <div className="mx-3 my-4 bg-white rounded-xl shadow-sm">
        <div className="p-4 space-y-3">
          {/* Top zone */}
          <DropZone
            zone="top"
            components={topComponents}
            selectedId={selectedId}
            onRemove={onRemove}
            onSelect={onSelect}
            label="Arraste componentes aqui (topo)"
            className="rounded-lg border-[#D5D9D9]/50"
          />

          {/* Product banner image */}
          {productImageUrl && (
            <div className="rounded-lg bg-[#F7FAFA] overflow-hidden">
              <img src={productImageUrl} alt={productName || ""} className="w-full h-auto max-h-[320px] object-contain mx-auto" />
            </div>
          )}

          {/* Product name + thumbnail */}
          <div className="flex items-center gap-3">
            {productImageUrl && (
              <img src={productImageUrl} alt="" className="w-10 h-10 rounded-md object-contain bg-[#F7FAFA] p-0.5 border border-[#D5D9D9]" />
            )}
            <p className="text-sm font-bold text-[#0F1111]">{productName || "TÍTULO DO PRODUTO"}</p>
          </div>

          {/* Single column layout */}
          <DropZone
            zone="left"
            components={leftComponents}
            selectedId={selectedId}
            onRemove={onRemove}
            onSelect={onSelect}
            label="Arraste componentes aqui"
            className="rounded-lg border-[#D5D9D9]/50 min-h-[200px]"
          />

          {/* Right zone (below on single column) */}
          <DropZone
            zone="right"
            components={rightComponents}
            selectedId={selectedId}
            onRemove={onRemove}
            onSelect={onSelect}
            label="Arraste componentes aqui (inferior)"
            className="rounded-lg border-[#D5D9D9]/50 min-h-[100px]"
          />

          {/* Amazon gold button preview */}
          <div
            className="w-full py-3.5 rounded-lg text-center text-sm font-medium"
            style={{ backgroundColor: "#FFD814", border: "1px solid #FCD200", color: "#0F1111" }}
          >
            Finalizar compra →
          </div>

          {/* Trust footer */}
          <div className="text-center text-[10px] text-[#565959] space-y-1 pb-1">
            <p>🔒 Pagamento seguro · 🛡️ Dados protegidos · 🔐 SSL 256 bits</p>
            <p>Termos de uso · Política de privacidade</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuilderCanvas;
