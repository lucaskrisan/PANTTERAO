const CANONICAL_ORIGIN = "https://app.panttera.com.br";

const LEGACY_HOSTNAMES = new Set([
  "paycheckout.lovable.app",
  "checkout.panterapay.com.br",
]);

export function getAuthOrigin() {
  if (typeof window === "undefined") {
    return CANONICAL_ORIGIN;
  }

  const { origin, hostname } = window.location;

  if (LEGACY_HOSTNAMES.has(hostname)) {
    return CANONICAL_ORIGIN;
  }

  return origin;
}

export { CANONICAL_ORIGIN };
