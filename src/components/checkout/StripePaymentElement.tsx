import { useEffect, useImperativeHandle, useState, forwardRef, useRef, useMemo } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck } from "lucide-react";

export interface StripePaymentElementHandle {
  /**
   * 1) Validate the PaymentElement form via elements.submit()
   * 2) Confirm the payment with the given clientSecret
   * Returns the PaymentIntent result on success; throws on error.
   */
  confirmPayment: (clientSecret: string) => Promise<{ paymentIntentId: string }>;
}

interface InnerFormProps {
  onReady?: () => void;
  customerEmail?: string;
  customerName?: string;
}

const InnerForm = forwardRef<StripePaymentElementHandle, InnerFormProps>(function InnerForm({ onReady, customerEmail, customerName }, ref) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    confirmPayment: async (clientSecret: string) => {
      if (!stripe || !elements) throw new Error("Stripe not ready. Please wait a moment.");

      // Step 1: Validate the payment form
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message || "Please check your payment details.");
      }

      // Step 2: Confirm the payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/sucesso`,
        },
        redirect: "if_required",
      });

      if (error) {
        throw new Error(error.message || "Payment failed. Please try again.");
      }

      if (!paymentIntent || paymentIntent.status !== "succeeded") {
        // Handle requires_action or other statuses
        if (paymentIntent?.status === "requires_action") {
          throw new Error("Additional verification required. Please try again.");
        }
        throw new Error("Payment was not completed.");
      }

      return { paymentIntentId: paymentIntent.id };
    },
  }), [stripe, elements]);

  return (
    <div className="space-y-3">
      <PaymentElement
        onReady={() => {
          setReady(true);
          onReady?.();
        }}
        options={{
          layout: {
            type: "tabs",
            defaultCollapsed: false,
          },
          business: { name: "Panttera" },
          defaultValues: {
            billingDetails: {
              email: customerEmail || undefined,
              name: customerName || undefined,
            },
          },
        }}
      />
      {!ready && (
        <div className="h-11 bg-white border border-[#D5D9D9] rounded-lg flex items-center justify-center text-[#565959] text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading payment methods…
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-[#565959]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#007185]" />
        Your data is protected with PCI-DSS encryption. Apple Pay & Google Pay supported.
      </div>
    </div>
  );
});

interface StripePaymentElementProps {
  productId: string;
  amountCents: number;
  currency: string;
  customerEmail?: string;
  customerName?: string;
}

const StripePaymentElement = forwardRef<StripePaymentElementHandle, StripePaymentElementProps>(
  function StripePaymentElement({ productId, amountCents, currency, customerEmail, customerName }, ref) {
    const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const innerRef = useRef<StripePaymentElementHandle>(null);

    // Forward inner methods through the outer ref
    useImperativeHandle(ref, () => ({
      confirmPayment: (clientSecret) => {
        if (!innerRef.current) throw new Error("Payment form not ready.");
        return innerRef.current.confirmPayment(clientSecret);
      },
    }), []);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          setLoading(true);
          setError(null);
          const { data, error } = await supabase.functions.invoke("get-stripe-publishable-key", {
            body: { product_id: productId },
          });
          if (cancelled) return;
          if (error || !data?.publishable_key) {
            const msg = data?.error || error?.message || "";
            console.error("[StripePaymentElement] get-stripe-publishable-key failed:", { msg, data, error });
            if (/not configured|not found|publishable/i.test(msg)) {
              throw new Error(
                "Stripe is not configured for this product. The producer needs to set up their Stripe Publishable Key (pk_…) in Admin → Gateways → Stripe."
              );
            }
            throw new Error(msg || "Failed to load Stripe.");
          }
          setStripePromise(loadStripe(data.publishable_key));
        } catch (err: any) {
          if (!cancelled) {
            console.error("[StripePaymentElement] init error:", err);
            setError(err.message || "Failed to initialize payment form.");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [productId]);

    // Elements options for deferred intent (no client_secret needed upfront)
    // NOTE: paymentMethodCreation "manual" is intentionally NOT set — it disables
    // Apple Pay / Google Pay native wallets in PaymentElement. Default ("automatic")
    // preserves wallet support and the standard confirmPayment flow.
    // Premium appearance tuned for high conversion (Stripe Link enabled by default)
    const elementsOptions = useMemo(() => ({
      mode: "payment" as const,
      amount: amountCents,
      currency: currency.toLowerCase(),
      appearance: {
        theme: "stripe" as const,
        variables: {
          colorPrimary: "#007185",
          colorBackground: "#ffffff",
          colorText: "#0F1111",
          colorDanger: "#B12704",
          borderRadius: "8px",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSizeBase: "15px",
          spacingUnit: "4px",
        },
        rules: {
          ".Input": {
            border: "1px solid #D5D9D9",
            boxShadow: "none",
            padding: "12px 14px",
          },
          ".Input:focus": {
            border: "1px solid #007185",
            boxShadow: "0 0 0 3px rgba(0, 113, 133, 0.15)",
          },
          ".Label": {
            fontWeight: "500",
            color: "#0F1111",
          },
          ".Tab": {
            border: "1px solid #D5D9D9",
            boxShadow: "none",
          },
          ".Tab--selected": {
            borderColor: "#007185",
            boxShadow: "0 0 0 1px #007185",
          },
        },
      },
    }), [amountCents, currency]);

    if (loading) {
      return (
        <div className="h-11 bg-white border border-[#D5D9D9] rounded-lg flex items-center justify-center text-[#565959] text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading secure payment form…
        </div>
      );
    }

    if (error || !stripePromise) {
      return (
        <div className="bg-[#FFF3F3] border border-[#B12704] text-[#B12704] rounded-lg px-3 py-3 text-sm space-y-1">
          <div className="font-semibold">Payment form unavailable</div>
          <div className="text-xs leading-relaxed">{error || "Please try again shortly."}</div>
        </div>
      );
    }

    return (
      <Elements stripe={stripePromise} options={elementsOptions} key={`${amountCents}-${currency}`}>
        <InnerForm ref={innerRef} customerEmail={customerEmail} customerName={customerName} />
      </Elements>
    );
  }
);

export default StripePaymentElement;
