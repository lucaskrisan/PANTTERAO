import { motion } from "framer-motion";
import { Palette, Globe, CheckCircle, Lock, CreditCard, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

function CheckoutMockup() {
  return (
    <div className="relative" aria-hidden="true">
      <motion.div
        initial={{ opacity: 0, y: 40, rotateY: -5 }}
        whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
      >
        <div className="bg-[#1a1a1e] rounded-xl p-[5px] border border-white/[0.08] shadow-[0_30px_80px_rgba(0,230,118,0.06)]">
          <div className="bg-[#0B0B0D] rounded-lg overflow-hidden">
            <div className="h-7 bg-[#141417] flex items-center px-3 gap-1.5 border-b border-white/[0.04]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF5F57]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#28C840]" />
              <div className="ml-3 h-4 flex-1 max-w-[200px] rounded bg-[#1E1E22] flex items-center justify-center gap-1 px-2">
                <Lock className="w-2 h-2 text-[#28C840]" />
                <span className="text-[7px] text-[#6A6A75] font-mono">checkout.seusite.com.br</span>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/15 flex items-center justify-center">
                  <span className="text-xs">🐆</span>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-white">Sua Marca Aqui</p>
                  <p className="text-[6px] text-[#6A6A75]">checkout.seusite.com.br</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    {["Nome completo", "E-mail", "CPF"].map((label) => (
                      <div key={label}>
                        <p className="text-[6px] text-[#6A6A75] mb-0.5">{label}</p>
                        <div className="h-5 bg-[#1E1E22] rounded border border-white/[0.06]" />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-1 mt-2">
                    <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded px-2 py-1">
                      <QrCode className="w-2.5 h-2.5 text-primary" />
                      <span className="text-[6px] font-bold text-primary">PIX</span>
                    </div>
                    <div className="flex items-center gap-1 bg-[#1E1E22] border border-white/[0.06] rounded px-2 py-1">
                      <CreditCard className="w-2.5 h-2.5 text-[#6A6A75]" />
                      <span className="text-[6px] text-[#6A6A75]">Cartão</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <p className="text-[6px] text-[#6A6A75] mb-0.5">Número do cartão</p>
                      <div className="h-5 bg-[#1E1E22] rounded border border-white/[0.06] flex items-center px-1.5">
                        <span className="text-[6px] text-[#4A4A55] font-mono">•••• •••• •••• 4242</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <p className="text-[6px] text-[#6A6A75] mb-0.5">Validade</p>
                        <div className="h-5 bg-[#1E1E22] rounded border border-white/[0.06]" />
                      </div>
                      <div>
                        <p className="text-[6px] text-[#6A6A75] mb-0.5">CVV</p>
                        <div className="h-5 bg-[#1E1E22] rounded border border-white/[0.06]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#141417] rounded-lg p-3 border border-white/[0.04] space-y-2.5 h-fit">
                  <p className="text-[7px] text-[#6A6A75] uppercase tracking-wider font-bold">Resumo</p>
                  
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10" />
                    <div>
                      <p className="text-[8px] font-bold text-white">Curso Expert Digital</p>
                      <p className="text-[7px] text-[#6A6A75]">Acesso vitalício</p>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.04] pt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[7px] text-[#6A6A75]">Subtotal</span>
                      <span className="text-[7px] text-[#6A6A75] font-mono">R$ 497,00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[7px] text-primary font-bold">Desconto PIX</span>
                      <span className="text-[7px] text-primary font-mono font-bold">-R$ 49,70</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-white/[0.04]">
                      <span className="text-[8px] text-white font-bold">Total</span>
                      <span className="text-[10px] text-white font-black font-mono">R$ 447,30</span>
                    </div>
                  </div>

                  <motion.div
                    className="h-7 bg-gradient-to-r from-primary to-[#00C853] rounded-lg flex items-center justify-center"
                    animate={{ boxShadow: ["0 0 15px rgba(0,230,118,0.2)", "0 0 30px rgba(0,230,118,0.4)", "0 0 15px rgba(0,230,118,0.2)"] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <span className="text-[8px] font-black text-black uppercase tracking-wider">Finalizar Compra</span>
                  </motion.div>

                  <div className="flex items-center justify-center gap-1 bg-[#1E1E22] rounded px-2 py-1.5">
                    <span className="text-[7px] text-[#FF6B6B] font-bold">⏰ Oferta expira em 14:32</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="absolute -top-3 -right-3 bg-primary/90 text-black text-[8px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-[0_4px_20px_rgba(0,230,118,0.4)] z-20"
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.8, type: "spring" }}
      >
        Sua Marca ✓
      </motion.div>

      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[80%] h-[40px] bg-[radial-gradient(ellipse,_rgba(0,230,118,0.12)_0%,_transparent_70%)] blur-xl" />
    </div>
  );
}

const CheckoutCustomSection = () => (
  <section aria-label="Checkout personalizado com domínio próprio" className="relative z-10 py-28 lg:py-36 overflow-hidden">
    <div className="absolute left-0 top-1/3 w-[400px] h-[400px] bg-[radial-gradient(circle,_rgba(0,230,118,0.04)_0%,_transparent_60%)] blur-3xl pointer-events-none" aria-hidden="true" />

    <div className="container max-w-7xl mx-auto px-6">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          className="space-y-7"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="font-display text-3xl md:text-[2.5rem] font-black tracking-[-0.025em] leading-[1.1]">
            Checkout no seu
            <br />
            domínio.{" "}
            <span className="text-transparent bg-clip-text italic" style={{ backgroundImage: 'linear-gradient(90deg, #00E676, #00C853, #D4AF37)' }}>
              Do seu jeito.
            </span>
          </h2>

          <p className="text-[15px] text-[#9A9AA5] max-w-md leading-[1.8] font-light">
            A venda acontece dentro da sua identidade, sem rótulo genérico. Sem aquele visual padrão de plataforma.{" "}
            <span className="text-white font-medium">Isso aumenta conversão. E muito.</span>
          </p>

          <div className="space-y-4">
            {[
              {
                icon: Palette,
                title: "Checkout 100% personalizável",
                desc: "Cores, logo, textos, layout — tudo na sua mão com builder visual drag & drop.",
              },
              {
                icon: Globe,
                title: "Domínio e subdomínio próprio",
                desc: "checkout.seusite.com — o cliente nunca sai da sua marca.",
              },
              {
                icon: CheckCircle,
                title: "Experiência contínua sem quebra",
                desc: "Sem redirecionamentos estranhos. Da landing page ao pagamento em um fluxo perfeito.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="flex gap-4 group"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <div className="w-10 h-10 shrink-0 bg-primary/[0.07] border border-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/[0.12] transition-all duration-300">
                  <item.icon className="w-4.5 h-4.5 text-primary/70" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-[12px] text-[#6A6A75] leading-relaxed font-light">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <Link to="/login?signup=true">
            <Button className="h-12 px-7 bg-primary hover:bg-[#00C853] text-primary-foreground font-bold rounded-lg text-[13px] shadow-[0_4px_30px_rgba(0,230,118,0.3)] hover:shadow-[0_4px_45px_rgba(0,230,118,0.5)] transition-all duration-300 group mt-2">
              Criar checkout agora
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </Button>
          </Link>
        </motion.div>

        <div className="hidden lg:block">
          <CheckoutMockup />
        </div>
      </div>
    </div>
  </section>
);

export default CheckoutCustomSection;
