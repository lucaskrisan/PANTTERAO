/**
 * Card brand detection by BIN (issuer identification number).
 * Returns the matched brand or 'unknown' when no rule applies.
 *
 * Coverage tuned for Brazil:
 *   visa, mastercard, amex, elo, hipercard, diners, discover, jcb, aura
 *
 * Each rule uses the longest possible prefix range so partial input
 * (1–6 digits) can already preview the brand on the card UI.
 */

export type CardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "elo"
  | "hipercard"
  | "diners"
  | "discover"
  | "jcb"
  | "aura"
  | "unknown";

/**
 * Card *issuer* (banco emissor). Independente da bandeira (brand).
 * Hoje só detectamos Nubank — extender aqui se quisermos pintar Inter,
 * C6, etc. no futuro.
 */
export type CardIssuer =
  | "nubank"
  | "inter"
  | "c6"
  | "itau"
  | "bradesco"
  | "santander"
  | "picpay"
  | "mercadopago"
  | "unknown";

interface BrandRule {
  brand: CardBrand;
  /** Returns true when the (raw, digits-only) number matches this brand. */
  test: (digits: string) => boolean;
}

const inRange = (digits: string, len: number, start: number, end: number) => {
  if (digits.length < 1) return false;
  const slice = digits.slice(0, Math.min(digits.length, len));
  if (!slice) return false;
  // Pad short input with the lower bound's leading digits so a partial number
  // can still be classified ("4011" → elo as soon as 4 digits are present).
  const padded = slice.padEnd(len, "0");
  const num = Number(padded);
  return num >= start && num <= end;
};

const startsWith = (digits: string, prefixes: string[]) =>
  prefixes.some((p) => digits.startsWith(p.slice(0, digits.length)) && digits.length >= 1 && p.startsWith(digits.slice(0, p.length)));

// Specific Elo BIN list (covers most Brazilian Elo issuances).
const ELO_BINS_4: string[] = [
  "4011", "4312", "4389", "4514", "4573", "5041", "5066", "5067",
  "5090", "6277", "6362", "6363", "6500", "6504", "6505", "6509",
  "6516", "6550",
];

const ELO_BINS_6_RANGES: Array<[number, number]> = [
  [401178, 401179],
  [438935, 438935],
  [451416, 451416],
  [457631, 457632],
  [504175, 504175],
  [506699, 506778],
  [509000, 509999],
  [627780, 627780],
  [636297, 636297],
  [636368, 636368],
  [650031, 650033],
  [650035, 650051],
  [650405, 650439],
  [650485, 650538],
  [650541, 650598],
  [650700, 650718],
  [650720, 650727],
  [650901, 650978],
  [651652, 651679],
  [655000, 655019],
  [655021, 655058],
];

const isElo = (d: string) => {
  if (!d) return false;
  // Match by first 4 digits as soon as available.
  if (d.length >= 4 && ELO_BINS_4.some((p) => d.startsWith(p))) return true;
  // Then refine with 6-digit ranges if number is long enough.
  if (d.length >= 6) {
    const six = Number(d.slice(0, 6));
    return ELO_BINS_6_RANGES.some(([lo, hi]) => six >= lo && six <= hi);
  }
  return false;
};

const RULES: BrandRule[] = [
  // Elo first — its BINs overlap with Visa/Master ranges (e.g. 4011, 5067).
  { brand: "elo", test: isElo },

  // Hipercard
  { brand: "hipercard", test: (d) => d.startsWith("606282") || d.startsWith("3841") || (d.length >= 4 && d.startsWith("6062")) },

  // Amex — 34 / 37
  { brand: "amex", test: (d) => /^3[47]/.test(d) },

  // Diners Club — 300-305, 36, 38, 39
  { brand: "diners", test: (d) => /^3(0[0-5]|[689])/.test(d) },

  // JCB — 35
  { brand: "jcb", test: (d) => /^35/.test(d) },

  // Discover — 6011, 622126-622925, 644-649, 65
  {
    brand: "discover",
    test: (d) =>
      d.startsWith("6011") ||
      /^65/.test(d) ||
      /^64[4-9]/.test(d) ||
      (d.length >= 6 && inRange(d, 6, 622126, 622925)),
  },

  // Aura (Brasil) — começa com 50 (mas não conflita com Maestro 5018/5020/5038/6304…)
  { brand: "aura", test: (d) => d.length >= 2 && d.startsWith("50") },

  // Mastercard — 51-55 e 2221-2720
  {
    brand: "mastercard",
    test: (d) =>
      /^5[1-5]/.test(d) ||
      (d.length >= 4 && inRange(d, 4, 2221, 2720)),
  },

  // Visa — 4 (mais ampla, vai por último)
  { brand: "visa", test: (d) => d.startsWith("4") },
];

export function detectCardBrand(value: string): CardBrand {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "unknown";
  for (const rule of RULES) {
    if (rule.test(digits)) return rule.brand;
  }
  return "unknown";
}

/** Iconify icon name per brand (set "logos" — official, no extra package). */
export const BRAND_ICONS: Record<Exclude<CardBrand, "unknown">, string> = {
  visa: "logos:visa",
  mastercard: "logos:mastercard",
  amex: "logos:amex",
  elo: "logos:elo",
  hipercard: "simple-icons:hipercard",
  diners: "logos:diners-club",
  discover: "logos:discover",
  jcb: "logos:jcb",
  aura: "simple-icons:visa", // fallback genérico
};

export const BRAND_LABEL: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  elo: "Elo",
  hipercard: "Hipercard",
  diners: "Diners Club",
  discover: "Discover",
  jcb: "JCB",
  aura: "Aura",
  unknown: "",
};

/* ------------------------------------------------------------------ */
/* Issuer detection (Nubank, etc.)                                    */
/* ------------------------------------------------------------------ */

// BINs públicos mais comuns do Nubank (Mastercard + Elo).
// Lista conservadora — só prefixos amplamente confirmados.
const NUBANK_BINS_6: string[] = [
  // Mastercard Nubank
  "516292", "533593", "536366", "552461", "545047", "548126",
  // Elo Nubank
  "498409", "509048",
];
const NUBANK_BINS_4: string[] = ["5162", "5335", "5363", "5524", "5450", "5481", "4984", "5090"];

export function detectCardIssuer(value: string): CardIssuer {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "unknown";
  if (digits.length >= 6) {
    const six = digits.slice(0, 6);
    if (NUBANK_BINS_6.some((b) => six === b)) return "nubank";
  }
  if (digits.length >= 4) {
    const four = digits.slice(0, 4);
    if (NUBANK_BINS_4.includes(four)) return "nubank";
  }
  return "unknown";
}

/* ------------------------------------------------------------------ */
/* Theme (gradientes por bandeira/issuer)                             */
/* ------------------------------------------------------------------ */

export interface CardTheme {
  /** CSS background (gradient) aplicado nas faces do cartão. */
  background: string;
  /** Cor do glow superior. */
  glowTop: string;
  /** Cor do glow inferior. */
  glowBottom: string;
  /** Cor do texto principal. */
  foreground: string;
  /** Cor dos labels (titular/validade). */
  muted: string;
  /** Etiqueta amigável (mostrada no canto, opcional). */
  label?: string;
}

/** Tema padrão (Panttera) — usado quando não há bandeira detectada. */
export const DEFAULT_CARD_THEME: CardTheme = {
  background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)",
  glowTop: "hsl(var(--primary) / 0.55)",
  glowBottom: "hsl(var(--accent) / 0.45)",
  foreground: "hsl(var(--foreground))",
  muted: "hsl(var(--muted-foreground))",
};

const BRAND_THEMES: Record<Exclude<CardBrand, "unknown">, CardTheme> = {
  visa: {
    background: "linear-gradient(135deg, #1a1f71 0%, #0b1240 60%, #050a2b 100%)",
    glowTop: "rgba(80, 120, 255, 0.55)",
    glowBottom: "rgba(20, 40, 120, 0.55)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.7)",
    label: "Visa",
  },
  mastercard: {
    background: "linear-gradient(135deg, #1a1a1a 0%, #4a1a0a 55%, #7a1a05 100%)",
    glowTop: "rgba(255, 95, 0, 0.55)",
    glowBottom: "rgba(235, 0, 27, 0.45)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.7)",
    label: "Mastercard",
  },
  amex: {
    background: "linear-gradient(135deg, #006b73 0%, #003a47 60%, #0a1f28 100%)",
    glowTop: "rgba(0, 165, 180, 0.5)",
    glowBottom: "rgba(20, 50, 70, 0.55)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.7)",
    label: "Amex",
  },
  elo: {
    background: "linear-gradient(135deg, #000000 0%, #2a1a00 55%, #5a3a00 100%)",
    glowTop: "rgba(255, 200, 0, 0.45)",
    glowBottom: "rgba(255, 80, 0, 0.35)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.7)",
    label: "Elo",
  },
  hipercard: {
    background: "linear-gradient(135deg, #b3001b 0%, #6b0010 60%, #2a0008 100%)",
    glowTop: "rgba(255, 60, 60, 0.55)",
    glowBottom: "rgba(120, 0, 20, 0.55)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.75)",
    label: "Hipercard",
  },
  diners: {
    background: "linear-gradient(135deg, #1a3a5a 0%, #0a1f33 60%, #050f1f 100%)",
    glowTop: "rgba(80, 140, 200, 0.5)",
    glowBottom: "rgba(20, 40, 70, 0.55)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.7)",
    label: "Diners",
  },
  discover: {
    background: "linear-gradient(135deg, #ff6f00 0%, #b34a00 60%, #4a1f00 100%)",
    glowTop: "rgba(255, 140, 0, 0.55)",
    glowBottom: "rgba(120, 50, 0, 0.5)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.75)",
    label: "Discover",
  },
  jcb: {
    background: "linear-gradient(135deg, #0b3d91 0%, #6b0f1a 55%, #0b6b3a 100%)",
    glowTop: "rgba(120, 180, 255, 0.45)",
    glowBottom: "rgba(255, 80, 80, 0.4)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.75)",
    label: "JCB",
  },
  aura: {
    background: "linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)",
    glowTop: "rgba(180, 180, 180, 0.4)",
    glowBottom: "rgba(80, 80, 80, 0.45)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.7)",
    label: "Aura",
  },
};

/** Tema especial para o Nubank (sobrepõe a bandeira). */
const NUBANK_THEME: CardTheme = {
  background: "linear-gradient(135deg, #8a05be 0%, #5b0a8a 55%, #2c0a4a 100%)",
  glowTop: "rgba(170, 60, 230, 0.55)",
  glowBottom: "rgba(90, 20, 160, 0.5)",
  foreground: "#ffffff",
  muted: "rgba(255,255,255,0.78)",
  label: "Nubank",
};

const ISSUER_THEMES: Record<Exclude<CardIssuer, "unknown">, CardTheme> = {
  nubank: NUBANK_THEME,
  inter: {
    background: "linear-gradient(135deg, #ff7a00 0%, #cc4a00 55%, #4a1a00 100%)",
    glowTop: "rgba(255, 140, 0, 0.55)",
    glowBottom: "rgba(180, 60, 0, 0.5)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.78)",
    label: "Inter",
  },
  c6: {
    background: "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 60%, #000000 100%)",
    glowTop: "rgba(200, 200, 200, 0.35)",
    glowBottom: "rgba(80, 80, 80, 0.45)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.7)",
    label: "C6",
  },
  itau: {
    background: "linear-gradient(135deg, #ec7000 0%, #003595 60%, #001a4a 100%)",
    glowTop: "rgba(255, 140, 0, 0.5)",
    glowBottom: "rgba(0, 60, 160, 0.55)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.78)",
    label: "Itaú",
  },
  bradesco: {
    background: "linear-gradient(135deg, #cc092f 0%, #7a0518 60%, #2a0008 100%)",
    glowTop: "rgba(255, 60, 80, 0.55)",
    glowBottom: "rgba(140, 0, 25, 0.5)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.78)",
    label: "Bradesco",
  },
  santander: {
    background: "linear-gradient(135deg, #ec0000 0%, #8a0000 60%, #2a0000 100%)",
    glowTop: "rgba(255, 80, 80, 0.55)",
    glowBottom: "rgba(140, 0, 0, 0.5)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.78)",
    label: "Santander",
  },
  picpay: {
    background: "linear-gradient(135deg, #21c25e 0%, #0f7a3a 60%, #052a14 100%)",
    glowTop: "rgba(50, 220, 110, 0.55)",
    glowBottom: "rgba(15, 120, 60, 0.5)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.78)",
    label: "PicPay",
  },
  mercadopago: {
    background: "linear-gradient(135deg, #00b1ea 0%, #006fa3 60%, #002a4a 100%)",
    glowTop: "rgba(80, 200, 255, 0.55)",
    glowBottom: "rgba(0, 110, 170, 0.5)",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.78)",
    label: "Mercado Pago",
  },
};

/** Mapeia o nome do banco (binlist) para um issuer conhecido. */
export function issuerFromBankName(bankName: string | null | undefined): CardIssuer {
  if (!bankName) return "unknown";
  const n = bankName.toLowerCase();
  if (n.includes("nu pagamentos") || n.includes("nubank") || n.includes("nu financeira")) return "nubank";
  if (n.includes("banco inter") || /\binter\b/.test(n)) return "inter";
  if (n.includes("c6")) return "c6";
  if (n.includes("itau") || n.includes("itaú") || n.includes("itaucard")) return "itau";
  if (n.includes("bradesco")) return "bradesco";
  if (n.includes("santander")) return "santander";
  if (n.includes("picpay")) return "picpay";
  if (n.includes("mercado pago") || n.includes("mercadopago")) return "mercadopago";
  return "unknown";
}

/** Resolve o tema final do cartão, priorizando o issuer (banco) sobre a bandeira. */
export function getCardTheme(brand: CardBrand, issuer: CardIssuer): CardTheme {
  if (issuer !== "unknown") return ISSUER_THEMES[issuer];
  if (brand === "unknown") return DEFAULT_CARD_THEME;
  return BRAND_THEMES[brand];
}
