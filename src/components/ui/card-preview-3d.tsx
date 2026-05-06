import { useMemo } from "react";
import { Icon } from "@iconify/react";
import {
  detectCardBrand,
  detectCardIssuer,
  getCardTheme,
  BRAND_ICONS,
  BRAND_LABEL,
  type CardIssuer,
} from "@/lib/cardBrand";

export type CardPreviewFocus = "number" | "holder" | "expire" | "cvv" | null;

interface CardPreview3DProps {
  number: string;       // raw or with spaces — only digits used
  holder: string;
  month: string;        // "01".."12"
  year: string;         // "AA" or "AAAA"
  cvv: string;
  focus?: CardPreviewFocus;
  maskMiddle?: boolean; // mask digits 5..12 with *
  brandLabel?: string;
  /** Sobrescreve o issuer detectado por BIN local (ex: vindo do binlist). */
  issuerOverride?: CardIssuer;
  /** i18n labels (default em português) */
  holderLabel?: string;
  expireLabel?: string;
  holderPlaceholder?: string;
  className?: string;
}

/**
 * Visual-only animated 3D credit card preview.
 * - Flips on CVV focus
 * - Slide animation per digit when filled
 * - Highlight overlay on focused field
 * - Themed with Panttera tokens (no payment logic, no inputs)
 */
const CardPreview3D = ({
  number,
  holder,
  month,
  year,
  cvv,
  focus = null,
  maskMiddle = false,
  brandLabel,
  issuerOverride,
  holderLabel = "Titular",
  expireLabel = "Validade",
  holderPlaceholder = "NOME NO CARTÃO",
  className = "",
}: CardPreview3DProps) => {
  const digits = useMemo(() => number.replace(/\D/g, "").slice(0, 16), [number]);
  const brand = useMemo(() => detectCardBrand(digits), [digits]);
  const localIssuer = useMemo(() => detectCardIssuer(digits), [digits]);
  const issuer: CardIssuer =
    issuerOverride && issuerOverride !== "unknown" ? issuerOverride : localIssuer;
  const theme = useMemo(() => getCardTheme(brand, issuer), [brand, issuer]);
  const brandIcon = brand !== "unknown" ? BRAND_ICONS[brand] : null;
  const brandTitle = BRAND_LABEL[brand];
  const slots = useMemo(() => {
    const arr: { char: string; filled: boolean }[] = [];
    for (let i = 0; i < 16; i++) {
      let c = "•";
      if (i < digits.length) {
        const d = digits[i];
        const shouldMask = maskMiddle && i >= 4 && i <= 11;
        c = shouldMask ? "*" : d;
      }
      arr.push({ char: c, filled: i < digits.length });
    }
    return arr;
  }, [digits, maskMiddle]);

  const yy = year ? year.slice(-2) : "";
  const flip = focus === "cvv";
  const resolvedLabel = brandLabel?.trim() || theme.label || "";
  const showBrandLabel = Boolean(resolvedLabel);

  const highlightClass =
    focus === "number" ? "hl-number"
    : focus === "holder" ? "hl-holder"
    : focus === "expire" ? "hl-expire"
    : focus === "cvv" ? "hl-cvv"
    : "hl-hidden";

  return (
    <div
      className={`cp3d-wrap ${className}`}
      style={{
        // Tema dinâmico por bandeira/issuer (CSS vars locais)
        ["--cp3d-bg" as string]: theme.background,
        ["--cp3d-glow-top" as string]: theme.glowTop,
        ["--cp3d-glow-bottom" as string]: theme.glowBottom,
        ["--cp3d-fg" as string]: theme.foreground,
        ["--cp3d-muted" as string]: theme.muted,
      }}
    >
      <div className={`cp3d-card ${flip ? "is-flipped is-animating" : ""}`}>
        {/* FRONT */}
        <div className="cp3d-face cp3d-front">
          <div
            className={`cp3d-highlight ${focus === "cvv" ? "hl-hidden" : highlightClass}`}
            aria-hidden
          />
          <div className={`cp3d-header ${showBrandLabel ? "" : "is-logo-only"}`}>
            {showBrandLabel ? <span className="cp3d-brand">{resolvedLabel}</span> : <span aria-hidden />}
            <span className="cp3d-brand-logo" aria-label={brandTitle || undefined}>
              {issuer !== "unknown" ? (
                <span className="cp3d-issuer-badge">
                  {issuer === "nubank" ? "Nu" : (theme.label || "•").slice(0, 3)}
                </span>
              ) : brandIcon ? (
                <Icon icon={brandIcon} className="cp3d-brand-icon" />
              ) : (
                <span className="cp3d-chip" aria-hidden>
                  <span /><span /><span /><span />
                </span>
              )}
            </span>
          </div>

          <div className="cp3d-number">
            {slots.map((s, i) => (
              <span
                key={i}
                className={`cp3d-slot ${(i + 1) % 4 === 0 ? "cp3d-gap" : ""}`}
              >
                <span className={`cp3d-digit ${s.filled ? "is-filled" : ""}`}>
                  <span className="cp3d-row cp3d-row-empty">•</span>
                  <span className="cp3d-row">{s.char}</span>
                </span>
              </span>
            ))}
          </div>

          <div className="cp3d-footer">
            <div className="cp3d-block">
              <span className="cp3d-label">{holderLabel}</span>
              <span className="cp3d-holder">{holder || holderPlaceholder}</span>
            </div>
            <div className="cp3d-block cp3d-expire-block">
              <span className="cp3d-label">{expireLabel}</span>
              <span className="cp3d-expire">
                {month || "MM"}/{yy || "AA"}
              </span>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="cp3d-face cp3d-back">
          <div className="cp3d-magstrip" />
          <div className="cp3d-cvv-area">
            <span className="cp3d-cvv-label">CVV</span>
            <div className="cp3d-cvv-field">
              <span className="cp3d-cvv-value">{cvv ? "*".repeat(cvv.length) : ""}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .cp3d-wrap {
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          perspective: 1000px;
          -webkit-perspective: 1000px;
          container-type: inline-size;
          /* IMPORTANT: do NOT add isolation/contain/overflow here.
             Safari iOS collapses the 3D context (preserve-3d) when the
             ancestor has containment, causing the back face to bleed
             through mirrored over the front during the flip. */
        }
        .cp3d-card {
          position: relative;
          width: 100%;
          height: 233px;
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
          transition: transform 0.55s cubic-bezier(.4,.2,.2,1);
        }
        /* will-change só durante a animação — evita layer GPU permanente no mobile */
        .cp3d-card.is-animating { will-change: transform; }
        .cp3d-card.is-flipped {
          transform: rotateY(180deg);
          -webkit-transform: rotateY(180deg);
        }

        .cp3d-face {
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 24px 28px 26px;
          background: var(--cp3d-bg, linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%));
          color: var(--cp3d-fg, hsl(var(--foreground)));
          overflow: hidden;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          /* translateZ keeps each face on its own GPU layer in Safari iOS */
          transform: translate3d(0, 0, 0.01px);
          -webkit-transform: translate3d(0, 0, 0.01px);
          box-shadow:
            0 24px 48px -16px hsl(var(--primary) / 0.35),
            0 2px 0 0 hsl(var(--border)) inset;
          border: 1px solid hsl(var(--border));
          /* No containment here - breaks preserve-3d on Safari iOS */
        }
        .cp3d-back {
          transform: rotateY(180deg) translate3d(0, 0, 0.01px);
          -webkit-transform: rotateY(180deg) translate3d(0, 0, 0.01px);
          padding: 24px 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .cp3d-card { transition: none; }
        }

        /* Glow rings using brand tokens */
        .cp3d-face::before,
        .cp3d-face::after {
          content: "";
          position: absolute;
          border-radius: 100%;
          width: 280px;
          height: 280px;
          filter: blur(28px);
          opacity: 0.55;
          pointer-events: none;
        }
        .cp3d-face::before {
          background: var(--cp3d-glow-top, hsl(var(--primary) / 0.55));
          top: -90px;
          left: -60px;
        }
        .cp3d-face::after {
          background: var(--cp3d-glow-bottom, hsl(var(--accent) / 0.45));
          bottom: -110px;
          right: -80px;
        }

        .cp3d-highlight {
          position: absolute;
          border: 1px solid var(--cp3d-fg, hsl(var(--foreground) / 0.55));
          border-radius: 10px;
          z-index: 2;
          width: 0; height: 0; top: 0; left: 0;
          box-shadow: 0 0 8px var(--cp3d-fg, hsl(var(--foreground) / 0.35));
          transition: all 0.3s ease;
          pointer-events: none;
        }
        .cp3d-highlight.hl-hidden { opacity: 0; }
        /* Coordenadas calibradas com o layout real:
           header (~46px) + número (30px) começa em ~70px;
           footer com titular/validade começa em ~150px. */
        .cp3d-highlight.hl-number { width: calc(100% - 36px); height: 40px; top: 82px; left: 18px; }
        .cp3d-highlight.hl-holder { width: 58%; height: 44px; top: 148px; left: 18px; }
        .cp3d-highlight.hl-expire { width: 78px; height: 44px; top: 148px; right: 18px; left: auto; }
        .cp3d-highlight.hl-cvv    { width: calc(100% - 36px); height: 60px; top: 70px; left: 18px; }

        .cp3d-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 600;
          margin-bottom: 28px;
          position: relative;
          z-index: 1;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          font-size: 13px;
          color: var(--cp3d-fg, hsl(var(--foreground)));
        }
        .cp3d-header.is-logo-only {
          justify-content: flex-end;
        }
        .cp3d-brand {
          color: var(--cp3d-fg, hsl(var(--primary)));
          font-weight: 700;
          opacity: 0.95;
        }
        .cp3d-brand-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 48px;
          height: 30px;
        }
        .cp3d-brand-icon {
          width: auto;
          height: 30px;
          max-width: 64px;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 4px;
          padding: 2px 4px;
        }
        .cp3d-issuer-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 30px;
          padding: 0 8px;
          border-radius: 6px;
          background: #ffffff;
          color: #8a05be;
          font-weight: 800;
          font-size: 16px;
          font-style: italic;
          letter-spacing: -0.5px;
          font-family: ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }
        .cp3d-chip {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          width: 32px;
          height: 24px;
          border-radius: 4px;
          background: linear-gradient(135deg, hsl(var(--accent) / 0.9), hsl(var(--accent) / 0.5));
          padding: 3px;
        }
        .cp3d-chip span {
          background: hsl(var(--background) / 0.4);
          border-radius: 1px;
        }

        .cp3d-number {
          font-size: 22px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          margin-bottom: 28px;
          position: relative;
          z-index: 1;
          display: flex;
          height: 30px;
          overflow: hidden;
          color: var(--cp3d-fg, hsl(var(--foreground)));
          letter-spacing: 0.5px;
        }
        .cp3d-slot { display: inline-flex; }
        .cp3d-slot.cp3d-gap { margin-right: 10px; }
        .cp3d-digit {
          display: flex;
          flex-direction: column;
          height: 30px;
          line-height: 30px;
          transition: transform 0.25s ease;
        }
        .cp3d-digit.is-filled { transform: translateY(-30px); }
        .cp3d-row { height: 30px; display: block; min-width: 14px; text-align: center; }

        .cp3d-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          position: relative;
          z-index: 1;
        }
        .cp3d-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          flex: 1;
        }
        .cp3d-expire-block { flex: 0 0 auto; align-items: flex-end; }
        .cp3d-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--cp3d-muted, hsl(var(--muted-foreground)));
          font-weight: 600;
        }
        .cp3d-holder {
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--cp3d-fg, hsl(var(--foreground)));
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cp3d-expire {
          font-size: 14px;
          font-weight: 600;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--cp3d-fg, hsl(var(--foreground)));
        }

        .cp3d-magstrip {
          position: relative;
          z-index: 1;
          margin-top: 0;
          height: 40px;
          width: 100%;
          background: #6b7280;
        }
        .cp3d-cvv-area {
          position: relative;
          z-index: 1;
          margin-top: 24px;
          padding: 0 28px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }
        .cp3d-cvv-label {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--cp3d-fg, #fff);
          opacity: 0.95;
        }
        .cp3d-cvv-field {
          background: #fff;
          border-radius: 10px;
          height: 42px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 14px;
        }
        .cp3d-cvv-value {
          color: #000;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 22px;
          line-height: 1;
          letter-spacing: 4px;
          font-weight: 700;
          min-height: 22px;
        }

        /* Container query: react to the wrapper width, not the viewport,
           so the card fits perfectly inside narrow checkout columns too. */
        @container (max-width: 380px) {
          .cp3d-card { height: 200px; }
          .cp3d-face { padding: 16px 18px 18px; }
          .cp3d-header { margin-bottom: 20px; font-size: 12px; }
          .cp3d-chip { width: 28px; height: 21px; }
          .cp3d-number { font-size: 18px; height: 26px; margin-bottom: 22px; letter-spacing: 0; }
          .cp3d-digit { height: 26px; line-height: 26px; }
          .cp3d-digit.is-filled { transform: translateY(-26px); }
          .cp3d-row { height: 26px; min-width: 11px; }
          .cp3d-slot.cp3d-gap { margin-right: 6px; }
          .cp3d-holder, .cp3d-expire { font-size: 13px; }
          .cp3d-highlight.hl-number { width: calc(100% - 32px); top: 68px; left: 16px; height: 34px; }
          .cp3d-highlight.hl-holder { top: 128px; left: 16px; height: 40px; }
          .cp3d-highlight.hl-expire { top: 128px; right: 16px; height: 40px; width: 70px; }
          .cp3d-highlight.hl-cvv { width: calc(100% - 32px); left: 16px; top: 60px; }
        }
        @container (max-width: 320px) {
          .cp3d-number { font-size: 16px; }
          .cp3d-row { min-width: 10px; }
          .cp3d-slot.cp3d-gap { margin-right: 4px; }
        }
      `}</style>
    </div>
  );
};

export default CardPreview3D;
