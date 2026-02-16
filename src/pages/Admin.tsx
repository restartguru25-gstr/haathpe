import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  ShoppingBag,
  Trophy,
  CreditCard,
  Shield,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Package,
  Check,
  X,
  Pencil,
  Trash2,
  Gift,
  HelpCircle,
  Banknote,
  Image,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/lib/supabase";
import {
  getPendingSwapsForAdmin,
  getAllSwapsForAdmin,
  moderateSwap,
  deleteSwap,
  type VendorSwap,
} from "@/lib/swaps";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAdminVendorIncentives,
  getAllIncentiveSlabs,
  getEligibleForDraw,
  upsertIncentiveSlab,
  deleteIncentiveSlab,
  runDailyIncentiveCalc,
  runReferralBonusCalc,
  runMonthlyDraw,
  type VendorIncentive,
  type IncentiveSlab,
} from "@/lib/incentives";
import { getAdminAds, upsertAd, deleteAd, uploadAdImage, type Ad } from "@/lib/ads";

interface AdminProfile {
  id: string;
  name: string | null;
  phone: string | null;
  stall_type: string | null;
  credit_limit: number;
  credit_used: number;
  streak: number;
  points: number;
  tier: string;
  role: string;
}

interface AdminOrder {
  id: string;
  user_id: string;
  total: number;
  status: string;
  created_at: string;
  order_items?: { product_name: string; qty: number; unit_price: number }[];
}

interface RewardRedemptionRow {
  id: string;
  user_id: string;
  reward_type: string;
  points_spent: number;
  status: string;
  created_at: string;
  user_name?: string | null;
}

interface SvanidhiSupportRow {
  id: string;
  user_id: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  user_name: string | null;
}

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAdmin();
  const [vendors, setVendors] = useState<AdminProfile[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [drawRunning, setDrawRunning] = useState(false);
  const [creditUserId, setCreditUserId] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [savingCredit, setSavingCredit] = useState(false);
  const [allSwaps, setAllSwaps] = useState<VendorSwap[]>([]);
  const [loadingSwaps, setLoadingSwaps] = useState(false);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [editVendor, setEditVendor] = useState<AdminProfile | null>(null);
  const [savingVendor, setSavingVendor] = useState(false);
  const [orderStatusUpdating, setOrderStatusUpdating] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<RewardRedemptionRow[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [svanidhiRequests, setSvanidhiRequests] = useState<SvanidhiSupportRow[]>([]);
  const [loadingSvanidhi, setLoadingSvanidhi] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "vendor" | "order" | "swap"; id: string; label?: string } | null>(null);
  const [adminIncentives, setAdminIncentives] = useState<VendorIncentive[]>([]);
  const [adminSlabs, setAdminSlabs] = useState<IncentiveSlab[]>([]);
  const [loadingIncentives, setLoadingIncentives] = useState(false);
  const [dailyCalcRunning, setDailyCalcRunning] = useState(false);
  const [referralCalcRunning, setReferralCalcRunning] = useState(false);
  const [monthlyDrawRunning, setMonthlyDrawRunning] = useState(false);
  const [adminAds, setAdminAds] = useState<Ad[]>([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [eligibleForDraw, setEligibleForDraw] = useState<VendorIncentive[]>([]);
  const [slabFormOpen, setSlabFormOpen] = useState(false);
  const [editingSlab, setEditingSlab] = useState<IncentiveSlab | null>(null);
  const [savingSlab, setSavingSlab] = useState(false);
  const [slabForm, setSlabForm] = useState({ slab_type: "daily" as "daily" | "monthly", min_count: 0, max_count: null as number | null, reward_amount: 20, is_active: true, description: "" });
  const [adFormOpen, setAdFormOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [savingAd, setSavingAd] = useState(false);
  const [adForm, setAdForm] = useState({ brand_name: "", title: "", image_url: "", link_url: "", zone: "general", is_active: true, priority: 0 });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, isAdmin, navigate]);

  const loadVendors = async () => {
    setLoadingVendors(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, phone, stall_type, credit_limit, credit_used, streak, points, tier, role")
      .order("name");
    if (error) {
      toast.error("Could not load vendors");
      setVendors([]);
    } else {
      setVendors((data ?? []) as AdminProfile[]);
    }
    setLoadingVendors(false);
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, user_id, total, status, created_at, order_items(product_name, qty, unit_price)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("Could not load orders");
      setOrders([]);
    } else {
      setOrders((data ?? []) as AdminOrder[]);
    }
    setLoadingOrders(false);
  };

  const loadAllSwaps = async () => {
    setLoadingSwaps(true);
    const list = await getAllSwapsForAdmin();
    setAllSwaps(list);
    setLoadingSwaps(false);
  };

  const loadRedemptions = async () => {
    setLoadingRedemptions(true);
    const { data, error } = await supabase
      .from("reward_redemptions")
      .select("id, user_id, reward_type, points_spent, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setRedemptions([]);
    } else {
      setRedemptions((data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        user_id: r.user_id as string,
        reward_type: r.reward_type as string,
        points_spent: r.points_spent as number,
        status: r.status as string,
        created_at: r.created_at as string,
        user_name: null as string | null,
      })));
    }
    setLoadingRedemptions(false);
  };

  const loadSvanidhiRequests = async () => {
    setLoadingSvanidhi(true);
    const { data: rows, error } = await supabase
      .from("svanidhi_support_requests")
      .select("id, user_id, status, admin_notes, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setSvanidhiRequests([]);
    } else {
      const list = (rows ?? []) as { id: string; user_id: string; status: string; admin_notes: string | null; created_at: string }[];
      const userIds = [...new Set(list.map((r) => r.user_id))];
      const nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
        (profiles ?? []).forEach((p: { id: string; name: string | null }) => {
          nameMap[p.id] = p.name ?? "—";
        });
      }
      setSvanidhiRequests(
        list.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          status: r.status,
          admin_notes: r.admin_notes,
          created_at: r.created_at,
          user_name: nameMap[r.user_id] ?? null,
        }))
      );
    }
    setLoadingSvanidhi(false);
  };

  const loadIncentives = async () => {
    setLoadingIncentives(true);
    const [inc, slabs, eligible] = await Promise.all([
      getAdminVendorIncentives(),
      getAllIncentiveSlabs(),
      getEligibleForDraw(),
    ]);
    setAdminIncentives(inc);
    setAdminSlabs(slabs);
    setEligibleForDraw(eligible);
    setLoadingIncentives(false);
  };

  const loadAds = async () => {
    setLoadingAds(true);
    const list = await getAdminAds();
    setAdminAds(list);
    setLoadingAds(false);
  };

  const handleRunDailyCalc = async () => {
    setDailyCalcRunning(true);
    try {
      const result = await runDailyIncentiveCalc();
      if (result.ok) {
        toast.success(`Daily calc complete. ${result.count ?? 0} vendors updated.`);
        loadIncentives();
      } else {
        toast.error(result.error ?? "Calc failed");
      }
    } catch {
      toast.error("Could not run daily calc");
    } finally {
      setDailyCalcRunning(false);
    }
  };

  const handleRunReferralCalc = async () => {
    setReferralCalcRunning(true);
    try {
      const result = await runReferralBonusCalc();
      if (result.ok) {
        toast.success(`Referral bonus calc complete. ${result.count ?? 0} referrers paid.`);
        loadIncentives();
      } else {
        toast.error(result.error ?? "Calc failed");
      }
    } catch {
      toast.error("Could not run referral calc");
    } finally {
      setReferralCalcRunning(false);
    }
  };

  const handleRunMonthlyDraw = async () => {
    setMonthlyDrawRunning(true);
    try {
      const result = await runMonthlyDraw();
      if (result.ok) {
        toast.success(`Monthly draw complete! Winner: ${result.winner_name ?? result.winner_id ?? "—"}`);
        loadIncentives();
      } else {
        toast.error(result.error ?? "Draw failed");
      }
    } catch {
      toast.error("Could not run monthly draw");
    } finally {
      setMonthlyDrawRunning(false);
    }
  };

  const handleSvanidhiStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("svanidhi_support_requests").update({ status }).eq("id", id);
    if (error) toast.error("Could not update");
    else loadSvanidhiRequests();
  };

  useEffect(() => {
    if (isAdmin) {
      loadVendors();
      loadOrders();
      loadAllSwaps();
      loadRedemptions();
      loadSvanidhiRequests();
      loadIncentives();
      loadAds();
    }
  }, [isAdmin]);

  const handleRunDraw = async () => {
    setDrawRunning(true);
    try {
      const { data, error } = await supabase.rpc("run_daily_draw");
      if (error) throw error;
      const result = data as { ok: boolean; error?: string; winner_name?: string };
      if (result?.ok) {
        toast.success(`Draw complete! Winner: ${result.winner_name ?? "—"}`);
        loadOrders();
      } else {
        toast.error(result?.error ?? "Draw failed");
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not run draw");
    } finally {
      setDrawRunning(false);
    }
  };

  const handleModerateSwap = async (swapId: string, status: "approved" | "rejected") => {
    setModeratingId(swapId);
    const result = await moderateSwap(swapId, status);
    setModeratingId(null);
    if (result.ok) {
      toast.success(status === "approved" ? "Listing approved" : "Listing rejected");
      loadAllSwaps();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleDeleteSwap = async (swapId: string) => {
    setModeratingId(swapId);
    const result = await deleteSwap(swapId);
    setModeratingId(null);
    setDeleteConfirm(null);
    if (result.ok) {
      toast.success("Swap listing deleted");
      loadAllSwaps();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleSaveVendor = async () => {
    if (!editVendor) return;
    setSavingVendor(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: editVendor.name ?? null,
          phone: editVendor.phone ?? null,
          stall_type: editVendor.stall_type ?? null,
          credit_limit: editVendor.credit_limit,
          points: editVendor.points,
          role: (editVendor.role === "admin" ? "admin" : "vendor") as "admin" | "vendor",
        })
        .eq("id", editVendor.id);
      if (error) throw error;
      toast.success("Vendor updated");
      setEditVendor(null);
      loadVendors();
    } catch (e) {
      toast.error("Could not update vendor");
    } finally {
      setSavingVendor(false);
    }
  };

  const handleOrderStatusChange = async (orderId: string, newStatus: string) => {
    setOrderStatusUpdating(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);
      if (error) throw error;
      toast.success("Order status updated");
      loadOrders();
    } catch {
      toast.error("Could not update order");
    } finally {
      setOrderStatusUpdating(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const { error: itemsErr } = await supabase.from("order_items").delete().eq("order_id", orderId);
      if (itemsErr) throw itemsErr;
      const { error: orderErr } = await supabase.from("orders").delete().eq("id", orderId);
      if (orderErr) throw orderErr;
      toast.success("Order deleted");
      setDeleteConfirm(null);
      loadOrders();
    } catch {
      toast.error("Could not delete order");
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", vendorId);
      if (error) throw error;
      toast.success("Vendor profile deleted");
      setDeleteConfirm(null);
      setEditVendor(null);
      loadVendors();
    } catch {
      toast.error("Could not delete vendor (may have dependent data)");
    }
  };

  const handleRedemptionStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("reward_redemptions")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error("Could not update redemption");
    } else {
      toast.success("Redemption updated");
      loadRedemptions();
    }
  };

  const openSlabForm = (slab: IncentiveSlab | null) => {
    setEditingSlab(slab);
    setSlabForm(slab ? {
      slab_type: slab.slab_type as "daily" | "monthly",
      min_count: slab.min_count,
      max_count: slab.max_count,
      reward_amount: Number(slab.reward_amount),
      is_active: slab.is_active,
      description: slab.description ?? "",
    } : { slab_type: "daily", min_count: 0, max_count: null, reward_amount: 20, is_active: true, description: "" });
    setSlabFormOpen(true);
  };

  const handleSaveSlab = async () => {
    setSavingSlab(true);
    try {
      const result = await upsertIncentiveSlab({
        ...(editingSlab?.id && { id: editingSlab.id }),
        slab_type: slabForm.slab_type,
        min_count: slabForm.min_count,
        max_count: slabForm.max_count,
        reward_amount: slabForm.reward_amount,
        is_active: slabForm.is_active,
        description: slabForm.description || null,
      });
      if (result.ok) {
        toast.success(editingSlab ? "Slab updated" : "Slab added");
        setSlabFormOpen(false);
        loadIncentives();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } catch {
      toast.error("Could not save slab");
    } finally {
      setSavingSlab(false);
    }
  };

  const openAdForm = (ad: Ad | null) => {
    setEditingAd(ad);
    setAdForm(ad ? {
      brand_name: ad.brand_name,
      title: ad.title ?? "",
      image_url: ad.image_url,
      link_url: ad.link_url ?? "",
      zone: ad.zone,
      is_active: ad.is_active,
      priority: ad.priority ?? 0,
    } : { brand_name: "", title: "", image_url: "", link_url: "", zone: "general", is_active: true, priority: 0 });
    setAdFormOpen(true);
  };

  const handleSaveAd = async () => {
    if (!adForm.brand_name.trim() || !adForm.image_url.trim()) {
      toast.error("Brand name and image URL required");
      return;
    }
    setSavingAd(true);
    try {
      const result = await upsertAd({
        ...(editingAd?.id && { id: editingAd.id }),
        brand_name: adForm.brand_name.trim(),
        title: adForm.title.trim() || null,
        image_url: adForm.image_url.trim(),
        link_url: adForm.link_url.trim() || null,
        zone: adForm.zone,
        is_active: adForm.is_active,
        priority: adForm.priority,
      });
      if (result.ok) {
        toast.success(editingAd ? "Ad updated" : "Ad added");
        setAdFormOpen(false);
        loadAds();
      } else {
        toast.error(result.error ?? "Failed");
      }
    } catch {
      toast.error("Could not save ad");
    } finally {
      setSavingAd(false);
    }
  };

  const handleSaveCredit = async () => {
    if (!creditUserId || creditLimit === "") return;
    const limit = parseInt(creditLimit, 10);
    if (isNaN(limit) || limit < 0) {
      toast.error("Enter a valid credit limit");
      return;
    }
    setSavingCredit(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ credit_limit: limit })
        .eq("id", creditUserId);
      if (error) throw error;
      toast.success("Credit limit updated");
      setCreditLimit("");
      setCreditUserId("");
      loadVendors();
    } catch (e) {
      toast.error("Could not update credit limit");
    } finally {
      setSavingCredit(false);
    }
  };

  if (authLoading) {
    return (
      <div className="container max-w-4xl py-6 px-4">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container max-w-4xl py-6 px-4 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Shield size={22} className="text-primary" />
          <h1 className="text-xl font-extrabold">Admin</h1>
        </div>
      </div>

      <Tabs defaultValue="vendors" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1">
          <TabsTrigger value="vendors" className="flex items-center gap-2">
            <Users size={16} /> Vendors
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ShoppingBag size={16} /> Orders
          </TabsTrigger>
          <TabsTrigger value="swaps" className="flex items-center gap-2">
            <Package size={16} /> Swaps
          </TabsTrigger>
          <TabsTrigger value="redemptions" className="flex items-center gap-2">
            <Gift size={16} /> Redemptions
          </TabsTrigger>
          <TabsTrigger value="svanidhi" className="flex items-center gap-2">
            <HelpCircle size={16} /> SVANidhi
          </TabsTrigger>
          <TabsTrigger value="incentives" className="flex items-center gap-2">
            <Banknote size={16} /> Incentives
          </TabsTrigger>
          <TabsTrigger value="ads" className="flex items-center gap-2">
            <Image size={16} /> Ads
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <Trophy size={16} /> Actions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadVendors} disabled={loadingVendors}>
              <RefreshCw size={14} className={loadingVendors ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          {loadingVendors ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Name</th>
                      <th className="text-left p-3 font-semibold">Phone</th>
                      <th className="text-left p-3 font-semibold">Stall</th>
                      <th className="text-right p-3 font-semibold">Credit</th>
                      <th className="text-right p-3 font-semibold">Streak</th>
                      <th className="text-right p-3 font-semibold">Points</th>
                      <th className="text-left p-3 font-semibold">Role</th>
                      <th className="w-24 p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v) => (
                      <tr key={v.id} className="border-t border-border">
                        <td className="p-3 font-medium">{v.name ?? "—"}</td>
                        <td className="p-3 text-muted-foreground">{v.phone ?? "—"}</td>
                        <td className="p-3">{v.stall_type ?? "—"}</td>
                        <td className="p-3 text-right">
                          ₹{v.credit_used} / ₹{v.credit_limit}
                        </td>
                        <td className="p-3 text-right">{v.streak}</td>
                        <td className="p-3 text-right">{v.points}</td>
                        <td className="p-3">
                          <span
                            className={
                              v.role === "admin"
                                ? "text-primary font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {v.role}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditVendor(v)} title="Edit">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm({ type: "vendor", id: v.id, label: v.name ?? undefined })} title="Delete">
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {vendors.length === 0 && (
                <p className="p-6 text-center text-muted-foreground">No vendors yet</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadOrders} disabled={loadingOrders}>
              <RefreshCw size={14} className={loadingOrders ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          {loadingOrders ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Order</th>
                      <th className="text-left p-3 font-semibold">Date</th>
                      <th className="text-right p-3 font-semibold">Total</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                      <th className="w-40 p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-t border-border">
                        <td className="p-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-3 text-right font-semibold">₹{o.total}</td>
                        <td className="p-3">
                          <Select
                            value={o.status}
                            onValueChange={(val) => handleOrderStatusChange(o.id, val)}
                            disabled={orderStatusUpdating === o.id}
                          >
                            <SelectTrigger className="h-8 w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">pending</SelectItem>
                              <SelectItem value="in-transit">in-transit</SelectItem>
                              <SelectItem value="delivered">delivered</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteConfirm({ type: "order", id: o.id })}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {orders.length === 0 && (
                <p className="p-6 text-center text-muted-foreground">No orders yet</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="swaps" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadAllSwaps} disabled={loadingSwaps}>
              <RefreshCw size={14} className={loadingSwaps ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          {loadingSwaps ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : allSwaps.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              No Vendor Swap listings.
            </div>
          ) : (
            <div className="space-y-3">
              {allSwaps.map((swap) => (
                <div
                  key={swap.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{swap.title}</p>
                      <p className="text-sm text-primary">{swap.price_notes}</p>
                      {swap.location && (
                        <p className="text-xs text-muted-foreground">{swap.location}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {swap.vendor_name ?? "Vendor"} · {new Date(swap.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      swap.status === "approved" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                      swap.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    }`}>
                      {swap.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {swap.status === "pending" && (
                      <>
                        <Button size="sm" className="gap-1" onClick={() => handleModerateSwap(swap.id, "approved")} disabled={moderatingId === swap.id}>
                          {moderatingId === swap.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Approve
                        </Button>
                        <Button size="sm" variant="secondary" className="gap-1" onClick={() => handleModerateSwap(swap.id, "rejected")} disabled={moderatingId === swap.id}>
                          <X size={14} /> Reject
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="destructive" className="gap-1" onClick={() => setDeleteConfirm({ type: "swap", id: swap.id, label: swap.title })} disabled={moderatingId === swap.id}>
                      <Trash2 size={14} /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="redemptions" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadRedemptions} disabled={loadingRedemptions}>
              <RefreshCw size={14} className={loadingRedemptions ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          {loadingRedemptions ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Date</th>
                      <th className="text-left p-3 font-semibold">User</th>
                      <th className="text-left p-3 font-semibold">Reward</th>
                      <th className="text-right p-3 font-semibold">Points</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                      <th className="w-28 p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redemptions.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-3 text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="p-3 font-mono text-xs">{r.user_id.slice(0, 8)}…</td>
                        <td className="p-3">{r.reward_type.replace(/_/g, " ")}</td>
                        <td className="p-3 text-right">{r.points_spent}</td>
                        <td className="p-3">
                          <Select value={r.status} onValueChange={(val) => handleRedemptionStatus(r.id, val)}>
                            <SelectTrigger className="h-8 w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">pending</SelectItem>
                              <SelectItem value="fulfilled">fulfilled</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {redemptions.length === 0 && (
                <p className="p-6 text-center text-muted-foreground">No redemptions yet</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="svanidhi" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadSvanidhiRequests} disabled={loadingSvanidhi}>
              <RefreshCw size={14} className={loadingSvanidhi ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          {loadingSvanidhi ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Date</th>
                      <th className="text-left p-3 font-semibold">Vendor</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                      <th className="text-left p-3 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {svanidhiRequests.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-3 text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-3 font-medium">{r.user_name ?? r.user_id.slice(0, 8) + "…"}</td>
                        <td className="p-3">
                          <Select value={r.status} onValueChange={(val) => handleSvanidhiStatus(r.id, val)}>
                            <SelectTrigger className="h-8 w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">pending</SelectItem>
                              <SelectItem value="contacted">contacted</SelectItem>
                              <SelectItem value="done">done</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-muted-foreground max-w-[200px] truncate" title={r.admin_notes ?? ""}>{r.admin_notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {svanidhiRequests.length === 0 && (
                <p className="p-6 text-center text-muted-foreground">No SVANidhi support requests yet</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="incentives" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openSlabForm(null)}>
              <Plus size={14} /> Add slab
            </Button>
            <Button variant="outline" size="sm" onClick={loadIncentives} disabled={loadingIncentives}>
              <RefreshCw size={14} className={loadingIncentives ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          {loadingIncentives ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 font-bold">View Eligible for Draw</h3>
                {eligibleForDraw.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vendors eligible yet. Run Monthly Draw after vendors hit 10000+ entries.</p>
                ) : (
                  <div className="overflow-x-auto max-h-32 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr><th className="text-left p-2">Date</th><th className="text-left p-2">Vendor</th><th className="text-right p-2">Entries</th><th className="text-right p-2">Earned</th></tr>
                      </thead>
                      <tbody>
                        {eligibleForDraw.slice(0, 20).map((e) => (
                          <tr key={e.id} className="border-t border-border">
                            <td className="p-2 text-muted-foreground">{new Date(e.slab_date).toLocaleDateString()}</td>
                            <td className="p-2 font-mono text-xs">{e.vendor_id.slice(0, 8)}…</td>
                            <td className="p-2 text-right">{e.entry_count}</td>
                            <td className="p-2 text-right font-semibold">₹{Number(e.earned_amount).toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 font-bold">Incentive slabs</h3>
                <div className="space-y-1 text-sm">
                  {adminSlabs.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span>{s.slab_type} · {s.min_count}–{s.max_count ?? "∞"} entries</span>
                        {s.description && <span className="block text-xs text-muted-foreground truncate">{s.description}</span>}
                      </div>
                      <span className="font-semibold shrink-0">₹{Number(s.reward_amount).toFixed(0)}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openSlabForm(s)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={async () => { if (confirm("Delete slab?")) { await deleteIncentiveSlab(s.id); loadIncentives(); } }}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                  {adminSlabs.length === 0 && <p className="text-muted-foreground">No slabs yet. Run part12 SQL or Add slab.</p>}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <h3 className="p-4 font-bold">Vendor incentives</h3>
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Type</th>
                        <th className="text-right p-3">Entries</th>
                        <th className="text-right p-3">Earned</th>
                        <th className="text-left p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminIncentives.map((i) => (
                        <tr key={i.id} className="border-t border-border">
                          <td className="p-3 text-muted-foreground">{new Date(i.slab_date).toLocaleDateString()}</td>
                          <td className="p-3">{i.slab_type}</td>
                          <td className="p-3 text-right">{i.entry_count}</td>
                          <td className="p-3 text-right font-semibold">₹{Number(i.earned_amount).toFixed(0)}</td>
                          <td className="p-3">{i.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {adminIncentives.length === 0 && <p className="p-6 text-center text-muted-foreground">No incentives yet. Run Daily Calc in Actions.</p>}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="ads" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openAdForm(null)}>
              <Plus size={14} /> Add ad
            </Button>
            <Button variant="outline" size="sm" onClick={loadAds} disabled={loadingAds}>
              <RefreshCw size={14} className={loadingAds ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          {loadingAds ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="space-y-3">
              {adminAds.map((ad) => (
                <div key={ad.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                  <img src={ad.image_url} alt={ad.brand_name} className="h-12 w-24 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{ad.title ?? ad.brand_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{ad.link_url ?? "—"}</p>
                    <span className="inline-block mt-1 text-xs rounded-full bg-muted px-2 py-0.5">{ad.zone}</span>
                    <p className="mt-1 text-xs text-muted-foreground">Impressions: {ad.impressions_count ?? 0} · Clicks: {ad.clicks_count ?? 0}</p>
                  </div>
                  <span className={ad.is_active ? "text-green-600" : "text-muted-foreground"}>{ad.is_active ? "Active" : "Inactive"}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openAdForm(ad)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={async () => { if (confirm("Delete ad?")) { await deleteAd(ad.id); loadAds(); } }}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              {adminAds.length === 0 && <p className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">No ads yet. Add ad or run part12 SQL to seed sample ads.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <Banknote size={18} className="text-primary" />
              Run daily incentive calc
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Count yesterday&apos;s customer_orders per vendor, match slabs, insert vendor_incentives.
            </p>
            <Button onClick={handleRunDailyCalc} disabled={dailyCalcRunning}>
              {dailyCalcRunning ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
              {dailyCalcRunning ? " Running…" : " Run Daily Calc"}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <UserPlus size={18} className="text-primary" />
              Run referral bonus calc
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Pay referrers ₹100 for each referred vendor who hit 100+ entries yesterday. Run after Daily Calc.
            </p>
            <Button onClick={handleRunReferralCalc} disabled={referralCalcRunning}>
              {referralCalcRunning ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {referralCalcRunning ? " Running…" : " Run Referral Calc"}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <Trophy size={18} className="text-accent" />
              Run monthly draw
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Pick RNG winner from vendors with 10000+ entries last month (₹5000 lucky draw).
            </p>
            <Button onClick={handleRunMonthlyDraw} disabled={monthlyDrawRunning}>
              {monthlyDrawRunning ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
              {monthlyDrawRunning ? " Running…" : " Run Monthly Draw"}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <Trophy size={18} className="text-accent" />
              Run daily draw
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Pick a random winner from today&apos;s eligible entries and send them a notification.
            </p>
            <Button onClick={handleRunDraw} disabled={drawRunning}>
              {drawRunning ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
              {drawRunning ? " Running…" : " Run today&apos;s draw"}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <CreditCard size={18} className="text-primary" />
              Credit limit override
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Set a vendor&apos;s credit limit manually (overrides streak-based calculation).
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <Select value={creditUserId} onValueChange={setCreditUserId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name ?? v.phone ?? v.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Credit limit (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 5000"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button onClick={handleSaveCredit} disabled={savingCredit || !creditUserId}>
                {savingCredit ? <Loader2 size={14} className="animate-spin" /> : null}
                Save
              </Button>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Slab form sheet */}
      <Sheet open={slabFormOpen} onOpenChange={(open) => !open && setSlabFormOpen(false)}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingSlab ? "Edit incentive slab" : "Add incentive slab"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={slabForm.slab_type} onValueChange={(v) => setSlabForm((f) => ({ ...f, slab_type: v as "daily" | "monthly" }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="daily">daily</SelectItem><SelectItem value="monthly">monthly</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Min count</Label>
              <Input type="number" min={0} value={slabForm.min_count} onChange={(e) => setSlabForm((f) => ({ ...f, min_count: parseInt(e.target.value, 10) || 0 }))} className="mt-1.5" />
            </div>
            <div>
              <Label>Max count (leave empty for ∞)</Label>
              <Input type="number" min={0} placeholder="Optional" value={slabForm.max_count ?? ""} onChange={(e) => setSlabForm((f) => ({ ...f, max_count: e.target.value === "" ? null : parseInt(e.target.value, 10) || null }))} className="mt-1.5" />
            </div>
            <div>
              <Label>Reward amount (₹)</Label>
              <Input type="number" min={0} step={0.01} value={slabForm.reward_amount} onChange={(e) => setSlabForm((f) => ({ ...f, reward_amount: parseFloat(e.target.value) || 0 }))} className="mt-1.5" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input placeholder="e.g. 100+ daily entries" value={slabForm.description} onChange={(e) => setSlabForm((f) => ({ ...f, description: e.target.value }))} className="mt-1.5" />
            </div>
            <div className="flex items-center gap-2">
              <Label>Active</Label>
              <input type="checkbox" checked={slabForm.is_active} onChange={(e) => setSlabForm((f) => ({ ...f, is_active: e.target.checked }))} />
            </div>
            <Button className="w-full" onClick={handleSaveSlab} disabled={savingSlab}>{savingSlab ? "Saving…" : "Save"}</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Ad form sheet */}
      <Sheet open={adFormOpen} onOpenChange={(open) => !open && setAdFormOpen(false)}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingAd ? "Edit ad" : "Add ad"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Brand name</Label>
              <Input value={adForm.brand_name} onChange={(e) => setAdForm((f) => ({ ...f, brand_name: e.target.value }))} placeholder="e.g. XYZ Tea" className="mt-1.5" />
            </div>
            <div>
              <Label>Title (optional, shown on banner)</Label>
              <Input value={adForm.title} onChange={(e) => setAdForm((f) => ({ ...f, title: e.target.value }))} placeholder="Display title" className="mt-1.5" />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input value={adForm.image_url} onChange={(e) => setAdForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://… or upload" className="mt-1.5" />
              <p className="mt-1 text-xs text-muted-foreground">Or upload: bucket ad-images (create via part14)</p>
              <input type="file" accept="image/*" className="mt-1 block text-sm" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const { url, error } = await uploadAdImage(f);
                  if (url) setAdForm((form) => ({ ...form, image_url: url }));
                  else toast.error(error ?? "Upload failed");
                  e.target.value = "";
                }
              }} />
            </div>
            <div>
              <Label>Link URL (optional)</Label>
              <Input value={adForm.link_url} onChange={(e) => setAdForm((f) => ({ ...f, link_url: e.target.value }))} placeholder="/catalog or https://…" className="mt-1.5" />
            </div>
            <div>
              <Label>Zone</Label>
              <Input value={adForm.zone} onChange={(e) => setAdForm((f) => ({ ...f, zone: e.target.value }))} placeholder="general, Charminar, etc" className="mt-1.5" />
            </div>
            <div>
              <Label>Priority (higher = shown first)</Label>
              <Input type="number" value={adForm.priority} onChange={(e) => setAdForm((f) => ({ ...f, priority: parseInt(e.target.value, 10) || 0 }))} className="mt-1.5" />
            </div>
            <div className="flex items-center gap-2">
              <Label>Active</Label>
              <input type="checkbox" checked={adForm.is_active} onChange={(e) => setAdForm((f) => ({ ...f, is_active: e.target.checked }))} />
            </div>
            <Button className="w-full" onClick={handleSaveAd} disabled={savingAd}>{savingAd ? "Saving…" : "Save"}</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit vendor sheet */}
      <Sheet open={!!editVendor} onOpenChange={(open) => !open && setEditVendor(null)}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit vendor</SheetTitle>
          </SheetHeader>
          {editVendor && (
            <div className="mt-6 space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editVendor.name ?? ""}
                  onChange={(e) => setEditVendor({ ...editVendor, name: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={editVendor.phone ?? ""}
                  onChange={(e) => setEditVendor({ ...editVendor, phone: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Stall type</Label>
                <Input
                  value={editVendor.stall_type ?? ""}
                  onChange={(e) => setEditVendor({ ...editVendor, stall_type: e.target.value })}
                  placeholder="e.g. Tea Stall"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Points</Label>
                <Input
                  type="number"
                  min={0}
                  value={editVendor.points}
                  onChange={(e) => setEditVendor({ ...editVendor, points: parseInt(e.target.value, 10) || 0 })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Credit limit (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editVendor.credit_limit}
                  onChange={(e) => setEditVendor({ ...editVendor, credit_limit: parseInt(e.target.value, 10) || 0 })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={editVendor.role}
                  onValueChange={(v) => setEditVendor({ ...editVendor, role: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">vendor</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleSaveVendor} disabled={savingVendor}>
                {savingVendor ? <Loader2 size={16} className="animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteConfirm?.type === "vendor" ? "vendor" : deleteConfirm?.type === "order" ? "order" : "swap"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === "vendor" && "This will remove the vendor profile. Dependent data (orders, etc.) may be affected."}
              {deleteConfirm?.type === "order" && "This will permanently delete the order and its items."}
              {deleteConfirm?.type === "swap" && "This will permanently delete the swap listing."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteConfirm) return;
                const { type, id } = deleteConfirm;
                setDeleteConfirm(null);
                if (type === "vendor") void handleDeleteVendor(id);
                else if (type === "order") void handleDeleteOrder(id);
                else if (type === "swap") void handleDeleteSwap(id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
