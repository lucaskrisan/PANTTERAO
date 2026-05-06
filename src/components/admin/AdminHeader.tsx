import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { User, Eye, Bell, LogOut, ChevronDown, Moon, Sun, ShieldCheck } from "lucide-react";
import HeaderGamification from "./HeaderGamification";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  totalRevenue: number;
  isDark: boolean;
  toggleTheme: () => void;
  user: any;
  signOut: () => Promise<void>;
  isVerified?: boolean;
}

const AdminHeader = memo(function AdminHeader({ totalRevenue, isDark, toggleTheme, user, signOut, isVerified }: Props) {
  const navigate = useNavigate();

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/login");
  }, [signOut, navigate]);

  return (
    <>
      <div className="h-11 bg-primary flex items-center justify-between px-4 gap-3">
        <HeaderGamification totalRevenue={totalRevenue} />
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="w-7 h-7 rounded-full bg-primary-foreground/15 hover:bg-primary-foreground/25 flex items-center justify-center text-primary-foreground/80 hover:text-primary-foreground transition-colors"
            title={isDark ? "Modo claro" : "Modo escuro"}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 text-primary-foreground/90 hover:text-primary-foreground text-sm font-medium transition-colors">
                <div className="w-7 h-7 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </div>
                <span className="hidden md:inline max-w-[180px] truncate">{user?.email}</span>
                {isVerified && <ShieldCheck className="w-3.5 h-3.5 text-green-400" />}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/admin/notifications")}>
                <Bell className="w-4 h-4 mr-2" />
                Notificações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open("/minha-conta", "_blank")}>
                <Eye className="w-4 h-4 mr-2" />
                Mudar para painel do aluno
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <header className="h-12 flex items-center border-b border-border px-4 bg-card">
        <SidebarTrigger className="mr-3" />
        <span className="font-display font-bold text-foreground text-sm">Painel Admin</span>
      </header>
    </>
  );
});

export default AdminHeader;
