import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, XCircle, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = searchParams.get("email");

  useEffect(() => {
    const performUnsubscribe = async () => {
      if (!email) {
        setError("E-mail não fornecido.");
        setLoading(false);
        return;
      }

      try {
        const { error: upsertError } = await supabase
          .from("email_unsubscribes" as any)
          .upsert({ email }, { onConflict: "email" });

        if (upsertError) throw upsertError;
        setSuccess(true);
      } catch (err: any) {
        console.error("Erro ao cancelar inscrição:", err);
        setError("Ocorreu um erro ao processar seu pedido.");
      } finally {
        setLoading(false);
      }
    };

    performUnsubscribe();
  }, [email]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
            {loading ? (
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            ) : success ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            ) : (
              <XCircle className="w-8 h-8 text-red-500" />
            )}
          </div>
        </div>

        {loading ? (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Processando...</h1>
            <p className="text-slate-400">Aguarde um momento enquanto atualizamos suas preferências.</p>
          </>
        ) : success ? (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Inscrição Cancelada</h1>
            <p className="text-slate-400 mb-6">
              O e-mail <span className="text-emerald-400 font-medium">{email}</span> foi removido da nossa lista. Você não receberá mais comunicações de marketing.
            </p>
            <div className="bg-slate-800/50 rounded-lg p-4 mb-6 flex items-start gap-3 text-left">
              <MailCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300">
                Lembre-se: e-mails de transação (como confirmação de compra ou recuperação de senha) ainda poderão ser enviados se você realizar uma nova operação.
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Ops! Algo deu errado</h1>
            <p className="text-slate-400 mb-6">{error || "Não conseguimos processar seu cancelamento agora."}</p>
          </>
        )}

        <Link to="/">
          <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
            Voltar para o site
          </Button>
        </Link>
        
        <p className="mt-8 text-[10px] text-slate-600 uppercase tracking-widest">
          Powered by PanteraPay
        </p>
      </div>
    </div>
  );
};

export default Unsubscribe;
