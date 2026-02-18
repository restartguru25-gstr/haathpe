import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  getCustomerProfile,
  type CustomerProfile,
} from "@/lib/customer";

interface CustomerAuthState {
  customer: CustomerProfile | null;
  isLoading: boolean;
  isCustomer: boolean;
}

interface CustomerAuthContextValue extends CustomerAuthState {
  refreshCustomer: () => Promise<void>;
  signOutCustomer: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  return ctx;
}

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCustomer = useCallback(async () => {
    const profile = await getCustomerProfile();
    setCustomer(profile);
  }, []);

  const signOutCustomer = useCallback(async () => {
    setCustomer(null);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (e) {
      console.warn("Customer sign out error:", e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const profile = await getCustomerProfile();
      if (!cancelled) setCustomer(profile);
      if (!cancelled) setIsLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (cancelled) return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const profile = await getCustomerProfile();
        if (!cancelled) setCustomer(profile);
      } else if (event === "SIGNED_OUT") {
        if (!cancelled) setCustomer(null);
      }
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        isLoading,
        isCustomer: !!customer,
        refreshCustomer,
        signOutCustomer,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}
