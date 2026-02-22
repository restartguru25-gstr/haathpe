import { useState, useEffect } from "react";
import { Banknote, ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getVendorWallet,
  getVendorCashTransactions,
  getVendorSettings,
  requestVendorWithdrawal,
  ensureVendorWalletWithSignupBonus,
  type VendorCashTransaction,
} from "@/lib/vendorCashWallet";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  vendorId: string;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getTransactionIcon(t: VendorCashTransaction) {
  if (t.type === "credit") return <ArrowDownLeft size={14} className="text-green-600" />;
  if (t.type === "debit") return <ArrowUpRight size={14} className="text-amber-600" />;
  return <Banknote size={14} className="text-muted-foreground" />;
}

export default function VendorCashWalletSection({ vendorId }: Props) {
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [transactions, setTransactions] = useState<VendorCashTransaction[]>([]);
  const [minWithdrawal, setMinWithdrawal] = useState(499);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  const load = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      await ensureVendorWalletWithSignupBonus(vendorId);
      const [w, txs, settings] = await Promise.all([
        getVendorWallet(vendorId),
        getVendorCashTransactions(vendorId, 20),
        getVendorSettings(),
      ]);
      setWallet(w ? { balance: Number(w.balance) } : null);
      setTransactions(txs);
      if (settings) setMinWithdrawal(Number(settings.min_withdrawal_amount));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    const channel = supabase
      .channel(`vendor_wallet_${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vendor_cash_wallets",
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          try {
            getVendorWallet(vendorId).then((w) => {
              if (w) setWallet({ balance: Number(w.balance) });
            });
          } catch {
            /* ignore */
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vendor_cash_transactions",
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          try {
            getVendorCashTransactions(vendorId, 20).then(setTransactions);
          } catch {
            /* ignore */
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [vendorId]);

  const balance = wallet?.balance ?? 0;
  const canWithdraw = balance >= minWithdrawal;

  const handleWithdrawClick = () => {
    if (!canWithdraw) {
      toast.info(`Minimum ₹${minWithdrawal} required to withdraw`);
      return;
    }
    setWithdrawModalOpen(true);
  };

  const handleConfirmWithdraw = async () => {
    setWithdrawing(true);
    try {
      const res = await requestVendorWithdrawal(vendorId);
      if (res.ok) {
        toast.success("Withdrawal request submitted. Admin will process shortly.");
        setWithdrawModalOpen(false);
        load();
      } else {
        toast.error(res.error ?? "Failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          <span>Loading wallet…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2 font-semibold">
          <Banknote size={20} className="text-primary" />
          <span>Cash Wallet</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">₹{balance.toFixed(2)}</span>
          <span className="text-sm text-muted-foreground">balance</span>
        </div>
        <Button
          onClick={handleWithdrawClick}
          disabled={!canWithdraw}
          variant={canWithdraw ? "default" : "outline"}
          className="w-full sm:w-auto"
        >
          {canWithdraw ? `Withdraw ₹${balance.toFixed(0)}` : `Min ₹${minWithdrawal} to withdraw`}
        </Button>
        {!canWithdraw && balance > 0 && (
          <p className="text-xs text-muted-foreground">
            You need ₹{(minWithdrawal - balance).toFixed(0)} more to withdraw.
          </p>
        )}
        <div>
          <p className="text-sm font-medium mb-2">Recent transactions</p>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getTransactionIcon(t)}
                    <span className="truncate">{t.description ?? t.type}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={
                        t.type === "credit"
                          ? "text-green-600 font-medium"
                          : t.type === "debit"
                            ? "text-amber-600"
                            : "text-muted-foreground"
                      }
                    >
                      {t.type === "credit" ? "+" : t.type === "debit" ? "-" : ""}₹
                      {Number(t.amount).toFixed(2)}
                    </span>
                    {t.status === "pending" && (
                      <span className="text-xs text-amber-600">pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw to UPI/Bank</DialogTitle>
            <DialogDescription>
              Withdraw ₹{balance.toFixed(0)} to your UPI or bank account. Your request will be
              processed by admin. (Payout integration coming soon.)
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmWithdraw} disabled={withdrawing}>
              {withdrawing ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Submitting…
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
