import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { getStateFromPhone } from "@/lib/dddToState";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Lock, ArrowRight, Loader2, Shield } from "lucide-react";
import CountrySelector from "@/components/checkout/CountrySelector";
import CustomerForm, {
  type CustomerData,
  isValidCPF,
} from "@/components/checkout/CustomerForm";
import PixPayment from "@/components/checkout/PixPayment";
import PixModal from "@/components/checkout/PixModal";
import CreditCardForm, {
  type CreditCardData,
} from "@/components/checkout/CreditCardForm";

import type { StripePaymentElementHandle } from "@/components/checkout/StripePaymentElement";
const StripePaymentElement = lazy(
  () => import("@/components/checkout/StripePaymentElement"),
);
import PaymentTabs from "@/components/checkout/PaymentTabs";
import CountdownTimer from "@/components/checkout/CountdownTimer";
import CouponField from "@/components/checkout/CouponField";
import PriceSummary from "@/components/checkout/PriceSummary";
import OrderBumps from "@/components/checkout/OrderBumps";
import TrustFooter from "@/components/checkout/TrustFooter";
import CheckoutBuilderRenderer from "@/components/checkout/CheckoutBuilderRenderer";
import pagoSeguroStripe from "@/assets/pago-seguro-stripe.png";
import {
  Breadcrumb as StepBreadcrumb,
  type StepBreadcrumbStep,
} from "@/components/ui/step-breadcrumb";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFacebookPixel,
  getVisitorId,
  getAttributionUtms,
} from "@/hooks/useFacebookPixel";
import { useAbandonedCart } from "@/hooks/useAbandonedCart";
import { useCheckoutPresence } from "@/hooks/useCheckoutPresence";
import { useGeo } from "@/hooks/useGeo";
import { useLocalCurrency } from "@/hooks/useLocalCurrency";
import { getCheckoutTranslations } from "@/lib/checkoutI18n";
import type { BuilderComponent } from "@/components/checkout-builder/types";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  is_subscription: boolean;
  billing_cycle: string;
  user_id: string | null;
  show_coupon?: boolean;
  currency?: string;
  delivery_method?: string | null;
}

interface OrderBump {
  id: string;
  call_to_action: string;
  title: string;
  description: string;
  use_product_image: boolean;
  bump_product: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
  };
}

interface CheckoutSettings {
  logo_url: string | null;
  primary_color: string | null;
  custom_css: string | null;
  company_name: string | null;
}
interface CouponData {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
}

const Checkout = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedConfigId = useMemo(
    () => new URLSearchParams(location.search).get("config"),
    [location.search],
  );
  const [product, setProduct] = useState<Product | null>(null);
  const isUSD = product?.currency === "USD";
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [producerBlocked, setProducerBlocked] = useState(false);
  const [noGateway, setNoGateway] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pixData, setPixData] = useState<{
    qrCodeUrl?: string;
    pixCode?: string;
    orderId?: string;
  } | null>(null);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const {
    trackPurchase,
    trackSubscribe,
    trackAddPaymentInfo,
    trackAddToCart,
    trackAddToCartMain,
    trackLead,
    setAdvancedMatching,
  } = useFacebookPixel(
    productId,
    product?.price,
    product?.name,
    product?.currency,
  );
  const [orderBumps, setOrderBumps] = useState<OrderBump[]>([]);
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [builderLayout, setBuilderLayout] = useState<BuilderComponent[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"credit_card" | "pix">(
    "pix",
  );
  const [checkoutSettings, setCheckoutSettings] =
    useState<CheckoutSettings | null>(null);
  const [isOwnerSuperAdmin, setIsOwnerSuperAdmin] = useState(false);
  const [coupon, setCoupon] = useState<CouponData | null>(null);
  const {
    country: geoCountry,
    city: geoCity,
    state: geoState,
    zip: geoZip,
  } = useGeo();
  const [selectedCountry, setSelectedCountry] = useState(geoCountry || "US");

  const prefill = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      name: params.get("name") || "",
      email: params.get("email") || "",
      phone: params.get("phone") || "",
      cpf: params.get("cpf") || "",
    };
  }, [location.search]);

  const cartId = useMemo(
    () => new URLSearchParams(location.search).get("cart_id"),
    [location.search],
  );

  const collaboratorId = useMemo(
    () => new URLSearchParams(location.search).get("ref"),
    [location.search],
  );

  const [customer, setCustomer] = useState<CustomerData>({
    name: prefill.name,
    email: prefill.email,
    phone: prefill.phone,
    cpf: prefill.cpf,
  });

  // Scrub PII from URL to prevent Meta Pixel from capturing sensitive data in PageView
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const piiParams = ["email", "name", "phone", "cpf", "full_name", "e", "n", "p", "c"];
    let hasPii = false;

    piiParams.forEach(p => {
      if (params.has(p)) {
        params.delete(p);
        hasPii = true;
      }
    });

    if (hasPii) {
      const newSearch = params.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [location.search]);

  // Prefill form from abandoned cart recovery link (?cart_id=uuid)
  useEffect(() => {
    if (!cartId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_abandoned_cart_prefill", {
        p_cart_id: cartId,
      });
      if (
        cancelled ||
        error ||
        !data ||
        !Array.isArray(data) ||
        data.length === 0
      )
        return;
      const cart = data[0] as {
        customer_name: string | null;
        customer_email: string | null;
        customer_phone: string | null;
        customer_cpf: string | null;
      };
      setCustomer((prev) => ({
        name: prev.name || cart.customer_name || "",
        email: prev.email || cart.customer_email || "",
        phone: prev.phone || cart.customer_phone || "",
        cpf: prev.cpf || cart.customer_cpf || "",
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [cartId]);
  const [creditCard, setCreditCard] = useState<CreditCardData>({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
    installments: "1",
  });
  const stripePaymentRef = useRef<StripePaymentElementHandle>(null);

  const { markPurchased, markStep } = useAbandonedCart({
    productId: productId || "",
    customer,
    paymentMethod,
    productOwnerId: product?.user_id,
    productPrice: product?.price,
    // Phone field is hidden on USD checkouts, so don't gate cart
    // creation on a phone the form never asks for.
    requirePhone: product?.currency !== "USD",
  });

  // Track checkout_step: personal_info when customer fills minimum data
  useEffect(() => {
    const hasName = customer.name.trim().length >= 2;
    const hasEmail = customer.email.trim().length >= 5;
    if (hasName && hasEmail) {
      markStep("personal_info");
    }
  }, [customer.name, customer.email, markStep]);
  useCheckoutPresence("track", productId);

  // Auto-set country from Cloudflare geo (only once)
  useEffect(() => {
    if (geoCountry && geoCountry !== "US") {
      setSelectedCountry(geoCountry);
    }
  }, [geoCountry]);

  // i18n translations based on selected country
  const t = useMemo(
    () => getCheckoutTranslations(selectedCountry),
    [selectedCountry],
  );

  // Local currency conversion for non-USD countries
  const { formatLocal } = useLocalCurrency(0, selectedCountry);

  useEffect(() => {
    if (!productId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);

      const [productRes, bumpsRes, allConfigsRes] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .eq("active", true)
          .single(),
        supabase
          .from("order_bumps")
          .select(
            "id, call_to_action, title, description, use_product_image, bump_product:products!order_bumps_bump_product_id_fkey(id, name, price, image_url)",
          )
          .eq("product_id", productId)
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("checkout_builder_configs" as any)
          .select("id, layout, price, is_default, is_split_active, traffic_weight")
          .eq("product_id", productId),
      ]);

      const allConfigs = (allConfigsRes.data || []) as any[];
      const splitConfigs = allConfigs.filter((c) => c.is_split_active);
      let targetConfigId = requestedConfigId;

      if (!targetConfigId && splitConfigs.length > 0) {
        const storageKey = `_abt_${productId}`;
        const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
        const thirtyDaysMs = 2592000000;
        const isExpired =
          !stored ||
          !stored.assignedAt ||
          Date.now() - stored.assignedAt > thirtyDaysMs;

        const assignedConfig = !isExpired
          ? allConfigs.find((c) => c.id === stored.configId)
          : null;

        if (assignedConfig && assignedConfig.is_split_active) {
          targetConfigId = assignedConfig.id;
        } else {
          // Weighted random pick
          const pickWeighted = (configs: any[]) => {
            const totalWeight = configs.reduce(
              (sum, c) => sum + (c.traffic_weight || 50),
              0,
            );
            let random = Math.random() * totalWeight;
            for (const config of configs) {
              random -= config.traffic_weight || 50;
              if (random <= 0) return config;
            }
            return configs[configs.length - 1];
          };

          const picked = pickWeighted(splitConfigs);
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              configId: picked.id,
              assignedAt: Date.now(),
            }),
          );
          targetConfigId = picked.id;
        }

        const existingParams = new URLSearchParams(window.location.search);
        existingParams.set("config", targetConfigId);
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}?${existingParams.toString()}${window.location.hash}`,
        );
      }

      const builderLayoutData = targetConfigId
        ? allConfigs.find((c) => c.id === targetConfigId)
        : allConfigs.find((c) => c.is_default);

      if (productRes.error || !productRes.data) {
        setNotFound(true);
      } else if (
        (productRes.data as any).moderation_status &&
        (productRes.data as any).moderation_status !== "approved"
      ) {
        setNotFound(true);
      } else {
        const p = productRes.data as any;
        const configPrice = (builderLayoutData as any)?.price;
        if (configPrice != null && configPrice > 0)
          p.price = Number(configPrice);
        setProduct(p);

        if (targetConfigId && productId) {
          (async () => {
            const { detectBot } = await import("@/lib/botDetection");
            const botCheck = detectBot(false);
            if (!botCheck.isBot) {
              supabase
                .from("pixel_events")
                .insert({
                  product_id: productId,
                  event_name: "ViewContent",
                  source: "browser",
                  visitor_id: getVisitorId(),
                  event_id: `view_${targetConfigId}_${Date.now()}`,
                  user_id: p.user_id,
                  is_bot: false,
                  metadata: { config_id: targetConfigId },
                } as any)
                .then(() => {});
            }
          })();
        }
        if (p.is_subscription || p.currency === "USD")
          setPaymentMethod("credit_card");
        if (p.user_id) {
          const [
            { data: settingsRows },
            { data: billingAcc },
            { data: ownerRoles },
          ] = await Promise.all([
            supabase.rpc("get_checkout_settings", { p_user_id: p.user_id }),
            supabase
              .from("billing_accounts")
              .select("blocked")
              .eq("user_id", p.user_id)
              .maybeSingle(),
            supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", p.user_id)
              .eq("role", "super_admin"),
          ]);
          const settings = Array.isArray(settingsRows)
            ? settingsRows[0]
            : settingsRows;
          if (settings) setCheckoutSettings(settings as any);
          const isSuperAdmin = (ownerRoles as any[])?.length > 0;
          setIsOwnerSuperAdmin(isSuperAdmin);
          if (!isSuperAdmin && (billingAcc as any)?.blocked === true) {
            setProducerBlocked(true);
            setLoading(false);
            return;
          }
          // Check if producer has an active gateway configured
          if (!isSuperAdmin) {
            const { data: hasGw } = await supabase.rpc("producer_has_gateway", {
              p_user_id: p.user_id,
            });
            if (!hasGw) {
              setNoGateway(true);
              setLoading(false);
              return;
            }
          }
        }
      }
      if (bumpsRes.data) setOrderBumps(bumpsRes.data as any);

      const layout =
        ((builderLayoutData as any)?.layout as unknown as
          | BuilderComponent[]
          | null) ?? [];
      setBuilderLayout(Array.isArray(layout) ? layout : []);
      setLoading(false);
    };
    load();
  }, [productId, requestedConfigId]);

  // Custom CSS injection
  useEffect(() => {
    if (!checkoutSettings) return;
    if (checkoutSettings.primary_color)
      document.documentElement.style.setProperty(
        "--checkout-brand",
        checkoutSettings.primary_color,
      );
    let styleEl: HTMLStyleElement | null = null;
    if (checkoutSettings.custom_css) {
      const sanitizedCss = checkoutSettings.custom_css
        .replace(/<[^>]*>/g, "")
        .replace(/javascript\s*:/gi, "")
        .replace(/expression\s*\(/gi, "")
        .replace(/@import/gi, "")
        .replace(/url\s*\(\s*['"]?\s*javascript/gi, "url(blocked");
      styleEl = document.createElement("style");
      styleEl.textContent = sanitizedCss;
      document.head.appendChild(styleEl);
    }
    return () => {
      document.documentElement.style.removeProperty("--checkout-brand");
      if (styleEl) styleEl.remove();
    };
  }, [checkoutSettings]);

  const toggleBump = (bumpId: string) => {
    setSelectedBumps((prev) => {
      const next = new Set(prev);
      if (next.has(bumpId)) {
        next.delete(bumpId);
      } else {
        next.add(bumpId);
        const bump = orderBumps.find((b) => b.id === bumpId);
        if (bump) trackAddToCart(bump.bump_product.id, bump.bump_product.price);
      }
      return next;
    });
  };

  const sortedLayout = useMemo(
    () => [...builderLayout].sort((a, b) => a.order - b.order),
    [builderLayout],
  );
  const countdownMinutes = Number(
    sortedLayout.find((c) => c.type === "countdown")?.props?.minutes || 15,
  );
  const submitLabel = sortedLayout.find((c) => c.type === "button")?.props
    ?.text;

  // Track Lead and Advanced Matching only when relevant data is present
  useEffect(() => {
    const hasMinData =
      customer.name &&
      customer.email &&
      (isUSD || (customer.cpf && customer.phone));
    if (hasMinData) {
      setAdvancedMatching(customer);
      trackLead();
    }
  }, [
    customer.name,
    customer.email,
    customer.phone,
    customer.cpf,
    isUSD,
    setAdvancedMatching,
    trackLead,
  ]);

  // Track AddPaymentInfo only when a payment action is actually initiated or method is explicitly selected by user
  const hasAttemptedPayment = useRef(false);
  useEffect(() => {
    if (hasAttemptedPayment.current) {
      trackAddPaymentInfo(paymentMethod);
    }
  }, [paymentMethod, trackAddPaymentInfo]);

  const prices = useMemo(() => {
    if (!product)
      return {
        couponDiscount: 0,
        bumpTotal: 0,
        pixDiscount: 0,
        frontEndAmount: 0,
        finalAmount: 0,
      };
    const isUSD = product.currency === "USD";
    const couponDiscount = coupon
      ? coupon.discount_type === "percent"
        ? Math.round(product.price * (coupon.discount_value / 100) * 100) / 100
        : coupon.discount_value
      : 0;
    const bumpTotal = orderBumps
      .filter((b) => selectedBumps.has(b.id))
      .reduce((sum, b) => sum + (b.bump_product?.price || 0), 0);
    const pixDiscount =
      !isUSD && paymentMethod === "pix"
        ? Math.round(product.price * 0.05 * 100) / 100
        : 0;
    const frontEndAmount =
      Math.round((product.price - pixDiscount - couponDiscount) * 100) / 100;
    const finalAmount =
      Math.round((Math.max(frontEndAmount, 0) + bumpTotal) * 100) / 100;
    return {
      couponDiscount,
      bumpTotal,
      pixDiscount,
      frontEndAmount,
      finalAmount,
    };
  }, [product, coupon, orderBumps, selectedBumps, paymentMethod]);

  if (loading)
    return (
      <div className="min-h-screen bg-[#F2F4F8] flex items-center justify-center">
        <div className="space-y-4 w-full max-w-lg px-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );

  if (producerBlocked)
    return (
      <div className="min-h-screen bg-[#F2F4F8] flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F1111]">
            Página em manutenção
          </h1>
          <p className="text-[#565959]">
            Este checkout está temporariamente indisponível. Por favor, tente
            novamente mais tarde.
          </p>
        </div>
      </div>
    );

  if (noGateway)
    return (
      <div className="min-h-screen bg-[#F2F4F8] flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F1111]">
            Checkout indisponível
          </h1>
          <p className="text-[#565959]">
            O produtor ainda não configurou o gateway de pagamento. Não é
            possível processar compras neste momento.
          </p>
        </div>
      </div>
    );

  if (notFound || !product)
    return (
      <div className="min-h-screen bg-[#F2F4F8] flex items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-[#0F1111]">
            Produto não encontrado
          </h1>
          <p className="text-[#565959]">
            Este produto não existe ou não está disponível.
          </p>
        </div>
      </div>
    );
  const {
    couponDiscount,
    bumpTotal,
    pixDiscount,
    frontEndAmount,
    finalAmount,
  } = prices;

  const getUtms = () => {
    // Use persisted UTMs logic (Layer 1)
    const utms = getAttributionUtms();
    const params = new URLSearchParams(window.location.search);

    // Prefer visitor ID from URL (A/B test), fallback to persistent browser ID
    const visitorId = params.get("_abv") || getVisitorId();

    return {
      ...utms,
              attribution_fbc: document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] || null,
      // A/B test attribution
      ab_visitor_id: visitorId,
      ab_test_slug: params.get("_abt") || undefined,
    };
  };

  const geoPayload = {
    customer_city: geoCity || null,
    customer_zip: geoZip || null,
    customer_country: geoCountry || null,
    customer_state_geo: geoState || null,
  };

  const eventSourceUrl = window.location.origin + window.location.pathname;

  const handleSubmit = async () => {
    hasAttemptedPayment.current = true;
    if (!customer.name || !customer.email) {
      toast.error(
        isUSD ? t.fillRequired : "Preencha todos os campos obrigatórios",
      );
      return;
    }
    if (!isUSD && (!customer.cpf || !customer.phone)) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email.trim())) {
      toast.error(
        isUSD
          ? t.invalidEmail
          : "E-mail inválido. Verifique o endereço digitado.",
      );
      return;
    }
    if (!isUSD && !isValidCPF(customer.cpf)) {
      toast.error("CPF inválido. Verifique o número digitado.");
      return;
    }
    const [expMonth, expYear] = creditCard.expiry.split("/");
    if (paymentMethod === "credit_card" && !isUSD) {
      if (
        !creditCard.number ||
        !creditCard.name.trim() ||
        !creditCard.expiry ||
        !creditCard.cvv
      ) {
        toast.error("Preencha todos os dados do cartão");
        return;
      }
      if (
        !expMonth ||
        !expYear ||
        expMonth.length !== 2 ||
        expYear.length !== 2
      ) {
        toast.error("Preencha a validade do cartão corretamente");
        return;
      }
    }

    markStep("payment");
    trackAddToCartMain();
    setIsSubmitting(true);
    const bumpProductIds = orderBumps
      .filter((b) => selectedBumps.has(b.id))
      .map((b) => b.bump_product.id);
    const selectedBumpItems = orderBumps
      .filter((b) => selectedBumps.has(b.id))
      .map((b) => ({ id: b.bump_product.id, price: b.bump_product.price }));
    const utms = getUtms();

    try {
      if (isUSD) {
        // ─── USD → Stripe PaymentElement (Apple Pay / Google Pay / Cards) ─────────
        if (!stripePaymentRef.current)
          throw new Error(t.paymentError || "Payment form not ready.");

        // 1) Create PaymentIntent server-side (unconfirmed, for PaymentElement flow)
        const { data, error } = await supabase.functions.invoke(
          "create-stripe-payment",
          {
            body: {
              amount: finalAmount,
              product_id: product.id,
              currency: "usd",
              config_id: requestedConfigId || null,
              collaborator_id: collaboratorId || null,
              coupon_id: coupon?.id || null,
              bump_product_ids: bumpProductIds,
              checkout_url: window.location.href,
              event_source_url: eventSourceUrl,
              utms,
              attribution_fbc: document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] || null,
              customer_country: selectedCountry,
              geo: geoPayload,
              // No payment_method_id → triggers deferred/PaymentElement flow
              customer: {
                name: customer.name,
                email: customer.email,
                phone: customer.phone || undefined,
              },
            },
          },
        );
        if (error) {
          let msg = t.paymentError;
          try {
            const ctx = (error as any).context;
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              if (body?.error) msg = body.error;
            }
          } catch {}
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        if (!data?.client_secret)
          throw new Error("Failed to initialize payment.");

        // 2) Confirm payment client-side via PaymentElement (handles 3DS, Apple Pay, etc.)
        let result;
        try {
          result = await stripePaymentRef.current.confirmPayment(
            data.client_secret,
          );
        } catch (confirmErr: any) {
          // Mark the pre-created order as failed so the producer doesn't see it stuck on "pending"
          if (data?.order_id) {
            supabase.functions
              .invoke("mark-stripe-order-failed", {
                body: {
                  order_id: data.order_id,
                  payment_intent_id: data.payment_intent_id,
                  reason: confirmErr?.message || "card_declined",
                },
              })
              .catch(() => {});
          }
          throw confirmErr;
        }

        // 3) Payment succeeded
        const paymentId = result.paymentIntentId || data?.payment_intent_id;
        const trackingId = data?.order_id || paymentId;
        toast.success(t.paymentSuccess);
        trackPurchase(finalAmount, "USD", trackingId, selectedBumpItems);
        if (product.is_subscription)
          trackSubscribe(finalAmount, "USD", trackingId);
        await markPurchased();
        navigate(
          `/checkout/sucesso?product=${encodeURIComponent(product.name)}&method=credit_card&email=${encodeURIComponent(customer.email)}&product_id=${product.id}${data.order_id ? `&order_id=${data.order_id}` : ""}${product.delivery_method ? `&delivery=${product.delivery_method}` : ""}&lang=en`,
        );
      } else if (paymentMethod === "pix") {
        const customerState = getStateFromPhone(customer.phone);

        // Verifica qual gateway o produtor tem ativo para PIX
        const { data: activeGateways } = await supabase
          .from("payment_gateways")
          .select("provider")
          .eq("user_id", product.user_id)
          .eq("active", true);

        let functionName = "create-pix-payment"; // Default Pagarme
        if (activeGateways?.some((g) => g.provider === "mercadopago")) {
          functionName = "create-mercadopago-payment";
        } else if (activeGateways?.some((g) => g.provider === "asaas")) {
          functionName = "create-asaas-payment";
        }

        const { data, error } = await supabase.functions.invoke(functionName, {
          body: {
            amount: finalAmount,
            product_id: product.id,
            config_id: requestedConfigId || null,
            collaborator_id: collaboratorId || null,
            coupon_id: coupon?.id || null,
            bump_product_ids: bumpProductIds,
            checkout_url: window.location.href,
            event_source_url: eventSourceUrl,
            utms,
              attribution_fbc: document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] || null,
            customer_state: customerState,
            geo: geoPayload,
            payment_method: "pix",
            customer: {
              name: customer.name,
              email: customer.email,
              cpf: customer.cpf,
              phone: customer.phone,
            },
          },
        });
        if (error) {
          let msg = "Falha ao gerar o PIX";
          try {
            const ctx = (error as any).context;
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              if (body?.error) msg = body.error;
            }
          } catch {}
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        if (data?.qr_code_url || data?.qr_code) {
          setPixData({
            qrCodeUrl: data.qr_code_url,
            pixCode: data.qr_code,
            orderId: data.order_id,
          });
          setPixModalOpen(true);
        } else throw new Error("Falha ao gerar o PIX. Tente novamente.");
      } else {
        const customerState = getStateFromPhone(customer.phone);
        const { data, error } = await supabase.functions.invoke(
          "create-asaas-payment",
          {
            body: {
              amount: finalAmount,
              product_id: product.id,
              payment_method: "credit_card",
              installments: creditCard.installments,
              is_subscription: product.is_subscription,
              billing_cycle: product.billing_cycle,
              config_id: requestedConfigId || null,
              collaborator_id: collaboratorId || null,
              coupon_id: coupon?.id || null,
              bump_product_ids: bumpProductIds,
              checkout_url: window.location.href,
              event_source_url: eventSourceUrl,
              utms,
              attribution_fbc: document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] || null,
              customer_state: customerState,
              geo: geoPayload,
              customer: {
                name: customer.name,
                email: customer.email,
                cpf: customer.cpf,
                phone: customer.phone,
                addressNumber: "0",
                creditCard: {
                  holderName: creditCard.name,
                  number: creditCard.number.replace(/\s/g, ""),
                  expiryMonth: expMonth,
                  expiryYear: `20${expYear}`,
                  ccv: creditCard.cvv,
                },
              },
            },
          },
        );
        if (error) {
          let msg = "Falha ao processar pagamento com cartão";
          try {
            const ctx = (error as any).context;
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              if (body?.error) msg = body.error;
            }
          } catch {}
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        const paymentId = data?.payment_id || data?.subscription_id || data?.id;
        const trackingId = data?.order_id || paymentId;
        if (paymentId) {
          toast.success("Pagamento processado com sucesso!");
          trackPurchase(finalAmount, "BRL", trackingId, selectedBumpItems);
          if (product.is_subscription)
            trackSubscribe(finalAmount, "BRL", trackingId);
          await markPurchased();
          navigate(
            `/checkout/sucesso?product=${encodeURIComponent(product.name)}&method=credit_card&email=${encodeURIComponent(customer.email)}&product_id=${product.id}${data.order_id ? `&order_id=${data.order_id}` : ""}${product.delivery_method ? `&delivery=${product.delivery_method}` : ""}${isUSD ? "&lang=en" : ""}`,
          );
        } else throw new Error("Falha ao processar pagamento");
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      toast.error(
        err.message ||
          (isUSD ? t.paymentError : "Erro ao processar pagamento."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── USD Checkout: dynamic progress steps ──────────────────────────────────
  // Step 1 (Country) → done assim que houver país selecionado (default já vem)
  // Step 2 (Details) → done quando nome + email válidos
  // Step 3 (Payment) → current/done conforme submissão
  // Step 4 (Confirm) → só fica "complete" no /checkout/sucesso
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    (customer.email || "").trim(),
  );
  const detailsDone = !!customer.name?.trim() && emailLooksValid;
  const paymentInProgress = isSubmitting;
  const usdSteps: StepBreadcrumbStep[] = [
    {
      id: "01",
      name: t.steps.country,
      status: selectedCountry ? "complete" : "current",
    },
    {
      id: "02",
      name: t.steps.details,
      status: detailsDone
        ? "complete"
        : selectedCountry
          ? "current"
          : "upcoming",
    },
    {
      id: "03",
      name: t.steps.payment,
      status: paymentInProgress
        ? "current"
        : detailsDone
          ? "current"
          : "upcoming",
    },
    {
      id: "04",
      name: t.steps.confirmation,
      status: "upcoming",
    },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "#F2F4F8",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <CountdownTimer
        minutes={countdownMinutes}
        isUSD={isUSD}
        prefix={isUSD ? t.reservedPrefix : undefined}
        suffix={isUSD ? t.reservedSuffix : undefined}
      />
      <div className="max-w-[620px] mx-auto px-4 pt-16 pb-8">
        <div className="bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-5 sm:p-6 space-y-5">
            {isUSD && (
              <div className="pb-1 border-b border-[#EFF1F4] -mx-1">
                <StepBreadcrumb steps={usdSteps} />
              </div>
            )}
            <CheckoutBuilderRenderer
              components={sortedLayout}
              zone="top"
              productName={product.name}
            />

            {product.image_url && (
              <div className="rounded-lg overflow-hidden bg-[#F7FAFA]">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-auto max-h-[420px] object-contain mx-auto"
                  loading="eager"
                  decoding="async"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt=""
                  className="w-10 h-10 rounded-md object-contain bg-[#F7FAFA] p-0.5 border border-[#D5D9D9]"
                />
              )}
              <h1 className="text-base font-bold text-[#0F1111]">
                {product.name}
              </h1>
            </div>

            <CheckoutBuilderRenderer
              components={sortedLayout}
              zone="left"
              productName={product.name}
              excludeTypes={["form", "button", "countdown", "facebook"]}
            />

            <div className="space-y-4">
              {isUSD && (
                <div>
                  <p className="text-xs font-semibold text-[#565959] uppercase tracking-wide mb-1.5">
                    {t.yourCountry}
                  </p>
                  <CountrySelector
                    selected={selectedCountry}
                    onChange={setSelectedCountry}
                  />
                </div>
              )}
              <CustomerForm
                data={customer}
                onChange={setCustomer}
                hideDocumentPhone={isUSD}
                t={isUSD ? t.form : undefined}
              />
              {isUSD ? null : product.is_subscription ? (
                <div className="bg-[#F7FAFA] border border-[#D5D9D9] rounded-lg p-3 flex items-center gap-2">
                  <span className="text-lg">🔄</span>
                  <div>
                    <p className="text-sm font-bold text-[#0F1111]">
                      Assinatura{" "}
                      {{
                        weekly: "Semanal",
                        biweekly: "Quinzenal",
                        monthly: "Mensal",
                        quarterly: "Trimestral",
                        semiannually: "Semestral",
                        yearly: "Anual",
                      }[product.billing_cycle] || "Mensal"}
                    </p>
                    <p className="text-xs text-[#565959]">
                      Cobrança recorrente no cartão de crédito
                    </p>
                  </div>
                </div>
              ) : (
                <PaymentTabs
                  activeMethod={paymentMethod}
                  onMethodChange={setPaymentMethod}
                  pixDiscountPercent={5}
                />
              )}
              {!isUSD && paymentMethod === "pix" ? (
                <PixPayment
                  totalAmount={finalAmount}
                  qrCodeData={pixData?.qrCodeUrl}
                  pixCode={pixData?.pixCode}
                />
              ) : isUSD ? (
                <Suspense
                  fallback={
                    <div className="h-11 bg-white border border-[#D5D9D9] rounded-lg flex items-center justify-center text-[#565959] text-sm">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
                    </div>
                  }
                >
                  <StripePaymentElement
                    ref={stripePaymentRef}
                    productId={product.id}
                    amountCents={Math.round(finalAmount * 100)}
                    currency="usd"
                    customerEmail={customer.email}
                    customerName={customer.name}
                  />
                </Suspense>
              ) : (
                <CreditCardForm
                  data={creditCard}
                  onChange={setCreditCard}
                  totalAmount={finalAmount}
                  isUSD={isUSD}
                />
              )}
            </div>

            {product.show_coupon !== false && (
              <CouponField
                productId={product.id}
                productPrice={product.price}
                onApply={setCoupon}
                isUSD={isUSD}
              />
            )}

            <OrderBumps
              bumps={orderBumps}
              selectedBumps={selectedBumps}
              onToggle={toggleBump}
              installments={creditCard.installments}
              isUSD={isUSD}
            />

            <CheckoutBuilderRenderer
              components={sortedLayout}
              zone="right"
              productName={product.name}
              excludeTypes={["form", "button", "countdown", "facebook"]}
            />

            <PriceSummary
              originalPrice={product.price}
              pixDiscount={pixDiscount}
              couponDiscount={couponDiscount}
              bumpTotal={bumpTotal}
              finalAmount={finalAmount}
              paymentMethod={paymentMethod}
              couponCode={coupon?.code}
              isUSD={isUSD}
              formatLocal={isUSD ? formatLocal : undefined}
              selectedCountry={selectedCountry}
            />

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-4 rounded-xl text-base transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
              style={{
                backgroundColor: isSubmitting ? "#E8D38A" : "#FFD814",
                border: "1px solid #FCD200",
                color: "#0F1111",
                boxShadow: isSubmitting
                  ? "none"
                  : "0 3px 8px rgba(255,216,20,0.35), 0 1px 2px rgba(0,0,0,0.08)",
                fontWeight: 800,
                letterSpacing: "0.03em",
              }}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <span className="flex flex-col items-center justify-center gap-0.5">
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    {isUSD
                      ? formatLocal(finalAmount)
                        ? `Pay ${formatLocal(finalAmount)}`
                        : t.payButton(finalAmount.toFixed(2))
                      : product.is_subscription
                        ? "Assinar agora"
                        : paymentMethod === "pix"
                          ? `Pagar ${finalAmount.toFixed(2).replace(".", ",")} com PIX`
                          : submitLabel || "Finalizar compra"}
                    <ArrowRight className="w-5 h-5" />
                  </span>
                  {isUSD && formatLocal(finalAmount) && (
                    <span className="text-[10px] font-medium opacity-70 normal-case">
                      charged ${finalAmount.toFixed(2)} USD via Stripe
                    </span>
                  )}
                </span>
              )}
            </button>

            {isUSD && (
              <div className="flex justify-center pt-1">
                <img
                  src={pagoSeguroStripe}
                  alt="Pago seguro con Stripe — Visa, MasterCard, Maestro, American Express"
                  className="h-12 w-auto opacity-90"
                  loading="lazy"
                />
              </div>
            )}

            <TrustFooter isUSD={isUSD} t={isUSD ? t.trust : undefined} />
          </div>
        </div>
      </div>
      <PixModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        totalAmount={finalAmount}
        qrCodeUrl={pixData?.qrCodeUrl}
        pixCode={pixData?.pixCode}
        externalOrderId={pixData?.orderId}
        onPaymentConfirmed={() => {
          const pixBumpItems = orderBumps
            .filter((b) => selectedBumps.has(b.id))
            .map((b) => ({
              id: b.bump_product.id,
              price: b.bump_product.price,
            }));
          trackPurchase(finalAmount, "BRL", pixData?.orderId, pixBumpItems);
          markPurchased();
          setTimeout(() => {
            navigate(
              `/checkout/sucesso?product=${encodeURIComponent(product.name)}&method=pix&email=${encodeURIComponent(customer.email)}${product.delivery_method ? `&delivery=${product.delivery_method}` : ""}${isUSD ? "&lang=en" : ""}`,
            );
          }, 2500);
        }}
      />
    </div>
  );
};

export default Checkout;
