import { memo } from "react";
import { Lock, Shield, ShieldCheck } from "lucide-react";

interface TrustFooterTranslations {
  securePayment: string;
  dataProtected: string;
  ssl: string;
  agreePrefix: string;
  termsOfUse: string;
  and: string;
  privacyPolicy: string;
  agreeSuffix: string;
}

interface TrustFooterProps {
  isUSD?: boolean;
  t?: TrustFooterTranslations;
}

const ptDefault: TrustFooterTranslations = {
  securePayment: "Pagamento seguro",
  dataProtected: "Dados protegidos",
  ssl: "SSL 256 bits",
  agreePrefix: "Ao continuar, você concorda com os ",
  termsOfUse: "termos de uso",
  and: " e ",
  privacyPolicy: "política de privacidade",
  agreeSuffix: ".",
};

const enDefault: TrustFooterTranslations = {
  securePayment: "Secure payment",
  dataProtected: "Data protected",
  ssl: "256-bit SSL",
  agreePrefix: "By continuing, you agree to the ",
  termsOfUse: "terms of use",
  and: " and ",
  privacyPolicy: "privacy policy",
  agreeSuffix: ".",
};

const TrustFooter = memo(function TrustFooter({ isUSD = false, t }: TrustFooterProps) {
  const tr = t ?? (isUSD ? enDefault : ptDefault);
  return (
    <div className="text-center space-y-3 pt-2 pb-2">
      <div className="flex items-center justify-center gap-4 text-xs text-[#565959]">
        <div className="flex items-center gap-1">
          <Lock className="w-3.5 h-3.5 text-[#007185]" />
          <span>{tr.securePayment}</span>
        </div>
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#007185]" />
          <span>{tr.dataProtected}</span>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-[#007185]" />
          <span>{tr.ssl}</span>
        </div>
      </div>
      <p className="text-[11px] text-[#565959]">
        {tr.agreePrefix}
        <a href="/termos" target="_blank" rel="noopener noreferrer" className="underline text-[#007185]">{tr.termsOfUse}</a>
        {tr.and}
        <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline text-[#007185]">{tr.privacyPolicy}</a>
        {tr.agreeSuffix}
      </p>
    </div>
  );
});

export default TrustFooter;
