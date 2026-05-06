import { useEffect, useState } from "react";
import { Star, Send, MessageCircle, Clock, ThumbsUp, Heart, Reply } from "lucide-react";
import ninaAvatar from "@/assets/nina-avatar.png";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberTranslations } from "@/lib/memberI18n";

interface Review { id: string; customer_name: string; rating: number; comment: string | null; approved: boolean; created_at: string; member_access_id: string; }
interface ReviewReply { id: string; review_id: string; author_name: string; content: string; is_ai_reply: boolean; created_at: string; member_access_id: string | null; }
interface ReviewLike { id: string; review_id: string; member_access_id: string; }

export default function LessonReviews({ lessonId, memberAccessId, customerName, client, t }: { lessonId: string; memberAccessId: string; customerName: string; client: SupabaseClient; t: MemberTranslations; }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [replies, setReplies] = useState<Record<string, ReviewReply[]>>({});
  const [likes, setLikes] = useState<Record<string, ReviewLike[]>>({});
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => { loadReviews(); }, [lessonId, memberAccessId]);

  const loadReviews = async () => {
    const { data } = await client.from("lesson_reviews").select("*").eq("lesson_id", lessonId).order("created_at", { ascending: false });
    if (data) {
      const mine = data.find((r: Review) => r.member_access_id === memberAccessId);
      if (mine) { setMyReview(mine); setRating(mine.rating); setComment(mine.comment || ""); } else { setMyReview(null); setRating(5); setComment(""); }
      setReviews(data);
      const reviewIds = data.filter((r: Review) => r.approved).map((r: Review) => r.id);
      if (reviewIds.length > 0) {
        // Load replies and likes in parallel
        await Promise.all([loadReplies(reviewIds), loadLikes(reviewIds)]);
      }
    }
  };

  const loadReplies = async (reviewIds: string[]) => {
    if (reviewIds.length === 0) { setReplies({}); return; }

    const { data, error } = await client
      .from("review_replies")
      .select("id, review_id, author_name, content, is_ai_reply, created_at, member_access_id")
      .in("review_id", reviewIds)
      .order("created_at", { ascending: true });

    if (error) { console.error("Error loading replies:", error); return; }

    const grouped: Record<string, ReviewReply[]> = {};
    data?.forEach((reply: any) => {
      if (!grouped[reply.review_id]) grouped[reply.review_id] = [];
      grouped[reply.review_id].push(reply);
    });
    setReplies(grouped);
  };

  const loadLikes = async (reviewIds: string[]) => {
    const { data } = await client.from("review_likes").select("*").in("review_id", reviewIds);
    if (data) {
      const grouped: Record<string, ReviewLike[]> = {};
      data.forEach((l: any) => { if (!grouped[l.review_id]) grouped[l.review_id] = []; grouped[l.review_id].push(l); });
      setLikes(grouped);
    }
  };

  const submitReview = async () => {
    if (!comment.trim()) { toast.error(t.writeCommentFirst); return; }
    setSubmitting(true);
    const payload = { lesson_id: lessonId, member_access_id: memberAccessId, customer_name: customerName, rating, comment: comment.trim(), approved: false };
    const { error } = myReview
      ? await client.from("lesson_reviews").update({ rating, comment: comment.trim(), approved: false }).eq("id", myReview.id)
      : await client.from("lesson_reviews").insert(payload);
    setSubmitting(false);
    if (error) { toast.error(t.reviewError); console.error(error); }
    else { toast.success(t.reviewSent); loadReviews(); }
  };

  const toggleLike = async (reviewId: string) => {
    const myLike = (likes[reviewId] || []).find(l => l.member_access_id === memberAccessId);
    if (myLike) {
      await client.from("review_likes").delete().eq("id", myLike.id);
    } else {
      await client.from("review_likes").insert({ review_id: reviewId, member_access_id: memberAccessId });
    }
    const reviewIds = reviews.filter(r => r.approved).map(r => r.id);
    loadLikes(reviewIds);
  };

  const submitReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    const { error } = await client.from("review_replies").insert({
      review_id: reviewId,
      member_access_id: memberAccessId,
      author_name: customerName,
      content: replyText.trim(),
      is_ai_reply: false,
    });
    setSubmittingReply(false);
    if (error) { toast.error(t.reviewError); console.error(error); }
    else { setReplyText(""); setReplyingTo(null); toast.success(t.reviewSent); const ids = reviews.filter(r => r.approved).map(r => r.id); loadReplies(ids); }
  };

  const approvedReviews = reviews.filter((r) => r.approved);
  const myPendingReview = reviews.find((r) => r.member_access_id === memberAccessId && !r.approved);
  const avgRating = approvedReviews.length > 0 ? approvedReviews.reduce((a, r) => a + r.rating, 0) / approvedReviews.length : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border p-5" style={{ background: "hsl(220 18% 10%)", borderColor: "hsl(220 15% 14%)" }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-white font-bold text-sm flex items-center gap-2"><MessageCircle className="w-4 h-4 text-[hsl(145,65%,50%)]" />{t.lessonReviews}</h3>
        {avgRating > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "hsl(220,18%,14%)" }}>
            <Star className="w-4 h-4 fill-[hsl(45,93%,55%)] text-[hsl(45,93%,55%)]" />
            <span className="text-white text-sm font-bold">{avgRating.toFixed(1)}</span>
            <span className="text-[hsl(220,10%,40%)] text-xs">({approvedReviews.length} {approvedReviews.length === 1 ? t.review : t.reviews})</span>
          </div>
        )}
      </div>

      {/* Write review form */}
      <div className="rounded-xl p-4 mb-5 border" style={{ background: "hsl(220,18%,14%)", borderColor: "hsl(220,15%,18%)" }}>
        <p className="text-[hsl(220,10%,55%)] text-xs mb-1">{myReview ? t.editReview : t.leaveReview}</p>
        <div className="flex items-center gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setRating(s)} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)} className="transition-transform hover:scale-125">
              <Star className="w-6 h-6 transition-colors" style={{ fill: s <= (hoverRating || rating) ? "hsl(45,93%,55%)" : "transparent", color: s <= (hoverRating || rating) ? "hsl(45,93%,55%)" : "hsl(220,10%,30%)" }} />
            </button>
          ))}
          <span className="text-[hsl(220,10%,45%)] text-xs ml-2">{rating}/5</span>
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.writeComment} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(145,65%,42%)]" style={{ background: "hsl(220,18%,10%)", borderColor: "hsl(220,15%,20%)", color: "hsl(0,0%,85%)" }} />
        <div className="flex items-center justify-between mt-3">
          {myPendingReview && <span className="flex items-center gap-1 text-[hsl(45,93%,55%)] text-xs"><Clock className="w-3 h-3" />{t.awaitingApproval}</span>}
          {myReview?.approved && <span className="flex items-center gap-1 text-[hsl(145,65%,50%)] text-xs"><ThumbsUp className="w-3 h-3" />{t.published}</span>}
          {!myReview && <div />}
          <button onClick={submitReview} disabled={submitting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] disabled:opacity-50" style={{ backgroundImage: "linear-gradient(135deg, hsl(145,65%,42%), hsl(160,70%,36%))", color: "white" }}>
            <Send className="w-3 h-3" />{myReview ? t.update : t.send}
          </button>
        </div>
      </div>

      {/* Reviews list */}
      <AnimatePresence>
        {approvedReviews.length > 0 ? (
          <div className="space-y-3">
            <p className="text-[hsl(220,10%,45%)] text-xs font-medium uppercase tracking-wider mb-2">{t.publishedReviews}</p>
            {approvedReviews.map((r, i) => {
              const reviewReplies = replies[r.id] || [];
              const reviewLikes = likes[r.id] || [];
              const isLiked = reviewLikes.some(l => l.member_access_id === memberAccessId);
              const isReplying = replyingTo === r.id;

              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl border overflow-hidden" style={{ background: "hsl(220,18%,14%)", borderColor: "hsl(220,15%,18%)" }}>
                  {/* Review header */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundImage: "linear-gradient(135deg, hsl(145,65%,35%), hsl(160,70%,30%))", color: "white" }}>{r.customer_name.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-sm font-medium">{r.customer_name}</span>
                        <p className="text-[hsl(220,10%,30%)] text-[10px]">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => <Star key={s} className="w-3.5 h-3.5" style={{ fill: s <= r.rating ? "hsl(45,93%,55%)" : "transparent", color: s <= r.rating ? "hsl(45,93%,55%)" : "hsl(220,10%,25%)" }} />)}
                      </div>
                    </div>
                    {r.comment && <p className="text-[hsl(0,0%,75%)] text-sm leading-relaxed pl-10">"{r.comment}"</p>}
                    {r.member_access_id === memberAccessId && (
                      <span className="inline-block mt-2 ml-10 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "hsl(145,65%,15%)", color: "hsl(145,65%,55%)" }}>{t.yourReview}</span>
                    )}

                    {/* Like & Reply buttons */}
                    <div className="flex items-center gap-4 mt-3 pl-10">
                      <button onClick={() => toggleLike(r.id)} className="flex items-center gap-1.5 text-xs transition-all hover:scale-105" style={{ color: isLiked ? "hsl(350,80%,60%)" : "hsl(220,10%,40%)" }}>
                        <Heart className="w-3.5 h-3.5" style={{ fill: isLiked ? "hsl(350,80%,60%)" : "transparent" }} />
                        {reviewLikes.length > 0 && <span>{reviewLikes.length}</span>}
                      </button>
                      <button onClick={() => { setReplyingTo(isReplying ? null : r.id); setReplyText(""); }} className="flex items-center gap-1.5 text-xs transition-all hover:scale-105" style={{ color: isReplying ? "hsl(145,65%,50%)" : "hsl(220,10%,40%)" }}>
                        <Reply className="w-3.5 h-3.5" />
                        <span>{reviewReplies.length > 0 ? reviewReplies.length : ""} {t.replyAction || "Responder"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Replies */}
                  {reviewReplies.length > 0 && (
                    <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "hsl(220,15%,18%)", background: "hsl(220,18%,12%)" }}>
                      {reviewReplies.map((reply) => (
                        <div key={reply.id} className="flex gap-2">
                          {reply.is_ai_reply ? (
                            <img src={ninaAvatar} alt="Nina" className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5" loading="lazy" width={24} height={24} />
                          ) : (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5" style={{
                              backgroundImage: "linear-gradient(135deg, hsl(200,60%,40%), hsl(220,55%,35%))",
                              color: "white"
                            }}>
                              {reply.author_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-xs font-medium">{reply.author_name}</span>
                              {reply.is_ai_reply && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "hsl(260,50%,20%)", color: "hsl(260,70%,70%)" }}>IA</span>}
                              <span className="text-[hsl(220,10%,30%)] text-[10px]">{new Date(reply.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-[hsl(0,0%,70%)] text-xs leading-relaxed mt-1">{reply.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply input */}
                  {isReplying && (
                    <div className="border-t px-4 py-3" style={{ borderColor: "hsl(220,15%,18%)", background: "hsl(220,18%,11%)" }}>
                      <div className="flex gap-2">
                        <input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={t.writeReply || "Escreva uma resposta..."}
                          className="flex-1 rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(145,65%,42%)]"
                          style={{ background: "hsl(220,18%,10%)", borderColor: "hsl(220,15%,20%)", color: "hsl(0,0%,85%)" }}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitReply(r.id); } }}
                        />
                        <button onClick={() => submitReply(r.id)} disabled={submittingReply || !replyText.trim()} className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all hover:scale-[1.02]" style={{ backgroundImage: "linear-gradient(135deg, hsl(145,65%,42%), hsl(160,70%,36%))", color: "white" }}>
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <Star className="w-8 h-8 mx-auto mb-2" style={{ color: "hsl(220,10%,25%)" }} />
            <p className="text-[hsl(220,10%,35%)] text-sm">{t.beFirst}</p>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
