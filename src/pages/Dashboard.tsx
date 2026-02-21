import { motion } from "framer-motion";
import {
  TrendingUp,
  Flame,
  Award,
  RotateCcw,
  Ticket,
  CloudSun,
  ShoppingBag,
  Receipt,
  ChevronRight,
  Sparkles,
  Store,
  Banknote,
  Package,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/contexts/AppContext";
import { useProfile } from "@/hooks/useProfile";
import { useSession } from "@/contexts/AuthContext";
import { isShopOpen } from "@/lib/shopDetails";
import { sampleOrders } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { getSalesStats } from "@/lib/sales";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const fadeUp = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.06, duration: 0.35 },
});

function getGreetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const h = new Date().getHours();
  if (h < 12) return "goodMorning";
  if (h < 17) return "goodAfternoon";
  return "goodEvening";
}

function getOrderStatusStyle(status: string) {
  switch (status) {
    case "delivered":
      return "bg-success/15 text-success border-success/30";
    case "in-transit":
      return "bg-accent/15 text-accent border-accent/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export default function Dashboard() {
  const { t } = useApp();
  const { profile, isLoading } = useProfile();
  const { user, profile: rawProfile, refreshProfile } = useSession();
  const [orders, setOrders] = useState<{ id: string; total: number; date: string; status: string }[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [salesStats, setSalesStats] = useState<{
    totalRevenue: number;
    orderCount: number;
    topItems: { item_name: string; qty: number }[];
  } | null>(null);

  const { name, stallType, stallIcon, streak, points, tier, creditLimit, creditUsed } = profile;
  const greetingKey = getGreetingKey();
  const greeting = t(greetingKey);
  const creditPercent = creditLimit > 0 ? Math.round((creditUsed / creditLimit) * 100) : 0;
  const daysToCredit = Math.max(0, 30 - streak);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const { data } = await supabase
          .from("orders")
          .select("id, total, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        if (data && data.length > 0) {
          setOrders(
            data.map((o) => ({
              id: o.id,
              total: o.total,
              date: new Date(o.created_at).toLocaleDateString(),
              status: o.status,
            }))
          );
        }
      } catch {
        // Fallback to sample orders
      } finally {
        setOrdersLoading(false);
      }
    };
    loadOrders();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    getSalesStats(user.id, today.toISOString()).then(setSalesStats);
  }, [user?.id]);

  const displayOrders =
    orders.length > 0
      ? orders
      : sampleOrders.slice(0, 3).map((o) => ({
          id: o.id,
          total: o.total,
          date: o.date,
          status: o.status,
        }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <div className="container max-w-2xl px-4 py-6">
          <div className="mb-6 flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="mb-6 h-28 rounded-xl" />
          <div className="mb-6 grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="mb-6 h-20 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-6">
      <div className="container max-w-2xl px-4 py-6">
        {/* Greeting */}
        <motion.div {...fadeUp(0)} className="mb-6 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl shadow-inner">
            {stallIcon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{greeting},</p>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {name}
              <span className="ml-1.5 text-xl opacity-90">{stallIcon}</span>
            </h1>
            <p className="text-sm text-muted-foreground">{t("dashboardGreeting")}</p>
            {rawProfile && (() => {
              const status = isShopOpen({
                opening_hours: rawProfile.opening_hours ?? undefined,
                weekly_off: rawProfile.weekly_off ?? undefined,
                holidays: rawProfile.holidays ?? undefined,
                is_online: rawProfile.is_online,
              });
              return (
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.open ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"}`}>
                    <Clock size={12} />
                    {status.open ? t("shopOpenNow") : t("shopClosedNow")}
                  </span>
                  <Link to="/profile">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">{t("editTimings")}</Button>
                  </Link>
                </div>
              );
            })()}
          </div>
        </motion.div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: t("todayOrders"), value: "3", icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
            { label: t("streak"), value: `${streak}/30`, icon: Flame, color: "text-accent", bg: "bg-accent/10" },
            { label: t("points"), value: `${points}`, icon: Award, color: "text-success", bg: "bg-success/10" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              {...fadeUp(i + 1)}
              className="rounded-xl border border-border bg-card p-4 text-center shadow-sm"
            >
              <div className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon size={18} className={stat.color} />
              </div>
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[11px] font-medium text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Streak progress */}
        <motion.div
          {...fadeUp(4)}
          className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Flame size={18} className="text-accent" />
              Hustle Streak
            </span>
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">
              {streak} days
            </span>
          </div>
          <Progress value={(streak / 30) * 100} className="h-3" />
          <p className="mt-2 text-xs text-muted-foreground">
            {daysToCredit > 0
              ? `${daysToCredit} more days to unlock ₹5,000 credit line`
              : "Credit line unlocked! Check your wallet in Profile."}
          </p>
        </motion.div>

        {/* Sales Overview */}
        {salesStats && (salesStats.orderCount > 0 || salesStats.totalRevenue > 0) && (
          <motion.div {...fadeUp(4.5)} className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Store size={18} className="text-primary" />
                {t("salesOverview")}
              </span>
              <Link to="/sales">
                <span className="text-xs font-medium text-primary">View</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-lg font-bold text-primary">₹{salesStats.totalRevenue.toFixed(0)}</p>
                <p className="text-[11px] text-muted-foreground">{t("dailyRevenue")}</p>
              </div>
              <div>
                <p className="text-lg font-bold">{salesStats.orderCount}</p>
                <p className="text-[11px] text-muted-foreground">Orders today</p>
              </div>
            </div>
            {salesStats.topItems.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("topItems")}: {salesStats.topItems.slice(0, 3).map((i) => i.item_name).join(", ")}
              </p>
            )}
          </motion.div>
        )}

        {/* Quick actions - 1 per row on mobile, 2 per row on larger screens */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 [grid-auto-rows:1fr]">
          <motion.div {...fadeUp(5)} className="min-h-[5.5rem]">
            <Link
              to="/catalog"
              className="flex h-full min-h-[5.5rem] items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <ShoppingBag size={20} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="font-semibold truncate">{t("catalog")}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{t("catalogPageSubtitle")}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
            </Link>
          </motion.div>
          <motion.div {...fadeUp(6)} className="min-h-[5.5rem]">
            <Link
              to="/loyalty"
              className="flex h-full min-h-[5.5rem] items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                <Ticket size={20} className="text-accent" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="font-semibold truncate">Check draws</p>
                <p className="text-xs text-muted-foreground line-clamp-2">Today&apos;s winner</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
            </Link>
          </motion.div>
          <motion.div {...fadeUp(7)} className="min-h-[5.5rem]">
            <Link
              to="/catalog"
              className="flex h-full min-h-[5.5rem] items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <RotateCcw size={20} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="font-semibold truncate">Reorder last kit</p>
                <p className="text-xs text-muted-foreground line-clamp-2">One tap</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
            </Link>
          </motion.div>
          <motion.div {...fadeUp(8)} className="min-h-[5.5rem]">
            <Link
              to="/orders"
              className="flex h-full min-h-[5.5rem] items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/10">
                <Receipt size={20} className="text-success" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="font-semibold truncate">{t("orders")}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{t("ordersPageSubtitle")}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
            </Link>
          </motion.div>
          <motion.div {...fadeUp(8.5)} className="min-h-[5.5rem]">
            <Link
              to="/swap"
              className="flex h-full min-h-[5.5rem] items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                <Package size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="font-semibold truncate">{t("vendorSwap")}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">Buy or sell excess stock</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
            </Link>
          </motion.div>
          <motion.div {...fadeUp(8.6)} className="min-h-[5.5rem]">
            <Link
              to="/sales"
              className="flex h-full min-h-[5.5rem] items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                <Store size={20} className="text-accent" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="font-semibold truncate">{t("sales")}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{t("salesPageSubtitle")}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
            </Link>
          </motion.div>
        </div>

        {/* Weather / tip */}
        <motion.div
          {...fadeUp(9)}
          className="mb-6 flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15">
            <CloudSun size={24} className="text-accent" />
          </div>
          <div>
            <p className="font-semibold">Hyderabad — 38°C</p>
            <p className="text-sm text-muted-foreground">
              Hot day. Stock more water bottles and cold drinks today.
            </p>
          </div>
        </motion.div>

        {/* Tier badge */}
        <motion.div {...fadeUp(10)} className="mb-6">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-accent" />
              <span className="text-sm font-semibold">Your tier</span>
            </div>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">
              {tier}
            </span>
          </div>
        </motion.div>

        {/* Recent orders */}
        <motion.div {...fadeUp(11)}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Recent orders</h2>
            <Link
              to="/orders"
              className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary"
            >
              {t("viewAll")}
              <ChevronRight size={16} />
            </Link>
          </div>
          <div className="space-y-2">
            {(ordersLoading ? sampleOrders.slice(0, 3) : displayOrders).map((order) => (
              <Link
                key={order.id}
                to="/orders"
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{order.id}</p>
                  <p className="text-xs text-muted-foreground">{order.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">₹{order.total}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${getOrderStatusStyle(order.status)}`}
                  >
                    {order.status.replace("-", " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {displayOrders.length === 0 && !ordersLoading && (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <Receipt className="mx-auto mb-2 size-10 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">No orders yet</p>
              <Link to="/catalog">
                <Button size="sm" className="mt-2">Place your first order</Button>
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
