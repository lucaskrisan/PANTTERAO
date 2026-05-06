import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, PartyPopper, Mail, ArrowRight, Loader2, Gift, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getMemberTranslations, type MemberLang } from "@/lib/memberI18n";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";

const confettiColors = ["#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7", "#ec4899"];

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  size: number;
}

interface UpsellOffer {
  id: string;
  title: string;
  description: string;
  discount_percent: number;
  upsell_product: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
  };
}

const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const productName = searchParams.get("product") || "seu produto";
  const method = searchParams.get("method") || "pix";
  const email = searchParams.get("email") || "";
  const productId = searchParams.get("product_id") || "";
  const orderId = searchParams.get("order_id") || "";
  const lang = (searchParams.get("lang") as MemberLang) || "pt";
  const delivery = searchParams.get("delivery") || "panttera";

  const t = getMemberTranslations(lang);
  const isEN = lang === "en";

  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const { trackPurchase } = useFacebookPixel(productId, 0, productName);
  const purchaseFiredRef = useRef(false);
  // deliveryLinks: array of { delivery_type, access_url } for all products in the order
  const [deliveryLinks, setDeliveryLinks] = useState<{ delivery_type: string; access_url: string | null }[]>([]);
  const [appsellLoginUrl, setAppsellLoginUrl] = useState<string | null>(null);
  const [upsellOffers, setUpsellOffers] = useState<UpsellOffer[]>([]);
  const [processingUpsell, setProcessingUpsell] = useState<string | null>(null);
  const [purchasedUpsells, setPurchasedUpsells] = useState<Set<string>>(new Set());

  useEffect(() => {
    const pieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      delay: Math.random() * 0.5,
      size: Math.random() * 8 + 4,
    }));
    setConfetti(pieces);
  }, []);

  // Track Purchase on Success Page (Deduplicated backup)
  useEffect(() => {
    if (!orderId || !productId || purchaseFiredRef.current) return;

    const firePurchase = async () => {
      try {
        const { data: orderData, error } = await supabase
          .from("orders")
          .select("amount, items:order_items(product_id, price, products(name))")
          .eq("id", orderId)
          .single();

        if (error || !orderData) return;

        purchaseFiredRef.current = true;
        const mainItem = (orderData as any).items?.find((i: any) => i.product_id === productId);
        const bumpItems = (orderData as any).items
          ?.filter((i: any) => i.product_id !== productId)
          .map((i: any) => ({
            id: i.product_id,
            price: i.price,
            name: i.products?.name,
          })) || [];

        // amount is the column name, default currency BRL if missing
        trackPurchase((orderData as any).amount, "BRL", orderId, bumpItems);
      } catch (err) {
        console.error("[CheckoutSuccess] Error firing backup purchase pixel:", err);
      }
    };

    firePurchase();
  }, [orderId, productId, trackPurchase]);

  // Fetch all delivery links for the order (main product + bumps)
  useEffect(() => {
    let isCancelled = false;

    const fetchLinks = async () => {
      try {
        if (!orderId) {
          if (delivery === "appsell" && productId) {
            try {
              const { data, error } = await (supabase.rpc as any)("get_appsell_login_url", { p_product_id: productId });
              if (isCancelled) return;
              if (error) throw error;
              if (typeof data === "string" && data) {
                setAppsellLoginUrl(data);
                setDeliveryLinks([{ delivery_type: "appsell", access_url: data }]);
              }
            } catch (err) {
              console.error("[checkout-success] appsell login error:", err);
              if (!isCancelled) {
                toast.error(isEN 
                  ? "Could not load access link. Please check your email." 
                  : "Não foi possível carregar o link de acesso. Verifique seu e-mail.");
              }
            }
          } else {
            setDeliveryLinks([{ delivery_type: delivery, access_url: null }]);
          }
          return;
        }

        const { data, error } = await (supabase.rpc as any)("get_order_delivery_links", { p_order_id: orderId });
        if (isCancelled) return;
        if (error) throw error;

        if (data && data.length > 0) {
          setDeliveryLinks(data);
          const appsell = data.find((d: any) => d.delivery_type === "appsell");
          if (appsell?.access_url) setAppsellLoginUrl(appsell.access_url);
        } else {
          setDeliveryLinks([{ delivery_type: delivery, access_url: null }]);
        }
      } catch (err) {
        console.error("[checkout-success] Error fetching links:", err);
        if (!isCancelled) {
          toast.error(isEN ? "Failed to load access links. Contact support." : "Falha ao carregar links de acesso. Contate o suporte.");
          setDeliveryLinks([{ delivery_type: delivery, access_url: null }]);
        }
      }
    };

    fetchLinks();
    return () => { isCancelled = true; };
  }, [orderId, delivery, productId, isEN]);

  // Load upsell offers
  useEffect(() => {
    if (!productId || method !== "credit_card" || !orderId) return;

    const loadUpsells = async () => {
      const { data } = await supabase
        .from("upsell_offers" as any)
        .select("id, title, description, discount_percent, upsell_product:products!upsell_offers_upsell_product_id_fkey(id, name, price, image_url)")
        .eq("product_id", productId)
        .eq("active", true)
        .order("sort_order");

      if (data && data.length > 0) {
        setUpsellOffers(data as any);
      }
    };
    loadUpsells();
  }, [productId, method, orderId]);

  const handleUpsellBuy = async (offer: UpsellOffer) => {
    if (!orderId) return;
    setProcessingUpsell(offer.id);

    try {
      const { data, error } = await supabase.functions.invoke("process-upsell", {
        body: {
          order_id: orderId,
          upsell_product_id: offer.upsell_product.id,
          customer_email: email,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.success) {
        setPurchasedUpsells((prev) => new Set(prev).add(offer.id));
        toast.success(t.upsellSuccess(offer.upsell_product.name));

        // Refresh delivery links so AppSell/Panttera CTAs for the new upsell appear
        try {
          const { data: links } = await (supabase.rpc as any)("get_order_delivery_links", { p_order_id: orderId });
          if (links && links.length > 0) {
            setDeliveryLinks(links);
            const appsell = links.find((d: any) => d.delivery_type === "appsell");
            if (appsell?.access_url) setAppsellLoginUrl(appsell.access_url);
          }
        } catch {
          /* ignore — toast already shown */
        }
      } else {
        throw new Error(t.upsellError);
      }
    } catch (err: any) {
      console.error("Upsell error:", err);
      toast.error(err.message || t.upsellError);
    } finally {
      setProcessingUpsell(null);
    }
  };

  const getUpsellPrice = (offer: UpsellOffer) => {
    const original = offer.upsell_product.price;
    if (offer.discount_percent > 0) {
      return Math.round(original * (1 - offer.discount_percent / 100) * 100) / 100;
    }
    return original;
  };

  const formatPrice = (value: number) => {
    if (isEN) return `$${value.toFixed(2)}`;
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  const activeUpsells = upsellOffers.filter((o) => !purchasedUpsells.has(o.id));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 overflow-hidden relative">
      {/* Confetti */}
      {confetti.map((piece) => (
        <motion.div
          key={piece.id}
          className="absolute top-0 rounded-sm pointer-events-none"
          style={{
            left: `${piece.x}%`,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: "100vh", opacity: 0, rotate: 360 * (Math.random() > 0.5 ? 1 : -1) }}
          transition={{ duration: 2.5 + Math.random(), delay: piece.delay, ease: "easeIn" }}
        />
      ))}

      <motion.div
        className="max-w-md w-full text-center space-y-6 z-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
        </motion.div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <PartyPopper className="w-5 h-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              {method === "credit_card" ? t.paymentApproved : t.pixGenerated}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {method === "credit_card"
              ? t.purchaseConfirmed(productName)
              : t.pixPending(productName)}
          </p>
        </div>

        {email && (
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <Mail className="w-5 h-5 text-primary shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">{t.checkEmail}</p>
              <p className="text-xs text-muted-foreground">
                {t.sentDetails(email)} <strong>{email}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Upsell Offers */}
        <AnimatePresence>
          {activeUpsells.length > 0 && (
            <motion.div
              className="space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              <div className="flex items-center justify-center gap-2 text-primary">
                <Gift className="w-4 h-4" />
                <p className="text-sm font-semibold uppercase tracking-wide">{t.exclusiveOffer}</p>
              </div>

              {activeUpsells.map((offer) => {
                const finalPrice = getUpsellPrice(offer);
                const isProcessing = processingUpsell === offer.id;

                return (
                  <motion.div
                    key={offer.id}
                    className="bg-card border-2 border-primary/20 rounded-xl p-4 space-y-3 text-left"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, height: 0 }}
                    layout
                  >
                    <div className="flex items-start gap-3">
                      {offer.upsell_product.image_url ? (
                        <img
                          src={offer.upsell_product.image_url}
                          alt=""
                          className="w-14 h-14 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <ShoppingBag className="w-6 h-6 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">
                          {offer.title || offer.upsell_product.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{offer.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {offer.discount_percent > 0 && (
                            <span className="text-xs line-through text-muted-foreground">
                              {formatPrice(offer.upsell_product.price)}
                            </span>
                          )}
                          <span className="text-sm font-bold text-primary">
                            {formatPrice(finalPrice)}
                          </span>
                          {offer.discount_percent > 0 && (
                            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
                              -{offer.discount_percent}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full gap-2"
                      onClick={() => handleUpsellBuy(offer)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t.processing}
                        </>
                      ) : (
                        <>
                          <Gift className="w-4 h-4" />
                          {t.buyOneClick}
                        </>
                      )}
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground">
                      {t.chargedSameCard}
                    </p>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Purchased upsells confirmation */}
        {purchasedUpsells.size > 0 && (
          <motion.div
            className="bg-primary/5 border border-primary/20 rounded-xl p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-sm text-primary font-medium">
              ✅ {t.additionalPurchased(purchasedUpsells.size)}
            </p>
          </motion.div>
        )}

        {/* Access CTAs — one per delivery type in the order (main + bumps) */}
        <div className="space-y-3">
          {deliveryLinks.map((link, idx) => (
            link.delivery_type === "appsell" && link.access_url ? (
              <div key={`appsell-${idx}`} className="bg-card border-2 border-primary/30 rounded-xl p-5 text-left">
                <p className="text-sm font-bold text-foreground mb-1">
                  🚀 {isEN ? "Access your purchase" : "Acesse sua compra"}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {isEN
                    ? "Click below to access the platform and enjoy your content."
                    : "Clique abaixo para acessar a plataforma e aproveitar seu conteúdo."}
                </p>
                <a href={link.access_url} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gap-2">
                    {isEN ? "Access now" : "Acessar agora"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
              </div>
            ) : link.delivery_type === "panttera" ? (
              <div key={`panttera-${idx}`} className="bg-card border-2 border-primary/30 rounded-xl p-5 text-left">
                <p className="text-sm font-bold text-foreground mb-1">
                  🎓 {t.successCreateAccountTitle}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {t.successCreateAccountDesc}
                </p>
                <Link to="/minha-conta">
                  <Button className="w-full gap-2">
                    {t.successCreateAccountButton}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            ) : link.delivery_type === "email" ? (
              <div key={`email-${idx}`} className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground text-center">
                  {isEN
                    ? "Your access details have been sent to your email."
                    : "Os detalhes de acesso foram enviados para o seu e-mail."}
                </p>
              </div>
            ) : null
          ))}
          {/* Fallback when deliveryLinks is still loading or empty */}
          {deliveryLinks.length === 0 && (
            <div className="bg-card border-2 border-primary/30 rounded-xl p-5 text-left">
              <p className="text-sm font-bold text-foreground mb-1">🎓 {t.successCreateAccountTitle}</p>
              <p className="text-xs text-muted-foreground mb-3">{t.successCreateAccountDesc}</p>
              <Link to="/minha-conta">
                <Button className="w-full gap-2">
                  {t.successCreateAccountButton}<ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div className="pt-2">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              {isEN ? "Back to home" : "Voltar ao início"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default CheckoutSuccess;
