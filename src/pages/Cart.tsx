import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Minus, Plus, Trash2, ArrowLeft, PartyPopper, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useCartStore, selectTotal, selectSavings } from "@/store/cartStore";
import { useSession } from "@/contexts/AuthContext";
import { useCartPricing } from "@/hooks/useCartPricing";
import { type Product } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { createCcaOrder, redirectToCcavenue, isCcavenueConfigured } from "@/lib/ccavenue";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const INDIAN_DATE = () => new Date().toISOString().slice(0, 10);
const PLATFORM_FEE_ONLINE = 5; // Flat ₹5 for B2B catalog → Haathpe revenue
const DELIVERY_HAMALI_FEE = 30; // B2B: delivery + loading/unloading (hamali) + handling. T+1/T+2.

function getProductName(p: Product, lang: "en" | "hi" | "te"): string {
  if (lang === "hi") return p.nameHi;
  if (lang === "te") return p.nameTe;
  return p.name;
}

function getLinePrice(item: { product: Product; pricePaise?: number }): number {
  return item.pricePaise != null ? item.pricePaise / 100 : item.product.price;
}

export default function Cart() {
  const navigate = useNavigate();
  const cart = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const cartTotal = useCartStore(selectTotal);
  const savings = useCartStore(selectSavings);
  const { t, lang } = useApp();
  const { user, refreshProfile } = useSession();
  const pricing = useCartPricing(cart);
  const totalSavingsRupees = savings.totalSavingsPaise / 100;
  const netSavingsAfterFees = totalSavingsRupees - (DELIVERY_HAMALI_FEE + PLATFORM_FEE_ONLINE);
  const [placing, setPlacing] = useState(false);
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const finalTotal = pricing.finalTotal;
  const platformFee = isCcavenueConfigured() ? PLATFORM_FEE_ONLINE : 0;
  const deliveryHamaliFee = isCcavenueConfigured() ? DELIVERY_HAMALI_FEE : 0;
  const amountToCharge = finalTotal + deliveryHamaliFee + platformFee;
  const hasGst = pricing.gstTotal > 0;
  const hasEco = cart.some((item) => item.product.eco);

  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log("[CART] CCAvenue on this build:", isCcavenueConfigured() ? "configured" : "not configured");
    }
  }, []);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (typeof window !== "undefined") console.log("[CART] 1. Button clicked – starting");
    setPlacing(true);
    setPaymentError(null);
    try {
      const userId = user?.id;
      if (!userId) {
        toast.error("Please sign in to place an order.");
        setPlacing(false);
        return;
      }

      if (!isCcavenueConfigured()) {
        toast.error("Payment gateway is not configured. Please try again later.");
        setPlacing(false);
        return;
      }

      // Insert order + order_items as pending, then redirect to CCAvenue for payment.
      if (typeof window !== "undefined") console.log("[CART] Creating pending order in DB...");
      const db = supabase;
      const orderPayload = {
        user_id: userId,
        total: Math.round(amountToCharge),
        status: "pending",
        gst_total: hasGst ? Math.round(pricing.gstTotal) : null,
        subtotal_before_tax: hasGst ? Math.round(pricing.subtotalTaxable) : null,
        eco_flag: hasEco,
        platform_fee_amount: platformFee,
        delivery_hamali_fee_amount: deliveryHamaliFee,
        expected_delivery_type: "T+1",
        is_b2b: true,
      };
      const orderRes = await db.from("orders").insert(orderPayload).select("id").single();
      const order = orderRes.data as { id: string } | null;
      if (orderRes.error || !order?.id) {
        if (typeof window !== "undefined") console.error("[CART] Order insert failed:", orderRes.error);
        throw orderRes.error ?? new Error("Order insert failed");
      }
      const rows = cart.map((item) => {
        const unitPriceRupees = getLinePrice(item);
        return {
          order_id: order.id,
          product_id: item.product.id,
          product_name: item.variantLabel ? `${getProductName(item.product, lang)} — ${item.variantLabel}` : getProductName(item.product, lang),
          qty: item.qty,
          unit_price: Math.round(unitPriceRupees),
          variant_id: item.variantId || null,
          variant_label: item.variantLabel || null,
          mrp: item.mrpPaise != null ? Math.round(item.mrpPaise / 100) : null,
          gst_rate: item.gstRate ?? null,
          discount_amount: null,
        };
      });
      const itemsRes = await db.from("order_items").insert(rows);
      if (itemsRes.error) {
        if (typeof window !== "undefined") console.error("[CART] Order items insert failed:", itemsRes.error);
        throw itemsRes.error;
      }

      const ccaRes = await createCcaOrder({
        order_id: order.id,
        order_amount: Math.round(amountToCharge),
        customer_id: userId,
        return_to: `${window.location.origin}/payment/return`,
        order_note: `Cart order ${order.id} – ₹${amountToCharge.toFixed(0)}`,
      });

      if (!ccaRes.ok) {
        setPaymentError(ccaRes.error ?? "Payment gateway error.");
        toast.error(ccaRes.error ?? "Payment gateway error.");
        setPlacing(false);
        return;
      }

      clearCart();
      setPlacing(false);
      setRedirectingToPayment(true);
      redirectToCcavenue({
        gateway_url: ccaRes.gateway_url,
        access_code: ccaRes.access_code,
        enc_request: ccaRes.enc_request,
        target: "_self",
      });
      return;
    } catch (e) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message?: string }).message) : "";
      const isAbort = name === "AbortError" || /aborted/i.test(msg);
      if (isAbort) {
        if (typeof window !== "undefined") console.log("[CART] Request timed out or aborted");
        toast.error("Request timed out – please try again.");
        return;
      }
      const errMsg = msg || (e instanceof Error ? e.message : null);
      if (typeof window !== "undefined") console.error("[CART] Place order error:", e);
      if (errMsg && typeof window !== "undefined") console.error("[CART] Place order failed:", errMsg);
      toast.error(errMsg && errMsg.length < 80 ? errMsg : "Could not place order. Try again.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="container max-w-2xl py-6 px-4">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/catalog">
          <Button variant="ghost" size="icon">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <h1 className="text-xl font-extrabold">{t("cart")}</h1>
      </div>

      {cart.length === 0 ? (
        <div className="py-16 text-center">
          <p className="mb-2 text-5xl">🛒</p>
          <p className="text-muted-foreground">Your cart is empty</p>
          <Link to="/catalog">
            <Button className="mt-4">{t("catalog")}</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 space-y-3">
            {cart.map((item, i) => (
              <motion.div
                key={`${item.product.id}:${item.variantId ?? ""}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <span className="text-3xl">{item.product.image}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {item.product.name}
                    {item.variantLabel && (
                      <span className="font-normal text-muted-foreground"> — {item.variantLabel}</span>
                    )}
                  </p>
                  <p className="text-sm font-bold text-primary flex items-center gap-2 flex-wrap">
                    {item.referencePricePaise != null && item.referencePricePaise > (item.pricePaise ?? item.product.price * 100) && (
                      <span className="text-muted-foreground font-normal line-through text-xs">
                        ₹{((item.referencePricePaise || 0) / 100).toFixed(0)}
                      </span>
                    )}
                    <span>₹{getLinePrice(item).toFixed(item.pricePaise != null ? 2 : 0)} × {item.qty}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, item.qty - 1, item.variantId)}>
                    <Minus size={14} />
                  </Button>
                  <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, item.qty + 1, item.variantId)}>
                    <Plus size={14} />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.product.id, item.variantId)}>
                  <Trash2 size={14} />
                </Button>
              </motion.div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">{t("subtotal")}</span>
              <span className="font-semibold">₹{pricing.subtotalInclusive.toFixed(2)}</span>
            </div>
            {totalSavingsRupees > 0 && (
              <div className="mb-2 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-2.5 flex justify-between items-center">
                <span className="text-green-700 dark:text-green-300 font-semibold text-sm flex items-center gap-1" title="Savings vs. average local market rates. Haathpe helps you buy smarter with economies of scale!">
                  You Save
                  <HelpCircle size={12} className="opacity-70" />
                </span>
                <span className="font-bold text-green-700 dark:text-green-300">
                  ₹{totalSavingsRupees.toFixed(0)} ({savings.percent.toFixed(0)}%)
                </span>
              </div>
            )}
            {netSavingsAfterFees > 0 && (
              <p className="mb-2 text-xs font-medium text-green-600 dark:text-green-400">
                Net savings after fees: ₹{netSavingsAfterFees.toFixed(0)}
              </p>
            )}
            {pricing.slabDiscount > 0 && (
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-success font-medium">{t("discount")} ({pricing.slabRate * 100}%)</span>
                <span className="font-semibold text-success">-₹{pricing.slabDiscount.toFixed(2)}</span>
              </div>
            )}
            {hasGst && (
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">{t("gstAmount")}</span>
                <span className="font-semibold">₹{pricing.gstTotal.toFixed(2)}</span>
              </div>
            )}
            {deliveryHamaliFee > 0 && (
              <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                <span>Delivery + Hamali + Other Charges</span>
                <span>₹{deliveryHamaliFee.toFixed(0)}</span>
              </div>
            )}
            {platformFee > 0 && (
              <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                <span>Platform Fee</span>
                <span>₹{platformFee.toFixed(0)}</span>
              </div>
            )}
            <p className="mb-1 text-xs text-muted-foreground">
              Delivery in T+1 (next day); T+2 possible for some areas/orders.
            </p>
            {totalSavingsRupees > 0 && (
              <p className="mb-1 text-xs text-muted-foreground">Buy more to save even more!</p>
            )}
            <p className="mb-2 text-xs text-muted-foreground flex items-center gap-1">
              <HelpCircle size={12} className="shrink-0" title="Flat ₹30 covers delivery, loading/unloading (hamali), and handling. ₹5 platform fee supports Haathpe. Savings vs. average local market rates." />
              Flat ₹30 covers delivery, hamali & handling. ₹5 supports Haathpe.
            </p>
            <div className="mb-4 flex justify-between border-t border-border pt-2 text-base">
              <span className="font-bold">{t("total")}</span>
              <span className="font-extrabold text-primary">₹{amountToCharge.toFixed(2)}</span>
            </div>

            {pricing.subtotalInclusive >= 1000 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-accent/10 p-2.5 text-xs">
                <PartyPopper size={16} className="text-accent shrink-0" />
                <span className="font-medium">This order qualifies for today's daily draw!</span>
              </div>
            )}

            {!isCcavenueConfigured() && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <strong>Pay online is currently unavailable.</strong> Please configure CCAvenue server secrets and redeploy Edge Functions.
              </div>
            )}

            {paymentError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100">
                <strong>Payment failed:</strong> {paymentError}. Order was created — you can retry from Orders.
              </div>
            )}

            <Button
              className="w-full font-bold"
              size="lg"
              onClick={handlePlaceOrder}
              disabled={placing || redirectingToPayment}
            >
              {redirectingToPayment
                ? "Redirecting to payment…"
                : placing
                  ? "Placing…"
                  : `${t("placeOrder")} · ₹${amountToCharge.toFixed(0)}`}
            </Button>

            <AlertDialog open={redirectingToPayment}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Payment Options</AlertDialogTitle>
                  <AlertDialogDescription>
                    Choose Cash or UPI to complete your order securely.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogAction disabled className="pointer-events-none">
                    Redirecting to payment…
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </div>
  );
}
