import { toast } from "sonner";
import pantteraAvatar from "@/assets/pantera-mascot.png";

/**
 * Wrappers de toast assinados pela Nina (branding puro, sem IA).
 * Usa o `sonner` já configurado globalmente.
 */
export const ninaToast = (message: string, opts?: { duration?: number }) => {
  toast(
    <div className="flex items-center gap-3">
      <img
        src={pantteraAvatar}
        alt="Panttera"
        width={32}
        height={32}
        loading="lazy"
        className="w-8 h-8 rounded-full ring-1 ring-[#D4AF37]/40 shrink-0"
      />
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-[#D4AF37]">
          Panttera
        </span>
        <span className="text-sm text-foreground">{message}</span>
      </div>
    </div>,
    { duration: opts?.duration ?? 5000 },
  );
};

export const ninaPurchaseToast = (amount: number, currency = "BRL") => {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(amount);
  ninaToast(`Nova venda detectada 🎉 ${formatted}`, { duration: 6000 });
};
