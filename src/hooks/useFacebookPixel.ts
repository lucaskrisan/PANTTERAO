import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCfGeo, getCountry as getGeoCountry, getCity, getState, getZip, getBestIp } from "@/lib/cfGeo";
import { detectBot } from "@/lib/botDetection";

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

/** Generate a unique event ID for deduplication */
function generateEventId(eventName: string): string {
  return `${eventName}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Simple SHA-256 for browser usage */
async function hashSHA256Browser(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Capture UTM params from current URL for campaign attribution */
export function captureUtms(): Record<string, string> {
  const p = new URLSearchParams(window.location.search);
  const utms: Record<string, string> = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => {
    const v = p.get(k);
    if (v) utms[k] = v;
  });
  return utms;
}

/** Get persisted attribution UTMs or current ones if available (7-day persistence) */
export function getAttributionUtms(): Record<string, string> {
  const current = captureUtms();
  
  // If current URL has UTMs, update persistence and return them
  if (current.utm_source) {
    localStorage.setItem('_panttera_utms', JSON.stringify({
      ...current,
      capturedAt: Date.now(),
      landingUrl: window.location.href,
    }));
    return current;
  }

  // Otherwise, try to recover from localStorage
  try {
    const storedRaw = localStorage.getItem('_panttera_utms');
    if (storedRaw) {
      const stored = JSON.parse(storedRaw);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (stored?.utm_source && (Date.now() - stored.capturedAt) < sevenDays) {
        return stored;
      }
    }
  } catch (e) {
    console.warn("[getAttributionUtms] Failed to parse stored UTMs", e);
  }
  
  return current;
}

/** Hash value for Advanced Matching (lowercase, trimmed) */
function normalizeParam(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase();
}

/** Remove non-digits */
function digitsOnly(value: string | undefined | null): string {
  return (value || "").replace(/\D/g, "");
}

/** Read a cookie by name — raw value, no decoding to preserve fbclid integrity */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

/** Set a first-party cookie — raw value, no encoding to preserve fbclid integrity */
function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value};expires=${expires};path=/;SameSite=Lax`;
}

/** Get or create a persistent visitor ID for journey tracking. */
export function getVisitorId(): string {
  const key = "_vid";
  const params = new URLSearchParams(window.location.search);
  // Support both 'vid' and A/B test '_abv' param
  const urlVid = params.get("vid") || params.get("_abv");
  
  // UUIDs from A/B tests or v_ prefixed IDs
  const isValidVid = urlVid && (urlVid.startsWith("v_") || urlVid.match(/^[0-9a-f-]{36}$/i));
  
  if (isValidVid) {
    setCookie(key, urlVid, 390);
    localStorage.setItem(key, urlVid);
    return urlVid;
  }
  
  let vid = getCookie(key) || localStorage.getItem(key);
  if (!vid) {
    vid = `v_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    setCookie(key, vid, 390);
    localStorage.setItem(key, vid);
  }
  return vid;
}

/** Generate or read _fbp cookie */
function ensureFbp(): string {
  let fbp = getCookie("_fbp");
  if (!fbp) {
    const rand = Math.floor(1000000000 + Math.random() * 9000000000);
    fbp = `fb.1.${Date.now()}.${rand}`;
    setCookie("_fbp", fbp, 390);
  }
  return fbp;
}

function getRawParam(name: string): string | null {
  const search = window.location.search.substring(1);
  const regex = new RegExp(`(?:^|&)${name}=([^&]*)`);
  const match = search.match(regex);
  return match ? match[1] : null;
}

function hydrateClickParams() {
  const fbcParam = getRawParam("fbc");
  if (fbcParam && fbcParam.startsWith("fb.") && !getCookie("_fbc")) {
    const fbcTs = parseInt(fbcParam.split(".")[2], 10);
    const isExpired = fbcTs && (Date.now() - fbcTs) > 90 * 24 * 60 * 60 * 1000;
    if (!isExpired) {
      setCookie("_fbc", fbcParam, 90);
    }
  }
  const fbclid = getRawParam("fbclid");
  if (fbclid && !getCookie("_fbc")) {
    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    setCookie("_fbc", fbc, 90);
  }
  const existingFbc = getCookie("_fbc");
  if (existingFbc) {
    const ts = parseInt(existingFbc.split(".")[2], 10);
    if (ts && (Date.now() - ts) > 90 * 24 * 60 * 60 * 1000) {
      document.cookie = "_fbc=;max-age=0;path=/";
    }
  }
  const fbpParam = getRawParam("fbp");
  if (fbpParam && fbpParam.startsWith("fb.") && !getCookie("_fbp")) {
    setCookie("_fbp", fbpParam, 390);
  }
}

interface CustomerInfo {
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
}

/**
 * LGPD/GDPR consent gate. Reads the marketing preference written by CookieConsent.
 * Returns true when:
 *   - the user explicitly accepted marketing storage, OR
 *   - no decision has been recorded yet AND the visitor is outside the EU
 *     (in BR/US default behavior, tracking continues until the user rejects).
 *
 * Returns false (blocks all tracking) when the user explicitly rejected marketing.
 */
function hasMarketingConsent(): boolean {
  try {
    const raw = localStorage.getItem("cookie_consent_prefs");
    if (raw) {
      const prefs = JSON.parse(raw);
      return prefs?.marketing === true;
    }
    // No decision yet: check Cloudflare-detected country.
    // EU visitors require explicit opt-in; non-EU defaults to allow until they reject.
    const country = (getCfGeo()?.country || "").toUpperCase();
    const EU = new Set([
      "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE",
      "IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","GB",
    ]);
    return !EU.has(country);
  } catch {
    return true;
  }
}

/** Build the geo payload sent to CAPI from window.cfGeo (Cloudflare Worker). */
function buildGeoPayload() {
  const geo = getCfGeo();
  if (!geo) return null;
  return {
    city: getCity() || undefined,
    state: getState() || undefined,
    zip: getZip() || undefined,
    country: getGeoCountry() || undefined,
  };
}

export function useFacebookPixel(productId: string | undefined, productPrice?: number, productName?: string, productCurrency?: string) {
  const initializedRef = useRef(false);
  const pixelIdsRef = useRef<string[]>([]);
  const firedEventsRef = useRef<Set<string>>(new Set());
  const customerRef = useRef<CustomerInfo>({});
  const advancedMatchingSignatureRef = useRef<string | null>(null);
  const pageViewEnrichSentRef = useRef(false);
  const productPriceRef = useRef(productPrice);
  const productNameRef = useRef(productName);
  const productCurrencyRef = useRef(productCurrency);

  useEffect(() => {
    productPriceRef.current = productPrice;
    productNameRef.current = productName;
    productCurrencyRef.current = productCurrency;
  }, [productPrice, productName, productCurrency]);

  /** Resolve event currency: product currency wins; fallback to Cloudflare currency; final fallback BRL */
  const resolveCurrency = useCallback((override?: string) => {
    if (override) return override.toUpperCase();
    if (productCurrencyRef.current) return productCurrencyRef.current.toUpperCase();
    const geoCurr = getCfGeo()?.currency;
    if (geoCurr) return geoCurr.toUpperCase();
    return "BRL";
  }, []);

  // Internal use within the hook (always current URL)
  const captureCurrentUtms = () => {
    const p = new URLSearchParams(window.location.search);
    const utms: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => {
      const v = p.get(k);
      if (v) utms[k] = v;
    });
    return utms;
  };

  /** Capture ctwa_clid (WhatsApp Click-to-Action Click ID) from URL if present */
  function captureCtwaClid(): string | null {
    return new URLSearchParams(window.location.search).get("ctwa_clid");
  }

  /** Send event to CAPI edge function (server-side, non-blocking) */
  const sendCAPI = useCallback((eventName: string, eventId: string, customData?: Record<string, unknown>) => {
    if (!productId) return;
    // CAPI is server-to-server — does not set browser cookies.
    // Legal basis: contract performance (order processing), NOT marketing consent.
    // Consent gate stays only on browser pixel (fbq) initialization below.
    const visitorId = getVisitorId();
    const fbp = ensureFbp();
    const geo = buildGeoPayload();
    const clientIp = getBestIp();
    const utms = captureCurrentUtms();
    const ctwaClid = captureCtwaClid();
    const referrer = document.referrer || undefined;

    // Enrich custom_data with `contents` + `num_items` when content_ids present
    let enrichedCustomData: Record<string, unknown> = { ...(customData || {}), ...utms };
    if (customData && Array.isArray((customData as any).content_ids) && (customData as any).content_ids.length > 0) {
      const ids = (customData as any).content_ids as string[];
      const value = Number((customData as any).value) || 0;
      const numItems = (customData as any).num_items ?? ids.length;
      const itemPrice = ids.length > 0 ? Number((value / ids.length).toFixed(2)) : 0;
      enrichedCustomData = {
        ...enrichedCustomData,
        num_items: numItems,
        contents: (customData as any).contents ?? ids.map((id) => ({ id, quantity: 1, item_price: itemPrice })),
      };
    }

    // Bot filter: eventos de "intenção" (PageView/ViewContent) exigem interação humana.
    // Eventos de ação (AddPaymentInfo, AddToCart, Lead, Purchase, Subscribe) já são
    // disparados após o usuário interagir, então só checam hard signals.
    const intentEvent = eventName === "ViewContent" || eventName === "InitiateCheckout";
    const botCheck = detectBot(/* requireHumanInteraction */ intentEvent);
    if (botCheck.isBot) {
      console.log(`[CAPI] Skipping ${eventName} — bot detected:`, botCheck.reason);
    }

    supabase.functions.invoke("facebook-capi", {
      body: {
        product_id: productId,
        event_name: eventName,
        event_id: eventId,
        event_source_url: window.location.origin + window.location.pathname,
        referrer_url: referrer,
        customer: customerRef.current,
        custom_data: enrichedCustomData,
        fbc: getCookie("_fbc") || null,
        fbp: fbp,
        visitor_id: visitorId,
        user_agent: navigator.userAgent,
        client_ip: clientIp || undefined,
        ctwa_clid: ctwaClid || undefined,
        log_browser: true, // Registra fonte 'browser' no banco para exibir os dois checkmarks no painel Nina Tracking
        geo,
        payment_method: (enrichedCustomData as any)?.payment_method,
        is_bot: botCheck.isBot,
        bot_reason: botCheck.reason,
      },
    }).catch((err) => console.warn("[CAPI] non-blocking error:", err));
  }, [productId]);


  useEffect(() => {
    if (!productId || initializedRef.current) return;

    // LGPD/GDPR gate: do not load Pixel or fire CAPI without marketing consent.
    if (!hasMarketingConsent()) {
      console.log("[useFacebookPixel] Marketing consent not granted — Pixel & CAPI disabled.");
      return;
    }

    // Bot filter: hard signals only at boot (sem janela de interação ainda).
    // Eventos individuais re-checam com requireHumanInteraction depois.
    const bootBot = detectBot(/* requireHumanInteraction */ false);
    if (bootBot.isBot) {
      console.log("[useFacebookPixel] Bot detected at boot — Pixel & CAPI disabled:", bootBot.reason);
      initializedRef.current = true;
      return;
    }

    hydrateClickParams();

    let cancelled = false;

    const pvId = generateEventId("PageView");
    const icId = generateEventId("InitiateCheckout");

    const loadPixels = async () => {
      const { data } = await supabase
        .from("public_product_pixels" as any)
        .select("pixel_id, domain")
        .eq("product_id", productId)
        .eq("platform", "facebook");

      if (cancelled) return;

      sendCAPI("PageView", pvId);
      sendCAPI("InitiateCheckout", icId, {
        content_type: "product",
        content_ids: [productId],
      });

      if (!data || (data as any[]).length === 0) {
        initializedRef.current = true;
        return;
      }

      pixelIdsRef.current = (data as any[]).map((px: any) => px.pixel_id);

      if (!window.fbq) {
        const script = document.createElement("script");
        script.innerHTML = `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
        `;
        document.head.appendChild(script);
      }

      const waitForFbq = setInterval(() => {
        if (window.fbq) {
          clearInterval(waitForFbq);

          (data as any[]).forEach((px: any) => {
            window.fbq("set", "autoConfig", false, px.pixel_id);
            window.fbq("init", px.pixel_id);
          });

          initializedRef.current = true;

          window.fbq("track", "PageView", {}, { eventID: pvId });
          window.fbq("track", "InitiateCheckout", {
            content_type: "product",
            content_ids: [productId],
          }, { eventID: icId });
        }
      }, 100);

      setTimeout(() => {
        clearInterval(waitForFbq);
        initializedRef.current = true;
      }, 5000);
    };

    loadPixels();
    return () => {
      cancelled = true;
    };
  }, [productId, sendCAPI]);

  /**
   * Set Advanced Matching data. Phone country prefix is dynamic based on
   * Cloudflare-detected country (only forces +55 when country is BR).
   */
  const setAdvancedMatching = useCallback(async (customer: CustomerInfo) => {
    try {
      customerRef.current = customer;

    if (!window.fbq || pixelIdsRef.current.length === 0) return;

    const normalizedName = normalizeParam(customer.name);
    const normalizedEmail = normalizeParam(customer.email);
    const normalizedPhone = digitsOnly(customer.phone);
    const normalizedCpf = digitsOnly(customer.cpf);

    if (!normalizedName || !normalizedEmail || !normalizedPhone || !normalizedCpf) return;

    const signature = [normalizedName, normalizedEmail, normalizedPhone, normalizedCpf].join("|");
    if (advancedMatchingSignatureRef.current === signature) return;
    advancedMatchingSignatureRef.current = signature;

    if (!pageViewEnrichSentRef.current) {
      pageViewEnrichSentRef.current = true;
      const enrichId = generateEventId("PageView_enrich");
      sendCAPI("PageView", enrichId, {
        content_type: "product",
        content_ids: productId ? [productId] : [],
      });
    }

    const nameParts = normalizedName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const phone = normalizedPhone;

    // Dynamic country prefix — only force +55 if visitor is BR
    const country = getGeoCountry() || "BR";
    let formattedPhone = phone ? `+${phone}` : "";
    if (country === "BR" && phone && !phone.startsWith("55")) {
      formattedPhone = `+55${phone}`;
    }

    // 🛡️ Pre-hash all PII before giving it to the browser SDK.
    // This prevents Meta's scanner from seeing cleartext PII in the browser context,
    // which is the primary cause of "Sensitive Data" warnings.
    const userData: Record<string, string> = {};
    if (normalizedEmail) userData.em = await hashSHA256Browser(normalizedEmail);
    if (firstName) userData.fn = await hashSHA256Browser(firstName);
    if (lastName) userData.ln = await hashSHA256Browser(lastName);
    if (formattedPhone) userData.ph = await hashSHA256Browser(formattedPhone);
    if (normalizedCpf) userData.external_id = await hashSHA256Browser(normalizedCpf);

    // Geo advanced matching (non-PII or already low sensitivity)
    const ct = getCity();
    const st = getState();
    const zp = getZip();
    if (ct) userData.ct = await hashSHA256Browser(normalizeParam(ct).replace(/\s+/g, ""));
    if (st) userData.st = await hashSHA256Browser(normalizeParam(st));
    if (zp) userData.zp = await hashSHA256Browser(digitsOnly(zp));
    userData.country = await hashSHA256Browser(country.toLowerCase());

      pixelIdsRef.current.forEach((pixelId) => {
        // Re-initialize with hashed data
        window.fbq("init", pixelId, userData);
      });
    } catch (e) {
      console.warn("[useFacebookPixel] Advanced Matching failed", e);
    }
  }, [productId, sendCAPI]);

  const trackAddPaymentInfo = useCallback((paymentMethod: string) => {
    const dedup = "AddPaymentInfo";
    if (firedEventsRef.current.has(dedup)) return;
    firedEventsRef.current.add(dedup);

    const eventId = generateEventId("AddPaymentInfo");
    const customData: Record<string, unknown> = {
      content_type: "product",
      content_ids: productId ? [productId] : [],
      payment_method: paymentMethod,
      currency: resolveCurrency(),
    };
    if (productPriceRef.current) customData.value = productPriceRef.current;
    if (productNameRef.current) customData.content_name = productNameRef.current;

    if (window.fbq) {
      window.fbq("track", "AddPaymentInfo", customData, { eventID: eventId });
    }
    sendCAPI("AddPaymentInfo", eventId, customData);
  }, [productId, sendCAPI, resolveCurrency]);

  const trackAddToCartMain = useCallback(() => {
    const dedupKey = "AddToCart_main";
    if (firedEventsRef.current.has(dedupKey)) return;
    firedEventsRef.current.add(dedupKey);

    const eventId = generateEventId("AddToCart");
    const customData: Record<string, unknown> = {
      content_type: "product",
      content_ids: productId ? [productId] : [],
      currency: resolveCurrency(),
    };
    if (productPriceRef.current) customData.value = productPriceRef.current;
    if (productNameRef.current) customData.content_name = productNameRef.current;

    if (window.fbq) {
      window.fbq("track", "AddToCart", customData, { eventID: eventId });
    }
    sendCAPI("AddToCart", eventId, customData);
  }, [productId, sendCAPI, resolveCurrency]);

  const trackAddToCart = useCallback((bumpProductId: string, bumpPrice?: number) => {
    const dedupKey = `AddToCart_${bumpProductId}`;
    if (firedEventsRef.current.has(dedupKey)) return;
    firedEventsRef.current.add(dedupKey);

    const eventId = generateEventId("AddToCart");
    const customData: Record<string, unknown> = {
      content_type: "product",
      content_ids: [bumpProductId],
      value: bumpPrice || 0,
      currency: resolveCurrency(),
    };

    if (window.fbq) {
      window.fbq("track", "AddToCart", customData, { eventID: eventId });
    }
    sendCAPI("AddToCart", eventId, customData);
  }, [productId, sendCAPI, resolveCurrency]);

  const trackPurchase = useCallback((
    value: number,
    currency?: string,
    orderId?: string,
    bumpItems?: Array<{ id: string; price: number; name?: string }>,
  ) => {
    const dedupKey = orderId ? `Purchase_${orderId}` : "Purchase";
    if (firedEventsRef.current.has(dedupKey)) return;
    
    // Check localStorage for purchase deduplication across reloads/sessions
    if (orderId) {
      const storageKey = `_fb_purchased_${orderId}`;
      if (localStorage.getItem(storageKey)) {
        console.log(`[useFacebookPixel] Purchase already fired for order ${orderId}, skipping.`);
        return;
      }
      localStorage.setItem(storageKey, "1");
    }
    
    firedEventsRef.current.add(dedupKey);

    const eventId = orderId || generateEventId("Purchase");

    // Build contents[] with main product + bump products
    const bumpTotal = (bumpItems || []).reduce((s, b) => s + b.price, 0);
    const mainPrice = Number(Math.max(0, value - bumpTotal).toFixed(2));
    const contents: Array<{ id: string; quantity: number; item_price: number }> = [
      { id: productId!, quantity: 1, item_price: mainPrice },
      ...(bumpItems || []).map((b) => ({ id: b.id, quantity: 1, item_price: b.price })),
    ];

    const customData: Record<string, unknown> = {
      value,
      currency: resolveCurrency(currency),
      content_type: "product",
      content_ids: contents.map((c) => c.id),
      contents,
      num_items: contents.length,
    };
    if (productNameRef.current) customData.content_name = productNameRef.current;
    if (orderId) customData.order_id = orderId;

    if (window.fbq) {
      window.fbq("track", "Purchase", customData, { eventID: eventId });
    }
    sendCAPI("Purchase", eventId, customData);
  }, [productId, sendCAPI, resolveCurrency]);

  const trackSubscribe = useCallback((value: number, currency?: string, orderId?: string) => {
    const dedupKey = orderId ? `Subscribe_${orderId}` : "Subscribe";
    if (firedEventsRef.current.has(dedupKey)) return;
    firedEventsRef.current.add(dedupKey);

    const eventId = orderId ? `sub_${orderId}` : generateEventId("Subscribe");
    const customData: Record<string, unknown> = {
      value,
      currency: resolveCurrency(currency),
      content_type: "product",
      content_ids: productId ? [productId] : [],
      predicted_ltv: Number((value * 12).toFixed(2)),
    };
    if (productNameRef.current) customData.content_name = productNameRef.current;
    if (orderId) customData.order_id = orderId;

    if (window.fbq) {
      window.fbq("track", "Subscribe", customData, { eventID: eventId });
    }
    sendCAPI("Subscribe", eventId, customData);
  }, [productId, sendCAPI, resolveCurrency]);

  const trackLead = useCallback(() => {
    if (firedEventsRef.current.has("Lead")) return;
    firedEventsRef.current.add("Lead");

    const eventId = generateEventId("Lead");
    const customData: Record<string, unknown> = {
      content_type: "product",
      content_ids: productId ? [productId] : [],
      currency: resolveCurrency(),
    };
    if (productPriceRef.current) customData.value = productPriceRef.current;
    if (productNameRef.current) customData.content_name = productNameRef.current;

    if (window.fbq) {
      window.fbq("track", "Lead", customData, { eventID: eventId });
    }
    sendCAPI("Lead", eventId, customData);
  }, [productId, sendCAPI, resolveCurrency]);

  return {
    trackPurchase,
    trackSubscribe,
    trackAddPaymentInfo,
    trackAddToCart,
    trackAddToCartMain,
    trackLead,
    setAdvancedMatching,
  };
}

