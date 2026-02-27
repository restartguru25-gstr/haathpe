import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { useApp } from "@/contexts/AppContext";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrderForTracking } from "@/lib/sales";
import { supabase } from "@/lib/supabase";
import { awardCoinsForPaidOrder, getCoinsPerPayment } from "@/lib/wallet";
import { speakPaymentSuccessForCustomer } from "@/lib/paymentNotification";
import { toast } from "sonner";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import CongratsOverlay from "@/components/CongratsOverlay";
import { isCcavenueConfigured } from "@/lib/ccavenue";

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");
  const { lang } = useApp();
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [isPremiumPayment, setIsPremiumPayment] = useState(false);
  const [congrats, setCongrats] = useState<{ coins: number; cashback: number } | null>(null);
  const [showCongratsOverlay, setShowCongratsOverlay] = useState(false);
  const awardCalled = useRef(false);
  const finalizedByServer = useRef(false);
  const paidAmountRef = useRef<number | undefined>(undefined);
  const voiceSpokenRef = useRef(false);

  useEffect(() => {
    if (!orderId) {
      setStatus("error");
      return;
    }

    const run = async () => {
      const isPremium = orderId.startsWith("prem_");
      setIsPremiumPayment(isPremium);

      // Catalog order flow or customer_orders (PublicMenu/PayDirect)
      const maxAttempts = 8;
      const pollIntervalMs = 3500;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Premium: server updates profile; here we just wait a bit then show paid (best-effort)
        if (isPremium) {
          setStatus("pending");
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          paidAmountRef.current = 99;
          setStatus("paid");
          return;
        }

        const tracked = await getOrderForTracking(orderId);
        if (tracked) {
          if (tracked.status === "paid") {
            paidAmountRef.current = undefined;
            setStatus("paid");
            return;
          }
          setStatus("pending");
        } else {
          const { data: dbOrder } = await supabase
            .from("orders")
            .select("id, status, total")
            .eq("id", orderId)
            .maybeSingle();
          if (dbOrder?.status === "paid") {
            paidAmountRef.current = dbOrder?.total != null ? Number(dbOrder.total) : undefined;
            setStatus("paid");
            return;
          }
          setStatus(dbOrder?.status ? "pending" : "pending");
        }

        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, pollIntervalMs));
        }
      }

      setStatus("pending");
    };

    run().catch(() => setStatus("error"));
  }, [orderId]);

  useEffect(() => {
    if (status !== "paid" || voiceSpokenRef.current) return;
    voiceSpokenRef.current = true;
    const amount = paidAmountRef.current;
    speakPaymentSuccessForCustomer(lang as "en" | "hi" | "te", amount);
  }, [status, lang]);

  useEffect(() => {
    if (status !== "paid" || !orderId || awardCalled.current || finalizedByServer.current) return;
    if (orderId.startsWith("prem_")) return;
    awardCalled.current = true;
    awardCoinsForPaidOrder(orderId)
      .then((res) => {
        if (res.ok && (res.coins != null || res.cashback != null)) {
          setCongrats({ coins: res.coins ?? 2, cashback: res.cashback ?? 2 });
          setShowCongratsOverlay(true);
        } else if (res.ok) {
          getCoinsPerPayment().then((c) => {
            setCongrats({ coins: c, cashback: 2 });
            setShowCongratsOverlay(true);
          });
        }
      })
      .catch(() => {});
  }, [status, orderId]);

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col pb-24">
      <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border/50 bg-background/95 backdrop-blur-md px-4">
        <BackButton fallbackTo="/" />
      </header>
      {showCongratsOverlay && congrats && (
        <CongratsOverlay
          coins={congrats.coins}
          cashback={congrats.cashback}
          onComplete={() => setShowCongratsOverlay(false)}
        />
      )}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Checking payment status…</p>
          </div>
        )}

        {status === "paid" && (
          <div className="w-full max-w-sm text-center">
            <div className="rounded-full h-20 w-20 mx-auto mb-6 flex items-center justify-center bg-green-100 dark:bg-green-900/40">
              <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {isPremiumPayment ? "Premium activated!" : "Payment successful"}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {isPremiumPayment
                ? "Your dukaan now has boosted search, priority listing, and more. Enjoy!"
                : "Your payment has been received. The dukaanwaala will be notified."}
            </p>
            {isPremiumPayment ? (
              <>
                <Link to="/sales">
                  <Button className="w-full">Go to My Shop</Button>
                </Link>
                <Link to="/" className="block mt-3">
                  <Button variant="ghost" className="w-full">Back to home</Button>
                </Link>
              </>
            ) : (
              <>
                <Link to={orderId ? `/order/${orderId}` : "/"}>
                  <Button className="w-full">Track order</Button>
                </Link>
                <Link to="/orders" className="block mt-2">
                  <Button variant="outline" className="w-full">View my orders</Button>
                </Link>
                <Link to="/" className="block mt-3">
                  <Button variant="ghost" className="w-full">Back to home</Button>
                </Link>
              </>
            )}
          </div>
        )}

        {status === "pending" && (
          <div className="w-full max-w-sm text-center">
            <div className="rounded-full h-20 w-20 mx-auto mb-6 flex items-center justify-center bg-amber-100 dark:bg-amber-900/40">
              <Loader2 className="h-10 w-10 text-amber-600 dark:text-amber-400 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Payment processing</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Your payment may still be processing. You can track the order below. If money was deducted, the order will be marked paid shortly.
            </p>
            <Link to={orderId ? `/order/${orderId}` : "/"}>
              <Button className="w-full">Track order</Button>
            </Link>
            <Link to="/" className="block mt-3">
              <Button variant="ghost" className="w-full">Back to home</Button>
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="w-full max-w-sm text-center">
            <div className="rounded-full h-20 w-20 mx-auto mb-6 flex items-center justify-center bg-muted">
              <X className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
            <p className="text-muted-foreground text-sm mb-6">
              {orderId
                ? "We couldn't find this order or verify payment. If you paid, the dukaanwaala will still receive it."
                : "No order ID in the link. Use the link you got after placing the order."}
            </p>
            {!orderId && !isCcavenueConfigured() && (
              <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Payment gateway is not configured</p>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                  Configure Supabase secrets for CCAvenue and deploy the Edge Functions <strong>create-cca-order</strong> and <strong>verify-cca-payment</strong>.
                </p>
              </div>
            )}
            <Link to="/">
              <Button className="w-full">Back to home</Button>
            </Link>
          </div>
        )}
      </div>
      <MakeInIndiaFooter />
    </div>
  );
}
