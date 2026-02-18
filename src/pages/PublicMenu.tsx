import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Check, Heart, X, Copy, ArrowLeft } from "lucide-react";
import { AdBanner } from "@/components/AdBanner";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { Button } from "@/components/ui/button";
import { getActiveVendorMenuForPublic, createCustomerOrder, getVendorZone, type VendorMenuItem, type CustomerOrderItem } from "@/lib/sales";
import { supabase } from "@/lib/supabase";
import { isShopOpen, formatTimeForDisplay, type ShopDetails } from "@/lib/shopDetails";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useApp } from "@/contexts/AppContext";
import { toggleFavorite, appendOrderToHistory } from "@/lib/customer";
import { getWalletBalance, awardCoinsForOrder, debitWalletForOrder, getCoinsPerPayment } from "@/lib/wallet";
import { createCashfreeSession, openCashfreeCheckout, isCashfreeConfigured } from "@/lib/cashfree";
import { toast } from "sonner";

type CartLine = { item: VendorMenuItem; qty: number };

function cartToOrderItems(lines: CartLine[]): CustomerOrderItem[] {
  return lines.map(({ item, qty }) => {
    const price = Number(item.custom_selling_price);
    const gst = (price * qty * item.gst_rate) / 100;
    return { item_name: item.item_name, qty, price, gst_rate: item.gst_rate, gst };
  });
}

function cartTotals(lines: CartLine[]) {
  let subtotal = 0;
  let gstAmount = 0;
  for (const { item, qty } of lines) {
    const lineTotal = Number(item.custom_selling_price) * qty;
    subtotal += lineTotal;
    gstAmount += (lineTotal * item.gst_rate) / 100;
  }
  return { subtotal, gstAmount, total: subtotal + gstAmount };
}

export default function PublicMenu() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { t, lang } = useApp();
  const { customer, isCustomer, refreshCustomer } = useCustomerAuth();
  const [menu, setMenu] = useState<VendorMenuItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [vendorZone, setVendorZone] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [deliveryOption, setDeliveryOption] = useState<"pickup" | "self_delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null);
  const [shopDetails, setShopDetails] = useState<ShopDetails | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWalletAmount, setUseWalletAmount] = useState(0);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    Promise.all([
      getActiveVendorMenuForPublic(vendorId),
      getVendorZone(vendorId),
      supabase.from("profiles").select("name, opening_hours, weekly_off, holidays, is_online").eq("id", vendorId).single(),
    ]).then(([list, zone, profileRes]) => {
      setMenu(list);
      setVendorZone(zone);
      const p = profileRes.data as { name?: string; opening_hours?: Record<string, string>; weekly_off?: string; holidays?: string[]; is_online?: boolean } | null;
      setVendorName(p?.name ?? null);
      setShopDetails(p ? { opening_hours: p.opening_hours, weekly_off: p.weekly_off, holidays: p.holidays, is_online: p.is_online } : null);
      setLoading(false);
    });
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    const channel = supabase
      .channel(`public-menu-profile-${vendorId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${vendorId}` },
        (payload) => {
          const newRow = payload.new as { opening_hours?: Record<string, string>; weekly_off?: string; holidays?: string[]; is_online?: boolean };
          setShopDetails({ opening_hours: newRow.opening_hours, weekly_off: newRow.weekly_off, holidays: newRow.holidays, is_online: newRow.is_online });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId]);

  useEffect(() => {
    if (customer?.favorites) setFavorites(customer.favorites);
  }, [customer?.favorites]);

  useEffect(() => {
    if (!customer?.id) return;
    getWalletBalance(customer.id).then(setWalletBalance);
  }, [customer?.id]);

  const handleToggleFavorite = async (itemId: string) => {
    if (!customer) return;
    setTogglingFavorite(itemId);
    const result = await toggleFavorite(customer.id, itemId, favorites);
    setTogglingFavorite(null);
    if (result.ok && result.favorites) {
      setFavorites(result.favorites);
      refreshCustomer();
    }
  };

  const shopStatus = isShopOpen(shopDetails);
  const canOrder = shopStatus.open;

  const addToCart = (item: VendorMenuItem, qty = 1) => {
    if (!canOrder) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.item.id === item.id ? { ...l, qty: l.qty + qty } : l
        );
      }
      return [...prev, { item, qty }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const next = prev.map((l) =>
        l.item.id === itemId ? { ...l, qty: Math.max(0, l.qty + delta) } : l
      );
      return next.filter((l) => l.qty > 0);
    });
  };

  const { total } = cartTotals(cart);
  const walletToUse = Math.min(useWalletAmount, walletBalance, total);
  const payAtDukaan = Math.max(0, total - walletToUse);

  const handlePayOnline = async () => {
    if (!vendorId || cart.length === 0 || !canOrder) return;
    if (customer && walletToUse > walletBalance) {
      toast.error("Insufficient wallet balance");
      return;
    }
    setPlacing(true);
    try {
      const items = cartToOrderItems(cart);
      const { subtotal, gstAmount } = cartTotals(cart);
      const coinsToAward = customer ? await getCoinsPerPayment() : 0;
      const result = await createCustomerOrder(vendorId, {
        items,
        subtotal,
        gst_amount: gstAmount,
        total,
        payment_method: "online",
        status: "pending",
        payment_id: null,
        customer_phone: customer?.phone ?? null,
        customer_id: customer?.id ?? null,
        delivery_option: deliveryOption,
        delivery_address: deliveryOption === "self_delivery" && deliveryAddress.trim() ? deliveryAddress.trim() : null,
        wallet_used: walletToUse,
        coins_awarded: 0,
      });
      if (!result.ok || !result.id) {
        toast.error(result.error ?? "Failed");
        return;
      }
      if (customer && walletToUse > 0) {
        const debitRes = await debitWalletForOrder(customer.id, result.id, walletToUse);
        if (!debitRes.ok) {
          toast.error(debitRes.error ?? "Wallet debit failed");
          setPlacing(false);
          return;
        }
      }

      if (payAtDukaan > 0 && isCashfreeConfigured()) {
        const returnUrl = `${window.location.origin}/payment/return?order_id=${result.id}`;
        const sessionRes = await createCashfreeSession({
          order_id: result.id,
          order_amount: payAtDukaan,
          customer_phone: customer?.phone ?? undefined,
          customer_id: customer?.id ?? undefined,
          return_url: returnUrl,
          order_note: `Order ${result.id} – ${vendorName ?? "haathpe"}`,
        });
        if (sessionRes.ok) {
          setCart([]);
          setUseWalletAmount(0);
          setPlacing(false);
          await openCashfreeCheckout(sessionRes.payment_session_id);
          return;
        }
        toast.error(sessionRes.error ?? "Payment gateway error");
        setPlacing(false);
        return;
      }

      if (customer && result.id) {
        const awardRes = await awardCoinsForOrder(result.id, customer.id, coinsToAward);
        if (awardRes.ok && coinsToAward > 0) {
          toast.success(t("congratulationsCoins").replace("{n}", String(coinsToAward)));
        }
        const entry = {
          order_id: result.id,
          vendor_id: vendorId,
          vendor_name: vendorName ?? undefined,
          total,
          items: items.map((i) => ({ item_name: i.item_name, qty: i.qty, price: i.price })),
          created_at: new Date().toISOString(),
        };
        await appendOrderToHistory(customer.id, entry);
        if (!awardRes.ok || coinsToAward === 0) toast.success(t("orderSavedToHistory"));
      } else {
        toast.success("Order placed! Dukaanwaala will be notified.");
      }
      setPlacedOrderId(result.id);
      setOrderPlaced(true);
      setCart([]);
      setUseWalletAmount(0);
    } catch {
      toast.error("Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading menu...</p>
        </div>
        <MakeInIndiaFooter />
      </div>
    );
  }

  if (!vendorId || menu.length === 0) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground text-center">Menu not found or not published.</p>
        </div>
        <MakeInIndiaFooter />
      </div>
    );
  }

  if (orderPlaced) {
    if (!placedOrderId) {
      return (
        <div className="min-h-screen bg-muted/20 flex flex-col pb-24">
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <Check size={48} className="mx-auto mb-3 text-green-600" />
              <h2 className="text-xl font-bold">Order placed!</h2>
              <p className="mt-2 text-sm text-muted-foreground">The dukaanwaala will be notified.</p>
              <Link to="/" className="mt-4 inline-block"><Button>Go home</Button></Link>
            </div>
          </div>
          <MakeInIndiaFooter />
        </div>
      );
    }
    const trackingUrl = typeof window !== "undefined" ? `${window.location.origin}/order/${placedOrderId}` : "";
    const handleCopyTracking = () => {
      navigator.clipboard.writeText(trackingUrl).then(() => toast.success("Link copied!"));
    };
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col pb-24">
        <div className="container flex-1 max-w-lg mx-auto px-4 py-6">
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-6 text-center">
            <Check size={48} className="mx-auto mb-3 text-green-600" />
            <h2 className="text-xl font-bold text-green-900 dark:text-green-100">Order placed!</h2>
            <p className="mt-2 text-sm text-green-800 dark:text-green-200">The dukaanwaala will be notified. Pay at the dukaan when you collect.</p>
            {deliveryOption === "self_delivery" && (
              <p className="mt-2 text-sm text-green-700 dark:text-green-300">{t("vendorWillDeliver")}</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-4 mb-4">
            <p className="text-xs text-muted-foreground mb-1">{t("orderId")}</p>
            <p className="font-mono text-sm break-all mb-3">{placedOrderId}</p>
            <Link to={`/order/${placedOrderId}`}>
              <Button variant="outline" className="w-full mb-2">{t("trackOrder")}</Button>
            </Link>
            <Button variant="secondary" size="sm" className="w-full gap-2" onClick={handleCopyTracking}>
              <Copy size={16} /> {t("shareTracking")}
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 mb-4">
            <p className="text-xs text-muted-foreground mb-2">Dukaan: {vendorName ?? "Dukaanwaala"}</p>
            <p className="text-sm">Contact dukaanwaala for pickup time or delivery ETA.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs text-muted-foreground">Sponsored</p>
            <AdBanner vendorId={vendorId ?? undefined} vendorZone={vendorZone} page="confirmation" variant="banner" />
          </div>
        </div>
        <MakeInIndiaFooter />
      </div>
    );
  }

  const loginReturnTo = `/menu/${vendorId}/browse`;

  return (
    <div className="min-h-screen bg-muted/20 pb-24">
      <div className="container max-w-lg mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
      <div className="flex-1 min-w-0">
        {!bannerDismissed && !isCustomer && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="flex-1 min-w-0">{t("customerLoginBanner")}</span>
            <Link to={`/customer-login?returnTo=${encodeURIComponent(loginReturnTo)}`}>
              <Button variant="link" size="sm" className="shrink-0 h-auto p-0 text-primary">{t("signIn")}</Button>
            </Link>
            <button type="button" onClick={() => setBannerDismissed(true)} className="shrink-0 p-1 rounded hover:bg-primary/10" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}
        {!canOrder && (
          <div className="mb-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-lg font-bold text-amber-900 dark:text-amber-100">{t("dukaanClosedTitle")}</p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              {lang === "hi" ? shopStatus.messageHi : lang === "te" ? shopStatus.messageTe : shopStatus.message}
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("currentlyUnavailable")}</p>
          </div>
        )}
        {isCustomer && (
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t("welcomeBack")} {customer?.name || customer?.phone}</p>
            <div className="flex gap-1">
              <Link to="/customer/wallet">
                <Button variant="ghost" size="sm">{t("customerWallet")}</Button>
              </Link>
              <Link to="/customer/orders">
                <Button variant="ghost" size="sm">{t("customerOrders")}</Button>
              </Link>
            </div>
          </div>
        )}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to={`/menu/${vendorId}`} className="shrink-0 rounded-lg p-1.5 hover:bg-muted transition-colors" aria-label="Back">
              <ArrowLeft size={20} className="text-muted-foreground" />
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold font-brand tracking-widest">h</div>
            <span className="brand-haathpe text-lg">haathpe Menu</span>
            {canOrder && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                Open Now {shopStatus.closesAt ? `• Closes ${formatTimeForDisplay(shopStatus.closesAt)}` : ""}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <span className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
              {cart.length} item(s) · ₹{total.toFixed(0)}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {menu.map((item) => (
            <div
              key={item.id}
              className={`relative flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 ${!canOrder ? "opacity-75" : ""}`}
            >
              {!canOrder && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60">
                  <span className="rounded bg-muted px-2 py-1 text-xs font-medium">{t("currentlyUnavailable")}</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="mr-1">{item.image_url ?? "🍽️"}</span>
                <span className="font-medium">{item.item_name}</span>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                )}
                <span className="text-sm font-semibold text-primary">₹{item.custom_selling_price}</span>
              </div>
              <div className="flex items-center gap-1">
                {isCustomer && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 shrink-0 ${favorites.includes(item.id) ? "text-red-500" : "text-muted-foreground"}`}
                    onClick={() => handleToggleFavorite(item.id)}
                    disabled={togglingFavorite === item.id || !canOrder}
                    title={favorites.includes(item.id) ? t("removeFromFavorites") : t("addToFavorites")}
                  >
                    <Heart size={18} className={favorites.includes(item.id) ? "fill-current" : ""} />
                  </Button>
                )}
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => updateQty(item.id, -1)} disabled={!canOrder}>
                  <Minus size={16} />
                </Button>
                <span className="w-8 text-center text-sm">
                  {cart.find((l) => l.item.id === item.id)?.qty ?? 0}
                </span>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => addToCart(item)} disabled={!canOrder}>
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        </div>
        {/* Ad banner - sidebar on desktop, bottom on mobile */}
        <div className="hidden md:block w-52 shrink-0">
          <AdBanner vendorId={vendorId} vendorZone={vendorZone} page="menu" variant="sidebar" />
        </div>
      </div>

        {cart.length > 0 && (
          <>
            <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">While you wait…</p>
              <AdBanner vendorId={vendorId} vendorZone={vendorZone} page="cart" variant="banner" />
            </div>
            <div className="mb-4 p-4 rounded-lg border border-border bg-card">
              <p className="text-sm font-medium mb-2">Delivery option</p>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryOption === "pickup"}
                    onChange={() => setDeliveryOption("pickup")}
                  />
                  <span className="text-sm">{t("deliveryPickup")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryOption === "self_delivery"}
                    onChange={() => setDeliveryOption("self_delivery")}
                  />
                  <span className="text-sm">{t("deliverySelf")}</span>
                </label>
              </div>
              {deliveryOption === "self_delivery" && (
                <input
                  type="text"
                  placeholder={t("deliveryAddressPlaceholder")}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              )}
            </div>
            {isCustomer && walletBalance > 0 && (
              <div className="mb-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={useWalletAmount > 0}
                    onChange={(e) => setUseWalletAmount(e.target.checked ? Math.min(walletBalance, total) : 0)}
                  />
                  <span className="text-sm font-medium">{t("useWallet")}</span>
                  <span className="text-sm text-muted-foreground">({t("walletAvailable").replace("{amount}", walletBalance.toFixed(0))})</span>
                </label>
                {useWalletAmount > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="range"
                      min={0}
                      max={Math.min(walletBalance, total)}
                      step={1}
                      value={useWalletAmount}
                      onChange={(e) => setUseWalletAmount(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-semibold text-primary">₹{useWalletAmount}</span>
                  </div>
                )}
              </div>
            )}
            <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card p-4 safe-area-pb">
            <div className="container max-w-lg mx-auto">
              <p className="text-xs text-muted-foreground mb-1">{t("gstNote")}</p>
              {walletToUse > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span>Total</span>
                  <span>₹{total.toFixed(0)}</span>
                </div>
              )}
              {walletToUse > 0 && (
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400 mb-1">
                  <span>{t("useWallet")}</span>
                  <span>-₹{walletToUse.toFixed(0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-4 mt-2">
                <span className="font-bold">Pay ₹{payAtDukaan.toFixed(0)}</span>
                <Button
                  onClick={handlePayOnline}
                  disabled={placing || !canOrder || (deliveryOption === "self_delivery" && !deliveryAddress.trim())}
                  className="gap-2"
                >
                  <ShoppingCart size={18} /> Place order
                </Button>
              </div>
            </div>
            </div>
          </>
        )}
      <MakeInIndiaFooter />
    </div>
  );
}
