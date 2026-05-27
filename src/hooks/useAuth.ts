import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/adminAuth";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function checkAdmin(currentSession: Session | null) {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (!currentSession?.user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { isAdmin } = await checkIsAdmin(currentSession.user.id);

      if (!mounted) return;
      setIsAdmin(isAdmin);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => checkAdmin(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setLoading(true);
      setTimeout(() => checkAdmin(currentSession), 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user, isAdmin, loading, isSupabaseConfigured };
}
