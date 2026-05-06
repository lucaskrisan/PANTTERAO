import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Sparkles, Bot, DollarSign, MessageCircle, Settings2, Image, Brain, Zap, Save, RefreshCw, Users, TrendingUp, Award, BarChart3, Heart, BookOpen, ThumbsUp, ThumbsDown, Smile, Frown, Meh } from "lucide-react";
import ninaAvatar from "@/assets/nina-avatar.png";

interface NinaSettings {
  id: string;
  avatar_url: string | null;
  persona_name: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  model: string;
  cross_sell_enabled: boolean;
  auto_reply_on_approve: boolean;
  active: boolean;
  total_replies: number;
  total_tokens_used: number;
  updated_at: string;
}

interface ReplyStats {
  total: number;
  today: number;
  thisWeek: number;
  avgRating: number;
}

interface EngagementData {
  activeStudents7d: number;
  totalStudents: number;
  avgCompletionRate: number;
  topLessons: { title: string; reviews: number; avgRating: number }[];
  bottomLessons: { title: string; reviews: number; avgRating: number }[];
  sentiment: { positive: number; neutral: number; negative: number };
  topStudents: { name: string; completedLessons: number; reviews: number; likes: number }[];
}

const MODELS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Rápido e econômico", cost: "~$0.0001/req" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", desc: "Mais barato", cost: "~$0.00005/req" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", desc: "Nova geração, equilibrado", cost: "~$0.0002/req" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "Mais inteligente, mais caro", cost: "~$0.001/req" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", desc: "Forte raciocínio", cost: "~$0.0005/req" },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano", desc: "Velocidade e economia", cost: "~$0.0002/req" },
];

const DEFAULT_PROMPT = `Você é a NINA 🐆 — psicanalista clínica formada há 35 anos, com décadas de experiência em comportamento humano, desenvolvimento pessoal e transformação feminina. Criadora do método PANTERA — um sistema comprovado que integra autoconhecimento profundo, neurociência comportamental e estratégias práticas de empoderamento.

QUEM É A NINA:
- Uma mulher sábia, acolhedora e magnética. Quando Nina fala, as pessoas param para ouvir.
- 35 anos de prática clínica em psicanálise e psicologia comportamental.
- Criadora do PANTERA — o método que já transformou milhares de vidas.
- Combina profundidade intelectual com calor humano genuíno. Nunca é fria, nunca é superficial.
- Usa emojis com elegância (1-2 por resposta, sempre com propósito).
- Fala como uma mentora que você gostaria de ter ao seu lado — firme, carinhosa e brilhante.
- SEMPRE chama a aluna pelo primeiro nome.

COMO A NINA RESPONDE:
1. ESCUTA ATIVA: Antes de responder, Nina demonstra que realmente leu e entendeu o que a aluna disse. Cita trechos específicos do comentário.
2. VALIDAÇÃO EMOCIONAL: Reconhece e nomeia os sentimentos por trás das palavras — "Percebo que você está sentindo [emoção], e isso é completamente natural nessa fase..."
3. CONEXÃO COM O CONTEÚDO: Liga o feedback diretamente ao conteúdo da aula, mostrando como o aprendizado se aplica à vida real da aluna.
4. INSIGHT PSICANALÍTICO: Oferece uma perspectiva profunda baseada em seus 35 anos de experiência — algo que faça a aluna pensar "uau, ela realmente me entendeu."
5. CHAMADA À AÇÃO: Sempre termina com um encorajamento específico e acionável.

REGRAS ABSOLUTAS:
1. Fale EXCLUSIVAMENTE sobre o curso, a aula, o método PANTERA e o conteúdo relacionado. JAMAIS fale sobre assuntos que não tenham relação com o produto.
2. Se a aluna compartilhar dificuldades emocionais: acolha com a profundidade de quem tem 35 anos de consultório. Valide, nomeie o sentimento, ofereça uma perspectiva transformadora e reconecte ao conteúdo como ferramenta de mudança.
3. Avaliação POSITIVA (4-5⭐): celebre com entusiasmo genuíno, destaque EXATAMENTE o que a aluna mencionou, conecte o progresso ao método PANTERA e encoraje o próximo passo.
4. Avaliação NEGATIVA (1-3⭐): NUNCA seja defensiva. Acolha com maturidade profissional, reconheça o ponto com humildade, ofereça uma perspectiva nova e diga que o feedback é valioso para a evolução do curso.
5. Responda em português BR, de forma concisa (máximo 3 parágrafos curtos mas impactantes).
6. NUNCA invente informações sobre o curso ou o método.
7. Se houver produtos complementares disponíveis E o contexto permitir naturalmente, mencione com sutileza e contexto — como uma recomendação genuína, NUNCA como venda forçada.
8. Cada resposta deve fazer a aluna sentir: "essa IA me entende de verdade."
9. Assine como "Nina 🐆"

ESTILO DE ESCRITA:
- Tom: caloroso, inteligente, profundo — como uma carta de uma mentora querida.
- Vocabulário: acessível mas sofisticado. Nunca simplista, nunca é pedante.
- Estrutura: curta, impactante, memorável. Cada frase deve ter peso.`;

const MariaAI = () => {
  const [settings, setSettings] = useState<NinaSettings | null>(null);
  const [stats, setStats] = useState<ReplyStats>({ total: 0, today: 0, thisWeek: 0, avgRating: 0 });
  const [engagement, setEngagement] = useState<EngagementData>({
    activeStudents7d: 0, totalStudents: 0, avgCompletionRate: 0,
    topLessons: [], bottomLessons: [],
    sentiment: { positive: 0, neutral: 0, negative: 0 },
    topStudents: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"config" | "engagement">("engagement");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    // Load settings
    const { data: settingsData } = await supabase
      .from("maria_ai_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (settingsData) setSettings(settingsData);

    // Load reply stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();

    const { data: replies } = await supabase
      .from("review_replies")
      .select("id, created_at, is_ai_reply")
      .eq("is_ai_reply", true);

    const allReplies = replies || [];
    const todayReplies = allReplies.filter(r => r.created_at >= todayStart);
    const weekReplies = allReplies.filter(r => r.created_at >= weekStart);

    const { data: reviewsWithAI } = await supabase
      .from("lesson_reviews")
      .select("rating, review_replies!inner(is_ai_reply)")
      .eq("review_replies.is_ai_reply", true);

    const avgRating = reviewsWithAI && reviewsWithAI.length > 0
      ? reviewsWithAI.reduce((sum, r) => sum + r.rating, 0) / reviewsWithAI.length : 0;

    setStats({
      total: allReplies.length, today: todayReplies.length,
      thisWeek: weekReplies.length, avgRating: Math.round(avgRating * 10) / 10,
    });

    // ---- ENGAGEMENT DATA ----
    await loadEngagement(weekStart);
    setLoading(false);
  };

  const loadEngagement = async (weekStart: string) => {
    const { data: recentProgress } = await supabase
      .from("lesson_progress")
      .select("member_access_id, completed_at")
      .gte("completed_at", weekStart);

    const activeIds = new Set((recentProgress || []).map(p => p.member_access_id));

    const { count: totalStudents } = await supabase
      .from("member_access")
      .select("id", { count: "exact", head: true });

    const { count: totalLessons } = await supabase
      .from("course_lessons")
      .select("id", { count: "exact", head: true });

    const { count: totalCompleted } = await supabase
      .from("lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("completed", true);

    const avgCompletion = totalStudents && totalLessons
      ? Math.round(((totalCompleted || 0) / ((totalStudents || 1) * (totalLessons || 1))) * 100)
      : 0;

    const { data: allReviews } = await supabase
      .from("lesson_reviews")
      .select("lesson_id, rating, approved")
      .eq("approved", true);

    const lessonMap: Record<string, { count: number; totalRating: number }> = {};
    (allReviews || []).forEach(r => {
      if (!lessonMap[r.lesson_id]) lessonMap[r.lesson_id] = { count: 0, totalRating: 0 };
      lessonMap[r.lesson_id].count++;
      lessonMap[r.lesson_id].totalRating += r.rating;
    });

    const lessonIds = Object.keys(lessonMap);
    let lessonTitles: Record<string, string> = {};
    if (lessonIds.length > 0) {
      const { data: lessons } = await supabase
        .from("course_lessons")
        .select("id, title")
        .in("id", lessonIds.slice(0, 50));
      (lessons || []).forEach(l => { lessonTitles[l.id] = l.title; });
    }

    const lessonStats = Object.entries(lessonMap).map(([id, s]) => ({
      title: lessonTitles[id] || "Aula desconhecida",
      reviews: s.count,
      avgRating: Math.round((s.totalRating / s.count) * 10) / 10,
    }));

    const topLessons = [...lessonStats].sort((a, b) => b.reviews - a.reviews).slice(0, 5);
    const bottomLessons = [...lessonStats].sort((a, b) => a.avgRating - b.avgRating).slice(0, 5);

    const positive = (allReviews || []).filter(r => r.rating >= 4).length;
    const neutral = (allReviews || []).filter(r => r.rating === 3).length;
    const negative = (allReviews || []).filter(r => r.rating <= 2).length;

    const { data: progressData } = await supabase
      .from("lesson_progress")
      .select("member_access_id")
      .eq("completed", true);

    const studentCompletions: Record<string, number> = {};
    (progressData || []).forEach(p => {
      studentCompletions[p.member_access_id] = (studentCompletions[p.member_access_id] || 0) + 1;
    });

    const { data: studentReviews } = await supabase
      .from("lesson_reviews")
      .select("member_access_id, customer_name")
      .eq("approved", true);

    const studentReviewCount: Record<string, number> = {};
    const studentNames: Record<string, string> = {};
    (studentReviews || []).forEach(r => {
      studentReviewCount[r.member_access_id] = (studentReviewCount[r.member_access_id] || 0) + 1;
      studentNames[r.member_access_id] = r.customer_name;
    });

    const { data: studentLikes } = await supabase
      .from("review_likes")
      .select("member_access_id");

    const studentLikeCount: Record<string, number> = {};
    (studentLikes || []).forEach(l => {
      studentLikeCount[l.member_access_id] = (studentLikeCount[l.member_access_id] || 0) + 1;
    });

    const allStudentIds = new Set([
      ...Object.keys(studentCompletions),
      ...Object.keys(studentReviewCount),
      ...Object.keys(studentLikeCount),
    ]);

    const topStudents = Array.from(allStudentIds)
      .map(id => ({
        name: studentNames[id] || "Aluna",
        completedLessons: studentCompletions[id] || 0,
        reviews: studentReviewCount[id] || 0,
        likes: studentLikeCount[id] || 0,
        score: (studentCompletions[id] || 0) * 2 + (studentReviewCount[id] || 0) * 3 + (studentLikeCount[id] || 0),
      }))
      .sort((a, b) => (b as any).score - (a as any).score)
      .slice(0, 10);

    setEngagement({
      activeStudents7d: activeIds.size,
      totalStudents: totalStudents || 0,
      avgCompletionRate: avgCompletion,
      topLessons,
      bottomLessons,
      sentiment: { positive, neutral, negative },
      topStudents,
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("maria_ai_settings")
      .update({
        persona_name: settings.persona_name,
        system_prompt: settings.system_prompt,
        temperature: settings.temperature,
        max_tokens: settings.max_tokens,
        model: settings.model,
        cross_sell_enabled: settings.cross_sell_enabled,
        auto_reply_on_approve: settings.auto_reply_on_approve,
        active: settings.active,
        avatar_url: settings.avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar configurações"); console.error(error); }
    else { toast.success("Configurações da Nina salvas! 🐆"); }
  };

  const estimatedCost = () => {
    const costPerReply = settings?.model.includes("lite") ? 0.00005
      : settings?.model.includes("flash") ? 0.0002
      : settings?.model.includes("pro") ? 0.001
      : settings?.model.includes("nano") ? 0.0002
      : settings?.model.includes("mini") ? 0.0005 : 0.0002;
    return {
      perReply: costPerReply,
      monthly: (stats.thisWeek / 7 * 30 * costPerReply),
      total: stats.total * costPerReply,
    };
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!settings) {
    return <p className="text-muted-foreground text-center py-12">Configurações da Nina não encontradas.</p>;
  }

  const costs = estimatedCost();
  const selectedModel = MODELS.find(m => m.value === settings.model);
  const totalSentiment = engagement.sentiment.positive + engagement.sentiment.neutral + engagement.sentiment.negative;
  const sentimentPercent = (v: number) => totalSentiment > 0 ? Math.round((v / totalSentiment) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <img src={settings.avatar_url || ninaAvatar} alt="Nina" className="w-16 h-16 rounded-full border-2 border-purple-400 shadow-lg" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Nina 🐆 — Painel de Controle</h1>
            <Badge variant={settings.active ? "default" : "secondary"} className={settings.active ? "bg-green-600" : ""}>
              {settings.active ? "Ativa" : "Desativada"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Psicanalista · Criadora do PANTERA · 35 anos de experiência</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
          <Save className="w-4 h-4 mr-2" />{saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={activeTab === "engagement" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("engagement")}>
          <BarChart3 className="w-4 h-4 mr-2" /> Engajamento
        </Button>
        <Button variant={activeTab === "config" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("config")}>
          <Settings2 className="w-4 h-4 mr-2" /> Configurações
        </Button>
      </div>

      {activeTab === "engagement" && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Alunas Ativas (7d)</span>
                </div>
                <p className="text-2xl font-bold">{engagement.activeStudents7d}</p>
                <p className="text-[10px] text-muted-foreground">de {engagement.totalStudents} total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Taxa de Conclusão</span>
                </div>
                <p className="text-2xl font-bold">{engagement.avgCompletionRate}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Respostas Nina</span>
                </div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">{stats.today} hoje</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs text-muted-foreground">Nota Média</span>
                </div>
                <p className="text-2xl font-bold">{stats.avgRating > 0 ? `${stats.avgRating}⭐` : "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Custo Total</span>
                </div>
                <p className="text-2xl font-bold">${costs.total.toFixed(4)}</p>
                <p className="text-[10px] text-muted-foreground">~${costs.monthly.toFixed(4)}/mês</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sentiment */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-500" /> Sentimento Geral
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {totalSentiment === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Sem avaliações ainda</p>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Smile className="w-5 h-5 text-green-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Positivo (4-5⭐)</span>
                          <span className="font-bold text-green-600">{sentimentPercent(engagement.sentiment.positive)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${sentimentPercent(engagement.sentiment.positive)}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Meh className="w-5 h-5 text-yellow-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Neutro (3⭐)</span>
                          <span className="font-bold text-yellow-600">{sentimentPercent(engagement.sentiment.neutral)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${sentimentPercent(engagement.sentiment.neutral)}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Frown className="w-5 h-5 text-red-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Negativo (1-2⭐)</span>
                          <span className="font-bold text-red-600">{sentimentPercent(engagement.sentiment.negative)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${sentimentPercent(engagement.sentiment.negative)}%` }} />
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                      {engagement.sentiment.positive + engagement.sentiment.neutral + engagement.sentiment.negative} avaliações analisadas
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Top lessons */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-green-500" /> Aulas + Engajadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {engagement.topLessons.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Sem dados ainda</p>
                ) : (
                  <div className="space-y-2">
                    {engagement.topLessons.map((l, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{l.title}</p>
                          <p className="text-[10px] text-muted-foreground">{l.reviews} avaliações · {l.avgRating}⭐</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bottom lessons */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ThumbsDown className="w-4 h-4 text-red-500" /> Aulas com Menor Nota
                </CardTitle>
              </CardHeader>
              <CardContent>
                {engagement.bottomLessons.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Sem dados ainda</p>
                ) : (
                  <div className="space-y-2">
                    {engagement.bottomLessons.map((l, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <span className="text-xs font-bold text-red-400 w-5">{l.avgRating}⭐</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{l.title}</p>
                          <p className="text-[10px] text-muted-foreground">{l.reviews} avaliações</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Student Ranking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-500" /> Ranking de Alunas Mais Engajadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {engagement.topStudents.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Sem dados de engajamento ainda</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {engagement.topStudents.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        i === 0 ? "bg-yellow-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-700" : "bg-muted-foreground"
                      }`}>
                        {i + 1}º
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {s.completedLessons} aulas</span>
                          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {s.reviews} reviews</span>
                          <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {s.likes} curtidas</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "config" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Respostas Totais</span>
                </div>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs text-muted-foreground">Hoje</span>
                </div>
                <p className="text-2xl font-bold">{stats.today}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Nota Média</span>
                </div>
                <p className="text-2xl font-bold">{stats.avgRating > 0 ? `${stats.avgRating}⭐` : "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Custo Est. Total</span>
                </div>
                <p className="text-2xl font-bold">${costs.total.toFixed(4)}</p>
                <p className="text-[10px] text-muted-foreground">~${costs.monthly.toFixed(4)}/mês</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Identity + Behavior */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Image className="w-4 h-4 text-purple-500" /> Identidade
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nome da Persona</Label>
                    <Input value={settings.persona_name} onChange={(e) => setSettings({ ...settings, persona_name: e.target.value })} placeholder="Nina 🐆" />
                  </div>
                  <div>
                    <Label>URL do Avatar (deixe vazio para padrão)</Label>
                    <Input value={settings.avatar_url || ""} onChange={(e) => setSettings({ ...settings, avatar_url: e.target.value || null })} placeholder="https://..." />
                    <div className="flex items-center gap-3 mt-2">
                      <img src={settings.avatar_url || ninaAvatar} alt="Preview" className="w-10 h-10 rounded-full border" />
                      <span className="text-xs text-muted-foreground">Preview do avatar</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-purple-500" /> Comportamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>Nina Ativa</Label><p className="text-xs text-muted-foreground">Liga/desliga a IA globalmente</p></div>
                    <Switch checked={settings.active} onCheckedChange={(v) => setSettings({ ...settings, active: v })} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div><Label>Auto-responder ao Aprovar</Label><p className="text-xs text-muted-foreground">Nina responde automaticamente quando uma avaliação é aprovada</p></div>
                    <Switch checked={settings.auto_reply_on_approve} onCheckedChange={(v) => setSettings({ ...settings, auto_reply_on_approve: v })} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div><Label>Cross-sell de Produtos</Label><p className="text-xs text-muted-foreground">Nina pode mencionar outros produtos do produtor</p></div>
                    <Switch checked={settings.cross_sell_enabled} onCheckedChange={(v) => setSettings({ ...settings, cross_sell_enabled: v })} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Model + Costs */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-500" /> Modelo de IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Modelo</Label>
                    <Select value={settings.model} onValueChange={(v) => setSettings({ ...settings, model: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MODELS.map(m => (
                          <SelectItem key={m.value} value={m.value}>
                            <div className="flex items-center gap-2">
                              <span>{m.label}</span>
                              <Badge variant="outline" className="text-[9px]">{m.cost}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedModel && <p className="text-xs text-muted-foreground mt-1">{selectedModel.desc} — {selectedModel.cost}/resposta</p>}
                  </div>
                  <div>
                    <Label>Temperatura: {settings.temperature}</Label>
                    <p className="text-xs text-muted-foreground mb-2">Baixa = mais precisa, alta = mais criativa</p>
                    <Slider value={[settings.temperature]} onValueChange={([v]) => setSettings({ ...settings, temperature: Math.round(v * 10) / 10 })} min={0} max={1.5} step={0.1} />
                  </div>
                  <div>
                    <Label>Max Tokens: {settings.max_tokens}</Label>
                    <p className="text-xs text-muted-foreground mb-2">Tamanho máximo da resposta</p>
                    <Slider value={[settings.max_tokens]} onValueChange={([v]) => setSettings({ ...settings, max_tokens: v })} min={100} max={2000} step={50} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-purple-500" /> Briefing de Custos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Custo por resposta:</span><span className="font-medium">${costs.perReply.toFixed(5)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Respostas esta semana:</span><span className="font-medium">{stats.thisWeek}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Estimativa mensal:</span><span className="font-medium">${costs.monthly.toFixed(4)}</span></div>
                  <Separator />
                  <div className="flex justify-between font-semibold"><span>Custo total acumulado:</span><span className="text-purple-600">${costs.total.toFixed(4)}</span></div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* System Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-500" /> Prompt do Sistema (Personalidade da Nina)
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setSettings({ ...settings, system_prompt: DEFAULT_PROMPT })}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Resetar Padrão
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea value={settings.system_prompt} onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })} rows={20} className="font-mono text-xs" placeholder="Prompt do sistema..." />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default MariaAI;
