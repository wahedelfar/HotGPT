import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, clearSession, signOut, type HotGPTUser } from "@/lib/auth";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

export function useAuth(options?: UseAuthOptions) {
  const [user, setUser] = useState<HotGPTUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await getCurrentUser();
      setUser(payload);
      setError(null);
      return payload;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error("auth_unavailable");
      setError(nextError);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "hotgpt.supabase.session") void refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await signOut(); } finally { clearSession(); setUser(null); }
  }, []);

  useEffect(() => {
    if (!options?.redirectOnUnauthenticated || loading || user) return;
    window.location.assign(options.redirectPath || "/auth");
  }, [options?.redirectOnUnauthenticated, options?.redirectPath, loading, user]);

  return { user, loading, error, isAuthenticated: Boolean(user), refresh, logout };
}
