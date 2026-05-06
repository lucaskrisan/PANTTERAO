import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import AdminHeader from "./AdminHeader";
import AdminAccessRedirect from "./AdminAccessRedirect";
import InstallPrompt from "../InstallPrompt";

import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useOneSignalInit } from "@/hooks/useOneSignalInit";
import { useAdminOrders } from "@/hooks/useAdminOrders";
import { useVisitorToasts } from "@/hooks/useVisitorToasts";
import { useCollaboratorPermissions } from "@/hooks/useCollaboratorPermissions";
import { urlToPermissionKey } from "@/lib/collaboratorPermissions";
import { Loader2, ShieldAlert } from "lucide-react";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function AdminLayout() {
  const { user, isAdmin, isSuperAdmin, isCollaborator, loading, signOut, refreshRoles } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [isVerified, setIsVerified] = useState(false);
  const location = useLocation();
  const { permissions, loading: permsLoading } = useCollaboratorPermissions(
    user?.id,
    isCollaborator && !isSuperAdmin
  );

  useOneSignalInit(user?.id ?? undefined);
  const { totalRevenue } = useAdminOrders(user?.id ?? undefined, isSuperAdmin);
  useVisitorToasts(user?.id ?? undefined, user?.email ?? undefined);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("verified")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setIsVerified(data?.verified === true));
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin && !isCollaborator) {
    console.log("[AdminLayout] User is not admin/collaborator, redirecting...", { isAdmin, isCollaborator });
    return <AdminAccessRedirect refreshRoles={refreshRoles} userId={user.id} />;
  }

  return (
    <SidebarProvider>
      <InstallPrompt />
      <div className="h-screen flex w-full overflow-hidden">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AdminHeader
            totalRevenue={totalRevenue}
            isDark={isDark}
            toggleTheme={toggleTheme}
            user={user}
            signOut={signOut}
            isVerified={isVerified}
          />
          <main className="flex-1 bg-background relative overflow-hidden min-h-0">
            <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
              <div className="p-6 min-h-full">
                <CollaboratorRouteGuard
                  enabled={isCollaborator && !isSuperAdmin}
                  loading={permsLoading}
                  permissions={permissions}
                  pathname={location.pathname}
                >
                  <Outlet />
                </CollaboratorRouteGuard>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function CollaboratorRouteGuard({
  enabled,
  loading,
  permissions,
  pathname,
  children,
}: {
  enabled: boolean;
  loading: boolean;
  permissions: Record<string, boolean> | null;
  pathname: string;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  // Normaliza paths como /admin/orders/123 -> /admin/orders
  const knownKey = urlToPermissionKey(pathname) ||
    urlToPermissionKey("/" + pathname.split("/").slice(1, 3).join("/"));

  const isMarketplace = pathname === "/admin/marketplace" || pathname.startsWith("/admin/marketplace");
  const isComissoes = pathname === "/admin/minhas-comissoes" || pathname.startsWith("/admin/minhas-comissoes");
  const isPayouts = pathname === "/admin/gestao-saques" || pathname.startsWith("/admin/gestao-saques");

  if (isMarketplace || isComissoes || isPayouts) return <>{children}</>;
  if (knownKey && permissions?.[knownKey] === true) return <>{children}</>;
  if (pathname === "/admin") return <>{children}</>;

  return (
    <div className="max-w-md mx-auto mt-20 text-center space-y-3">
      <ShieldAlert className="w-12 h-12 mx-auto text-muted-foreground" />
      <h2 className="text-xl font-semibold">Acesso restrito</h2>
      <p className="text-sm text-muted-foreground">
        Você não tem permissão para acessar esta área. Solicite ao Super Admin.
      </p>
    </div>
  );
}
