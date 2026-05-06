import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import {
  User,
  LogOut,
  BookOpen,
  Loader2,
  LayoutDashboard,
  Search,
  PlayCircle,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PortalCourse {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  access_token?: string;
  source: "created" | "purchased";
}

const CustomerPortal = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [courses, setCourses] = useState<PortalCourse[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { user, loading: authLoading, isAdmin, isSuperAdmin, isCollaborator, signOut } = useAuth();

  // Token-based Supabase client (sends x-access-token header for RLS)
  const tokenClient = useMemo(() => {
    if (!token) return supabase;
    return createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      {
        global: { headers: { "x-access-token": token } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }, [token]);

  // MODE 1: Token-based (buyer accessing via link)
  // MODE 2: Authenticated admin/producer (preview their own courses + purchased)
  const isAuthMode = !token && !!user;

  useEffect(() => {
    if (authLoading) return;
    if (!token && !user) {
      navigate("/login?signup=true", { replace: true });
      return;
    }
    if (token) {
      loadTokenData();
    } else if (user) {
      loadAuthData();
    }
  }, [token, user, authLoading]);

  // Load data via access_token (buyer mode)
  const loadTokenData = async () => {
    try {
      const { data: accessData } = await tokenClient
        .from("member_access")
        .select("customer_id, course_id")
        .eq("access_token", token!)
        .limit(1)
        .maybeSingle();

      if (!accessData) {
        toast.error("Link inválido ou expirado");
        navigate("/login?signup=true", { replace: true });
        setLoading(false);
        return;
      }

      const { data: customerData } = await tokenClient
        .from("customers")
        .select("*")
        .eq("id", accessData.customer_id)
        .single();

      if (customerData) {
        setCustomerName(customerData.name);
        setCustomerEmail(customerData.email);
      }

      const { data: accessList } = await tokenClient
        .from("member_access")
        .select("*, courses(*)")
        .eq("customer_id", accessData.customer_id);

      if (accessList) {
        // For courses without cover_image_url, try to get the product image
        const coursesWithImages = await Promise.all(
          accessList.map(async (a: any) => {
            let coverImage = a.courses?.cover_image_url;
            if (!coverImage && a.courses?.product_id) {
              const { data: prod } = await tokenClient
                .from("products")
                .select("image_url")
                .eq("id", a.courses.product_id)
                .maybeSingle();
              coverImage = prod?.image_url || null;
            }
            return {
              ...a.courses,
              cover_image_url: coverImage,
              access_token: a.access_token,
              source: "purchased" as const,
            };
          })
        );
        setCourses(coursesWithImages);
      }
    } catch (err) {
      console.error("Portal error:", err);
      toast.error("Erro ao carregar dados");
    }
    setLoading(false);
  };

  // Load data via authenticated user (buyer/producer mode)
  const loadAuthData = async () => {
    try {
      const email = user!.email || "";
      const { data, error } = await supabase.functions.invoke("member-portal-data", {
        body: {},
      });

      if (error) throw error;

      setCustomerName(data?.customerName || email.split("@")[0]);
      setCustomerEmail(data?.customerEmail || email);
      setCourses(Array.isArray(data?.courses) ? data.courses : []);
    } catch (err) {
      console.error("Auth portal error:", err);
      toast.error("Erro ao carregar sua área de membros");
    }
    setLoading(false);
  };

  const handleOpenCourse = async (course: PortalCourse) => {
    if (course.access_token) {
      navigate(`/membros?token=${course.access_token}`);
      return;
    }

    // Product without a linked course — nothing to preview yet
    if (course.id.startsWith("product-")) {
      toast.info("Este produto ainda não possui uma área de membros vinculada. Crie um curso na aba 'Área de Membros' do produto.");
      return;
    }

    // Producer previewing own course — find or create access for their own customer record
    const email = user?.email || "";
    let customerId: string | null = null;

    // Find or create ONLY the producer's own customer record
    const { data: custData } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .eq("user_id", user!.id)
      .limit(1)
      .maybeSingle();

    if (custData) {
      customerId = custData.id;
    } else {
      const { data: newCust } = await supabase
        .from("customers")
        .insert({ name: customerName || "Produtor", email, user_id: user!.id })
        .select("id")
        .single();
      customerId = newCust?.id || null;
    }

    if (!customerId) {
      toast.error("Erro ao criar acesso de preview");
      return;
    }

    // Check if this producer already has access to this course
    const { data: existing } = await supabase
      .from("member_access")
      .select("access_token")
      .eq("course_id", course.id)
      .eq("customer_id", customerId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      navigate(`/membros?token=${existing.access_token}`);
    } else {
      const { data: newAccess, error: accessError } = await supabase
        .from("member_access")
        .insert({ course_id: course.id, customer_id: customerId })
        .select("access_token")
        .single();

      if (accessError || !newAccess) {
        console.error("Error creating preview access:", accessError);
        toast.error("Erro ao criar acesso de preview");
        return;
      }

      navigate(`/membros?token=${newAccess.access_token}`);
    }
  };

  const filteredCourses = courses.filter((c) => {
    if (search && !c.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "created") return c.source === "created";
    if (filter === "purchased") return c.source === "purchased";
    return true;
  });

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = customerName?.split(" ")[0] || "Aluno";

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ===== GREEN HEADER BAR ===== */}
      <header className="bg-primary h-14 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-primary-foreground font-bold text-sm sm:text-base">{firstName}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 text-primary-foreground/90 hover:text-primary-foreground transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <ChevronDown className="w-3.5 h-3.5 hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">{customerName}</p>
              <p className="text-xs text-muted-foreground truncate">{customerEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/minha-conta" + (token ? `?token=${token}` : ""))}>
              <BookOpen className="w-4 h-4 mr-2" />
              Meus cursos
            </DropdownMenuItem>
            {(isAdmin || isCollaborator) && (
              <DropdownMenuItem onClick={() => navigate("/admin")}>
                <LayoutDashboard className="w-4 h-4 mr-2" />
                {isAdmin ? "Mudar para painel do produtor" : isCollaborator ? "Mudar para painel de colaborador" : null}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={async () => { await signOut(); navigate("/login"); }}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">Meus Cursos</h1>
          
          {isSuperAdmin ? (
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all font-semibold text-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Acessar Painel do Produtor
            </button>
          ) : isCollaborator ? (
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all font-semibold text-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Acessar Painel de Colaborador
            </button>
          ) : isAdmin ? (
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all font-semibold text-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Acessar Painel do Produtor
            </button>
          ) : null}
        </div>

        {/* Search + Filter row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {isAuthMode && <SelectItem value="created">Meus cursos</SelectItem>}
              <SelectItem value="purchased">Comprados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Courses grid */}
        {filteredCourses.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum curso encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-lg transition-shadow group"
              >
                {/* Cover image */}
                <div className="aspect-video bg-muted overflow-hidden">
                  {course.cover_image_url ? (
                    <img
                      src={course.cover_image_url}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                      <BookOpen className="w-12 h-12 text-primary/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-foreground text-sm line-clamp-2 flex-1 min-h-[2.5rem]">
                      {course.title}
                    </h3>
                    {isAuthMode && course.source === "created" && (
                      <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
                        Meu curso
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleOpenCourse(course)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                  >
                    {course.source === "created" && !course.access_token ? "Visualizar" : "Acessar"}
                    <PlayCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CustomerPortal;
