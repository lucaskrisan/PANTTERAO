// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  File,
  FileText,
  GitBranch,
  GripVertical,
  Headphones,
  HelpCircle,
  Image,
  MessageSquare,
  Music,
  Plus,
  Save,
  Send,
  Smartphone,
  Tag,
  Trash2,
  Variable,
  Video,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Settings2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import FlowSidebar, { NODE_TYPES, type NodeType } from "./FlowSidebar";
import WhatsAppPreview from "./WhatsAppPreview";
import VariableButtons from "./VariableButtons";

interface TemplateDraft {
  id: string;
  name: string;
  category: string;
  body: string;
  active: boolean;
}

interface FlowNodeData {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  config: Record<string, any>;
  outputs: string[];
}

interface FlowCanvasProps {
  categories: Array<{ value: string; label: string }>;
  isNew?: boolean;
  onBack: () => void;
  onDelete?: () => void;
  onSave: (payload: { template: TemplateDraft; nodes: FlowNodeData[] }) => void;
  saving?: boolean;
  template: TemplateDraft;
  initialNodes?: FlowNodeData[];
}

const INTERNAL_NODE_META = {
  trigger: { label: "Gatilho", icon: Zap },
  delivery: { label: "Entrega", icon: Send },
};

const MESSAGE_TYPES = ["text", "image", "music", "audio", "video", "document"];
const OPTION_TYPES = ["question", "paths"];

const createStarterNodes = (body: string): FlowNodeData[] => [
  {
    id: "trigger-node",
    type: "trigger",
    label: "Disparo",
    x: 180,
    y: 90,
    config: {
      body: "Entrada que inicia a automação.",
      helper: "Escolha a categoria e o momento exato do disparo.",
    },
    outputs: ["message-node"],
  },
  {
    id: "message-node",
    type: "text",
    label: "Mensagem principal",
    x: 470,
    y: 240,
    config: {
      body: body || "Olá {nome}, obrigado por adquirir o {produto}!",
    },
    outputs: ["delivery-node"],
  },
  {
    id: "delivery-node",
    type: "delivery",
    label: "Envio WhatsApp",
    x: 760,
    y: 390,
    config: {
      body: "Entrega automática da mensagem no WhatsApp do cliente.",
    },
    outputs: [],
  },
];

const DotGrid = () => (
  <svg className="pointer-events-none absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern height="24" id="gold-grid" patternUnits="userSpaceOnUse" width="24">
        <circle cx="1" cy="1" fill="hsl(var(--border) / 0.5)" r="1" />
      </pattern>
    </defs>
    <rect fill="url(#gold-grid)" height="100%" width="100%" />
  </svg>
);

const ConnectionLines = ({ 
  nodes, 
  pendingConnection, 
  mousePosition,
  onRemoveConnection
}: { 
  nodes: FlowNodeData[]; 
  pendingConnection: string | null;
  mousePosition: { x: number; y: number } | null;
  onRemoveConnection: (fromId: string, toId: string) => void;
}) => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const connections: Array<{ from: FlowNodeData; to: FlowNodeData }> = [];

  nodes.forEach((node) => {
    (node.outputs || []).forEach((outputId) => {
      const target = nodeMap.get(outputId);
      if (target) connections.push({ from: node, to: target });
    });
  });

  const getSourcePoint = (node: FlowNodeData, outputIndex: number = 0, totalOutputs: number = 1) => {
    const x = node.x + 145; // Center of 290px card
    
    // Horizontal offset if multiple outputs
    const offsetX = totalOutputs > 1 ? (outputIndex - (totalOutputs - 1) / 2) * 30 : 0;
    
    // Calculate node height based on content
    let nodeHeight = 220; // Default base height including header and padding
    
    if (node.type === "paths" || node.type === "question") {
      const optionsCount = (node.config.options || []).length;
      nodeHeight = 200 + (optionsCount * 44);
    } else if (node.type === "wait") {
      nodeHeight = 160;
    } else if (node.config.body && node.config.body.length > 100) {
      nodeHeight = 240;
    } else if (["image", "video"].includes(node.type)) {
      nodeHeight = 240;
    }
    
    // Y position is the bottom of the card - fixed to be consistent with the card UI
    return { x: x + offsetX, y: node.y + nodeHeight - 1 };
  };

  return (
    <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full">
      {connections.map(({ from, to }, index) => {
        const fromOutputs = from.outputs || [];
        const outputIndex = fromOutputs.indexOf(to.id);
        const start = getSourcePoint(from, outputIndex >= 0 ? outputIndex : 0, fromOutputs.length || 1);
        const endX = to.x + 145;
        const endY = to.y;
        
        const distY = Math.abs(endY - start.y);
        const deltaY = Math.max(70, distY * 0.5);

        // Calculate center point of the bezier curve for the delete button
        const midX = (start.x + endX) / 2;
        const midY = (start.y + endY) / 2;

        return (
          <g key={`${from.id}-${to.id}-${index}`} className="group/line pointer-events-auto">
            <path
              d={`M${start.x},${start.y} C${start.x},${start.y + deltaY} ${endX},${endY - deltaY} ${endX},${endY}`}
              fill="none"
              stroke="transparent"
              strokeWidth="15"
              className="cursor-default"
            />
            <path
              d={`M${start.x},${start.y} C${start.x},${start.y + deltaY} ${endX},${endY - deltaY} ${endX},${endY}`}
              fill="none"
              stroke="hsl(var(--gold) / 0.1)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d={`M${start.x},${start.y} C${start.x},${start.y + deltaY} ${endX},${endY - deltaY} ${endX},${endY}`}
              className="transition-all duration-300 group-hover/line:stroke-gold group-hover/line:stroke-[3.5px]"
              fill="none"
              stroke="hsl(var(--gold) / 0.7)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={from.type === "wait" ? "6 4" : "none"}
            />
            
            {/* Delete button at midpoint */}
            <g 
              className="cursor-pointer opacity-0 transition-opacity group-hover/line:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveConnection(from.id, to.id);
              }}
            >
              <circle cx={midX} cy={midY} r="12" fill="hsl(var(--background))" stroke="hsl(var(--destructive)/0.5)" strokeWidth="1" className="shadow-lg" />
              <path 
                d={`M${midX-4},${midY-4} L${midX+4},${midY+4} M${midX+4},${midY-4} L${midX-4},${midY+4}`} 
                stroke="hsl(var(--destructive))" 
                strokeWidth="2" 
                strokeLinecap="round" 
              />
            </g>

            <circle cx={endX} cy={endY} fill="hsl(var(--gold))" r="4.5" className="filter drop-shadow-[0_0_8px_hsl(var(--gold)/0.5)]" />
            <circle cx={start.x} cy={start.y} fill="hsl(var(--gold)/0.8)" r="3" />
          </g>
        );
      })}

      {/* Pending connection line */}
      {pendingConnection && mousePosition && (
        (() => {
          const fromNode = nodeMap.get(pendingConnection);
          if (!fromNode) return null;
          
          const start = getSourcePoint(fromNode);
          const endX = mousePosition.x;
          const endY = mousePosition.y;
          
          const distY = Math.abs(endY - start.y);
          const deltaY = Math.max(70, distY * 0.5);

          return (
            <g>
              <path
                d={`M${start.x},${start.y} C${start.x},${start.y + deltaY} ${endX},${endY - deltaY} ${endX},${endY}`}
                fill="none"
                stroke="hsl(var(--gold) / 0.4)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="5 5"
                className="animate-pulse"
              />
              <circle cx={start.x} cy={start.y} fill="hsl(var(--gold))" r="4" />
              <circle cx={endX} cy={endY} fill="hsl(var(--gold))" r="3" />
            </g>
          );
        })()
      )}
    </svg>
  );
};

const CanvasNode = ({
  connecting,
  node,
  onConnect,
  onDelete,
  onDrag,
  onSelect,
  selected,
  pendingConnection,
}: {
  connecting: boolean;
  node: FlowNodeData;
  onConnect: (id: string) => void;
  onDelete: (id: string) => void;
  onDrag: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
  selected: boolean;
  pendingConnection: string | null;
}) => {
  const meta = NODE_TYPES.find((item) => item.id === node.type) || INTERNAL_NODE_META[node.type] || INTERNAL_NODE_META.trigger;
  const Icon = meta.icon;
  const dragRef = useRef<{ startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);
  const locked = node.type === "trigger" || node.type === "delivery";

  const handleMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      const nextX = dragRef.current.nodeX + (moveEvent.clientX - dragRef.current.startX);
      const nextY = dragRef.current.nodeY + (moveEvent.clientY - dragRef.current.startY);
      onDrag(node.id, nextX, nextY);
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="absolute z-[2]"
      initial={{ opacity: 0, scale: 0.94 }}
      style={{ left: node.x, top: node.y }}
    >
      <div 
        className={`absolute -top-1.5 left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full border border-gold/40 bg-background transition-all ${
          connecting && pendingConnection !== node.id ? "scale-150 border-gold bg-gold shadow-[0_0_10px_hsl(var(--gold))]" : "opacity-0"
        }`}
      />

      <div
        className={`group w-[290px] overflow-hidden rounded-[24px] border bg-card/95 shadow-2xl backdrop-blur transition-all ${
          selected ? "border-gold/70 shadow-[0_0_40px_hsl(var(--gold)/0.16)]" : "border-border/70 hover:border-border/100"
        } ${pendingConnection === node.id ? "ring-2 ring-gold ring-offset-2 ring-offset-background shadow-[0_0_20px_hsl(var(--gold)/0.4)]" : ""} ${connecting && pendingConnection !== node.id ? "hover:border-gold/60 cursor-pointer ring-1 ring-gold/40 bg-gold/5" : ""}`}
        onMouseDown={(event) => {
          if (connecting && pendingConnection !== node.id) {
            event.stopPropagation();
            onSelect(node.id);
          }
        }}
      >
        <div 
          className="flex cursor-grab items-center gap-3 border-b border-border/60 px-4 py-3 active:cursor-grabbing" 
          onMouseDown={handleMouseDown}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border shadow-sm transition-colors ${
            node.type === "wait" ? "border-amber-500/30 bg-amber-500/10 text-amber-500" : "border-gold/20 bg-gold/10 text-gold"
          }`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{node.label}</p>
              {node.type === "wait" && (
                <Badge variant="outline" className="h-4 border-amber-500/30 bg-amber-500/10 px-1 text-[9px] font-bold text-amber-600">
                  TIMER
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{meta.label}</p>
          </div>
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-50" />
          {!locked && (
            <button
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(node.id);
              }}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-3 px-4 py-4">
          <div 
            className="group/content relative cursor-pointer rounded-2xl border border-border/60 bg-background/60 p-3 transition-colors hover:border-gold/40 hover:bg-background/80"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(node.id);
            }}
          >
            {node.type === "wait" ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Tempo de Espera</p>
                  <p className="text-xs text-muted-foreground">Clique para editar o atraso</p>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 line-clamp-4">
                  {node.config.body || "Clique para configurar este bloco."}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-border/10 pt-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Configuração</span>
                  <div className="flex items-center gap-1 text-xs font-semibold text-gold">
                    <span>Editar</span>
                    <FileText className="h-3 w-3" />
                  </div>
                </div>
              </>
            )}
          </div>

          {Array.isArray(node.config.options) && node.config.options.length > 0 && (
            <div className="space-y-2">
              {node.config.options.map((option: string, index: number) => (
                <div key={`${node.id}-option-${index}`} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/10 text-[10px] font-bold text-gold">
                    {index + 1}
                  </span>
                  <span className="text-xs text-muted-foreground">{option}</span>
                </div>
              ))}
            </div>
          )}

          {node.type === "wait" && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-inner">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600">
                    <Clock3 className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Tempo de Espera</span>
                </div>
              </div>
              
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-black text-amber-600">
                  {node.config.waitTime || "5"}
                </span>
                <span className="text-sm font-medium text-amber-600/70">
                  {node.config.waitUnit || "minutos"}
                </span>
              </div>
              
              <p className="mt-2 text-[10px] leading-tight text-amber-600/60">
                O fluxo aguardará este tempo antes de prosseguir para o próximo bloco conectado.
              </p>
            </div>
          )}
        </div>

        <div className="relative flex items-center justify-between border-t border-border/60 px-4 py-3">
          <button
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              pendingConnection === node.id 
                ? "border-gold bg-gold/20 text-gold shadow-[0_0_15px_hsl(var(--gold)/0.3)] scale-105" 
                : node.outputs && node.outputs.length > 0
                ? "border-gold/40 bg-gold/5 text-gold hover:border-gold"
                : "border-border/60 bg-background/60 text-muted-foreground hover:border-gold/35 hover:text-gold"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onConnect(node.id);
            }}
            type="button"
          >
            <Workflow className="h-3.5 w-3.5" />
            {pendingConnection === node.id 
              ? "Aguardando destino..." 
              : node.outputs && node.outputs.length > 0
              ? "Conectado"
              : "Conectar"}
          </button>

          {/* Connection source point visual (absolute centered at bottom) */}
          <div 
            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 bg-background transition-all ${
              pendingConnection === node.id ? "border-gold scale-125 shadow-[0_0_15px_hsl(var(--gold))]" : "border-gold/30 opacity-60"
            }`}
          >
            <div className="h-2.5 w-2.5 rounded-full bg-gold" />
          </div>
          
          <div 
            className={`absolute -bottom-1.5 left-1/2 z-10 flex h-4 w-4 -translate-x-1/2 cursor-crosshair items-center justify-center rounded-full border border-gold/40 bg-background shadow-sm transition-all hover:scale-150 hover:border-gold ${
              pendingConnection === node.id ? "scale-150 border-gold shadow-[0_0_10px_hsl(var(--gold))]" : ""
            }`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onConnect(node.id);
            }}
          >
            <div className="h-2 w-2 rounded-full bg-gold" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Mobile simplified editor fallback (#10)
const MobileEditor = ({
  categories,
  draft,
  onBack,
  onSave,
  saving,
  setDraft,
}: {
  categories: Array<{ value: string; label: string }>;
  draft: TemplateDraft;
  onBack: () => void;
  onSave: () => void;
  saving?: boolean;
  setDraft: React.Dispatch<React.SetStateAction<TemplateDraft>>;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertVariable = (variable: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newBody = draft.body.slice(0, start) + variable + draft.body.slice(end);
      setDraft((d) => ({ ...d, body: newBody }));
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + variable.length, start + variable.length);
      }, 50);
    } else {
      setDraft((d) => ({ ...d, body: d.body + variable }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-card/95 px-4 py-3">
        <button onClick={onBack} className="text-muted-foreground" type="button">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-display text-sm font-semibold text-foreground truncate mx-2">
          {draft.name || "Novo template"}
        </h2>
        <Button size="sm" className="gap-1.5 bg-gold text-background" disabled={saving} onClick={onSave}>
          <Save className="h-3.5 w-3.5" />
          {saving ? "..." : "Salvar"}
        </Button>
      </div>

      <div className="p-4 space-y-5">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ex: Confirmação de compra" />
        </div>

        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={draft.category} onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Textarea
            ref={textareaRef}
            className="min-h-[140px]"
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          />
        </div>

        <VariableButtons onInsert={handleInsertVariable} />

        <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
          <span className="text-sm text-foreground">Ativo</span>
          <Switch checked={draft.active} onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))} />
        </div>

        <WhatsAppPreview body={draft.body} />
      </div>
    </div>
  );
};

const FlowCanvas = ({ categories, isNew, onBack, onDelete, onSave, saving, template, initialNodes }: FlowCanvasProps) => {
  const isMobile = useIsMobile();
  const [draft, setDraft] = useState<TemplateDraft>(template);
  const [nodes, setNodes] = useState<FlowNodeData[]>(() => {
    if (initialNodes && initialNodes.length > 0) return initialNodes;
    return createStarterNodes(template.body);
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [pendingConnection, setPendingConnection] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(template);
    if (initialNodes && initialNodes.length > 0) {
      setNodes(initialNodes);
    } else {
      setNodes(createStarterNodes(template.body));
    }
    // Only auto-select if we don't have nodes already
    if (!initialNodes || initialNodes.length === 0) {
      setSelectedNodeId("message-node");
    }
    setPendingConnection(null);
  }, [template, initialNodes]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const primaryBody = useMemo(() => {
    const firstMessage = nodes.find((node) => MESSAGE_TYPES.includes(node.type));
    return (firstMessage?.config.body || draft.body || "").trim();
  }, [draft.body, nodes]);

  const handleDrag = (id: string, x: number, y: number) => {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, x, y } : node)));
  };

  const handleDeleteNode = (id: string) => {
    setNodes((current) =>
      current
        .filter((node) => node.id !== id)
        .map((node) => ({ ...node, outputs: (node.outputs || []).filter((output) => output !== id) })),
    );
    if (selectedNodeId === id) setSelectedNodeId("");
    if (pendingConnection === id) setPendingConnection(null);
  };

  const handleSelectNode = (id: string) => {
    if (pendingConnection && pendingConnection !== id) {
      setNodes((current) =>
        current.map((node) =>
          node.id === pendingConnection
            ? { ...node, outputs: [...new Set([...(node.outputs || []), id])] }
            : node,
        ),
      );
      setPendingConnection(null);
      toast.success("Nós conectados com sucesso!");
    } else if (!pendingConnection) {
      setSelectedNodeId(id);
    }
  };

  const handleConnect = (id: string) => {
    // If clicking connect on the same node that is already pending, cancel it
    if (pendingConnection === id) {
      setPendingConnection(null);
    } else {
      setPendingConnection(id);
      toast.info("Agora clique no bloco de destino para conectar.");
    }
  };

  const handleRemoveConnection = (fromId: string, toId: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === fromId
          ? { ...node, outputs: (node.outputs || []).filter((id) => id !== toId) }
          : node
      )
    );
    toast.success("Conexão removida");
  };

  const handleAddNode = (type: NodeType) => {
    const anchor = nodes.find((node) => node.id === selectedNodeId) || nodes[nodes.length - 1];
    const nextId = `${type.id}-${Date.now()}`;
    const baseConfigMap = {
      text: { body: "Nova mensagem" },
      image: { body: "Envio de imagem com legenda" },
      music: { body: "Envio de música" },
      audio: { body: "Envio de áudio" },
      video: { body: "Envio de vídeo" },
      document: { body: "Envio de documento" },
      paths: { body: "Defina os caminhos do fluxo", options: ["Se respondeu sim", "Se pediu suporte"] },
      wait: { body: "Aguardar antes do próximo passo", waitTime: "5", waitUnit: "minutos" },
      question: { body: "Qual opção faz mais sentido?", options: ["Quero comprar", "Tenho dúvida"] },
      tags: { body: "Aplicar tag ao contato" },
      variables: { body: "Salvar resposta em variável" },
    };

    const newNode: FlowNodeData = {
      id: nextId,
      type: type.id,
      label: type.label,
      x: anchor ? anchor.x + 320 : 100,
      y: anchor ? anchor.y + 100 : 100,
      config: baseConfigMap[type.id] || { body: "Configuração do bloco" },
      outputs: [],
    };

    setNodes((current) => {
      // If we have a selected node, automatically connect it to the new node
      if (selectedNodeId) {
        return [
          ...current.map((node) =>
            node.id === selectedNodeId ? { ...node, outputs: [...new Set([...(node.outputs || []), nextId])] } : node,
          ),
          newNode,
        ];
      }
      return [...current, newNode];
    });
    
    setSelectedNodeId(nextId);
  };

  const updateSelectedNode = (updater: (node: FlowNodeData) => FlowNodeData) => {
    if (!selectedNode) return;

    setNodes((current) =>
      current.map((node) => {
        if (node.id !== selectedNode.id) return node;
        const updatedNode = updater(node);

        if (node.id === "message-node" && typeof updatedNode.config.body === "string") {
          setDraft((currentDraft) => ({ ...currentDraft, body: updatedNode.config.body }));
        }

        return updatedNode;
      }),
    );
  };

  const updateOption = (index: number, value: string) => {
    updateSelectedNode((node) => ({
      ...node,
      config: {
        ...node.config,
        options: node.config.options.map((option: string, optionIndex: number) =>
          optionIndex === index ? value : option,
        ),
      },
    }));
  };

  const addOption = () => {
    updateSelectedNode((node) => ({
      ...node,
      config: {
        ...node.config,
        options: [...(node.config.options || []), `Nova opção ${(node.config.options || []).length + 1}`],
      },
    }));
  };

  const removeOption = (index: number) => {
    updateSelectedNode((node) => ({
      ...node,
      config: {
        ...node.config,
        options: node.config.options.filter((_: string, optionIndex: number) => optionIndex !== index),
      },
    }));
  };

  // Insert variable at cursor position in the content textarea (#6)
  const handleInsertVariable = (variable: string) => {
    if (!selectedNode) return;
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const currentBody = selectedNode.config.body || "";
      const newBody = currentBody.slice(0, start) + variable + currentBody.slice(end);
      updateSelectedNode((node) => ({ ...node, config: { ...node.config, body: newBody } }));
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + variable.length, start + variable.length);
      }, 50);
    } else {
      updateSelectedNode((node) => ({
        ...node,
        config: { ...node.config, body: (node.config.body || "") + variable },
      }));
    }
  };

  // Test send (#4)
  const handleTestSend = async () => {
    if (!primaryBody.trim()) {
      toast.error("Adicione uma mensagem antes de testar");
      return;
    }

    setSendingTest(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
        .maybeSingle();

      if (!profile?.phone) {
        toast.error("Configure seu telefone em Minha Conta antes de enviar um teste.");
        setSendingTest(false);
        return;
      }

      const { error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          to_number: profile.phone,
          message: primaryBody
            .replace(/\{nome\}/gi, "Teste")
            .replace(/\{produto\}/gi, "Produto Teste")
            .replace(/\{valor\}/gi, "R$ 99,90")
            .replace(/\{link\}/gi, "https://exemplo.com")
            .replace(/\{telefone\}/gi, profile.phone),
        },
      });

      if (error) throw error;
      toast.success("Mensagem de teste enviada para seu WhatsApp!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar teste");
    } finally {
      setSendingTest(false);
    }
  };

  // Mobile fallback (#10)
  if (isMobile) {
    return (
      <MobileEditor
        categories={categories}
        draft={draft}
        onBack={onBack}
        onSave={() => onSave({ template: { ...draft, body: primaryBody }, nodes })}
        saving={saving}
        setDraft={setDraft}
      />
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex flex-col bg-background overflow-hidden"
      initial={{ opacity: 0 }}
    >
      {/* Compact top header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-card/95 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:border-gold/35 hover:text-gold"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate font-display text-sm font-semibold text-foreground">{draft.name || (isNew ? "Novo template" : "Template sem nome")}</h2>
            <Badge className="hidden border-gold/25 bg-gold/10 text-gold lg:inline-flex" variant="outline">
              <Workflow className="mr-1 h-3 w-3" />
              Construtor visual
            </Badge>
            <Badge variant={draft.active ? "default" : "secondary"} className="text-[10px]">{draft.active ? "Ativo" : "Inativo"}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowTemplateSettings(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Configurações</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{showPreview ? "Ocultar preview" : "Preview"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleTestSend}
            disabled={sendingTest}
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{sendingTest ? "Enviando..." : "Testar envio"}</span>
          </Button>

          {onDelete && !isNew && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onDelete} type="button" variant="outline">
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Excluir</span>
            </Button>
          )}

          <Button
            size="sm"
            className="h-8 gap-1.5 border border-gold/20 bg-gold text-xs text-background hover:bg-gold/90"
            disabled={saving}
            onClick={() => onSave({ template: { ...draft, body: primaryBody }, nodes })}
            type="button"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Three-column body */}
      <div className="flex min-h-0 flex-1">
        <FlowSidebar onAddNode={handleAddNode} />

        <div
          ref={containerRef}
          className="scrollbar-premium relative min-w-0 flex-1 overflow-auto bg-background"
          onMouseDown={() => {
            setSelectedNodeId("");
            setPendingConnection(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const typeId = e.dataTransfer.getData("application/reactflow");
            if (!typeId) return;

            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              const x = e.clientX - rect.left + (containerRef.current?.scrollLeft || 0);
              const y = e.clientY - rect.top + (containerRef.current?.scrollTop || 0);
              
              const nodeType = NODE_TYPES.find(t => t.id === typeId);
              if (nodeType) {
                const nextId = `${typeId}-${Date.now()}`;
                const baseConfigMap = {
                  text: { body: "Nova mensagem" },
                  image: { body: "Envio de imagem com legenda" },
                  music: { body: "Envio de música" },
                  audio: { body: "Envio de áudio" },
                  video: { body: "Envio de vídeo" },
                  document: { body: "Envio de documento" },
                  paths: { body: "Defina os caminhos do fluxo", options: ["Se respondeu sim", "Se pediu suporte"] },
                  wait: { body: "Aguardar antes do próximo passo", waitTime: "5", waitUnit: "minutos" },
                  question: { body: "Qual opção faz mais sentido?", options: ["Quero comprar", "Tenho dúvida"] },
                  tags: { body: "Aplicar tag ao contato" },
                  variables: { body: "Salvar resposta em variável" },
                };

                const newNode: FlowNodeData = {
                  id: nextId,
                  type: typeId,
                  label: nodeType.label,
                  x: x - 145, // Center the node on drop
                  y: y - 40,
                  config: baseConfigMap[typeId] || { body: "Configuração do bloco" },
                  outputs: [],
                };

                setNodes(current => [...current, newNode]);
                setSelectedNodeId(nextId);
                toast.success(`${nodeType.label} adicionado ao fluxo`);
              }
            }
          }}
          onMouseMove={(e) => {
            if (pendingConnection) {
              const rect = containerRef.current?.getBoundingClientRect();
              if (rect) {
                setMousePosition({
                  x: e.clientX - rect.left + (containerRef.current?.scrollLeft || 0),
                  y: e.clientY - rect.top + (containerRef.current?.scrollTop || 0),
                });
              }
            } else if (mousePosition) {
              setMousePosition(null);
            }
          }}
        >
          <div className="relative h-full min-h-[760px] w-full min-w-[900px]">
            <DotGrid />
            <ConnectionLines 
              nodes={nodes} 
              pendingConnection={pendingConnection} 
              mousePosition={mousePosition} 
              onRemoveConnection={handleRemoveConnection}
            />

            <div className="pointer-events-none absolute left-4 top-4 z-[3] flex items-center gap-2 rounded-full border border-gold/20 bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-lg backdrop-blur">
              <MessageSquare className="h-3.5 w-3.5 text-gold" />
              {pendingConnection ? "Clique no bloco de destino para finalizar a conexão." : "Arraste pelo topo para mover, clique no conteúdo para editar."}
            </div>

            {nodes.map((node) => (
              <CanvasNode
                connecting={pendingConnection !== null}
                key={node.id}
                node={node}
                onConnect={handleConnect}
                onDelete={handleDeleteNode}
                onDrag={handleDrag}
                onSelect={handleSelectNode}
                selected={selectedNodeId === node.id}
                pendingConnection={pendingConnection}
              />
            ))}
          </div>
        </div>

      </div>

      {/* Floating preview panel (toggle in header) */}
      {showPreview && (
        <div className="absolute right-4 bottom-4 z-[60] w-[300px] rounded-2xl border border-border/60 bg-card/95 p-3 shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Preview WhatsApp</p>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowPreview(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <WhatsAppPreview body={primaryBody} />
        </div>
      )}

      {/* Template settings modal */}
      <Dialog open={showTemplateSettings} onOpenChange={setShowTemplateSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-gold" />
              Configurações do template
            </DialogTitle>
            <DialogDescription>Defina nome, categoria e status da automação.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do template</Label>
              <Input
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ex: Recuperação de checkout"
                value={draft.name}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select onValueChange={(value) => setDraft((current) => ({ ...current, category: value }))} value={draft.category}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Template ativo</p>
                <p className="text-xs text-muted-foreground">Pronto para entrar na automação.</p>
              </div>
              <Switch checked={draft.active} onCheckedChange={(value) => setDraft((current) => ({ ...current, active: value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateSettings(false)}>Fechar</Button>
            <Button
              className="border border-gold/20 bg-gold text-background hover:bg-gold/90"
              onClick={() => setShowTemplateSettings(false)}
            >
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Node editor modal */}
      <Dialog open={!!selectedNode} onOpenChange={(open) => { if (!open) setSelectedNodeId(""); }}>
        <DialogContent className="max-w-lg">
          {selectedNode && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Editar bloco
                  <Badge className="border-gold/25 bg-gold/10 text-gold" variant="outline">{selectedNode.type}</Badge>
                </DialogTitle>
                <DialogDescription>Ajuste o conteúdo deste bloco do fluxo.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto scrollbar-premium pr-1">
                <div className="space-y-2">
                  <Label>Título do bloco</Label>
                  <Input
                    onChange={(event) => updateSelectedNode((node) => ({ ...node, label: event.target.value }))}
                    value={selectedNode.label}
                  />
                </div>

                {(MESSAGE_TYPES.includes(selectedNode.type) || OPTION_TYPES.includes(selectedNode.type) || ["trigger", "delivery", "tags", "variables"].includes(selectedNode.type)) && (
                  <div className="space-y-2">
                    <Label>Conteúdo</Label>
                    <Textarea
                      ref={textareaRef}
                      className="min-h-[160px] scrollbar-premium"
                      onChange={(event) => updateSelectedNode((node) => ({ ...node, config: { ...node.config, body: event.target.value } }))}
                      placeholder="Escreva sua mensagem..."
                      value={selectedNode.config.body || ""}
                    />
                    {MESSAGE_TYPES.includes(selectedNode.type) && (
                      <VariableButtons onInsert={handleInsertVariable} />
                    )}
                  </div>
                )}

                {["image", "music", "audio", "video", "document"].includes(selectedNode.type) && (
                  <div className="space-y-2">
                    <Label>
                      URL da mídia
                      <span className="ml-1 text-xs text-muted-foreground font-normal">
                        ({selectedNode.type === "image" ? "JPG, PNG, WEBP" :
                          selectedNode.type === "video" ? "MP4" :
                          selectedNode.type === "audio" || selectedNode.type === "music" ? "MP3, OGG, M4A" :
                          "PDF, DOCX, etc."})
                      </span>
                    </Label>
                    <Input
                      placeholder="https://exemplo.com/arquivo.jpg"
                      value={selectedNode.config.media_url || ""}
                      onChange={(event) => updateSelectedNode((node) => ({
                        ...node,
                        config: { ...node.config, media_url: event.target.value },
                      }))}
                    />
                  </div>
                )}

                {selectedNode.type === "wait" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Tempo</Label>
                      <Input
                        onChange={(event) => updateSelectedNode((node) => ({ ...node, config: { ...node.config, waitTime: event.target.value } }))}
                        value={selectedNode.config.waitTime || ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade</Label>
                      <Select
                        onValueChange={(value) => updateSelectedNode((node) => ({ ...node, config: { ...node.config, waitUnit: value } }))}
                        value={selectedNode.config.waitUnit || "minutos"}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutos">Minutos</SelectItem>
                          <SelectItem value="horas">Horas</SelectItem>
                          <SelectItem value="dias">Dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {OPTION_TYPES.includes(selectedNode.type) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Opções</Label>
                      <Button className="gap-1.5" onClick={addOption} size="sm" type="button" variant="outline">
                        <Plus className="h-3.5 w-3.5" />
                        Nova
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {(selectedNode.config.options || []).map((option: string, index: number) => (
                        <div key={`${selectedNode.id}-editor-${index}`} className="flex items-center gap-2">
                          <Input onChange={(event) => updateOption(index, event.target.value)} value={option} />
                          <Button
                            onClick={() => removeOption(index)}
                            size="icon"
                            type="button"
                            variant="outline"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedNodeId("")}>Cancelar</Button>
                <Button
                  className="border border-gold/20 bg-gold text-background hover:bg-gold/90"
                  onClick={() => setSelectedNodeId("")}
                >
                  Salvar bloco
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default FlowCanvas;
