import { useMemo } from "react";
import { getCfGeo, getCountry, getCurrency, getCity, getState, getZip } from "@/lib/cfGeo";

/**
 * Hook síncrono que lê geolocalização do `window.cfGeo` (injetado pelo
 * Cloudflare Worker em app.panttera.com.br). Sem fetch, sem loading.
 *
 * Em ambientes sem Worker (preview Lovable), retorna valores vazios/fallbacks.
 */
export function useGeo() {
  return useMemo(() => {
    const geo = getCfGeo();
    return {
      geo,
      country: getCountry(),
      currency: getCurrency(),
      city: getCity(),
      state: getState(),
      zip: getZip(),
      hasGeo: Boolean(geo?.country),
    };
  }, []);
}
