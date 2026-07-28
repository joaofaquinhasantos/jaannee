import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = { status: "loading" | "in" | "out"; userId: string | null };

/** Current Supabase session identity, kept in sync with auth state changes. */
export function useAuthUser(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading", userId: null });
  useEffect(() => {
    let active = true;
    // UI state can use the locally cached session; every protected server
    // function still verifies the bearer token independently.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const user = data.session?.user;
      setState({ status: user ? "in" : "out", userId: user?.id ?? null });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ status: session?.user ? "in" : "out", userId: session?.user?.id ?? null });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}
