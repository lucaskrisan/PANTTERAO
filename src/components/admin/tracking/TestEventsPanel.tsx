import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Beaker, Loader2, CheckCircle2, XCircle, ExternalLink, Copy, Info,
} from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
}

interface Props {
  products: Product[];
  selectedProductId: string;
  onProductChange: (id: string) => void;
}

interface MetaResponse {
  events_received?: number;
  messages?: string[];
  fbtrace_id?: string;
  error?: { message?: string; code?: number; type?: string };
}

interface TestResult {
  success: boolean;
  http_status?: number;
  pixel_id?: string;
  meta_response?: MetaResponse;
  payload_preview?: any;
  error?: string;
}

const TestEventsPanel = ({ products, selectedProductId, onProductChange }: Props) => {
  const [testCode, setTestCode] = useState("");
  const [eventName, setEventName] = useState("Purchase");
  const [includeBump, setIncludeBump] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);

  const runTest = async () => {
    if (!selectedProductId) {
      toast.error("Selecione um produto");
      return;
    }
    if (!testCode.trim()) {
      toast.error("Cole o test_event_code do Events Manager");
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const orderId = `test_${Date.now()}`;
      const fakeCustomer = {
        name: "Teste Panttera",
        email: `teste+${Date.now()}@panttera.com.br`,
        phone: "11999990000",
        cpf: "12345678909",
      };
      const contents = includeBump
        ? [
            { id: selectedProductId, quantity: 1, item_price: 99.0 },
            { id: "bump_test_id", quantity: 1, item_price: 19.9 },
          ]
        : [{ id: selectedProductId, quantity: 1, item_price: 99.0 }];
      const value = contents.reduce((s, c) => s + c.item_price * c.quantity, 0);

      const { data, error } = await supabase.functions.invoke("facebook-capi", {
        body: {
          product_id: selectedProductId,
          event_name: eventName,
          event_id: `${eventName}_${orderId}`,
          event_source_url: window.location.origin + `/checkout/${selectedProductId}`,
          customer: fakeCustomer,
          custom_data: {
            value,
            currency: "BRL",
            order_id: orderId,
            content_ids: contents.map((c) => c.id),
            contents,
            num_items: contents.length,
            content_type: "product",
          },
          payment_method: "pix",
          visitor_id: `test_visitor_${Date.now()}`,
          user_agent: navigator.userAgent,
          geo: { city: "São Paulo", state: "SP", zip: "01310100", country: "BR" },
          test_event_code: testCode.trim(),
        },
      });

      if (error) throw new Error(error.message || "Falha ao chamar facebook-capi");

      setResults(data?.results || []);

      const okCount = (data?.results || []).filter((r: TestResult) => r.success).length;
      if (okCount > 0) {
        toast.success(`✅ ${okCount} pixel(s) responderam OK — confira no Events Manager`);
      } else {
        toast.error("Nenhum pixel respondeu OK — veja os detalhes abaixo");
      }
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyJson = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    toast.success("Copiado");
  };

  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-2.5">
        <Beaker className="w-4 h-4 text-fuchsia-400" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-200">Test Events (Meta)</h2>
          <p className="text-[10px] text-slate-500">
            Dispare um evento de teste para validar matching e EMQ em tempo real
          </p>
        </div>
        <a
          href="https://business.facebook.com/events_manager2"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
        >
          Events Manager <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="p-4 space-y-3">
        {/* Help banner */}
        <div className="rounded-md bg-cyan-500/5 border border-cyan-500/20 px-3 py-2 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-[10px] text-slate-400 leading-relaxed">
            No Events Manager → <span className="text-slate-300 font-medium">Test Events</span> → copie o código (ex: <code className="text-fuchsia-300">TEST12345</code>) e cole aqui. O evento aparecerá em segundos com matching de campos e score EMQ.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Produto</label>
            <Select value={selectedProductId} onValueChange={onProductChange}>
              <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-slate-300 text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Evento</label>
            <Select value={eventName} onValueChange={setEventName}>
              <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-slate-300 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Purchase">Purchase</SelectItem>
                <SelectItem value="InitiateCheckout">InitiateCheckout</SelectItem>
                <SelectItem value="AddPaymentInfo">AddPaymentInfo</SelectItem>
                <SelectItem value="ViewContent">ViewContent</SelectItem>
                <SelectItem value="Lead">Lead</SelectItem>
                <SelectItem value="Subscribe">Subscribe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">test_event_code</label>
            <Input
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              placeholder="TEST12345"
              className="bg-slate-800/60 border-slate-700/50 text-slate-300 text-xs font-mono placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeBump}
              onChange={(e) => setIncludeBump(e.target.checked)}
              className="accent-fuchsia-500"
            />
            Incluir order bump em <code className="text-fuchsia-300">contents[]</code>
          </label>
          <Button
            onClick={runTest}
            disabled={loading || !selectedProductId || !testCode.trim()}
            size="sm"
            className="gap-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Beaker className="w-3.5 h-3.5" />}
            {loading ? "Disparando..." : `Disparar ${eventName} de teste`}
          </Button>
        </div>

        {/* Results */}
        {results && results.length === 0 && (
          <div className="rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2.5 text-[11px] text-amber-300">
            Nenhum pixel CAPI configurado para este produto.
          </div>
        )}

        {results && results.map((r, idx) => {
          const meta = r.meta_response || {};
          const received = meta.events_received ?? 0;
          const errMsg = meta.error?.message;
          return (
            <div key={idx} className="rounded-md bg-slate-900/50 border border-slate-700/30 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-700/30 flex items-center gap-2">
                {r.success && received > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="font-mono text-xs font-medium text-slate-300">
                  Pixel {r.pixel_id || "—"}
                </span>
                <span className="ml-auto text-[10px] text-slate-500">
                  HTTP {r.http_status ?? "—"}
                </span>
              </div>

              <div className="p-3 space-y-2 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded bg-slate-800/50 px-2.5 py-1.5">
                    <p className="text-[9px] uppercase text-slate-500 tracking-wider">Events received</p>
                    <p className={`text-sm font-mono font-bold ${received > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {received}
                    </p>
                  </div>
                  <div className="rounded bg-slate-800/50 px-2.5 py-1.5">
                    <p className="text-[9px] uppercase text-slate-500 tracking-wider">fbtrace_id</p>
                    <p className="text-[10px] font-mono text-slate-300 truncate">
                      {meta.fbtrace_id || "—"}
                    </p>
                  </div>
                </div>

                {meta.messages && meta.messages.length > 0 && (
                  <div className="rounded bg-slate-800/50 px-2.5 py-1.5">
                    <p className="text-[9px] uppercase text-slate-500 tracking-wider mb-1">Messages</p>
                    {meta.messages.map((m, i) => (
                      <p key={i} className="text-[10px] text-slate-300">{m}</p>
                    ))}
                  </div>
                )}

                {errMsg && (
                  <div className="rounded bg-red-500/10 border border-red-500/20 px-2.5 py-1.5">
                    <p className="text-[9px] uppercase text-red-400 tracking-wider mb-0.5">Erro Meta</p>
                    <p className="text-[10px] text-red-300">{errMsg}</p>
                  </div>
                )}

                {r.error && !errMsg && (
                  <div className="rounded bg-red-500/10 border border-red-500/20 px-2.5 py-1.5">
                    <p className="text-[10px] text-red-300">{r.error}</p>
                  </div>
                )}

                {r.payload_preview && (
                  <details className="text-[10px]">
                    <summary className="cursor-pointer text-slate-500 hover:text-slate-300 flex items-center gap-1.5">
                      Ver payload enviado
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); copyJson(r.payload_preview); }}
                        className="ml-auto inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                      >
                        <Copy className="w-2.5 h-2.5" /> copiar JSON
                      </button>
                    </summary>
                    <pre className="mt-1.5 p-2 bg-slate-950/60 rounded text-[9px] text-slate-400 overflow-auto max-h-60">
                      {JSON.stringify(r.payload_preview, null, 2)}
                    </pre>
                  </details>
                )}

                <p className="text-[9px] text-slate-500 italic pt-1">
                  Vá em <a href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Events Manager → Test Events</a> para ver matching de campos e EMQ.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TestEventsPanel;
