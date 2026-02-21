import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/database.types";
import type { Language } from "@/lib/data";

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useSession must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) {
        if (error?.message !== "AbortError: signal is aborted without reason" && error?.name !== "AbortError") {
          console.warn("Profile fetch error:", error.message);
        }
        return null;
      }
      return data as Profile;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return null;
      console.warn("Profile fetch error:", e);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    } else {
      setProfile(null);
    }
  }, [user?.id, fetchProfile]);


  const ensureProfile = useCallback(
    async (u: User) => {
      for (const delayMs of [0, 400, 900, 1500]) {
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        const existing = await fetchProfile(u.id);
        if (existing) {
          setProfile(existing);
          return;
        }
      }
      if ((u.user_metadata as { role?: string } | undefined)?.role === "customer") {
        setProfile(null);
        return;
      }
      // Only create a new row; never overwrite existing profile (would wipe saved address/photo).
      try {
        const derivedName = u.user_metadata?.name ?? (u.email ? u.email.split("@")[0] : null);
        await supabase
          .from("profiles")
          .upsert(
            {
              id: u.id,
              phone: u.phone ?? null,
              name: derivedName,
              stall_type: u.user_metadata?.stall_type ?? null,
              stall_address: u.user_metadata?.stall_address ?? null,
              preferred_language: (u.user_metadata?.preferred_language as "en" | "hi" | "te") ?? "en",
            },
            { onConflict: "id", ignoreDuplicates: true }
          );
        for (const delayMs of [0, 300, 800]) {
          if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
          const afterInsert = await fetchProfile(u.id);
          if (afterInsert) {
            setProfile(afterInsert);
            return;
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        console.warn("Profile create error:", e);
      }
    },
    [fetchProfile]
  );

  // Restore session from storage when we have none (e.g. after "Back to home" or tab focus)
  const tryRecoverSession = useCallback(async () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key || url === "" || key === "") return;
    try {
      const { data: { session: s }, error } = await supabase.auth.getSession();
      if (error || !s) return;
      setSession(s);
      setUser(s.user);
      await ensureProfile(s.user);
    } catch {
      /* ignore */
    }
  }, [ensureProfile]);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    const init = async () => {
      try {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!url || !key || url === "" || key === "") {
          setIsLoading(false);
          return;
        }
        const { data: { session: s }, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error) {
          setSession(null);
          setUser(null);
          setProfile(null);
          return;
        }
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          await ensureProfile(s.user);
        } else {
          setProfile(null);
        }
      } catch (e) {
        if (!cancelled) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    init();

    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      if (url && supabase.auth) {
        const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(async (event, s) => {
          if (cancelled) return;
          setSession(s);
          setUser(s?.user ?? null);
          try {
            if (s?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
              await ensureProfile(s.user);
            } else {
              setProfile(null);
            }
          } finally {
            if (!cancelled) setIsLoading(false);
          }
        });
        subscription = sub;
      }
    } catch {
      if (!cancelled) setIsLoading(false);
    }

    const timeout = window.setTimeout(() => {
      setIsLoading(false);
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, [ensureProfile]);

  // Session recovery: when we appear logged out but storage may still have a session (e.g. after "Back to home")
  const recoveryAttempted = useRef(false);
  useEffect(() => {
    if (session || isLoading) {
      if (session) recoveryAttempted.current = false;
      return;
    }
    if (recoveryAttempted.current) return;
    recoveryAttempted.current = true;
    const t = window.setTimeout(() => {
      tryRecoverSession().finally(() => {
        recoveryAttempted.current = false;
      });
    }, 400);
    return () => clearTimeout(t);
  }, [session, isLoading, tryRecoverSession]);

  // Re-check session when user returns to tab (handles storage restored elsewhere or race)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!session && !isLoading) {
        tryRecoverSession();
      } else if (user?.id && !profile) {
        // User logged in but profile missing – refresh (handles delayed DB / race)
        refreshProfile();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [session, isLoading, user?.id, profile, tryRecoverSession, refreshProfile]);

  // Aggressive profile retry: when user exists but profile is null, keep retrying for ~12s
  // Handles transient DB/RLS issues and race conditions that cause "new vendor" state
  useEffect(() => {
    const isCustomer = (user?.user_metadata as { role?: string } | undefined)?.role === "customer";
    if (!user?.id || profile || isCustomer) return;
    let cancelled = false;
    const delays = [2000, 4000, 6000, 8000, 10000, 12000];
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let attempt = 0;
    for (const ms of delays) {
      const t = window.setTimeout(async () => {
        if (cancelled) return;
        attempt += 1;
        await refreshProfile();
        if (import.meta.env.DEV && attempt === delays.length) {
          console.warn(
            "[Auth] Profile null after retries. Check Supabase profiles for id:",
            user.id,
            "| email:",
            user.email ?? "(none)",
            "| phone:",
            user.phone ?? "(none)",
            "| If you signed up with both email and phone, those are separate accounts."
          );
        }
      }, ms);
      timeouts.push(t);
    }
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [user?.id, user?.email, user?.phone, profile, refreshProfile]);

  const signOut = useCallback(async () => {
    // Clear app state immediately so UI shows logged-out
    setUser(null);
    setSession(null);
    setProfile(null);
    try {
      // Wait for signOut to complete so session is cleared from storage before redirect.
      // Otherwise the next page load can restore the session and "log back in".
      const signOutPromise = supabase.auth.signOut({ scope: "local" });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Sign out timeout")), 5000)
      );
      await Promise.race([signOutPromise, timeout]);
    } catch (e) {
      console.warn("Sign out error:", e);
      // Clear any Supabase auth keys from localStorage so reload doesn't restore session
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) keys.push(k);
        }
        keys.forEach((k) => localStorage.removeItem(k));
      } catch {
        /* ignore */
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isAuthenticated: !!session,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
