import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import MobileHeader from "@/components/MobileHeader";
import CartFAB from "@/components/CartFAB";
import { useProfile } from "@/hooks/useProfile";
import { useApp } from "@/contexts/AppContext";
import { useSession } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function AppLayout() {
  const { profile, isFromSupabase } = useProfile();
  const { setLang } = useApp();
  const { user } = useSession();

  useEffect(() => {
    if (isFromSupabase && profile.preferredLanguage) {
      setLang(profile.preferredLanguage);
    }
  }, [isFromSupabase, profile.preferredLanguage, setLang]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("customer_orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer_orders",
          filter: `vendor_id=eq.${user.id}`,
        },
        () => {
          toast.success("New online order!");
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
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
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <MobileHeader />
      <main className="pb-28 md:pb-4">
        <Outlet />
      </main>
      <CartFAB />
      <BottomNav />
    </div>
  );
}
