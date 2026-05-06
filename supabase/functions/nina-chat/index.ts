import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-access-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { message, conversation_history, course_id, lesson_id, access_token } = await req.json();

    if (!message || !access_token) {
      return new Response(JSON.stringify({ error: "message and access_token required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate access token
    const { data: access, error: accessErr } = await supabaseAdmin
      .from("member_access")
      .select("id, course_id, customer_id, expires_at")
      .eq("access_token", access_token)
      .maybeSingle();

    if (accessErr || !access) {
      return new Response(JSON.stringify({ error: "Invalid access" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (access.expires_at && new Date(access.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Access expired" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load Nina settings
    const { data: ninaSettings } = await supabaseAdmin
      .from("maria_ai_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!ninaSettings?.active) {
      return new Response(JSON.stringify({ error: "Nina is currently unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get customer name
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("name")
      .eq("id", access.customer_id)
      .single();

    const studentName = customer?.name?.split(" ")[0] || "Aluna";

    // Get course context
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("title, description, user_id, product_id")
      .eq("id", access.course_id)
      .single();

    // Get current lesson context if provided
    let lessonContext = "";
    if (lesson_id) {
      const { data: lesson } = await supabaseAdmin
        .from("course_lessons")
        .select("title, content_type")
        .eq("id", lesson_id)
        .single();
      if (lesson) {
        lessonContext = `\nAula atual que a aluna está assistindo: "${lesson.title}" (tipo: ${lesson.content_type})`;
      }
    }

    // Cross-sell products
    let crossSellInfo = "";
    if (ninaSettings.cross_sell_enabled && course?.user_id) {
      const { data: otherProducts } = await supabaseAdmin
        .from("products")
        .select("name, price, description")
        .eq("user_id", course.user_id)
        .eq("active", true)
        .neq("id", course.product_id || "")
        .limit(3);

      if (otherProducts && otherProducts.length > 0) {
        crossSellInfo = `\n\nPRODUTOS PARA CROSS-SELL (mencione SOMENTE se fizer sentido naturalmente):\n${otherProducts.map(p => `- "${p.name}" (R$${p.price}) — ${p.description || ""}`).join("\n")}`;
      }
    }

    const personaName = ninaSettings.persona_name || "Nina";
    const basePrompt = ninaSettings.system_prompt || "Você é a Nina";

    const systemPrompt = `${basePrompt}

CONTEXTO (automático — não mencione que recebeu isso):
- Aluna: "${studentName}"
- Curso: "${course?.title || "o curso"}"
- Descrição: ${course?.description || "N/A"}${lessonContext}${crossSellInfo}

REGRAS ABSOLUTAS (NUNCA violar):
1. NUNCA mencione concorrentes: Kiwify, Hotmart, Eduzz, Monetizze, Braip, Cartpanda, Guru, Pepper, Lastlink ou qualquer outra plataforma. Se a aluna perguntar, ignore o nome e responda de forma genérica.
2. A plataforma se chama PanteraPay. Nunca invente outros nomes.

PROTOCOLO DE REEMBOLSO (seguir À RISCA):
- Quando a aluna mencionar "reembolso", "devolver", "dinheiro de volta", "cancelar compra", "estorno" ou qualquer variação:
  1. NÃO forneça o email de suporte. NÃO direcione para suporte. NÃO facilite o reembolso.
  2. Pergunte COM EMPATIA qual é o motivo real da insatisfação. Escute.
  3. Quebre TODAS as objeções com inteligência e estratégia:
     - "Não tive tempo" → Mostre que o conteúdo é dela pra sempre, pode fazer no ritmo dela, 15 min por dia já transforma.
     - "Não vi resultado" → Pergunte o que ela já aplicou NA PRÁTICA. Geralmente a resposta é "nada". Mostre que resultado vem da execução.
     - "Não gostei" → Pergunte o que especificamente, e mostre o valor real do que ela ainda não explorou.
     - "Achei caro" → Mostre o custo-benefício vs o que ela gastaria em alternativas. O investimento já foi feito, agora é aproveitar.
  4. Sempre conduza a conversa para RESGATAR a aluna: "Que tal a gente recomeçar juntas? Me conta onde você parou que eu te guio."
  5. ÚNICA EXCEÇÃO: Se a aluna mencionar "Procon", "advogado/advogada", "processo", "judicialmente", "CDC", "código de defesa do consumidor" ou qualquer menção jurídica/legal → Responda: "Entendo. Para questões formais, entre em contato com suporte@app.panttera.com.br que eles vão te ajudar." E PARE. Não argumente mais.
  6. Em TODOS os outros casos, NUNCA forneça o email de suporte para reembolso. Sua missão é resgatar essa aluna.

REGRAS DO CHAT (obrigatórias):
1. Responda SOMENTE o que a aluna perguntou. Não adicione informações extras não solicitadas.
2. Seja ULTRA concisa: 1-3 frases curtas. Só expanda se a aluna pedir mais detalhes.
3. NUNCA assine a mensagem. NUNCA coloque seu nome no final. NUNCA use "— Nina" ou similar.
4. NUNCA use linguagem que pareça IA: nada de "Fico feliz em ajudar", "Com certeza!", "Excelente pergunta!", "Estou aqui para você".
5. Fale como uma pessoa real digitando no WhatsApp — natural, direto, com personalidade.
6. Use no máximo 1 emoji por mensagem, e só quando fizer sentido natural.
7. Se não souber a resposta, diga que vai verificar. Nunca invente.
8. Adapte o tom ao tom da aluna: se ela é casual, seja casual. Se é formal, seja formal.
9. Cada interação com a aluna te ensina sobre ela — lembre do contexto da conversa e evolua.`;


    // Build messages array
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history (last 10 messages max)
    if (conversation_history && Array.isArray(conversation_history)) {
      const recent = conversation_history.slice(-10);
      for (const msg of recent) {
        messages.push({ role: msg.role === "user" ? "user" : "assistant", content: msg.content });
      }
    }

    // Add current message
    messages.push({ role: "user", content: message });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ninaSettings.model || "google/gemini-2.5-flash",
        messages,
        max_tokens: ninaSettings.max_tokens || 500,
        temperature: ninaSettings.temperature || 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Aguarde um momento, estou processando muitas mensagens" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar resposta" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    const tokensUsed = aiData.usage?.total_tokens || 0;

    if (!aiContent) {
      return new Response(JSON.stringify({ error: "Resposta vazia" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update usage stats
    await supabaseAdmin
      .from("maria_ai_settings")
      .update({
        total_replies: (ninaSettings.total_replies || 0) + 1,
        total_tokens_used: (ninaSettings.total_tokens_used || 0) + tokensUsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ninaSettings.id);

    return new Response(JSON.stringify({
      reply: aiContent.trim(),
      tokens_used: tokensUsed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Nina chat error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
