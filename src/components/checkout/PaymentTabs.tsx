import { CreditCard, Zap } from "lucide-react";
import pixIcon from "@/assets/pix-icon.png";
import { cn } from "@/lib/utils";

type PaymentMethod = "credit_card" | "pix";

interface PaymentTabsProps {
  activeMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  pixDiscountPercent?: number;
}

const PaymentTabs = ({ activeMethod, onMethodChange, pixDiscountPercent = 5 }: PaymentTabsProps) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* PIX Tab */}
      <button
        onClick={() => onMethodChange("pix")}
        className={cn(
          "relative flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-xl border-2 transition-all duration-200",
          activeMethod === "pix"
            ? "border-[#007185] bg-[#F0FAFA] shadow-[0_0_0_1px_#007185]"
            : "border-[#D5D9D9] bg-white hover:border-[#007185]/40 hover:bg-[#F7FAFA]"
        )}
      >
        {pixDiscountPercent > 0 && (
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#067D62] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 shadow-sm">
            <Zap className="w-2.5 h-2.5" />
            {pixDiscountPercent}% OFF
          </span>
        )}
        <img src={pixIcon} alt="PIX" className="w-5 h-5" />
        <span className={cn("text-sm font-semibold", activeMethod === "pix" ? "text-[#007185]" : "text-[#0F1111]")}>
          Pix
        </span>
      </button>

      {/* Credit Card Tab */}
      <button
        onClick={() => onMethodChange("credit_card")}
        className={cn(
          "flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-xl border-2 transition-all duration-200",
          activeMethod === "credit_card"
            ? "border-[#007185] bg-[#F0FAFA] shadow-[0_0_0_1px_#007185]"
            : "border-[#D5D9D9] bg-white hover:border-[#007185]/40 hover:bg-[#F7FAFA]"
        )}
      >
        <CreditCard className={cn("w-5 h-5", activeMethod === "credit_card" ? "text-[#007185]" : "text-[#565959]")} />
        <span className={cn("text-sm font-semibold", activeMethod === "credit_card" ? "text-[#007185]" : "text-[#0F1111]")}>
          Cartão
        </span>
      </button>
    </div>
  );
};

export default PaymentTabs;
