/**
 * Rental Income — vendor incentive dashboard (DOCILE ONLINE MART PRIVATE LIMITED / haathpe).
 * Prorated by successful days (≥9 paid tx/day). Shows volume, tier, projected payout, slab table, payout history.
 */
import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote, TrendingUp, Calendar, Target, Zap } from "lucide-react";
import {
  getRentalIncomeSummary,
  getRentalPayoutHistory,
  type RentalIncomeSummary,
  type RentalPayoutRow,
} from "@/lib/rentalIncome";
import { getSlabsForTable } from "@/lib/rentalIncomeSlabs";
import { supabase } from "@/lib/supabase";

function formatMonth(YYYYMM: string): string {
  const [y, m] = YYYYMM.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

const SUCCESSFUL_DAY_MIN_TX = 9;

export default function RentalIncome() {
  const { user } = useSession();
  const [summary, setSummary] = useState<RentalIncomeSummary | null>(null);
  const [history, setHistory] = useState<RentalPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    const [s, h] = await Promise.all([
      getRentalIncomeSummary(user.id),
      getRentalPayoutHistory(user.id, 6),
    ]);
    setSummary(s);
    setHistory(h);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await fetchData();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, fetchData]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("rental-income-activity")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vendor_daily_activity",
          filter: `vendor_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchData]);

  const slabs = getSlabsForTable();
  const progressPercent =
    summary && summary.nextTierAt != null && summary.nextTierAt > 0
      ? Math.min(100, (summary.volume / summary.nextTierAt) * 100)
      : 100;

  if (loading) {
    return (
      <div className="container max-w-2xl px-4 py-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Banknote className="size-5 text-primary" />
          Rental Income
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Earn monthly income based on your sales volume. Amount is credited to your Cash Wallet at month-end — use it for purchases or withdraw.
        </p>
      </div>

      {/* Successful days + projected rental income */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            Successful days & projected rental income
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Credit = slab × (successful days ÷ 30). A day counts if you have 9+ paid transactions.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-2xl font-bold text-primary">
                {summary ? `${summary.successfulDays} / 30` : "0 / 30"}
              </p>
              <p className="text-xs text-muted-foreground">Successful days so far</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">
                {summary ? formatCurrency(summary.projectedPayout) : "₹0"}
              </p>
              <p className="text-xs text-muted-foreground">Projected Rental Income (to Cash Wallet)</p>
            </div>
          </div>
          <Progress
            value={summary ? (summary.successfulDays / 30) * 100 : 0}
            className="h-3"
          />
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 flex items-center gap-2">
            <Target className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Hit {SUCCESSFUL_DAY_MIN_TX}+ paid transactions today to count this day. Today: {summary?.todayTxCount ?? 0} paid tx.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current month volume + tier */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="size-4" />
            {summary ? formatMonth(summary.month) : "Current month"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-2xl font-bold text-primary">
                {summary ? formatCurrency(summary.volume) : "₹0"}
              </p>
              <p className="text-xs text-muted-foreground">Transaction volume (paid orders)</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">
                {summary ? formatCurrency(summary.payout) : "₹0"} max if 30 successful days
              </p>
            </div>
          </div>
          {summary && summary.nextTierAt != null && summary.nextTierPayout != null && summary.payout < summary.nextTierPayout && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress to next tier</span>
                <span>
                  {formatCurrency(summary.volume)} / {formatCurrency(summary.nextTierAt)} — Unlock {formatCurrency(summary.nextTierPayout)}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}
          {summary && (
            <Badge variant="secondary" className="text-xs">
              Tier: {summary.tierLabel}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Slab table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rental income slabs</CardTitle>
          <p className="text-xs text-muted-foreground">
            Monthly transaction value (₹) sets your slab. Actual credit = slab × (successful days ÷ 30).
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Volume (₹)</TableHead>
                  <TableHead className="text-xs text-right">Credit to wallet (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slabs.map((row) => (
                  <TableRow key={row.minVolume}>
                    <TableCell className="text-xs py-2">{row.label}</TableCell>
                    <TableCell className="text-xs text-right py-2 font-medium">
                      {row.payout}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payout history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4" />
            Credit history
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Last 6 months. Amount is credited to your Cash Wallet at month-end; use wallet for purchases or withdraw.
          </p>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No payout history yet. Complete more paid orders to earn rental income.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Month</TableHead>
                  <TableHead className="text-xs text-right">Volume</TableHead>
                  <TableHead className="text-xs text-right">Success days</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs py-2">
                        {formatMonth(row.month)}
                      </TableCell>
                      <TableCell className="text-xs text-right py-2">
                        {formatCurrency(Number(row.transaction_volume))}
                      </TableCell>
                      <TableCell className="text-xs text-right py-2">
                        {row.successful_days != null ? `${row.successful_days}/30` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right py-2 font-medium">
                        {formatCurrency(Number(row.incentive_amount))}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant={row.status === "paid" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {row.status === "paid" ? "Paid" : "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
