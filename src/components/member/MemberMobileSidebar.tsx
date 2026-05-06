import { memo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  token: string | null;
  children: ReactNode;
}

const MemberMobileSidebar = memo(function MemberMobileSidebar({ open, onClose, token, children }: Props) {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-[70] w-[85%] max-w-[340px] overflow-y-auto lg:hidden"
            style={{ background: "hsl(220 20% 6%)" }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold text-base">Conteúdo</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "hsl(220,18%,14%)" }}
                >
                  <X className="w-4 h-4 text-[hsl(0,0%,60%)]" />
                </button>
              </div>
              {children}
              <button
                onClick={() => navigate("/minha-conta" + (token ? `?token=${token}` : ""))}
                className="w-full flex items-center gap-3 p-4 mt-3 rounded-2xl border transition-all hover:bg-[hsl(220,16%,13%)]"
                style={{
                  background: "hsl(220 18% 10%)",
                  borderColor: "hsl(220 15% 14%)",
                }}
              >
                <ArrowLeft className="w-4 h-4 text-[hsl(220,10%,50%)]" />
                <span className="text-white text-sm font-medium">Meus Cursos</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

export default MemberMobileSidebar;
