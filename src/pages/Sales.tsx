import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Store, Plus, Pencil, QrCode, ChevronRight, Banknote, Gift, Star, Sparkles, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApp } from "@/contexts/AppContext";
import { useProfile } from "@/hooks/useProfile";
import { useSession } from "@/contexts/AuthContext";
import {
  getDefaultMenuBySector,
  getVendorMenuItems,
  activateDefaultMenu,
  updateVendorMenuItem,
  addCustomVendorMenuItem,
  getSectorIdFromStallType,
  getVendorReviews,
  getCustomerOrders,
  updateCustomerOrderStatus,
  type DefaultMenuItem,
  type VendorMenuItem,
  type VendorReview,
  type CustomerOrder,
} from "@/lib/sales";
import { getOndcOrdersForVendor, type OndcOrder } from "@/lib/ondcOrders";
import {
  getVendorIncentives,
  getTodayEntryCount,
  getIncentiveSlabs,
  getPotentialRewardForCount,
  getLast7DaysEarnings,
  getThisMonthEarnings,
  type VendorIncentive,
} from "@/lib/incentives";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { upgradeToPremiumMock } from "@/lib/premium";
import { isShopOpen } from "@/lib/shopDetails";
import { Clock } from "lucide-react";

export default function Sales() {
  const { t } = useApp();
  const { profile } = useProfile();
  const { user, refreshProfile, profile: rawProfile, isLoading: authLoading } = useSession();
  const vendorId = user?.id ?? "";

  const [defaultItems, setDefaultItems] = useState<DefaultMenuItem[]>([]);
  const [vendorItems, setVendorItems] = useState<VendorMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [incentives, setIncentives] = useState<VendorIncentive[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [last7Days, setLast7Days] = useState(0);
  const [thisMonth, setThisMonth] = useState(0);
  const [slabs, setSlabs] = useState<{ id: string; slab_type: string; min_count: number; max_count: number | null; reward_amount: number }[]>([]);
  const [reviews, setReviews] = useState<VendorReview[]>([]);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [ondcOrders, setOndcOrders] = useState<OndcOrder[]>([]);
  const [upgrading, setUpgrading] = useState(false);
  const sectorId = getSectorIdFromStallType(profile?.stallType ?? null);
  const isPremium = profile?.premiumTier === "premium";

  useEffect(() => {
    if (user?.id && typeof refreshProfile === "function") refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when we have a user so stall type is fresh after returning from Profile
  }, [user?.id]);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeoutId = window.setTimeout(() => {
      setLoading(false);
    }, 12000);
    const load = async () => {
      try {
        const [defaults, vendor] = await Promise.all([
          sectorId ? getDefaultMenuBySector(sectorId) : Promise.resolve([]),
          getVendorMenuItems(vendorId),
        ]);
        setDefaultItems(defaults ?? []);
        setVendorItems(vendor ?? []);
      } catch (e) {
        console.error("Sales load:", e);
        toast.error("Failed to load menu");
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    };
    load();
  }, [vendorId, sectorId]);

  useEffect(() => {
    if (!vendorId) return;
    Promise.all([
      getVendorIncentives(vendorId),
      getTodayEntryCount(vendorId),
      getIncentiveSlabs(),
      getLast7DaysEarnings(vendorId),
      getThisMonthEarnings(vendorId),
      getVendorReviews(vendorId),
      getCustomerOrders(vendorId, { limit: 20 }),
      getOndcOrdersForVendor(vendorId),
    ])
      .then(([inc, count, s, last7, month, revs, ords, ondc]) => {
        setIncentives(inc ?? []);
        setTodayCount(count ?? 0);
        setSlabs(s ?? []);
        setLast7Days(last7 ?? 0);
        setThisMonth(month ?? 0);
        setReviews(revs ?? []);
        setCustomerOrders(ords ?? []);
        setOndcOrders(ondc ?? []);
      })
      .catch((e) => {
        console.error("Sales dashboard data:", e);
      });
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    const channel = supabase
      .channel(`sales-orders-${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_orders",
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          try {
            getCustomerOrders(vendorId, { limit: 20 }).then(setCustomerOrders);
            getVendorReviews(vendorId).then(setReviews);
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") console.error(e);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ondc_orders",
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          try {
            const row = payload.new as { total?: number };
            const amount = Number(row?.total ?? 0).toFixed(0);
            toast.success(t("newOnlineOrderToast").replace("{amount}", amount));
            getOndcOrdersForVendor(vendorId).then(setOndcOrders);
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") console.error(e);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ondc_orders",
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          try {
            getOndcOrdersForVendor(vendorId).then(setOndcOrders);
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") console.error(e);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [vendorId]);

  const handleActivateDefault = async () => {
    if (!sectorId || !vendorId) {
      toast.error("Set your dukaan type in Profile to activate default menu.");
      return;
    }
    setActivating(true);
    try {
      const result = await activateDefaultMenu(vendorId, sectorId);
      if (result.ok) {
        toast.success(`Activated ${result.count ?? 0} items`);
        const list = await getVendorMenuItems(vendorId);
        setVendorItems(list);
      } else {
        toast.error(result.error ?? "Failed");
      }
    } catch {
      toast.error("Failed to activate menu");
    } finally {
      setActivating(false);
    }
  };

  const handleAddCustomItem = async () => {
    if (!vendorId) return;
    const price = parseFloat(customPrice);
    if (!customName.trim()) {
      toast.error("Enter item name");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      toast.error("Enter a valid price (₹)");
      return;
    }
    setAddingCustom(true);
    try {
      const result = await addCustomVendorMenuItem(vendorId, {
        item_name: customName.trim(),
        custom_selling_price: price,
        sort_order: vendorItems.length,
      });
      if (result.ok) {
        toast.success("Item added");
        setCustomName("");
        setCustomPrice("");
        const list = await getVendorMenuItems(vendorId);
        setVendorItems(list);
      } else {
        toast.error(result.error ?? "Failed to add item");
      }
    } catch {
      toast.error("Failed to add item");
    } finally {
      setAddingCustom(false);
    }
  };

  const handleSavePrice = async (item: VendorMenuItem) => {
    const price = parseFloat(editPrice);
    if (Number.isNaN(price) || price < 0) {
      toast.error("Enter a valid price");
      return;
    }
    const result = await updateVendorMenuItem(item.id, vendorId, {
      custom_selling_price: price,
    });
    if (result.ok) {
      setVendorItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, custom_selling_price: price } : i
        )
      );
      setEditingId(null);
      toast.success("Price saved");
    } else {
      toast.error(result.error ?? "Failed to save");
    }
  };

  const handleOrderStatusChange = async (orderId: string, newStatus: "pending" | "prepared" | "ready" | "delivered" | "paid") => {
    const result = await updateCustomerOrderStatus(vendorId, orderId, newStatus);
    if (result.ok) {
      setCustomerOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      toast.success("Status updated");
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handlePremiumUpgrade = async () => {
    setUpgrading(true);
    try {
      const result = await upgradeToPremiumMock();
      if (result.ok) {
        toast.success("Premium activated! (Mock — real payment coming soon)");
        if (typeof refreshProfile === "function") refreshProfile();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } finally {
      setUpgrading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <div className="container max-w-2xl px-4 py-6">
          <Skeleton className="mb-6 h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-muted/20 pb-28 md:pb-4">
        <div className="container max-w-2xl px-4 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight">{t("mySalesMenu")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("salesPageSubtitle")}</p>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-border bg-card py-16 px-6 text-center">
            <Store size={48} className="mx-auto mb-4 text-primary opacity-80" />
            <h2 className="mb-2 text-lg font-semibold">My Shop</h2>
            <p className="mb-6 max-w-sm mx-auto text-sm text-muted-foreground">
              Sign in to manage your shop menu, view orders, set timings, and share your QR menu with customers.
            </p>
            <Link to="/auth">
              <Button className="gap-2">Sign in to open my shop</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-28 md:pb-4">
      <div className="container max-w-2xl px-4 py-6">
        {rawProfile && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
            {(() => {
              const status = isShopOpen({
                opening_hours: rawProfile.opening_hours ?? undefined,
                weekly_off: rawProfile.weekly_off ?? undefined,
                holidays: rawProfile.holidays ?? undefined,
                is_online: rawProfile.is_online,
              });
              return (
                <>
                  <span className={`inline-flex items-center gap-2 text-sm font-medium ${status.open ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                    <Clock size={16} />
                    {status.open ? t("shopOpenNow") : t("shopClosedNow")}
                  </span>
                  <Link to="/profile">
                    <Button variant="ghost" size="sm" className="h-8 text-xs">{t("editTimings")}</Button>
                  </Link>
                </>
              );
            })()}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{t("mySalesMenu")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("salesPageSubtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/pos">
              <Button variant="outline" size="sm" className="gap-2">
                <Store size={16} /> {t("pos")}
              </Button>
            </Link>
            <Link to={`/menu/${vendorId}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <QrCode size={16} /> {t("qrCodeMenu")}
              </Button>
            </Link>
            <Link to="/vendor/ondc-export">
              <Button variant="outline" size="sm" className="gap-2">
                <FileJson size={16} /> {t("catalogExport")}
              </Button>
            </Link>
          </div>
        </div>

        {!isPremium && (
          <div className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100">
                  <Sparkles size={18} /> {t("premiumUpgrade")} — {t("premiumPrice")}
                </div>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{t("premiumBenefits")}</p>
              </div>
              <Button size="sm" onClick={handlePremiumUpgrade} disabled={upgrading} className="shrink-0">
                {upgrading ? "..." : "Upgrade (mock)"}
              </Button>
            </div>
          </div>
        )}

        {/* Customer Reviews card */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Star size={18} className="text-amber-500 fill-amber-500" />
            <span className="font-semibold">{t("customerReviews")}</span>
          </div>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noReviewsYet")}</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {t("averageRating")}: <strong className="text-foreground">
                  {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
                </strong> / 5 ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
              </p>
              <ul className="max-h-40 overflow-y-auto space-y-2">
                {reviews.slice(0, 10).map((r) => (
                  <li key={r.order_id} className="text-sm border-b border-border/50 pb-2 last:border-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                        />
                      ))}
                    </div>
                    {r.review_text && <p className="text-muted-foreground">{r.review_text}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Recent customer orders */}
        {customerOrders.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold">Recent orders</span>
              <Link to="/pos">
                <Button variant="outline" size="sm">POS</Button>
              </Link>
            </div>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {customerOrders.slice(0, 10).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/50 pb-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">₹{Number(o.total).toFixed(0)} · {(o.items as { item_name: string; qty: number }[]).slice(0, 2).map((i) => `${i.item_name}×${i.qty}`).join(", ")}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                  <select
                    value={o.status}
                    onChange={(e) => handleOrderStatusChange(o.id, e.target.value as "pending" | "prepared" | "ready" | "delivered" | "paid")}
                    className="rounded border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="pending">Pending</option>
                    <option value="prepared">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="delivered">Delivered</option>
                    <option value="paid">Paid</option>
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Online Orders (includes all online/direct orders) */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold">{t("onlineOrders")}</span>
            <Link to="/vendor/ondc-export">
              <Button variant="ghost" size="sm">{t("catalogExport")}</Button>
            </Link>
          </div>
          {ondcOrders.length > 0 ? (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {ondcOrders.slice(0, 10).map((o) => (
                <li key={o.id} className="flex flex-col gap-1 text-sm border-b border-border/50 pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">₹{Number(o.total).toFixed(0)} · {t("orderSourceOnline")}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${o.payment_status === "paid" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {o.payment_status === "paid" ? t("paid") : o.payment_status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {(o.items ?? []).slice(0, 2).map((i) => `${i.item_name}×${i.qty}`).join(", ")}
                  </p>
                  {o.payment_status === "paid" && o.vendor_amount != null && (
                    <p className="text-xs text-primary font-medium">
                      {t("yourShare")} ₹{Number(o.vendor_amount).toFixed(0)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noOnlineOrders")}</p>
          )}
        </div>

        {/* Daily Incentives card */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Banknote size={18} className="text-primary" />
            <span className="font-semibold">{t("dailyIncentives")}</span>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Earn cash rewards for every sale. Today: <strong>{todayCount}</strong> entries.
            {slabs.length > 0 && (
              <span className="ml-1">
                Potential reward: <strong>₹{getPotentialRewardForCount(slabs, todayCount)}</strong>
              </span>
            )}
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Last 7 days: <strong>₹{last7Days.toFixed(0)}</strong> · Total this month: <strong>₹{thisMonth.toFixed(0)}</strong>
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            <strong>{t("referralBonus")}:</strong> {t("referralBonusDesc")} <Link to="/profile" className="text-primary underline">{t("inviteVendors")}</Link>
          </p>
          {incentives.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Recent earnings</p>
              <ul className="max-h-24 overflow-y-auto space-y-1 text-sm">
                {incentives.slice(0, 5).map((inc) => (
                  <li key={inc.id} className="flex items-center justify-between">
                    <span>
                      {inc.slab_type === "daily" ? "Daily" : inc.slab_type === "referral" ? "Referral" : "Monthly"} · {new Date(inc.slab_date).toLocaleDateString()} · {inc.slab_type === "referral" ? "1 referral" : `${inc.entry_count} entries`}
                    </span>
                    <span className="font-semibold text-primary">₹{Number(inc.earned_amount).toFixed(0)}</span>
                  </li>
                ))}
              </ul>
              <Link to="/profile">
                <Button variant="outline" size="sm" className="gap-2 mt-2">
                  <Gift size={14} /> {t("withdraw")}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {!sectorId && (
          <div className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="mb-3 font-semibold">Step 1: Set your {t("dukaanType")}</p>
            <p className="mb-3">
              Go to <strong>Profile</strong> and choose a <strong>{t("dukaanType")}</strong>. That decides which default menu you get (e.g. Tea Stall → Chai, Snack; Kirana → essentials; PaniPuri → Pani Puri, Sev Puri).
            </p>
            <p className="mb-3 text-amber-800 dark:text-amber-300">Examples: <strong>Kirana Store</strong>, <strong>General Store</strong>, <strong>Tea Stall</strong>, <strong>PaniPuri</strong>, <strong>Hardware Shop</strong>, <strong>Saloon/Spa</strong>.</p>
            <Link to="/profile">
              <Button size="sm" variant="outline" className="border-amber-300 bg-white dark:border-amber-700 dark:bg-amber-950/50">Open Profile → Set {t("dukaanType")}</Button>
            </Link>
          </div>
        )}

        {sectorId && defaultItems.length > 0 && vendorItems.length === 0 && (
          <div className="mb-6 rounded-xl border-2 border-primary/20 bg-card p-6">
            <p className="mb-4 text-center font-medium text-foreground">
              Default menu for your dukaan type <strong>{profile.stallType}</strong> — {defaultItems.length} items. You can edit prices after activating.
            </p>
            <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview (name · price range)</p>
              <ul className="space-y-1.5 text-sm">
                {defaultItems.map((d, i) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span><span className="opacity-70">{i + 1}.</span> {d.image_url ?? "🍽️"} {d.item_name}</span>
                    <span className="text-muted-foreground">₹{d.default_selling_price_range}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center">
              <Button
                onClick={handleActivateDefault}
                disabled={activating}
                className="gap-2"
              >
                <Plus size={18} /> {t("activateDefault")}
              </Button>
            </div>
          </div>
        )}

        {sectorId && defaultItems.length > 0 && vendorItems.length > 0 && (
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleActivateDefault}
              disabled={activating}
              className="gap-2"
            >
              <Plus size={16} /> Add missing items from default
            </Button>
          </div>
        )}

        {vendorItems.length === 0 && sectorId && defaultItems.length === 0 && (
          <div className="mb-6 rounded-xl border-2 border-dashed border-border bg-card py-10 px-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Your shop menu is empty.</p>
            <p className="text-sm text-muted-foreground mb-4">
              Set your dukaan type in Profile to get a default menu, or add a custom item below.
            </p>
            <Link to="/profile">
              <Button variant="outline" size="sm" className="gap-2">Open Profile → Set dukaan type</Button>
            </Link>
          </div>
        )}

        {vendorItems.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">{t("defaultPrice")}</TableHead>
                  <TableHead className="text-right">{t("yourPrice")}</TableHead>
                  <TableHead className="w-20">{t("gst")}</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorItems.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <span className="mr-1">{item.image_url ?? "🍽️"}</span>
                      {item.item_name}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.default_selling_price_range ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === item.id ? (
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="h-8 w-20 text-right"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">₹{item.custom_selling_price}</span>
                      )}
                    </TableCell>
                    <TableCell>{item.gst_rate}%</TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSavePrice(item)}
                        >
                          {t("save")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditPrice(String(item.custom_selling_price));
                          }}
                        >
                          <Pencil size={14} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
              In <strong>POS</strong>, these items appear as tappable tiles. Open POS to start selling.
            </p>
          </div>
        )}

        {!loading && vendorItems.length === 0 && sectorId && defaultItems.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No default menu for your sector yet. Add items manually below.</p>
        )}

        {!loading && vendorItems.length === 0 && (
          <div className="mb-6 rounded-xl border-2 border-dashed border-border bg-muted/30 p-5">
            <p className="mb-3 font-semibold text-foreground">Add an item manually</p>
            <p className="mb-4 text-sm text-muted-foreground">
              You can add menu items one by one (e.g. if you haven&apos;t set a dukaan type or want custom items).
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Item name</label>
                <Input
                  placeholder="e.g. Chai, Pani Puri"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="w-24">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Price (₹)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="20"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="bg-background"
                />
              </div>
              <Button onClick={handleAddCustomItem} disabled={addingCustom} className="gap-2">
                <Plus size={16} /> Add item
              </Button>
            </div>
          </div>
        )}

        {vendorId && vendorItems.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-sm font-semibold">{t("qrCodeMenu")}</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Share this link or QR so customers can view your dukaan menu and place orders.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                  `${typeof window !== "undefined" ? window.location.origin : ""}/menu/${vendorId}`
                )}`}
                alt="QR Code for menu"
                className="h-28 w-28 rounded-lg border border-border"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate rounded bg-muted px-2 py-1 text-xs font-mono">
                  {typeof window !== "undefined" ? window.location.origin : ""}/menu/{vendorId}
                </p>
                <Link to={`/menu/${vendorId}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="link" size="sm" className="h-auto p-0 text-primary">
                    Open menu
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Link to="/pos">
            <Button className="gap-2">
              Open POS <ChevronRight size={16} />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
