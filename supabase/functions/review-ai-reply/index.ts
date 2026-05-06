import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { review_id } = await req.json();
    if (!review_id) {
      return new Response(JSON.stringify({ error: "review_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load Nina settings
    const { data: ninaSettings } = await supabaseAdmin
      .from("maria_ai_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!ninaSettings?.active) {
      return new Response(JSON.stringify({ skipped: true, reason: "Nina AI is disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get review with lesson and course context
    const { data: review, error: reviewErr } = await supabaseAdmin
      .from("lesson_reviews")
      .select(`
        *, 
        course_lessons(title, content, course_modules(courses(title, description, ai_reply_enabled, user_id, product_id)))
      `)
      .eq("id", review_id)
      .single();

    if (reviewErr || !review) {
      return new Response(JSON.stringify({ error: "Review not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const course = review.course_lessons?.course_modules?.courses;
    if (!course?.ai_reply_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "AI replies disabled for this course" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if Nina already replied
    const { data: existingReply } = await supabaseAdmin
      .from("review_replies")
      .select("id")
      .eq("review_id", review_id)
      .eq("is_ai_reply", true)
      .maybeSingle();

    if (existingReply) {
      return new Response(JSON.stringify({ skipped: true, reason: "Nina already replied" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get other products from the same producer for cross-sell
    let crossSellInfo = "";
    if (ninaSettings.cross_sell_enabled && course.user_id) {
      const { data: otherProducts } = await supabaseAdmin
        .from("products")
        .select("name, price, description")
        .eq("user_id", course.user_id)
        .eq("active", true)
        .neq("id", course.product_id || "")
        .limit(3);

      if (otherProducts && otherProducts.length > 0) {
        crossSellInfo = `\n\nPRODUTOS DISPONÍVEIS PARA CROSS-SELL (use com naturalidade, SOMENTE se fizer sentido no contexto da conversa — NUNCA force a venda):\n${otherProducts.map(p => `- "${p.name}" (R$${p.price}) — ${p.description || "sem descrição"}`).join("\n")}`;
      }
    }

    const courseName = course?.title || "o curso";
    const lessonName = review.course_lessons?.title || "a aula";
    const courseDesc = course?.description || "";
    const studentName = review.customer_name || "Aluna";
    const studentComment = review.comment || "";
    const studentRating = review.rating;
    const personaName = ninaSettings.persona_name || "Nina";

    // Build system prompt from settings + dynamic context
    const basePrompt = ninaSettings.system_prompt || "Você é a Nina";
    const systemPrompt = `${basePrompt}

CONTEXTO (automático):
- Curso: "${courseName}"
- Descrição: ${courseDesc}
- Aula avaliada: "${lessonName}"${crossSellInfo}

REGRAS ABSOLUTAS (NUNCA violar):
1. NUNCA mencione concorrentes: Kiwify, Hotmart, Eduzz, Monetizze, Braip, Cartpanda, Guru, Pepper, Lastlink ou qualquer outra plataforma.
2. O email de suporte é: suporte@app.panttera.com.br
3. A plataforma se chama PanteraPay.

REGRAS PARA RESPOSTA À AVALIAÇÃO:
1. Responda ao que a aluna DISSE especificamente. Não generalize.
2. Máximo 2-3 frases curtas e impactantes. Sem enrolação.
3. NUNCA assine a mensagem. NUNCA coloque nome no final.
4. NUNCA use tom de IA: nada de "Fico feliz!", "Excelente!", "Estou aqui para você!".
5. Fale como pessoa real — natural, direto, com calor humano genuíno.
6. Máximo 1 emoji por resposta, só se fizer sentido.`;

    const userMessage = `A aluna "${studentName}" avaliou a aula "${lessonName}" com ${studentRating}/5 estrelas e comentou: "${studentComment}"

Responda de forma curta e humana.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ninaSettings.model || "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: ninaSettings.max_tokens || 500,
        temperature: ninaSettings.temperature || 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, tente novamente em breve" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    const tokensUsed = aiData.usage?.total_tokens || 0;

    if (!aiContent) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Insert Nina's reply
    const { error: insertErr } = await supabaseAdmin
      .from("review_replies")
      .insert({
        review_id,
        author_name: personaName,
        content: aiContent.trim(),
        is_ai_reply: true,
        member_access_id: null,
      });

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to save reply" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    return new Response(JSON.stringify({ success: true, reply: aiContent.trim(), tokens_used: tokensUsed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
