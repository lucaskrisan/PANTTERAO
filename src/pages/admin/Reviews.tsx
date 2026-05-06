import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, CheckCircle2, XCircle, MessageCircle, Clock, Reply, Sparkles, ChevronLeft, ChevronRight, CheckCheck } from "lucide-react";
import ninaAvatar from "@/assets/nina-avatar.png";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReviewReply { id: string; review_id: string; author_name: string; content: string; is_ai_reply: boolean; created_at: string; }

interface Review {
  id: string;
  lesson_id: string;
  member_access_id: string;
  customer_name: string;
  customer_email?: string;
  rating: number;
  comment: string | null;
  approved: boolean;
  created_at: string;
  lesson_title?: string;
  course_title?: string;
  replies?: ReviewReply[];
}

const PAGE_SIZE = 20;

const Reviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");
  const [minRating, setMinRating] = useState<"all" | "4" | "5">("all");
  const [page, setPage] = useState(1);
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [batchReplying, setBatchReplying] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  useEffect(() => { loadReviews(); }, []);
  useEffect(() => { setPage(1); }, [filter, minRating]);

  const loadReviews = async () => {
    setLoading(true);
    setLoadError(null);

    // Single query: reviews + lesson/course + customer + replies (nested)
    const { data, error } = await supabase
      .from("lesson_reviews")
      .select(`
        *,
        course_lessons (
          title,
          course_modules (
            courses ( title )
          )
        ),
        member_access (
          customers ( name, email )
        ),
        review_replies (
          id, review_id, author_name, content, is_ai_reply, created_at
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setReviews([]);
      setLoadError("Não foi possível carregar as avaliações agora.");
      setLoading(false);
      return;
    }

    const enriched: Review[] = (data || []).map((r: any) => ({
      ...r,
      lesson_title: r.course_lessons?.title || "Aula desconhecida",
      course_title: r.course_lessons?.course_modules?.courses?.title || "",
      customer_name: r.member_access?.customers?.name || r.customer_name || "Aluno",
      customer_email: r.member_access?.customers?.email || null,
      replies: (r.review_replies || []).sort(
        (a: ReviewReply, b: ReviewReply) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    }));

    setReviews(enriched);
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from("lesson_reviews").update({ approved: true }).eq("id", id);
    if (error) { toast.error("Erro ao aprovar avaliação"); return; }
    toast.success("Avaliação aprovada e publicada!");
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, approved: true } : r)));
    try {
      const { data: ninaSettings } = await supabase.from("maria_ai_settings").select("auto_reply_on_approve, active").limit(1).maybeSingle();
      if (ninaSettings?.active && ninaSettings?.auto_reply_on_approve) {
        triggerAIReply(id);
      }
    } catch (e) {
      console.error("Failed to check Nina settings:", e);
    }
  };

  const triggerAIReply = async (reviewId: string) => {
    setGeneratingAI(reviewId);
    try {
      const { data, error } = await supabase.functions.invoke("review-ai-reply", { body: { review_id: reviewId } });
      if (error) { console.error("AI reply error:", error); toast.error("Erro ao gerar resposta da Nina"); }
      else if (data?.success) { toast.success("🐆 Nina respondeu!"); await loadReviews(); }
      else if (data?.skipped) { toast.info("Nina já respondeu esta avaliação"); }
      else { toast.error("Erro inesperado ao gerar resposta"); }
    } catch (e) { console.error(e); toast.error("Erro de conexão"); }
    setGeneratingAI(null);
  };

  const handleBatchAIReply = async () => {
    setBatchReplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("batch-ai-reply");
      if (error) { toast.error("Erro ao disparar respostas: " + (error.message || "unknown")); setBatchReplying(false); return; }
      const total = data?.total || 0;
      if (total > 0) {
        toast.success(`🐆 Nina está respondendo ${total} avaliação(ões) em background!`);
        const pollInterval = setInterval(async () => {
          await loadReviews();
          setBatchReplying(false);
          clearInterval(pollInterval);
        }, Math.min(total * 3000, 30000));
      } else {
        toast.info("Todas as avaliações já foram respondidas!");
        setBatchReplying(false);
      }
    } catch (e: any) {
      toast.error("Erro inesperado: " + (e?.message || ""));
      setBatchReplying(false);
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from("lesson_reviews").delete().eq("id", id);
    if (error) { toast.error("Erro ao rejeitar avaliação"); }
    else { toast.success("Avaliação removida."); setReviews((prev) => prev.filter((r) => r.id !== id)); }
  };

  // Filtered list (for current view)
  const filtered = useMemo(() => reviews.filter((r) => {
    if (filter === "pending" && r.approved) return false;
    if (filter === "approved" && !r.approved) return false;
    if (minRating === "4" && r.rating < 4) return false;
    if (minRating === "5" && r.rating < 5) return false;
    return true;
  }), [reviews, filter, minRating]);

  // Pending eligible for bulk approval (respects current rating filter)
  const bulkEligible = useMemo(
    () => reviews.filter((r) => {
      if (r.approved) return false;
      if (minRating === "4" && r.rating < 4) return false;
      if (minRating === "5" && r.rating < 5) return false;
      return true;
    }),
    [reviews, minRating]
  );

  const handleBulkApprove = async () => {
    setConfirmBulkOpen(false);
    if (bulkEligible.length === 0) return;
    setBulkApproving(true);
    const ids = bulkEligible.map((r) => r.id);
    const { error } = await supabase
      .from("lesson_reviews")
      .update({ approved: true })
      .in("id", ids);
    if (error) {
      console.error(error);
      toast.error("Erro ao aprovar em massa");
      setBulkApproving(false);
      return;
    }
    toast.success(`✨ ${ids.length} avaliações aprovadas!`);
    setReviews((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, approved: true } : r));
    setBulkApproving(false);
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pendingCount = reviews.filter((r) => !r.approved).length;
  const unrepliedCount = reviews.filter((r) => r.approved && !r.replies?.some(rep => rep.is_ai_reply)).length;
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—";

  return (
    <div className="space-y-5">
      {/* Header with stats */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Avaliações</h1>
          <p className="text-muted-foreground text-sm">Gerencie as avaliações dos alunos nas aulas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/40">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-bold">{avgRating}</span>
            <span className="text-xs text-muted-foreground">média</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border/40">
            <span className="text-sm font-bold">{reviews.length}</span>
            <span className="text-xs text-muted-foreground ml-1">total</span>
          </div>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1.5">
              {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={minRating} onValueChange={(v: any) => setMinRating(v)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as estrelas</SelectItem>
            <SelectItem value="4">★ 4 ou mais</SelectItem>
            <SelectItem value="5">★ Apenas 5 estrelas</SelectItem>
          </SelectContent>
        </Select>

        {/* Bulk approve — destaque */}
        {bulkEligible.length > 0 && filter !== "approved" && (
          <Button
            size="sm"
            onClick={() => setConfirmBulkOpen(true)}
            disabled={bulkApproving}
            className="h-9 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-sm"
          >
            <CheckCheck className="w-4 h-4 mr-1.5" />
            {bulkApproving ? "Aprovando..." : `Aprovar ${bulkEligible.length} ${minRating !== "all" ? `(${minRating}★+)` : ""}`}
          </Button>
        )}

        {unrepliedCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleBatchAIReply}
            disabled={batchReplying}
            className="h-9 ml-auto text-purple-600 border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/20"
          >
            {batchReplying ? (
              <><span className="animate-spin mr-1.5">⏳</span>Respondendo...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-1.5" />Nina responde {unrepliedCount}</>
            )}
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">{loadError}</p>
            <Button variant="outline" onClick={loadReviews}>Tentar novamente</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filter === "pending" ? "Nenhuma avaliação pendente." : "Nenhuma avaliação encontrada."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {pageItems.map((r) => {
              const hasAIReply = r.replies?.some(rep => rep.is_ai_reply);
              return (
                <Card key={r.id} className="group transition-colors hover:border-border/80">
                  <CardContent className="p-3.5">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {r.customer_name.charAt(0).toUpperCase()}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{r.customer_name}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                          {!r.approved ? (
                            <Badge variant="outline" className="text-[10px] h-5"><Clock className="w-2.5 h-2.5 mr-0.5" />Pendente</Badge>
                          ) : (
                            <Badge className="text-[10px] h-5 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />Aprovada</Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground ml-auto">
                            {new Date(r.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>

                        {r.comment && (
                          <p className="text-sm text-foreground/80 mt-1.5 line-clamp-2">"{r.comment}"</p>
                        )}

                        <div className="text-[11px] text-muted-foreground mt-1.5 truncate">
                          {r.course_title} → {r.lesson_title}
                        </div>

                        {/* Replies */}
                        {r.replies && r.replies.length > 0 && (
                          <div className="mt-2.5 space-y-1.5">
                            {r.replies.map((rep) => (
                              <div key={rep.id} className="flex gap-2 p-2 rounded-md bg-muted/40 border border-border/40">
                                {rep.is_ai_reply ? (
                                  <img src={ninaAvatar} alt="Nina" className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5" loading="lazy" width={16} height={16} />
                                ) : (
                                  <Reply className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-medium">{rep.author_name}</span>
                                    {rep.is_ai_reply && (
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                        <Sparkles className="w-2 h-2 mr-0.5" />IA
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{rep.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions — visíveis sempre em mobile, hover em desktop */}
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 flex-shrink-0">
                        {r.approved && !hasAIReply && (
                          <Button size="sm" variant="ghost" onClick={() => triggerAIReply(r.id)} disabled={generatingAI === r.id} className="h-7 px-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20">
                            {generatingAI === r.id ? <span className="animate-spin text-xs">⏳</span> : <Sparkles className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                        {!r.approved && (
                          <Button size="sm" onClick={() => handleApprove(r.id)} className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Aprovar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleReject(r.id)} className="h-7 px-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs px-3 font-medium">
                  {page} / {totalPages}
                </span>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirm bulk approval */}
      <AlertDialog open={confirmBulkOpen} onOpenChange={setConfirmBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar {bulkEligible.length} avaliações?</AlertDialogTitle>
            <AlertDialogDescription>
              {minRating === "all"
                ? `Todas as ${bulkEligible.length} avaliações pendentes serão publicadas imediatamente.`
                : `Serão aprovadas as ${bulkEligible.length} avaliações pendentes com ${minRating}★ ou mais.`}
              {" "}Você pode rejeitar individualmente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkApprove} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCheck className="w-4 h-4 mr-1.5" />
              Aprovar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Reviews;
