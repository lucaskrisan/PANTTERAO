import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { issuerFromBankName, type CardIssuer } from "@/lib/cardBrand";

export interface BinLookupResult {
  bin: string;
  scheme: string | null;
  brand: string | null;
  bank_name: string | null;
  country_alpha2: string | null;
  issuer: CardIssuer;
}

// Cache em memória durante a sessão para evitar chamadas repetidas
const memoryCache = new Map<string, BinLookupResult | null>();
const inflight = new Map<string, Promise<BinLookupResult | null>>();

async function fetchBin(bin: string): Promise<BinLookupResult | null> {
  if (memoryCache.has(bin)) return memoryCache.get(bin) ?? null;
  if (inflight.has(bin)) return inflight.get(bin)!;

  const promise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("bin-lookup", {
        method: "GET" as never,
        // supabase-js não tem "GET com query"; usamos URL completa via fetch fallback
      } as never);
      // Fallback usando fetch direto (Edge Function aceita ?bin=)
      const projectRef = (import.meta as ImportMeta).env.VITE_SUPABASE_PROJECT_ID;
      const fnUrl = `https://${projectRef}.functions.supabase.co/bin-lookup?bin=${bin}`;
      const anon = (import.meta as ImportMeta).env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(fnUrl, {
        headers: { Authorization: `Bearer ${anon}`, apikey: anon ?? "" },
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      if (json?.error) return null;
      const result: BinLookupResult = {
        bin: json.bin,
        scheme: json.scheme ?? null,
        brand: json.brand ?? null,
        bank_name: json.bank_name ?? null,
        country_alpha2: json.country_alpha2 ?? null,
        issuer: issuerFromBankName(json.bank_name),
      };
      memoryCache.set(bin, result);
      // suprimir warning de variável não usada
      void data; void error;
      return result;
    } catch {
      memoryCache.set(bin, null);
      return null;
    } finally {
      inflight.delete(bin);
    }
  })();

  inflight.set(bin, promise);
  return promise;
}

/**
 * Faz lookup do BIN (primeiros 6 dígitos) com debounce.
 * Não bloqueia o checkout — falha silenciosa, retornando null.
 */
export function useBinLookup(cardNumber: string, debounceMs = 350): BinLookupResult | null {
  const [result, setResult] = useState<BinLookupResult | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const digits = (cardNumber || "").replace(/\D/g, "").slice(0, 6);
    if (digits.length < 6) {
      setResult(null);
      return;
    }
    if (memoryCache.has(digits)) {
      setResult(memoryCache.get(digits) ?? null);
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      const r = await fetchBin(digits);
      setResult(r);
    }, debounceMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [cardNumber, debounceMs]);

  return result;
}