import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Printer, CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import panteraLogo from "@/assets/pantera-mascot.png";

const PAYMENT_LABEL: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  boleto: "Boleto Bancário",
};

interface EmailSent {
  type: string;
  subject: string;
  to_email: string;
  sent_at: string;
  status: string;
  delivered_at: string | null;
  opened_at: string | null;
  resend_id: string | null;
}

interface ReceiptItem {
  kind: "main" | "bump" | "upsell";
  product_id: string | null;
  name: string;
  image_url: string | null;
  amount: number;
  order_id: string;
}

interface ReceiptResponse {
  order: {
    id: string;
    amount: number;
    status: string;
    payment_method: string;
    created_at: string;
    updated_at: string | null;
    external_id: string | null;
    metadata: any;
    platform_fee_amount: number | null;
    customer_state: string | null;
    customer_city: string | null;
    customer_country: string | null;
    customer_zip: string | null;
    customers: { name: string; email: string; phone: string | null; cpf: string | null } | null;
    products: { name: string; description: string | null; currency: string; image_url: string | null } | null;
  };
  producer: { name: string | null; email: string | null; cpf_cnpj: string | null } | null;
  gateway: { code: string; label: string } | null;
  items?: ReceiptItem[];
  items_total?: number;
  emails_sent: EmailSent[];
  authenticity_hash: string;
  verified_at: string;
}

const maskEmail = (email: string) => {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const visible = user.slice(0, 3);
  return `${visible}${"*".repeat(Math.max(user.length - 3, 3))}@${domain}`;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const Receipt = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [data, setData] = useState<ReceiptResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL as string;
    const fnBase = supabaseUrl?.replace('.supabase.co', '.functions.supabase.co');
    fetch(`${fnBase}/get-receipt?order_id=${orderId}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Erro ao carregar recibo");
        setData(body);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (data) document.title = `Recibo #${data.order.id.slice(0, 8).toUpperCase()} — Panttera`;
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center shadow-sm">
          <h1 className="font-semibold text-lg text-slate-900 mb-2">Recibo indisponível</h1>
          <p className="text-sm text-slate-500">
            {error || "Não foi possível carregar este recibo."}
          </p>
        </div>
      </div>
    );
  }

  const { order, producer, gateway, emails_sent, authenticity_hash, verified_at } = data;
  const isUSD = order.products?.currency === "USD";
  const formatPrice = (v: number) =>
    isUSD ? `$${v.toFixed(2)}` : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const txAt = new Date(order.created_at);
  const receiptNumber = order.id.slice(0, 8).toUpperCase();
  const gross = Number(order.amount);
  const fee = Number(order.platform_fee_amount || 0);
  const cardBrand = order.metadata?.card_brand || order.metadata?.brand;
  const cardLast4 = order.metadata?.card_last4 || order.metadata?.last4;
  const installments = Number(order.metadata?.installments || 1);
  const payerIp =
    order.metadata?.ip ||
    order.metadata?.remote_ip ||
    order.metadata?.customer_ip ||
    order.metadata?.client_ip ||
    null;
  const payerUserAgent = order.metadata?.user_agent || null;

  const verificationUrl = typeof window !== "undefined" ? window.location.href : "";
  const customerName = order.customers?.name || "Cliente";
  const firstName = customerName.split(" ")[0];
  const maskedName =
    firstName.length > 1
      ? `${firstName[0]}${"*".repeat(Math.max(firstName.length - 2, 3))}${firstName.slice(-1)}`
      : firstName;

  const accessEmail = emails_sent?.find((e) => e.type === "access_link");
  const confirmationEmail = emails_sent?.find((e) =>
    ["purchase_confirmation", "order_confirmation", "purchase"].includes(e.type),
  );
  // Email used as proof shown in product card (prefer access_link, fallback to confirmation)
  const proofEmail = accessEmail || confirmationEmail;
  const customerEmail = order.customers?.email || null;
  const productImage = order.products?.image_url || null;
  const statementName = (producer?.name || "PANTTERA")
    .replace(/\s+/g, "")
    .toUpperCase()
    .slice(0, 22);

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white py-8 print:py-0">
      {/* Toolbar (hidden on print) */}
      <div className="max-w-2xl mx-auto px-4 mb-4 flex items-center justify-between print:hidden">
        <div className="text-sm text-slate-500">
          Recibo nº <strong className="text-slate-900">{receiptNumber}</strong>
        </div>
        <Button
          onClick={() => window.print()}
          className="gap-2 bg-slate-900 hover:bg-slate-800 text-white"
        >
          <Printer className="w-4 h-4" />
          Baixar PDF
        </Button>
      </div>

      {/* Receipt sheet */}
      <div className="max-w-2xl mx-auto bg-white text-slate-900 shadow-sm print:shadow-none rounded-2xl print:rounded-none border border-slate-200 print:border-0 overflow-hidden">
        {/* Header — Logo + thanks */}
        <div className="px-6 sm:px-10 pt-10 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <img
              src={panteraLogo}
              alt="Panttera"
              className="w-16 h-16 object-contain"
            />
          </div>

          <p className="text-sm text-slate-500">Pedido #{receiptNumber}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mt-1">
            Obrigado, {maskedName}
          </h1>

          {/* Confirmation icon */}
          <div className="flex justify-center mt-7 mb-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center ring-8 ring-emerald-50">
              <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={2.5} />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-slate-900">Seu pedido foi confirmado</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            A cobrança aparecerá na fatura do seu cartão como{" "}
            <strong className="text-slate-700">PANTERAPAY</strong>
          </p>

          <a
            href="https://app.panttera.com.br/minha-conta"
            className="inline-flex items-center justify-center gap-2 mt-6 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors print:hidden"
          >
            Gerenciar meu pedido
          </a>
        </div>

        <div className="border-t border-slate-100" />

        {/* Detalhes do pedido */}
        <div className="px-6 sm:px-10 py-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Detalhes do pedido</h3>

          {(() => {
            const items: ReceiptItem[] =
              data.items && data.items.length > 0
                ? data.items
                : [
                    {
                      kind: "main" as const,
                      product_id: null,
                      name: order.products?.name || "Produto digital",
                      image_url: productImage,
                      amount: gross,
                      order_id: order.id,
                    },
                  ];
            return (
              <div className="space-y-3">
                {items.map((it, i) => (
                  <div key={`${it.order_id}-${i}`} className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt={it.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900">{it.name}</p>
                        {it.kind === "bump" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold uppercase tracking-wide">
                            Order Bump
                          </span>
                        )}
                        {it.kind === "upsell" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-700 text-[10px] font-semibold uppercase tracking-wide">
                            Upsell
                          </span>
                        )}
                      </div>
                      {it.kind === "main" && (
                        <p className="text-xs text-slate-500 mt-0.5">Quantidade: 1</p>
                      )}
                      {it.kind !== "main" && (
                        <p className="text-xs text-slate-500 mt-0.5">Item adicional incluso</p>
                      )}
                    </div>
                    {it.kind === "main" && (
                      <p className="text-sm font-medium text-slate-900 tabular-nums shrink-0">
                        {formatPrice(gross)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Prova de envio do e-mail (texto humano) */}
          {proofEmail ? (
            <div className="mt-5 rounded-lg bg-emerald-50/60 border border-emerald-100 px-4 py-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                <span className="mr-1.5">✉️</span>
                Enviamos seu acesso para{" "}
                <strong className="text-slate-900">{maskEmail(proofEmail.to_email)}</strong> em{" "}
                <strong className="text-slate-900">{formatDateTime(proofEmail.sent_at)}</strong>.
              </p>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                {proofEmail.opened_at ? (
                  <span className="text-blue-700 font-medium">✓ Aberto pelo cliente</span>
                ) : proofEmail.delivered_at ? (
                  <span className="text-emerald-700 font-medium">✓ Entregue</span>
                ) : (
                  <span className="text-emerald-700 font-medium">✓ Enviado</span>
                )}
                <span className="text-slate-400">·</span>
                <span>Verifique a caixa de entrada ou pasta de spam.</span>
              </p>
            </div>
          ) : customerEmail ? (
            <p className="mt-5 text-sm text-slate-600 leading-relaxed">
              <span className="mr-1.5">✉️</span>
              Enviamos seu acesso para{" "}
              <strong className="text-slate-900">{maskEmail(customerEmail)}</strong>. Se não
              encontrar, verifique a caixa de entrada ou pasta de spam.
            </p>
          ) : null}
        </div>

        <div className="border-t border-slate-100" />

        {/* Resumo financeiro */}
        <div className="px-6 sm:px-10 py-6">
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="text-slate-900 font-medium tabular-nums">{formatPrice(gross)}</dd>
            </div>
            <div className="flex justify-between pt-3 border-t border-slate-100">
              <dt className="text-slate-900 font-semibold">Total</dt>
              <dd className="text-right">
                {installments > 1 && (
                  <div className="text-xs text-slate-500 font-normal mb-0.5">
                    {installments}× {formatPrice(gross / installments)}
                  </div>
                )}
                <span className="text-slate-900 font-semibold tabular-nums">
                  {formatPrice(gross)}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-slate-100" />

        {/* Informações do cliente */}
        <div className="px-6 sm:px-10 py-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Informações do cliente</h3>

          <div>
            <p className="text-xs text-slate-500 mb-0.5">E-mail</p>
            <p className="text-sm text-slate-900">
              {customerEmail ? maskEmail(customerEmail) : "—"}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-0.5">Pagamento</p>
            <p className="text-sm text-slate-900 inline-flex items-center gap-2">
              {order.payment_method === "pix" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  PIX
                </span>
              )}
              {order.payment_method === "credit_card" && cardBrand && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium uppercase">
                  {cardBrand}
                </span>
              )}
              {order.payment_method === "credit_card" && cardLast4
                ? `final ${cardLast4}`
                : order.payment_method !== "credit_card" &&
                  (PAYMENT_LABEL[order.payment_method] || order.payment_method)}
            </p>
          </div>
        </div>

        {/* Detalhes técnicos colapsáveis */}
        <div className="border-t border-slate-100" />
        <div className="px-6 sm:px-10 py-5">
          <details className="group receipt-details">
            <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 transition-transform group-open:rotate-90"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Ver detalhes técnicos e selo de autenticidade
              </span>
            </summary>

            <div className="mt-5 space-y-5">
              {/* Transaction details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Data e hora</p>
                  <p className="text-slate-900">
                    {txAt.toLocaleDateString("pt-BR")} às{" "}
                    {txAt.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-emerald-700 font-semibold">✓ Aprovado e liquidado</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Vendedor</p>
                  <p className="text-slate-900">{producer?.name || "—"}</p>
                  {producer?.cpf_cnpj && (
                    <p className="text-[11px] text-slate-500">CPF/CNPJ: {producer.cpf_cnpj}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Moeda</p>
                  <p className="text-slate-900">{order.products?.currency || "BRL"}</p>
                </div>
                {fee > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Taxa da plataforma</p>
                    <p className="text-slate-900 tabular-nums">{formatPrice(fee)}</p>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">ID interno (Panttera)</p>
                  <p className="text-slate-700 font-mono text-xs break-all">{order.id}</p>
                </div>
                {order.external_id && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500">Referência no gateway</p>
                    <p className="text-slate-700 font-mono text-xs break-all">
                      {order.external_id}
                    </p>
                  </div>
                )}
                {gateway && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500">Adquirente</p>
                    <p className="text-slate-700 text-xs">{gateway.label}</p>
                  </div>
                )}
                {payerIp && (
                  <div>
                    <p className="text-xs text-slate-500">IP do pagador</p>
                    <p className="text-slate-700 font-mono text-xs">{payerIp}</p>
                  </div>
                )}
                {payerUserAgent && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500">Dispositivo</p>
                    <p className="text-slate-700 font-mono text-[10px] break-all">
                      {payerUserAgent}
                    </p>
                  </div>
                )}
              </div>

              {/* Email audit trail */}
              {(accessEmail || confirmationEmail) && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Comprovação de envio (auditoria)
                  </p>
                  {[accessEmail, confirmationEmail].filter(Boolean).map((e) => (
                    <div key={e!.type} className="text-xs text-slate-600">
                      <p>
                        <strong className="text-slate-900">
                          {e!.type === "access_link"
                            ? "Acesso ao produto"
                            : "Confirmação de compra"}
                        </strong>{" "}
                        → {maskEmail(e!.to_email)} em {formatDateTime(e!.sent_at)}
                      </p>
                      {e!.resend_id && (
                        <p className="font-mono text-[10px] text-slate-500 break-all">
                          Resend ID: {e!.resend_id}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Authenticity seal */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Selo de autenticidade
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Documento protegido por hash criptográfico SHA-256. Qualquer alteração
                  invalidará a verificação pública.
                </p>
                <Field label="Hash SHA-256" value={authenticity_hash} mono />
                <Field label="URL de verificação" value={verificationUrl} mono />
                <Field
                  label="Verificado em"
                  value={new Date(verified_at).toLocaleString("pt-BR")}
                  mono
                />
              </div>
            </div>
          </details>
        </div>

        {/* Legal footer — single line */}
        <div className="border-t border-slate-100" />
        <div className="px-6 sm:px-10 py-4 bg-slate-50/50 text-center">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            <strong className="text-slate-700">Panttera Tecnologia</strong> · Documento eletrônico
            válido conforme MP 2.200-2/2001 · Recibo nº{" "}
            <strong className="text-slate-700">{receiptNumber}</strong>
          </p>
        </div>
      </div>

      {/* Print styles — force details open when printing */}
      <style>{`
        @media print {
          body { background: white; }
          @page { margin: 12mm; size: A4; }
          .receipt-details > div { display: block !important; }
          .receipt-details > summary { display: none; }
        }
      `}</style>
    </div>
  );
};

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">{label}</p>
    <p className={`text-[10px] text-slate-700 break-all ${mono ? "font-mono" : ""}`}>{value}</p>
  </div>
);

export default Receipt;
