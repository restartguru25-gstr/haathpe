import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Check } from "lucide-react";
import { AdBanner } from "@/components/AdBanner";
import { Button } from "@/components/ui/button";
import { getActiveVendorMenuForPublic, createCustomerOrder, getVendorZone, type VendorMenuItem, type CustomerOrderItem } from "@/lib/sales";
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
  const [menu, setMenu] = useState<VendorMenuItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [vendorZone, setVendorZone] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    Promise.all([
      getActiveVendorMenuForPublic(vendorId),
      getVendorZone(vendorId),
    ]).then(([list, zone]) => {
      setMenu(list);
      setVendorZone(zone);
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

  const { total } = cartTotals(cart);

  const handlePayOnline = async () => {
    if (!vendorId || cart.length === 0) return;
    setPlacing(true);
    try {
      const items = cartToOrderItems(cart);
      const { subtotal, gstAmount } = cartTotals(cart);
      const result = await createCustomerOrder(vendorId, {
        items,
        subtotal,
        gst_amount: gstAmount,
        total,
        payment_method: "online",
        status: "pending",
        payment_id: null,
      });
      if (result.ok) {
        toast.success("Order placed! Vendor will be notified.");
        setOrderPlaced(true);
        setCart([]);
      } else {
        toast.error(result.error ?? "Failed");
      }
    } catch {
      toast.error("Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <p className="text-muted-foreground">Loading menu...</p>
      </div>
    );
  }

  if (!vendorId || menu.length === 0) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
        <p className="text-muted-foreground text-center">Menu not found or not published.</p>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-muted/20 pb-24">
        <div className="container max-w-lg mx-auto px-4 py-6">
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-6 text-center">
            <Check size={48} className="mx-auto mb-3 text-green-600" />
            <h2 className="text-xl font-bold text-green-900 dark:text-green-100">Order placed!</h2>
            <p className="mt-2 text-sm text-green-800 dark:text-green-200">The vendor will be notified. Pay at the stall when you collect.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs text-muted-foreground">Sponsored</p>
            <AdBanner vendorId={vendorId ?? undefined} vendorZone={vendorZone} page="confirmation" variant="banner" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-24">
      <div className="container max-w-lg mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">V</div>
            <span className="text-lg font-bold">VendorHub Menu</span>
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
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <span className="mr-1">{item.image_url ?? "🍽️"}</span>
                <span className="font-medium">{item.item_name}</span>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                )}
                <span className="text-sm font-semibold text-primary">₹{item.custom_selling_price}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => updateQty(item.id, -1)}>
                  <Minus size={16} />
                </Button>
                <span className="w-8 text-center text-sm">
                  {cart.find((l) => l.item.id === item.id)?.qty ?? 0}
                </span>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => addToCart(item)}>
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
            <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card p-4 safe-area-pb">
            <div className="container max-w-lg mx-auto flex items-center justify-between gap-4">
              <span className="font-bold">₹{total.toFixed(2)}</span>
              <Button onClick={handlePayOnline} disabled={placing} className="gap-2">
                <ShoppingCart size={18} /> Place order (pay at stall)
              </Button>
            </div>
          </div>
          </>
        )}
    </div>
  );
}
