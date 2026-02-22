import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getOrderForTracking } from "@/lib/sales";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";
import { useApp } from "@/contexts/AppContext";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { Copy, Check } from "lucide-react";
import BackButton from "@/components/BackButton";
import { toast } from "sonner";

export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const { t } = useApp();
  const [order, setOrder] = useState<Awaited<ReturnType<typeof getOrderForTracking>>>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadOrder = async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    const o = await getOrderForTracking(orderId);
    setOrder(o);
    setLoading(false);
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "customer_orders",
          filter: `id=eq.${orderId}`,
        },
        () => {
          try {
            loadOrder();
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") console.error(e);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [orderId]);

  const trackingUrl = typeof window !== "undefined" ? `${window.location.origin}/order/${orderId}` : "";

  const handleCopyLink = async () => {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col">
        <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border/50 bg-background/95 backdrop-blur-md px-4">
          <BackButton fallbackTo="/" />
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <MakeInIndiaFooter />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col">
        <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border/50 bg-background/95 backdrop-blur-md px-4">
          <BackButton fallbackTo="/" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-muted-foreground text-center">Order not found.</p>
          <Link to="/">
            <Button variant="outline" className="mt-4">Go home</Button>
          </Link>
        </div>
        <MakeInIndiaFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col pb-24">
      <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border/50 bg-background/95 backdrop-blur-md px-4">
        <BackButton fallbackTo="/" />
      </header>
      <div className="container flex-1 max-w-lg mx-auto px-4 py-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-bold mb-4">{t("trackOrder")}</h1>
          <p className="text-sm text-muted-foreground mb-1">{t("orderId")}</p>
          <p className="font-mono text-sm break-all mb-4">{order.id}</p>

          <div className="mb-4">
            <OrderStatusTimeline status={order.status} />
          </div>

          <p className="text-sm text-muted-foreground mb-1">Dukaan</p>
          <p className="font-medium mb-4">{order.vendor_name ?? "Dukaanwaala"}</p>

          {order.delivery_option === "self_delivery" && order.delivery_address && (
            <div className="mb-4 p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Delivery address</p>
              <p className="text-sm">{order.delivery_address}</p>
              <p className="text-xs text-muted-foreground mt-2">{t("vendorWillDeliver")}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={handleCopyLink} className="gap-2">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {t("shareTracking")}
            </Button>
            <Link to={`/menu/${order.vendor_id}`}>
              <Button variant="secondary" className="w-full">Order again</Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="w-full">Back to home</Button>
            </Link>
          </div>
        </div>
      </div>
      <MakeInIndiaFooter />
    </div>
  );
}
