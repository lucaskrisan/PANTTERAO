import { useCallback, useEffect, useMemo, useRef, useState, DragEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Settings as SettingsIcon,
  BarChart3,
  FileText,
  ShoppingCart,
  Link2,
  AlertCircle,
  X,
  GripVertical,
  Trash2,
  Play,
  Pause,
  Copy,
  HelpCircle,
  RefreshCw,
  Zap,
  Loader2,
  Image as ImageIcon,
  MousePointer2,
  TrendingUp,
  Shield,
  MessageSquare,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AbTestTutorial } from "@/components/admin/AbTestTutorial";

// ---------------- Types ----------------

type NodeKind = "config" | "abtest" | "page" | "checkout" | "creative" | "upsell" | "whatsapp";

type ConfigData = { kind: "config"; label: string; testName: string; entryUrl: string; visits: number; clicks?: number; stickyDays?: number; impressions?: number; sales?: number; revenue?: number; chargebacks?: number };
type AbTestData = { kind: "abtest"; label: string; subtitle: string; splits: { label: string; weight: number }[] };
type PageData = { 
  kind: "page"; 
  label: string; 
  subtitle: string; 
  url: string; 
  mirrorPixelId?: string | null;
  paused?: boolean;
  thumbnailUrl?: string | null;
  stats?: { impressions: number; clicks: number; sales: number; revenue: number; chargebacks?: number };
};
type CheckoutData = {
  kind: "checkout";
  label: string;
  subtitle: string;
  productId: string | null;
  offerId: string | null;
  templateId: string | null;
  stats?: { impressions: number; clicks: number; sales: number; revenue: number; chargebacks?: number };
};
type UpsellData = {
  kind: "upsell";
  label: string;
  subtitle: string;
  url: string;
  stats?: { impressions: number; clicks: number; sales: number; revenue: number; chargebacks?: number };
};
type CreativeData = {
  kind: "creative";
  label: string;
  subtitle: string;
  imageUrl?: string;
  utmSource?: string;
  utmContent?: string;
  stats?: { impressions: number; clicks: number; sales: number; revenue: number; chargebacks?: number };

};
type WhatsAppData = {
  kind: "whatsapp";
  label: string;
  subtitle: string;
  delay: number;
  stats?: { sent: number; clicked: number; recovered: number; revenue: number; chargebacks?: number };
};

type FlowNode = Node<any>;

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const REDIRECT_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/ab-redirect`;

// ---------------- Custom Nodes ----------------

function NodeShell({
  color,
  icon,
  title,
  subtitle,
  children,
  inHandle = true,
  outHandle = true,
  nodeId,
  onDelete,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  inHandle?: boolean;
  outHandle?: boolean;
  nodeId?: string;
  onDelete?: (id: string) => void;
}) {
  return (
    <div
      className="rounded-2xl bg-[#0d0f1a] border-[1.5px] border-white/5 shadow-2xl min-w-[240px] max-w-[280px] relative group transition-all duration-300 hover:border-white/10"
      style={{ 
        boxShadow: `0 10px 40px -10px rgba(0,0,0,0.5), 0 0 20px ${color}11`
      }}
    >
      <div className="h-1.5 w-full rounded-t-2xl" style={{ backgroundColor: color }} />
      
      {nodeId && nodeId !== "config" && onDelete && (
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(nodeId); }}
          className="absolute top-3 right-3 h-7 w-7 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-500 hover:text-white z-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      
      {inHandle && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className="!w-4 !h-4 !bg-slate-900 !border-2 !border-slate-500 hover:!border-white hover:!scale-125 transition-all !z-50 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
          style={{ left: -8, top: '50%', transform: 'translateY(-50%)' }}
        />
      )}
      {outHandle && (
        <Handle 
          type="source" 
          position={Position.Right} 
          className="!w-4 !h-4 !bg-slate-900 !border-2 !border-slate-500 hover:!border-white hover:!scale-125 transition-all !z-50 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
          style={{ right: -8, top: '50%', transform: 'translateY(-50%)' }}
        />
      )}
      
      <div className="p-4 flex items-center gap-3 border-b border-white/5 bg-white/[0.02]">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-slate-100 leading-tight truncate uppercase tracking-wide">{title}</div>
          {subtitle && <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{subtitle}</div>}
        </div>
      </div>
      
      {children && <div className="p-4 space-y-3 bg-slate-950/20">{children}</div>}
    </div>
  );
}

function ConfigNode({ data }: NodeProps<Node<ConfigData, "config">>) {
  return (
    <NodeShell
      color="#3b82f6"
      icon={<SettingsIcon className="h-4 w-4" />}
      title={data.label}
      subtitle={data.testName}
      inHandle={true}
    >
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex flex-col p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <span className="text-[9px] uppercase tracking-wider text-blue-400/70 font-bold">Cliques</span>
          <span className="text-sm font-black text-white">{data.clicks ?? 0}</span>
        </div>
        <div className="flex flex-col p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
          <span className="text-[9px] uppercase tracking-wider text-emerald-400/70 font-bold">Vendas</span>
          <span className="text-sm font-black text-emerald-400">{data.sales ?? 0}</span>
        </div>
        <div className="flex flex-col p-2.5 rounded-xl bg-red-500/5 border border-red-500/10">
          <span className="text-[9px] uppercase tracking-wider text-red-400/70 font-bold">Chargebacks</span>
          <span className="text-sm font-black text-red-400">{data.chargebacks ?? 0}</span>
        </div>
        <div className="col-span-2 flex flex-col p-2.5 rounded-xl bg-violet-500/5 border border-violet-500/10">

          <span className="text-[9px] uppercase tracking-wider text-violet-400/70 font-bold">Faturamento Total</span>
          <span className="text-base font-black text-violet-400">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.revenue || 0)}
          </span>
        </div>
      </div>
      {!data.entryUrl ? (
        <div className="flex items-center gap-2 text-[10px] text-amber-300 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="h-3.5 w-3.5" /> 
          <span className="font-medium">Salve para gerar URL</span>
        </div>
      ) : (
        <div 
          onClick={() => {
            navigator.clipboard.writeText(data.entryUrl);
            toast.success("URL copiada!");
          }}
          className="flex items-center gap-2 text-[10px] text-emerald-300 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 truncate cursor-pointer hover:bg-emerald-500/20 transition-colors"
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" /> 
          <span className="truncate font-mono">{data.entryUrl}</span>
        </div>
      )}
    </NodeShell>
  );
}

function AbTestNode({ id, data }: NodeProps<Node<AbTestData, "abtest">>) {
  const reactFlow = useReactFlow();
  return (
    <NodeShell 
      color="#a855f7" 
      icon={<BarChart3 className="h-4 w-4" />} 
      title={data.label} 
      subtitle={data.subtitle}
      nodeId={id}
      onDelete={(nodeId) => {
        const ns = reactFlow.getNodes().filter(Boolean);
        const es = reactFlow.getEdges().filter(Boolean);
        reactFlow.setNodes(ns.filter(n => n && n.id !== nodeId));
        reactFlow.setEdges(es.filter(e => e && e.source !== nodeId && e.target !== nodeId));
      }}
    >
      {data.splits.map((s, i) => (
        <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30">
          <span className="font-semibold">{s.label}</span>
          <span className="text-muted-foreground">{s.weight}%</span>
        </div>
      ))}
    </NodeShell>
  );
}

function PageNode({ id, data }: NodeProps<Node<PageData, "page">>) {
  const reactFlow = useReactFlow();
  const hasUrl = !!data.url?.trim();
  const isPaused = !!data.paused;
  return (
    <NodeShell 
      color={isPaused ? "#71717a" : "#10b981"} 
      icon={isPaused ? <Pause className="h-4 w-4" /> : <FileText className="h-4 w-4" />} 
      title={data.label} 
      subtitle={isPaused ? "PAUSADA" : data.subtitle}
      nodeId={id}
      onDelete={(nodeId) => {
        const ns = reactFlow.getNodes().filter(Boolean);
        const es = reactFlow.getEdges().filter(Boolean);
        reactFlow.setNodes(ns.filter(n => n && n.id !== nodeId));
        reactFlow.setEdges(es.filter(e => e && e.source !== nodeId && e.target !== nodeId));
      }}
    >
      {data.stats && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex flex-col p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Conversão</span>
            <span className="text-sm font-black text-emerald-400">
              {data.stats.clicks > 0 ? ((data.stats.sales / data.stats.clicks) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div className="flex flex-col p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Vendas</span>
            <span className="text-sm font-black text-white">{data.stats.sales || 0}</span>
          </div>
        </div>
      )}
      
      {data.thumbnailUrl && (
        <div className="mb-3 rounded-lg overflow-hidden border border-white/10 aspect-video bg-slate-900">
          <img src={data.thumbnailUrl} alt="Preview" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="space-y-2">
        <div
          className={`flex items-center gap-2 text-[10px] px-3 py-2 rounded-lg border truncate transition-colors ${
            hasUrl ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" : "text-slate-500 bg-slate-800/20 border-slate-800/40"
          }`}
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-medium">{hasUrl ? data.url : "Configurar URL"}</span>
        </div>
        
        {data.mirrorPixelId && (
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-violet-500/10 border border-violet-500/20">
            <div className="flex items-center gap-2 text-[9px] text-violet-300 uppercase tracking-widest font-bold">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span>Domínio Blindado</span>
            </div>
            <Tooltip>
              <TooltipTrigger>
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">CAPI Ativo & Protegido</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

function CheckoutNode({ id, data }: NodeProps<Node<CheckoutData, "checkout">>) {
  const reactFlow = useReactFlow();
  return (
    <NodeShell 
      color="#f97316" 
      icon={<ShoppingCart className="h-4 w-4" />} 
      title={data.label} 
      subtitle={data.subtitle}
      nodeId={id}
      onDelete={(nodeId) => {
        const ns = reactFlow.getNodes().filter(Boolean);
        const es = reactFlow.getEdges().filter(Boolean);
        reactFlow.setNodes(ns.filter(n => n && n.id !== nodeId));
        reactFlow.setEdges(es.filter(e => e && e.source !== nodeId && e.target !== nodeId));
      }}
    >
      {data.stats && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex flex-col p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Conversão</span>
            <span className="text-sm font-black text-orange-400">
              {data.stats.clicks > 0 ? ((data.stats.sales / data.stats.clicks) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div className="flex flex-col p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Receita</span>
            <span className="text-sm font-black text-white">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.stats.revenue || 0)}
            </span>
          </div>
          <div className="flex flex-col p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Chargebacks</span>
            <span className="text-sm font-black text-red-400">{data.stats.chargebacks || 0}</span>
          </div>
        </div>

      )}
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="text-[9px] text-slate-500 uppercase tracking-[0.1em] font-bold">Produto Vinculado</div>
          <div className="flex items-center gap-2 text-[10px] px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-800/60 truncate font-medium text-slate-200">
            {data.label}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[9px] text-slate-500 uppercase tracking-[0.1em] font-bold">Oferta / Preço</div>
          <div className="flex items-center gap-2 text-[10px] px-3 py-2 rounded-lg bg-orange-500/5 border border-orange-500/10 truncate text-orange-300 font-bold">
            {data.offerId ? "Oferta Customizada" : "Preço Padrão"}
          </div>
        </div>
      </div>
    </NodeShell>
  );
}

function CreativeNode({ id, data }: NodeProps<Node<CreativeData, "creative">>) {
  const reactFlow = useReactFlow();
  const { id: testId } = useParams<{ id: string }>();
  
  const updateData = (newData: Partial<CreativeData>) => {
    reactFlow.setNodes((nds) =>
      nds.filter(Boolean).map((node) => {
        if (node && node.id === id) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  };

  const adUrl = testId ? `${REDIRECT_BASE}?t=${testId}&utm_source=${data.utmSource || "facebook"}&utm_content=${id}` : "";

  const copyAdUrl = () => {
    if (!adUrl) {
      toast.error("Salve o teste primeiro para gerar a URL");
      return;
    }
    navigator.clipboard.writeText(adUrl);
    toast.success("Link do anúncio copiado!");
  };

  return (
    <NodeShell 
      color="#ec4899" 
      icon={<ImageIcon className="h-4 w-4" />} 
      title={data.label} 
      subtitle={data.subtitle || "Anúncio / Criativo"}
      nodeId={id}
      inHandle={true}
      onDelete={(nodeId) => {
        const ns = reactFlow.getNodes().filter(Boolean);
        const es = reactFlow.getEdges().filter(Boolean);
        reactFlow.setNodes(ns.filter(n => n && n.id !== nodeId));
        reactFlow.setEdges(es.filter(e => e && e.source !== nodeId && e.target !== nodeId));
      }}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Identificação</Label>
          <Input 
            value={data.label} 
            onChange={(e) => updateData({ label: e.target.value })}
            className="h-8 text-xs bg-white/[0.03] border-white/10 focus:border-pink-500/50 transition-colors"
            placeholder="Ex: Foto Produto 01"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-slate-500 uppercase font-bold">Origem (Source)</Label>
            <Input 
              value={data.utmSource || ""} 
              onChange={(e) => updateData({ utmSource: e.target.value })}
              className="h-7 text-[10px] bg-white/[0.02] border-white/5"
              placeholder="facebook"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] text-slate-500 uppercase font-bold">Conteúdo (Content)</Label>
            <Input 
              value={data.utmContent || ""} 
              onChange={(e) => updateData({ utmContent: e.target.value })}
              className="h-7 text-[10px] bg-white/[0.02] border-white/5"
              placeholder="ad_01"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] text-slate-500 uppercase font-bold">URL da Imagem</Label>
          <Input 
            value={data.imageUrl || ""} 
            onChange={(e) => updateData({ imageUrl: e.target.value })}
            className="h-7 text-[10px] bg-white/[0.02] border-white/5"
            placeholder="Link da imagem/vídeo..."
          />
        </div>

        {data.imageUrl ? (
          <div className="rounded-lg overflow-hidden border border-white/10 aspect-video bg-slate-900 group/img relative">
            <img src={data.imageUrl} alt="Creative" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-[10px] text-white font-bold uppercase tracking-widest">Preview</span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 py-3 bg-white/[0.02] flex flex-col items-center justify-center gap-1 text-slate-500">
            <ImageIcon className="h-5 w-5 opacity-20" />
            <span className="text-[8px] uppercase tracking-widest font-bold opacity-40">Sem Imagem</span>
          </div>
        )}

        <Button 
          onClick={copyAdUrl}
          variant="outline" 
          className="w-full h-8 text-[10px] uppercase font-black tracking-widest border-pink-500/30 bg-pink-500/5 hover:bg-pink-500/20 text-pink-400 gap-2"
        >
          <Link2 className="h-3 w-3" />
          Copiar Link do Anúncio
        </Button>
        
        {data.stats && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="flex flex-col p-2 rounded-xl bg-pink-500/5 border border-pink-500/10">
              <span className="text-[9px] uppercase tracking-wider text-pink-400/70 font-bold">Vendas</span>
              <span className="text-sm font-black text-white">{data.stats.sales || 0}</span>
            </div>
            <div className="flex flex-col p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <span className="text-[9px] uppercase tracking-wider text-emerald-400/70 font-bold">Receita</span>
              <span className="text-sm font-black text-emerald-400">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(data.stats.revenue || 0)}
              </span>
            </div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

function UpsellNode({ id, data }: NodeProps<Node<UpsellData, "upsell">>) {
  const reactFlow = useReactFlow();
  
  const updateData = (newData: Partial<UpsellData>) => {
    reactFlow.setNodes((nds) =>
      nds.filter(Boolean).map((node) => {
        if (node && node.id === id) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  };

  return (
    <NodeShell 
      color="#8b5cf6" 
      icon={<TrendingUp className="h-4 w-4" />} 
      title={data.label} 
      subtitle={data.subtitle || "Venda Extra"}
      nodeId={id}
      onDelete={(nodeId) => {
        const ns = reactFlow.getNodes().filter(Boolean);
        const es = reactFlow.getEdges().filter(Boolean);
        reactFlow.setNodes(ns.filter(n => n && n.id !== nodeId));
        reactFlow.setEdges(es.filter(e => e && e.source !== nodeId && e.target !== nodeId));
      }}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Nome do Upsell</Label>
          <Input 
            value={data.label} 
            onChange={(e) => updateData({ label: e.target.value })}
            className="h-8 text-xs bg-white/[0.03] border-white/10"
            placeholder="Ex: Oferta Especial 01"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">URL do Upsell</Label>
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-slate-500" />
            <Input 
              value={data.url || ""} 
              onChange={(e) => updateData({ url: e.target.value })}
              className="h-8 text-xs bg-white/[0.03] border-white/10"
              placeholder="https://..."
            />
          </div>
        </div>

        {data.stats && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="flex flex-col p-2 rounded-xl bg-violet-500/5 border border-violet-500/10">
              <span className="text-[9px] uppercase tracking-wider text-violet-400/70 font-bold">Vendas</span>
              <span className="text-sm font-black text-white">{data.stats.sales || 0}</span>
            </div>
            <div className="flex flex-col p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <span className="text-[9px] uppercase tracking-wider text-emerald-400/70 font-bold">Receita</span>
              <span className="text-sm font-black text-emerald-400">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(data.stats.revenue || 0)}
              </span>
            </div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

function WhatsAppNode({ id, data }: NodeProps<Node<WhatsAppData, "whatsapp">>) {
  const reactFlow = useReactFlow();
  const navigate = useNavigate();

  return (
    <NodeShell 
      color="#25d366" 
      icon={<MessageSquare className="h-4 w-4" />} 
      title={data.label} 
      subtitle={data.subtitle || "Recuperação"}
      nodeId={id}
      onDelete={(nodeId) => {
        const ns = reactFlow.getNodes().filter(Boolean);
        const es = reactFlow.getEdges().filter(Boolean);
        reactFlow.setNodes(ns.filter(n => n && n.id !== nodeId));
        reactFlow.setEdges(es.filter(e => e && e.source !== nodeId && e.target !== nodeId));
      }}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 mb-1">
          <div className="flex flex-col p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
            <span className="text-[9px] uppercase tracking-wider text-emerald-400/70 font-bold">Enviadas</span>
            <span className="text-sm font-black text-white">{data.stats?.sent || 0}</span>
          </div>
          <div className="flex flex-col p-2 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <span className="text-[9px] uppercase tracking-wider text-blue-400/70 font-bold">Cliques</span>
            <span className="text-sm font-black text-blue-400">{data.stats?.clicked || 0}</span>
          </div>
          <div className="flex flex-col p-2 rounded-xl bg-orange-500/5 border border-orange-500/10">
            <span className="text-[9px] uppercase tracking-wider text-orange-400/70 font-bold">Recuperadas</span>
            <span className="text-sm font-black text-white">{data.stats?.recovered || 0}</span>
          </div>
          <div className="flex flex-col p-2 rounded-xl bg-violet-500/5 border border-violet-500/10">
            <span className="text-[9px] uppercase tracking-wider text-violet-400/70 font-bold">Receita</span>
            <span className="text-sm font-black text-violet-400">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(data.stats?.revenue || 0)}
            </span>
          </div>
        </div>

        <Button 
          onClick={() => navigate("/admin/whatsapp-recovery")}
          variant="outline" 
          className="w-full h-8 text-[10px] uppercase font-black tracking-widest border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/20 text-emerald-400 gap-2"
        >
          <Zap className="h-3 w-3" />
          Configurar Fluxo
        </Button>
      </div>
    </NodeShell>
  );
}

const nodeTypes = {
  config: ConfigNode,
  abtest: AbTestNode,
  page: PageNode,
  checkout: CheckoutNode,
  creative: CreativeNode,
  upsell: UpsellNode,
  whatsapp: WhatsAppNode,
};

// ---------------- Initial graph ----------------

function buildInitialGraph(testName: string): { nodes: FlowNode[]; edges: Edge[] } {
  const nodes: FlowNode[] = [
    { id: "creative-main", type: "creative", position: { x: -300, y: 200 }, data: { kind: "creative", label: "Criativo Principal", subtitle: "Anúncio Facebook", imageUrl: "", utmSource: "facebook", utmContent: "main" } },
    { id: "config", type: "config", position: { x: 0, y: 200 }, data: { kind: "config", label: "Configuração Inicial", testName, entryUrl: "", visits: 0 } },
    { id: "abtest-pages", type: "abtest", position: { x: 290, y: 200 }, data: { kind: "abtest", label: "Teste Páginas", subtitle: "Divide tráfego", splits: [{ label: "A", weight: 50 }, { label: "B", weight: 50 }] } },
    { id: "page-a", type: "page", position: { x: 580, y: 60 }, data: { kind: "page", label: "Página A", subtitle: "Landing Page", url: "" } },
    { id: "page-b", type: "page", position: { x: 580, y: 340 }, data: { kind: "page", label: "Página B", subtitle: "Landing Page", url: "" } },
    { id: "abtest-checkouts", type: "abtest", position: { x: 880, y: 200 }, data: { kind: "abtest", label: "Teste Checkouts", subtitle: "Teste de checkout", splits: [{ label: "A", weight: 50 }, { label: "B", weight: 50 }] } },
    { id: "checkout-a", type: "checkout", position: { x: 1180, y: 60 }, data: { kind: "checkout", label: "Checkout A", subtitle: "Página de pagamento", productId: null, offerId: null, templateId: null } },
    { id: "checkout-b", type: "checkout", position: { x: 1180, y: 340 }, data: { kind: "checkout", label: "Checkout B", subtitle: "Página de pagamento", productId: null, offerId: null, templateId: null } },
    { id: "whatsapp-recovery", type: "whatsapp", position: { x: 1480, y: 200 }, data: { kind: "whatsapp", label: "Recuperação Whats", subtitle: "Carrinho Abandonado", delay: 15 } },
  ];
  const edge = (id: string, source: string, target: string, color: string): Edge => ({
    id, source, target, type: "smoothstep",
    animated: true,
    style: { stroke: color, strokeWidth: 2, strokeDasharray: "6 6" },
    markerEnd: { type: MarkerType.ArrowClosed, color },
  });
  const edges: Edge[] = [
    edge("e0", "creative-main", "config", "#ec4899"),
    edge("e1", "config", "abtest-pages", "#a855f7"),
    edge("e2", "abtest-pages", "page-a", "#10b981"),
    edge("e3", "abtest-pages", "page-b", "#10b981"),
    edge("e4", "page-a", "abtest-checkouts", "#a855f7"),
    edge("e5", "page-b", "abtest-checkouts", "#a855f7"),
    edge("e6", "abtest-checkouts", "checkout-a", "#f97316"),
    edge("e7", "abtest-checkouts", "checkout-b", "#f97316"),
    edge("e8", "checkout-a", "whatsapp-recovery", "#25d366"),
    edge("e9", "checkout-b", "whatsapp-recovery", "#25d366"),
  ];
  return { nodes, edges };
}

// ---------------- Sidebar palette ----------------

const PALETTE: { kind: NodeKind; label: string; icon: React.ReactNode; color: string }[] = [
  { kind: "creative", label: "Criativo / Anúncio", icon: <ImageIcon className="h-4 w-4" />, color: "#ec4899" },
  { kind: "abtest", label: "Teste A/B", icon: <BarChart3 className="h-4 w-4" />, color: "#a855f7" },
  { kind: "page", label: "Página de Vendas", icon: <FileText className="h-4 w-4" />, color: "#10b981" },
  { kind: "checkout", label: "Checkout", icon: <ShoppingCart className="h-4 w-4" />, color: "#f97316" },
  { kind: "upsell", label: "Upsell", icon: <TrendingUp className="h-4 w-4" />, color: "#8b5cf6" },
  { kind: "whatsapp", label: "Recuperação Whats", icon: <MessageSquare className="h-4 w-4" />, color: "#25d366" },
];

function PaletteItem({ kind, label, icon, color }: { kind: NodeKind; label: string; icon: React.ReactNode; color: string }) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData("application/reactflow", kind);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2 rounded-lg border bg-card/60 px-3 py-2.5 cursor-grab active:cursor-grabbing hover:border-foreground/30 transition"
      style={{ borderColor: `${color}55` }}
    >
      <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ background: `${color}22`, color }}>
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
      <GripVertical className="h-3 w-3 text-muted-foreground ml-auto" />
    </div>
  );
}

// ---------------- Main editor ----------------

function EditorInner() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reactFlow = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [testId, setTestId] = useState<string | null>(routeId && routeId !== "new" ? routeId : null);
  const [name, setName] = useState("Novo Teste A/B");
  const [autoWinner, setAutoWinner] = useState(true);
  const [minClicks, setMinClicks] = useState(100);
  const [stickyDays, setStickyDays] = useState(30);
  const [entryUrl, setEntryUrl] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [showTutorial, setShowTutorial] = useState(!routeId || routeId === "new");
  const [conversionGoal, setConversionGoal] = useState<string>("purchase");
  const [targetingRules, setTargetingRules] = useState<any>({ devices: [], utm_filters: [] });
  const [period, setPeriod] = useState<string>("all");

  const initial = useMemo(() => buildInitialGraph("Novo Teste A/B"), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("config");

  // Load existing test if editing
  const { data: existing, isLoading } = useQuery({
    queryKey: ["ab_test_full", testId],
    enabled: !!testId && testId !== "new",
    queryFn: async () => {
      const { data, error } = await supabase.from("ab_tests" as any).select("*").eq("id", testId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });


  useEffect(() => {
    if (!existing) return;
    setName(existing.name ?? "Novo Teste A/B");
    setAutoWinner(!!existing.auto_winner_enabled);
    setMinClicks(existing.auto_winner_min_clicks ?? 100);
    setStickyDays(existing.sticky_days ?? 30);
    setSlug(existing.slug ?? null);
    setStatus(existing.status ?? "draft");
    setConversionGoal(existing.conversion_goal ?? "purchase");
    setTargetingRules(existing.targeting_rules ?? { devices: [], utm_filters: [] });
    const publicDomain = "ck.panttera.com.br";
    const generated = existing.slug ? `https://${publicDomain}/go/${existing.slug}?type=page` : "";
    setEntryUrl(generated);
    const g = existing.graph;
    if (g && Array.isArray(g.nodes)) {
      setNodes((g.nodes as FlowNode[]).filter(Boolean));
      setEdges(((g.edges as Edge[]) ?? []).filter(Boolean));
    }
  }, [existing, setNodes, setEdges]);

  // Reflect entry URL inside Config node
  useEffect(() => {
    setNodes((ns) =>
      ns.filter(Boolean).map((n) =>
        n.id === "config"
          ? ({ ...n, data: { ...(n.data as ConfigData), entryUrl, testName: name } } as FlowNode)
          : n
      )
    );
  }, [entryUrl, name, setNodes]);

  // Products for checkout selector
  const { data: products = [] } = useQuery({
    queryKey: ["products_for_ab"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: checkoutConfigs = [] } = useQuery({
    queryKey: ["checkout_configs_for_ab"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkout_builder_configs")
        .select("id, name, price, product_id")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customDomains = [] } = useQuery({
    queryKey: ["custom_domains_for_ab"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_domains")
        .select("hostname")
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["checkout_templates_for_ab"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkout_templates")
        .select("id,name")
        .eq("published", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  
  const { data: mirrorPixels = [] } = useQuery({
    queryKey: ["mirror_pixels_for_ab"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase
        .from("mirror_pixels" as any)
        .select("id, name, pixel_id") as any)
        .eq("user_id", user.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch full stats for the test to update node data
  const { data: stats } = useQuery({
    queryKey: ["ab_test_stats", testId, period],
    enabled: !!testId,
    refetchInterval: 30000,
    queryFn: async () => {
      // Get base variants
      const { data: variants, error: vError } = await supabase
        .from("ab_test_variants")
        .select("id, label, impressions, clicks, sales, revenue, page_url, checkout_url, sort_order")
        .eq("test_id", testId);
      if (vError) throw vError;

      // Get the test to extract products from the graph
      const { data: test, error: tError } = await supabase
        .from("ab_tests")
        .select("graph, created_at")
        .eq("id", testId)
        .single();
      
      if (tError) throw tError;

      const graph = (test?.graph as any) || { nodes: [] };
      const productIds = Array.from(new Set(
        graph.nodes
          ?.filter((n: any) => n.type === "checkout" && n.data?.productId)
          ?.map((n: any) => n.data.productId)
      )) as string[];

      // Filtered stats timing
      let startTime = new Date(test.created_at);
      if (period === "24h") {
        const d = new Date();
        d.setHours(d.getHours() - 24);
        startTime = d;
      } else if (period === "7d") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startTime = d;
      } else if (period === "30d") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startTime = d;
      }

      // Fetch real orders for synchronization with ProductEdit
      let orders: any[] = [];
      if (productIds.length > 0) {
        const { data: ordersData } = await supabase
          .from("orders")
          .select("id, amount, metadata, status, created_at, product_id")
          .in("product_id", productIds)
          .in("status", ["paid", "refunded", "chargedback", "chargeback"])
          .gte("created_at", startTime.toISOString());
        orders = ordersData || [];
      }

      // Fetch WhatsApp recovery data
      const { data: waData } = await supabase
        .from("whatsapp_send_log")
        .select("id, status, delivery_status, created_at, order_id")
        .gte("created_at", startTime.toISOString());

      const { data: events, error: eError } = await supabase
        .from("ab_test_events")
        .select("variant_id, event_type, amount, metadata, order_id")
        .eq("test_id", testId)
        .gte("created_at", startTime.toISOString());
      
      if (eError) throw eError;

      // Fetch Pixel Events for checkout/creative attribution (ViewContent/InitiateCheckout)
      const { data: pixelEvents } = await supabase
        .from("pixel_events")
        .select("event_name, utm_content, utm_source, product_id")
        .in("product_id", productIds)
        .in("event_name", ["ViewContent", "InitiateCheckout"])
        .gte("created_at", startTime.toISOString());

      // Aggregate everything
      return {
        variants: variants.map(v => {
          const vEvents = events.filter(e => e.variant_id === v.id);
          const vOrders = orders.filter(o => 
            o.metadata?.variant_id === v.id || 
            events.some(e => e.event_type === 'sale' && e.variant_id === v.id && (e as any).order_id === o.id)
          );

          return {
            ...v,
            impressions: vEvents.filter(e => e.event_type === 'impression').length,
            clicks: vEvents.filter(e => e.event_type === 'click').length,
            sales: vOrders.filter(o => o.status === 'paid').length,
            revenue: vOrders.filter(o => o.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount || 0), 0),
            chargebacks: vOrders.filter(o => o.status === 'chargedback' || o.status === 'chargeback').length

          };
        }),
        orders,
        pixelEvents: pixelEvents || [],
        whatsapp: waData ? {
          sent: waData.length || 0, // Total attempts
          delivered: waData.filter(w => w.delivery_status === 'sent' || w.status === 'sent').length || 0,
          recovered: orders.filter(o => waData.some(w => w.order_id === o.id)).length || 0,
          revenue: orders.filter(o => waData.some(w => w.order_id === o.id)).reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
        } : { sent: 0, delivered: 0, recovered: 0, revenue: 0 }
      };
    },
  });

  useEffect(() => {
    if (!stats) return;
    setNodes((ns) =>
      ns.filter(Boolean).map((n) => {
        if (!n) return n;
        
        if (n.type === "page") {
          const s = stats.variants.find(st => st.page_url === (n.data as PageData).url && st.label === (n.data as PageData).label);
          if (s) {
            return { 
              ...n, 
              data: { 
                ...n.data, 
                stats: { 
                  impressions: Number(s.impressions), 
                  clicks: Number(s.clicks), 
                  sales: Number(s.sales), 
                  revenue: Number(s.revenue) 
                } 
              } 
            } as FlowNode;
          }
        }

        if (n.type === "checkout") {
          const offerId = (n.data as CheckoutData).offerId;
          const productId = (n.data as CheckoutData).productId;
          
          // Match by config (from orders metadata)
          const configOrders = stats.orders.filter(o => (o.metadata as any)?.config === offerId);
          
          // Match clicks from Pixel Events (if utm_content or other markers were present, but here we'll use product_id as proxy if no direct link)
          const productVisits = stats.pixelEvents.filter(p => p.product_id === productId).length;
          
          if (offerId) {
            return { 
              ...n, 
              data: { 
                ...n.data, 
                stats: { 
                  impressions: Math.max(productVisits / (ns.filter(node => node?.type === 'checkout').length || 1), configOrders.length * 1.5),
                  clicks: Math.max(productVisits / (ns.filter(node => node?.type === 'checkout').length || 1), configOrders.length * 1.2), 
                  sales: configOrders.filter(o => o.status === 'paid').length, 
                  revenue: configOrders.filter(o => o.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount || 0), 0),
                  chargebacks: configOrders.filter(o => o.status === 'chargedback' || o.status === 'chargeback').length

                } 
              } 
            } as FlowNode;
          }

          // Fallback matching by label
          const label = n.data.label?.toUpperCase() || "";
          const s = stats.variants.find(st => label.includes(` ${st.label}`) || label.includes(`-${st.label}`) || label.endsWith(st.label));
          
          if (s) {
            return { 
              ...n, 
              data: { 
                ...n.data, 
                stats: { 
                  impressions: Number(s.clicks), 
                  clicks: Number(s.clicks), 
                  sales: Number(s.sales), 
                  revenue: Number(s.revenue) 
                } 
              } 
            } as FlowNode;
          }
        }

        if (n.type === "creative") {
          const utmContent = (n.data as CreativeData).utmContent;
          const utmSource = (n.data as CreativeData).utmSource;
          
          // Attribute orders using utm_content
          const creativeOrders = stats.orders.filter(o => 
            (o.metadata as any)?.utm_content === utmContent || 
            (o.metadata as any)?.utm_source === utmSource
          );
          
          // Attribute clicks from pixel events
          const creativeVisits = stats.pixelEvents.filter(p => 
            p.utm_content === utmContent || 
            p.utm_source === utmSource
          ).length;

          return {
            ...n,
            data: {
              ...n.data,
              stats: { 
                impressions: creativeVisits * 1.2, 
                clicks: creativeVisits, 
                sales: creativeOrders.length, 
                revenue: creativeOrders.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) 
              }
            }
          } as FlowNode;
        }

        if (n.type === "whatsapp") {
          return {
            ...n,
            data: {
              ...n.data,
              stats: stats.whatsapp
            }
          } as FlowNode;
        }

        if (n.type === "config") {
          const totalImpressions = stats.variants.reduce((acc, curr) => acc + Number(curr.impressions || 0), 0);
          const totalClicks = stats.variants.reduce((acc, curr) => acc + Number(curr.clicks || 0), 0);
          const totalSales = stats.orders.filter(o => o.status === 'paid').length; 
          const totalRevenue = stats.orders.filter(o => o.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
          const totalChargebacks = stats.orders.filter(o => o.status === 'chargedback' || o.status === 'chargeback').length;
          
          return { 
            ...n, 
            data: { 
              ...n.data, 
              impressions: totalImpressions, 
              clicks: totalClicks,
              sales: totalSales, 
              revenue: totalRevenue,
              chargebacks: totalChargebacks
            } 
          } as FlowNode;
        }

        return n;
      })
    );
  }, [stats, setNodes]);

  // Drag from palette → drop on canvas
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/reactflow") as NodeKind;
      if (!kind || !wrapperRef.current) return;
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = reactFlow.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
      const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
      let newNode: FlowNode;
      if (kind === "abtest") {
        newNode = { id, type: "abtest", position, data: { kind: "abtest", label: "Novo Teste", subtitle: "Divide tráfego", splits: [{ label: "A", weight: 50 }, { label: "B", weight: 50 }] } };
      } else if (kind === "creative") {
        newNode = { id, type: "creative", position, data: { kind: "creative", label: "Novo Criativo", subtitle: "Anúncio FB/IG", imageUrl: "", utmSource: "facebook", utmContent: "" } };
      } else if (kind === "page") {
        const idx = nodes.filter((n) => n && n.type === "page").length;
        newNode = { id, type: "page", position, data: { kind: "page", label: `Página ${String.fromCharCode(65 + idx)}`, subtitle: "Landing Page", url: "" } };
      } else if (kind === "upsell") {
        newNode = { id, type: "upsell", position, data: { kind: "upsell", label: "Novo Upsell", subtitle: "Página de Upsell", url: "" } };
      } else if (kind === "whatsapp") {
        newNode = { id, type: "whatsapp", position, data: { kind: "whatsapp", label: "Recuperação WhatsApp", subtitle: "Automação", delay: 15, stats: { sent: 0, clicked: 0, recovered: 0, revenue: 0 } } };
      } else {
        const idx = nodes.filter((n) => n && n.type === "checkout").length;
        newNode = { id, type: "checkout", position, data: { kind: "checkout", label: `Checkout ${String.fromCharCode(65 + idx)}`, subtitle: "Página de pagamento", productId: null, offerId: null, templateId: null } };
      }
      setNodes((ns) => [...ns.filter(Boolean), newNode]);
    },
    [reactFlow, nodes, setNodes]
  );

  const onConnect = useCallback(
    (c: Connection) => {
      // Find source/target nodes to decide color
      const sourceNode = nodes.filter(Boolean).find(n => n.id === c.source);
      const targetNode = nodes.filter(Boolean).find(n => n.id === c.target);
      
      let edgeColor = "#a855f7"; // default purple
      if (sourceNode?.type === "creative" || targetNode?.type === "creative") edgeColor = "#ec4899";
      if (sourceNode?.type === "page" || targetNode?.type === "page") edgeColor = "#10b981";
      if (sourceNode?.type === "checkout" || targetNode?.type === "checkout") edgeColor = "#f97316";
      if (sourceNode?.type === "whatsapp" || targetNode?.type === "whatsapp") edgeColor = "#25d366";

      setEdges((eds) =>
        addEdge(
          { 
            ...c, 
            type: "smoothstep", 
            animated: true, 
            style: { stroke: edgeColor, strokeWidth: 2, strokeDasharray: "6 6" }, 
            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor } 
          },
          eds
        )
      );
    },
    [setEdges, nodes]
  );

  const selectedNode = nodes.filter(Boolean).find((n) => n.id === selectedNodeId) ?? null;

  const updateNodeData = (id: string, patch: Record<string, any>) => {
    setNodes((ns) => ns.filter(Boolean).map((n) => (n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as FlowNode) : n)));
  };

  const deleteNode = (id: string) => {
    if (id === "config") {
      toast.error("O nó de Configuração Inicial não pode ser removido");
      return;
    }
    setNodes((ns) => ns.filter(Boolean).filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId(null);
  };

  // Save
  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const slugify = (s: string) =>
        (s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) ||
          `teste-${Math.random().toString(36).slice(2, 8)}`);

      const graph = { nodes, edges };
      let id = testId;
      let theSlug = slug;

      if (!id) {
        theSlug = slugify(`${name}-${Math.random().toString(36).slice(2, 6)}`);
        const publicDomain = "ck.panttera.com.br";
        const generatedEntry = `https://${publicDomain}/go/${theSlug}?type=page`;
        const { data, error } = await supabase
          .from("ab_tests" as any)
          .insert({
            user_id: user.id,
            name: name.trim() || "Novo Teste A/B",
            slug: theSlug,
            auto_winner_enabled: autoWinner,
            auto_winner_min_clicks: minClicks,
            sticky_days: stickyDays,
            conversion_goal: conversionGoal,
            targeting_rules: targetingRules,
            graph,
            entry_url: generatedEntry,
          })
          .select()
          .single();
        if (error) throw error;
        id = (data as any).id;
        setTestId(id);
        setSlug(theSlug);
        setEntryUrl(generatedEntry);
        window.history.replaceState(null, "", `/admin/ab-tests/${id}`);
      } else {
        const { error } = await supabase
          .from("ab_tests" as any)
          .update({
            name: name.trim() || "Novo Teste A/B",
            auto_winner_enabled: autoWinner,
            auto_winner_min_clicks: minClicks,
            sticky_days: stickyDays,
            conversion_goal: conversionGoal,
            targeting_rules: targetingRules,
            graph,
            entry_url: entryUrl,
          })
          .eq("id", id);
        if (error) throw error;
      }

      const pageNodes = nodes.filter((n) => n && n.type === "page") as Node<PageData, "page">[];
      const checkoutNodes = nodes.filter((n) => n && n.type === "checkout") as Node<CheckoutData, "checkout">[];
      
      // Variants are defined by Page nodes. If no page nodes, we'll create at least 2 default ones.
      const variantSlots = Math.max(pageNodes.length, 2);

      const { data: existingVars } = await supabase.from("ab_test_variants" as any).select("id,sort_order").eq("test_id", id);
      const existing = ((existingVars ?? []) as unknown) as { id: string; sort_order: number }[];

      for (let i = 0; i < variantSlots; i++) {
        const label = String.fromCharCode(65 + i);
        const page = pageNodes[i];
        
        // Find if this page is connected to a checkout
        let checkoutUrl = null;
        if (page) {
          const connectedEdge = edges.find(e => e && e.source === page.id);
          if (connectedEdge) {
            let target = nodes.find(n => n && n.id === connectedEdge.target);
            
            // If it's an abtest node, go one level deeper to find the i-th checkout
            if (target && target.type === "abtest") {
              const checkoutEdges = edges.filter(e => e && e.source === target?.id);
              const nextEdge = checkoutEdges[i] || checkoutEdges[0];
              if (nextEdge) {
                target = nodes.find(n => n && n.id === nextEdge.target);
              }
            }

            if (target && target.type === "checkout") {
              const d = target.data as CheckoutData;
              if (d.productId) {
                // Use custom domain if available, fallback to panttera
                const domain = customDomains[0]?.hostname || "checkout.panttera.com.br";
                const path = customDomains[0]?.hostname ? "checkout" : "pay";
                
                // Construct checkout URL
                checkoutUrl = `https://${domain}/${path}/${d.productId}`;
                // Use offerId (config) if selected, otherwise fallback to templateId for legacy reasons
                const configId = d.offerId || d.templateId;
                if (configId && configId !== "default") {
                  checkoutUrl += `?config=${configId}`;
                }
              }
            }
          }
        }

        const payload = {
          name: page?.data?.label ?? `Variante ${label}`,
          page_url: page?.data?.url ?? null,
          checkout_url: checkoutUrl,
          weight: Math.round(100 / variantSlots),
          label,
          sort_order: i,
          mirror_pixel_id: page?.data?.mirrorPixelId ?? null,
          paused: !!page?.data?.paused,
          thumbnail_url: page?.data?.thumbnailUrl ?? null,
        };
        const found = existing.find((e) => e.sort_order === i);
        if (found) {
          await supabase.from("ab_test_variants" as any).update(payload).eq("id", found.id);
        } else {
          await supabase.from("ab_test_variants" as any).insert({ test_id: id, ...payload });
        }
      }
      for (const e of existing) {
        if (e.sort_order >= variantSlots) {
          await supabase.from("ab_test_variants" as any).delete().eq("id", e.id);
        }
      }

      return id!;
    },
    onSuccess: (id) => {
      const isFirstSave = (!routeId || routeId === "new") && !testId;
      toast.success(isFirstSave ? "Teste A/B criado com sucesso!" : "Teste salvo");
      qc.invalidateQueries({ queryKey: ["ab_tests"] });
      qc.invalidateQueries({ queryKey: ["ab_test_full", id] });
      if (!routeId || routeId === "new") {
        window.location.href = `/admin/ab-tests/${id}`;
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const validateForStart = (): string | null => {
    const pageNodes = nodes.filter((n) => n && n.type === "page") as Node<PageData, "page">[];
    const pagesMissing = pageNodes.filter((n) => !n.data.url || !n.data.url.trim()).map((n) => n.data.label);
    if (pagesMissing.length > 0) return `Configure as URLs das páginas de vendas: ${pagesMissing.join(", ")}`;
    return null;
  };

  const toggleStatus = useMutation({
    mutationFn: async () => {
      if (!testId) throw new Error("Salve o teste antes de iniciar");
      const newStatus = status === "active" ? "paused" : "active";
      if (newStatus === "active") {
        const err = validateForStart();
        if (err) { setValidationError(err); throw new Error(err); }
      }
      const patch: any = { status: newStatus };
      if (newStatus === "active" && !status.includes("active")) patch.started_at = new Date().toISOString();
      const { error } = await supabase.from("ab_tests" as any).update(patch).eq("id", testId);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      setStatus(newStatus);
      setValidationError(null);
      toast.success(newStatus === "active" ? "Teste iniciado" : "Teste pausado");
    },
  });

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  // No longer using useEffect for automatic save of everything.
  // We'll save only the graph layout (positions) automatically to keep the UI fluid.
  const isFirstAutosaveRef = useRef(true);
  useEffect(() => {
    if (isFirstAutosaveRef.current) { isFirstAutosaveRef.current = false; return; }
    if (status === "active" || !testId) return;

    const t = setTimeout(async () => {
      // Automatic save only for node positions (graph)
      const graph = { nodes, edges };
      await supabase.from("ab_tests" as any).update({ graph }).eq("id", testId);
      setLastSavedAt(new Date());
    }, 3000);
    
    return () => clearTimeout(t);
  }, [nodes, edges]);

  const copyEntryUrl = async () => {
    if (!entryUrl) return;
    await navigator.clipboard.writeText(entryUrl);
    toast.success("URL copiada!");
  };

  const statusBadge = (() => {
    if (status === "active") return { label: "Ativo", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
    if (status === "paused") return { label: "Pausado", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
    return { label: "Rascunho", cls: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40" };
  })();

  if (isLoading) {
    return (
      <div className="h-screen bg-[#0d0f15] flex flex-col items-center justify-center p-8 space-y-6">
        <div className="flex items-center justify-between w-full max-w-7xl px-4">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded bg-white/5 animate-pulse" />
            <div className="h-6 w-48 bg-white/5 animate-pulse rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-white/5 animate-pulse rounded" />
            <div className="h-9 w-32 bg-primary/20 animate-pulse rounded" />
          </div>
        </div>
        <div className="flex-1 w-full max-w-7xl bg-white/5 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0a0c12] text-white z-[30]">
      {validationError && (
        <div className="bg-red-950/60 border-b border-red-500/40 text-red-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4" /> <span>{validationError}</span>
          </div>
          <button onClick={() => setValidationError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}
      <header className="h-16 border-b border-white/5 bg-[#0d0f1a]/80 backdrop-blur-xl flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/admin/ab-tests")}
            className="hover:bg-white/5 text-slate-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <Input 
              id="tutorial-name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="h-7 p-0 bg-transparent border-transparent font-black text-lg text-white focus-visible:ring-0 w-auto min-w-[200px]" 
            />
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusBadge.cls}`}>
                {statusBadge.label}
              </span>
              {lastSavedAt && (
                <span className="text-[10px] text-slate-500 font-medium">
                  Sincronizado às {lastSavedAt.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowTutorial(true)} className="text-slate-600 hover:text-white transition-colors">
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
        <div id="tutorial-actions" className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[110px] bg-white/[0.02] border-white/5 text-slate-300 text-[10px] font-bold uppercase tracking-wider">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["ab_test_stats"] });
              toast.success("Dados atualizados!");
            }}
            className="text-xs h-9 border-white/5 bg-white/[0.02] hover:bg-white/5 text-slate-300 font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2 text-violet-400" />
            Atualizar Dados
          </Button>
          {testId && (
            <Button 
              onClick={() => toggleStatus.mutate()} 
              className={`h-9 font-black text-xs uppercase tracking-wider ${status === "active" ? "bg-amber-500 hover:bg-amber-600 text-amber-950" : "bg-emerald-500 hover:bg-emerald-600 text-emerald-950"}`} 
              size="sm"
            >
              {status === "active" ? <Pause className="h-3.5 w-3.5 mr-2 fill-current" /> : <Play className="h-3.5 w-3.5 mr-2 fill-current" />}
              {status === "active" ? "Pausar Teste" : "Iniciar Teste"}
            </Button>
          )}
          <Button 
            onClick={() => save.mutate()} 
            disabled={save.isPending} 
            className="bg-violet-600 hover:bg-violet-500 text-white h-9 px-5 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all"
            size="sm"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-2" />}
            Salvar
          </Button>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-60 border-r border-border/60 bg-background/60 p-4 flex flex-col gap-6 overflow-y-auto shrink-0">
          <div id="tutorial-palette" className="space-y-4">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Paleta</p>
            {PALETTE.map((p) => <PaletteItem key={p.kind} {...p} />)}
          </div>

          <div id="tutorial-stats" className="space-y-4 pt-6 border-t border-border/40">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Resumo Geral</p>
            <div className="grid grid-cols-1 gap-2">
              <div className="p-3 rounded-lg bg-white/5 border border-border/20">
                <p className="text-[10px] text-muted-foreground uppercase">Visitantes</p>
                <p className="text-xl font-bold">{(nodes.find(n => n && n.id === 'config')?.data as ConfigData)?.impressions ?? 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-400/70 uppercase font-bold tracking-tight">Vendas Totais</p>
                <p className="text-xl font-bold text-emerald-400">{(nodes.find(n => n && n.id === 'config')?.data as ConfigData)?.sales ?? 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <p className="text-[10px] text-violet-400/70 uppercase font-bold tracking-tight">Receita Total</p>
                <p className="text-xl font-bold text-violet-400">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((nodes.find(n => n && n.id === 'config')?.data as ConfigData)?.revenue || 0)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-500/5 border border-zinc-500/20">
                <p className="text-[10px] text-zinc-400/70 uppercase font-bold tracking-tight">Conversão</p>
                <p className="text-xl font-bold text-zinc-300">
                  {(() => {
                    const c = nodes.find(n => n && n.id === 'config')?.data as ConfigData;
                    return c?.impressions > 0 ? ((c.sales / c.impressions) * 100).toFixed(1) : "0.0";
                  })()}%
                </p>
              </div>
            </div>
          </div>
        </aside>
        <div id="tutorial-canvas" ref={wrapperRef} className="flex-1 relative bg-[#0a0c12]">
          <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onEdgesChange={onEdgesChange} 
            onConnect={onConnect} 
            onNodeClick={(_, n) => setSelectedNodeId(n.id)} 
            onPaneClick={() => setSelectedNodeId(null)} 
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes as any} 
            fitView 
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="#1e2230" />
            <Controls />
          </ReactFlow>
        </div>
        {selectedNode && (
          <aside className="w-80 border-l border-border/60 p-5 space-y-4 overflow-y-auto shrink-0 bg-background/60">
            <h3 className="font-bold">{selectedNode.data.label}</h3>
            {selectedNode.type === "config" && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/30 rounded border text-xs">
                  Este nó define as configurações globais do funil de teste.
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Meta de Conversão Principal</Label>
                  <Select value={conversionGoal} onValueChange={setConversionGoal}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase">Venda Final (Purchase)</SelectItem>
                      <SelectItem value="lead">Lead / Clique no Botão</SelectItem>
                      <SelectItem value="checkout">Início de Checkout</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dias de Retenção (Sticky)</Label>
                  <Input type="number" value={stickyDays} onChange={(e) => setStickyDays(Number(e.target.value))} className="h-8" />
                  <p className="text-[10px] text-muted-foreground">Tempo que o usuário ficará preso à mesma variante.</p>
                </div>
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Vencedor Automático</Label>
                    <Switch checked={autoWinner} onCheckedChange={setAutoWinner} />
                  </div>
                  {autoWinner && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Mínimo de Cliques</Label>
                      <Input type="number" value={minClicks} onChange={(e) => setMinClicks(Number(e.target.value))} className="h-8" />
                    </div>
                  )}
                </div>
                {entryUrl && (
                  <div className="pt-4 border-t space-y-2">
                    <Label className="text-xs">URL de Entrada</Label>
                    <div className="flex gap-1">
                      <Input value={entryUrl} readOnly className="h-8 text-[10px] font-mono text-emerald-400" />
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={copyEntryUrl}><Copy className="h-3 w-3" /></Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {selectedNode.type === "abtest" && (
              <div className="space-y-4">
                <Label className="text-xs font-medium uppercase text-muted-foreground tracking-widest">Configuração do Teste</Label>
                <div className="space-y-2">
                  <Label className="text-xs">Título do Teste</Label>
                  <Input value={selectedNode.data.label} onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Distribuição de Tráfego</Label>
                  <div className="space-y-2">
                    {selectedNode.data.splits.map((s: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input value={s.label} className="w-12 h-8 text-center" readOnly />
                        <Input 
                          type="number" 
                          value={s.weight} 
                          onChange={(e) => {
                            const newSplits = [...selectedNode.data.splits];
                            newSplits[i] = { ...s, weight: Number(e.target.value) };
                            updateNodeData(selectedNode.id, { splits: newSplits });
                          }}
                          className="flex-1 h-8"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button variant="outline" className="w-full text-red-400 border-red-400/30 hover:bg-red-500/10" onClick={() => deleteNode(selectedNode.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir Teste A/B
                </Button>
              </div>
            )}
            {selectedNode.type === "page" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Nome da Variante</Label>
                  <Input value={selectedNode.data.label} onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">URL da Página (LP)</Label>
                  <Input 
                    placeholder="https://suapagina.com.br"
                    value={(selectedNode.data as PageData).url || ""} 
                    onChange={(e) => updateNodeData(selectedNode.id, { url: e.target.value })} 
                  />
                  <p className="text-[10px] text-muted-foreground italic">Insira a URL real da sua página de vendas.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">URL da Thumbnail (Preview)</Label>
                  <Input 
                    placeholder="https://suaimagem.com/preview.jpg"
                    value={(selectedNode.data as PageData).thumbnailUrl || ""} 
                    onChange={(e) => updateNodeData(selectedNode.id, { thumbnailUrl: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Pixel Espelho (Opcional)</Label>
                  <Select 
                    value={(selectedNode.data as PageData).mirrorPixelId || "none"} 
                    onValueChange={(v) => updateNodeData(selectedNode.id, { mirrorPixelId: v === "none" ? null : v })}
                  >
                    <SelectTrigger className="bg-muted/40 border-border/40">
                      <SelectValue placeholder="Nenhum pixel espelho" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum pixel espelho</SelectItem>
                      {mirrorPixels.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.pixel_id})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground italic">Escolha um pixel espelho para segmentar o rastreamento desta variante.</p>
                </div>
                <div className={`space-y-2 p-3 rounded border ${(selectedNode.data as PageData).paused ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/20 border-border/40"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold">Pausar esta variante</Label>
                      <p className="text-[10px] text-muted-foreground">Quando pausada, o servidor não envia mais tráfego para ela.</p>
                    </div>
                    <Switch
                      checked={!!(selectedNode.data as PageData).paused}
                      onCheckedChange={(v) => updateNodeData(selectedNode.id, { paused: v })}
                    />
                  </div>
                  {(selectedNode.data as PageData).paused && (
                    <p className="text-[10px] text-amber-300 italic">⏸ Salve o teste para aplicar. 100% do tráfego irá às variantes ativas restantes.</p>
                  )}
                </div>
                <Button variant="outline" className="w-full text-red-400 border-red-400/30 hover:bg-red-500/10" onClick={() => deleteNode(selectedNode.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir Página
                </Button>
              </div>
            )}

            {selectedNode.type === "checkout" && (
              <div className="space-y-4">
                <Label className="text-xs font-medium uppercase text-muted-foreground tracking-widest">Configuração do Checkout</Label>
                <div className="space-y-2">
                  <Label className="text-xs">Título / Label do Checkout</Label>
                  <Input 
                    value={selectedNode.data.label} 
                    onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })} 
                  />
                  <p className="text-[10px] text-muted-foreground italic">Ex: Checkout com Order Bump (R$ 67)</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">Produto Principal</Label>
                  <Select 
                    value={(selectedNode.data as CheckoutData).productId || ""} 
                    onValueChange={(v) => {
                      updateNodeData(selectedNode.id, { productId: v, offerId: null });
                    }}
                  >
                    <SelectTrigger className="bg-muted/40 border-border/40">
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                      {products.length === 0 && <div className="p-2 text-xs text-muted-foreground text-center">Nenhum produto ativo</div>}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Preço / Oferta (Configuração)</Label>
                  <Select 
                    disabled={!(selectedNode.data as CheckoutData).productId}
                    value={(selectedNode.data as CheckoutData).offerId || "default"} 
                    onValueChange={(v) => updateNodeData(selectedNode.id, { offerId: v === "default" ? null : v })}
                  >
                    <SelectTrigger className="bg-muted/40 border-border/40 border-orange-500/30">
                      <SelectValue placeholder="Preço Padrão do Produto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Preço Padrão do Produto</SelectItem>
                      {checkoutConfigs
                        .filter((c: any) => c.product_id === (selectedNode.data as CheckoutData).productId)
                        .map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} {c.price ? `- R$ ${c.price}` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground italic">Selecione qual configuração de preço/design usar para este braço do teste.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Template de Design (Opcional)</Label>
                  <Select 
                    value={(selectedNode.data as CheckoutData).templateId || ""} 
                    onValueChange={(v) => updateNodeData(selectedNode.id, { templateId: v })}
                  >
                    <SelectTrigger className="bg-muted/40 border-border/40">
                      <SelectValue placeholder="Design Padrão" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Design Padrão Pantera</SelectItem>
                      {templates.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="outline" className="w-full text-red-400 border-red-400/30 hover:bg-red-500/10" onClick={() => deleteNode(selectedNode.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir Checkout
                </Button>
              </div>
            )}

            {selectedNode.type === "creative" && (
              <div className="space-y-4">
                <Label className="text-xs font-medium uppercase text-muted-foreground tracking-widest">Configuração do Criativo</Label>
                <div className="space-y-2">
                  <Label className="text-xs">Nome do Criativo / Ad</Label>
                  <Input value={selectedNode.data.label} onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">URL da Imagem / Thumbnail</Label>
                  <Input 
                    placeholder="https://suaimagem.com/thumb.jpg"
                    value={(selectedNode.data as CreativeData).imageUrl || ""} 
                    onChange={(e) => updateNodeData(selectedNode.id, { imageUrl: e.target.value })} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">UTM Source</Label>
                    <Input 
                      value={(selectedNode.data as CreativeData).utmSource || ""} 
                      onChange={(e) => updateNodeData(selectedNode.id, { utmSource: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">UTM Content</Label>
                    <Input 
                      value={(selectedNode.data as CreativeData).utmContent || ""} 
                      onChange={(e) => updateNodeData(selectedNode.id, { utmContent: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <p className="text-[10px] text-muted-foreground italic mb-3 bg-pink-500/5 p-2 rounded border border-pink-500/10">
                    Dica: Use este nó para visualizar qual anúncio (FB/IG/Google) está gerando mais lucro no final do funil.
                  </p>
                  <Button variant="outline" className="w-full text-red-400 border-red-400/30 hover:bg-red-500/10" onClick={() => deleteNode(selectedNode.id)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir Criativo
                  </Button>
                </div>
              </div>
            )}
            
            {selectedNode.type === "whatsapp" && (
              <div className="space-y-4">
                <Label className="text-xs font-medium uppercase text-muted-foreground tracking-widest">Configuração WhatsApp</Label>
                <div className="space-y-2">
                  <Label className="text-xs">Título da Automação</Label>
                  <Input value={selectedNode.data.label} onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Tempo de Espera (Minutos)</Label>
                  <Input 
                    type="number"
                    value={(selectedNode.data as WhatsAppData).delay || 15} 
                    onChange={(e) => updateNodeData(selectedNode.id, { delay: Number(e.target.value) })} 
                  />
                  <p className="text-[10px] text-muted-foreground italic">Intervalo entre o abandono e o envio da mensagem.</p>
                </div>
                
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                  <p className="text-xs font-bold text-emerald-400">Recuperação 100% Nativa</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Este nó ativa automaticamente o disparo de WhatsApp para carrinhos abandonados vinculados a este funil.
                  </p>
                  <Button 
                    onClick={() => navigate("/admin/whatsapp-recovery")}
                    size="sm"
                    className="w-full h-7 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    Editar Mensagens
                  </Button>
                </div>

                <Button variant="outline" className="w-full text-red-400 border-red-400/30 hover:bg-red-500/10" onClick={() => deleteNode(selectedNode.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Remover Automação
                </Button>
              </div>
            )}
          </aside>
        )}
      </div>
      <AbTestTutorial open={showTutorial} onOpenChange={setShowTutorial} />
    </div>
  );
}

export default function AbTestEditor() {
  return <ReactFlowProvider><EditorInner /></ReactFlowProvider>;
}
