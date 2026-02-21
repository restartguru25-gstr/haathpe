import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, Wallet, ChevronRight, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { useApp } from "@/contexts/AppContext";
import { useSession } from "@/contexts/AuthContext";
import { isShopOpen, type ShopDetails } from "@/lib/shopDetails";

type VendorInfo = {
  name: string | null;
  stall_type: string | null;
  opening_hours?: Record<string, string>;
  weekly_off?: string | null;
  holidays?: string[] | null;
};

function normalizeVendorRow(row: unknown): VendorInfo | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  return {
    name: (r.name ?? r.Name) as string | null,
    stall_type: (r.stall_type ?? r.stallType) as string | null,
    opening_hours: (r.opening_hours ?? r.openingHours) as Record<string, string> | undefined,
    weekly_off: (r.weekly_off ?? r.weeklyOff) as string | null,
    holidays: (r.holidays as string[] | null) ?? null,
  };
}

export default function VendorEntry() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { t } = useApp();
  const { user, profile: rawProfile, isLoading: authLoading, refreshProfile } = useSession();
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const tryProfilesAsOwner = useCallback(async (): Promise<VendorInfo | null> => {
    if (user?.id !== vendorId) return null;
    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("name, stall_type, opening_hours, weekly_off, holidays")
      .eq("id", vendorId)
      .maybeSingle();
    if (error) return null;
    return normalizeVendorRow(profileData) ?? null;
  }, [user?.id, vendorId]);

  const loadVendor = useCallback(async () => {
    if (!vendorId) return;
    try {
      const { data, error } = await supabase.rpc("get_vendor_public_info", { p_vendor_id: vendorId });
      if (!error && data != null) {
        const row = Array.isArray(data) ? data[0] : data;
        const normalized = normalizeVendorRow(row);
        if (normalized) return normalized;
      }
    } catch {
      /* ignore */
    }
    return await tryProfilesAsOwner();
  }, [vendorId, tryProfilesAsOwner]);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const v = await loadVendor();
      if (!cancelled && v) setVendor(v);
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [vendorId, user?.id, authLoading, loadVendor]);

  const handleOwnerRetry = useCallback(async () => {
    if (!user?.id || user.id !== vendorId) return;
    setRetrying(true);
    try {
      await refreshProfile();
      const name = rawProfile?.name ?? (user.user_metadata?.name as string) ?? (user.email ? user.email.split("@")[0] : null);
      const stall_type = rawProfile?.stall_type ?? (user.user_metadata?.stall_type as string) ?? null;
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          name: name || "My Dukaan",
          stall_type: stall_type || "Tea Stall",
          preferred_language: (rawProfile?.preferred_language as "en" | "hi" | "te") ?? "en",
        },
        { onConflict: "id" }
      );
      const fromProfiles = await tryProfilesAsOwner();
      if (fromProfiles) setVendor(fromProfiles);
    } finally {
      setRetrying(false);
    }
  }, [user, vendorId, rawProfile?.name, rawProfile?.stall_type, rawProfile?.preferred_language, refreshProfile, tryProfilesAsOwner]);

  const ownerAutoEnsureDone = useRef(false);
  useEffect(() => {
    if (!vendorId || !user?.id || user.id !== vendorId || vendor || loading || authLoading || retrying) return;
    if (ownerAutoEnsureDone.current) return;
    ownerAutoEnsureDone.current = true;
    const t = window.setTimeout(() => {
      handleOwnerRetry();
    }, 400);
    return () => clearTimeout(t);
  }, [vendorId, user?.id, vendor, loading, authLoading, retrying, handleOwnerRetry]);

  const shopDetails: ShopDetails | null = vendor
    ? { opening_hours: vendor.opening_hours, weekly_off: vendor.weekly_off, holidays: vendor.holidays, is_online: true }
    : null;
  const shopStatus = isShopOpen(shopDetails);

  if (loading || (authLoading && !!vendorId)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex flex-col items-center justify-center p-6">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 animate-pulse" />
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        <MakeInIndiaFooter />
      </div>
    );
  }

  if (!vendorId || !vendor) {
    const isOwner = user?.id === vendorId;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <p className="text-muted-foreground font-medium">Dukaan not found.</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          {isOwner
            ? "Your dukaan profile may not be visible yet. Click “Load my dukaan” to sync your profile and show this page."
            : "This link may be wrong or the dukaan is not set up yet. If you’re the owner, sign in first, then open this link again and click “Load my dukaan”."}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          {isOwner && (
            <Button onClick={handleOwnerRetry} disabled={retrying}>
              {retrying ? "Loading…" : "Load my dukaan"}
            </Button>
          )}
          {!user && vendorId && (
            <Link to="/auth" state={{ next: `/menu/${vendorId}` }}>
              <Button variant="outline">Sign in (I’m the owner)</Button>
            </Link>
          )}
          <Link to={user ? "/dashboard" : "/"}>
            <Button variant={isOwner ? "outline" : "default"}>{user ? "Back to Dashboard" : "Go home"}</Button>
          </Link>
        </div>
        <MakeInIndiaFooter />
      </div>
    );
  }

  const vendorName = vendor.name ?? "Dukaanwaala";

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link to="/search">
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft size={20} className="text-muted-foreground" />
            </Button>
          </Link>
          <span className="text-sm font-medium text-muted-foreground">Find dukaan</span>
        </div>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Vendor branding card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="rounded-3xl border border-border/60 bg-card/95 shadow-xl shadow-primary/5 backdrop-blur-sm p-8 mb-6"
          >
            <div className="flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground font-brand tracking-widest shadow-lg shadow-primary/25 mb-4">
                h
              </div>
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-1">haathpe</p>
              <h1 className="text-2xl font-bold text-foreground mb-1">{vendorName}</h1>
              {vendor.stall_type && (
                <p className="text-sm text-muted-foreground">{vendor.stall_type}</p>
              )}
              {shopStatus.open && (
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1.5 text-xs font-semibold text-green-800 dark:text-green-200">
                  <Sparkles size={14} /> Open now
                </span>
              )}
            </div>
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
            className="space-y-3"
          >
            <Link to={`/menu/${vendorId}/browse`}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-lg"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Store size={28} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-foreground">Browse menu</p>
                  <p className="text-sm text-muted-foreground">Order food & drinks from the menu</p>
                </div>
                <ChevronRight size={22} className="text-muted-foreground shrink-0" />
              </motion.div>
            </Link>

            <Link to={`/menu/${vendorId}/pay`}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="flex items-center gap-4 rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 shadow-sm transition-all hover:border-primary hover:bg-primary/10 hover:shadow-lg"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary">
                  <Wallet size={28} className="text-primary-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-foreground">Pay directly</p>
                  <p className="text-sm text-muted-foreground">Enter amount & pay like PhonePe, GPay</p>
                </div>
                <ChevronRight size={22} className="text-primary shrink-0" />
              </motion.div>
            </Link>
          </motion.div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Powered by haathpe · Sab kuch haath pe
          </p>
        </motion.div>
      </div>
      <MakeInIndiaFooter />
    </div>
  );
}
