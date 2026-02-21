import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrderForTracking } from "@/lib/sales";
import { supabase } from "@/lib/supabase";
import {
  createCashfreeSession,
  isCashfreeConfigured,
  getCashfreeConfigStatus,
  verifyCashfreePayment,
  getPendingOrder,
  clearPendingOrder,
  finalizeOrderAfterPayment,
} from "@/lib/cashfree";
import {
  getPendingPremium,
  clearPendingPremium,
  finalizePremiumAfterPayment,
} from "@/lib/premium";
import { awardCoinsForPaidOrder, getCoinsPerPayment } from "@/lib/wallet";
import { toast } from "sonner";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import CongratsOverlay from "@/components/CongratsOverlay";

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [isPremiumPayment, setIsPremiumPayment] = useState(false);
  const [testingGateway, setTestingGateway] = useState(false);
  const [congrats, setCongrats] = useState<{ coins: number; cashback: number } | null>(null);
  const [showCongratsOverlay, setShowCongratsOverlay] = useState(false);
  const awardCalled = useRef(false);
  const finalizedByServer = useRef(false);

  useEffect(() => {
    if (!orderId) {
      setStatus("error");
      return;
    }

    const isPremium = orderId.startsWith("prem_");

    const run = async () => {
      if (isPremium) {
        setIsPremiumPayment(true);
        // Premium flow: verify Cashfree, finalize premium
        let verify = await verifyCashfreePayment(orderId);
        const maxAttempts = 8;
        const pollIntervalMs = 3500;
        for (let attempt = 1; attempt <= maxAttempts && !verify.paid; attempt++) {
          if (!verify.ok) {
            setStatus("error");
            return;
          }
          if (verify.paid) break;
          if (attempt < maxAttempts) {
            setStatus("pending");
            await new Promise((r) => setTimeout(r, pollIntervalMs));
            verify = await verifyCashfreePayment(orderId);
          }
        }
        if (!verify.ok || !verify.paid) {
          setStatus(verify.ok ? "pending" : "error");
          return;
        }
        const pending = getPendingPremium();
        if (!pending || pending.orderId !== orderId) {
          setStatus("error");
          return;
        }
        const finalize = await finalizePremiumAfterPayment(pending);
        if (!finalize.ok) {
          setStatus("error");
          return;
        }
        clearPendingPremium();
        finalizedByServer.current = true;
        setStatus("paid");
        return;
      }

      // Catalog order flow
      const tracked = await getOrderForTracking(orderId);
      if (tracked) {
        setStatus(tracked.status === "paid" ? "paid" : "pending");
        return;
      }
      const { data: dbOrder } = await supabase.from("orders").select("id, status").eq("id", orderId).single();
      if (dbOrder?.status) {
        setStatus(dbOrder.status === "paid" ? "paid" : "pending");
        return;
      }

      let verify = await verifyCashfreePayment(orderId);
      const maxAttempts = 8;
      const pollIntervalMs = 3500;
      for (let attempt = 1; attempt <= maxAttempts && !verify.paid; attempt++) {
        if (!verify.ok) {
          setStatus("error");
          return;
        }
        if (verify.paid) break;
        if (attempt < maxAttempts) {
          setStatus("pending");
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          verify = await verifyCashfreePayment(orderId);
        }
      }
      if (!verify.ok || !verify.paid) {
        setStatus(verify.ok ? "pending" : "error");
        return;
      }

      const pending = getPendingOrder();
      if (!pending || pending.orderId !== orderId) {
        setStatus("error");
        return;
      }

      const finalize = await finalizeOrderAfterPayment(pending);
      if (!finalize.ok) {
        setStatus("error");
        return;
      }

      clearPendingOrder();
      finalizedByServer.current = true;
      setStatus("paid");
      if (finalize.coins != null || finalize.cashback != null) {
        setCongrats({ coins: finalize.coins ?? 2, cashback: finalize.cashback ?? 2 });
        setShowCongratsOverlay(true);
      }
    };

    run().catch(() => setStatus("error"));
  }, [orderId]);

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
            {!orderId && !isCashfreeConfigured() && (
              <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Cashfree is not configured</p>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">Missing: <strong>{getCashfreeConfigStatus().missing ?? "VITE_CASHFREE_APP_ID"}</strong>. Add it (and VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) in <strong>Vercel → Environment Variables</strong>, then <strong>redeploy</strong>. Without this, checkout will not redirect to Cashfree.</p>
              </div>
            )}
            {!orderId && isCashfreeConfigured() && (
              <div className="mb-6 p-4 rounded-lg border border-border bg-muted/30">
                <p className="text-sm text-muted-foreground mb-2">Verify Cashfree gateway</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={testingGateway}
                  onClick={async () => {
                    setTestingGateway(true);
                    try {
                      const origin = window.location.origin;
                      const returnUrl = origin.startsWith("https://")
                        ? `${origin}/payment/return`
                        : "https://example.com/payment/return";
                      const res = await createCashfreeSession({
                        order_id: `test-${Date.now()}`,
                        order_amount: 1,
                        return_url: returnUrl,
                      });
                      if (res.ok) {
                        toast.success("Cashfree is working. You received a payment session ID.");
                      } else {
                        toast.error(res.error ?? "Cashfree gateway error");
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "Connection failed";
                      const isFailedFetch = /failed to fetch|network error/i.test(msg);
                      toast.error(
                        isFailedFetch
                          ? "Could not reach the payment server. Deploy the Edge Function 'create-cashfree-order' to your Supabase project and ensure the app URL is allowed."
                          : msg
                      );
                    } finally {
                      setTestingGateway(false);
                    }
                  }}
                >
                  {testingGateway ? "Testing…" : "Test Cashfree connection"}
                </Button>
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
