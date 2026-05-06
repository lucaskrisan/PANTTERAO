import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Clock, QrCode, CheckCircle2, Zap, X, Smartphone, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PixModalProps {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  qrCodeUrl?: string;
  pixCode?: string;
  externalOrderId?: string;
  onPaymentConfirmed?: () => void;
}

const PixModal = ({ open, onClose, totalAmount, qrCodeUrl, pixCode, externalOrderId, onPaymentConfirmed }: PixModalProps) => {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1800);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmedCallbackFiredRef = useRef(false);

  useEffect(() => {
    if (!open) { setPaymentConfirmed(false); confirmedCallbackFiredRef.current = false; return; }
    setTimeLeft(1800);
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  // Polling for payment confirmation
  const checkPayment = useCallback(async () => {
    if (!externalOrderId) return;
    try {
      const { data } = await supabase.functions.invoke("check-order-status", {
        body: { external_id: externalOrderId },
      });
      if (data && (data.status === "paid" || data.status === "approved" || data.status === "confirmed")) {
        setPaymentConfirmed(true);
        if (!confirmedCallbackFiredRef.current) {
          confirmedCallbackFiredRef.current = true;
          onPaymentConfirmed?.();
        }
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      }
    } catch (err) {
      console.error("[PixModal] polling error:", err);
    }
  }, [externalOrderId]);

  useEffect(() => {
    if (!open || !externalOrderId || paymentConfirmed) return;
    // Start polling every 5 seconds
    checkPayment(); // immediate check
    pollingRef.current = setInterval(checkPayment, 5000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [open, externalOrderId, paymentConfirmed, checkPayment]);

  // Stop polling when timer expires
  useEffect(() => {
    if (timeLeft <= 0 && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [timeLeft]);

  const handleCopy = async () => {
    if (!pixCode || copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = pixCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } finally {
      setTimeout(() => setCopying(false), 1000);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden z-10 my-6 mx-4 sm:mx-auto shrink-0"
          >
            {paymentConfirmed ? (
              /* ===== CONFIRMED STATE ===== */
              <div className="text-center">
                <div className="bg-gradient-to-r from-[#00A868] to-[#067D62] px-5 py-6 sm:px-6 sm:py-8 text-white relative">
                  <button onClick={onClose} className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full hover:bg-white/20 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                  >
                    <PartyPopper className="w-14 h-14 mx-auto mb-3" />
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl sm:text-2xl font-bold"
                  >
                    Pagamento confirmado! 🎉
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-white/80 text-sm mt-2"
                  >
                    Seu pagamento de R$ {totalAmount.toFixed(2).replace(".", ",")} foi recebido
                  </motion.p>
                </div>
                <div className="p-6 sm:p-8 space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <CheckCircle2 className="w-16 h-16 text-[#00A868] mx-auto mb-3" />
                    <p className="text-[#0F1111] font-semibold text-lg">Tudo certo!</p>
                    <p className="text-[#565959] text-sm mt-1">
                      Você receberá um e-mail com as instruções de acesso ao seu produto. Verifique também a caixa de spam.
                    </p>
                  </motion.div>
                </div>
              </div>
            ) : (
              /* ===== WAITING STATE ===== */
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-[#00A868] to-[#067D62] px-5 py-4 sm:px-6 sm:py-5 text-white relative">
                  <button onClick={onClose} className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full hover:bg-white/20 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-3 pr-8">
                    <div className="p-2 sm:p-2.5 bg-white/20 rounded-xl shrink-0">
                      <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-bold leading-tight">PIX gerado com sucesso!</h2>
                      <p className="text-white/80 text-xs sm:text-sm mt-0.5">Escaneie ou copie o código abaixo</p>
                    </div>
                  </div>
                </div>

                {/* Timer */}
                <div className="flex items-center justify-center gap-2 py-2.5 sm:py-3 bg-[#FFF8E1] border-b border-[#FDE68A]">
                  <Clock className="w-4 h-4 text-[#92400E]" />
                  <span className="text-sm font-semibold text-[#92400E]">
                    Expira em {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5 sm:p-6 space-y-4 sm:space-y-5">
                  {/* Amount */}
                  <div className="text-center">
                    <p className="text-sm text-[#565959]">Valor a pagar</p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-[#0F1111] mt-1">
                      R$ {totalAmount.toFixed(2).replace(".", ",")}
                    </p>
                  </div>

                  {/* QR Code */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex justify-center"
                  >
                    <div className="w-44 h-44 sm:w-52 sm:h-52 bg-white border-2 border-[#E5E7EB] rounded-2xl flex items-center justify-center shadow-sm p-2">
                      {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="QR Code PIX" className="w-full h-full rounded-xl" />
                      ) : (
                        <div className="text-center space-y-2">
                          <QrCode className="w-12 h-12 text-[#D5D9D9] mx-auto" />
                          <p className="text-xs text-[#565959]">Carregando...</p>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Copy button */}
                  {pixCode && (
                    <Button
                      onClick={handleCopy}
                      disabled={copying}
                      className={`w-full h-12 gap-2 rounded-xl font-bold text-base transition-all ${
                        copied
                          ? "bg-[#067D62] hover:bg-[#067D62] text-white"
                          : "bg-[#0F1111] hover:bg-[#1A1A1A] text-white"
                      }`}
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Código copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-5 h-5" />
                          Copiar código PIX
                        </>
                      )}
                    </Button>
                  )}

                  {/* Polling indicator */}
                  {externalOrderId && (
                    <div className="flex items-center justify-center gap-2 text-xs text-[#565959]">
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-2 h-2 rounded-full bg-[#00A868]"
                      />
                      Aguardando confirmação do pagamento...
                    </div>
                  )}

                  {/* Steps */}
                  <div className="bg-[#F7FAFA] border border-[#E5E7EB] rounded-xl p-4">
                    <p className="text-xs font-bold text-[#0F1111] mb-3 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-[#067D62]" />
                      Como pagar:
                    </p>
                    <ol className="text-xs text-[#565959] space-y-2 list-none">
                      {[
                        "Abra o app do seu banco",
                        "Escaneie o QR Code ou cole o código",
                        "Confirme o pagamento",
                        "Acesso liberado na hora! 🎉",
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#067D62] text-white text-[10px] font-bold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PixModal;
