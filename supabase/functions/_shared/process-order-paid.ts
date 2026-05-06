/**
 * Shared post-payment processor.
 * Centralizes ALL side effects that happen after a payment is confirmed:
 *   1. Purchase confirmation email
 *   2. CAPI Purchase fallback
 *   3. Mark abandoned carts as recovered
 *   4. Member access creation (one-time + subscription)
 *   5. Access email to customer
 *   6. Push notification to producer
 *   7. WhatsApp dispatch
 *
 * Gateway-specific logic (billing recharge, signature verification, status mapping)
 * stays in each webhook handler.
 *
 * Usage:
 *   import { processOrderPaid } from '../_shared/process-order-paid.ts';
 *   await processOrderPaid({ supabase, orderData, externalId, source, currency });
 */

import { sendPurchaseConfirmationEmail } from './send-purchase-confirmation.ts';

interface OrderData {
  id: string;
  amount: number;
  payment_method: string;
  product_id: string | null;
  customer_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface ProcessOrderPaidParams {
  supabase: any;
  orderData: OrderData;
  externalId: string;
  source: string;        // 'pagarme-webhook' | 'asaas-webhook' | 'stripe-webhook' | 'reconcile-orders'
  currency?: string;     // default 'BRL'
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── 1. Purchase confirmation email ──────────────────────────────────────────
async function stepPurchaseConfirmationEmail(params: ProcessOrderPaidParams): Promise<void> {
  const { supabase, orderData, source, currency } = params;
  if (!orderData.product_id || !orderData.customer_id) return;

  try {
    // Get delivery method and login link for AppSell when applicable
    const { data: prodDelivery } = await supabase
      .from('products')
      .select('delivery_method')
      .eq('id', orderData.product_id)
      .maybeSingle();
    const deliveryMethod = prodDelivery?.delivery_method || 'panttera';

    let appsellLoginUrl: string | null = null;
    if (deliveryMethod === 'appsell' && orderData.user_id) {
      const { data: appsellInt } = await supabase
        .from('appsell_integrations')
        .select('login_url')
        .eq('user_id', orderData.user_id)
        .maybeSingle();
      appsellLoginUrl = appsellInt?.login_url || null;
    }

    await sendPurchaseConfirmationEmail({
      supabase,
      orderId: orderData.id,
      customerId: orderData.customer_id,
      productId: orderData.product_id,
      userId: orderData.user_id,
      amount: orderData.amount,
      paymentMethod: orderData.payment_method,
      currency: currency || 'BRL',
      source,
      deliveryMethod,
      appsellLoginUrl,
    });
  } catch (err) {
    console.error(`[${source}] Purchase confirmation email error (non-blocking):`, err);
  }
}

// ─── 2. CAPI Purchase fallback ───────────────────────────────────────────────
async function stepCapiFallback(params: ProcessOrderPaidParams): Promise<void> {
  const { supabase, orderData, externalId, source } = params;
  if (!orderData.product_id || !orderData.customer_id) return;

  try {
    // Check if Purchase event was already fired for this order
    // We use orderData.id (the internal UUID) for deduplication between browser and server,
    // and also to prevent renewals (which update the same order) from firing multiple purchases.
    const { data: purchaseWithOrderId } = await supabase
      .from('pixel_events')
      .select('id')
      .eq('product_id', orderData.product_id)
      .eq('event_name', 'Purchase')
      .eq('event_id', orderData.id)
      .limit(1);

    const alreadyFired = purchaseWithOrderId && purchaseWithOrderId.length > 0;

    if (!alreadyFired) {
      console.log(`[${source}] Purchase NOT fired by checkout, sending CAPI fallback using order_id as event_id`);

      const { data: custData } = await supabase
        .from('customers')
        .select('name, email, phone, cpf')
        .eq('id', orderData.customer_id)
        .single();

      if (custData) {
        const checkoutUrl = (orderData.metadata as any)?.checkout_url || `https://app.panttera.com.br/checkout/${orderData.product_id}`;

        const capiResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/facebook-capi`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              product_id: orderData.product_id,
              event_name: 'Purchase',
              event_id: orderData.id,
              event_source_url: checkoutUrl,
              customer: {
                name: custData.name,
                email: custData.email,
                phone: custData.phone,
                cpf: custData.cpf,
              },
              geo: {
                country: (orderData as any).customer_country || null,
                city: (orderData as any).customer_city || null,
                state: (orderData as any).customer_state || null,
                zip: (orderData as any).customer_zip || null,
              },
              custom_data: {
                value: Number(orderData.amount),
                currency: (params.currency || 'BRL').toUpperCase(),
                content_type: 'product',
                content_ids: [orderData.product_id],
                num_items: 1,
                order_id: orderData.id,
                payment_method: orderData.payment_method,
              },
              payment_method: orderData.payment_method,
              log_browser: true,
            }),
          }
        );
        const capiResult = await capiResponse.json();
        console.log(`[${source}] CAPI fallback result:`, JSON.stringify(capiResult));
      }
    } else {
      console.log(`[${source}] Purchase already fired by checkout, skipping CAPI`);
    }
  } catch (capiErr) {
    console.error(`[${source}] CAPI fallback error (non-blocking):`, capiErr);
  }
}

// ─── 3. Mark abandoned carts as recovered ────────────────────────────────────
async function stepRecoverAbandonedCarts(params: ProcessOrderPaidParams): Promise<void> {
  const { supabase, orderData, source } = params;
  if (!orderData.product_id || !orderData.customer_id) return;

  try {
    const { data: recoverCust } = await supabase
      .from('customers')
      .select('email')
      .eq('id', orderData.customer_id)
      .maybeSingle();

    if (recoverCust?.email) {
      const { count: recoveredCount } = await supabase
        .from('abandoned_carts')
        .update({ recovered: true })
        .eq('product_id', orderData.product_id)
        .eq('customer_email', recoverCust.email)
        .eq('recovered', false);

      if (recoveredCount && recoveredCount > 0) {
        try {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fire-webhooks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              event: 'cart.recovered',
              order_id: orderData.id,
              user_id: orderData.user_id,
            }),
          });
        } catch (whErr) {
          console.error(`[${source}] cart.recovered webhook error (non-blocking):`, whErr);
        }
      }
    }
  } catch (recoverErr) {
    console.error(`[${source}] Cart recovery mark error (non-blocking):`, recoverErr);
  }
}

// ─── 4 & 5. Member access + access email ─────────────────────────────────────
async function sendAccessEmail(
  supabase: any,
  customerId: string,
  course: { id: string; title: string; product_id: string | null },
  accessToken: string,
  orderId: string,
  userId: string | null,
  source: string,
  isEnglish: boolean
): Promise<void> {
  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) return;

    const { data: customer } = await supabase
      .from('customers')
      .select('name, email')
      .eq('id', customerId)
      .single();

    if (!customer) return;

    const siteUrl = 'https://app.panttera.com.br';
    const accessUrl = `${siteUrl}/membros?token=${accessToken}`;
    const portalUrl = `${siteUrl}/minha-conta`;
    const firstName = escapeHtml(customer.name.split(' ')[0]);
    const courseTitle = escapeHtml(course.title);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">🎉 ${isEnglish ? 'Payment confirmed!' : 'Pagamento confirmado!'}</h1>
          </div>
          <div style="padding:32px 40px;">
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
              ${isEnglish ? 'Hi' : 'Olá'} <strong>${firstName}</strong>,
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
              ${isEnglish
                ? `Your access to the course <strong>"${courseTitle}"</strong> is ready! 🚀`
                : `Seu pagamento foi confirmado e seu acesso ao curso <strong>"${courseTitle}"</strong> está liberado! 🚀`}
            </p>
            <div style="text-align:center;margin:32px 0 16px;">
              <a href="${accessUrl}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:600;box-shadow:0 4px 12px rgba(34,197,94,0.4);">
                ${isEnglish ? 'Access Course Now' : 'Acessar Curso Agora'}
              </a>
            </div>
            <div style="text-align:center;margin:0 0 24px;">
              <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">
                ${isEnglish 
                  ? 'Access via the link above. If you lose it, go to panttera.com.br/login and click "I am a Student" to resend.' 
                  : 'Acesse pelo link acima ou pelo botão abaixo. Se perder o link, acesse panttera.com.br/login e clique em "Sou Aluno" para reenviar.'}
              </p>
            </div>
            <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:24px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;">
              ${isEnglish ? 'Or copy and paste this link:' : 'Ou copie e cole este link:'}<br>
              <a href="${accessUrl}" style="color:#22c55e;word-break:break-all;">${accessUrl}</a>
            </p>
          </div>
          <div style="background:#f9fafb;padding:20px 40px;text-align:center;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">${isEnglish ? 'Save this email — it contains your access link.' : 'Guarde este email — ele contém seu link de acesso.'}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `🎉 ${isEnglish ? 'Access granted' : 'Acesso liberado'} — "${courseTitle}"`;

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

    try {
      await supabase.from('email_logs').insert({
        user_id: userId,
        to_email: customer.email,
        to_name: customer.name,
        subject,
        html_body: emailHtml,
        email_type: 'payment_confirmed',
        status: emailRes.ok ? 'sent' : 'failed',
        resend_id: emailData?.id || null,
        customer_id: customerId,
        product_id: course.product_id,
        order_id: orderId,
        source,
      });
    } catch (logErr) {
      console.error(`[${source}] Email log error:`, logErr);
    }

    console.log(`[${source}] Access email sent to`, customer.email);
  } catch (err) {
    console.error(`[${source}] Email error (non-blocking):`, err);
  }
}

async function stepMemberAccess(params: ProcessOrderPaidParams): Promise<void> {
  const { supabase, orderData, source, currency } = params;
  if (!orderData.product_id || !orderData.customer_id) return;
  const isEnglish = (currency || 'BRL') === 'USD';

  try {
    // Check main product delivery method
    const { data: mainProd } = await supabase
      .from('products')
      .select('delivery_method')
      .eq('id', orderData.product_id)
      .maybeSingle();

    const mainDelivery = mainProd?.delivery_method || 'panttera';

    // Collect product IDs that need access
    const productIdsForAccess: string[] = mainDelivery === 'panttera' ? [orderData.product_id] : [];
    const bumpIds = (orderData.metadata as any)?.bump_product_ids;
    if (Array.isArray(bumpIds)) {
      for (const bumpId of bumpIds) {
        const { data: bumpProd } = await supabase
          .from('products')
          .select('delivery_method')
          .eq('id', bumpId)
          .maybeSingle();
        if (bumpProd?.delivery_method === 'panttera') {
          productIdsForAccess.push(bumpId);
        }
      }
    }

    if (productIdsForAccess.length === 0) {
      console.log(`[${source}] Skipping member access — no panttera delivery products`);
      return;
    }

    // Find all courses linked to these products (via legacy courses.product_id OR course_products)
    const courseIdsSet = new Set<string>();
    for (const pid of productIdsForAccess) {
      const { data: courseIds } = await supabase.rpc('get_courses_for_product', { p_product_id: pid });
      if (Array.isArray(courseIds)) {
        for (const cid of courseIds) {
          if (cid) courseIdsSet.add(cid as string);
        }
      }
    }

    if (courseIdsSet.size === 0) return;

    const { data: courses } = await supabase
      .from('courses')
      .select('id, title, product_id')
      .in('id', Array.from(courseIdsSet));

    if (!courses || courses.length === 0) return;

    // Batch-fetch product subscription info for all courses (avoids N+1 query)
    const uniqueProductIds = [...new Set(courses.map((c: any) => c.product_id).filter(Boolean))];
    const { data: productsData } = await supabase
      .from('products')
      .select('id, is_subscription, billing_cycle')
      .in('id', uniqueProductIds);
    const productMap = new Map<string, { id: string; is_subscription: boolean; billing_cycle: string }>(
      (productsData || []).map((p: any) => [p.id as string, p])
    );

    for (const course of courses) {
      const product = productMap.get(course.product_id) || null;

      // Check existing access
      const { data: existingAccess } = await supabase
        .from('member_access')
        .select('id')
        .eq('customer_id', orderData.customer_id)
        .eq('course_id', course.id)
        .maybeSingle();

      if (product?.is_subscription) {
        const cycleDays: Record<string, number> = {
          weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, semiannually: 180, yearly: 365,
        };
        const days = cycleDays[product.billing_cycle] || 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days + 3);

        const { data: upsertedAccess, error: accessErr } = await supabase
          .from('member_access')
          .upsert(
            {
              customer_id: orderData.customer_id,
              course_id: course.id,
              order_id: orderData.id,
              expires_at: expiresAt.toISOString(),
            },
            { onConflict: 'customer_id,course_id' }
          )
          .select('access_token')
          .single();

        if (accessErr) {
          console.error(`[${source}] Error upserting subscription access:`, course.id, accessErr);
        } else {
          console.log(`[${source}] Upserted subscription access for course:`, course.id);
          if (upsertedAccess?.access_token && !existingAccess) {
            await sendAccessEmail(supabase, orderData.customer_id!, course, upsertedAccess.access_token, orderData.id, orderData.user_id, source, isEnglish);
          }
        }
      } else if (!existingAccess) {
        const { data: newAccess, error: accessErr } = await supabase
          .from('member_access')
          .upsert(
            { customer_id: orderData.customer_id, course_id: course.id, order_id: orderData.id },
            { onConflict: 'customer_id,course_id', ignoreDuplicates: true }
          )
          .select('access_token')
          .single();

        if (accessErr) {
          console.error(`[${source}] Error creating member access for course:`, course.id, accessErr);
        } else {
          console.log(`[${source}] Created member access for course:`, course.id, course.title);
          if (newAccess?.access_token) {
            await sendAccessEmail(supabase, orderData.customer_id!, course, newAccess.access_token, orderData.id, orderData.user_id, source, isEnglish);
          }
        }
      } else {
        console.log(`[${source}] Member access already exists for course:`, course.id);
      }
    }
  } catch (memberErr) {
    console.error(`[${source}] Member access error (non-blocking):`, memberErr);
  }
}

// ─── 6. Push notification to producer ────────────────────────────────────────
async function stepPushNotification(params: ProcessOrderPaidParams): Promise<void> {
  const { supabase, orderData, source } = params;
  if (!orderData.user_id) return;

  const appId = Deno.env.get('ONESIGNAL_APP_ID');
  const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
  if (!appId || !apiKey) return;

  try {
    const { data: notifSettings } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', orderData.user_id)
      .maybeSingle();

    if (!notifSettings || notifSettings.send_approved === false) {
      console.log(`[${source}] Push skipped: send_approved is false or settings not found for user ${orderData.user_id}`);
      return;
    }

    // Check product whitelist
    if (notifSettings.product_whitelist && Array.isArray(notifSettings.product_whitelist)) {
      if (orderData.product_id && !notifSettings.product_whitelist.includes(orderData.product_id)) {
        console.log(`[${source}] Push skipped: product ${orderData.product_id} not in whitelist`);
        return;
      }
    }

    // Check quiet hours
    if (notifSettings.quiet_hours_enabled) {
      const now = new Date();
      const brTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const hours = brTime.getHours().toString().padStart(2, '0');
      const mins = brTime.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${hours}:${mins}`;

      const start = notifSettings.quiet_hours_start || "22:00";
      const end = notifSettings.quiet_hours_end || "08:00";

      let isQuiet = false;
      if (start < end) {
        if (currentTimeStr >= start && currentTimeStr <= end) isQuiet = true;
      } else {
        if (currentTimeStr >= start || currentTimeStr <= end) isQuiet = true;
      }
      if (isQuiet) {
        console.log(`[${source}] Push skipped: quiet hours (${start}-${end})`);
        return;
      }
    }

    let productName = 'Produto';
    let customerName = '';
    // Resolve currency: prefer explicit param, otherwise fetch from product, fallback BRL
    let resolvedCurrency = (params.currency || '').toUpperCase();

    if (orderData.product_id) {
      const { data: prod } = await supabase
        .from('products')
        .select('name, is_subscription, currency')
        .eq('id', orderData.product_id)
        .maybeSingle();
      if (prod) {
        productName = prod.name;
        if (!resolvedCurrency && prod.currency) {
          resolvedCurrency = String(prod.currency).toUpperCase();
        }
      }
    }
    if (!resolvedCurrency) resolvedCurrency = 'BRL';

    if (orderData.customer_id) {
      const { data: cust } = await supabase
        .from('customers')
        .select('name')
        .eq('id', orderData.customer_id)
        .maybeSingle();
      if (cust) customerName = cust.name;
    }

    // Format amount per currency (USD: $ 9.75 / BRL: R$ 9,75)
    const isUsd = resolvedCurrency === 'USD';
    const amountNum = Number(orderData.amount);
    const formattedAmount = isUsd
      ? amountNum.toFixed(2)
      : amountNum.toFixed(2).replace('.', ',');
    const currencySymbol = isUsd ? 'US$' : 'R$';
    const method = orderData.payment_method === 'pix'
      ? '💠 PIX'
      : (isUsd ? '💳 Card' : '💳 Cartão');

    const title = isUsd ? '💰 New sale confirmed!' : '💰 Nova venda confirmada!';
    const message = `${customerName || (isUsd ? 'Customer' : 'Cliente')} • ${method} ${currencySymbol} ${formattedAmount}${notifSettings.show_product_name ? ` • ${productName}` : ''}`;

    const payload: Record<string, unknown> = {
      app_id: appId,
      target_channel: 'push',
      headings: { en: title },
      contents: { en: message },
      chrome_web_icon: 'https://app.panttera.com.br/pwa-192x192.png',
      include_aliases: { external_id: [orderData.user_id] },
      url: 'https://app.panttera.com.br/admin/orders',
    };

    let response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let raw = await response.text();
    if (!response.ok || raw.includes('All included players are not subscribed') || raw.includes('invalid_aliases') || raw.includes('"id":""')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.include_aliases;
      fallbackPayload.filters = [{ field: 'tag', key: 'user_id', relation: '=', value: orderData.user_id }];
      response = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackPayload),
      });
      raw = await response.text();
    }

    console.log(`[${source}] OneSignal response:`, { status: response.status, body: raw });
  } catch (notifErr) {
    console.error(`[${source}] Notification error (non-blocking):`, notifErr);
  }
}

// ─── 7. WhatsApp dispatch ────────────────────────────────────────────────────
async function stepWhatsAppDispatch(params: ProcessOrderPaidParams): Promise<void> {
  const { supabase, orderData, source } = params;
  if (!orderData.user_id || !orderData.customer_id) return;

  try {
    const { data: custWa } = await supabase
      .from('customers')
      .select('name, phone')
      .eq('id', orderData.customer_id)
      .maybeSingle();

    const { data: prodWa } = await supabase
      .from('products')
      .select('name, price')
      .eq('id', orderData.product_id || '')
      .maybeSingle();

    if (custWa?.phone) {
      // Find the most recent access token for this customer to build the access link
      const { data: accessRecord } = await supabase
        .from('member_access')
        .select('access_token')
        .eq('customer_id', orderData.customer_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const accessLink = accessRecord?.access_token
        ? `https://app.panttera.com.br/membros?token=${accessRecord.access_token}`
        : null;

      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          tenant_id: orderData.user_id,
          order_id: orderData.id,
          customer_phone: custWa.phone,
          customer_name: custWa.name,
          product_name: prodWa?.name || '',
          product_price: String(orderData.amount),
          access_link: accessLink || '',
          category: 'confirmacao',
        }),
      }).catch(e => console.error(`[${source}] whatsapp-dispatch error:`, e));
    }
  } catch (waErr) {
    console.error(`[${source}] WhatsApp dispatch error (non-blocking):`, waErr);
  }
}

// ─── 8. Billing low balance notification ─────────────────────────────────────
// ─── AppSell delivery notification ──────────────────────────────────────────
async function stepAppsellNotify(params: ProcessOrderPaidParams): Promise<void> {
  const { supabase, orderData, source } = params;
  if (!orderData.user_id || !orderData.product_id) return;

  try {
    // Only fire for products with delivery_method = 'appsell'
    const { data: prod } = await supabase
      .from('products')
      .select('delivery_method')
      .eq('id', orderData.product_id)
      .maybeSingle();

    if (prod?.delivery_method !== 'appsell') {
      console.log(`[${source}] Skipping AppSell notify — delivery_method is ${prod?.delivery_method}`);
      return;
    }

    // Confirm the producer has an active AppSell integration before invoking
    const { data: integration } = await supabase
      .from('appsell_integrations')
      .select('active, token')
      .eq('user_id', orderData.user_id)
      .maybeSingle();

    if (!integration?.active || !integration?.token) {
      console.log(`[${source}] Skipping AppSell notify — no active integration for user ${orderData.user_id}`);
      return;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const res = await fetch(`${supabaseUrl}/functions/v1/appsell-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        event: 'order.paid',
        order_id: orderData.id,
        user_id: orderData.user_id,
      }),
    });

    const body = await res.text();
    console.log(`[${source}] AppSell notify response: ${res.status} ${body.substring(0, 200)}`);

    // BUG 3 Fix: Retry if not successful
    try {
      if (body.trim()) {
        const responseData = JSON.parse(body);
        if (!responseData.success) {
          console.error(`[${source}] AppSell FAILED for order ${orderData.id}: ${responseData.appsell_response}. Retrying in 3s...`);
          
          await new Promise(r => setTimeout(r, 3000));
          
          const retryRes = await fetch(`${supabaseUrl}/functions/v1/appsell-notify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              event: 'order.paid',
              order_id: orderData.id,
              user_id: orderData.user_id,
            }),
          });
          
          const retryBody = await retryRes.text();
          console.log(`[${source}] AppSell retry response: ${retryRes.status} ${retryBody.substring(0, 200)}`);
        }
      }
    } catch (parseErr) {
      console.error(`[${source}] Error parsing AppSell response or during retry:`, parseErr);
    }
  } catch (err) {
    console.error(`[${source}] AppSell notify error (non-blocking):`, err);
  }
}

async function stepBillingNotification(params: ProcessOrderPaidParams): Promise<void> {
  const { supabase, orderData, source } = params;
  if (!orderData.user_id) return;

  try {
    const { data: billingAcc } = await supabase
      .from('billing_accounts')
      .select('balance, blocked')
      .eq('user_id', orderData.user_id)
      .maybeSingle();

    if (billingAcc && (billingAcc.blocked || Number(billingAcc.balance) < 20)) {
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/billing-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          user_id: orderData.user_id,
          balance: billingAcc.balance,
          is_blocked: billingAcc.blocked,
        }),
      }).catch(err => console.error(`[${source}] billing-notify error:`, err));
    }
  } catch (notifyErr) {
    console.error(`[${source}] billing notify check error (non-blocking):`, notifyErr);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main orchestrator — runs ALL post-payment side effects.
// Each step is wrapped in its own try/catch so a failure in one step
// doesn't prevent the others from executing.
// ═══════════════════════════════════════════════════════════════════════════════
export async function processOrderPaid(params: ProcessOrderPaidParams): Promise<void> {
  const { source } = params;
  const orderId = params.orderData.id;
  console.log(`[${source}] processOrderPaid started for order ${orderId}`);

  const steps = [
    { name: 'Purchase Email', fn: stepPurchaseConfirmationEmail },
    { name: 'CAPI Fallback', fn: stepCapiFallback },
    { name: 'Recover Carts', fn: stepRecoverAbandonedCarts },
    { name: 'Member Access', fn: stepMemberAccess },
    { name: 'AppSell Notify', fn: stepAppsellNotify },
    { name: 'Push Notification', fn: stepPushNotification },
    { name: 'WhatsApp Dispatch', fn: stepWhatsAppDispatch },
    { name: 'Billing Notification', fn: stepBillingNotification },
    { name: 'A/B Conversion', fn: stepAbConversion },
  ];

  for (const step of steps) {
    try {
      console.log(`[${source}][${orderId}] Executing step: ${step.name}`);
      await step.fn(params);
    } catch (err) {
      console.error(`[${source}][${orderId}] Critical error in step ${step.name}:`, err);
    }
  }

  console.log(`[${source}] processOrderPaid completed for order ${orderId}`);
}

// ─── 9. A/B test conversion tracking ────────────────────────────────────────
async function stepAbConversion(params: ProcessOrderPaidParams): Promise<void> {
  const { supabase, orderData, source } = params;
  try {
    const meta = (orderData.metadata ?? {}) as Record<string, unknown>;
    // Accept standard ab_visitor_id, _abv, or persistent vid/vid_fbp
    const visitorId = (meta.ab_visitor_id as string) || 
                      (meta._abv as string) || 
                      (meta.vid as string) || 
                      (meta.visitor_id as string);
                      
    if (!visitorId) {
      console.log(`[${source}] A/B conversion skipped: no visitorId in metadata`);
      return;
    }

    const { error } = await supabase.rpc('ab_record_conversion', {
      p_visitor_id: visitorId,
      p_order_id: orderData.id,
      p_amount: orderData.amount,
    });
    if (error) {
      console.warn(`[${source}] ab_record_conversion error:`, error.message);
    } else {
      console.log(`[${source}] A/B conversion recorded for visitor ${visitorId}`);
    }
  } catch (e) {
    console.warn(`[${source}] stepAbConversion failed:`, e instanceof Error ? e.message : String(e));
  }
}
