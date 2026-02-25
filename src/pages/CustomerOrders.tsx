import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useApp } from "@/contexts/AppContext";
import { getOrdersForCustomer, submitOrderReview, type CustomerOrderRow } from "@/lib/customer";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, ArrowLeft, ShoppingBag, Star, ExternalLink, Wallet, FileDown, FileText } from "lucide-react";
import { buildCustomerReceiptLines, downloadCustomerReceiptPdf, type CustomerReceiptData } from "@/lib/invoice";
import ReviewModal from "@/components/ReviewModal";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";

export default function CustomerOrders() {
  const { t } = useApp();
  const navigate = useNavigate();
  const { customer, isLoading: authLoading, isCustomer, signOutCustomer } = useCustomerAuth();
  const [orders, setOrders] = useState<CustomerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!customer?.phone) {
      setLoading(false);
      return;
    }
    const list = await getOrdersForCustomer(customer.phone);
    setOrders(list);
    setLoading(false);
  }, [customer?.phone]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!customer?.phone) return;
    const channel = supabase
      .channel(`customer-orders-${customer.phone}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_orders",
          filter: `customer_phone=eq.${encodeURIComponent(customer.phone)}`,
        },
        () => {
          try {
            loadOrders();
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") console.error(e);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [customer?.phone, loadOrders]);

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      navigate("/customer-login?returnTo=/customer/orders", { replace: true });
    }
  }, [authLoading, isCustomer, navigate]);

  const handleLogout = async () => {
    await signOutCustomer();
    navigate("/", { replace: true });
  };

  const handleSubmitReview = async (orderId: string, rating: number, reviewText: string) => {
    return submitOrderReview(orderId, rating, reviewText || null);
  };

  const toReceiptData = (o: CustomerOrderRow): CustomerReceiptData => ({
    id: o.id,
    created_at: o.created_at,
    status: o.status,
    vendor_name: o.vendor_name ?? null,
    items: Array.isArray(o.items)
      ? (o.items as { item_name: string; qty: number; price?: number }[])
      : [],
    total: Number(o.total),
  });

  const handleDownloadReceipt = (o: CustomerOrderRow, format: "txt" | "pdf") => {
    const receipt = toReceiptData(o);
    if (format === "txt") {
      const lines = buildCustomerReceiptLines(receipt);
      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `haathpe-receipt-${o.id.slice(0, 8)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Receipt downloaded");
    } else {
      downloadCustomerReceiptPdf(receipt);
      toast.success("Receipt PDF downloaded");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
        <Skeleton className="h-12 w-48 mb-4" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!isCustomer) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-24">
      <div className="container max-w-lg mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">{t("customerOrdersTitle")}</h1>
          <div className="flex items-center gap-1">
            <Link to="/customer/wallet">
              <Button variant="ghost" size="icon" title={t("customerWallet")}>
                <Wallet size={20} />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout} title={t("customerLogout")}>
              <LogOut size={20} />
            </Button>
          </div>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          {t("welcomeBack")} {customer.name || customer.phone}
        </p>

        {loading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-50" />
            <p>{t("customerOrdersEmpty")}</p>
            <Link to="/">
              <Button variant="outline" className="mt-4">Browse menu</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const completed = o.status === "delivered" || o.status === "paid";
              const canReview = completed && !o.reviewed_at;

              return (
                <div
                  key={o.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">{o.vendor_name ?? "Vendor"}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      completed
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    }`}>
                      {o.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {new Date(o.created_at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <OrderStatusTimeline status={o.status} />
                  <ul className="text-sm mb-2 mt-3">
                    {(Array.isArray(o.items) ? o.items : []).slice(0, 5).map((line: { item_name: string; qty: number }, i: number) => (
                      <li key={i}>
                        {line.item_name} × {line.qty}
                      </li>
                    ))}
                    {(Array.isArray(o.items) ? o.items : []).length > 5 && (
                      <li className="text-muted-foreground">+{(o.items as unknown[]).length - 5} more</li>
                    )}
                  </ul>
                  <p className="font-semibold text-primary mb-2">₹{Number(o.total).toFixed(0)}</p>
                  {o.coins_awarded != null && o.coins_awarded > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                      {t("coinsEarned")}: +{o.coins_awarded}
                    </p>
                  )}
                  {o.rating != null && (
                    <div className="flex items-center gap-1 text-sm text-amber-600 mb-2">
                      <Star className="h-4 w-4 fill-current" />
                      {o.rating}/5
                      {o.review_text && <span className="text-muted-foreground">— {o.review_text}</span>}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Link to={`/order/${o.id}`}>
                      <Button variant="outline" size="sm" className="gap-1">
                        <ExternalLink size={14} /> {t("trackOrder")}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleDownloadReceipt(o, "txt")}
                      title="Download receipt (TXT)"
                    >
                      <FileText size={14} /> Receipt (TXT)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleDownloadReceipt(o, "pdf")}
                      title="Download receipt (PDF)"
                    >
                      <FileDown size={14} /> Receipt (PDF)
                    </Button>
                    {canReview && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setReviewOrderId(o.id)}
                        className="gap-1"
                      >
                        <Star size={14} /> {t("rateAndReview")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ReviewModal
        open={!!reviewOrderId}
        onOpenChange={(open) => !open && setReviewOrderId(null)}
        orderId={reviewOrderId ?? ""}
        vendorName={orders.find((o) => o.id === reviewOrderId)?.vendor_name}
        onSubmit={(rating, text) => handleSubmitReview(reviewOrderId!, rating, text)}
        onSuccess={() => loadOrders()}
      />
    </div>
  );
}
