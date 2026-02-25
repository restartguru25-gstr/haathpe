/**
 * Rental Income — vendor incentive dashboard (DOCILE ONLINE MART PRIVATE LIMITED / haathpe).
 * Shows current month volume, tier, projected payout, slab table, and payout history.
 */
import { useEffect, useState } from "react";
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
import { Banknote, TrendingUp, Calendar } from "lucide-react";
import {
  getRentalIncomeSummary,
  getRentalPayoutHistory,
  type RentalIncomeSummary,
  type RentalPayoutRow,
} from "@/lib/rentalIncome";
import { getSlabsForTable } from "@/lib/rentalIncomeSlabs";

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

export default function RentalIncome() {
  const { user } = useSession();
  const [summary, setSummary] = useState<RentalIncomeSummary | null>(null);
  const [history, setHistory] = useState<RentalPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [s, h] = await Promise.all([
        getRentalIncomeSummary(user.id),
        getRentalPayoutHistory(user.id, 6),
      ]);
      if (!cancelled) {
        setSummary(s);
        setHistory(h);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

      {/* Current month summary */}
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
              <p className="text-lg font-semibold">
                {summary ? formatCurrency(summary.payout) : "₹0"}
              </p>
              <p className="text-xs text-muted-foreground">Projected credit (to Cash Wallet)</p>
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
            Monthly transaction value (₹) determines the amount credited to your Cash Wallet.
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
