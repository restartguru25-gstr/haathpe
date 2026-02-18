import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, LogOut, Plus, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useApp } from "@/contexts/AppContext";
import { getWalletTransactions, type WalletTransaction } from "@/lib/wallet";
import { Skeleton } from "@/components/ui/skeleton";

type FilterType = "all" | "credit" | "debit";

export default function CustomerTransactions() {
  const { t } = useApp();
  const navigate = useNavigate();
  const { customer, isLoading: authLoading, isCustomer, signOutCustomer } = useCustomerAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  const load = useCallback(async () => {
    if (!customer?.id) {
      setLoading(false);
      return;
    }
    const list = await getWalletTransactions(customer.id, {
      limit: 50,
      type: filter === "all" ? undefined : filter,
    });
    setTransactions(list);
    setLoading(false);
  }, [customer?.id, filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      navigate("/customer-login?returnTo=/customer/transactions", { replace: true });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E40AF]/5 via-background to-[#F97316]/5">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/customer/wallet">
            <Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button>
          </Link>
          <h1 className="font-semibold">{t("customerTransactions")}</h1>
          <Button variant="ghost" size="icon" onClick={handleLogout} title={t("customerLogout")}>
            <LogOut size={20} />
          </Button>
        </div>
        <div className="flex gap-2 px-4 pb-3">
          {(["all", "credit", "debit"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? t("all") : f === "credit" ? t("credit") : t("debit")}
            </Button>
          ))}
        </div>
      </header>

      <div className="container max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center"
          >
            <p className="text-muted-foreground">{t("noTransactions")}</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
                whileHover={{ scale: 1.01 }}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    tx.type === "credit"
                      ? "bg-green-100 dark:bg-green-900/40"
                      : tx.type === "redemption"
                        ? "bg-amber-100 dark:bg-amber-900/40"
                        : "bg-red-100 dark:bg-red-900/40"
                  }`}
                >
                  {tx.type === "credit" ? (
                    <Plus size={24} className="text-green-600 dark:text-green-400" />
                  ) : tx.type === "redemption" ? (
                    <RotateCcw size={24} className="text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Minus size={24} className="text-red-600 dark:text-red-400" />
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
                    className={`font-bold block ${
                      tx.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}₹{Number(tx.amount).toFixed(0)}
                  </span>
                  {tx.coins != null && tx.coins > 0 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">+{tx.coins} coins</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
