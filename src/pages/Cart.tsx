import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Minus, Plus, Trash2, ArrowLeft, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useSession } from "@/contexts/AuthContext";
import { useCartPricing } from "@/hooks/useCartPricing";
import { type Product } from "@/lib/data";
import { supabase, createFreshSupabaseClient } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { createCashfreeSession, openCashfreeCheckout, isCashfreeConfigured, getCashfreeConfigStatus, savePendingOrder } from "@/lib/cashfree";
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
  const { cart, updateQty, removeFromCart, clearCart, cartTotal, t, lang } = useApp();
  const { user, refreshProfile } = useSession();
  const pricing = useCartPricing(cart);
  const [placing, setPlacing] = useState(false);
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const finalTotal = pricing.finalTotal;
  const hasGst = pricing.gstTotal > 0;
  const hasEco = cart.some((item) => item.product.eco);

  useEffect(() => {
    const st = getCashfreeConfigStatus();
    if (typeof window !== "undefined") {
      console.log("[CART] Cashfree on this build:", st.configured ? "configured" : `not configured (missing: ${st.missing ?? "?"})`);
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

      const cashfreeOn = isCashfreeConfigured();
      if (typeof window !== "undefined") console.log("[CART] 2. Cashfree configured:", cashfreeOn);

      if (cashfreeOn) {
        // Post-payment flow: no DB insert before checkout. Order is inserted on payment success (PaymentReturn).
        const orderId = crypto.randomUUID();
        if (typeof window !== "undefined") console.log("[CART] 3. Generated orderId (no DB insert yet):", orderId);

        const items = cart.map((item) => {
          const unitPriceRupees = getLinePrice(item);
          return {
            productId: item.product.id,
            productName: item.variantLabel
              ? `${getProductName(item.product, lang)} — ${item.variantLabel}`
              : getProductName(item.product, lang),
            qty: item.qty,
            unitPrice: Math.round(unitPriceRupees),
            variantId: item.variantId || null,
            variantLabel: item.variantLabel || null,
            mrp: item.mrpPaise != null ? Math.round(item.mrpPaise / 100) : null,
            gstRate: item.gstRate ?? null,
          };
        });

        savePendingOrder({
          orderId,
          userId,
          total: Math.round(finalTotal),
          gstTotal: hasGst ? Math.round(pricing.gstTotal) : null,
          subtotalBeforeTax: hasGst ? Math.round(pricing.subtotalTaxable) : null,
          ecoFlag: hasEco,
          items,
        });
        if (typeof window !== "undefined") console.log("[CART] 4. Pending order saved to sessionStorage");

        const returnUrl = `${window.location.origin}/payment/return?order_id=${orderId}`;
        const sessionRes = await createCashfreeSession({
          order_id: orderId,
          order_amount: Math.round(finalTotal),
          customer_id: userId,
          return_url: returnUrl,
          order_note: `Cart order ${orderId} – ₹${finalTotal.toFixed(0)}`,
        });

        if (!sessionRes.ok) {
          if (typeof window !== "undefined") console.error("[CART] Backend error or no session_id");
          const msg = (sessionRes as { error?: string }).error ?? "Payment gateway error.";
          setPaymentError(msg);
          toast.error(`${msg} Deploy Edge Function create-cashfree-order and set CASHFREE_APP_ID, CASHFREE_SECRET_KEY in Supabase.`);
          setPlacing(false);
          return;
        }

        if (typeof window !== "undefined") console.log("[CART] 6. Session ID received, launching Cashfree checkout");
        clearCart();
        setPlacing(false);
        setRedirectingToPayment(true);
        try {
          await openCashfreeCheckout(sessionRes.payment_session_id);
        } catch (err) {
          setRedirectingToPayment(false);
          const errMsg = err instanceof Error ? err.message : "Could not open payment page";
          if (typeof window !== "undefined") console.error("[CART] openCashfreeCheckout failed:", err);
          toast.error(`${errMsg}. Check the link in your orders or browser console.`);
          setPaymentError(errMsg);
          navigate("/orders");
        }
        return;
      }

      // Non-Cashfree path: insert order + order_items before notifications/loyalty
      if (typeof window !== "undefined") console.log("[CART] Non-Cashfree: inserting order into DB...");
      const db = createFreshSupabaseClient();
      const orderPayload = {
        user_id: userId,
        total: Math.round(finalTotal),
        status: "pending",
        gst_total: hasGst ? Math.round(pricing.gstTotal) : null,
        subtotal_before_tax: hasGst ? Math.round(pricing.subtotalTaxable) : null,
        eco_flag: hasEco,
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

      await createNotification(
        userId,
        "order_update",
        "Order placed",
        `Your order of ₹${finalTotal} has been placed.`
      );
      await supabase.rpc("upsert_purchase_today", {
        p_user_id: userId,
        p_amount: finalTotal,
      });
      if (finalTotal >= 1000) {
        const { error: drawErr } = await supabase.from("draws_entries").insert({
          user_id: userId,
          draw_date: INDIAN_DATE(),
          eligible: true,
        });
        if (drawErr?.code === "23505") {
          /* already entered today, ignore */
        } else if (drawErr) throw drawErr;
      }
      await supabase.rpc("add_loyalty_points", {
        p_user_id: userId,
        p_points: Math.floor(Math.round(finalTotal) / 100),
      });
      await supabase.rpc("refresh_profile_incentives", { p_user_id: userId });
      if (hasEco) {
        await supabase.rpc("increment_green_score", {
          p_user_id: userId,
          p_delta: 10,
        });
      }
      await refreshProfile();
      clearCart();
      toast.success(
        pricing.subtotalInclusive >= 1000
          ? `${t("orderPlacedDraw")} 🎉`
          : `${t("orderPlaced")} 🎉`
      );
      navigate("/orders");
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
                  <p className="text-sm font-bold text-primary">
                    ₹{getLinePrice(item).toFixed(item.pricePaise != null ? 2 : 0)} × {item.qty}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, item.qty - 1, item.variantId)}>
                    <Minus size={14} />
                  </Button>
                  <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, item.qty + 1, item.variantId)}>
                    <Plus size={14} />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product.id, item.variantId)}>
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
            <div className="mb-4 flex justify-between border-t border-border pt-2 text-base">
              <span className="font-bold">{t("total")}</span>
              <span className="font-extrabold text-primary">₹{finalTotal.toFixed(2)}</span>
            </div>

            {pricing.subtotalInclusive >= 1000 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-accent/10 p-2.5 text-xs">
                <PartyPopper size={16} className="text-accent shrink-0" />
                <span className="font-medium">This order qualifies for today's daily draw!</span>
              </div>
            )}

            {!isCashfreeConfigured() && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <strong>Pay online (Cashfree) is off.</strong> To redirect to Cashfree at checkout: add <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">{getCashfreeConfigStatus().missing ?? "VITE_CASHFREE_APP_ID"}</code> and Supabase URL/Anon Key in <strong>Vercel → Project → Environment Variables</strong>, then <strong>redeploy</strong>. Also deploy the Edge Function <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">create-cashfree-order</code> in Supabase.
              </div>
            )}

            {paymentError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100">
                <strong>Payment failed:</strong> {paymentError}. Order was placed — check Orders. Fix: Supabase Edge Function <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded">create-cashfree-order</code> and secrets (CASHFREE_APP_ID, CASHFREE_SECRET_KEY).
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
                  : `${t("placeOrder")} · ₹${finalTotal}`}
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
