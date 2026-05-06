import { useEffect, useImperativeHandle, useState, forwardRef, useRef } from "react";
import { loadStripe, type Stripe, type StripeElements, type StripeCardElement } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Loader2 } from "lucide-react";

export interface StripeCardFormHandle {
  /**
   * Tokenize the card and return a payment_method_id to send to the backend.
   * Throws if user input is invalid or Stripe.js failed to load.
   */
  tokenize: (billing: { name: string; email: string }) => Promise<string>;
  /**
   * Handle 3DS / next_action when backend returns requires_action.
   * Returns true on success.
   */
  confirmAction: (clientSecret: string) => Promise<boolean>;
}

interface StripeCardFormProps {
  productId: string;
}

// ─── Inner component (must be inside <Elements>) ───────────────────────────
const InnerForm = forwardRef<StripeCardFormHandle, {}>(function InnerForm(_, ref) {
  const stripe = useStripe();
  const elements = useElements();

  useImperativeHandle(ref, () => ({
    tokenize: async ({ name, email }) => {
      if (!stripe || !elements) throw new Error("Stripe not ready. Please wait a moment.");
      const card = elements.getElement(CardElement) as StripeCardElement | null;
      if (!card) throw new Error("Card field not initialized.");
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card,
        billing_details: { name, email },
      });
      if (error) throw new Error(error.message || "Invalid card data.");
      if (!paymentMethod) throw new Error("Could not tokenize card.");
      return paymentMethod.id;
    },
    confirmAction: async (clientSecret: string) => {
      if (!stripe) throw new Error("Stripe not ready.");
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret);
      if (error) throw new Error(error.message || "3D Secure verification failed.");
      return paymentIntent?.status === "succeeded";
    },
  }), [stripe, elements]);

  return (
    <div className="space-y-3">
      <div className="h-11 bg-white border border-[#D5D9D9] rounded-lg px-3 py-3 focus-within:border-[#007185] focus-within:ring-1 focus-within:ring-[#007185]">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: {
                fontSize: "15px",
                color: "#0F1111",
                fontFamily: 'Arial, sans-serif',
                "::placeholder": { color: "#767676" },
                iconColor: "#007185",
              },
              invalid: { color: "#B12704", iconColor: "#B12704" },
            },
          }}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-[#565959]">
        <Lock className="w-3.5 h-3.5 text-[#007185]" />
        Your data is protected with PCI-DSS encryption (Stripe).
      </div>
    </div>
  );
});

// ─── Outer wrapper: loads Stripe.js with the producer's pk ─────────────────
const StripeCardForm = forwardRef<StripeCardFormHandle, StripeCardFormProps>(function StripeCardForm(
  { productId },
  ref
) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const innerRef = useRef<StripeCardFormHandle>(null);

  // Forward inner methods through the outer ref
  useImperativeHandle(ref, () => ({
    tokenize: (billing) => {
      if (!innerRef.current) throw new Error("Card form not ready.");
      return innerRef.current.tokenize(billing);
    },
    confirmAction: (clientSecret) => {
      if (!innerRef.current) throw new Error("Card form not ready.");
      return innerRef.current.confirmAction(clientSecret);
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
          console.error("[StripeCardForm] get-stripe-publishable-key failed:", { msg, data, error });
          if (/not configured|not found|publishable/i.test(msg)) {
            throw new Error(
              "Stripe não está configurado para este produto. O produtor precisa cadastrar a Publishable Key (pk_…) em Admin → Gateways → Stripe."
            );
          }
          throw new Error(msg || "Falha ao carregar Stripe.");
        }
        setStripePromise(loadStripe(data.publishable_key));
      } catch (err: any) {
        if (!cancelled) {
          console.error("[StripeCardForm] init error:", err);
          setError(err.message || "Falha ao inicializar Stripe.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) {
    return (
      <div className="h-11 bg-white border border-[#D5D9D9] rounded-lg flex items-center justify-center text-[#565959] text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando formulário seguro de cartão…
      </div>
    );
  }

  if (error || !stripePromise) {
    return (
      <div className="bg-[#FFF3F3] border border-[#B12704] text-[#B12704] rounded-lg px-3 py-3 text-sm space-y-1">
        <div className="font-semibold">Formulário de cartão indisponível</div>
        <div className="text-xs leading-relaxed">{error || "Tente novamente em instantes."}</div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <InnerForm ref={innerRef} />
    </Elements>
  );
});

export default StripeCardForm;
