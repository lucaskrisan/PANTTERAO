import { useDraggable } from "@dnd-kit/core";
import {
  AlignLeft,
  Image,
  ThumbsUp,
  Award,
  LayoutGrid,
  ListOrdered,
  Clock,
  Star,
  Video,
  Facebook,
  FileText,
  MousePointerClick,
} from "lucide-react";
import { COMPONENT_CATALOG, type ComponentType } from "./types";

const iconMap: Record<string, React.ElementType> = {
  AlignLeft, Image, ThumbsUp, Award, LayoutGrid, ListOrdered,
  Clock, Star, Video, Facebook, FileText, MousePointerClick,
};

function DraggablePaletteItem({ type, label, icon }: { type: ComponentType; label: string; icon: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type, fromPalette: true },
  });

  const Icon = iconMap[icon] || AlignLeft;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex flex-col items-center justify-center gap-1.5 p-3 border border-border rounded-lg cursor-grab hover:border-primary hover:bg-primary/5 transition-colors select-none ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <Icon className="w-5 h-5 text-muted-foreground" />
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

const ComponentPalette = () => {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Componentes</p>
        <div className="grid grid-cols-2 gap-2">
          {COMPONENT_CATALOG.map((c) => (
            <DraggablePaletteItem key={c.type} {...c} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComponentPalette;
