import { useState } from "react";
import { motion } from "framer-motion";
import {
  Star,
  Flame,
  Ticket,
  Gift,
  Sparkles,
  ChevronRight,
  Zap,
  Leaf,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useProfile } from "@/hooks/useProfile";
import { useSession } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const fadeUp = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.06, duration: 0.35 },
});

const REDEEM_OPTIONS = [
  { id: "trip", reward_type: "family_trip" as const, title: "Family Trip Voucher", points: 500, emoji: "✈️", desc: "Travel voucher for 2" },
  { id: "repair", reward_type: "repair_kit" as const, title: "Free Repair Kit", points: 200, emoji: "🧰", desc: "Dukaan maintenance kit" },
  { id: "credit", reward_type: "credit_boost" as const, title: "₹500 Credit Boost", points: 300, emoji: "💰", desc: "Add to your credit line" },
  { id: "supplies", reward_type: "supplies_kit" as const, title: "Premium Supplies Kit", points: 400, emoji: "📦", desc: "Curated essentials" },
];

const PAST_WINNERS = [
  { name: "Suresh K.", prize: "₹5,000 Cash", date: "Feb 14" },
  { name: "Lakshmi R.", prize: "Family Trip", date: "Feb 13" },
  { name: "Mohan S.", prize: "₹2,000 Cash", date: "Feb 12" },
  { name: "Raju M.", prize: "Supplies Voucher", date: "Feb 11" },
];

function getTierProgress(tier: "Bronze" | "Silver" | "Gold"): number {
  if (tier === "Gold") return 100;
  if (tier === "Silver") return 65;
  return 30;
}

function getNextTier(tier: "Bronze" | "Silver" | "Gold"): string {
  if (tier === "Bronze") return "Silver";
  if (tier === "Silver") return "Gold";
  return "Max";
}

const TREE_PLANTING_COST = 100;

export default function Loyalty() {
  const { t } = useApp();
  const { profile, isLoading } = useProfile();
  const { user, refreshProfile } = useSession();
  const { points, tier, streak, greenScore } = profile;
  const [redeemingTree, setRedeemingTree] = useState(false);
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null);
  const streakDays = Array.from({ length: 30 }, (_, i) => i < streak);
  const tierProgress = getTierProgress(tier);
  const nextTier = getNextTier(tier);
  const daysLeft = Math.max(0, 30 - streak);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <div className="container max-w-2xl px-4 py-6">
          <Skeleton className="mb-6 h-8 w-28" />
          <Skeleton className="mb-6 h-40 rounded-xl" />
          <Skeleton className="mb-6 h-44 rounded-xl" />
          <Skeleton className="mb-6 h-36 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-6">
      <div className="container max-w-2xl px-4 py-6">
        {/* Header */}
        <motion.div {...fadeUp(0)} className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">{t("loyalty")}</h1>
          <p className="text-sm text-muted-foreground">
            Earn points, build your streak, and redeem rewards
          </p>
        </motion.div>

        {/* Points & Tier card */}
        <motion.div
          {...fadeUp(1)}
          className="relative mb-6 overflow-hidden rounded-2xl gradient-hero p-5 text-primary-foreground shadow-lg"
        >
          <div className="relative z-10">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium opacity-90">{t("points")} balance</p>
                <p className="text-4xl font-extrabold">{points}</p>
                <p className="mt-1 text-xs opacity-80">points</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/20 px-3 py-1.5 text-sm font-bold">
                <Star size={14} /> {tier}
              </span>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs font-medium opacity-90">
                <span>{tier}</span>
                <span>{nextTier}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary-foreground/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${tierProgress}%` }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="h-full rounded-full bg-accent"
                />
              </div>
              <p className="mt-2 text-xs opacity-80">
                {tier === "Gold" ? "You're at the top tier!" : `Earn more to reach ${nextTier}`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Green Score (Eco-Perks) */}
        <motion.div
          {...fadeUp(2)}
          className="mb-6 rounded-xl border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-green-800 dark:text-green-200">
              <Leaf size={18} />
              Green Score
            </h2>
            <span className="rounded-full bg-green-200 dark:bg-green-800 px-2.5 py-1 text-sm font-bold text-green-800 dark:text-green-200">
              {greenScore} pts
            </span>
          </div>
          <p className="mt-2 text-xs text-green-700 dark:text-green-300">
            Earned by buying eco-disposables and low-waste orders. Redeem for tree-planting below.
          </p>
        </motion.div>

        {/* Streak */}
        <motion.div
          {...fadeUp(3)}
          className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Flame size={18} className="text-accent" />
              Your {t("streak")}
            </h2>
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">
              {streak} days
            </span>
          </div>
          <div className="mb-3 grid grid-cols-10 gap-1.5">
            {streakDays.map((active, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i }}
                className={`flex h-8 w-full items-center justify-center rounded-lg text-[10px] font-bold ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </motion.div>
            ))}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {daysLeft > 0
              ? `${daysLeft} more days of orders to unlock ₹5,000 credit line`
              : "Credit line unlocked! Check Profile for your wallet."}
          </p>
          <Link to="/catalog">
            <Button size="sm" variant="outline" className="w-full gap-1.5">
              <Zap size={14} /> Order today to keep streak
            </Button>
          </Link>
        </motion.div>

        {/* Daily Draw */}
        <motion.div
          {...fadeUp(4)}
          className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <Ticket size={18} className="text-accent" />
            Daily Draws
          </h2>
          <div className="mb-4 rounded-xl bg-accent/10 p-4 text-center">
            <p className="text-sm font-semibold">Spend ₹1,000+ today to enter</p>
            <p className="mt-1 text-xs text-muted-foreground">Next draw at 9 PM tonight</p>
            <Link to="/catalog" className="mt-3 inline-block">
              <Button size="sm" className="gap-1.5">
                {t("browseProducts")} <ChevronRight size={14} />
              </Button>
            </Link>
          </div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Recent winners</p>
          <div className="space-y-2">
            {PAST_WINNERS.map((w) => (
              <div
                key={w.name}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <span className="font-medium">{w.name}</span>
                <span className="text-xs text-muted-foreground">
                  {w.prize} · {w.date}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Redeem Points */}
        <motion.div {...fadeUp(5)}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <Gift size={18} className="text-primary" />
            Redeem {t("points")}
          </h2>
          {/* Tree-planting (Eco redemption via Grow-Trees tie-up) */}
          <div className="mb-4 flex flex-col rounded-xl border-2 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-green-800 dark:text-green-200">
              <Leaf size={20} /> Plant a tree
            </div>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              100 points = 1 tree planted via Grow-Trees (Telangana). No fees.
            </p>
            <Button
              className="mt-3 gap-2 bg-green-600 hover:bg-green-700"
              size="sm"
              disabled={points < TREE_PLANTING_COST || redeemingTree || !user}
              onClick={async () => {
                if (!user?.id || points < TREE_PLANTING_COST) return;
                setRedeemingTree(true);
                try {
                  const { data, error } = await supabase.rpc("redeem_tree_planting", {
                    p_user_id: user.id,
                  });
                  const result = data as { ok?: boolean; error?: string; points_left?: number };
                  if (error) throw new Error(error.message);
                  if (result?.ok) {
                    await refreshProfile();
                    toast.success("Tree planted! Thank you. 🌳");
                  } else {
                    toast.error(result?.error ?? "Not enough points");
                  }
                } catch (e) {
                  toast.error("Could not redeem. Try again.");
                } finally {
                  setRedeemingTree(false);
                }
              }}
            >
              {redeemingTree ? "Redeeming…" : `${TREE_PLANTING_COST} pts → Plant 1 tree`}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {REDEEM_OPTIONS.map((opt) => {
              const canRedeem = points >= opt.points && user && !redeemingRewardId && !redeemingTree;
              const isRedeeming = redeemingRewardId === opt.id;
              return (
                <motion.div
                  key={opt.id}
                  layout
                  className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="mb-2 text-3xl">{opt.emoji}</div>
                  <p className="mb-0.5 text-sm font-semibold leading-tight">{opt.title}</p>
                  <p className="mb-3 text-xs text-muted-foreground">{opt.desc}</p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {opt.points} pts
                    </span>
                    <Button
                      size="sm"
                      variant={canRedeem ? "default" : "outline"}
                      className="min-w-0 flex-1 text-xs"
                      disabled={!canRedeem || isRedeeming}
                      onClick={async () => {
                        if (!canRedeem || !user?.id) return;
                        setRedeemingRewardId(opt.id);
                        try {
                          const { data, error } = await supabase.rpc("redeem_reward", {
                            p_user_id: user.id,
                            p_reward_type: opt.reward_type,
                            p_points_cost: opt.points,
                          });
                          const result = data as { ok?: boolean; error?: string };
                          if (error) throw new Error(error.message);
                          if (result?.ok) {
                            await refreshProfile();
                            toast.success(`Redeemed: ${opt.title}! We'll contact you soon.`);
                          } else {
                            toast.error(result?.error ?? "Not enough points");
                          }
                        } catch {
                          toast.error("Could not redeem. Try again.");
                        } finally {
                          setRedeemingRewardId(null);
                        }
                      }}
                    >
                      {isRedeeming ? "…" : "Redeem"}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* How to earn */}
        <motion.div
          {...fadeUp(6)}
          className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">How to earn more</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Earn points on every order. Build a 30-day streak to unlock credit. Spend ₹1,000+ in a day to enter the daily draw.
              </p>
              <Link to="/catalog" className="mt-3 inline-block">
                <Button size="sm" variant="outline" className="gap-1.5">
                  Order now <ChevronRight size={14} />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
