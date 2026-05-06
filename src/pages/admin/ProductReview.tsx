// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle, XCircle, Clock, Search, Loader2, Package, Eye,
  FileText, Image, BookOpen, Video, File, ExternalLink, Globe,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pending_review: { label: "Em revisão", icon: Clock, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Aprovado", icon: CheckCircle, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected: { label: "Reprovado", icon: XCircle, color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const ProductReview = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  // Detail drawer state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [productCourses, setProductCourses] = useState<any[]>([]);
  const [productSalesPages, setProductSalesPages] = useState<any[]>([]);

  useEffect(() => { loadProducts(); }, [statusFilter]);

  const loadProducts = async () => {
    setLoading(true);
    let query = supabase
      .from("products")
      .select("id, name, description, price, active, created_at, user_id, moderation_status, rejection_reason, image_url, is_subscription, billing_cycle")
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("moderation_status" as any, statusFilter);
    }

    const { data } = await query;

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
      setProducts(data.map((p: any) => ({ ...p, producer_name: profileMap.get(p.user_id) || "—" })));
    } else {
      setProducts([]);
    }
    setLoading(false);
  };

  const openDetail = useCallback(async (product: any) => {
    setDetailProduct(product);
    setDetailOpen(true);
    setDetailLoading(true);

    // Load courses with modules and lessons
    const { data: courses } = await supabase
      .from("courses")
      .select("id, title, description, cover_image_url")
      .eq("product_id", product.id);

    let enrichedCourses: any[] = [];
    if (courses && courses.length > 0) {
      for (const course of courses) {
        const { data: modules } = await supabase
          .from("course_modules")
          .select("id, title, sort_order")
          .eq("course_id", course.id)
          .order("sort_order");

        let enrichedModules: any[] = [];
        if (modules) {
          for (const mod of modules) {
            const { data: lessons } = await supabase
              .from("course_lessons")
              .select("id, title, content_type, content, file_url, sort_order")
              .eq("module_id", mod.id)
              .order("sort_order");

            // Load materials for each lesson
            let enrichedLessons: any[] = [];
            if (lessons) {
              for (const lesson of lessons) {
                const { data: materials } = await supabase
                  .from("lesson_materials")
                  .select("id, title, material_type, file_url")
                  .eq("lesson_id", lesson.id)
                  .order("sort_order");
                enrichedLessons.push({ ...lesson, materials: materials || [] });
              }
            }
            enrichedModules.push({ ...mod, lessons: enrichedLessons });
          }
        }
        enrichedCourses.push({ ...course, modules: enrichedModules });
      }
    }
    setProductCourses(enrichedCourses);

    // Load sales pages
    const { data: salesPages } = await supabase
      .from("sales_pages")
      .select("id, title, slug, published")
      .eq("product_id", product.id);
    setProductSalesPages(salesPages || []);

    setDetailLoading(false);
  }, []);

  const handleApprove = async (product: any) => {
    setProcessing(product.id);
    const { error } = await supabase
      .from("products")
      .update({ moderation_status: "approved", rejection_reason: null } as any)
      .eq("id", product.id);

    if (error) {
      toast.error("Erro ao aprovar produto");
    } else {
      toast.success(`"${product.name}" aprovado!`);
      await sendModerationEmail(product, "approved");
      loadProducts();
      if (detailOpen && detailProduct?.id === product.id) {
        setDetailProduct({ ...detailProduct, moderation_status: "approved" });
      }
    }
    setProcessing(null);
  };

  const openRejectDialog = (product: any) => {
    setSelectedProduct(product);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedProduct || !rejectionReason.trim()) {
      toast.error("Informe o motivo da reprovação");
      return;
    }
    setProcessing(selectedProduct.id);
    const { error } = await supabase
      .from("products")
      .update({ moderation_status: "rejected", rejection_reason: rejectionReason.trim() } as any)
      .eq("id", selectedProduct.id);

    if (error) {
      toast.error("Erro ao reprovar produto");
    } else {
      toast.success(`"${selectedProduct.name}" reprovado`);
      await sendModerationEmail(selectedProduct, "rejected", rejectionReason.trim());
      setRejectDialogOpen(false);
      loadProducts();
      if (detailOpen && detailProduct?.id === selectedProduct.id) {
        setDetailProduct({ ...detailProduct, moderation_status: "rejected", rejection_reason: rejectionReason.trim() });
      }
    }
    setProcessing(null);
  };

  const sendModerationEmail = async (product: any, status: string, reason?: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      await supabase.functions.invoke("product-moderation-email", {
        body: {
          product_id: product.id,
          product_name: product.name,
          producer_user_id: product.user_id,
          status,
          reason,
        },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
    } catch (err) {
      console.error("Error sending moderation email:", err);
    }
  };

  const fmt = (v: number) => `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.producer_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="w-3.5 h-3.5 text-blue-400" />;
      case "text": return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
      default: return <File className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Revisão de Produtos</h1>
        <p className="text-sm text-muted-foreground mt-1">Controle total: inspecione entregáveis, páginas e conteúdo antes de aprovar</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produto ou produtor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending_review">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Reprovados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Produto</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Produtor</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Preço</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Criado em</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Status</TableHead>
                <TableHead className="w-[220px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Nenhum produto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const cfg = STATUS_CONFIG[p.moderation_status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending_review;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={p.id} className="border-l-2 border-l-transparent hover:bg-muted/50 hover:border-l-primary/40 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} className="w-10 h-10 rounded-lg object-cover" alt="" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                              <Package className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm text-foreground">{p.name}</p>
                            {p.is_subscription && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Assinatura</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.producer_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmt(p.price)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(p.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] gap-1 border ${cfg.color}`}>
                          <Icon className="w-3 h-3" /> {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => openDetail(p)}
                          >
                            <Eye className="w-3 h-3 mr-1" /> Inspecionar
                          </Button>
                          {(p.moderation_status === "pending_review" || p.moderation_status === "rejected") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                              onClick={() => handleApprove(p)}
                              disabled={processing === p.id}
                            >
                              {processing === p.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                              Aprovar
                            </Button>
                          )}
                          {(p.moderation_status === "pending_review" || p.moderation_status === "approved") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                              onClick={() => openRejectDialog(p)}
                              disabled={processing === p.id}
                            >
                              <XCircle className="w-3 h-3 mr-1" /> Reprovar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Exibindo {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* ===== Product Detail Inspection Sheet ===== */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-xl w-full p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <SheetTitle className="text-lg font-semibold flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Inspeção do Produto
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-140px)]">
            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : detailProduct ? (
              <div className="px-6 py-5 space-y-6">
                {/* Basic Info */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Informações Gerais</h3>
                  <div className="flex gap-4">
                    {detailProduct.image_url ? (
                      <img src={detailProduct.image_url} className="w-20 h-20 rounded-xl object-cover border border-border" alt="" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center border border-border">
                        <Image className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <p className="font-semibold text-foreground">{detailProduct.name}</p>
                      <p className="text-sm text-muted-foreground">Produtor: <span className="text-foreground">{detailProduct.producer_name}</span></p>
                      <p className="text-sm text-muted-foreground">Preço: <span className="text-foreground font-medium">{fmt(detailProduct.price)}</span></p>
                      {detailProduct.is_subscription && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                          Assinatura {detailProduct.billing_cycle === "monthly" ? "mensal" : detailProduct.billing_cycle === "yearly" ? "anual" : detailProduct.billing_cycle}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Descrição</h3>
                  {detailProduct.description ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-border/50">{detailProduct.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nenhuma descrição fornecida</p>
                  )}
                </div>

                <Separator />

                {/* Moderation Status */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Status de Moderação</h3>
                  {(() => {
                    const cfg = STATUS_CONFIG[detailProduct.moderation_status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending_review;
                    const Icon = cfg.icon;
                    return (
                      <div className="space-y-2">
                        <Badge variant="outline" className={`text-xs gap-1 border ${cfg.color}`}>
                          <Icon className="w-3.5 h-3.5" /> {cfg.label}
                        </Badge>
                        {detailProduct.moderation_status === "rejected" && detailProduct.rejection_reason && (
                          <p className="text-sm text-red-400 bg-red-500/5 rounded-lg p-3 border border-red-500/20">
                            <strong>Motivo:</strong> {detailProduct.rejection_reason}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <Separator />

                {/* Sales Pages */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Páginas de Vendas
                  </h3>
                  {productSalesPages.length > 0 ? (
                    <div className="space-y-2">
                      {productSalesPages.map((sp) => (
                        <div key={sp.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 border border-border/50">
                          <div>
                            <p className="text-sm font-medium text-foreground">{sp.title || sp.slug}</p>
                            <p className="text-xs text-muted-foreground">/vendas/{sp.slug}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${sp.published ? "text-green-400 border-green-500/30" : "text-muted-foreground"}`}>
                              {sp.published ? "Publicada" : "Rascunho"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nenhuma página de vendas criada</p>
                  )}
                </div>

                <Separator />

                {/* Course Content / Deliverables */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Conteúdo / Entregáveis
                  </h3>
                  {productCourses.length > 0 ? (
                    <div className="space-y-4">
                      {productCourses.map((course) => (
                        <div key={course.id} className="bg-muted/30 rounded-lg border border-border/50 overflow-hidden">
                          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-3">
                            {course.cover_image_url && (
                              <img src={course.cover_image_url} className="w-8 h-8 rounded object-cover" alt="" />
                            )}
                            <div>
                              <p className="text-sm font-semibold text-foreground">{course.title}</p>
                              {course.description && <p className="text-xs text-muted-foreground line-clamp-1">{course.description}</p>}
                            </div>
                          </div>
                          <div className="px-4 py-2 space-y-2">
                            {course.modules.length === 0 && (
                              <p className="text-xs text-muted-foreground italic py-2">Nenhum módulo criado</p>
                            )}
                            {course.modules.map((mod: any) => (
                              <div key={mod.id} className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-1">
                                  📁 {mod.title}
                                </p>
                                {mod.lessons.length === 0 && (
                                  <p className="text-xs text-muted-foreground italic pl-4">Nenhuma aula</p>
                                )}
                                {mod.lessons.map((lesson: any) => (
                                  <div key={lesson.id} className="pl-4 space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-foreground">
                                      {getContentTypeIcon(lesson.content_type)}
                                      <span>{lesson.title}</span>
                                      <Badge variant="outline" className="text-[9px] ml-auto">{lesson.content_type}</Badge>
                                    </div>
                                    {lesson.file_url && (
                                      <a
                                        href={lesson.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-primary hover:underline pl-5"
                                      >
                                        <ExternalLink className="w-3 h-3" /> Ver arquivo
                                      </a>
                                    )}
                                    {lesson.materials && lesson.materials.length > 0 && (
                                      <div className="pl-5 space-y-0.5">
                                        {lesson.materials.map((mat: any) => (
                                          <div key={mat.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <File className="w-3 h-3" />
                                            <span>{mat.title}</span>
                                            {mat.file_url && (
                                              <a href={mat.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-auto">
                                                <ExternalLink className="w-3 h-3" />
                                              </a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nenhum curso/entregável vinculado a este produto</p>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex items-center gap-3 pb-4">
                  {(detailProduct.moderation_status === "pending_review" || detailProduct.moderation_status === "rejected") && (
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApprove(detailProduct)}
                      disabled={processing === detailProduct.id}
                    >
                      {processing === detailProduct.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                      Aprovar Produto
                    </Button>
                  )}
                  {(detailProduct.moderation_status === "pending_review" || detailProduct.moderation_status === "approved") && (
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => { setDetailOpen(false); openRejectDialog(detailProduct); }}
                      disabled={processing === detailProduct.id}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Reprovar Produto
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              Reprovar Produto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Você está reprovando o produto <strong className="text-foreground">"{selectedProduct?.name}"</strong>.
              Informe o motivo para o produtor.
            </p>
            <Textarea
              placeholder="Ex: O produto não atende às diretrizes da plataforma. Por favor, revise a descrição e imagem."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px] resize-y"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || processing === selectedProduct?.id}
            >
              {processing === selectedProduct?.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductReview;
