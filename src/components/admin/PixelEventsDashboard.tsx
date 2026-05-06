// @ts-nocheck
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Radio } from "lucide-react";
import { format, subHours, startOfHour, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import CustomerJourneyFeed from "./CustomerJourneyFeed";
import NinaTrackingHeader from "./tracking/NinaTrackingHeader";
import TickerBar from "./tracking/TickerBar";

import SmartAlertsPanel from "./tracking/SmartAlertsPanel";
import EventFeedCard from "./tracking/EventFeedCard";
import EventsPerMin from "./tracking/EventsPerMin";

import { ninaToast, ninaPurchaseToast } from "./tracking/NinaToast";
import { playNotificationSound } from "@/lib/notificationSounds";
import { useGeo } from "@/hooks/useGeo";
import ninaAvatar from "@/assets/pantera-mascot.png";

interface PixelEvent {
  id: string;
  product_id: string;
  event_name: string;
  source: string;
  created_at: string;
  customer_name: string | null;
  visitor_id: string | null;
  event_id: string | null;
  event_value: number | null;
  customer_country: string | null;
  customer_city: string | null;
}

interface GroupedEvent {
  event_id: string;
  event_name: string;
  product_id: string;
  customer_name: string | null;
  created_at: string;
  sources: string[];
  ids: string[];
  event_value: number | null;
  customer_country: string | null;
  customer_city: string | null;
  visitor_id: string | null;
}

interface Props {
  products: { id: string; name: string }[];
  userId?: string;
  initialFilter?: string;
}

const ORDERED_EVENT_NAMES = [
  "PageView", "ViewContent", "InitiateCheckout", "Lead", "AddPaymentInfo", "AddToCart", "Purchase",
];

const NINA_WELCOME_KEY = "nina-tracking-welcome-shown";

const FEED_CACHE_KEY = "nina-tracking-feed-cache";
const FEED_EXPIRY_MS = 10 * 60 * 1000; // 10 min
const PURCHASE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h para vendas do dia

const PixelEventsDashboard = ({ products, userId, initialFilter = "all" }: Props) => {
  const [filterProduct, setFilterProduct] = useState(initialFilter);

  // Sincroniza o filtro interno se o prop mudar (ex: mudou no header da página pai)
  useEffect(() => {
    if (initialFilter) {
      setFilterProduct(initialFilter);
    }
  }, [initialFilter]);
  const [period, setPeriod] = useState("24h");
  const cacheKey = (uid: string | undefined, fp: string) =>
    `${FEED_CACHE_KEY}-${uid || "anon"}-${fp}`;
  const [events, setEvents] = useState<PixelEvent[]>(() => {
    // Hidrata do sessionStorage só do MESMO filtro de produto
    try {
      const cached = sessionStorage.getItem(cacheKey(userId, "all"));
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [feedView, setFeedView] = useState<"feed" | "journeys">("feed");
  const [eventsLastHour, setEventsLastHour] = useState(0);

  const [initialLoading, setInitialLoading] = useState(() => {
    // Só mostra skeleton no primeiro mount sem cache
    try {
      const cached = sessionStorage.getItem(cacheKey(userId, "all"));
      return !cached;
    } catch {
      return true;
    }
  });

  // Quando o filtro de produto mudar, limpa o feed imediatamente para
  // evitar mostrar eventos do produto anterior enquanto o loadEvents roda.
  useEffect(() => {
    setEvents([]);
    setInitialLoading(true);
    seenEventIdsRef.current = new Set();
  }, [filterProduct]);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const welcomeShownRef = useRef(false);
  const geo = useGeo();


  const getHoursBack = () =>
    period === "1h" ? 1 : period === "6h" ? 6 : period === "24h" ? 24 : 168;

  const loadEvents = async () => {
    if (!userId) {
      console.log("[NinaTracking] Aguardando userId...");
      return;
    }
    const since = subHours(new Date(), getHoursBack()).toISOString();

    let feedQuery = supabase
      .from("pixel_events")
      .select("id, product_id, event_name, source, created_at, customer_name, visitor_id, event_id, event_value, customer_country, customer_city")
      .gte("created_at", since)
      .eq("user_id", userId)
      .eq("is_bot", false)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (filterProduct !== "all") feedQuery = feedQuery.eq("product_id", filterProduct);
    const { data: feedData, error: feedError } = await feedQuery;
    if (feedError) console.error("[NinaTracking] feed error:", feedError);
    const real = (feedData || []).filter((e) => !e.visitor_id?.startsWith("sim_"));
    console.log("[NinaTracking] eventos carregados:", real.length, "de", feedData?.length || 0, "userId:", userId);
    setEvents(real as PixelEvent[]);

    const counts: Record<string, number> = {};
    await Promise.all(
      ORDERED_EVENT_NAMES.map(async (eventName) => {
        let q = supabase
          .from("pixel_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since)
          .eq("is_bot", false)
          .eq("event_name", eventName);
        if (userId) q = q.eq("user_id", userId);
        if (filterProduct !== "all") q = q.eq("product_id", filterProduct);
        const { count } = await q;
        counts[eventName] = count || 0;
      }),
    );
    setEventCounts(counts);

    // Last hour count for footer
    const lastHour = subHours(new Date(), 1).toISOString();
    let lhQ = supabase
      .from("pixel_events")
      .select("id", { count: "exact", head: true })
      .eq("is_bot", false)
      .gte("created_at", lastHour);
    if (userId) lhQ = lhQ.eq("user_id", userId);
    if (filterProduct !== "all") lhQ = lhQ.eq("product_id", filterProduct);
    const { count: lhCount } = await lhQ;
    setEventsLastHour(lhCount || 0);
    setInitialLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, [filterProduct, period, userId]);

  // Persiste o feed em sessionStorage para sobreviver à navegação entre páginas.
  // Aplica regra: eventos com Purchase no mesmo visitor_id ficam SEMPRE,
  // os demais expiram após 10 min sem nova atividade.
  useEffect(() => {
    if (!userId || events.length === 0) return;
    try {
      const now = Date.now();
      const visitorsWithPurchase = new Set(
        events.filter((e) => e.event_name === "Purchase").map((e) => e.visitor_id).filter(Boolean),
      );
      const filtered = events.filter((e) => {
        if (visitorsWithPurchase.has(e.visitor_id)) return true; // venda: persiste
        return now - new Date(e.created_at).getTime() < FEED_EXPIRY_MS; // resto: 10 min
      });
      sessionStorage.setItem(cacheKey(userId, filterProduct), JSON.stringify(filtered.slice(0, 500)));
    } catch {}
  }, [events, userId, filterProduct]);

  // Welcome toast (uma vez por dia)
  useEffect(() => {
    if (welcomeShownRef.current) return;
    if (!userId) return;
    const todayKey = `${NINA_WELCOME_KEY}-${userId}-${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(todayKey)) return;

    const showWelcome = async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      let q = supabase
        .from("pixel_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart);
      if (userId) q = q.eq("user_id", userId);
      const { count } = await q;
      const n = count || 0;
      welcomeShownRef.current = true;
      sessionStorage.setItem(todayKey, "1");
      setTimeout(() => {
        ninaToast(
          n > 0
            ? `Bem-vindo de volta. Hoje já registrei ${n} eventos pra você.`
            : "Bem-vindo de volta. Estou monitorando seu tracking em tempo real.",
        );
      }, 800);
    };
    showWelcome();
  }, [userId]);

  // Realtime
  useEffect(() => {
    const since = subHours(new Date(), getHoursBack()).getTime();

    const channel = supabase
      .channel(`pixel-events-realtime-${filterProduct}-${period}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pixel_events" }, (payload) => {
        const ne = payload.new as any;
        if (userId && ne.user_id !== userId) return;
        if (filterProduct !== "all" && ne.product_id !== filterProduct) return;
        if (ne.visitor_id?.startsWith("sim_")) return;
        if (ne.is_bot === true) return; // 🤖 ignora bots no realtime
        if (new Date(ne.created_at).getTime() < since) return;

        setEvents((prev) => [ne, ...prev].slice(0, 500));

        if (ne.event_name) {
          const dedupKey = ne.event_id || ne.id;
          if (!seenEventIdsRef.current.has(dedupKey)) {
            seenEventIdsRef.current.add(dedupKey);
            setEventCounts((prev) => ({ ...prev, [ne.event_name]: (prev[ne.event_name] || 0) + 1 }));
            setEventsLastHour((prev) => prev + 1);

            // Ka-ching + Nina toast no Purchase
            if (ne.event_name === "Purchase") {
              playNotificationSound("kaching");
              // Buscar valor da order vinculada (best-effort)
              supabase
                .from("orders")
                .select("amount")
                .eq("product_id", ne.product_id)
                .eq("status", "paid")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()
                .then(({ data }) => {
                  if (data?.amount) ninaPurchaseToast(Number(data.amount));
                  else ninaToast("Detectei uma venda 🎉");
                });
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterProduct, period, userId]);

  const recentTimestamps = useMemo(
    () => events.map((e) => new Date(e.created_at).getTime()),
    [events],
  );

  const chartData = useMemo(() => {
    const hoursBack = period === "1h" ? 1 : period === "6h" ? 6 : period === "24h" ? 24 : 168;
    const buckets = period === "7d" ? 7 : Math.min(hoursBack, 24);
    const now = new Date();
    const data: { label: string; total: number; purchases: number }[] = [];
    const inBucket = (ds: Date, de: Date) => {
      let total = 0;
      let purchases = 0;
      for (const e of events) {
        const d = new Date(e.created_at);
        if (d >= ds && d < de) {
          total++;
          if (e.event_name === "Purchase") purchases++;
        }
      }
      return { total, purchases };
    };
    if (period === "7d") {
      for (let i = buckets - 1; i >= 0; i--) {
        const ds = new Date(now);
        ds.setDate(ds.getDate() - i);
        ds.setHours(0, 0, 0, 0);
        const de = new Date(ds);
        de.setDate(de.getDate() + 1);
        data.push({ label: format(ds, "dd/MM", { locale: ptBR }), ...inBucket(ds, de) });
      }
    } else {
      for (let i = buckets - 1; i >= 0; i--) {
        const hs = startOfHour(subHours(now, i));
        const he = startOfHour(subHours(now, i - 1));
        data.push({ label: format(hs, "HH:mm"), ...inBucket(hs, he) });
      }
    }
    return data;
  }, [events, period]);

  const recentEvents = events.slice(0, 80);

  const groupedEvents = useMemo(() => {
    const map = new Map<string, GroupedEvent>();
    const ungroupedMap = new Map<string, GroupedEvent>();
    recentEvents.forEach((e) => {
      if (e.event_id) {
        if (map.has(e.event_id)) {
          const g = map.get(e.event_id)!;
          if (!g.sources.includes(e.source)) g.sources.push(e.source);
          g.ids.push(e.id);
          if (e.customer_name && !g.customer_name) g.customer_name = e.customer_name;
          if (e.event_value != null && g.event_value == null) g.event_value = e.event_value;
          if (e.customer_country && !g.customer_country) g.customer_country = e.customer_country;
          if (e.customer_city && !g.customer_city) g.customer_city = e.customer_city;
        } else {
          map.set(e.event_id, {
            event_id: e.event_id,
            event_name: e.event_name,
            product_id: e.product_id,
            customer_name: e.customer_name,
            created_at: e.created_at,
            sources: [e.source],
            ids: [e.id],
            event_value: e.event_value,
            customer_country: e.customer_country,
            customer_city: e.customer_city,
            visitor_id: e.visitor_id,
          });
        }
      } else {
        const day = new Date(e.created_at).toISOString().split('T')[0];
        // For events without a formal event_id (like older records or generic captures),
        // we use a more precise key including the second to prevent merging distinct actions 
        // into a single "dual" row when they are actually different events from the same source.
        const second = Math.floor(new Date(e.created_at).getTime() / 1000);
        const deduKey = e.visitor_id
          ? `${second}_${e.visitor_id}_${e.event_name}`
          : `anon_${e.id}`;
        if (!ungroupedMap.has(deduKey)) {
          ungroupedMap.set(deduKey, {
            event_id: e.id,
            event_name: e.event_name,
            product_id: e.product_id,
            customer_name: e.customer_name,
            created_at: e.created_at,
            sources: [e.source],
            ids: [e.id],
            event_value: e.event_value,
            customer_country: e.customer_country,
            customer_city: e.customer_city,
            visitor_id: e.visitor_id,
          });
        } else {
          const g = ungroupedMap.get(deduKey)!;
          if (!g.sources.includes(e.source)) g.sources.push(e.source);
          g.ids.push(e.id);
        }
      }
    });
    return [...map.values(), ...ungroupedMap.values()]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100);
  }, [recentEvents, period]);

  return (
    <div id="nina-tracking-root" className="space-y-5">
      {/* ── Nina Tracking™ Header ── */}
      <NinaTrackingHeader
        period={period}
        onPeriodChange={setPeriod}
        filterProduct={filterProduct}
        onProductChange={setFilterProduct}
        products={products}
      />

      {/* ── Live Ticker (Purchases) ── */}
      <TickerBar userId={userId} filterProduct={filterProduct} />


      {/* ── Smart Alerts ── */}
      <SmartAlertsPanel userId={userId} filterProduct={filterProduct} />

      {/* ── Feed dominante em largura total ── */}
      <div>
        {/* ═══ FEED PRINCIPAL ═══ */}
        <section className="rounded-xl bg-[#0d0f1a] border border-white/[0.06] flex flex-col overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
          {/* Header do feed — refinado, sem barra preta */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-gradient-to-r from-[#14B8A6]/[0.04] via-transparent to-[#D4AF37]/[0.04]">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <motion.div
                  className="absolute w-6 h-6 rounded-full bg-emerald-500/20"
                  animate={{ scale: [1, 1.9, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 relative z-10 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">Live Stream</span>
                <span className="text-[10px] text-muted-foreground font-mono inline-flex items-center gap-1.5">
                  {groupedEvents.length} sinais ·{" "}
                  <EventsPerMin timestamps={recentTimestamps} />
                </span>
              </div>
              <div className="ml-1 flex items-center bg-black/40 rounded-md p-0.5 border border-white/[0.06]">
                <button
                  onClick={() => setFeedView("feed")}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
                    feedView === "feed"
                      ? "bg-gradient-to-r from-[#14B8A6]/30 to-[#D4AF37]/30 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Feed
                </button>
                <button
                  onClick={() => setFeedView("journeys")}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
                    feedView === "journeys"
                      ? "bg-gradient-to-r from-[#14B8A6]/30 to-[#D4AF37]/30 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Jornadas
                </button>
              </div>

            </div>
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground/70 font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80" /> Pixel
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400/80" /> CAPI
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" /> Dual
              </span>
            </div>
          </div>

          {/* Body do feed — generoso e dominante */}
          <div className="overflow-y-auto flex-1 max-h-[820px] min-h-[600px] custom-scrollbar">
            {feedView === "journeys" ? (
              <CustomerJourneyFeed events={events} products={products} />
            ) : initialLoading && groupedEvents.length === 0 ? (
              <div className="divide-y divide-border/20">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 animate-pulse"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="w-8 h-8 rounded-md bg-muted/40 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="h-2.5 rounded bg-muted/40 w-1/3" />
                      <div className="h-2 rounded bg-muted/30 w-2/3" />
                    </div>
                    <div className="w-12 h-2.5 rounded bg-muted/30 shrink-0" />
                  </div>
                ))}
              </div>
            ) : groupedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4 px-8">
                <motion.div
                  animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="relative"
                >
                  <div className="absolute inset-0 blur-2xl bg-[#14B8A6]/30 rounded-full" />
                  <Radio className="w-12 h-12 text-[#14B8A6] relative z-10" />
                </motion.div>
                <div className="text-center space-y-1.5">
                  <p className="text-base font-semibold bg-gradient-to-r from-[#14B8A6] to-[#D4AF37] bg-clip-text text-transparent">
                    Nina escutando o mercado
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Cada PageView, Checkout e Purchase aparece aqui no instante exato em que acontece.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300">
                    Realtime conectado
                  </span>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="popLayout" initial={false}>
                {groupedEvents.map((g, i) => {
                  // Time separator: when gap > 3 min between consecutive events
                  const prev = groupedEvents[i - 1];
                  const showSep =
                    !!prev &&
                    new Date(prev.created_at).getTime() - new Date(g.created_at).getTime() >
                      3 * 60 * 1000;
                  return (
                    <div key={g.event_id}>
                      {showSep && (
                        <div
                          className="flex items-center gap-3 px-4 py-1.5 select-none"
                          aria-hidden
                        >
                          <span className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
                            {format(new Date(g.created_at), "HH:mm")}
                          </span>
                          <span className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                        </div>
                      )}
                      <EventFeedCard
                        group={g}
                        productName={products.find((p) => p.id === g.product_id)?.name}
                        geo={{
                          country: g.customer_country || geo.country,
                          city: g.customer_city || geo.city,
                        }}
                      />
                    </div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </section>

      </div>

      {/* ── Nina Footer ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-card/40 border border-border/20">
        <div className="flex items-center gap-2.5">
          <img
            src={ninaAvatar}
            alt="Panttera"
            width={20}
            height={20}
            loading="lazy"
            className="w-5 h-5 rounded-full ring-1 ring-[#D4AF37]/40"
          />
          <span className="text-[11px] text-muted-foreground">
            <span
              className="font-semibold"
              style={{
                background: "linear-gradient(135deg, #14B8A6 0%, #D4AF37 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Panttera Tracking™
            </span>
            {" · Realtime ativo · "}
            <span className="font-mono tabular-nums text-foreground">{eventsLastHour}</span>
            {" eventos na última hora"}
          </span>
        </div>
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-emerald-400"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
    </div>
  );
};

export default PixelEventsDashboard;
