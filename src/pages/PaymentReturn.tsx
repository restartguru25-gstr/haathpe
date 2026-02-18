import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrderForTracking } from "@/lib/sales";
import { supabase } from "@/lib/supabase";
import { createCashfreeSession, isCashfreeConfigured } from "@/lib/cashfree";
import { toast } from "sonner";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [testingGateway, setTestingGateway] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setStatus("error");
      return;
    }
    getOrderForTracking(orderId)
      .then((order) => {
        if (order) {
          setStatus(order.status === "paid" ? "paid" : "pending");
          return undefined;
        }
        return supabase.from("orders").select("id, status").eq("id", orderId).single();
      })
      .then((res) => {
        if (res === undefined) return;
        const data = (res as { data?: { status?: string } | null }).data;
        if (data?.status) setStatus(data.status === "paid" ? "paid" : "pending");
        else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [orderId]);

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col pb-24">
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
            <h2 className="text-xl font-bold text-foreground mb-2">Payment successful</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Your payment has been received. The dukaanwaala will be notified.
            </p>
            <Link to={orderId ? `/order/${orderId}` : "/"}>
              <Button className="w-full">Track order</Button>
            </Link>
            <Link to="/orders" className="block mt-2">
              <Button variant="outline" className="w-full">View my orders</Button>
            </Link>
            <Link to="/" className="block mt-3">
              <Button variant="ghost" className="w-full">Back to home</Button>
            </Link>
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
                      const res = await createCashfreeSession({
                        order_id: `test-${Date.now()}`,
                        order_amount: 1,
                        return_url: `${window.location.origin}/payment/return`,
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
