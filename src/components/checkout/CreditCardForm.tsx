import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, HelpCircle, Lock } from "lucide-react";
import CardPreview3D, { type CardPreviewFocus } from "@/components/ui/card-preview-3d";
import { useBinLookup } from "@/hooks/useBinLookup";

export interface CreditCardData {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
  installments: string;
}

interface CreditCardFormProps {
  data: CreditCardData;
  onChange: (data: CreditCardData) => void;
  totalAmount: number;
  isUSD?: boolean;
}

const formatCardNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
};


const CreditCardForm = ({ data, onChange, totalAmount, isUSD = false }: CreditCardFormProps) => {
  const [focus, setFocus] = useState<CardPreviewFocus>(null);
  const binResult = useBinLookup(data.number);
  const handleChange = (field: keyof CreditCardData, value: string) => {
    let formatted = value;
    if (field === "number") formatted = formatCardNumber(value);
    if (field === "cvv") formatted = value.replace(/\D/g, "").slice(0, 4);
    onChange({ ...data, [field]: formatted });
  };

  const expiryParts = data.expiry.split("/");
  const expiryMonth = expiryParts[0] || "";
  const expiryYear = expiryParts[1] || "";

  const handleExpiryChange = (type: "month" | "year", value: string) => {
    if (type === "month") {
      onChange({ ...data, expiry: `${value}/${expiryYear}` });
    } else {
      onChange({ ...data, expiry: `${expiryMonth}/${value}` });
    }
  };

  const INTEREST_RATE = 0.0299;
  const installmentOptions = isUSD
    ? [{ value: "1", label: `1x of $${totalAmount.toFixed(2)}` }]
    : Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        if (n === 1) {
          return { value: "1", label: `1x de R$ ${totalAmount.toFixed(2).replace(".", ",")} (sem juros)` };
        }
        const installmentValue = totalAmount * INTEREST_RATE / (1 - Math.pow(1 + INTEREST_RATE, -n));
        const totalWithInterest = installmentValue * n;
        return {
          value: String(n),
          label: `${n}x de R$ ${installmentValue.toFixed(2).replace(".", ",")} (R$ ${totalWithInterest.toFixed(2).replace(".", ",")})`,
        };
      });

  const inputClass = "h-11 bg-white border-[#D5D9D9] text-[#0F1111] placeholder:text-[#767676] rounded-lg focus:border-[#007185] focus:ring-[#007185]";

  // For USD/Stripe, show a minimal form — Stripe Checkout handles the actual card
  if (isUSD) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="mb-4">
        <CardPreview3D
          number={data.number}
          holder={data.name}
          month={expiryMonth}
          year={expiryYear}
          cvv={data.cvv}
          focus={focus}
          issuerOverride={binResult?.issuer}
        />
      </div>

      <Input
        value={data.name}
        onChange={(e) => handleChange("name", e.target.value)}
        onFocus={() => setFocus("holder")}
        onBlur={() => setFocus(null)}
        placeholder="Nome impresso no cartão"
        autoComplete="cc-name"
        className={inputClass}
      />

      <div className="relative">
        <Input
          value={data.number}
          onChange={(e) => handleChange("number", e.target.value)}
          onFocus={() => setFocus("number")}
          onBlur={() => setFocus(null)}
          placeholder="Número do cartão"
          inputMode="numeric"
          autoComplete="cc-number"
          className={`${inputClass} pr-10 font-mono tracking-wider`}
        />
        <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#565959]" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Select value={expiryMonth} onValueChange={(v) => handleExpiryChange("month", v)}>
          <SelectTrigger className={inputClass} onFocus={() => setFocus("expire")} onBlur={() => setFocus(null)}>
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1).padStart(2, "0");
              return <SelectItem key={m} value={m}>{m}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Select value={expiryYear} onValueChange={(v) => handleExpiryChange("year", v)}>
          <SelectTrigger className={inputClass} onFocus={() => setFocus("expire")} onBlur={() => setFocus(null)}>
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 15 }, (_, i) => {
              const y = String(new Date().getFullYear() + i).slice(2);
              return <SelectItem key={y} value={y}>{y}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <div className="relative">
          <Input
            value={data.cvv}
            onChange={(e) => handleChange("cvv", e.target.value)}
            onFocus={() => setFocus("cvv")}
            onBlur={() => setFocus(null)}
            placeholder="CVV"
            inputMode="numeric"
            autoComplete="cc-csc"
            className={`${inputClass} pr-8 font-mono`}
          />
          <HelpCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#565959]" />
        </div>
      </div>


      <Select value={data.installments} onValueChange={(v) => handleChange("installments", v)}>
        <SelectTrigger className={inputClass}>
          <SelectValue placeholder="Parcelas" />
        </SelectTrigger>
        <SelectContent>
          {installmentOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 text-xs text-[#565959]">
        <Lock className="w-3.5 h-3.5 text-[#007185]" />
        Seus dados estão protegidos com criptografia SSL
      </div>
    </div>
  );
};

export default CreditCardForm;
