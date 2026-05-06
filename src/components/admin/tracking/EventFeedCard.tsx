import { motion } from "framer-motion";
import { Eye, ShoppingCart, UserCheck, CreditCard, Zap, MousePointerClick, BookOpen, Trophy } from "lucide-react";
import { format } from "date-fns";

type Tier = "hero" | "mid" | "base";

const EVENT_CONFIG: Record<string, { label: string; color: string; icon: any; tier: Tier }> = {
  PageView: { label: "PageView", color: "#64748b", icon: Eye, tier: "base" },
  ViewContent: { label: "ViewContent", color: "#94a3b8", icon: BookOpen, tier: "base" },
  InitiateCheckout: { label: "Checkout", color: "#fbbf24", icon: ShoppingCart, tier: "mid" },
  Lead: { label: "Lead", color: "#60a5fa", icon: UserCheck, tier: "mid" },
  AddPaymentInfo: { label: "Payment", color: "#a78bfa", icon: CreditCard, tier: "mid" },
  AddToCart: { label: "Add Cart", color: "#f472b6", icon: MousePointerClick, tier: "mid" },
  Purchase: { label: "COMPRA CONFIRMADA", color: "#D4AF37", icon: Trophy, tier: "hero" },
};

function flagFromCountry(code?: string | null) {
  if (!code || code.length !== 2) return "🌐";
  const A = 0x1f1e6;
  const offset = (c: string) => c.toUpperCase().charCodeAt(0) - 65;
  return String.fromCodePoint(A + offset(code[0])) + String.fromCodePoint(A + offset(code[1]));
}

function formatBRL(v?: number | null) {
  if (v == null || isNaN(Number(v))) return null;
  const n = Number(v);
  // Heurística temporária até event_currency existir: valores baixos ~ USD.
  const isUsdLike = n > 0 && n < 50;
  return new Intl.NumberFormat(isUsdLike ? "en-US" : "pt-BR", {
    style: "currency",
    currency: isUsdLike ? "USD" : "BRL",
  }).format(n);
}

interface Props {
  group: {
    event_id: string;
    event_name: string;
    product_id: string;
    customer_name: string | null;
    created_at: string;
    sources: string[];
    event_value?: number | null;
  };
  productName?: string;
  geo?: { country?: string | null; city?: string | null };
}

const EventFeedCard = ({ group, productName, geo }: Props) => {
  const cfg = EVENT_CONFIG[group.event_name] || { label: group.event_name, color: "#94a3b8", icon: Zap, tier: "base" as Tier };
  const Icon = cfg.icon;
  const hasBrowser = group.sources.includes("browser");
  const hasServer = group.sources.includes("server");
  const isDual = hasBrowser && hasServer;
  const isHero = cfg.tier === "hero";
  const isMid = cfg.tier === "mid";
  const isBase = cfg.tier === "base";
  const valueStr = isHero ? formatBRL(group.event_value) : null;

  // ── HERO (Purchase) — dramatic 72px card with golden irradiating pulse ──
  if (isHero) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 24, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative flex items-center gap-3.5 px-4 border-b border-border/40 last:border-b-0 hover:brightness-110 transition-all overflow-hidden"
        style={{
          minHeight: 72,
          background:
            "linear-gradient(90deg, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.04) 55%, transparent 100%)",
          borderLeft: "4px solid #D4AF37",
        }}
      >
        {/* Golden irradiating pulse — 1.2s on entry */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{
            background:
              "radial-gradient(circle at 8% 50%, rgba(212,175,55,0.55) 0%, rgba(212,175,55,0.18) 22%, transparent 55%)",
          }}
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute inset-y-0 left-0 w-1"
          initial={{ boxShadow: "0 0 24px 6px rgba(212,175,55,0.9)" }}
          animate={{ boxShadow: "0 0 0px 0px rgba(212,175,55,0)" }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          aria-hidden
        />

        <div
          className="p-2.5 rounded-md shrink-0 relative z-10"
          style={{ backgroundColor: "rgba(212,175,55,0.22)" }}
        >
          <Icon className="w-5 h-5" style={{ color: "#D4AF37" }} />
        </div>

        <div className="flex-1 min-w-0 relative z-10">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[10px] font-bold tracking-[0.14em] uppercase"
              style={{ color: "#D4AF37" }}
            >
              {cfg.label}
            </span>
            {isDual ? (
              <span
                className="inline-flex items-center text-[12px] font-bold leading-none"
                style={{ color: "#D4AF37", textShadow: "0 0 6px rgba(212,175,55,0.6)" }}
                title="Confirmado em Pixel + CAPI"
                aria-label="Dual confirmation"
              >
                ✓✓
              </span>
            ) : hasBrowser ? (
              <span
                className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded"
                title="Apenas Pixel — CAPI ainda não recebido"
              >
                PIXEL
              </span>
            ) : (
              <span
                className="text-[9px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded"
                title="Apenas CAPI — sem Pixel correspondente"
              >
                CAPI
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base shrink-0" aria-hidden>
              {flagFromCountry(geo?.country)}
            </span>
            <span className="text-sm font-bold text-foreground truncate">
              {group.customer_name || "Cliente"}
            </span>
            {geo?.city && (
              <span className="text-[11px] text-muted-foreground">· {geo.city}</span>
            )}
          </div>
          {productName && (
            <div className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
              {productName} ·{" "}
              <span className="font-mono">{format(new Date(group.created_at), "HH:mm:ss")}</span>
            </div>
          )}
        </div>

        {valueStr && (
          <div className="shrink-0 text-right relative z-10">
            <div
              className="font-bold font-mono tabular-nums leading-none"
              style={{
                fontSize: 22,
                color: "#D4AF37",
                textShadow: "0 0 20px rgba(212,175,55,0.6), 0 0 4px rgba(212,175,55,0.4)",
              }}
            >
              {valueStr}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // ── MID (Checkout / Lead / Payment / AddToCart) ──
  if (isMid) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative flex items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-all"
        style={{
          borderLeft: `2px solid ${cfg.color}`,
          background: `linear-gradient(90deg, ${cfg.color}0a 0%, transparent 50%)`,
        }}
      >
        <div className="p-1.5 rounded-md shrink-0" style={{ backgroundColor: `${cfg.color}18` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm shrink-0" aria-hidden>
            {flagFromCountry(geo?.country)}
          </span>
          <span className="text-xs font-semibold text-foreground truncate">
            {group.customer_name || "Visitante"}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          {productName && (
            <span className="text-[10px] text-muted-foreground truncate">· {productName}</span>
          )}
          {geo?.city && (
            <span className="text-[10px] text-muted-foreground/70">· {geo.city}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isDual ? (
            <span
              className="text-[12px] font-bold leading-none"
              style={{ color: "#D4AF37", textShadow: "0 0 6px rgba(212,175,55,0.5)" }}
              title="Confirmado em Pixel + CAPI"
              aria-label="Dual confirmation"
            >
              ✓✓
            </span>
          ) : hasBrowser ? (
            <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
              PIXEL
            </span>
          ) : (
            <span className="text-[9px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
              CAPI
            </span>
          )}
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            {format(new Date(group.created_at), "HH:mm:ss")}
          </span>
        </div>
      </motion.div>
    );
  }

  // ── BASE (PageView / ViewContent) ──
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.85 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="group relative flex items-center gap-2.5 px-4 py-1.5 border-b border-border/20 last:border-b-0 hover:bg-muted/20 hover:opacity-100 transition-all"
    >
      <Icon className="w-3 h-3 shrink-0" style={{ color: cfg.color }} />
      <span className="text-xs shrink-0 opacity-70" aria-hidden>
        {flagFromCountry(geo?.country)}
      </span>
      <span className="text-[11px] text-muted-foreground truncate flex-1 min-w-0">
        <span className="font-medium text-foreground/70">{group.customer_name || "Visitante"}</span>
        <span className="mx-1.5">·</span>
        <span style={{ color: cfg.color }} className="font-semibold">{cfg.label}</span>
        {productName && <span className="ml-1.5">· {productName}</span>}
      </span>
      <span className="text-[10px] text-muted-foreground/60 font-mono tabular-nums shrink-0">
        {format(new Date(group.created_at), "HH:mm:ss")}
      </span>
    </motion.div>
  );
};

export default EventFeedCard;
