import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRiderAuth } from "@/contexts/RiderAuthContext";
import {
  getRiderTransactions,
  getRiderScansThisMonth,
  riderRequestWithdrawal,
  getRiderQrLink,
  getRiderSettings,
} from "@/lib/riders";
import { supabase } from "@/lib/supabase";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { toast } from "sonner";
import {
  Loader2,
  Bike,
  Wallet,
  QrCode,
  Download,
  Printer,
  ArrowLeft,
  LogOut,
  Scan,
  Banknote,
} from "lucide-react";
import BackButton from "@/components/BackButton";

export default function RiderDashboard() {
  const navigate = useNavigate();
  const { rider, isLoading: authLoading, isRider, refreshRider } = useRiderAuth();
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof getRiderTransactions>>>([]);
  const [scansThisMonth, setScansThisMonth] = useState(0);
  const [minWithdrawal, setMinWithdrawal] = useState(499);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async () => {
    if (!rider) return;
    setLoading(true);
    try {
      const [txs, scans, settings] = await Promise.all([
        getRiderTransactions(rider.id, 20),
        getRiderScansThisMonth(rider.id),
        getRiderSettings(),
      ]);
      setTransactions(txs);
      setScansThisMonth(scans);
      const s = settings.find((x) => x.vehicle_type === rider.vehicle_type);
      if (s) setMinWithdrawal(s.min_withdrawal);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [rider]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!rider) return;
    const channel = supabase
      .channel(`rider-${rider.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "riders", filter: `id=eq.${rider.id}` },
        () => {
          refreshRider();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rider_transactions", filter: `rider_id=eq.${rider.id}` },
        () => {
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [rider?.id, refreshRider, load]);

  useEffect(() => {
    if (!authLoading && !isRider) {
      navigate("/rider-signup", { replace: true });
    }
  }, [authLoading, isRider, navigate]);

  const handleWithdraw = async () => {
    if (!rider) return;
    const bal = Number(rider.balance);
    if (bal < minWithdrawal) {
      toast.error(`Minimum withdrawal is ₹${minWithdrawal}`);
      return;
    }
    setWithdrawing(true);
    try {
      const result = await riderRequestWithdrawal(rider.id, bal);
      if (result.ok) {
        toast.success("Withdrawal request submitted. You will receive ₹" + bal + " as per process.");
        await refreshRider();
        load();
      } else {
        toast.error(result.error ?? "Withdrawal failed");
      }
    } catch {
      toast.error("Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    navigate("/", { replace: true });
  };

  if (authLoading || !rider) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col">
        <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border/50 bg-background/95 backdrop-blur-md px-4">
          <BackButton fallbackTo="/" />
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <MakeInIndiaFooter />
      </div>
    );
  }

  const qrLink = getRiderQrLink(rider.id, rider.qr_code_text);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrLink)}`;
  const balance = Number(rider.balance);
  const canWithdraw = balance >= minWithdrawal;

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col pb-24">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/50 bg-background/95 backdrop-blur-md px-4">
        <BackButton fallbackTo="/" />
        <span className="font-semibold">Rider dashboard</span>
        <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
          <LogOut size={18} />
        </Button>
      </header>

      <div className="container max-w-lg mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bike size={18} /> {rider.vehicle_type}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {rider.verified ? "Verified" : "Pending verification"} · {rider.phone}
            </p>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet size={18} /> Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">₹{balance.toFixed(0)}</p>
            {canWithdraw ? (
              <Button
                className="mt-3 w-full"
                onClick={handleWithdraw}
                disabled={withdrawing}
              >
                {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote size={16} />}
                {withdrawing ? " Processing…" : ` Withdraw ₹${balance.toFixed(0)}`}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">
                Min withdrawal ₹{minWithdrawal}. Keep scanning to earn more.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Scan size={18} /> This month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{scansThisMonth}</p>
            <p className="text-sm text-muted-foreground">QR scans (orders via your link)</p>
            {scansThisMonth >= 50 && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">+20% bonus on rental</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode size={18} /> Your QR code
            </CardTitle>
            <p className="text-sm text-muted-foreground">Share so customers can search & order</p>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <img
              src={qrImageUrl}
              alt="QR code"
              className="w-[180px] h-[180px] border border-border rounded-lg"
            />
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = qrImageUrl;
                  a.download = `rider-qr-${rider.qr_code_text.slice(0, 8)}.png`;
                  a.click();
                }}
              >
                <Download size={14} /> Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const w = window.open("", "_blank");
                  if (w) {
                    w.document.write(
                      `<html><body style="display:flex;flex-direction:column;align-items:center;padding:24px;font-family:system-ui"><img src="${qrImageUrl}" alt="QR"/><p>Scan to order via haathpe</p></body></html>`
                    );
                    w.document.close();
                    w.print();
                    w.close();
                  }
                }}
              >
                <Printer size={14} /> Print
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <ul className="space-y-2">
                {transactions.slice(0, 10).map((tx) => (
                  <li key={tx.id} className="flex justify-between text-sm border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">
                      {tx.type === "rental_credit" && "Rental credit"}
                      {tx.type === "withdrawal" && "Withdrawal"}
                      {tx.type === "adjustment" && "Adjustment"}
                      {tx.description && ` · ${tx.description}`}
                    </span>
                    <span className={tx.amount >= 0 ? "text-green-600" : "text-red-600"}>
                      {tx.amount >= 0 ? "+" : ""}₹{Number(tx.amount).toFixed(0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <MakeInIndiaFooter />
    </div>
  );
}
