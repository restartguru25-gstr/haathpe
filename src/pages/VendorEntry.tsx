import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, Wallet, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { useApp } from "@/contexts/AppContext";
import { isShopOpen, type ShopDetails } from "@/lib/shopDetails";

export default function VendorEntry() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { t } = useApp();
  const [vendor, setVendor] = useState<{
    name: string | null;
    stall_type: string | null;
    opening_hours?: Record<string, string>;
    weekly_off?: string | null;
    holidays?: string[] | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select("name, stall_type, opening_hours, weekly_off, holidays")
      .eq("id", vendorId)
      .single()
      .then(({ data }) => {
        setVendor(data as typeof vendor);
        setLoading(false);
      });
  }, [vendorId]);

  const shopDetails: ShopDetails | null = vendor
    ? { opening_hours: vendor.opening_hours, weekly_off: vendor.weekly_off, holidays: vendor.holidays, is_online: true }
    : null;
  const shopStatus = isShopOpen(shopDetails);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex flex-col items-center justify-center p-6">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 animate-pulse" />
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        <MakeInIndiaFooter />
      </div>
    );
  }

  if (!vendorId || !vendor) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground">Dukaan not found.</p>
        <Link to="/" className="mt-4"><Button>Go home</Button></Link>
        <MakeInIndiaFooter />
      </div>
    );
  }

  const vendorName = vendor.name ?? "Dukaanwaala";

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex flex-col">
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
