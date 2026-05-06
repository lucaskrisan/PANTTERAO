import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCity, getState, getZip, getCountry } from "@/lib/cfGeo";
import type { CustomerData } from "@/components/checkout/CustomerForm";

interface UseAbandonedCartProps {
  productId: string;
  customer: CustomerData;
  paymentMethod: string;
  productOwnerId?: string | null;
  productPrice?: number | null;
  /**
   * Whether the current checkout actually collects a phone number.
   * - BR / BRL checkouts: true (phone + CPF are mandatory)
   * - International / USD checkouts: false (form hides phone & CPF)
   * Used to decide if phone is part of the "minimum data" gate.
   */
  requirePhone?: boolean;
}

function buildPayload(customer: CustomerData, paymentMethod: string, productOwnerId: string | null | undefined) {
  return {
    customer_name: customer.name.trim() || null,
    customer_email: customer.email.trim() || null,
    customer_phone: customer.phone.trim() || null,
    customer_cpf: customer.cpf.trim() || null,
    payment_method: paymentMethod,
    user_id: productOwnerId ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function useAbandonedCart({
  productId,
  customer,
  paymentMethod,
  productOwnerId,
  productPrice,
  requirePhone = true,
}: UseAbandonedCartProps) {
  const cartIdRef = useRef<string | null>(null);
  const purchasedRef = useRef(false);
  const createdRef = useRef(false);
  const latestRef = useRef({ customer, paymentMethod, productOwnerId, productId, productPrice });
  latestRef.current = { customer, paymentMethod, productOwnerId, productId, productPrice };

  // Validation rule applied to this attempt — persisted in
  // abandoned_carts.notes so we can audit which rule each cart used
  // (e.g. why a USD cart was created without a phone number).
  const validationRule = requirePhone ? "phone_required" : "phone_optional_usd";

  // Minimum data to create a cart depends on whether the checkout
  // actually collects a phone. International (USD) checkouts hide the
  // phone field, so requiring it would silently drop every USD cart.
  const phoneOk = customer.phone.replace(/\D/g, "").length >= 8;
  const baseOk =
    customer.name.trim().length >= 2 &&
    customer.email.trim().length >= 5 &&
    customer.email.includes("@");
  const hasMinimumData = Boolean(baseOk && (!requirePhone || phoneOk));

  const saveCart = useCallback(async () => {
    if (purchasedRef.current || !productId || !productOwnerId || !hasMinimumData) return;

    const payload = buildPayload(customer, paymentMethod, productOwnerId);

    try {
      const params = new URLSearchParams(window.location.search);

      if (cartIdRef.current) {
        const { error } = await supabase.rpc("update_abandoned_cart", {
          p_cart_id: cartIdRef.current,
          p_customer_name: payload.customer_name,
          p_customer_email: payload.customer_email,
          p_customer_phone: payload.customer_phone,
          p_customer_cpf: payload.customer_cpf,
          p_payment_method: payload.payment_method,
        });
        if (error) console.error("[abandoned-cart] update failed:", error.message);
        return;
      }

      if (createdRef.current || cartIdRef.current) return;
      createdRef.current = true;

      const clientId = crypto.randomUUID();
      const { error } = await supabase
        .from("abandoned_carts")
        .insert({
          id: clientId,
          product_id: productId,
          ...payload,
          product_price: productPrice ?? null,
          page_url: window.location.href,
          checkout_url: window.location.href,
          user_agent: navigator.userAgent,
          checkout_step: "opened",
          customer_city: getCity() || null,
          customer_zip: getZip() || null,
          customer_country: getCountry() || null,
          notes: `validation_rule:${validationRule}`,
          utm_source: params.get("utm_source") || null,
          utm_medium: params.get("utm_medium") || null,
          utm_campaign: params.get("utm_campaign") || null,
          utm_content: params.get("utm_content") || null,
          utm_term: params.get("utm_term") || null,
        } as any);

      if (!error) {
        cartIdRef.current = clientId;
      } else {
        console.error("[abandoned-cart] insert failed:", error.message);
        createdRef.current = false;
        cartIdRef.current = null;
      }
    } catch (e) {
      console.error("[abandoned-cart] unexpected error:", e);
      if (!cartIdRef.current) createdRef.current = false;
    }
  }, [customer.cpf, customer.email, customer.name, customer.phone, hasMinimumData, paymentMethod, productId, productOwnerId, productPrice, validationRule]);

  // --- Create cart when minimum data is first available ---
  useEffect(() => {
    if (!hasMinimumData || cartIdRef.current || createdRef.current) return;
    saveCart();
  }, [hasMinimumData, saveCart]);

  // --- Debounced updates as fields change ---
  useEffect(() => {
    if (!hasMinimumData) return;
    const timeoutId = window.setTimeout(saveCart, 400);
    return () => window.clearTimeout(timeoutId);
  }, [customer.cpf, customer.email, customer.name, customer.phone, hasMinimumData, saveCart]);

  // --- Reliable page-exit saves using sendBeacon ---
  useEffect(() => {
    const flushViaBeacon = () => {
      const cartId = cartIdRef.current;
      if (!cartId || purchasedRef.current) return;

      const { customer: c, paymentMethod: pm } = latestRef.current;
      const payload = buildPayload(c, pm, latestRef.current.productOwnerId);

      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !anonKey) return;

      const body = JSON.stringify({
        p_cart_id: cartId,
        p_customer_name: payload.customer_name,
        p_customer_email: payload.customer_email,
        p_customer_phone: payload.customer_phone,
        p_customer_cpf: payload.customer_cpf,
        p_payment_method: payload.payment_method,
      });

      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(
        `${supabaseUrl}/rest/v1/rpc/update_abandoned_cart?apikey=${anonKey}`,
        blob,
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushViaBeacon();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushViaBeacon);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushViaBeacon);
    };
  }, []);

  const markPurchased = useCallback(async () => {
    purchasedRef.current = true;
    const { customer: c, productId: pid } = latestRef.current;

    if (cartIdRef.current) {
      await supabase
        .from("abandoned_carts")
        .update({ recovered: true })
        .eq("id", cartIdRef.current);
    }

    const email = c.email.trim();
    if (email && pid) {
      await supabase
        .from("abandoned_carts")
        .update({ recovered: true })
        .eq("product_id", pid)
        .eq("customer_email", email)
        .eq("recovered", false);
    }
  }, []);

  const markStep = useCallback(async (step: string) => {
    const cartId = cartIdRef.current;
    if (!cartId || purchasedRef.current) return;
    try {
      await supabase.rpc("update_abandoned_cart", {
        p_cart_id: cartId,
        p_checkout_step: step,
      });
    } catch (e) {
      console.error("[abandoned-cart] markStep error:", e);
    }
  }, []);

  return { markPurchased, markStep };
}
