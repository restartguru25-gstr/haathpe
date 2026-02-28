import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bolt, ArrowLeft, RefreshCw, Loader2, CheckCircle2, XCircle, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useSession } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getInstantFundsCycleState, INSTANT_FUNDS_CYCLES_IST } from "@/lib/instantFunds";
import {
  getVendorWallet,
  getVendorInstantPayoutRequests,
  requestVendorInstantPayout,
  type VendorInstantPayoutRequest,
} from "@/lib/vendorCashWallet";

function statusPill(status: VendorInstantPayoutRequest["status"]) {
  if (status === "processed") return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
  if (status === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
}

function statusIcon(status: VendorInstantPayoutRequest["status"]) {
  if (status === "processed") return <CheckCircle2 size={16} className="text-green-600" />;
  if (status === "rejected") return <XCircle size={16} className="text-red-600" />;
  return <Clock3 size={16} className="text-amber-600" />;
}

export default function VendorPayouts() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useSession();
  const vendorId = user?.id ?? "";

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true, state: { next: "/vendor/payouts" } });
    }
  }, [authLoading, user, navigate]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [eligibleReceiptBalance, setEligibleReceiptBalance] = useState(0);
  const [requests, setRequests] = useState<VendorInstantPayoutRequest[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [amountStr, setAmountStr] = useState<string>("0");

  const [cycleTick, setCycleTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setCycleTick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const liveCycle = useMemo(() => {
    void cycleTick;
    return getInstantFundsCycleState(new Date());
  }, [cycleTick]);

  const load = async (opts?: { silent?: boolean }) => {
    if (!vendorId) return;
    if (!opts?.silent) setLoading(true);
    try {
      const [w, r] = await Promise.all([
        getVendorWallet(vendorId),
        getVendorInstantPayoutRequests(vendorId, 10),
      ]);
      setBalance(Number(w?.balance ?? 0));
      setEligibleReceiptBalance(Number((w as { eligible_receipt_balance?: number })?.eligible_receipt_balance ?? 0));
      setRequests(r);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!vendorId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  useEffect(() => {
    const cap = eligibleReceiptBalance;
    setAmountStr((prev) => {
      const n = Number(prev);
      if (!Number.isFinite(n) || n <= 0) return cap > 0 ? String(Math.floor(cap)) : "0";
      return String(Math.min(n, cap));
    });
  }, [eligibleReceiptBalance]);

  useEffect(() => {
    if (!vendorId) return;
    const channel = supabase
      .channel(`vendor_instant_payouts_${vendorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_cash_wallets", filter: `vendor_id=eq.${vendorId}` },
        () => {
          getVendorWallet(vendorId).then((w) => {
            setBalance(Number(w?.balance ?? 0));
            setEligibleReceiptBalance(Number((w as { eligible_receipt_balance?: number })?.eligible_receipt_balance ?? 0));
          }).catch(() => {});
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_instant_payout_requests", filter: `vendor_id=eq.${vendorId}` },
        () => {
          getVendorInstantPayoutRequests(vendorId, 10).then(setRequests).catch(() => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [vendorId]);

  const minInstant = 100;
  const pendingExists = requests.some((r) => r.status === "pending");
  const amount = Number(amountStr);
  const validAmount = Number.isFinite(amount) && amount >= minInstant && amount <= eligibleReceiptBalance;
  const canRequest = liveCycle.enabled && eligibleReceiptBalance >= minInstant && validAmount && !pendingExists;

  const handleRequest = async () => {
    if (!vendorId) return;
    if (!liveCycle.enabled) {
      toast.info(`Next cycle at ${liveCycle.nextCycleLabel}`);
      return;
    }
    if (eligibleReceiptBalance < minInstant) {
      toast.info("No eligible receipt balance for instant transfer (min ₹100)");
      return;
    }
    if (!validAmount) {
      toast.error("Enter a valid amount (≤ eligible receipt balance ₹" + eligibleReceiptBalance.toFixed(0) + ")");
      return;
    }
    if (pendingExists) {
      toast.info("You already have a pending instant payout request");
      return;
    }
    setRequesting(true);
    try {
      const res = await requestVendorInstantPayout(vendorId, amount);
      if (res.ok) {
        toast.success("Instant payout requested – funds will be settled in next cycle");
        await load({ silent: true });
      } else {
        toast.error(res.error ?? "Could not request instant payout");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setRequesting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load({ silent: true });
      toast.success("Updated");
    } finally {
      setRefreshing(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Skeleton className="h-64 w-[min(520px,90vw)] rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F97316]/10 via-background to-[#1E40AF]/10">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4 max-w-5xl mx-auto">
          <Link to="/sales">
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Bolt size={18} className="text-[#F97316]" />
            <h1 className="font-semibold">Instant Funds</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} aria-label="Refresh">
            {refreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <Skeleton className="h-44 w-full rounded-3xl" />
        ) : (
          <div className="rounded-3xl border border-white/30 bg-gradient-to-br from-[#111827] via-[#1E40AF] to-[#F97316] p-6 text-white shadow-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(1000px_circle_at_20%_10%,rgba(255,215,0,0.18),transparent_55%),radial-gradient(800px_circle_at_80%_30%,rgba(249,115,22,0.22),transparent_55%)]" />
            <div className="relative">
              <p className="text-sm text-white/80">Eligible for instant transfer (customer payments only)</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">₹{eligibleReceiptBalance.toFixed(2)}</p>
              {balance > eligibleReceiptBalance && (
                <p className="mt-1 text-xs text-white/70">Total wallet balance: ₹{balance.toFixed(2)} (bonuses require normal withdrawal)</p>
              )}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <p className="text-sm text-white/85 mb-1">Enter amount (max ₹{eligibleReceiptBalance.toFixed(0)} eligible)</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 backdrop-blur px-3 h-11 flex-1">
                      <span className="text-white/80 font-semibold">₹</span>
                      <Input
                        value={amountStr}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d.]/g, "");
                          setAmountStr(v);
                        }}
                        inputMode="decimal"
                        className="border-0 bg-transparent text-white placeholder:text-white/50 focus-visible:ring-0 p-0 h-auto"
                        placeholder="0"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 border-white/25 bg-white/10 text-white hover:bg-white/15"
                      onClick={() => setAmountStr(String(Math.floor(eligibleReceiptBalance)))}
                      disabled={eligibleReceiptBalance <= 0}
                    >
                      Max
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                      {[25, 50, 75].map((p) => (
                      <Button
                        key={p}
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs border-white/25 bg-white/10 text-white hover:bg-white/15"
                        onClick={() => setAmountStr(String(Math.max(1, Math.round((eligibleReceiptBalance * p) / 100))))}
                        disabled={eligibleReceiptBalance <= 0}
                      >
                        {p}%
                      </Button>
                    ))}
                  </div>
                  {!validAmount && eligibleReceiptBalance >= minInstant && (
                    <p className="mt-2 text-xs text-white/75">Amount must be between ₹{minInstant} and ₹{eligibleReceiptBalance.toFixed(0)} (eligible only).</p>
                  )}
                  {eligibleReceiptBalance > 0 && eligibleReceiptBalance < minInstant && (
                    <p className="mt-2 text-xs text-white/75">Min ₹{minInstant} eligible required for instant transfer.</p>
                  )}
                  {pendingExists && (
                    <p className="mt-2 text-xs text-white/75">You already have a pending request. Wait for admin approval.</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-white/85">
                  {liveCycle.enabled ? (
                    <span>Get funds instantly now · Next cycle at <span className="font-semibold text-[#FFD700]">{liveCycle.nextCycleLabel}</span></span>
                  ) : (
                    <span className="text-white/80">Next cycle at <span className="font-semibold text-[#FFD700]">{liveCycle.nextCycleLabel}</span></span>
                  )}
                </div>
                <Button
                  onClick={handleRequest}
                  disabled={!canRequest || requesting}
                  className="h-11 px-5 font-semibold text-white shadow-lg bg-gradient-to-r from-[#F97316] to-[#FFD700] hover:from-[#FB923C] hover:to-[#FFE08A] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {requesting ? <Loader2 size={18} className="animate-spin mr-2" /> : <span className="mr-2">⚡</span>}
                  Instant Funds
                </Button>
              </div>
              {!liveCycle.enabled && (
                <p className="mt-2 text-xs text-white/75">
                  Requests are blocked outside settlement window (10:30 AM – 8:30 PM IST).
                </p>
              )}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-2">Settlement cycles (IST)</h2>
          <p className="text-sm text-muted-foreground mb-3">Instant payout requests are settled in the next available cycle.</p>
          <div className="flex flex-wrap gap-2">
            {INSTANT_FUNDS_CYCLES_IST.map((c) => (
              <span key={`${c.hour}:${c.minute}`} className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium">
                {String(c.hour).padStart(2, "0")}:{String(c.minute).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <h2 className="font-semibold">Your requests</h2>
            <span className="text-xs text-muted-foreground">Latest 10</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-right p-3 font-semibold">Amount</th>
                  <th className="text-left p-3 font-semibold">Requested</th>
                  <th className="text-left p-3 font-semibold">Processed</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {statusIcon(r.status)}
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill(r.status)}`}>
                          {r.status}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-semibold">₹{Number(r.amount).toFixed(2)}</td>
                    <td className="p-3 text-muted-foreground">{new Date(r.requested_at).toLocaleString()}</td>
                    <td className="p-3 text-muted-foreground">{r.processed_at ? new Date(r.processed_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      No instant payout requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

