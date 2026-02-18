import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet, ArrowLeft, LogOut, ChevronRight, Plus, Minus, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useApp } from "@/contexts/AppContext";
import { getWalletBalance, getWalletTransactions, type WalletTransaction } from "@/lib/wallet";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerWallet() {
  const { t } = useApp();
  const navigate = useNavigate();
  const { customer, isLoading: authLoading, isCustomer, signOutCustomer } = useCustomerAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!customer?.id) {
      setLoading(false);
      return;
    }
    const [bal, tx] = await Promise.all([
      getWalletBalance(customer.id),
      getWalletTransactions(customer.id, { limit: 10 }),
    ]);
    setBalance(bal);
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
      supabase.removeChannel(channel);
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
          <Skeleton className="h-48 rounded-3xl mb-6" />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E40AF] to-[#F97316] p-6 shadow-xl"
          >
            <div className="absolute inset-0 bg-black/5" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={20} className="text-white/90" />
                <span className="text-sm font-medium text-white/90">{t("walletBalance")}</span>
              </div>
              <p className="text-4xl font-bold text-white tracking-tight">₹{balance.toFixed(0)}</p>
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
                  className="w-full bg-white/20 hover:bg-white/30 text-white border-0"
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
              className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center"
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
                whileHover={{ scale: 1.01 }}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
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
                <span
                  className={`font-semibold ${
                    tx.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {tx.type === "credit" ? "+" : "-"}₹{Number(tx.amount).toFixed(0)}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
