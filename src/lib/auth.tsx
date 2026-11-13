import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { supabase } from "./supabase";

/** Checked in the browser for new passwords. Keep at or above Supabase's own minimum (Auth → Providers → Email). */
export const MIN_PASSWORD_LENGTH = 8;

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });
  const queryClient = useQueryClient();
  const userId = state.session?.user.id;

  // Cached colonies and signals belong to one player: drop them when that player changes or signs out.
  const lastUser = useRef(userId);
  useEffect(() => {
    if (lastUser.current && lastUser.current !== userId) queryClient.clear();
    lastUser.current = userId;
  }, [userId, queryClient]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setState({ session, loading: false }),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-dvh bg-mist" aria-busy="true" />;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}
