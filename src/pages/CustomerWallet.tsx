import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet, ArrowLeft, LogOut, ChevronRight, Plus, Minus, Gift, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useApp } from "@/contexts/AppContext";
import { getWalletBalanceAndCoins, getWalletTransactions, type WalletTransaction } from "@/lib/wallet";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";

const COUNT_UP_DURATION_MS = 900;

function useCountUp(value: number, enabled: boolean) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  useEffect(() => {
    if (!enabled) {
      setDisplay(value);
      startRef.current = value;
      return;
    }
    const start = startRef.current;
    const diff = value - start;
    startRef.current = value;
    if (diff === 0) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / COUNT_UP_DURATION_MS);
      const easeOut = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + diff * easeOut));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, enabled]);
  return display;
}

export default function CustomerWallet() {
  const { t } = useApp();
  const navigate = useNavigate();
  const { customer, isLoading: authLoading, isCustomer, signOutCustomer } = useCustomerAuth();
  const [balance, setBalance] = useState(0);
  const [coins, setCoins] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const displayBalance = useCountUp(balance, !loading);
  const displayCoins = useCountUp(coins, !loading);

  const load = useCallback(async () => {
    if (!customer?.id) {
      setLoading(false);
      return;
    }
    const [wallet, tx] = await Promise.all([
      getWalletBalanceAndCoins(customer.id),
      getWalletTransactions(customer.id, { limit: 10 }),
    ]);
    setBalance(wallet.balance);
    setCoins(wallet.coins);
    setTransactions(tx);
    setLoading(false);
  }, [customer?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!customer?.id) return;
    const channel = supabase
      .channel(`wallet-${customer.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_wallets", filter: `customer_id=eq.${customer.id}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `customer_id=eq.${customer.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") throw e;
      }
    };
  }, [customer?.id, load]);

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      navigate("/customer-login?returnTo=/customer/wallet", { replace: true });
    }
  }, [authLoading, isCustomer, navigate]);

  const handleLogout = async () => {
    await signOutCustomer();
    navigate("/", { replace: true });
  };

  if (authLoading || !isCustomer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-64 w-80 rounded-2xl" />
      </div>
    );
  }

  const maxBalance = Math.max(balance, 500);
  const progressPercent = Math.min(100, (balance / maxBalance) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E40AF]/10 via-background to-[#F97316]/10">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/customer/orders">
            <Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button>
          </Link>
          <h1 className="font-semibold">{t("customerWallet")}</h1>
          <Button variant="ghost" size="icon" onClick={handleLogout} title={t("customerLogout")}>
            <LogOut size={20} />
          </Button>
        </div>
      </header>

      <div className="container max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <Skeleton className="h-52 rounded-3xl mb-6" />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-[#1E40AF] to-[#F97316] p-6 shadow-xl backdrop-blur-sm"
          >
            <div className="absolute inset-0 bg-black/5" />
            <div className="absolute inset-0 bg-gradient-to-br from-[#1E40AF]/90 to-[#F97316]/90 backdrop-blur-[1px]" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wallet size={20} className="text-white/90" />
                  <span className="text-sm font-medium text-white/90">{t("walletBalance")}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-[#FFD700]/20 px-3 py-1 border border-[#FFD700]/40">
                  <Coins size={16} className="text-[#FFD700]" />
                  <span className="text-sm font-bold text-[#FFD700]">{displayCoins}</span>
                  <span className="text-xs text-white/80">coins</span>
                </div>
              </div>
              <p className="text-4xl font-bold text-white tracking-tight drop-shadow-md">
                ₹{displayBalance.toFixed(0)}
              </p>
              <p className="text-xs text-white/70 mt-1">Available to use or redeem</p>
              <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-white/90"
                />
              </div>
              <Link to="/customer/redemption" className="mt-6 block">
                <Button
                  className="w-full bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#FFD700] border border-[#FFD700]/50 font-semibold"
                  variant="outline"
                >
                  <Gift size={18} className="mr-2" />
                  {t("redeemNow")}
                </Button>
              </Link>
            </div>
          </motion.div>
        )}

        <div className="flex items-center justify-between mt-8 mb-4">
          <h2 className="text-lg font-semibold">{t("recentTransactions")}</h2>
          <Link to="/customer/transactions">
            <Button variant="ghost" size="sm" className="text-primary">
              {t("viewAll")} <ChevronRight size={16} />
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          ) : transactions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-border bg-card/50 backdrop-blur-sm p-8 text-center"
            >
              <p className="text-muted-foreground">{t("noTransactions")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("earnCoinsOnOrder")}</p>
            </motion.div>
          ) : (
            transactions.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.02 }}
                className="flex items-center gap-4 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    tx.type === "credit" ? "bg-green-100 dark:bg-green-900/40" : "bg-red-100 dark:bg-red-900/40"
                  }`}
                >
                  {tx.type === "credit" ? (
                    <Plus size={20} className="text-green-600 dark:text-green-400" />
                  ) : (
                    <Minus size={20} className="text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{tx.description ?? tx.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString()} · {new Date(tx.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`font-semibold block ${
                      tx.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}₹{Number(tx.amount).toFixed(0)}
                  </span>
                  {tx.coins != null && tx.coins > 0 && (
                    <span className="text-xs text-[#B8860B] font-medium">+{tx.coins} coins</span>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
