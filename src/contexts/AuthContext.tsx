import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      console.warn("Profile fetch error:", error.message);
      return null;
    }
    return data as Profile;
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
      const existing = await fetchProfile(u.id);
      if (existing) {
        setProfile(existing);
        return;
      }
      if ((u.user_metadata as { role?: string } | undefined)?.role === "customer") {
        setProfile(null);
        return;
      }
      const phone = u.phone ?? null;
      const { data: newProfile, error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: u.id,
            phone,
            name: u.user_metadata?.name ?? null,
            stall_type: u.user_metadata?.stall_type ?? null,
            stall_address: u.user_metadata?.stall_address ?? null,
            preferred_language: (u.user_metadata?.preferred_language as "en" | "hi" | "te") ?? "en",
          },
          { onConflict: "id" }
        )
        .select()
        .single();
      if (error) {
        console.warn("Profile create error:", error.message);
        return;
      }
      setProfile(newProfile as Profile);
    },
    [fetchProfile]
  );

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

  const signOut = useCallback(async () => {
    // Clear app state immediately so UI shows logged-out
    setUser(null);
    setSession(null);
    setProfile(null);
    try {
      // scope: 'local' clears this browser's session even if server call fails
      await supabase.auth.signOut({ scope: "local" });
    } catch (e) {
      console.warn("Sign out error:", e);
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
