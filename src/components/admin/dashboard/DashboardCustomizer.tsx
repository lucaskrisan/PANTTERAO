import { memo, useState, useCallback } from "react";
import { Settings2, GripVertical, Save, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { LucideIcon } from "lucide-react";

export interface MetricConfig {
  key: string;
  label: string;
  icon: LucideIcon;
}

interface Props {
  allMetrics: MetricConfig[];
  visibleMetrics: string[];
  metricsOrder: string[];
  onSave: (visible: string[], order: string[]) => void;
  saving?: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

const DashboardCustomizer = memo(function DashboardCustomizer({
  allMetrics,
  visibleMetrics,
  metricsOrder,
  onSave,
  saving,
  editing,
  onEditingChange,
}: Props) {
  const [localVisible, setLocalVisible] = useState<string[]>(visibleMetrics);
  const [localOrder, setLocalOrder] = useState<string[]>(metricsOrder);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const handleStartEditing = useCallback(() => {
    setLocalVisible([...visibleMetrics]);
    setLocalOrder([...metricsOrder]);
    onEditingChange(true);
  }, [visibleMetrics, metricsOrder, onEditingChange]);

  const handleCancel = useCallback(() => {
    onEditingChange(false);
  }, [onEditingChange]);

  const toggleMetric = (key: string) => {
    setLocalVisible((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newOrder = [...localOrder];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(idx, 0, moved);
    setLocalOrder(newOrder);
    setDragIdx(idx);
  };

  const handleDragEnd = () => setDragIdx(null);

  const handleSave = () => {
    onSave(localVisible, localOrder);
    onEditingChange(false);
  };

  const orderedMetrics = localOrder
    .map((key) => allMetrics.find((m) => m.key === key))
    .filter(Boolean) as MetricConfig[];

  allMetrics.forEach((m) => {
    if (!orderedMetrics.find((om) => om.key === m.key)) {
      orderedMetrics.push(m);
    }
  });

  // Toggle button for header
  if (!editing) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-9 gap-2 text-muted-foreground hover:text-foreground"
        onClick={handleStartEditing}
      >
        <Pencil className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-xs">Editar layout</span>
      </Button>
    );
  }

  // Inline sidebar panel
  return (
    <div className="w-[200px] flex-shrink-0 flex flex-col h-fit sticky top-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Settings2 className="w-4 h-4 text-primary" />
          Métricas
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Metric list */}
      <div className="space-y-1">
        {orderedMetrics.map((metric, idx) => {
          const isVisible = localVisible.includes(metric.key);
          const Icon = metric.icon;
          return (
            <div
              key={metric.key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs transition-all cursor-grab active:cursor-grabbing ${
                dragIdx === idx
                  ? "border-primary bg-primary/10 scale-[1.02]"
                  : isVisible
                  ? "border-border bg-card hover:bg-muted/40"
                  : "border-border/50 bg-muted/20 opacity-50"
              }`}
            >
              <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <Icon className={`w-3 h-3 flex-shrink-0 ${isVisible ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`flex-1 truncate ${isVisible ? "text-foreground" : "text-muted-foreground"}`}>
                {metric.label}
              </span>
              <Switch
                checked={isVisible}
                onCheckedChange={() => toggleMetric(metric.key)}
                className="scale-75"
              />
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-1.5">
        <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 gap-1.5 h-8 text-xs">
          <Save className="w-3 h-3" />
          {saving ? "..." : "Salvar"}
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} className="h-8 text-xs px-3">
          Cancelar
        </Button>
      </div>
    </div>
  );
});

export default DashboardCustomizer;
