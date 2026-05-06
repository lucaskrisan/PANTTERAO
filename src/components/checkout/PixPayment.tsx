import { motion } from "framer-motion";
import { Copy, Clock, QrCode, CheckCircle2, Zap } from "lucide-react";
import pixIcon from "@/assets/pix-icon.png";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface PixPaymentProps {
  totalAmount: number;
  qrCodeData?: string;
  pixCode?: string;
}

const PixPayment = ({ totalAmount, qrCodeData, pixCode }: PixPaymentProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (pixCode) {
      navigator.clipboard.writeText(pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-5">
      {/* PIX info banner */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-[#F0FAF8] to-[#F7FAFA] border border-[#B8E0D8] border-l-4 border-l-[#067D62] rounded-xl p-4">
        <div className="p-2 rounded-lg bg-[#067D62]/10">
          <img src={pixIcon} alt="PIX" className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#0F1111]">Pagamento instantâneo via PIX</p>
          <p className="text-xs text-[#565959] mt-0.5">
            Aprovação em segundos · Sem taxa · 5% de desconto aplicado
          </p>
        </div>
      </div>

      {/* QR Code area */}
      <div className="flex flex-col items-center gap-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-48 h-48 bg-white border-2 border-dashed border-[#D5D9D9] rounded-2xl flex items-center justify-center shadow-sm"
        >
          {qrCodeData ? (
            <img src={qrCodeData} alt="QR Code PIX" className="w-full h-full rounded-2xl p-1" />
          ) : (
            <div className="text-center space-y-2">
              <QrCode className="w-12 h-12 text-[#D5D9D9] mx-auto" />
              <p className="text-xs text-[#565959]">QR Code será gerado<br />ao finalizar</p>
            </div>
          )}
        </motion.div>

        <div className="text-center">
          <p className="text-2xl font-extrabold text-[#0F1111]">
            R$ {totalAmount.toFixed(2).replace('.', ',')}
          </p>
          <div className="flex items-center gap-1.5 justify-center mt-1">
            <Clock className="w-3.5 h-3.5 text-[#007185]" />
            <p className="text-xs text-[#565959]">Expira em 30 minutos</p>
          </div>
        </div>

        {pixCode && (
          <Button
            variant="outline"
            onClick={handleCopy}
            className="w-full h-11 gap-2 border-[#D5D9D9] text-[#0F1111] hover:bg-[#F7FAFA] rounded-xl"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#067D62]" />
                Código copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar código PIX
              </>
            )}
          </Button>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-[#F7FAFA] border border-[#D5D9D9] rounded-xl p-4 space-y-2.5">
        <p className="text-xs font-bold text-[#0F1111]">Como pagar com PIX:</p>
        <ol className="text-xs text-[#565959] space-y-1.5 list-none">
          {[
            'Clique em "Pagar com PIX" abaixo',
            "Abra o app do seu banco",
            "Escaneie o QR Code ou cole o código",
            "Confirme — acesso liberado na hora!",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#007185] text-white text-[10px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default PixPayment;
