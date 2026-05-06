/**
 * Cloudflare Worker geo helper.
 *
 * O endpoint `https://geo.panttera.com.br` (Cloudflare Worker) retorna um JSON
 * com geolocalização baseada no IP do visitante. `bootGeo()` busca esse JSON
 * uma vez por aba (cache em sessionStorage) e popula `window.cfGeo` antes do
 * React montar. Os helpers abaixo lêem `window.cfGeo` de forma 100% síncrona.
 *
 * Em ambientes onde o Worker não responde (timeout/falha), `window.cfGeo` fica
 * `undefined` e tudo segue funcionando com fallbacks vazios.
 *
 * Diagnóstico: `window.__cfGeoDebug` registra cada etapa do boot pra inspeção
 * direta no console (`window.__cfGeoDebug` no DevTools).
 */

const GEO_ENDPOINT = "https://geo.panttera.com.br";
const GEO_CACHE_KEY = "cfGeo";
const GEO_TIMEOUT_MS = 1500;

type CfGeoDebug = {
  endpoint: string;
  origin: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  status: "idle" | "fetching" | "from-cache" | "success" | "timeout" | "cors-or-network" | "http-error" | "invalid-json" | "skipped";
  httpStatus?: number;
  errorName?: string;
  errorMessage?: string;
  payload?: unknown;
  notes: string[];
};

function initDebug(): CfGeoDebug {
  const dbg: CfGeoDebug = {
    endpoint: GEO_ENDPOINT,
    origin: typeof window !== "undefined" ? window.location.origin : "ssr",
    startedAt: new Date().toISOString(),
    status: "idle",
    notes: [],
  };
  if (typeof window !== "undefined") {
    (window as unknown as { __cfGeoDebug?: CfGeoDebug }).__cfGeoDebug = dbg;
  }
  return dbg;
}

function finishDebug(dbg: CfGeoDebug, status: CfGeoDebug["status"], extra: Partial<CfGeoDebug> = {}) {
  dbg.status = status;
  dbg.finishedAt = new Date().toISOString();
  dbg.durationMs = Date.now() - new Date(dbg.startedAt).getTime();
  Object.assign(dbg, extra);
}

/**
 * Busca geo do Worker e popula `window.cfGeo`. Idempotente e silencioso em erro.
 * Usa cache em sessionStorage pra só fazer 1 request por aba.
 */
export async function bootGeo(): Promise<void> {
  if (typeof window === "undefined") return;

  const dbg = initDebug();

  if (window.cfGeo) {
    dbg.notes.push("window.cfGeo already populated");
    finishDebug(dbg, "skipped", { payload: window.cfGeo });
    console.info("[cfGeo] already populated", window.cfGeo);
    return;
  }

  // Tenta cache primeiro (sessionStorage)
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as CfGeo;
      if (parsed && typeof parsed === "object") {
        window.cfGeo = parsed;
        finishDebug(dbg, "from-cache", { payload: parsed });
        console.info("[cfGeo] loaded from sessionStorage", parsed);
        return;
      }
    }
  } catch (e) {
    dbg.notes.push(`sessionStorage read failed: ${(e as Error)?.message ?? "unknown"}`);
  }

  dbg.status = "fetching";
  console.info("[cfGeo] fetching", GEO_ENDPOINT);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
    const res = await fetch(GEO_ENDPOINT, {
      method: "GET",
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });
    clearTimeout(timer);

    dbg.httpStatus = res.status;

    if (!res.ok) {
      finishDebug(dbg, "http-error", {
        notes: [...dbg.notes, `HTTP ${res.status} ${res.statusText}`],
      });
      console.warn("[cfGeo] non-OK response", res.status);
      return;
    }

    let geo: CfGeo;
    try {
      geo = (await res.json()) as CfGeo;
    } catch (jsonErr) {
      finishDebug(dbg, "invalid-json", {
        errorName: (jsonErr as Error)?.name,
        errorMessage: (jsonErr as Error)?.message,
      });
      console.warn("[cfGeo] invalid JSON", jsonErr);
      return;
    }

    if (!geo || typeof geo !== "object") {
      finishDebug(dbg, "invalid-json", {
        notes: [...dbg.notes, "payload is not an object"],
        payload: geo,
      });
      console.warn("[cfGeo] invalid payload", geo);
      return;
    }

    window.cfGeo = geo;
    finishDebug(dbg, "success", { payload: geo });
    console.info("[cfGeo] populated", geo);

    try {
      sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo));
    } catch {
      // ignora — cache é otimização, não requisito
    }
  } catch (err) {
    const error = err as Error;
    const isAbort = error?.name === "AbortError";
    finishDebug(dbg, isAbort ? "timeout" : "cors-or-network", {
      errorName: error?.name,
      errorMessage: error?.message,
    });
    console.warn("[cfGeo] fetch failed", err);
  }
}

export function getCfGeo(): CfGeo | null {
  if (typeof window === "undefined") return null;
  return window.cfGeo ?? null;
}

export function getCountry(fallback = ""): string {
  return (getCfGeo()?.country || fallback).toUpperCase();
}

export function getCurrency(fallback = ""): string {
  return (getCfGeo()?.currency || fallback).toUpperCase();
}

export function getCity(fallback = ""): string {
  return getCfGeo()?.city || fallback;
}

export function getState(fallback = ""): string {
  return getCfGeo()?.regionCode || getCfGeo()?.region || fallback;
}

export function getZip(fallback = ""): string {
  return getCfGeo()?.postal || fallback;
}

/**
 * Retorna o melhor IP do visitante para Meta CAPI.
 * Prioridade: IPv4 (Meta prefere) → IPv6 → ip genérico.
 * Vazio se Worker não estiver populado.
 */
export function getBestIp(fallback = ""): string {
  const geo = getCfGeo();
  return geo?.bestIp || geo?.ipv4 || geo?.ipv6 || geo?.ip || fallback;
}

/** Versão hash-friendly: lowercase, sem espaços, sem pontuação para Meta CAPI. */
export function normalizeForHash(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "").replace(/[^\w]/g, "");
}
