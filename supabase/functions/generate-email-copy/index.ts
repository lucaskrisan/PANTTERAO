import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- JWT Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- End Authentication ---

    const { funnel_type, customer_name, customer_email, product_name, product_price, product_description, order_id } = await req.json();

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If order_id provided, fetch real product data
    let realProductName = product_name || "Produto";
    let realProductPrice = product_price || "0,00";
    let realProductDescription = product_description || "";
    let realCustomerName = customer_name || "Cliente";

    if (order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("*, customers(name, email), products(name, price, description)")
        .eq("id", order_id)
        .single();

      if (order) {
        // Verify caller owns this order
        if (order.user_id !== user.id) {
          const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", { _user_id: user.id });
          if (!isSuperAdmin) {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
              status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        realProductName = order.products?.name || realProductName;
        realProductPrice = Number(order.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        realProductDescription = order.products?.description || realProductDescription;
        realCustomerName = order.customers?.name || realCustomerName;
      }
    }

    const funnelPrompts: Record<string, string> = {
      pix_reminder: `Escreva um email de LEMBRETE DE PIX PENDENTE. O cliente gerou o PIX mas não pagou ainda.
Crie urgência sutil (prazo expirando). Tom amigável e persuasivo.
Mencione o produto pelo nome e destaque os benefícios.`,

      abandoned_cart: `Escreva um email de RECUPERAÇÃO DE CARRINHO ABANDONADO. O cliente começou o checkout mas não finalizou.
Reengaje com curiosidade e benefícios do produto. Tom leve e convidativo.
Mencione o produto pelo nome e por que ele não deveria perder essa oportunidade.`,

      payment_confirmed: `Escreva um email de CONFIRMAÇÃO DE PAGAMENTO / BOAS-VINDAS.
Parabenize o cliente pela compra. Tom empolgante e acolhedor.
Diga que o acesso será enviado em breve (ou já foi liberado).`,

      access_link: `Escreva um email com o LINK DE ACESSO ao produto/curso.
Tom profissional e acolhedor. Instrua o cliente a acessar o conteúdo.
Mencione o produto pelo nome.`,

      follow_up: `Escreva um email de FOLLOW-UP pós-compra.
Pergunte se o cliente está aproveitando o produto. Tom atencioso.
Ofereça suporte caso precise de ajuda.`,
    };

    const funnelInstruction = funnelPrompts[funnel_type] || funnelPrompts.pix_reminder;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um copywriter brasileiro especialista em email marketing para produtos digitais.
Regras:
- Emails curtos, máximo 4 parágrafos
- HTML simples: <p>, <strong>, <br> apenas. SEM markdown.
- Não inclua links (o sistema adiciona automaticamente)
- Não inclua cabeçalho/rodapé (o sistema adiciona)
- Use o NOME DO PRODUTO e seus BENEFÍCIOS no texto
- Personalize com o nome do cliente
- Responda APENAS com JSON válido: {"subject": "...", "body": "..."}
- O subject deve ter no máximo 60 caracteres e incluir emoji relevante`,
          },
          {
            role: "user",
            content: `${funnelInstruction}

Dados:
- Cliente: ${realCustomerName}
- Produto: ${realProductName}
- Valor: R$ ${realProductPrice}
- Descrição: ${realProductDescription || "produto digital premium"}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit atingido, tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error: " + aiResponse.status);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error("AI returned invalid format");

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({
        subject: parsed.subject || "",
        body: parsed.body || "",
        product_name: realProductName,
        product_price: realProductPrice,
        customer_name: realCustomerName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-email-copy error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
