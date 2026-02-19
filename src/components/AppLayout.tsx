import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import MobileHeader from "@/components/MobileHeader";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import CartFAB from "@/components/CartFAB";
import { useProfile } from "@/hooks/useProfile";
import { useApp } from "@/contexts/AppContext";
import { useSession } from "@/contexts/AuthContext";
import { usePaidOrderNotification } from "@/hooks/usePaidOrderNotification";
import { isShopOpen } from "@/lib/shopDetails";
import { supabase } from "@/lib/supabase";

export default function AppLayout() {
  const { profile, isFromSupabase } = useProfile();
  const { setLang } = useApp();
  const { user, profile: rawProfile } = useSession();
  const shopStatus = isShopOpen(
    rawProfile
      ? {
          opening_hours: rawProfile.opening_hours,
          weekly_off: rawProfile.weekly_off,
          holidays: rawProfile.holidays,
          is_online: rawProfile.is_online,
        }
      : null
  );

  usePaidOrderNotification({
    vendorId: user?.id ?? null,
    voiceLang: profile.preferredLanguage,
    vendorPhone: profile.phone ?? null,
    sendWhatsApp: !!import.meta.env.VITE_WHATSAPP_API_KEY,
    alertsEnabled: shopStatus.open,
    alertVolume: (rawProfile as { alert_volume?: "low" | "medium" | "high" } | null)?.alert_volume ?? null,
  });

  useEffect(() => {
    if (isFromSupabase && profile.preferredLanguage) {
      setLang(profile.preferredLanguage);
    }
  }, [isFromSupabase, profile.preferredLanguage, setLang]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("customer_orders_toast")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer_orders",
          filter: `vendor_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { status?: string };
          if (row?.status !== "paid") toast.success("New order!");
        }
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") throw e;
      }
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("vendor_incentives")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vendor_incentives",
          filter: `vendor_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { earned_amount?: number; slab_type?: string };
          const amount = Number(row?.earned_amount ?? 0);
          const type = row?.slab_type ?? "incentive";
          toast.success(`New incentive earned! ₹${amount} (${type})`);
        }
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") throw e;
      }
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <MobileHeader />
      <main className="pb-28 md:pb-4 flex flex-col min-h-[calc(100vh-4rem)]">
        <div className="flex-1">
          <Outlet />
        </div>
        <MakeInIndiaFooter />
      </main>
      <CartFAB />
      <BottomNav />
    </div>
  );
}
