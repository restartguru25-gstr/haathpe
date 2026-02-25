import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getRiderByAuth, type Rider } from "@/lib/riders";

interface RiderAuthState {
  rider: Rider | null;
  isLoading: boolean;
  isRider: boolean;
}

interface RiderAuthContextValue extends RiderAuthState {
  refreshRider: () => Promise<void>;
}

const RiderAuthContext = createContext<RiderAuthContextValue | null>(null);

export function useRiderAuth() {
  const ctx = useContext(RiderAuthContext);
  return ctx;
}

export function RiderAuthProvider({ children }: { children: React.ReactNode }) {
  const [rider, setRider] = useState<Rider | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshRider = useCallback(async () => {
    const r = await getRiderByAuth();
    setRider(r);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const r = await getRiderByAuth();
      if (!cancelled) setRider(r);
      if (!cancelled) setIsLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (cancelled) return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const r = await getRiderByAuth();
        if (!cancelled) setRider(r);
      } else if (event === "SIGNED_OUT") {
        if (!cancelled) setRider(null);
      }
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <RiderAuthContext.Provider
      value={{
        rider,
        isLoading,
        isRider: !!rider,
        refreshRider,
      }}
    >
      {children}
    </RiderAuthContext.Provider>
  );
}
