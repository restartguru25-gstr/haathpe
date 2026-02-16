import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Store, Trash2, Banknote, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { getVendorMenuItems, createCustomerOrder, type VendorMenuItem, type CustomerOrderItem } from "@/lib/sales";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type CartLine = { item: VendorMenuItem; qty: number };

function cartToOrderItems(lines: CartLine[]): CustomerOrderItem[] {
  return lines.map(({ item, qty }) => {
    const price = Number(item.custom_selling_price);
    const gst = (price * qty * item.gst_rate) / 100;
    return {
      item_name: item.item_name,
      qty,
      price,
      gst_rate: item.gst_rate,
      gst,
    };
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

export default function POS() {
  const { t } = useApp();
  const { user } = useSession();
  const vendorId = user?.id ?? "";

  const [menuItems, setMenuItems] = useState<VendorMenuItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    getVendorMenuItems(vendorId).then((list) => {
      setMenuItems(list.filter((i) => i.is_active));
      setLoading(false);
    });
  }, [vendorId]);

  const addToCart = (item: VendorMenuItem, qty = 1) => {
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

  const removeLine = (itemId: string) => {
    setCart((prev) => prev.filter((l) => l.item.id !== itemId));
  };

  const { subtotal, gstAmount, total } = cartTotals(cart);

  const handleCashPaid = async () => {
    if (cart.length === 0) {
      toast.error("Add items first");
      return;
    }
    setPlacing(true);
    try {
      const items = cartToOrderItems(cart);
      const result = await createCustomerOrder(vendorId, {
        items,
        subtotal,
        gst_amount: gstAmount,
        total,
        payment_method: "cash",
        status: "paid",
      });
      if (result.ok) {
        setCart([]);
        toast.success("Sale recorded! ₹" + total.toFixed(0));
      } else {
        toast.error(result.error ?? "Failed");
      }
    } catch {
      toast.error("Failed to record sale");
    } finally {
      setPlacing(false);
    }
  };

  const handleUpiQr = () => {
    if (cart.length === 0) {
      toast.error("Add items first");
      return;
    }
    toast.info("UPI QR integration: Add Razorpay/GPay stub. For now use Cash.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <div className="container max-w-4xl px-4 py-6">
          <Skeleton className="mb-6 h-8 w-32" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-28 md:pb-4">
      <div className="container max-w-4xl px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-extrabold tracking-tight">{t("pos")}</h1>
          <Link to="/sales">
            <Button variant="outline" size="sm">{t("mySalesMenu")}</Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => addToCart(item)}
              className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-4 text-center shadow-sm transition hover:bg-muted/50 active:scale-[0.98]"
            >
              <span className="text-2xl mb-1">{item.image_url ?? "🍽️"}</span>
              <span className="text-sm font-medium leading-tight line-clamp-2">
                {item.item_name}
              </span>
              <span className="mt-1 text-xs font-semibold text-primary">
                ₹{item.custom_selling_price}
              </span>
            </button>
          ))}
        </div>

        {menuItems.length === 0 && (
          <div className="mt-8 rounded-xl border-2 border-dashed border-border bg-card p-6 md:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Store className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="mb-2 text-center text-lg font-bold text-foreground">No menu yet</h2>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Add your shop menu in <strong>My Shop Menu</strong>, then return here — items will appear as tappable tiles.
            </p>
            <div className="mx-auto mb-6 max-w-sm space-y-3 rounded-lg bg-muted/50 p-4 text-left text-sm">
              <p className="font-medium text-foreground">Two ways to add your menu:</p>
              <ol className="list-inside list-decimal space-y-1.5 text-muted-foreground">
                <li><strong className="text-foreground">Set stall type</strong> in Profile (e.g. Tea Stall, PaniPuri), then in My Shop Menu tap <strong className="text-foreground">Activate Default Menu</strong>.</li>
                <li><strong className="text-foreground">Or add items one by one</strong> in My Shop Menu — no stall type needed.</li>
              </ol>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link to="/sales" className="inline-block">
                <Button className="w-full sm:w-auto">{t("mySalesMenu")} → Add menu</Button>
              </Link>
              <Link to="/profile" className="inline-block">
                <Button variant="outline" className="w-full sm:w-auto">Profile → Set stall type</Button>
              </Link>
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Cart</h2>
            <ul className="space-y-2">
              {cart.map(({ item, qty }) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{item.item_name} × {qty}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQty(item.id, -1)}
                    >
                      −
                    </Button>
                    <span className="w-6 text-center">{qty}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQty(item.id, 1)}
                    >
                      +
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeLine(item.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <span>{t("subtotal")}</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {gstAmount > 0 && (
                <div className="flex justify-between">
                  <span>{t("gstAmount")}</span>
                  <span>₹{gstAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base mt-1">
                <span>{t("total")}</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1 gap-2"
                onClick={handleCashPaid}
                disabled={placing}
              >
                <Banknote size={18} /> {t("cashPaid")}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleUpiQr}
              >
                <QrCode size={18} /> {t("generateUpiQr")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
