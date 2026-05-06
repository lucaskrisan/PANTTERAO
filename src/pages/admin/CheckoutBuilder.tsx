import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ArrowLeft, Monitor, Smartphone, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import BuilderCanvas from "@/components/checkout-builder/BuilderCanvas";
import ComponentPalette from "@/components/checkout-builder/ComponentPalette";
import ComponentEditor from "@/components/checkout-builder/ComponentEditor";
import type { BuilderComponent, ComponentType } from "@/components/checkout-builder/types";

const CheckoutBuilder = () => {
  const { productId, configId } = useParams<{ productId: string; configId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkoutName, setCheckoutName] = useState("Checkout A");
  const [isMobile, setIsMobile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("components");
  const [activeDragType, setActiveDragType] = useState<ComponentType | null>(null);
  const [dbConfigId, setDbConfigId] = useState<string | null>(configId || null);
  const [product, setProduct] = useState<{ name: string; image_url: string | null } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getDefaultComponents = (productName: string): BuilderComponent[] => [
    { id: "default-header", type: "header", zone: "left", order: 0, props: { title: productName.toUpperCase() } },
    { id: "default-form", type: "form", zone: "left", order: 1, props: {} },
    { id: "default-button", type: "button", zone: "left", order: 2, props: { text: "Finalizar compra" } },
  ];

  // Load config + product name
  useEffect(() => {
    if (!productId) return;

    const load = async () => {
      // Fetch product name
      const { data: prodData } = await supabase
        .from("products")
        .select("name, image_url")
        .eq("id", productId)
        .single();
      const productName = prodData?.name || "TÍTULO DO PRODUTO";
      setProduct({ name: productName, image_url: prodData?.image_url || null });
      const defaults = getDefaultComponents(productName);

      let loaded = false;
      if (configId) {
        const { data } = await supabase
          .from("checkout_builder_configs")
          .select("*")
          .eq("id", configId)
          .single();
        if (data) {
          setCheckoutName(data.name);
          let layout = (data.layout as any) || [];
          // Always sync header title with product name
          layout = layout.length > 0
            ? layout.map((c: any) => c.type === "header" ? { ...c, props: { ...c.props, title: productName.toUpperCase() } } : c)
            : defaults;
          setComponents(layout);
          setDbConfigId(data.id);
          loaded = true;
        }
      } else {
        const { data: defaultConfig } = await supabase
          .from("checkout_builder_configs")
          .select("*")
          .eq("product_id", productId)
          .eq("is_default", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let chosenConfig = defaultConfig;

        if (!chosenConfig) {
          const { data: latestConfig } = await supabase
            .from("checkout_builder_configs")
            .select("*")
            .eq("product_id", productId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          chosenConfig = latestConfig;
        }

        if (chosenConfig) {
          setCheckoutName(chosenConfig.name);
          let layout = (chosenConfig.layout as any) || [];
          layout = layout.length > 0
            ? layout.map((c: any) => c.type === "header" ? { ...c, props: { ...c.props, title: productName.toUpperCase() } } : c)
            : defaults;
          setComponents(layout);
          setDbConfigId(chosenConfig.id);
          loaded = true;
        }
      }
      if (!loaded) {
        setComponents(defaults);
      }
      setLoading(false);
    };
    load();
  }, [productId, configId]);

  const generateId = () => `comp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.fromPalette) {
      setActiveDragType(data.type);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragType(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overZone = over.id as string;

    // Dropping from palette
    if (activeData?.fromPalette) {
      let zone: "top" | "left" | "right" = "left";
      if (["top", "left", "right"].includes(overZone)) {
        zone = overZone as "top" | "left" | "right";
      } else {
        // over might be a component inside a zone
        const overComp = components.find((c) => c.id === overZone);
        if (overComp) zone = overComp.zone;
      }
      const zoneComponents = components.filter((c) => c.zone === zone);
      const newComponent: BuilderComponent = {
        id: generateId(),
        type: activeData.type,
        zone,
        order: zoneComponents.length,
        props: {},
      };
      setComponents((prev) => [...prev, newComponent]);
      setSelectedId(newComponent.id);
      setActiveTab("config");
      return;
    }

    // Reordering within same zone
    const activeComp = components.find((c) => c.id === active.id);
    const overComp = components.find((c) => c.id === over.id);
    if (activeComp && overComp && activeComp.zone === overComp.zone) {
      const zoneComps = components
        .filter((c) => c.zone === activeComp.zone)
        .sort((a, b) => a.order - b.order);
      const oldIndex = zoneComps.findIndex((c) => c.id === active.id);
      const newIndex = zoneComps.findIndex((c) => c.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(zoneComps, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }));
        setComponents((prev) =>
          prev.map((c) => {
            const updated = reordered.find((r) => r.id === c.id);
            return updated || c;
          })
        );
      }
    }
  };

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const updateComponentProps = useCallback((id: string, props: Record<string, any>) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, props } : c))
    );
  }, []);

  const handleSave = async () => {
    if (!productId || !user) return;
    setSaving(true);
    try {
      if (dbConfigId) {
        const { error } = await supabase
          .from("checkout_builder_configs")
          .update({
            name: checkoutName,
            layout: components as any,
            updated_at: new Date().toISOString(),
          })
          .eq("id", dbConfigId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("checkout_builder_configs")
          .insert({
            product_id: productId,
            name: checkoutName,
            layout: components as any,
            user_id: user.id,
            is_default: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (data) setDbConfigId(data.id);
      }
      toast.success("Checkout salvo!");
    } catch {
      toast.error("Erro ao salvar checkout");
    } finally {
      setSaving(false);
    }
  };

  const selectedComponent = components.find((c) => c.id === selectedId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-muted/30 overflow-hidden z-[40]">
      {/* Top bar */}
      <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4 shrink-0 z-[50]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/products/${productId}/edit`)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Input
            value={checkoutName}
            onChange={(e) => setCheckoutName(e.target.value)}
            className="h-7 w-40 text-sm border-none bg-transparent font-medium px-1"
          />
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
            <button
              onClick={() => setIsMobile(false)}
              className={`p-1 rounded transition-colors ${!isMobile ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMobile(true)}
              className={`p-1 rounded transition-colors ${isMobile ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-primary">✓ Tudo certo!</span>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Salvar checkout
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => {
              const previewUrl = new URL(`https://app.panttera.com.br/checkout/${productId}`);
              if (dbConfigId) previewUrl.searchParams.set("config", dbConfigId);
              window.open(previewUrl.toString(), "_blank");
            }}
          >
            Pré-visualizar <Eye className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      {/* Main area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas Area */}
        <div className="flex-1 overflow-auto bg-muted/30 p-6 flex flex-col items-center">
          <div className="w-full h-fit flex flex-col items-center">
            <BuilderCanvas
              components={components}
              selectedId={selectedId}
              onRemove={removeComponent}
              onSelect={(id) => { setSelectedId(id); setActiveTab("config"); }}
              isMobile={isMobile}
              productImageUrl={product?.image_url || null}
              productName={product?.name || ""}
            />
          </div>
        </div>

        {/* Right panel (Sidebar) */}
        <div className="w-80 border-l border-border bg-card flex flex-col shrink-0 z-40">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full rounded-none bg-transparent border-b border-border h-auto p-0">
              <TabsTrigger
                value="components"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs py-2.5"
              >
                Componentes
              </TabsTrigger>
              <TabsTrigger
                value="links"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs py-2.5"
              >
                Links
              </TabsTrigger>
              <TabsTrigger
                value="config"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs py-2.5"
              >
                Configurações
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto p-4">
              <TabsContent value="components" className="mt-0 focus-visible:outline-none">
                <ComponentPalette />
              </TabsContent>

              <TabsContent value="links" className="mt-0 focus-visible:outline-none">
                <p className="text-xs text-muted-foreground">Links de checkout disponíveis em breve.</p>
              </TabsContent>

              <TabsContent value="config" className="mt-0 focus-visible:outline-none">
                {selectedComponent ? (
                  <ComponentEditor
                    component={selectedComponent}
                    onUpdate={updateComponentProps}
                    onRemove={removeComponent}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Selecione um componente no canvas para editar.</p>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
        <DragOverlay>
          {activeDragType && (
            <div className="bg-card border border-primary rounded-lg px-4 py-2 shadow-lg text-sm text-foreground capitalize">
              {activeDragType}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default CheckoutBuilder;
