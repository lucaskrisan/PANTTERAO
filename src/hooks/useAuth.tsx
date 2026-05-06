// @ts-nocheck
import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthOrigin } from "@/lib/getAuthOrigin";
import type { User, Session } from "@supabase/supabase-js";

/* ── Types ── */
interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isCollaborator: boolean;
  profileCompleted: boolean | null;
  loading: boolean;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, extra?: { phone?: string; cpf?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

type AuthContextType = AuthState & AuthActions;

/* ── Contexts (split to avoid re-renders) ── */
const AuthStateContext = createContext<AuthState | undefined>(undefined);
const AuthActionsContext = createContext<AuthActions | undefined>(undefined);

const AUTH_BOOT_TIMEOUT_MS = 5000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isCollaborator, setIsCollaborator] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkRoles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.error("Error checking roles:", error);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsCollaborator(false);
      } else {
        const roles = (data || []).map((r: any) => r.role);
        setIsAdmin(roles.includes("admin") || roles.includes("super_admin") || roles.includes("collaborator"));
        setIsSuperAdmin(roles.includes("super_admin"));
        setIsCollaborator(roles.includes("collaborator"));
      }
    } catch (err) {
      console.error("checkRoles failed:", err);
      setIsAdmin(false);
      setIsSuperAdmin(false);
    }
  }, []);

  const checkProfileCompleted = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("id", userId)
        .single();
      setProfileCompleted(data?.profile_completed ?? false);
    } catch {
      setProfileCompleted(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialSessionResolved = false;

    const forceFinishLoading = window.setTimeout(() => {
      if (!mounted || initialSessionResolved) return;
      console.warn("Auth bootstrap timeout reached, releasing loading state.");
      initialSessionResolved = true;
      setLoading(false);
    }, AUTH_BOOT_TIMEOUT_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          setTimeout(async () => {
            if (!mounted) return;
            await Promise.all([
              checkRoles(newSession.user.id),
              checkProfileCompleted(newSession.user.id),
            ]);
            if (mounted && initialSessionResolved) setLoading(false);
          }, 0);
        } else {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setIsCollaborator(false);
          setProfileCompleted(null);
          if (mounted && initialSessionResolved) setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      initialSessionResolved = true;
      window.clearTimeout(forceFinishLoading);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await Promise.all([
          checkRoles(session.user.id),
          checkProfileCompleted(session.user.id),
        ]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      window.clearTimeout(forceFinishLoading);
      subscription.unsubscribe();
    };
  }, [checkRoles, checkProfileCompleted]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, extra?: { phone?: string; cpf?: string }) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: getAuthOrigin(),
      },
    });
    if (error) throw error;

    if (data?.user?.id && (extra?.phone || extra?.cpf)) {
      const updates: Record<string, any> = {};
      if (extra.phone) updates.phone = extra.phone.replace(/\D/g, "");
      if (extra.cpf) updates.cpf = extra.cpf.replace(/\D/g, "");
      updates.profile_completed = true;
      await supabase.from("profiles").update(updates).eq("id", data.user.id);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshRoles = useCallback(async () => {
    if (user?.id) {
      await Promise.all([
        checkRoles(user.id),
        checkProfileCompleted(user.id),
      ]);
    }
  }, [user?.id, checkRoles, checkProfileCompleted]);

  const stateValue = useMemo<AuthState>(() => ({
    user, session, isAdmin, isSuperAdmin, isCollaborator, profileCompleted, loading,
  }), [user, session, isAdmin, isSuperAdmin, isCollaborator, profileCompleted, loading]);

  const actionsValue = useMemo<AuthActions>(() => ({
    signIn, signUp, signOut, refreshRoles,
  }), [signIn, signUp, signOut, refreshRoles]);

  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthActionsContext.Provider value={actionsValue}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}

/** Full context — backwards compatible */
export function useAuth(): AuthContextType {
  const state = useContext(AuthStateContext);
  const actions = useContext(AuthActionsContext);
  if (!state || !actions) throw new Error("useAuth must be used within AuthProvider");
  return { ...state, ...actions };
}

/** Use only auth state (user, loading, roles) — won't re-render on action reference changes */
export function useAuthState(): AuthState {
  const context = useContext(AuthStateContext);
  if (!context) throw new Error("useAuthState must be used within AuthProvider");
  return context;
}

/** Use only auth actions (signIn, signOut, etc.) — stable references, never triggers re-render */
export function useAuthActions(): AuthActions {
  const context = useContext(AuthActionsContext);
  if (!context) throw new Error("useAuthActions must be used within AuthProvider");
  return context;
}
