import { motion, type PanInfo } from "framer-motion";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import type React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  Globe,
  Server,
  Shield,
  Eye,
  Copy,
  Facebook,
  Plus,
} from "lucide-react";

interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: keyof typeof colorClasses;
  position: { x: number; y: number };
}

interface WorkflowConnection {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 110;

const colorClasses = {
  emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
  blue: "border-blue-400/40 bg-blue-400/10 text-blue-400",
  amber: "border-amber-400/40 bg-amber-400/10 text-amber-400",
  purple: "border-purple-400/40 bg-purple-400/10 text-purple-400",
  indigo: "border-indigo-400/40 bg-indigo-400/10 text-indigo-400",
  rose: "border-rose-400/40 bg-rose-400/10 text-rose-400",
} as const;

const nodeTemplates: Omit<WorkflowNode, "id" | "position">[] = [
  { type: "trigger", title: "Browser Event", description: "fbevents.js no checkout", icon: Globe, color: "emerald" },
  { type: "action", title: "Servidor Panttera", description: "facebook-capi edge function", icon: Server, color: "blue" },
  { type: "action", title: "Pixel Antigo (Browser)", description: "Mantém aprendizado", icon: Eye, color: "amber" },
  { type: "action", title: "Mirror Pixel (CAPI)", description: "Server-side puro", icon: Shield, color: "purple" },
  { type: "action", title: "Meta Ads", description: "Recebe conversões", icon: Facebook, color: "indigo" },
];

const initialNodes: WorkflowNode[] = [
  { id: "browser", type: "trigger", title: "Browser Event", description: "fbevents.js no checkout", icon: Globe, color: "emerald", position: { x: 30, y: 140 } },
  { id: "server", type: "action", title: "Servidor Panttera", description: "facebook-capi edge", icon: Server, color: "blue", position: { x: 310, y: 140 } },
  { id: "old-pixel", type: "action", title: "Pixel Antigo", description: "Browser-only (sem CAPI)", icon: Eye, color: "amber", position: { x: 590, y: 30 } },
  { id: "mirror", type: "action", title: "Mirror Pixel", description: "CAPI-only • domínio invisível", icon: Shield, color: "purple", position: { x: 590, y: 250 } },
  { id: "meta", type: "action", title: "Meta Ads", description: "Categorização limpa", icon: Facebook, color: "indigo", position: { x: 870, y: 140 } },
];

const initialConnections: WorkflowConnection[] = [
  { from: "browser", to: "server", label: "evento" },
  { from: "browser", to: "old-pixel", label: "browser", dashed: true },
  { from: "server", to: "mirror", label: "duplicado" },
  { from: "old-pixel", to: "meta" },
  { from: "mirror", to: "meta" },
];

function ConnectionLine({ from, to, nodes, dashed }: { from: string; to: string; nodes: WorkflowNode[]; dashed?: boolean }) {
  const fromNode = nodes.find((n) => n.id === from);
  const toNode = nodes.find((n) => n.id === to);
  if (!fromNode || !toNode) return null;

  const startX = fromNode.position.x + NODE_WIDTH;
  const startY = fromNode.position.y + NODE_HEIGHT / 2;
  const endX = toNode.position.x;
  const endY = toNode.position.y + NODE_HEIGHT / 2;
  const cp1X = startX + (endX - startX) * 0.5;
  const cp2X = endX - (endX - startX) * 0.5;
  const path = `M${startX},${startY} C${cp1X},${startY} ${cp2X},${endY} ${endX},${endY}`;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeOpacity="0.5"
        strokeDasharray={dashed ? "6 4" : undefined}
      />
      <circle r="3" fill="hsl(var(--primary))">
        <animateMotion dur="3s" repeatCount="indefinite" path={path} />
      </circle>
    </g>
  );
}

export function PixelMirrorWorkflow() {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [connections, setConnections] = useState<WorkflowConnection[]>(initialConnections);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragStartPosition = useRef<{ x: number; y: number } | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [contentSize, setContentSize] = useState(() => {
    const maxX = Math.max(...initialNodes.map((n) => n.position.x + NODE_WIDTH));
    const maxY = Math.max(...initialNodes.map((n) => n.position.y + NODE_HEIGHT));
    return { width: maxX + 60, height: maxY + 60 };
  });

  const handleDragStart = (nodeId: string) => {
    setDraggingNodeId(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (node) dragStartPosition.current = { x: node.position.x, y: node.position.y };
  };

  const handleDrag = (nodeId: string, { offset }: PanInfo) => {
    if (draggingNodeId !== nodeId || !dragStartPosition.current) return;
    const newX = Math.max(0, dragStartPosition.current.x + offset.x);
    const newY = Math.max(0, dragStartPosition.current.y + offset.y);
    flushSync(() => {
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, position: { x: newX, y: newY } } : n)));
    });
    setContentSize((prev) => ({
      width: Math.max(prev.width, newX + NODE_WIDTH + 60),
      height: Math.max(prev.height, newY + NODE_HEIGHT + 60),
    }));
  };

  const handleDragEnd = () => {
    setDraggingNodeId(null);
    dragStartPosition.current = null;
  };

  const addNode = () => {
    const template = nodeTemplates[Math.floor(Math.random() * nodeTemplates.length)];
    const lastNode = nodes[nodes.length - 1];
    const newPosition = lastNode
      ? { x: lastNode.position.x + 260, y: lastNode.position.y }
      : { x: 50, y: 100 };
    const newNode: WorkflowNode = { id: `node-${Date.now()}`, ...template, position: newPosition };

    flushSync(() => {
      setNodes((prev) => [...prev, newNode]);
      if (lastNode) setConnections((prev) => [...prev, { from: lastNode.id, to: newNode.id }]);
    });
    setContentSize((prev) => ({
      width: Math.max(prev.width, newPosition.x + NODE_WIDTH + 60),
      height: Math.max(prev.height, newPosition.y + NODE_HEIGHT + 60),
    }));
    canvasRef.current?.scrollTo({ left: newPosition.x + NODE_WIDTH - (canvasRef.current?.clientWidth || 0) + 100, behavior: "smooth" });
  };

  return (
    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 border-emerald-400/40 bg-emerald-400/10 text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live
          </Badge>
          <h3 className="text-sm font-semibold text-foreground">Fluxo do Mirror Pixel</h3>
        </div>
        <Button size="sm" variant="outline" onClick={addNode} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Adicionar Nó
        </Button>
      </div>

      <div ref={canvasRef} className="relative overflow-auto bg-gradient-to-br from-muted/20 to-background" style={{ height: 460 }}>
        <div className="relative" style={{ width: contentSize.width, height: contentSize.height }}>
          {/* Grid background */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <svg className="pointer-events-none absolute inset-0" width={contentSize.width} height={contentSize.height}>
            {connections.map((c, i) => (
              <ConnectionLine key={i} from={c.from} to={c.to} nodes={nodes} dashed={c.dashed} />
            ))}
          </svg>

          {nodes.map((node) => {
            const Icon = node.icon;
            const isDragging = draggingNodeId === node.id;
            return (
              <motion.div
                key={node.id}
                drag
                dragMomentum={false}
                onDragStart={() => handleDragStart(node.id)}
                onDrag={(_, info) => handleDrag(node.id, info)}
                onDragEnd={handleDragEnd}
                style={{ x: node.position.x, y: node.position.y, width: NODE_WIDTH, transformOrigin: "0 0" }}
                className="absolute cursor-grab"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
                aria-grabbed={isDragging}
              >
                <Card className="overflow-hidden border-border/60 bg-card/90 p-3 shadow-lg backdrop-blur-md transition-shadow hover:shadow-xl">
                  <div className="flex items-start gap-2.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${colorClasses[node.color]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Badge variant="secondary" className="mb-1 h-4 px-1.5 text-[10px] capitalize">
                        {node.type}
                      </Badge>
                      <h4 className="truncate text-sm font-semibold text-foreground">{node.title}</h4>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{node.description}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                    <ArrowRight className="h-3 w-3" />
                    <span>Conectado</span>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-5 py-2.5 text-xs">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            <strong className="text-foreground">{nodes.length}</strong> nós
          </span>
          <span className="flex items-center gap-1.5">
            <ArrowRight className="h-3.5 w-3.5" />
            <strong className="text-foreground">{connections.length}</strong> conexões
          </span>
        </div>
        <span className="text-muted-foreground">Arraste os nós para reposicionar</span>
      </div>
    </Card>
  );
}
