// @ts-nocheck
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Upload, Loader2, X, Link as LinkIcon, ExternalLink, Settings2, Trash2, MoreVertical, Plus, CheckCircle, Shuffle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import OrderBumpDialog from "@/components/admin/OrderBumpDialog";
import UpsellOfferDialog from "@/components/admin/UpsellOfferDialog";

interface PixelEntry {
  id?: string;
  platform: string;
  pixel_id: string;
  domain: string;
  fire_on_pix: boolean;
  fire_on_boleto: boolean;
  capi_token: string;
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const PUBLISHED_URL = "https://ck.panttera.com.br";

const VariantMetricsCard = ({ co, productId, currency, metrics, isLeader, totalVisits }) => {
  const chargebackRate = metrics.sales > 0 ? (metrics.chargebacks / (metrics.sales + metrics.chargebacks)) * 100 : 0;

  const conversion = metrics.visits > 0 ? (metrics.sales / metrics.visits) * 100 : 0;
  const expectedTraffic = totalVisits > 0 ? (metrics.visits / totalVisits) * 100 : 0;
  const targetTraffic = co.traffic_weight || 50;

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      co.is_default ? 'border-primary/50 bg-primary/5' : 
      isLeader ? 'border-green-500/50 bg-green-500/5 shadow-sm' :
      'border-border bg-card'
    } space-y-3 relative overflow-hidden`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{co.name}</p>
            {isLeader && (
              <span className="text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                Líder 🏆
              </span>
            )}
          </div>
          {metrics.visits < 100 ? (
            <p className="text-[10px] text-amber-500 font-medium mt-1">
              Aguardando dados ({metrics.visits}/100 visitas)
            </p>
          ) : (
            <p className="text-lg font-bold text-foreground mt-0.5">
              {conversion.toFixed(1)}% <span className="text-[10px] font-medium text-muted-foreground ml-1">conversão</span>
            </p>
          )}
        </div>
        {co.is_default && (
          <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded uppercase">Padrão</span>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
        <div>
          <p className="text-[9px] text-muted-foreground uppercase font-semibold">Visitas</p>
          <p className="text-sm font-semibold">{metrics.visits}</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground uppercase font-semibold">Vendas</p>
          <p className="text-sm font-semibold">{metrics.sales}</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground uppercase font-semibold">Chargebacks</p>
          <p className={`text-sm font-semibold ${metrics.chargebacks > 0 ? 'text-red-500' : ''}`}>{metrics.chargebacks}</p>
        </div>
      </div>

      
      <div className="pt-1 flex justify-between items-end">
        <div>
          <p className="text-[9px] text-muted-foreground uppercase font-semibold">Receita</p>
          <p className="text-sm font-bold text-primary">
            {currency === "USD" ? "$" : "R$"} {metrics.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[8px] text-muted-foreground uppercase font-medium">Split (Exp/Real)</p>
          <p className="text-[10px] font-bold">
            {targetTraffic}% / {expectedTraffic.toFixed(0)}%
          </p>
        </div>
      </div>
    </div>
  );
};
const getPublicUrl = () => "https://ck.panttera.com.br";

const tabStyle =
  "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-1 text-sm";

const ProductEdit = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = productId === "new";
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track original price+name to avoid unnecessary Stripe syncs (e.g. image-only saves)
  const stripeLastSyncedRef = useRef<{ name: string; price: string } | null>(null);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseLinkMode, setCourseLinkMode] = useState<"existing" | "new">("existing");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [linkingCourse, setLinkingCourse] = useState(false);
  const [pixels, setPixels] = useState<PixelEntry[]>([]);
  const [activePixelPlatform, setActivePixelPlatform] = useState("Facebook");
  const [savingPixels, setSavingPixels] = useState(false);
  const [userDomains, setUserDomains] = useState<{ hostname: string }[]>([]);
  const [showBumpDialog, setShowBumpDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("0.00");
  const [planFrequency, setPlanFrequency] = useState("monthly");
  const [planRenewal, setPlanRenewal] = useState<"until_cancel" | "fixed">("until_cancel");
  const [planDifferentFirst, setPlanDifferentFirst] = useState(false);
  const [showNewCheckoutDialog, setShowNewCheckoutDialog] = useState(false);
  const [newCheckoutName, setNewCheckoutName] = useState("");
  const [newCheckoutPrice, setNewCheckoutPrice] = useState("");
  const [newCheckoutDefault, setNewCheckoutDefault] = useState(false);
  const [newCheckoutWeight, setNewCheckoutWeight] = useState(50);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [editingCheckout, setEditingCheckout] = useState<any>(null);
  const [editCheckoutName, setEditCheckoutName] = useState("");
  const [editCheckoutPrice, setEditCheckoutPrice] = useState("");
  const [editCheckoutWeight, setEditCheckoutWeight] = useState(50);
  const [savingCheckoutEdit, setSavingCheckoutEdit] = useState(false);
  const [checkouts, setCheckouts] = useState<any[]>([]);
  const [variantStats, setVariantStats] = useState<Record<string, { visits: number; sales: number; revenue: number; chargebacks: number }>>({});
  const [testStartDate, setTestStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [orderBumps, setOrderBumps] = useState<any[]>([]);
  const [upsellOffers, setUpsellOffers] = useState<any[]>([]);
  const [showUpsellDialog, setShowUpsellDialog] = useState(false);
  const [moderationStatus, setModerationStatus] = useState<string>("approved");
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const CATEGORIES = [
    "Saúde e Esportes", "Finanças e Investimentos", "Relacionamentos", "Negócios e Carreira",
    "Espiritualidade", "Sexualidade", "Entretenimento", "Culinária e Gastronomia", "Idiomas",
    "Direito", "Apps & Software", "Literatura", "Casa e Construção", "Desenvolvimento Pessoal",
    "Moda e Beleza", "Animais e Plantas", "Educacional", "Hobbies", "Internet", "Outros",
  ];

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    original_price: "",
    active: true,
    image_url: "",
    sales_page_url: "",
    is_subscription: false,
    billing_cycle: "monthly",
    show_coupon: true,
    delivery_method: "panttera" as "panttera" | "appsell" | "email",
    currency: "BRL" as "BRL" | "USD",
    payment_settings: {
      payment_method: "all",
      max_installments: 12,
      boleto_days: 2,
      two_cards: false,
      card_pix: false,
      smart_installments: false,
      repeat_email: true,
      collect_address: false,
      collect_instagram: false,
      currency_conversion: false,
      statement_descriptor: "",
    },
  });

  // Load pixels for this product
  const loadPixels = useCallback(async () => {
    if (isNew || !productId) return;
    const { data } = await supabase
      .from("product_pixels")
      .select("*")
      .eq("product_id", productId);
    if (data) {
      setPixels(data.map((p: any) => ({
        id: p.id,
        platform: p.platform,
        pixel_id: p.pixel_id,
        domain: p.domain || "app.panttera.com.br",
        fire_on_pix: p.fire_on_pix,
        fire_on_boleto: p.fire_on_boleto,
        capi_token: p.capi_token || "",
      })));
    }
  }, [isNew, productId]);

  const loadOrderBumps = useCallback(async () => {
    if (isNew || !productId) return;
    const { data } = await supabase
      .from("order_bumps")
      .select("*, bump_product:products!order_bumps_bump_product_id_fkey(name, price, image_url)")
      .eq("product_id", productId)
      .order("sort_order");
    if (data) setOrderBumps(data);
  }, [isNew, productId]);

  const loadUpsellOffers = useCallback(async () => {
    if (isNew || !productId) return;
    const { data } = await supabase
      .from("upsell_offers" as any)
      .select("*, upsell_product:products!upsell_offers_upsell_product_id_fkey(name, price, image_url)")
      .eq("product_id", productId)
      .order("sort_order");
    if (data) setUpsellOffers(data);
  }, [isNew, productId]);

  const loadCheckouts = useCallback(async () => {
    if (isNew || !productId) return;
    const { data, error } = await supabase
      .from("checkout_builder_configs")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar checkouts:", error);
      toast.error("Erro ao carregar checkouts");
      return;
    }

    setCheckouts(data || []);
    if (data && data.length > 0 && data[0].test_started_at) {
      setTestStartDate(new Date(data[0].test_started_at).toISOString().split('T')[0]);
    }
  }, [isNew, productId]);

  const loadVariantMetrics = useCallback(async () => {
    if (isNew || !productId) return;
    
    try {
      const [visitsRes, salesRes] = await Promise.all([
        supabase.from("pixel_events")
          .select("metadata")
          .eq("product_id", productId)
          .eq("event_name", "ViewContent")
          .eq("is_bot", false)
          .gte("created_at", testStartDate),
        supabase.from("orders")
          .select("status, amount, metadata")
          .eq("product_id", productId)
          .in("status", ["paid", "approved", "confirmed", "chargeback", "chargedback"])

          .gte("created_at", testStartDate)
      ]);

      const stats: Record<string, { visits: number; sales: number; revenue: number; chargebacks: number }> = {};
      
      // Initialize stats for each checkout
      checkouts.forEach(co => {
        stats[co.id] = { visits: 0, sales: 0, revenue: 0, chargebacks: 0 };
      });


      visitsRes.data?.forEach((evt: any) => {
        const configId = evt.metadata?.config_id;
        if (configId && stats[configId]) {
          stats[configId].visits++;
        }
      });

      salesRes.data?.forEach((order: any) => {
        const configId = order.metadata?.config_id;
        if (configId && stats[configId]) {
          if (["paid", "approved", "confirmed"].includes(order.status)) {
            stats[configId].sales++;
            stats[configId].revenue += Number(order.amount);
          } else if (["chargeback", "chargedback"].includes(order.status)) {
            stats[configId].chargebacks++;
          }
        }
      });


      setVariantStats(stats);
    } catch (err) {
      console.error("Error loading metrics:", err);
    }
  }, [productId, isNew, checkouts, testStartDate]);

  useEffect(() => {
    if (!isNew && productId && checkouts.length > 0) {
      loadVariantMetrics();
      const interval = setInterval(loadVariantMetrics, 60000);
      return () => clearInterval(interval);
    }
  }, [productId, isNew, checkouts.length, testStartDate]);

  const declareWinner = async (winner: any) => {
    if (!confirm(`Isso vai definir "${winner.name}" como padrão e pausar o split de tráfego. Confirmar?`)) return;
    
    try {
      // 1. Remover is_default de todos do produto e desativar split
      const { error: resetError } = await supabase.from("checkout_builder_configs")
        .update({ 
          is_default: false,
          is_split_active: false
        })
        .eq("product_id", productId);
      
      if (resetError) throw resetError;

      // 2. Setar is_default no vencedor
      const { error: winnerError } = await supabase.from("checkout_builder_configs")
        .update({ is_default: true })
        .eq("id", winner.id);

      if (winnerError) {
        // Tentativa de rollback manual se o segundo falhar
        toast.error("Erro ao definir vencedor. O split foi pausado, mas verifique o checkout padrão.");
        console.error("Winner error:", winnerError);
      } else {
        toast.success(`Teste encerrado! "${winner.name}" agora é o checkout padrão.`);
      }
      
      loadCheckouts();
    } catch (err: any) {
      toast.error("Erro ao declarar vencedor: " + err.message);
      loadCheckouts();
    }
  };

  const openNewCheckoutDialog = () => {
    setNewCheckoutName("");
    setNewCheckoutPrice("");
    setNewCheckoutDefault(false);

    // Evita conflito de evento que pode fechar o dialog no mesmo clique
    window.setTimeout(() => setShowNewCheckoutDialog(true), 0);
  };

  const createCheckoutConfig = async () => {
    if (!productId || isNew) {
      toast.error("Salve o produto primeiro");
      return;
    }

    const checkoutName = newCheckoutName.trim();
    if (!checkoutName) {
      toast.error("Informe o nome do checkout");
      return;
    }

    setCreatingCheckout(true);
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      if (newCheckoutDefault) {
        const { error: unsetDefaultError } = await supabase
          .from("checkout_builder_configs")
          .update({ is_default: false })
          .eq("product_id", productId)
          .eq("user_id", authUser.id);

        if (unsetDefaultError) throw unsetDefaultError;
      }

      const parsedPrice = newCheckoutPrice.trim()
        ? parseFloat(newCheckoutPrice.replace(",", "."))
        : null;

      const { error } = await supabase.from("checkout_builder_configs").insert({
        product_id: productId,
        name: checkoutName,
        is_default: newCheckoutDefault,
        user_id: authUser.id,
        price: parsedPrice,
        traffic_weight: newCheckoutWeight,
      } as any);

      if (error) throw error;

      await loadCheckouts();
      toast.success("Checkout criado!");
      setShowNewCheckoutDialog(false);
      setNewCheckoutName("");
      setNewCheckoutPrice("");
      setNewCheckoutDefault(false);
    } catch (err: any) {
      console.error("Erro ao criar checkout:", err);
      toast.error(err?.message || "Erro ao criar checkout");
    } finally {
      setCreatingCheckout(false);
    }
  };

  useEffect(() => {
    // Load courses owned by this user (or all if super admin context not needed here)
    const loadCoursesAndLink = async () => {
      const { data: allCourses } = await supabase.from("courses").select("id, title, product_id");
      setCourses(allCourses || []);

      if (!isNew && productId) {
        // Check both legacy (courses.product_id) and new (course_products) links
        const legacy = allCourses?.find((c: any) => c.product_id === productId);
        if (legacy) {
          setSelectedCourseId(legacy.id);
        } else {
          const { data: link } = await supabase
            .from("course_products" as any)
            .select("course_id")
            .eq("product_id", productId)
            .maybeSingle();
          if ((link as any)?.course_id) setSelectedCourseId((link as any).course_id);
        }
      }
    };
    loadCoursesAndLink();

    // Load user's active custom domains
    if (user) {
      supabase
        .from("custom_domains" as any)
        .select("hostname")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .then(({ data }: any) => {
          if (data) setUserDomains(data);
        });
    }



    if (!isNew && productId) {
      supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            toast.error("Produto não encontrado");
            navigate("/admin/products");
            return;
          }
          stripeLastSyncedRef.current = { name: data.name, price: String(data.price) };
          setForm({
            name: data.name,
            description: data.description || "",
            category: "",
            price: String(data.price),
            original_price: data.original_price ? String(data.original_price) : "",
            active: data.active,
            image_url: data.image_url || "",
            sales_page_url: "",
            is_subscription: (data as any).is_subscription || false,
            billing_cycle: (data as any).billing_cycle || "monthly",
            show_coupon: (data as any).show_coupon !== false,
            delivery_method: (data as any).delivery_method || "panttera",
            currency: (data as any).currency || "BRL",
            payment_settings: {
              payment_method: "all",
              max_installments: 12,
              boleto_days: 2,
              two_cards: false,
              card_pix: false,
              smart_installments: false,
              repeat_email: true,
              collect_address: false,
              collect_instagram: false,
              currency_conversion: false,
              statement_descriptor: "",
              ...((data as any).payment_settings || {}),
            },
          });
          setModerationStatus((data as any).moderation_status || "approved");
          setRejectionReason((data as any).rejection_reason || "");
          setLoading(false);
        });
      loadPixels();
      loadOrderBumps();
      loadUpsellOffers();
      loadCheckouts();
    }
  }, [productId]);

  const addPixel = () => {
    if (pixels.length >= 50) { toast.error("Máximo de 50 pixels"); return; }
    setPixels((prev) => [...prev, { platform: activePixelPlatform.toLowerCase(), pixel_id: "", domain: "app.panttera.com.br", fire_on_pix: false, fire_on_boleto: false, capi_token: "" }]);
  };

  const updatePixel = (index: number, field: keyof PixelEntry, value: any) => {
    setPixels((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const removePixel = async (index: number) => {
    const px = pixels[index];
    if (px.id) {
      await supabase.from("product_pixels").delete().eq("id", px.id);
    }
    setPixels((prev) => prev.filter((_, i) => i !== index));
    toast.success("Pixel removido");
  };

  const savePixels = async () => {
    if (isNew || !productId) { toast.error("Salve o produto primeiro"); return; }
    setSavingPixels(true);
    try {
      // Delete existing
      await supabase.from("product_pixels").delete().eq("product_id", productId);
      // Insert all
      const validPixels = pixels.filter((p) => p.pixel_id.trim());
      let insertedRows: Array<{ id: string; capi_token: string | null }> = [];
      if (validPixels.length > 0) {
        const { data: inserted, error } = await supabase
          .from("product_pixels")
          .insert(
            validPixels.map((p) => ({
              product_id: productId,
              platform: p.platform,
              pixel_id: p.pixel_id.trim(),
              fire_on_pix: p.fire_on_pix,
              fire_on_boleto: p.fire_on_boleto,
              capi_token: p.capi_token.trim() || null,
              domain: p.domain === "app.panttera.com.br" ? null : p.domain,
              user_id: user?.id,
            }))
          )
          .select("id, capi_token");
        if (error) throw error;
        insertedRows = inserted ?? [];
      }
      toast.success("Pixels salvos!");

      // Verificação imediata para cada pixel com token (em background)
      const tokensToCheck = insertedRows.filter((r) => r.capi_token);
      if (tokensToCheck.length > 0) {
        toast.info(`Verificando ${tokensToCheck.length} token(s)...`);
        Promise.all(
          tokensToCheck.map((r) =>
            supabase.functions.invoke("pixel-token-health", {
              body: { pixel_row_id: r.id },
            })
          )
        )
          .then(() => {
            toast.success("Verificação de tokens concluída");
            loadPixels();
          })
          .catch(() => {
            // silencioso — cron diário pega depois
          });
      }

      loadPixels();
    } catch (err) {
      toast.error("Erro ao salvar pixels");
    } finally {
      setSavingPixels(false);
    }
  };

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user?.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      toast.error("Erro ao fazer upload");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: urlData.publicUrl }));
    setUploading(false);
    toast.success("Imagem enviada!");
  }, [user]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadImage(file);
  }, [uploadImage]);

  const handleSave = async () => {
    if (!form.name || !form.price) {
      toast.error("Nome e preço são obrigatórios");
      return;
    }
    setSaving(true);
    const payload: any = {
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      original_price: form.original_price ? parseFloat(form.original_price) : null,
      active: form.active,
      image_url: form.image_url || null,
      is_subscription: form.is_subscription,
      billing_cycle: form.billing_cycle,
      show_coupon: form.show_coupon,
      delivery_method: form.delivery_method,
      currency: form.currency,
      payment_settings: form.payment_settings,
      updated_at: new Date().toISOString(),
    };

    let savedProductId = productId;

    if (isNew) {
      payload.user_id = user?.id;
      payload.moderation_status = "pending_review";
      const { data: inserted, error } = await supabase.from("products" as any).insert(payload).select("id").single();
      if (error) { toast.error("Erro ao criar produto"); setSaving(false); return; }
      savedProductId = (inserted as any)?.id;
      toast.success("Produto criado! Aguarde a aprovação para começar a vender.");
    } else {
      // If product was rejected, resubmit for review
      if (moderationStatus === "rejected") {
        payload.moderation_status = "pending_review";
        payload.rejection_reason = null;
      }
      const { error } = await supabase.from("products" as any).update(payload).eq("id", productId);
      if (error) { toast.error("Erro ao atualizar"); setSaving(false); return; }
      if (moderationStatus === "rejected") {
        setModerationStatus("pending_review");
        setRejectionReason("");
        toast.success("Produto reenviado para revisão!");
      } else {
        toast.success("Produto salvo!");
      }
    }

    // Auto-sync to Stripe only when price or name changed (not on image/description saves)
    const priceOrNameChanged =
      isNew ||
      stripeLastSyncedRef.current?.name !== form.name ||
      stripeLastSyncedRef.current?.price !== form.price;

    if (form.currency === "USD" && savedProductId && priceOrNameChanged) {
      try {
        const { error: syncError } = await supabase.functions.invoke("sync-product-stripe", {
          body: { product_id: savedProductId },
        });
        if (syncError) {
          console.error("Stripe sync error:", syncError);
          toast.warning("Produto salvo. Configure o gateway Stripe para sincronizar o catálogo.");
        } else {
          stripeLastSyncedRef.current = { name: form.name, price: form.price };
          toast.success("Produto sincronizado com Stripe ✓");
        }
      } catch (e) {
        console.error("Stripe sync exception:", e);
      }
    }

    if (isNew) navigate("/admin/products");
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    await supabase.from("products").delete().eq("id", productId);
    toast.success("Produto excluído");
    navigate("/admin/products");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const defaultCheckout = checkouts.find((c: any) => c.is_default) || checkouts[0] || null;
  const activeCustomDomain = userDomains.length > 0 ? userDomains[0].hostname : null;
  const checkoutBaseUrl = activeCustomDomain ? `https://${activeCustomDomain}` : getPublicUrl();
  const checkoutLink = isNew ? "" : `${checkoutBaseUrl}/checkout/${productId}`;

  return (
    <div className="space-y-0 -m-6">
      {/* Green top bar */}
      <div className="h-2 bg-primary w-full" />

      <div className="px-6 pt-6 pb-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/admin/products")} className="text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-foreground">
              {isNew ? "Criar produto" : "Editar produto"}
            </h1>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar produto
          </Button>
        </div>

        {/* Moderation status banner */}
        {!isNew && moderationStatus === "pending_review" && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <span className="text-yellow-400 text-sm font-medium">⏳ Este produto está em revisão. Os links de checkout ficarão ativos após aprovação.</span>
          </div>
        )}
        {!isNew && moderationStatus === "rejected" && (
          <div className="space-y-1 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="text-red-400 text-sm font-medium">❌ Este produto foi reprovado.</span>
            {rejectionReason && <p className="text-red-300/80 text-xs">Motivo: {rejectionReason}</p>}
            <p className="text-red-300/60 text-[11px]">Edite o produto e salve para reenviar à revisão.</p>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="general">
          <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 gap-0 w-full justify-start overflow-x-auto">
            <TabsTrigger value="general" className={tabStyle}>Geral</TabsTrigger>
            <TabsTrigger value="members" className={tabStyle}>Área de membros</TabsTrigger>
            <TabsTrigger value="config" className={tabStyle}>Configurações</TabsTrigger>
            <TabsTrigger value="checkout" className={tabStyle}>Checkout</TabsTrigger>
            <TabsTrigger value="links" className={tabStyle}>Links</TabsTrigger>
          </TabsList>

          {/* Geral */}
          <TabsContent value="general" className="mt-8">
            <div className="space-y-10">
              {/* Produto section */}
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4">
                  <h2 className="text-base font-semibold text-foreground">Produto</h2>
                  <p className="text-sm text-primary mt-1">
                    Você pode cadastrar o produto e já começar a vender.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    A imagem do produto será exibida na Área de membros e no seu programa de afiliados.
                  </p>
                </div>
                <div className="lg:col-span-8">
                  <div className="border border-border rounded-lg p-6 bg-card space-y-5">
                    <div className="space-y-1.5">
                      <Label>Nome do produto</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Curso Completo de Marketing" />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Descrição</Label>
                      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Descreva seu produto..." />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Categoria</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Imagem do produto</Label>
                      {form.image_url ? (
                        <div className="relative border border-border rounded-lg overflow-hidden">
                          <img src={form.image_url} alt="Produto" className="w-full h-48 object-cover" />
                          <button
                            onClick={() => setForm({ ...form, image_url: "" })}
                            className="absolute top-2 right-2 bg-card/80 backdrop-blur-sm rounded-full p-1.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/50"
                          }`}
                        >
                          {uploading ? (
                            <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
                          ) : (
                            <>
                              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                              <p className="text-sm text-muted-foreground">
                                Arraste aqui ou{" "}
                                <span className="text-primary underline">selecione do computador</span>
                              </p>
                            </>
                          )}
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
                      />
                      <div className="bg-checkout-badge/15 text-checkout-badge rounded-md px-3 py-2 text-xs flex items-center gap-1.5 mt-2">
                        <span>★</span> Tamanho recomendado: 800x250 pixels
                      </div>
                    </div>

                    {/* Sales page */}
                    <div className="space-y-1.5">
                      <Label>Página de vendas</Label>
                      <div className="flex items-center gap-2 border border-input rounded-md px-3 py-2 bg-card">
                        <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <input
                          value={form.sales_page_url}
                          onChange={(e) => setForm({ ...form, sales_page_url: e.target.value })}
                          className="flex-1 text-sm bg-transparent outline-none"
                          placeholder="https://www.instagram.com/..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preços section */}
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4">
                  <h2 className="text-base font-semibold text-foreground">Preços</h2>
                </div>
                <div className="lg:col-span-8">
                  <div className="border border-border rounded-lg p-6 bg-card space-y-4">
                    <div className="space-y-1.5">
                      <Label>Moeda</Label>
                      <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as "BRL" | "USD" })}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BRL">🇧🇷 BRL — Real Brasileiro</SelectItem>
                          <SelectItem value="USD">🇺🇸 USD — Dólar Americano (Stripe)</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.currency === "USD" && (
                        <p className="text-xs text-muted-foreground">Produtos em USD serão processados via Stripe automaticamente.</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Preço</Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md">{form.currency === "USD" ? "$" : "R$"}</span>
                        <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-l-none" placeholder="0.00" />
                        <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-l-0 border-input rounded-r-md">{form.currency}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Preço original (riscado)</Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md">{form.currency === "USD" ? "$" : "R$"}</span>
                        <Input type="number" step="0.01" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} className="rounded-l-none" placeholder="0,00" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                      <Label>Produto ativo</Label>
                    </div>

                  </div>
                </div>
              </div>

              {/* Planos de assinatura section - only for subscription products */}
              {form.is_subscription && (
                <div className="grid lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-4">
                    <h2 className="text-base font-semibold text-foreground">Planos de assinatura</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      <a href="#" className="text-primary hover:underline">Aprenda mais sobre os planos</a>
                    </p>
                  </div>
                  <div className="lg:col-span-8">
                    <div className="border border-border rounded-lg bg-card">
                      <div className="flex items-center justify-between p-4 border-b border-border">
                        <h3 className="text-sm font-semibold text-foreground">Planos de assinatura</h3>
                        <Button size="sm" onClick={() => setShowPlanDialog(true)} className="gap-1.5">
                          <Plus className="w-3.5 h-3.5" /> Adicionar plano
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Nome</TableHead>
                            <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Preço</TableHead>
                            <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Primeira cobrança</TableHead>
                            <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Frequência</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Show current plan based on product price/cycle */}
                          {parseFloat(form.price) > 0 ? (
                            <TableRow>
                              <TableCell className="text-sm">{form.name || "Plano padrão"}</TableCell>
                              <TableCell className="text-sm">{form.currency === "USD" ? "$" : "R$"} {parseFloat(form.price).toFixed(2).replace(".", form.currency === "USD" ? "." : ",")}</TableCell>
                              <TableCell className="text-sm">{form.currency === "USD" ? "$" : "R$"} {parseFloat(form.price).toFixed(2).replace(".", form.currency === "USD" ? "." : ",")}</TableCell>
                              <TableCell className="text-sm capitalize">
                                {{
                                  weekly: "Semanal",
                                  biweekly: "Quinzenal",
                                  monthly: "Mensal",
                                  quarterly: "Trimestral",
                                  semiannually: "Semestral",
                                  yearly: "Anual",
                                }[form.billing_cycle] || "Mensal"}
                              </TableCell>
                            </TableRow>
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                                Por favor crie um plano para configurar os preços
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom actions */}
              {!isNew && (
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-3">
                    <Button variant="destructive" size="sm" onClick={handleDelete}>
                      Excluir produto
                    </Button>
                    {form.is_subscription && (
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5">
                        Cancelar assinaturas
                      </Button>
                    )}
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Salvar produto
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Área de membros */}
          <TabsContent value="members" className="mt-8">
            <div className="space-y-10">
              {/* Método de Entrega */}
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4">
                  <h2 className="text-base font-semibold text-foreground">Método de Entrega</h2>
                  <p className="text-sm text-primary mt-1">
                    Escolha como o conteúdo será entregue ao comprador após a confirmação do pagamento.
                  </p>
                </div>
                <div className="lg:col-span-8">
                  <div className="border border-border rounded-lg p-6 bg-card space-y-4">
                    <RadioGroup
                      value={form.delivery_method}
                      onValueChange={(v: "panttera" | "appsell" | "email") => setForm({ ...form, delivery_method: v })}
                      className="space-y-3"
                    >
                      <label className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all ${form.delivery_method === "panttera" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                        <RadioGroupItem value="panttera" className="mt-0.5" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🏠</span>
                            <span className="font-semibold text-sm text-foreground">Área de Membros Panttera</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            O comprador recebe acesso automático à área de membros interna. Ideal para cursos hospedados na Panttera.
                          </p>
                        </div>
                      </label>

                      <label className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all ${form.delivery_method === "appsell" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                        <RadioGroupItem value="appsell" className="mt-0.5" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🔗</span>
                            <span className="font-semibold text-sm text-foreground">Plataforma Externa (AppSell)</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            O evento de pagamento é enviado via API para a AppSell ou outra plataforma externa configurada em Integrações.
                          </p>
                        </div>
                      </label>

                    </RadioGroup>

                    {form.delivery_method === "appsell" && (
                      <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2">
                        Configure o link de acesso do AppSell em{" "}
                        <a href="/admin/integrations" className="underline font-medium">
                          Integrações → AppSell
                        </a>
                        . Sem isso, clientes não terão botão de acesso após a compra.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Área de membros select — only visible if panttera */}
              {form.delivery_method === "panttera" && (
                <div className="grid lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-12">
                    {form.delivery_method === 'panttera' && !selectedCourseId && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm mb-6">
                        ⚠️ Nenhum curso vinculado. Compradores não receberão acesso até você vincular um curso a este produto.
                      </div>
                    )}
                  </div>
                  <div className="lg:col-span-4">
                    <h2 className="text-base font-semibold text-foreground">Área de Membros</h2>
                    <p className="text-sm text-primary mt-1">
                      Ao comprar esse produto, o aluno será automaticamente adicionado na área de membros selecionada.
                    </p>
                  </div>
                  <div className="lg:col-span-8">
                    <div className="border border-border rounded-lg p-6 bg-card space-y-4">
                      {/* Toggle: Existente vs Nova */}
                      <div className="flex gap-2 p-1 bg-muted rounded-lg">
                        <button
                          type="button"
                          onClick={() => setCourseLinkMode("existing")}
                          className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                            courseLinkMode === "existing" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Usar área existente
                        </button>
                        <button
                          type="button"
                          onClick={() => setCourseLinkMode("new")}
                          className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                            courseLinkMode === "new" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Criar nova área
                        </button>
                      </div>

                      {courseLinkMode === "existing" ? (
                        <div className="space-y-1.5">
                          <Label>Área de Membros</Label>
                          <div className="flex gap-2">
                            <Select value={selectedCourseId} onValueChange={(v) => setSelectedCourseId(v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione uma área de membros" /></SelectTrigger>
                              <SelectContent>
                                {courses.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              disabled={!selectedCourseId || !productId || isNew || linkingCourse}
                              onClick={async () => {
                                if (!selectedCourseId || !productId) return;
                                setLinkingCourse(true);
                                try {
                                  const { error } = await supabase
                                    .from("course_products" as any)
                                    .upsert(
                                      { course_id: selectedCourseId, product_id: productId },
                                      { onConflict: "course_id,product_id", ignoreDuplicates: true }
                                    );
                                  if (error) throw error;
                                  toast.success("Área vinculada! Os outros produtos continuam com acesso.");
                                } catch (err: any) {
                                  toast.error(err?.message || "Erro ao vincular área");
                                } finally {
                                  setLinkingCourse(false);
                                }
                              }}
                            >
                              {linkingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vincular"}
                            </Button>
                          </div>
                          {!selectedCourseId && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Selecione uma área para liberar acesso automaticamente após a compra. Outros produtos vinculados continuam funcionando normalmente.
                            </p>
                          )}
                          {selectedCourseId && (
                            <button
                              type="button"
                              onClick={() => navigate("/admin/courses")}
                              className="text-sm text-primary hover:underline flex items-center gap-1 mt-2"
                            >
                              Abrir editor da área de membros <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label>Nome da nova área de membros</Label>
                          <div className="flex gap-2">
                            <Input
                              value={newCourseTitle}
                              onChange={(e) => setNewCourseTitle(e.target.value)}
                              placeholder={form.name || "Ex.: Desafio 14 dias"}
                            />
                            <Button
                              type="button"
                              disabled={!newCourseTitle.trim() || !productId || isNew || linkingCourse || !user}
                              onClick={async () => {
                                if (!newCourseTitle.trim() || !productId || !user) return;
                                setLinkingCourse(true);
                                try {
                                  const { data: created, error } = await supabase
                                    .from("courses")
                                    .insert({ title: newCourseTitle.trim(), product_id: productId, user_id: user.id })
                                    .select("id, title, product_id")
                                    .single();
                                  if (error) throw error;
                                  setCourses((prev) => [...prev, { id: created.id, title: created.title }]);
                                  setSelectedCourseId(created.id);
                                  setNewCourseTitle("");
                                  setCourseLinkMode("existing");
                                  toast.success("Nova área criada e vinculada!");
                                } catch (err: any) {
                                  toast.error(err?.message || "Erro ao criar área");
                                } finally {
                                  setLinkingCourse(false);
                                }
                              }}
                            >
                              {linkingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Cria uma nova área de membros vazia já vinculada a este produto.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Controle de acesso */}
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4">
                  <h2 className="text-base font-semibold text-foreground">Controle de Acesso</h2>
                </div>
                <div className="lg:col-span-8">
                  <div className="border border-border rounded-lg overflow-hidden bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Oferta</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Valor</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Entrega</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {form.name ? (
                          <TableRow>
                            <TableCell className="text-sm text-foreground truncate max-w-[200px]">{form.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {form.price ? `${form.currency === "USD" ? "$" : "R$"} ${Number(form.price).toFixed(2).replace(".", form.currency === "USD" ? "." : ",")}` : "—"}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                                form.delivery_method === "panttera" ? "bg-primary/10 text-primary" :
                                form.delivery_method === "appsell" ? "bg-blue-500/10 text-blue-400" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {form.delivery_method === "panttera" ? "🏠 Panttera" :
                                 form.delivery_method === "appsell" ? "🔗 AppSell" :
                                 "📩 E-mail"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                              Salve o produto primeiro para configurar o acesso.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* Bottom actions */}
              {!isNew && (
                <div className="flex justify-between pt-4 border-t border-border">
                  <Button variant="destructive" size="sm" onClick={handleDelete}>Excluir produto</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Salvar produto
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Configurações */}
          <TabsContent value="config" className="mt-8">
            <div className="space-y-10">
              {/* Pagamento */}
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4">
                  <h2 className="text-base font-semibold text-foreground">{form.currency === "USD" ? "Payment" : "Pagamento"}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {form.currency === "USD"
                      ? "USD products are processed via Stripe Checkout. No local payment configuration needed."
                      : "Aprenda sobre as configurações de parcelamento no checkout"}
                  </p>
                </div>
                <div className="lg:col-span-8">
                  <div className="border border-border rounded-lg p-6 bg-card space-y-5">
                    {form.currency === "USD" ? (
                      <>
                        <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
                          <p className="text-sm font-medium text-foreground">💳 Stripe Checkout</p>
                          <p className="text-xs text-muted-foreground">
                            Payments for USD products are processed securely via Stripe. Customers will be redirected to Stripe's hosted checkout page with support for Credit Card, Apple Pay, and Google Pay.
                          </p>
                        </div>
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={form.show_coupon}
                              onCheckedChange={(v) => setForm((f) => ({ ...f, show_coupon: v }))}
                            />
                            <Label className="text-sm">Show discount coupon field on checkout</Label>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label>Método de pagamento</Label>
                          <Select value={form.payment_settings.payment_method} onValueChange={(v) => setForm((f) => ({ ...f, payment_settings: { ...f.payment_settings, payment_method: v } }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Cartão de crédito, boleto e Pix</SelectItem>
                              <SelectItem value="pix_only">Apenas Pix</SelectItem>
                              <SelectItem value="card_pix">Cartão de crédito e Pix</SelectItem>
                              <SelectItem value="card_only">Apenas Cartão de crédito</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Descrição na fatura do cartão</Label>
                          <div className="flex items-center">
                            <span className="inline-flex items-center px-3 text-xs text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md h-10 font-semibold">PANTTERA*</span>
                            <Input value={form.payment_settings.statement_descriptor} onChange={(e) => setForm((f) => ({ ...f, payment_settings: { ...f.payment_settings, statement_descriptor: e.target.value } }))} placeholder="MEUPRODUTO" className="rounded-l-none uppercase" />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Parcelamento</Label>
                          <Select value={String(form.payment_settings.max_installments)} onValueChange={(v) => setForm((f) => ({ ...f, payment_settings: { ...f.payment_settings, max_installments: Number(v) } }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[1,2,3,4,5,6,7,8,9,10,11,12,15,18,21].map((n) => (
                                <SelectItem key={n} value={String(n)}>Até {n}x</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Validade do boleto</Label>
                          <div className="flex items-center gap-2">
                            <Input type="number" value={form.payment_settings.boleto_days} onChange={(e) => setForm((f) => ({ ...f, payment_settings: { ...f.payment_settings, boleto_days: Number(e.target.value) } }))} className="w-20" />
                            <span className="text-sm text-muted-foreground">dias corridos</span>
                          </div>
                        </div>

                        <div className="space-y-3 pt-2">
                          <div className="flex items-center gap-3">
                            <Switch checked={form.payment_settings.two_cards} onCheckedChange={(v) => setForm((f) => ({ ...f, payment_settings: { ...f.payment_settings, two_cards: v } }))} />
                            <Label className="text-sm">Habilitar pagamento com 2 cartões</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch checked={form.payment_settings.card_pix} onCheckedChange={(v) => setForm((f) => ({ ...f, payment_settings: { ...f.payment_settings, card_pix: v } }))} />
                            <Label className="text-sm">Habilitar pagamento com Cartão + Pix</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch checked={form.payment_settings.smart_installments} onCheckedChange={(v) => setForm((f) => ({ ...f, payment_settings: { ...f.payment_settings, smart_installments: v } }))} />
                            <Label className="text-sm">Habilitar parcelamento inteligente</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch checked={form.payment_settings.repeat_email} onCheckedChange={(v) => setForm((f) => ({ ...f, payment_settings: { ...f.payment_settings, repeat_email: v } }))} />
                            <Label className="text-sm">Pedir para o comprador repetir o e-mail</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch checked={form.payment_settings.collect_address} onCheckedChange={(v) => setForm((f) => ({ ...f, payment_settings: { ...f.payment_settings, collect_address: v } }))} />
                            <Label className="text-sm">Coletar o endereço do comprador</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch checked={form.payment_settings.collect_instagram} onCheckedChange={(v) => setForm((f) => ({ ...f, payment_settings: { ...f.payment_settings, collect_instagram: v } }))} />
                            <Label className="text-sm">Coletar o Instagram do comprador</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch checked={form.payment_settings.currency_conversion} onCheckedChange={(v) => setForm((f) => ({ ...f, payment_settings: { ...f.payment_settings, currency_conversion: v } }))} />
                            <Label className="text-sm">Conversão automática de moedas (recomendado)</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={form.show_coupon}
                              onCheckedChange={(v) => setForm((f) => ({ ...f, show_coupon: v }))}
                            />
                            <Label className="text-sm">Exibir campo de cupom de desconto no checkout</Label>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
               </div>

              {/* Upsell One-Click pós-compra */}
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4">
                  <h2 className="text-base font-semibold text-foreground">Upsell One-Click</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ofertas exibidas na página de sucesso após pagamento com cartão. O cliente compra com 1 clique sem redigitar os dados.
                  </p>
                </div>
                <div className="lg:col-span-8">
                  <div className="border border-border rounded-lg p-6 bg-card space-y-4">
                    {upsellOffers.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Produto</TableHead>
                            <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Desconto</TableHead>
                            <TableHead className="text-xs font-semibold uppercase text-muted-foreground w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {upsellOffers.map((uo: any) => (
                            <TableRow key={uo.id}>
                              <TableCell className="text-sm">
                                <div>
                                  <p className="font-medium text-foreground">{uo.title || uo.upsell_product?.name}</p>
                                  <p className="text-xs text-muted-foreground">{uo.description}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {uo.discount_percent > 0 ? `${uo.discount_percent}%` : "—"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={async () => {
                                    await supabase.from("upsell_offers").delete().eq("id", uo.id);
                                    loadUpsellOffers();
                                    toast.success("Upsell removido");
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum upsell configurado. Adicione um produto para oferecer após a compra.
                      </p>
                    )}
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowUpsellDialog(true)}>
                      <Plus className="w-4 h-4" /> Adicionar upsell
                    </Button>
                  </div>
                </div>
              </div>

              {showUpsellDialog && productId && (
                <UpsellOfferDialog
                  open={showUpsellDialog}
                  onClose={() => setShowUpsellDialog(false)}
                  productId={productId}
                  onSaved={loadUpsellOffers}
                />
              )}

              {/* Pixels de conversão */}
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4">
                  <h2 className="text-base font-semibold text-foreground">Pixels de conversão</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Aprenda sobre os <span className="text-primary underline cursor-pointer">pixels de conversão</span>
                  </p>
                </div>
                <div className="lg:col-span-8">
                  <div className="border border-border rounded-lg p-6 bg-card space-y-4">
                    {/* Custom domain status */}
                    {activePixelPlatform === "Facebook" && (
                      activeCustomDomain ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary">
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          Eventos enviados via <strong>{activeCustomDomain}</strong>
                        </div>
                      ) : (
                        <div className="px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                          Nenhum domínio customizado ativo. Configure em{" "}
                          <a href="/admin/domains" className="underline font-medium">Domínios</a>{" "}
                          para evitar a restrição do Meta em app.panttera.com.br.
                        </div>
                      )
                    )}
                    {/* Platform tabs */}
                    <div className="flex flex-wrap gap-2">
                      {["Facebook", "G Ads", "G Analytics", "Taboola", "Outbrain", "TikTok", "Pinterest", "Kwai"].map((px) => (
                        <button
                          key={px}
                          onClick={() => setActivePixelPlatform(px)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            activePixelPlatform === px
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                          }`}
                        >
                          {px}
                        </button>
                      ))}
                    </div>

                    {/* Existing pixels for active platform */}
                    {pixels.filter((p) => p.platform === activePixelPlatform.toLowerCase()).length === 0 && (
                      <p className="text-sm text-muted-foreground py-2">
                        Nenhum pixel de {activePixelPlatform} cadastrado.
                      </p>
                    )}

                    {pixels.map((px, idx) => {
                      if (px.platform !== activePixelPlatform.toLowerCase()) return null;
                      return (
                        <div key={idx} className="space-y-3 border border-border rounded-lg p-4 bg-muted/20">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-1.5">
                              <Label>Pixel ID</Label>
                              <Input
                                value={px.pixel_id}
                                onChange={(e) => updatePixel(idx, "pixel_id", e.target.value)}
                                placeholder="Ex: 1234567890"
                              />
                            </div>
                            <div className="flex-1 space-y-1.5">
                              <Label>Domínio de Rastreamento</Label>
                              <Select 
                                value={px.domain || "app.panttera.com.br"} 
                                onValueChange={(v) => updatePixel(idx, "domain", v)}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Selecione um domínio" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="app.panttera.com.br">Padrão (app.panttera.com.br)</SelectItem>
                                  {userDomains.map((d) => (
                                    <SelectItem key={d.hostname} value={d.hostname}>
                                      {d.hostname}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <button onClick={() => removePixel(idx)} className="mt-6 text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          {px.platform === "facebook" && (
                            <div className="space-y-1.5">
                              <Label>
                                Token da API de Conversão (opcional){" "}
                                <a href="https://developers.facebook.com/docs/marketing-api/conversions-api/get-started" target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline">
                                  O que é isso?
                                </a>
                              </Label>
                              <Textarea
                                value={px.capi_token}
                                onChange={(e) => updatePixel(idx, "capi_token", e.target.value)}
                                placeholder="EAAxxxxxxxxx..."
                                rows={2}
                                className="font-mono text-xs"
                              />
                            </div>
                          )}
                          {form.currency !== "USD" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Switch checked={px.fire_on_pix} onCheckedChange={(v) => updatePixel(idx, "fire_on_pix", v)} />
                              <Label className="text-sm">Disparar evento "Purchase" ao gerar um pix?</Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <Switch checked={px.fire_on_boleto} onCheckedChange={(v) => updatePixel(idx, "fire_on_boleto", v)} />
                              <Label className="text-sm">Disparar evento "Purchase" ao gerar um boleto?</Label>
                            </div>
                          </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex items-center gap-3">
                      <Button size="sm" onClick={addPixel} className="gap-1">Adicionar outro</Button>
                      <span className="text-xs text-muted-foreground">
                        {pixels.filter((p) => p.platform === activePixelPlatform.toLowerCase()).length}/50
                      </span>
                    </div>

                    <div className="pt-2">
                      <Button onClick={savePixels} disabled={savingPixels} size="sm" variant="outline">
                        {savingPixels && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                        Salvar pixels
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cupons de desconto */}
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4">
                  <h2 className="text-base font-semibold text-foreground">Cupons de desconto</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Aprenda sobre os cupons de desconto
                  </p>
                </div>
                <div className="lg:col-span-8">
                  <div className="border border-border rounded-lg p-6 bg-card">
                    <div className="flex items-center gap-3">
                      <Switch />
                      <Label className="text-sm">Habilitar cupons de desconto</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order bump */}
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4">
                  <h2 className="text-base font-semibold text-foreground">Order bump</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Aprenda sobre os <span className="text-primary underline cursor-pointer">order bumps</span>
                  </p>
                </div>
                <div className="lg:col-span-8">
                  <div className="border border-border rounded-lg overflow-hidden bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Ordem</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Produto</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderBumps.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-sm text-primary py-6">
                              Não há nenhum order bump
                            </TableCell>
                          </TableRow>
                        ) : (
                          orderBumps.map((ob, idx) => (
                            <TableRow key={ob.id}>
                              <TableCell className="text-sm text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="text-sm text-foreground">
                                {ob.bump_product?.name || ob.title} — {form.currency === "USD" ? "$" : "R$"} {Number(ob.bump_product?.price || 0).toFixed(2).replace(".", form.currency === "USD" ? "." : ",")}
                              </TableCell>
                              <TableCell>
                                <button
                                  onClick={async () => {
                                    await supabase.from("order_bumps").delete().eq("id", ob.id);
                                    toast.success("Order bump removido");
                                    loadOrderBumps();
                                  }}
                                  className="text-destructive hover:text-destructive/80"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    <div className="px-6 pb-4">
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={orderBumps.length >= 5}
                        onClick={() => setShowBumpDialog(true)}
                      >
                        Adicionar order bump
                      </Button>
                      <span className="text-xs text-muted-foreground ml-2">{orderBumps.length}/5</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom actions */}
              {!isNew && (
                <div className="flex justify-between pt-4 border-t border-border">
                  <Button variant="destructive" size="sm" onClick={handleDelete}>Excluir produto</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Salvar produto
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Checkout */}
          <TabsContent value="checkout" className="mt-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative w-64">
                  <Input placeholder="Buscar..." className="pl-9 h-9 text-sm" />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <Button type="button" size="sm" variant="outline" className="text-sm relative z-10" onClick={openNewCheckoutDialog}>
                  Criar novo checkout
                </Button>
              </div>

              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Nome</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Oferta</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Link</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Dynamic checkouts from DB */}
                    {checkouts.map((co) => (
                      <TableRow key={co.id}>
                        <TableCell className="text-sm text-foreground">
                          <div className="flex items-center gap-2">
                            {co.name}
                            {co.is_default && (
                              <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Padrão</span>
                            )}
                            {co.is_split_active && (
                              <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Shuffle className="w-2.5 h-2.5" /> Split
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px] font-bold text-foreground">
                          {co.price != null 
                            ? `${form.currency === "USD" ? "$" : "R$"} ${Number(co.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                            : `${form.currency === "USD" ? "$" : "R$"} ${Number(form.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (padrão)`
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Input value={`${checkoutBaseUrl}/checkout/${productId}?config=${co.id}`} readOnly className="h-7 text-[10px] bg-muted/50 max-w-[180px]" />
                            <button onClick={() => { navigator.clipboard.writeText(`${checkoutBaseUrl}/checkout/${productId}?config=${co.id}`); toast.success("Link copiado!"); }} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                              <LinkIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded hover:bg-muted transition-colors">
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {!co.is_default && (
                                <DropdownMenuItem onClick={async () => {
                                  // 1. Remover is_default de todos do produto
                                  await supabase.from("checkout_builder_configs")
                                    .update({ is_default: false })
                                    .eq("product_id", productId);
                                  // 2. Setar is_default neste
                                  await supabase.from("checkout_builder_configs")
                                    .update({ is_default: true })
                                    .eq("id", co.id);
                                  toast.success(`"${co.name}" agora é o checkout padrão`);
                                  loadCheckouts();
                                }} className="gap-2 text-sm">
                                  <CheckCircle className="w-3.5 h-3.5" /> Definir como padrão
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={async () => {
                                await supabase.from("checkout_builder_configs")
                                  .update({ is_split_active: !co.is_split_active })
                                  .eq("id", co.id);
                                toast.success(co.is_split_active ? "Removido do split de tráfego" : "Incluído no split de tráfego");
                                loadCheckouts();
                              }} className="gap-2 text-sm">
                                <Shuffle className="w-3.5 h-3.5" /> {co.is_split_active ? "Remover do split" : "Incluir no split"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setEditingCheckout(co);
                                setEditCheckoutName(co.name);
                                setEditCheckoutPrice(co.price != null ? String(co.price).replace(".", ",") : "");
                                setEditCheckoutWeight(co.traffic_weight || 50);
                              }} className="gap-2 text-sm">
                                <Settings2 className="w-3.5 h-3.5" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/admin/products/${productId}/checkout-builder/${co.id}`)} className="gap-2 text-sm">
                                <ExternalLink className="w-3.5 h-3.5" /> Personalizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                await supabase.from("checkout_builder_configs").insert({
                                  product_id: productId!,
                                  name: co.name + " (cópia)",
                                  layout: co.layout || [],
                                  settings: co.settings || {},
                                  is_default: false,
                                  user_id: user?.id,
                                  price: co.price || null,
                                } as any);
                                toast.success("Checkout duplicado!");
                                loadCheckouts();
                              }} className="gap-2 text-sm">
                                <LinkIcon className="w-3.5 h-3.5" /> Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                if (co.is_default && checkouts.length > 1) {
                                  toast.error("Defina outro checkout como padrão antes de excluir este.");
                                  return;
                                }
                                if (!confirm(`Excluir "${co.name}"?`)) return;
                                await supabase.from("checkout_builder_configs").delete().eq("id", co.id);
                                toast.success("Checkout excluído!");
                                loadCheckouts();
                              }} className="gap-2 text-sm text-destructive focus:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!checkoutLink && checkouts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                          Salve o produto primeiro.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Analytics Comparativo por Variante */}
              {!isNew && checkouts.length > 0 && (
                <div className="space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Shuffle className="w-4 h-4 text-primary" /> Performance por Variante
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] px-2"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 7);
                            setTestStartDate(d.toISOString().split('T')[0]);
                          }}
                        >7d</Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] px-2"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 30);
                            setTestStartDate(d.toISOString().split('T')[0]);
                          }}
                        >30d</Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] px-2"
                          onClick={() => setTestStartDate(new Date().toISOString().split('T')[0])}
                        >Hoje</Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Medir desde:</Label>
                        <Input 
                          type="date" 
                          value={testStartDate} 
                          onChange={(e) => {
                            setTestStartDate(e.target.value);
                            // Also update test_started_at in DB for consistency
                            supabase.from("checkout_builder_configs")
                              .update({ test_started_at: e.target.value })
                              .eq("product_id", productId)
                              .then(() => {});
                          }}
                          className="h-8 text-xs w-32" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                      const totalVisits = Object.values(variantStats).reduce((sum, s) => sum + s.visits, 0);
                      const leader = checkouts
                        .filter(co => (variantStats[co.id]?.visits || 0) >= 100)
                        .sort((a, b) => {
                          const convA = (variantStats[a.id]?.sales || 0) / (variantStats[a.id]?.visits || 1);
                          const convB = (variantStats[b.id]?.sales || 0) / (variantStats[b.id]?.visits || 1);
                          return convB - convA;
                        })[0];

                      return checkouts.map((co) => (
                        <VariantMetricsCard 
                          key={co.id} 
                          co={co} 
                          productId={productId} 
                          currency={form.currency}
                          metrics={variantStats[co.id] || { visits: 0, sales: 0, revenue: 0 }}
                          isLeader={leader?.id === co.id}
                          totalVisits={totalVisits}
                        />
                      ));
                    })()}
                  </div>

                  {(() => {
                    const variantsWithData = checkouts.filter(co => (variantStats[co.id]?.visits || 0) >= 100);
                    const leader = variantsWithData.sort((a, b) => {
                      const convA = (variantStats[a.id]?.sales || 0) / (variantStats[a.id]?.visits || 1);
                      const convB = (variantStats[b.id]?.sales || 0) / (variantStats[b.id]?.visits || 1);
                      return convB - convA;
                    })[0];

                    if (variantsWithData.length >= 2 && leader) {
                      return (
                        <div className="pt-4 flex justify-center">
                          <Button 
                            variant="outline" 
                            className="border-green-500/50 text-green-600 hover:bg-green-500/10 gap-2"
                            onClick={() => declareWinner(leader)}
                          >
                            <CheckCircle className="w-4 h-4" />
                            Encerrar teste e declarar vencedor: {leader.name}
                          </Button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              <div className="flex items-center justify-center pt-8">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="text-primary">ℹ</span> Aprenda mais sobre o{" "}
                  <a href="#" className="text-primary underline">checkout builder</a>
                </p>
              </div>

              {!isNew && (
                <div className="flex justify-between pt-4 border-t border-border">
                  <Button variant="destructive" size="sm" onClick={handleDelete}>Excluir produto</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Salvar produto
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Links */}
          <TabsContent value="links" className="mt-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative w-64">
                  <Input placeholder="Buscar..." className="pl-9 h-9 text-sm" />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1 text-sm">
                        <MoreVertical className="w-3.5 h-3.5" /> Ações
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem className="text-sm">Exportar links</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" className="gap-1 text-sm">
                    + Adicionar link
                  </Button>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8">
                        <input type="checkbox" className="rounded border-border" />
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Nome do link</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">URL</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Tipo</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Preço</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isNew && checkoutLink ? (
                      <>
                        {form.sales_page_url && (
                          <TableRow>
                            <TableCell><input type="checkbox" className="rounded border-border" /></TableCell>
                            <TableCell className="text-sm font-medium text-foreground">Sales Page</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Input value={form.sales_page_url} readOnly className="h-8 text-xs bg-muted/50 max-w-[220px]" />
                                <button onClick={() => { navigator.clipboard.writeText(form.sales_page_url); toast.success("Link copiado!"); }} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500">Página</span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">—</TableCell>
                            <TableCell>
                              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-500">Ativo</span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-1 rounded hover:bg-muted transition-colors"><MoreVertical className="w-4 h-4 text-muted-foreground" /></button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(form.sales_page_url); toast.success("Link copiado!"); }} className="gap-2 text-sm"><LinkIcon className="w-3.5 h-3.5" /> Copiar link</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => window.open(form.sales_page_url, "_blank")} className="gap-2 text-sm"><ExternalLink className="w-3.5 h-3.5" /> Abrir</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell><input type="checkbox" className="rounded border-border" /></TableCell>
                          <TableCell className="text-sm font-medium text-foreground">{form.name || "Checkout"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Input value={checkoutLink} readOnly className="h-8 text-xs bg-muted/50 max-w-[220px]" />
                              <button onClick={() => { navigator.clipboard.writeText(checkoutLink); toast.success("Link copiado!"); }} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-500">Checkout</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {form.price ? `${form.currency === "USD" ? "$" : "R$"} ${Number(form.price).toFixed(2).replace(".", form.currency === "USD" ? "." : ",")}` : "—"}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${form.active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                              {form.active ? "Ativo" : "Inativo"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1 rounded hover:bg-muted transition-colors"><MoreVertical className="w-4 h-4 text-muted-foreground" /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(checkoutLink); toast.success("Link copiado!"); }} className="gap-2 text-sm"><LinkIcon className="w-3.5 h-3.5" /> Copiar link</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(checkoutLink, "_blank")} className="gap-2 text-sm"><ExternalLink className="w-3.5 h-3.5" /> Abrir</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/admin/products/${productId}/checkout-builder${defaultCheckout?.id ? `/${defaultCheckout.id}` : ""}`)} className="gap-2 text-sm"><Settings2 className="w-3.5 h-3.5" /> Personalizar</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                          Salve o produto primeiro para gerar os links.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Exibindo 1 de 1 página</span>
                <div className="flex items-center gap-1">
                  <button className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors">&lt;</button>
                  <button className="w-7 h-7 rounded border border-primary bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">1</button>
                  <button className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors">&gt;</button>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="text-primary">ℹ</span> Aprenda mais sobre os{" "}
                  <a href="#" className="text-primary underline">links</a>
                </p>
              </div>

              {!isNew && (
                <div className="flex justify-between pt-4 border-t border-border">
                  <Button variant="destructive" size="sm" onClick={handleDelete}>Excluir produto</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Salvar produto
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {!isNew && productId && (
        <OrderBumpDialog
          open={showBumpDialog}
          onClose={() => setShowBumpDialog(false)}
          productId={productId}
          onSaved={loadOrderBumps}
        />
      )}

      {/* Adicionar plano dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar plano</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={planName} onChange={(e) => setPlanName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Preço</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md">{form.currency === "USD" ? "$" : "R$"}</span>
                <Input type="number" step="0.01" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} className="rounded-l-none rounded-r-none" />
                <Select defaultValue="BRL">
                  <SelectTrigger className="w-24 rounded-l-none border-l-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Frequência</Label>
              <Select value={planFrequency} onValueChange={setPlanFrequency}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="semiannually">Semestral</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Renovação automática</Label>
              <RadioGroup value={planRenewal} onValueChange={(v) => setPlanRenewal(v as "until_cancel" | "fixed")}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="until_cancel" id="until_cancel" />
                  <Label htmlFor="until_cancel" className="font-normal cursor-pointer">Até o cliente cancelar</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed" className="font-normal cursor-pointer">Número fixo de cobranças</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={planDifferentFirst} onCheckedChange={setPlanDifferentFirst} />
              <Label className="font-normal">Preço diferente na primeira cobrança</Label>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!planPrice || parseFloat(planPrice) <= 0) {
                  toast.error("Informe um preço válido");
                  return;
                }
                setForm((f) => ({
                  ...f,
                  price: planPrice,
                  billing_cycle: planFrequency,
                  is_subscription: true,
                }));
                setShowPlanDialog(false);
                setPlanName("");
                setPlanPrice("0.00");
                setPlanFrequency("monthly");
                toast.success("Plano adicionado! Salve o produto para aplicar.");
              }}
            >
              Adicionar plano
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Criar novo checkout dialog */}
      <Dialog open={showNewCheckoutDialog} onOpenChange={setShowNewCheckoutDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar novo checkout</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={newCheckoutName} onChange={(e) => setNewCheckoutName(e.target.value)} autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label>Preço personalizado (opcional)</Label>
              <div className="flex items-center">
                <span className="inline-flex items-center px-3 text-xs text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md h-10 font-semibold">{form.currency === "USD" ? "$" : "R$"}</span>
                <Input
                  value={newCheckoutPrice}
                  onChange={(e) => setNewCheckoutPrice(e.target.value)}
                  placeholder={form.price ? Number(form.price).toFixed(2).replace(".", form.currency === "USD" ? "." : ",") : "0,00"}
                  className="rounded-l-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">Deixe vazio para usar o preço padrão do produto</p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center">
                <Label>Peso no split: <span className="text-primary font-bold">{newCheckoutWeight}%</span></Label>
              </div>
              <input
                type="range" min={1} max={100} step={1}
                value={newCheckoutWeight}
                onChange={(e) => setNewCheckoutWeight(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary border border-primary/20"
              />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Define a proporção de tráfego que este checkout receberá quando o split estiver ativo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={newCheckoutDefault} onCheckedChange={setNewCheckoutDefault} />
              <Label className="font-normal">Definir esse checkout como padrão</Label>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowNewCheckoutDialog(false)}>Cancelar</Button>
              <Button
                onClick={createCheckoutConfig}
                disabled={!newCheckoutName.trim() || creatingCheckout}
              >
                {creatingCheckout && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Criar novo checkout
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar checkout dialog */}
      <Dialog open={!!editingCheckout} onOpenChange={(open) => { if (!open) setEditingCheckout(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar checkout</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editCheckoutName} onChange={(e) => setEditCheckoutName(e.target.value)} autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label>Preço personalizado</Label>
              <div className="flex items-center">
                <span className="inline-flex items-center px-3 text-xs text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md h-10 font-semibold">{form.currency === "USD" ? "$" : "R$"}</span>
                <Input
                  value={editCheckoutPrice}
                  onChange={(e) => setEditCheckoutPrice(e.target.value)}
                  placeholder={form.price ? Number(form.price).toFixed(2).replace(".", form.currency === "USD" ? "." : ",") : "0,00"}
                  className="rounded-l-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">Deixe vazio para usar o preço padrão do produto</p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center">
                <Label>Peso no split: <span className="text-primary font-bold">{editCheckoutWeight}%</span></Label>
              </div>
              <input
                type="range" min={1} max={100} step={1}
                value={editCheckoutWeight}
                onChange={(e) => setEditCheckoutWeight(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary border border-primary/20"
              />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Ajuste a porcentagem de visitantes para esta variante.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditingCheckout(null)}>Cancelar</Button>
              <Button
                disabled={!editCheckoutName.trim() || savingCheckoutEdit}
                onClick={async () => {
                  setSavingCheckoutEdit(true);
                  try {
                    const parsedPrice = editCheckoutPrice.trim()
                      ? parseFloat(editCheckoutPrice.replace(",", "."))
                      : null;

                    const { error } = await supabase
                      .from("checkout_builder_configs")
                      .update({
                        name: editCheckoutName.trim(),
                        price: parsedPrice,
                        traffic_weight: editCheckoutWeight,
                      } as any)
                      .eq("id", editingCheckout.id);

                    if (error) throw error;
                    toast.success("Checkout atualizado!");
                    setEditingCheckout(null);
                    await loadCheckouts();
                  } catch (err: any) {
                    toast.error(err?.message || "Erro ao atualizar");
                  } finally {
                    setSavingCheckoutEdit(false);
                  }
                }}
              >
                {savingCheckoutEdit && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductEdit;
