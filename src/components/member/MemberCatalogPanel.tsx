import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, GraduationCap, Lock, PlayCircle, ShoppingCart, Star, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { MemberTranslations, MemberLang } from "@/lib/memberI18n";

interface Product { id: string; name: string; price: number; image_url: string | null; currency?: string; }
interface OtherCourse { id: string; title: string; description: string | null; cover_image_url: string | null; product?: Product | null; hasAccess: boolean; }

interface Props {
  courses: OtherCourse[];
  customerId: string;
  open: boolean;
  onClose: () => void;
  t: MemberTranslations;
  lang: MemberLang;
}

const MemberCatalogPanel = memo(function MemberCatalogPanel({ courses, customerId, open, onClose, t, lang }: Props) {
  const navigate = useNavigate();
  const isEN = lang === "en";

  const formatPrice = (price: number, currency?: string) => {
    if (currency === "USD" || isEN) return `$${price.toFixed(2)}`;
    return `R$ ${price.toFixed(2).replace(".", ",")}`;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden border-b" style={{ background: "hsl(220 18% 8%)", borderColor: "hsl(220 15% 12%)" }}>
          <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-6 sm:py-8">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <h2 className="text-white font-bold text-base sm:text-lg flex items-center gap-2"><Star className="w-5 h-5 text-[hsl(45,93%,55%)]" />{t.otherCourses}</h2>
                <p className="text-[hsl(220,10%,45%)] text-xs sm:text-sm mt-1">{t.expandKnowledge}</p>
              </div>
              <button onClick={onClose} className="text-[hsl(220,10%,45%)] hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            {courses.length === 0 ? (
              <p className="text-[hsl(220,10%,40%)] text-sm">{t.noCourses}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {courses.map((c, index) => (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="group relative rounded-2xl overflow-hidden border transition-all hover:scale-[1.02] hover:shadow-2xl" style={{ background: "hsl(220 18% 10%)", borderColor: c.hasAccess ? "hsl(145,65%,30%)" : "hsl(220 15% 16%)" }}>
                    <div className="relative h-32 sm:h-36 overflow-hidden">
                      {c.cover_image_url ? (
                        <img src={c.cover_image_url} alt={c.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundImage: c.hasAccess ? "linear-gradient(135deg, hsl(145,65%,20%), hsl(160,70%,15%))" : "linear-gradient(135deg, hsl(220,18%,14%), hsl(220,15%,18%))" }}>
                          <GraduationCap className="w-10 h-10 text-[hsl(220,10%,30%)]" />
                        </div>
                      )}
                      {!c.hasAccess && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                          <div className="w-12 h-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center"><Lock className="w-5 h-5 text-white/60" /></div>
                        </div>
                      )}
                      {c.hasAccess && (
                        <div className="absolute top-2 right-2"><div className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[hsl(145,65%,42%)] text-white">{t.unlocked}</div></div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-white font-bold text-sm mb-1 truncate">{c.title}</h3>
                      {c.description && <p className="text-[hsl(220,10%,45%)] text-xs line-clamp-2 mb-3">{c.description}</p>}
                      {c.hasAccess ? (
                        <button onClick={() => { supabase.from("member_access").select("access_token").eq("customer_id", customerId).eq("course_id", c.id).single().then(({ data }) => { if (data) window.location.href = `/membros?token=${data.access_token}`; }); }} className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110" style={{ backgroundImage: "linear-gradient(135deg, hsl(145,65%,42%), hsl(160,70%,36%))", color: "white" }}>
                          <PlayCircle className="w-3.5 h-3.5 inline mr-1.5" />{t.accessCourse}
                        </button>
                      ) : c.product ? (
                        <button onClick={() => navigate(`/checkout/${c.product!.id}`)} className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110 flex items-center justify-center gap-1.5" style={{ backgroundImage: "linear-gradient(135deg, hsl(45,93%,50%), hsl(35,90%,45%))", color: "hsl(220,20%,10%)" }}>
                          <ShoppingCart className="w-3.5 h-3.5" />{t.buy} • {formatPrice(c.product.price, c.product.currency)}
                        </button>
                      ) : (
                        <div className="py-2.5 rounded-xl text-xs font-medium text-center" style={{ color: "hsl(220,10%,35%)" }}><Lock className="w-3 h-3 inline mr-1" />{t.comingSoon}</div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default MemberCatalogPanel;
