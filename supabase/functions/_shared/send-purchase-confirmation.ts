/**
 * Shared purchase confirmation email sender.
 * Sends a branded "Pedido Confirmado" email to the customer via Resend.
 * Used by all payment webhooks (Asaas, Pagarme, Stripe).
 */

interface PurchaseConfirmationParams {
  supabase: any;
  orderId: string;
  customerId: string;
  productId: string;
  userId: string | null;
  amount: number;
  paymentMethod: string;
  currency?: string;
  source: string;
  deliveryMethod?: string; // 'panttera' | 'appsell' | 'email'
  appsellLoginUrl?: string | null;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function sendPurchaseConfirmationEmail(params: PurchaseConfirmationParams): Promise<void> {
  const { supabase, orderId, customerId, productId, userId, amount, paymentMethod, currency = 'BRL', source, deliveryMethod = 'panttera', appsellLoginUrl: appsellLoginUrlParam } = params;

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.log(`[${source}] RESEND_API_KEY not set, skipping purchase confirmation email`);
      return;
    }

    // Fetch customer data
    const { data: customer } = await supabase
      .from('customers')
      .select('name, email')
      .eq('id', customerId)
      .single();

    if (!customer?.email) {
      console.warn(`[${source}] No customer email found for purchase confirmation`);
      return;
    }

    // Fetch product data + AppSell login URL when applicable
    const { data: product } = await supabase
      .from('products')
      .select('name, image_url')
      .eq('id', productId)
      .maybeSingle();

    let appsellLoginUrl: string | null = appsellLoginUrlParam || null;
    if (!appsellLoginUrl && deliveryMethod === 'appsell' && userId) {
      const { data: appsellData } = await supabase
        .from('appsell_integrations')
        .select('login_url')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle();
      appsellLoginUrl = appsellData?.login_url || null;
    }

    const productName = escapeHtml(product?.name || 'Produto');
    const firstName = escapeHtml(customer.name?.split(' ')[0] || 'Cliente');
    const isEnglish = currency === 'USD';

    // Format amount
    const formattedAmount = isEnglish
      ? `$${Number(amount).toFixed(2)}`
      : `R$ ${Number(amount).toFixed(2).replace('.', ',')}`;

    // Payment method label
    const methodLabels: Record<string, string> = {
      pix: 'PIX',
      credit_card: isEnglish ? 'Credit Card' : 'Cartão de Crédito',
      card: isEnglish ? 'Credit Card' : 'Cartão de Crédito',
      boleto: 'Boleto',
      stripe: isEnglish ? 'Credit Card' : 'Cartão de Crédito',
    };
    const methodLabel = methodLabels[paymentMethod] || paymentMethod;

    // Format date
    const now = new Date();
    const dateStr = isEnglish
      ? now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : now.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
              ✅ ${isEnglish ? 'Order Confirmed!' : 'Pedido Confirmado!'}
            </h1>
          </div>

          <!-- Body -->
          <div style="padding:32px 40px;">
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
              ${isEnglish ? 'Hi' : 'Olá'} <strong>${firstName}</strong>,
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
              ${isEnglish
                ? 'Your payment has been confirmed! Here are the details of your order:'
                : 'Seu pagamento foi confirmado! Aqui estão os detalhes do seu pedido:'}
            </p>

            <!-- Order Details Card -->
            <div style="background:#f9fafb;border-radius:8px;padding:24px;margin:0 0 24px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;">${isEnglish ? 'Product' : 'Produto'}</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">${productName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">${isEnglish ? 'Amount' : 'Valor'}</td>
                  <td style="padding:8px 0;color:#22c55e;font-size:18px;font-weight:700;text-align:right;border-top:1px solid #e5e7eb;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">${isEnglish ? 'Payment' : 'Pagamento'}</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;text-align:right;border-top:1px solid #e5e7eb;">${methodLabel}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">${isEnglish ? 'Date' : 'Data'}</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;text-align:right;border-top:1px solid #e5e7eb;">${dateStr}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">${isEnglish ? 'Order' : 'Pedido'}</td>
                  <td style="padding:8px 0;color:#111827;font-size:12px;text-align:right;border-top:1px solid #e5e7eb;font-family:monospace;">${orderId.slice(0, 8).toUpperCase()}</td>
                </tr>
              </table>
            </div>

            ${appsellLoginUrl ? `
            <div style="text-align:center;margin:24px 0 16px;">
              <a href="${appsellLoginUrl}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:600;box-shadow:0 4px 12px rgba(34,197,94,0.4);">
                ${isEnglish ? '🚀 Access your purchase' : '🚀 Acessar sua compra'}
              </a>
            </div>` : ''}
            <p style="color:#6b7280;font-size:14px;line-height:1.5;margin:0 0 8px;">
              ${isEnglish
                ? 'If you have any questions, please reply to this email.'
                : 'Se tiver alguma dúvida, responda este email.'}
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">
              ${isEnglish ? 'Thank you for your purchase!' : 'Obrigado pela sua compra!'} 💚
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = isEnglish
      ? `✅ Order confirmed — "${productName}"`
      : `✅ Pedido confirmado — "${productName}"`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PanteraPay <noreply@app.panttera.com.br>',
        to: [customer.email],
        subject,
        html: emailHtml,
      }),
    });
    const emailData = await emailRes.json();
    console.log(`[${source}] Purchase confirmation email to ${customer.email}:`, emailRes.ok ? '✅' : '❌');

    // Log to email_logs
    try {
      await supabase.from('email_logs').insert({
        user_id: userId,
        to_email: customer.email,
        to_name: customer.name,
        subject,
        html_body: emailHtml,
        email_type: 'purchase_confirmation',
        status: emailRes.ok ? 'sent' : 'failed',
        resend_id: emailData?.id || null,
        customer_id: customerId,
        product_id: productId,
        order_id: orderId,
        source,
        metadata: { currency, language: isEnglish ? 'en' : 'pt-BR' },
      });
    } catch (logErr) {
      console.error(`[${source}] Email log error (non-blocking):`, logErr);
    }
  } catch (err) {
    console.error(`[${source}] Purchase confirmation email error (non-blocking):`, err);
  }
}
