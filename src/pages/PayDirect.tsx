import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Wallet, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { createDirectPaymentOrder, getVendorPublicProfile } from "@/lib/sales";
import { awardCoinsForOrder, getCoinsPerPayment } from "@/lib/wallet";
import { createCashfreeSession, openCashfreeCheckout, isCashfreeConfigured } from "@/lib/cashfree";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { AdBanner } from "@/components/AdBanner";
import { useApp } from "@/contexts/AppContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { appendOrderToHistory } from "@/lib/customer";
import { toast } from "sonner";

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

export default function PayDirect() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { t } = useApp();
  const { customer } = useCustomerAuth();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [vendor, setVendor] = useState<{ name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [vendorZone, setVendorZone] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    getVendorPublicProfile(vendorId).then((profile) => {
      setVendor(profile ? { name: profile.name } : null);
      setVendorZone(profile?.zone ?? null);
      setLoading(false);
    });
  }, [vendorId]);

  const amountNum = Math.max(0, parseFloat(amount.replace(/[^\d.]/g, "")) || 0);
  const displayAmount = amountNum > 0 ? amountNum : "";
  const canPay = amountNum >= 1;

  const addDigit = (d: string) => {
    if (d === ".") {
      if (amount.includes(".")) return;
      setAmount((prev) => (prev === "" ? "0." : prev + "."));
      return;
    }
    if (d === "⌫") {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }
    if (amount.replace(/[^\d]/g, "").length >= 6) return; // max 6 digits before decimal
    setAmount((prev) => {
      if (prev === "0" && d !== ".") return d;
      return prev + d;
    });
  };

  const setQuickAmount = (val: number) => {
    setAmount(String(val));
  };

  const handlePay = async () => {
    if (!vendorId || !canPay) return;
    setPaying(true);
    try {
      const result = await createDirectPaymentOrder(vendorId, amountNum, {
        customerPhone: customer?.phone ?? null,
        customerId: customer?.id ?? null,
        note: note.trim() || undefined,
      });
      if (result.ok && result.id) {
        const vendorName = vendor?.name ?? "Dukaanwaala";

        if (isCashfreeConfigured()) {
          const returnUrl = `${window.location.origin}/payment/return?order_id=${result.id}`;
          const sessionRes = await createCashfreeSession({
            order_id: result.id,
            order_amount: amountNum,
            customer_phone: customer?.phone ?? undefined,
            customer_id: customer?.id ?? undefined,
            return_url: returnUrl,
            order_note: `Direct payment ₹${amountNum} – ${vendorName}`,
          });
          if (sessionRes.ok) {
            setPaying(false);
            await openCashfreeCheckout(sessionRes.payment_session_id);
            return;
          }
          toast.error(sessionRes.error ?? "Payment gateway error");
        }

        setOrderId(result.id);
        setDone(true);
        if (customer && result.id) {
          await appendOrderToHistory(customer.id, {
            order_id: result.id,
            vendor_id: vendorId,
            vendor_name: vendor?.name ?? undefined,
            total: amountNum,
            items: [{ item_name: "Direct payment", qty: 1, price: amountNum }],
            created_at: new Date().toISOString(),
          });
          const coins = await getCoinsPerPayment();
          const awardRes = await awardCoinsForOrder(result.id, customer.id, coins);
          if (awardRes.ok && coins > 0) {
            toast.success(t("congratulationsCoins").replace("{n}", String(coins)));
          } else {
            toast.success("Payment request sent! Pay at the counter.");
          }
        } else {
          toast.success("Payment request sent! Pay at the counter.");
        }
      } else {
        toast.error(result.error ?? "Failed");
      }
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 animate-pulse" />
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        <MakeInIndiaFooter />
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground">Invalid link.</p>
        <Link to="/" className="mt-4"><Button>Go home</Button></Link>
        <MakeInIndiaFooter />
      </div>
    );
  }

  const vendorName = vendor?.name ?? "Dukaanwaala";

  if (done) {
    const trackingUrl = typeof window !== "undefined" ? `${window.location.origin}/order/${orderId}` : "";
    const handleCopy = () => {
      if (!trackingUrl) return;
      navigator.clipboard.writeText(trackingUrl).then(() => toast.success("Link copied!"));
    };
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 dark:from-green-950/20 via-background to-background flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm text-center"
          >
            <div className="rounded-full h-20 w-20 mx-auto mb-6 flex items-center justify-center bg-green-100 dark:bg-green-900/40">
              <Check size={40} className="text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Payment request sent</h2>
            <p className="text-muted-foreground mb-6">
              Pay ₹{amountNum.toFixed(0)} at the counter. {vendorName} has been notified.
            </p>
            <div className="rounded-2xl border border-border bg-card p-4 mb-6">
              <p className="text-xs text-muted-foreground mb-1">Order ID</p>
              <p className="font-mono text-sm break-all mb-3">{orderId}</p>
              <Link to={`/order/${orderId}`}>
                <Button variant="outline" className="w-full mb-2">{t("trackOrder")}</Button>
              </Link>
              <Button variant="secondary" size="sm" className="w-full gap-2" onClick={handleCopy}>
                <Copy size={16} /> {t("shareTracking")}
              </Button>
            </div>
            <Link to={`/menu/${vendorId}`}>
              <Button variant="ghost">Back to {vendorName}</Button>
            </Link>
          </motion.div>
        </div>
        <MakeInIndiaFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/[0.03] via-background to-background flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link to={`/menu/${vendorId}`}>
            <Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{vendorName}</p>
            <p className="text-xs text-muted-foreground">Pay directly</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col px-4 py-6 max-w-md mx-auto w-full">
        {/* Amount display */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <p className="text-sm font-medium text-muted-foreground mb-2">Enter amount</p>
          <div className="relative inline-flex items-baseline">
            <motion.span
              key={displayAmount}
              initial={{ opacity: 0.8, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl font-extrabold text-foreground tabular-nums"
            >
              {displayAmount ? `₹${Number(displayAmount).toLocaleString("en-IN")}` : "₹0"}
            </motion.span>
          </div>
        </motion.div>

        {/* Quick amounts */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {QUICK_AMOUNTS.map((val) => (
            <motion.button
              key={val}
              whileTap={{ scale: 0.96 }}
              onClick={() => setQuickAmount(val)}
              className="rounded-xl border-2 border-border bg-card py-3 text-sm font-semibold transition-all hover:border-primary/40 hover:bg-primary/5"
            >
              ₹{val}
            </motion.button>
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((key) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.95 }}
              onClick={() => addDigit(key)}
              className="h-14 rounded-xl bg-muted/50 text-lg font-semibold transition-colors hover:bg-muted active:bg-muted/80"
            >
              {key}
            </motion.button>
          ))}
        </div>

        <div className="mb-4 max-w-[280px] mx-auto">
          <AdBanner vendorId={vendorId} vendorZone={vendorZone} page="pay" variant="compact" />
        </div>

        {/* Optional note */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Pay button */}
        <div className="mt-auto pt-4">
          <motion.div
            whileTap={canPay ? { scale: 0.98 } : {}}
            className="rounded-2xl bg-primary p-1 shadow-lg shadow-primary/25"
          >
            <Button
              className="w-full h-14 text-lg font-bold rounded-xl gap-2"
              disabled={!canPay || paying}
              onClick={handlePay}
            >
              <Wallet size={22} />
              {paying ? "Processing…" : `Pay ₹${amountNum > 0 ? amountNum.toLocaleString("en-IN") : "0"}`}
            </Button>
          </motion.div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {isCashfreeConfigured()
              ? "Pay online with card/UPI or pay at the counter."
              : "Pay at the counter. UPI & card payments coming soon."}
          </p>
        </div>
      </div>
      <MakeInIndiaFooter />
    </div>
  );
}
