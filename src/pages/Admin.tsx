import { useState, useEffect, useRef } from "react";
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
  Wallet,
  Image,
  UserPlus,
  Plus,
  Zap,
  Coins,
  LayoutGrid,
  Tags,
  UtensilsCrossed,
  Bike,
  Bolt,
  ChevronLeft,
  ChevronRight,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getAdminAds, getAdminAdPlacements, updateAdPlacement, upsertAd, deleteAd, uploadAdImage, type Ad } from "@/lib/ads";
import { getOndcOrdersForAdmin, type OndcOrder } from "@/lib/ondcOrders";
import {
  getAdminRentalPayouts,
  markRentalPayoutPaid,
  runRentalIncomeMonthlyCalc,
  getAdminVendorDailyActivity,
  type RentalPayoutRow,
  type VendorDailyActivityRow,
} from "@/lib/rentalIncome";
import {
  getAdminRedemptions,
  approveRedemption,
  rejectRedemption,
  getCoinsConfig,
  updateCoinsConfig,
  getAdminCustomerBonuses,
} from "@/lib/wallet";
import {
  getSectorsAdmin,
  getCategoriesAdmin,
  getDefaultMenuItemsAdmin,
  getCatalogProductsAdmin,
  upsertSector,
  deleteSector,
  upsertCategory,
  deleteCategory,
  upsertDefaultMenuItem,
  deleteDefaultMenuItem,
  upsertCatalogProduct,
  deleteCatalogProduct,
  type Sector,
  type Category,
  type DefaultMenuItem,
  type CatalogProductAdmin,
} from "@/lib/adminCatalog";
import { updateSwap } from "@/lib/swaps";
import {
  getVendorSettings,
  updateVendorSettings,
} from "@/lib/vendorCashWallet";
import {
  getAdminInstantPayoutRequests,
  adminDecideInstantPayoutRequest,
  getAdminVendorWalletBreakdown,
  type VendorInstantPayoutRequest,
  type VendorWalletBreakdownRow,
} from "@/lib/vendorCashWallet";
import {
  getAdminRiders,
  adminSetRiderVerified,
  adminRunRiderMonthlyPayout,
  getRiderSettings,
  adminUpdateRiderSettings,
  type RiderSettingsRow,
} from "@/lib/riders";

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

const ADMIN_TAB_ORDER = [
  "vendors", "orders", "swaps", "redemptions", "svanidhi", "incentives", "ads", "ondc",
  "customerRedemptions", "customerBonuses", "coinsConfig", "vendorWallet", "instantPayouts",
  "riders", "sectors", "categories", "defaultMenu", "products", "actions",
];

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
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedRedemptionIds, setSelectedRedemptionIds] = useState<string[]>([]);
  const [selectedSwapIds, setSelectedSwapIds] = useState<string[]>([]);
  const [selectedInstantPayoutIds, setSelectedInstantPayoutIds] = useState<string[]>([]);
  const [selectedRentalPayoutIds, setSelectedRentalPayoutIds] = useState<string[]>([]);
  const [selectedRewardRedemptionIds, setSelectedRewardRedemptionIds] = useState<string[]>([]);
  const [bulkActionRunning, setBulkActionRunning] = useState(false);
  const selectedOrderIdsRef = useRef<string[]>([]);
  const selectedRedemptionIdsRef = useRef<string[]>([]);
  const selectedSwapIdsRef = useRef<string[]>([]);
  const selectedInstantPayoutIdsRef = useRef<string[]>([]);
  const selectedRentalPayoutIdsRef = useRef<string[]>([]);
  const selectedRewardRedemptionIdsRef = useRef<string[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemptionRow[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [svanidhiRequests, setSvanidhiRequests] = useState<SvanidhiSupportRow[]>([]);
  const [loadingSvanidhi, setLoadingSvanidhi] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "vendor" | "order" | "swap" | "sector" | "category" | "defaultMenuItem" | "catalogProduct";
    id: string;
    label?: string;
  } | null>(null);
  const [adminIncentives, setAdminIncentives] = useState<VendorIncentive[]>([]);
  const [adminSlabs, setAdminSlabs] = useState<IncentiveSlab[]>([]);
  const [loadingIncentives, setLoadingIncentives] = useState(false);
  const [dailyCalcRunning, setDailyCalcRunning] = useState(false);
  const [referralCalcRunning, setReferralCalcRunning] = useState(false);
  const [monthlyDrawRunning, setMonthlyDrawRunning] = useState(false);
  const [adminAds, setAdminAds] = useState<Ad[]>([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [adPlacements, setAdPlacements] = useState<{ page_slug: string; enabled: boolean; label: string | null }[]>([]);
  const [loadingPlacements, setLoadingPlacements] = useState(false);
  const [eligibleForDraw, setEligibleForDraw] = useState<VendorIncentive[]>([]);
  const [rentalPayouts, setRentalPayouts] = useState<RentalPayoutRow[]>([]);
  const [loadingRentalPayouts, setLoadingRentalPayouts] = useState(false);
  const [rentalCalcMonth, setRentalCalcMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rentalCalcRunning, setRentalCalcRunning] = useState(false);
  const [dailyActivityMonth, setDailyActivityMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [dailyActivityVendorId, setDailyActivityVendorId] = useState("");
  const [dailyActivityRows, setDailyActivityRows] = useState<VendorDailyActivityRow[]>([]);
  const [loadingDailyActivity, setLoadingDailyActivity] = useState(false);
  const [slabFormOpen, setSlabFormOpen] = useState(false);
  const [editingSlab, setEditingSlab] = useState<IncentiveSlab | null>(null);
  const [savingSlab, setSavingSlab] = useState(false);
  const [slabForm, setSlabForm] = useState({ slab_type: "daily" as "daily" | "monthly", min_count: 0, max_count: null as number | null, reward_amount: 20, is_active: true, description: "" });
  const [adFormOpen, setAdFormOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [savingAd, setSavingAd] = useState(false);
  const [adForm, setAdForm] = useState({ brand_name: "", title: "", image_url: "", link_url: "", zone: "general", is_active: true, priority: 0 });
  const [ondcOrders, setOndcOrders] = useState<OndcOrder[]>([]);
  const [loadingOndc, setLoadingOndc] = useState(false);
  const [customerRedemptions, setCustomerRedemptions] = useState<Awaited<ReturnType<typeof getAdminRedemptions>>>([]);
  const [loadingCustomerRedemptions, setLoadingCustomerRedemptions] = useState(false);
  const [approvingRedemptionId, setApprovingRedemptionId] = useState<string | null>(null);
  const [customerBonuses, setCustomerBonuses] = useState<Awaited<ReturnType<typeof getAdminCustomerBonuses>>>([]);
  const [loadingCustomerBonuses, setLoadingCustomerBonuses] = useState(false);
  const [coinsConfig, setCoinsConfig] = useState<Awaited<ReturnType<typeof getCoinsConfig>>>([]);
  const [loadingCoinsConfig, setLoadingCoinsConfig] = useState(false);
  const [savingCoinsConfig, setSavingCoinsConfig] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultMenuItems, setDefaultMenuItems] = useState<DefaultMenuItem[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingDefaultMenu, setLoadingDefaultMenu] = useState(false);
  const [sectorFormOpen, setSectorFormOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [sectorForm, setSectorForm] = useState({ name: "", icon: "" });
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", sector_id: "", gst_rate: 5 });
  const [defaultMenuFormOpen, setDefaultMenuFormOpen] = useState(false);
  const [editingDefaultMenu, setEditingDefaultMenu] = useState<DefaultMenuItem | null>(null);
  const [defaultMenuForm, setDefaultMenuForm] = useState({
    sector_id: "",
    item_name: "",
    description: "",
    default_selling_price_range: "10-50",
    gst_rate: 5,
    sort_order: 0,
  });
  const [swapEditOpen, setSwapEditOpen] = useState(false);
  const [editingSwap, setEditingSwap] = useState<VendorSwap | null>(null);
  const [swapEditForm, setSwapEditForm] = useState({ title: "", description: "", price_notes: "", location: "" });
  const [svanidhiEditNotesId, setSvanidhiEditNotesId] = useState<string | null>(null);
  const [svanidhiNotesValue, setSvanidhiNotesValue] = useState("");
  const [catalogProducts, setCatalogProducts] = useState<CatalogProductAdmin[]>([]);
  const [loadingCatalogProducts, setLoadingCatalogProducts] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProductAdmin | null>(null);
  const [vendorWalletSettings, setVendorWalletSettings] = useState<{
    signup_bonus_amount: number;
    min_withdrawal_amount: number;
    min_instant_transfer_amount?: number;
  } | null>(null);
  const [loadingVendorWalletSettings, setLoadingVendorWalletSettings] = useState(false);
  const [savingVendorWalletSettings, setSavingVendorWalletSettings] = useState(false);
  const [ridersList, setRidersList] = useState<Awaited<ReturnType<typeof getAdminRiders>>>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [riderSettings, setRiderSettings] = useState<RiderSettingsRow[]>([]);
  const [loadingRiderSettings, setLoadingRiderSettings] = useState(false);
  const [riderPayoutRunning, setRiderPayoutRunning] = useState(false);
  const [instantPayouts, setInstantPayouts] = useState<VendorInstantPayoutRequest[]>([]);
  const [walletBreakdown, setWalletBreakdown] = useState<VendorWalletBreakdownRow[]>([]);
  const [loadingInstantPayouts, setLoadingInstantPayouts] = useState(false);
  const [processingInstantPayoutId, setProcessingInstantPayoutId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    name_hi: "",
    name_te: "",
    category_id: "",
    description: "",
    description_hi: "",
    description_te: "",
    mrp: "",
    selling_price: "",
    discount_percent: 0,
    gst_rate: 5,
    image_url: "",
    stock_quantity: 0,
    is_eco: false,
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    selectedOrderIdsRef.current = selectedOrderIds;
  }, [selectedOrderIds]);
  useEffect(() => {
    selectedRedemptionIdsRef.current = selectedRedemptionIds;
  }, [selectedRedemptionIds]);
  useEffect(() => {
    selectedSwapIdsRef.current = selectedSwapIds;
  }, [selectedSwapIds]);
  useEffect(() => {
    selectedInstantPayoutIdsRef.current = selectedInstantPayoutIds;
  }, [selectedInstantPayoutIds]);
  useEffect(() => {
    selectedRentalPayoutIdsRef.current = selectedRentalPayoutIds;
  }, [selectedRentalPayoutIds]);
  useEffect(() => {
    selectedRewardRedemptionIdsRef.current = selectedRewardRedemptionIds;
  }, [selectedRewardRedemptionIds]);

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

  const loadCustomerRedemptions = async () => {
    setLoadingCustomerRedemptions(true);
    const list = await getAdminRedemptions();
    setCustomerRedemptions(list);
    setLoadingCustomerRedemptions(false);
  };

  const loadCoinsConfig = async () => {
    setLoadingCoinsConfig(true);
    const list = await getCoinsConfig();
    setCoinsConfig(list);
    setLoadingCoinsConfig(false);
  };

  const loadCustomerBonuses = async () => {
    setLoadingCustomerBonuses(true);
    try {
      const list = await getAdminCustomerBonuses(300);
      setCustomerBonuses(list);
    } catch {
      setCustomerBonuses([]);
    } finally {
      setLoadingCustomerBonuses(false);
    }
  };

  const loadVendorWalletSettings = async () => {
    setLoadingVendorWalletSettings(true);
    try {
      const s = await getVendorSettings();
      if (s) {
        setVendorWalletSettings({
          signup_bonus_amount: Number(s.signup_bonus_amount),
          min_withdrawal_amount: Number(s.min_withdrawal_amount),
          min_instant_transfer_amount: Number((s as { min_instant_transfer_amount?: number }).min_instant_transfer_amount ?? 100),
        });
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingVendorWalletSettings(false);
    }
  };

  const loadRiders = async () => {
    setLoadingRiders(true);
    try {
      const list = await getAdminRiders(200);
      setRidersList(list);
    } catch {
      setRidersList([]);
    } finally {
      setLoadingRiders(false);
    }
  };

  const loadRiderSettings = async () => {
    setLoadingRiderSettings(true);
    try {
      const list = await getRiderSettings();
      setRiderSettings(list);
    } catch {
      setRiderSettings([]);
    } finally {
      setLoadingRiderSettings(false);
    }
  };

  const loadSectors = async () => {
    setLoadingSectors(true);
    const list = await getSectorsAdmin();
    setSectors(list);
    setLoadingSectors(false);
  };

  const loadCategories = async () => {
    setLoadingCategories(true);
    const list = await getCategoriesAdmin();
    setCategories(list);
    setLoadingCategories(false);
  };

  const loadDefaultMenu = async () => {
    setLoadingDefaultMenu(true);
    const list = await getDefaultMenuItemsAdmin();
    setDefaultMenuItems(list);
    setLoadingDefaultMenu(false);
  };

  const loadCatalogProducts = async () => {
    setLoadingCatalogProducts(true);
    const list = await getCatalogProductsAdmin();
    setCatalogProducts(list);
    setLoadingCatalogProducts(false);
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
    setLoadingRentalPayouts(true);
    try {
      const [inc, slabs, eligible, rental] = await Promise.all([
        getAdminVendorIncentives(),
        getAllIncentiveSlabs(),
        getEligibleForDraw(),
        getAdminRentalPayouts(50),
      ]);
      setAdminIncentives(inc);
      setAdminSlabs(slabs);
      setEligibleForDraw(eligible);
      setRentalPayouts(rental);
    } finally {
      setLoadingIncentives(false);
      setLoadingRentalPayouts(false);
    }
  };

  const loadAds = async () => {
    setLoadingAds(true);
    const list = await getAdminAds();
    setAdminAds(list);
    setLoadingAds(false);
  };

  const loadAdPlacements = async () => {
    setLoadingPlacements(true);
    const list = await getAdminAdPlacements();
    setAdPlacements(list);
    setLoadingPlacements(false);
  };

  const handlePlacementToggle = async (pageSlug: string, enabled: boolean) => {
    const res = await updateAdPlacement(pageSlug, enabled);
    if (res.ok) {
      setAdPlacements((prev) => prev.map((p) => (p.page_slug === pageSlug ? { ...p, enabled } : p)));
      toast.success(`Ad placement ${pageSlug} ${enabled ? "enabled" : "disabled"}`);
    } else {
      toast.error(res.error ?? "Failed to update");
    }
  };

  const loadOndc = async () => {
    setLoadingOndc(true);
    const ords = await getOndcOrdersForAdmin();
    setOndcOrders(ords);
    setLoadingOndc(false);
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

  const loadInstantPayouts = async () => {
    setLoadingInstantPayouts(true);
    try {
      const list = await getAdminInstantPayoutRequests(300);
      setInstantPayouts(list);
    } catch {
      setInstantPayouts([]);
    } finally {
      setLoadingInstantPayouts(false);
    }
  };

  const loadWalletBreakdown = async () => {
    try {
      const rows = await getAdminVendorWalletBreakdown();
      setWalletBreakdown(rows);
    } catch {
      setWalletBreakdown([]);
    }
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
      loadAdPlacements();
      loadOndc();
      loadCustomerRedemptions();
      loadCustomerBonuses();
      loadCoinsConfig();
      loadVendorWalletSettings();
      loadRiders();
      loadRiderSettings();
      loadInstantPayouts();
      loadWalletBreakdown();
      loadSectors();
      loadCategories();
      loadDefaultMenu();
      loadCatalogProducts();
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

  const openSwapEdit = (swap: VendorSwap) => {
    setEditingSwap(swap);
    setSwapEditForm({
      title: swap.title,
      description: swap.description ?? "",
      price_notes: swap.price_notes ?? "",
      location: swap.location ?? "",
    });
    setSwapEditOpen(true);
  };

  const handleUpdateSwap = async () => {
    if (!editingSwap) return;
    setModeratingId(editingSwap.id);
    const result = await updateSwap(editingSwap.id, swapEditForm);
    setModeratingId(null);
    setSwapEditOpen(false);
    setEditingSwap(null);
    if (result.ok) {
      toast.success("Swap updated");
      loadAllSwaps();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleSaveSvanidhiNotes = async (id: string) => {
    const { error } = await supabase.from("svanidhi_support_requests").update({ admin_notes: svanidhiNotesValue }).eq("id", id);
    if (error) toast.error("Could not save notes");
    else {
      toast.success("Notes saved");
      setSvanidhiEditNotesId(null);
      loadSvanidhiRequests();
    }
  };

  const openSectorForm = (sector: Sector | null) => {
    setEditingSector(sector);
    setSectorForm({ name: sector?.name ?? "", icon: sector?.icon ?? "" });
    setSectorFormOpen(true);
  };

  const handleSaveSector = async () => {
    if (!sectorForm.name.trim()) {
      toast.error("Name required");
      return;
    }
    const result = await upsertSector({ id: editingSector?.id, name: sectorForm.name.trim(), icon: sectorForm.icon.trim() || null });
    if (result.ok) {
      toast.success(editingSector ? "Sector updated" : "Sector added");
      setSectorFormOpen(false);
      setEditingSector(null);
      loadSectors();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const openCategoryForm = (category: Category | null) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category?.name ?? "",
      sector_id: category?.sector_id ?? sectors[0]?.id ?? "",
      gst_rate: category?.gst_rate ?? 5,
    });
    setCategoryFormOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim() || !categoryForm.sector_id) {
      toast.error("Name and sector required");
      return;
    }
    const result = await upsertCategory({
      id: editingCategory?.id,
      name: categoryForm.name.trim(),
      sector_id: categoryForm.sector_id,
      gst_rate: categoryForm.gst_rate,
    });
    if (result.ok) {
      toast.success(editingCategory ? "Category updated" : "Category added");
      setCategoryFormOpen(false);
      setEditingCategory(null);
      loadCategories();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const openDefaultMenuForm = (item: DefaultMenuItem | null) => {
    setEditingDefaultMenu(item);
    setDefaultMenuForm({
      sector_id: item?.sector_id ?? sectors[0]?.id ?? "",
      item_name: item?.item_name ?? "",
      description: item?.description ?? "",
      default_selling_price_range: item?.default_selling_price_range ?? "10-50",
      gst_rate: item?.gst_rate ?? 5,
      sort_order: item?.sort_order ?? 0,
    });
    setDefaultMenuFormOpen(true);
  };

  const handleSaveDefaultMenu = async () => {
    if (!defaultMenuForm.item_name.trim() || !defaultMenuForm.sector_id) {
      toast.error("Item name and sector required");
      return;
    }
    const result = await upsertDefaultMenuItem({
      id: editingDefaultMenu?.id,
      sector_id: defaultMenuForm.sector_id,
      item_name: defaultMenuForm.item_name.trim(),
      description: defaultMenuForm.description.trim() || null,
      default_selling_price_range: defaultMenuForm.default_selling_price_range,
      gst_rate: defaultMenuForm.gst_rate,
      sort_order: defaultMenuForm.sort_order,
    });
    if (result.ok) {
      toast.success(editingDefaultMenu ? "Menu item updated" : "Menu item added");
      setDefaultMenuFormOpen(false);
      setEditingDefaultMenu(null);
      loadDefaultMenu();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleDeleteSector = async (id: string) => {
    const r = await deleteSector(id);
    if (r.ok) {
      toast.success("Sector deleted");
      setDeleteConfirm(null);
      loadSectors();
    } else {
      toast.error(r.error ?? "Failed");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const r = await deleteCategory(id);
    if (r.ok) {
      toast.success("Category deleted");
      setDeleteConfirm(null);
      loadCategories();
    } else {
      toast.error(r.error ?? "Failed");
    }
  };

  const handleDeleteDefaultMenuItem = async (id: string) => {
    const r = await deleteDefaultMenuItem(id);
    if (r.ok) {
      toast.success("Menu item deleted");
      setDeleteConfirm(null);
      loadDefaultMenu();
    } else {
      toast.error(r.error ?? "Failed");
    }
  };

  const openProductForm = (product: CatalogProductAdmin | null) => {
    setEditingProduct(product);
    setProductForm({
      name: product?.name ?? "",
      name_hi: product?.name_hi ?? "",
      name_te: product?.name_te ?? "",
      category_id: product?.category_id ?? categories[0]?.id ?? "",
      description: product?.description ?? "",
      description_hi: product?.description_hi ?? "",
      description_te: product?.description_te ?? "",
      mrp: product != null ? String(product.mrp / 100) : "",
      selling_price: product != null ? String(product.selling_price / 100) : "",
      discount_percent: product?.discount_percent ?? 0,
      gst_rate: product?.gst_rate ?? 5,
      image_url: product?.image_url ?? "",
      stock_quantity: product?.stock_quantity ?? 0,
      is_eco: product?.is_eco ?? false,
    });
    setProductFormOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.category_id) {
      toast.error("Name and category required");
      return;
    }
    const mrpPaise = Math.round(parseFloat(productForm.mrp || "0") * 100);
    const sellingPaise = Math.round(parseFloat(productForm.selling_price || "0") * 100);
    const result = await upsertCatalogProduct({
      id: editingProduct?.id,
      name: productForm.name.trim(),
      name_hi: productForm.name_hi.trim() || null,
      name_te: productForm.name_te.trim() || null,
      category_id: productForm.category_id,
      description: productForm.description.trim() || null,
      description_hi: productForm.description_hi.trim() || null,
      description_te: productForm.description_te.trim() || null,
      mrp: mrpPaise,
      selling_price: sellingPaise,
      discount_percent: productForm.discount_percent,
      gst_rate: productForm.gst_rate,
      image_url: productForm.image_url.trim() || null,
      stock_quantity: productForm.stock_quantity,
      is_eco: productForm.is_eco,
    });
    if (result.ok) {
      toast.success(editingProduct ? "Product updated" : "Product added");
      setProductFormOpen(false);
      setEditingProduct(null);
      loadCatalogProducts();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleDeleteCatalogProduct = async (id: string) => {
    const r = await deleteCatalogProduct(id);
    if (r.ok) {
      toast.success("Product deleted");
      setDeleteConfirm(null);
      loadCatalogProducts();
    } else {
      toast.error(r.error ?? "Failed");
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

  const handleBulkOrderStatusUpdate = async (newStatus: string) => {
    const ids = selectedOrderIdsRef.current;
    if (ids.length === 0) return;
    setBulkActionRunning(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .in("id", ids);
      if (error) throw error;
      toast.success(`Updated ${ids.length} order(s) to ${newStatus}`);
      setSelectedOrderIds([]);
      loadOrders();
    } catch {
      toast.error("Could not update orders");
    } finally {
      setBulkActionRunning(false);
    }
  };

  const handleBulkOrderDelete = async () => {
    const ids = selectedOrderIdsRef.current;
    if (ids.length === 0) return;
    setBulkActionRunning(true);
    try {
      for (const orderId of ids) {
        await supabase.from("order_items").delete().eq("order_id", orderId);
        await supabase.from("orders").delete().eq("id", orderId);
      }
      toast.success(`Deleted ${ids.length} order(s)`);
      setSelectedOrderIds([]);
      loadOrders();
    } catch {
      toast.error("Could not delete some orders");
    } finally {
      setBulkActionRunning(false);
    }
  };

  const handleBulkRedemptionAction = async (action: "approve" | "reject") => {
    const ids = selectedRedemptionIdsRef.current;
    if (ids.length === 0) return;
    setBulkActionRunning(true);
    try {
      const results = await Promise.all(
        ids.map((id) => (action === "approve" ? approveRedemption(id) : rejectRedemption(id)))
      );
      const ok = results.filter((r) => r?.ok).length;
      const fail = results.length - ok;
      if (ok) toast.success(`${action === "approve" ? "Approved" : "Rejected"} ${ok} redemption(s)`);
      if (fail) toast.error(`${fail} failed`);
      setSelectedRedemptionIds([]);
      loadCustomerRedemptions();
    } catch {
      toast.error("Bulk action failed");
    } finally {
      setBulkActionRunning(false);
    }
  };

  const handleBulkSwapModerate = async (status: "approved" | "rejected") => {
    const ids = selectedSwapIdsRef.current;
    if (ids.length === 0) return;
    setBulkActionRunning(true);
    try {
      const results = await Promise.all(ids.map((id) => moderateSwap(id, status)));
      const ok = results.filter((r) => r?.ok).length;
      if (ok) toast.success(`${status === "approved" ? "Approved" : "Rejected"} ${ok} swap(s)`);
      setSelectedSwapIds([]);
      loadAllSwaps();
    } catch {
      toast.error("Bulk action failed");
    } finally {
      setBulkActionRunning(false);
    }
  };

  const handleBulkInstantPayoutAction = async (action: "approve" | "reject") => {
    const ids = selectedInstantPayoutIdsRef.current;
    if (ids.length === 0) return;
    setBulkActionRunning(true);
    try {
      const results = await Promise.all(
        ids.map((id) => adminDecideInstantPayoutRequest(id, action === "approve" ? "approve" : "reject"))
      );
      const ok = results.filter((r) => r?.ok).length;
      if (ok) toast.success(`${action === "approve" ? "Approved" : "Rejected"} ${ok} request(s)`);
      setSelectedInstantPayoutIds([]);
      loadInstantPayouts();
    } catch {
      toast.error("Bulk action failed");
    } finally {
      setBulkActionRunning(false);
    }
  };

  const handleBulkRentalCredit = async () => {
    const ids = selectedRentalPayoutIdsRef.current;
    if (ids.length === 0) return;
    setBulkActionRunning(true);
    try {
      let ok = 0;
      for (const id of ids) {
        const res = await markRentalPayoutPaid(id);
        if (res.ok) ok++;
      }
      if (ok) toast.success(`Credited ${ok} rental payout(s) to wallet`);
      setSelectedRentalPayoutIds([]);
      loadIncentives();
    } catch {
      toast.error("Bulk credit failed");
    } finally {
      setBulkActionRunning(false);
    }
  };

  const handleBulkRewardRedemptionStatus = async (status: string) => {
    const ids = selectedRewardRedemptionIdsRef.current;
    if (ids.length === 0) return;
    setBulkActionRunning(true);
    try {
      const { error } = await supabase
        .from("reward_redemptions")
        .update({ status })
        .in("id", ids);
      if (error) throw error;
      toast.success(`Updated ${ids.length} redemption(s) to ${status}`);
      setSelectedRewardRedemptionIds([]);
      loadRedemptions();
    } catch {
      toast.error("Could not update redemptions");
    } finally {
      setBulkActionRunning(false);
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

  const tabTriggerClass =
    "flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-gray-600 data-[state=active]:bg-[#F97316]/10 data-[state=active]:text-[#F97316] data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#F97316] shrink-0 transition-all hover:scale-[1.02] min-h-[44px]";

  const [adminTab, setAdminTab] = useState("vendors");
  const currentTabIndex = ADMIN_TAB_ORDER.indexOf(adminTab);
  const canGoPrev = currentTabIndex > 0;
  const canGoNext = currentTabIndex >= 0 && currentTabIndex < ADMIN_TAB_ORDER.length - 1;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && canGoPrev) {
        setAdminTab(ADMIN_TAB_ORDER[currentTabIndex - 1]);
      } else if (e.key === "ArrowRight" && canGoNext) {
        setAdminTab(ADMIN_TAB_ORDER[currentTabIndex + 1]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentTabIndex, canGoPrev, canGoNext]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#F9FAFB]">
        <div className="container max-w-5xl py-6 px-4 pb-24">
          <div className="mb-6 flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="rounded-lg hover:bg-white/80 min-h-[44px] min-w-[44px]">
                <ArrowLeft size={18} />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield size={22} className="text-[#F97316]" />
              <h1 className="text-xl font-extrabold text-gray-900">Admin</h1>
            </div>
          </div>

          <Tabs value={adminTab} onValueChange={setAdminTab} className="space-y-4">
            <div className="flex items-center gap-1 w-full">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 rounded-lg border-gray-200 h-12 w-10"
                disabled={!canGoPrev}
                onClick={() => canGoPrev && setAdminTab(ADMIN_TAB_ORDER[currentTabIndex - 1])}
                aria-label="Previous tab"
              >
                <ChevronLeft size={20} />
              </Button>
              <TabsList className="inline-flex h-12 flex-1 min-w-0 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm justify-start gap-0 flex-nowrap [&::-webkit-scrollbar]:h-1">
          <TabsTrigger value="vendors" className={tabTriggerClass}>
            <Users size={16} /> Vendors
          </TabsTrigger>
          <TabsTrigger value="orders" className={tabTriggerClass}>
            <ShoppingBag size={16} /> Orders
          </TabsTrigger>
          <TabsTrigger value="swaps" className={tabTriggerClass}>
            <Package size={16} /> Swaps
          </TabsTrigger>
          <TabsTrigger value="redemptions" className={tabTriggerClass}>
            <Gift size={16} /> Redemptions
          </TabsTrigger>
          <TabsTrigger value="svanidhi" className={tabTriggerClass}>
            <HelpCircle size={16} /> SVANidhi
          </TabsTrigger>
          <TabsTrigger value="incentives" className={tabTriggerClass}>
            <Banknote size={16} /> Incentives
          </TabsTrigger>
          <TabsTrigger value="ads" className={tabTriggerClass}>
            <Image size={16} /> Ads
          </TabsTrigger>
          <TabsTrigger value="ondc" className={tabTriggerClass}>
            <Zap size={16} /> ONDC
          </TabsTrigger>
          <TabsTrigger value="customerRedemptions" className={tabTriggerClass}>
            <CreditCard size={16} /> Customer Redemptions
          </TabsTrigger>
          <TabsTrigger value="customerBonuses" className={tabTriggerClass}>
            <Gift size={16} /> Customer Bonuses
          </TabsTrigger>
          <TabsTrigger value="coinsConfig" className={tabTriggerClass}>
            <Coins size={16} /> Coins
          </TabsTrigger>
          <TabsTrigger value="vendorWallet" className={tabTriggerClass}>
            <Wallet size={16} /> Vendor Wallet
          </TabsTrigger>
          <TabsTrigger value="instantPayouts" className={tabTriggerClass}>
            <Bolt size={16} /> Instant Payouts
          </TabsTrigger>
          <TabsTrigger value="riders" className={tabTriggerClass}>
            <Bike size={16} /> Riders
          </TabsTrigger>
          <TabsTrigger value="sectors" className={tabTriggerClass}>
            <LayoutGrid size={16} /> Sectors
          </TabsTrigger>
          <TabsTrigger value="categories" className={tabTriggerClass}>
            <Tags size={16} /> Categories
          </TabsTrigger>
          <TabsTrigger value="defaultMenu" className={tabTriggerClass}>
            <UtensilsCrossed size={16} /> Menu
          </TabsTrigger>
          <TabsTrigger value="products" className={tabTriggerClass}>
            <Package size={16} /> Products
          </TabsTrigger>
          <TabsTrigger value="actions" className={tabTriggerClass}>
            <Trophy size={16} /> Actions
          </TabsTrigger>
        </TabsList>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 rounded-lg border-gray-200 h-12 w-10"
                disabled={!canGoNext}
                onClick={() => canGoNext && setAdminTab(ADMIN_TAB_ORDER[currentTabIndex + 1])}
                aria-label="Next tab"
              >
                <ChevronRight size={20} />
              </Button>
            </div>

        <TabsContent value="vendors" className="space-y-4 mt-4">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <div className="flex justify-end mb-3">
              <Button variant="outline" size="sm" onClick={loadVendors} disabled={loadingVendors} className="min-h-[44px]">
                <RefreshCw size={14} className={loadingVendors ? "animate-spin" : ""} /> Refresh
              </Button>
            </div>
            {loadingVendors ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : (
            <Card className="shadow-md rounded-lg border-gray-200 overflow-hidden transition-transform hover:shadow-lg">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Name</th>
                      <th className="text-left p-3 font-semibold">Phone</th>
                      <th className="text-left p-3 font-semibold">Dukaan</th>
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
            </Card>
          )}
          </motion.div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadOrders} disabled={loadingOrders}>
                <RefreshCw size={14} className={loadingOrders ? "animate-spin" : ""} /> Refresh
              </Button>
              {selectedOrderIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <span className="text-sm font-medium">{selectedOrderIds.length} selected</span>
                  <Select onValueChange={(val) => handleBulkOrderStatusUpdate(val)} disabled={bulkActionRunning}>
                    <SelectTrigger className="h-8 w-[130px]">
                      <SelectValue placeholder="Bulk status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">pending</SelectItem>
                      <SelectItem value="in-transit">in-transit</SelectItem>
                      <SelectItem value="delivered">delivered</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="destructive" onClick={handleBulkOrderDelete} disabled={bulkActionRunning}>
                    {bulkActionRunning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete selected
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedOrderIds([])}>Clear</Button>
                </div>
              )}
            </div>
          </div>
          {loadingOrders ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="w-10 p-3 text-left">
                        <Checkbox
                          checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                          onCheckedChange={(checked) => setSelectedOrderIds(checked ? orders.map((o) => o.id) : [])}
                          aria-label="Select all orders"
                        />
                      </th>
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
                        <td className="p-3">
                          <Checkbox
                            checked={selectedOrderIds.includes(o.id)}
                            onCheckedChange={(checked) => setSelectedOrderIds((prev) => checked ? [...prev, o.id] : prev.filter((id) => id !== o.id))}
                            aria-label={`Select order ${o.id.slice(0, 8)}`}
                          />
                        </td>
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
          {(() => {
            const pendingSwaps = allSwaps.filter((s) => s.status === "pending");
            const allPendingSwapSelected = pendingSwaps.length > 0 && selectedSwapIds.length === pendingSwaps.length;
            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={loadAllSwaps} disabled={loadingSwaps}>
                    <RefreshCw size={14} className={loadingSwaps ? "animate-spin" : ""} /> Refresh
                  </Button>
                  {selectedSwapIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span className="text-sm font-medium">{selectedSwapIds.length} selected</span>
                      <Button size="sm" onClick={() => handleBulkSwapModerate("approved")} disabled={bulkActionRunning}>
                        {bulkActionRunning ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve selected
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleBulkSwapModerate("rejected")} disabled={bulkActionRunning}>
                        <X size={14} /> Reject selected
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedSwapIds([])}>Clear</Button>
                    </div>
                  )}
                </div>
                {loadingSwaps ? (
                  <Skeleton className="h-48 w-full rounded-xl" />
                ) : allSwaps.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                    No Vendor Swap listings.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingSwaps.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox
                          checked={allPendingSwapSelected}
                          onCheckedChange={(checked) => setSelectedSwapIds(checked ? pendingSwaps.map((s) => s.id) : [])}
                          aria-label="Select all pending swaps"
                        />
                        <span>Select all pending ({pendingSwaps.length})</span>
                      </div>
                    )}
                    {allSwaps.map((swap) => (
                      <div
                        key={swap.id}
                        className="rounded-xl border border-border bg-card p-4 flex items-start gap-3"
                      >
                        {swap.status === "pending" && (
                          <div className="pt-0.5">
                            <Checkbox
                              checked={selectedSwapIds.includes(swap.id)}
                              onCheckedChange={(checked) => setSelectedSwapIds((prev) => checked ? [...prev, swap.id] : prev.filter((id) => id !== swap.id))}
                              aria-label={`Select swap ${swap.title}`}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
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
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => openSwapEdit(swap)} disabled={moderatingId === swap.id}>
                              <Pencil size={14} /> Edit
                            </Button>
                            <Button size="sm" variant="destructive" className="gap-1" onClick={() => setDeleteConfirm({ type: "swap", id: swap.id, label: swap.title })} disabled={moderatingId === swap.id}>
                              <Trash2 size={14} /> Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="redemptions" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={loadRedemptions} disabled={loadingRedemptions}>
              <RefreshCw size={14} className={loadingRedemptions ? "animate-spin" : ""} /> Refresh
            </Button>
            {selectedRewardRedemptionIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <span className="text-sm font-medium">{selectedRewardRedemptionIds.length} selected</span>
                <Select onValueChange={handleBulkRewardRedemptionStatus} disabled={bulkActionRunning}>
                  <SelectTrigger className="h-8 w-[130px]">
                    <SelectValue placeholder="Bulk status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="fulfilled">fulfilled</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => setSelectedRewardRedemptionIds([])}>Clear</Button>
              </div>
            )}
          </div>
          {loadingRedemptions ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="w-10 p-3 text-left">
                        <Checkbox
                          checked={redemptions.length > 0 && selectedRewardRedemptionIds.length === redemptions.length}
                          onCheckedChange={(checked) => setSelectedRewardRedemptionIds(checked ? redemptions.map((r) => r.id) : [])}
                          aria-label="Select all reward redemptions"
                        />
                      </th>
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
                        <td className="p-3">
                          <Checkbox
                            checked={selectedRewardRedemptionIds.includes(r.id)}
                            onCheckedChange={(checked) => setSelectedRewardRedemptionIds((prev) => checked ? [...prev, r.id] : prev.filter((id) => id !== r.id))}
                            aria-label={`Select redemption ${r.id.slice(0, 8)}`}
                          />
                        </td>
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
                        <td className="p-3">
                          {svanidhiEditNotesId === r.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={svanidhiNotesValue}
                                onChange={(e) => setSvanidhiNotesValue(e.target.value)}
                                placeholder="Admin notes"
                                className="h-8 max-w-[200px]"
                                autoFocus
                              />
                              <Button size="sm" variant="secondary" onClick={() => handleSaveSvanidhiNotes(r.id)}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setSvanidhiEditNotesId(null); }}>Cancel</Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="max-w-[180px] truncate text-muted-foreground" title={r.admin_notes ?? ""}>{r.admin_notes ?? "—"}</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setSvanidhiEditNotesId(r.id); setSvanidhiNotesValue(r.admin_notes ?? ""); }} title="Edit notes">
                                <Pencil size={12} />
                              </Button>
                            </div>
                          )}
                        </td>
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
              <div className="rounded-xl border border-border bg-card overflow-hidden p-4 space-y-4">
                <h3 className="font-bold">Rental income (prorated by successful days)</h3>
                <p className="text-xs text-muted-foreground">Credit = slab × (successful_days ÷ 30). Run monthly calc to compute and credit. Slabs by volume; successful day = 9+ paid tx that day.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm">Month (YYYY-MM):</label>
                  <input
                    type="month"
                    className="rounded border border-input bg-background px-2 py-1 text-sm"
                    value={rentalCalcMonth}
                    onChange={(e) => setRentalCalcMonth(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={rentalCalcRunning}
                    onClick={async () => {
                      setRentalCalcRunning(true);
                      const res = await runRentalIncomeMonthlyCalc(rentalCalcMonth);
                      setRentalCalcRunning(false);
                      if (res.ok) {
                        toast.success(`Monthly calc done. Vendors processed: ${res.vendorsProcessed ?? 0}`);
                        loadIncentives();
                      } else toast.error(res.error ?? "Failed");
                    }}
                  >
                    {rentalCalcRunning ? "Running…" : "Run monthly calc"}
                  </Button>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <h4 className="text-sm font-semibold">Vendor daily activity</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="month"
                      className="rounded border border-input bg-background px-2 py-1 text-sm"
                      value={dailyActivityMonth}
                      onChange={(e) => setDailyActivityMonth(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Vendor ID (optional)"
                      className="rounded border border-input bg-background px-2 py-1 text-sm w-48 font-mono text-xs"
                      value={dailyActivityVendorId}
                      onChange={(e) => setDailyActivityVendorId(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingDailyActivity}
                      onClick={async () => {
                        setLoadingDailyActivity(true);
                        const rows = await getAdminVendorDailyActivity(dailyActivityMonth, dailyActivityVendorId || undefined);
                        setDailyActivityRows(rows);
                        setLoadingDailyActivity(false);
                      }}
                    >
                      {loadingDailyActivity ? "Loading…" : "Load"}
                    </Button>
                  </div>
                  {dailyActivityRows.length > 0 && (
                    <div className="overflow-x-auto max-h-[30vh] rounded border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left p-2">Vendor</th>
                            <th className="text-left p-2">Date</th>
                            <th className="text-right p-2">Tx count</th>
                            <th className="text-left p-2">Successful</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyActivityRows.map((row, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="p-2 font-mono text-xs">{row.vendor_id.slice(0, 8)}…</td>
                              <td className="p-2 text-muted-foreground">{row.date}</td>
                              <td className="p-2 text-right">{row.tx_count}</td>
                              <td className="p-2">{row.is_successful ? "Yes" : "No"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                {selectedRentalPayoutIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <span className="text-sm font-medium">{selectedRentalPayoutIds.length} selected</span>
                    <Button size="sm" onClick={handleBulkRentalCredit} disabled={bulkActionRunning}>
                      {bulkActionRunning ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />} Credit selected to wallet
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedRentalPayoutIds([])}>Clear</Button>
                  </div>
                )}
                {loadingRentalPayouts ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <div className="overflow-x-auto max-h-[40vh]">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="w-10 p-3 text-left">
                            {rentalPayouts.filter((r) => r.status === "pending").length > 0 && (
                              <Checkbox
                                checked={rentalPayouts.filter((r) => r.status === "pending").length > 0 && selectedRentalPayoutIds.length === rentalPayouts.filter((r) => r.status === "pending").length}
                                onCheckedChange={(checked) => setSelectedRentalPayoutIds(checked ? rentalPayouts.filter((r) => r.status === "pending").map((r) => r.id) : [])}
                                aria-label="Select all pending rental payouts"
                              />
                            )}
                          </th>
                          <th className="text-left p-3">Month</th>
                          <th className="text-left p-3">Vendor</th>
                          <th className="text-right p-3">Volume</th>
                          <th className="text-right p-3">Success days</th>
                          <th className="text-right p-3">Amount</th>
                          <th className="text-left p-3">Status</th>
                          <th className="text-left p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rentalPayouts.map((r) => (
                          <tr key={r.id} className="border-t border-border">
                            <td className="p-3">
                              {r.status === "pending" && (
                                <Checkbox
                                  checked={selectedRentalPayoutIds.includes(r.id)}
                                  onCheckedChange={(checked) => setSelectedRentalPayoutIds((prev) => checked ? [...prev, r.id] : prev.filter((id) => id !== r.id))}
                                  aria-label={`Select rental payout ${r.id.slice(0, 8)}`}
                                />
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">{r.month}</td>
                            <td className="p-3 font-mono text-xs">{r.vendor_id.slice(0, 8)}…</td>
                            <td className="p-3 text-right">₹{Number(r.transaction_volume).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right">{r.successful_days != null ? `${r.successful_days}/30` : "—"}</td>
                            <td className="p-3 text-right font-semibold">₹{Number(r.incentive_amount).toFixed(0)}</td>
                            <td className="p-3">{r.status}</td>
                            <td className="p-3">
                              {r.status === "pending" && (
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => {
                                  const res = await markRentalPayoutPaid(r.id);
                                  if (res.ok) { toast.success("Credited to vendor Cash Wallet"); loadIncentives(); } else toast.error(res.error);
                                }}>
                                  Credit to wallet
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!loadingRentalPayouts && rentalPayouts.length === 0 && (
                  <p className="p-6 text-center text-muted-foreground">No rental payouts yet. Run monthly calc to create rows and credit vendors.</p>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="ads" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Ad placements</h3>
            <p className="text-xs text-muted-foreground mb-3">Enable or disable ads on specific pages.</p>
            {loadingPlacements ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {adPlacements.map((p) => (
                  <div key={p.page_slug} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                    <span className="text-sm">{p.label ?? p.page_slug}</span>
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={(checked) => handlePlacementToggle(p.page_slug, checked)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openAdForm(null)}>
              <Plus size={14} /> Add ad
            </Button>
            <Button variant="outline" size="sm" onClick={() => { loadAds(); loadAdPlacements(); }} disabled={loadingAds}>
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

        <TabsContent value="ondc" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Button variant="outline" size="sm" onClick={loadOndc} disabled={loadingOndc}>
              <RefreshCw size={14} className={loadingOndc ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          {loadingOndc ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">ID</th>
                      <th className="text-left p-3 font-semibold">Vendor</th>
                      <th className="text-left p-3 font-semibold">Buyer App</th>
                      <th className="text-right p-3 font-semibold">Total</th>
                      <th className="text-right p-3 font-semibold">Vendor Amount</th>
                      <th className="text-left p-3 font-semibold">Payment</th>
                      <th className="text-left p-3 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ondcOrders.map((o) => (
                      <tr key={o.id} className="border-t border-border">
                        <td className="p-3 font-mono text-xs truncate max-w-[120px]">{o.ondc_transaction_id || o.id.slice(0, 8)}</td>
                        <td className="p-3 truncate max-w-[100px]">{o.vendor_id.slice(0, 8)}…</td>
                        <td className="p-3">{o.buyer_app ?? "—"}</td>
                        <td className="p-3 text-right">₹{Number(o.total).toFixed(0)}</td>
                        <td className="p-3 text-right font-medium">₹{Number(o.vendor_amount ?? 0).toFixed(0)}</td>
                        <td className="p-3">
                          <span className={o.payment_status === "paid" ? "text-green-600" : o.payment_status === "failed" ? "text-red-600" : "text-muted-foreground"}>
                            {o.payment_status}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ondcOrders.length === 0 && (
                <p className="p-6 text-center text-muted-foreground">No ONDC orders yet. Webhook: /functions/v1/ondc-webhook</p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Retry failed payouts: Invoke RazorpayX manually or contact support. (Auto-retry coming in future.)
          </p>
        </TabsContent>

        <TabsContent value="customerRedemptions" className="space-y-4">
          {(() => {
            const pendingRedemptions = customerRedemptions.filter((r) => r.status === "pending");
            const allPendingSelected = pendingRedemptions.length > 0 && selectedRedemptionIds.length === pendingRedemptions.length;
            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={loadCustomerRedemptions} disabled={loadingCustomerRedemptions}>
                    <RefreshCw size={14} className={loadingCustomerRedemptions ? "animate-spin" : ""} /> Refresh
                  </Button>
                  {selectedRedemptionIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span className="text-sm font-medium">{selectedRedemptionIds.length} selected</span>
                      <Button size="sm" onClick={() => handleBulkRedemptionAction("approve")} disabled={bulkActionRunning}>
                        {bulkActionRunning ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve selected
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleBulkRedemptionAction("reject")} disabled={bulkActionRunning}>
                        <X size={14} /> Reject selected
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedRedemptionIds([])}>Clear</Button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Customer wallet redemptions (cash, coupon, cashback). Approve to debit wallet.</p>
                {loadingCustomerRedemptions ? (
                  <Skeleton className="h-48 w-full rounded-xl" />
                ) : (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="overflow-x-auto max-h-[50vh]">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="w-10 p-3 text-left">
                              {pendingRedemptions.length > 0 && (
                                <Checkbox
                                  checked={allPendingSelected}
                                  onCheckedChange={(checked) => setSelectedRedemptionIds(checked ? pendingRedemptions.map((r) => r.id) : [])}
                                  aria-label="Select all pending"
                                />
                              )}
                            </th>
                            <th className="text-left p-3 font-semibold">Customer</th>
                            <th className="text-left p-3 font-semibold">Type</th>
                            <th className="text-right p-3 font-semibold">Amount</th>
                            <th className="text-left p-3 font-semibold">Status</th>
                            <th className="text-left p-3 font-semibold">Date</th>
                            <th className="w-32 p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerRedemptions.map((r) => (
                            <tr key={r.id} className="border-t border-border">
                              <td className="p-3">
                                {r.status === "pending" && (
                                  <Checkbox
                                    checked={selectedRedemptionIds.includes(r.id)}
                                    onCheckedChange={(checked) => setSelectedRedemptionIds((prev) => checked ? [...prev, r.id] : prev.filter((id) => id !== r.id))}
                                    aria-label={`Select redemption ${r.id.slice(0, 8)}`}
                                  />
                                )}
                              </td>
                              <td className="p-3">{r.customer_phone ?? r.customer_id}</td>
                              <td className="p-3">{r.type}</td>
                              <td className="p-3 text-right">₹{Number(r.amount).toFixed(0)}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  r.status === "approved" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                                  r.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                                  "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                }`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                              <td className="p-3 text-right">
                                {r.status === "pending" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="mr-1"
                                      disabled={approvingRedemptionId === r.id}
                                      onClick={async () => {
                                        setApprovingRedemptionId(r.id);
                                        const ok = await approveRedemption(r.id);
                                        setApprovingRedemptionId(null);
                                        if (ok.ok) {
                                          toast.success("Redemption approved");
                                          loadCustomerRedemptions();
                                        } else {
                                          toast.error(ok.error ?? "Failed");
                                        }
                                      }}
                                    >
                                      {approvingRedemptionId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive"
                                      onClick={async () => {
                                        const ok = await rejectRedemption(r.id);
                                        if (ok.ok) {
                                          toast.success("Redemption rejected");
                                          loadCustomerRedemptions();
                                        }
                                      }}
                                    >
                                      <X size={14} /> Reject
                                    </Button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {customerRedemptions.length === 0 && (
                      <p className="p-6 text-center text-muted-foreground">No customer redemptions yet.</p>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="customerBonuses" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadCustomerBonuses} disabled={loadingCustomerBonuses}>
              <RefreshCw size={14} className={loadingCustomerBonuses ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Customer signup bonus status (₹55 credit, ₹5 × 11 uses, valid 30 days).</p>
          {loadingCustomerBonuses ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[55vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Customer</th>
                      <th className="text-right p-3 font-semibold">Balance</th>
                      <th className="text-right p-3 font-semibold">Bonus left</th>
                      <th className="text-left p-3 font-semibold">Credited</th>
                      <th className="text-left p-3 font-semibold">Valid till</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerBonuses.map((r) => {
                      const creditedAt = r.signup_bonus_credited_at ? new Date(r.signup_bonus_credited_at) : null;
                      const expiresAt = creditedAt ? new Date(creditedAt.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
                      const active = !!expiresAt && expiresAt > new Date() && r.bonus_remaining > 0;
                      return (
                        <tr key={r.customer_id} className="border-t border-border">
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{r.customer_phone ?? r.customer_id}</span>
                              {r.customer_name ? <span className="text-xs text-muted-foreground">{r.customer_name}</span> : null}
                            </div>
                          </td>
                          <td className="p-3 text-right">₹{Number(r.balance).toFixed(0)}</td>
                          <td className="p-3 text-right">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-muted text-muted-foreground"}`}>
                              {Number(r.bonus_remaining)}
                            </span>
                          </td>
                          <td className="p-3">
                            {r.signup_bonus_credited ? (
                              <span className="text-green-700 dark:text-green-300 font-semibold">Yes</span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {expiresAt ? expiresAt.toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {customerBonuses.length === 0 && (
                <p className="p-6 text-center text-muted-foreground">No wallet rows found.</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="coinsConfig" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadCoinsConfig} disabled={loadingCoinsConfig}>
              <RefreshCw size={14} className={loadingCoinsConfig ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Coins ≠ cash. Set coins per payment and conversion (e.g. 10 coins = ₹1).</p>
          {loadingCoinsConfig ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              {coinsConfig.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium">{c.scenario}</p>
                    <p className="text-xs text-muted-foreground">{c.description ?? "—"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={c.coins_per_payment}
                        className="w-20"
                        onBlur={async (e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!Number.isNaN(v) && v >= 0 && v !== c.coins_per_payment) {
                            setSavingCoinsConfig(true);
                            const ok = await updateCoinsConfig(c.scenario, { coins_per_payment: v });
                            setSavingCoinsConfig(false);
                            if (ok.ok) {
                              toast.success("Coins config updated");
                              loadCoinsConfig();
                            }
                          }
                        }}
                      />
                      <span className="text-sm text-muted-foreground">coins/payment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        defaultValue={(c as { coins_to_rupees?: number }).coins_to_rupees ?? 10}
                        className="w-20"
                        onBlur={async (e) => {
                          const v = parseInt(e.target.value, 10);
                          const curr = (c as { coins_to_rupees?: number }).coins_to_rupees ?? 10;
                          if (!Number.isNaN(v) && v >= 1 && v !== curr) {
                            setSavingCoinsConfig(true);
                            const ok = await updateCoinsConfig(c.scenario, { coins_to_rupees: v });
                            setSavingCoinsConfig(false);
                            if (ok.ok) {
                              toast.success("Coins config updated");
                              loadCoinsConfig();
                            }
                          }
                        }}
                      />
                      <span className="text-sm text-muted-foreground">coins = ₹1</span>
                    </div>
                  </div>
                </div>
              ))}
              {coinsConfig.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No coins config. Run migration part22.</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="vendorWallet" className="space-y-4 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {loadingVendorWalletSettings ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : vendorWalletSettings ? (
              <Card className="shadow-md rounded-lg border-gray-200 overflow-hidden transition-transform hover:shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wallet size={20} className="text-[#F97316]" /> Vendor Cash Wallet Settings
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={loadVendorWalletSettings} disabled={loadingVendorWalletSettings} className="min-h-[44px]">
                      <RefreshCw size={14} className={loadingVendorWalletSettings ? "animate-spin" : ""} /> Refresh
                    </Button>
                  </div>
                  <CardDescription>
                    Signup bonus is credited when a vendor first activates their profile. Min withdrawal is the threshold for total balance; min instant applies to eligible receipt balance only.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2 p-4 rounded-lg bg-gray-50/80 border border-gray-100">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="text-base font-medium cursor-help">Signup Bonus (₹)</Label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        Amount credited to new vendors on first profile activation
                      </TooltipContent>
                    </Tooltip>
                    <Select
                      value={String(vendorWalletSettings.signup_bonus_amount)}
                      onValueChange={async (v) => {
                        const n = Number(v);
                        if (Number.isNaN(n) || n < 0) return;
                        setSavingVendorWalletSettings(true);
                        const ok = await updateVendorSettings({ signup_bonus_amount: n });
                        setSavingVendorWalletSettings(false);
                        if (ok.ok) {
                          setVendorWalletSettings((s) => (s ? { ...s, signup_bonus_amount: n } : null));
                          toast.success("Signup bonus updated", { style: { background: "#10B981", color: "white" } });
                        } else {
                          toast.error(ok.error ?? "Failed");
                        }
                      }}
                    >
                      <SelectTrigger className="w-full min-h-[44px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="99">₹99</SelectItem>
                        <SelectItem value="149">₹149</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 p-4 rounded-lg bg-gray-50/80 border border-gray-100">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="text-base font-medium cursor-help">Min Instant Transfer (₹)</Label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        Min eligible receipt balance for instant transfer (customer payments only)
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex gap-2 flex-wrap">
                      <Input
                        type="number"
                        min={1}
                        max={5000}
                        step={1}
                        value={vendorWalletSettings.min_instant_transfer_amount ?? 100}
                        className="w-full min-h-[44px] flex-1 min-w-[80px]"
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!Number.isNaN(v) && v >= 0) {
                            setVendorWalletSettings((s) => (s ? { ...s, min_instant_transfer_amount: v } : null));
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={savingVendorWalletSettings}
                        className="min-h-[44px] bg-[#F97316] hover:bg-[#EA580C] text-white"
                        onClick={async () => {
                          const n = vendorWalletSettings.min_instant_transfer_amount ?? 100;
                          if (n < 1) {
                            toast.error("Min ₹1");
                            return;
                          }
                          setSavingVendorWalletSettings(true);
                          const ok = await updateVendorSettings({ min_instant_transfer_amount: n });
                          setSavingVendorWalletSettings(false);
                          if (ok.ok) {
                            toast.success("Min instant transfer updated", { style: { background: "#10B981", color: "white" } });
                          } else {
                            toast.error(ok.error ?? "Failed");
                          }
                        }}
                      >
                        {savingVendorWalletSettings ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 p-4 rounded-lg bg-gray-50/80 border border-gray-100">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="text-base font-medium cursor-help">Min Withdrawal (₹)</Label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        Vendors cannot withdraw total balance below this amount
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex gap-2 flex-wrap">
                      <Input
                        type="number"
                        min={100}
                        max={10000}
                        step={1}
                        value={vendorWalletSettings.min_withdrawal_amount}
                        className="w-full min-h-[44px] flex-1 min-w-[80px]"
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!Number.isNaN(v) && v >= 0) {
                            setVendorWalletSettings((s) => (s ? { ...s, min_withdrawal_amount: v } : null));
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={savingVendorWalletSettings}
                        className="min-h-[44px] bg-[#F97316] hover:bg-[#EA580C] text-white"
                        onClick={async () => {
                          const n = vendorWalletSettings.min_withdrawal_amount;
                          if (n < 100) {
                            toast.error("Min ₹100");
                            return;
                          }
                          setSavingVendorWalletSettings(true);
                          const ok = await updateVendorSettings({ min_withdrawal_amount: n });
                          setSavingVendorWalletSettings(false);
                          if (ok.ok) {
                            toast.success("Min withdrawal updated", { style: { background: "#10B981", color: "white" } });
                          } else {
                            toast.error(ok.error ?? "Failed");
                          }
                        }}
                      >
                        {savingVendorWalletSettings ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-md rounded-lg border-destructive/30 bg-destructive/5">
                <CardContent className="p-6 text-destructive">
                  Run migration 20260220800000_vendor_cash_wallet.sql first to create vendor_settings table.
                </CardContent>
              </Card>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="instantPayouts" className="space-y-4">
          {(() => {
            const pendingInstantPayouts = instantPayouts.filter((r) => r.status === "pending");
            const allPendingInstantSelected = pendingInstantPayouts.length > 0 && selectedInstantPayoutIds.length === pendingInstantPayouts.length;
            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={() => { loadInstantPayouts(); loadWalletBreakdown(); }} disabled={loadingInstantPayouts}>
                    <RefreshCw size={14} className={loadingInstantPayouts ? "animate-spin" : ""} /> Refresh
                  </Button>
                  {selectedInstantPayoutIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span className="text-sm font-medium">{selectedInstantPayoutIds.length} selected</span>
                      <Button size="sm" onClick={() => handleBulkInstantPayoutAction("approve")} disabled={bulkActionRunning}>
                        {bulkActionRunning ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve selected
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleBulkInstantPayoutAction("reject")} disabled={bulkActionRunning}>
                        <X size={14} /> Reject selected
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedInstantPayoutIds([])}>Clear</Button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Vendor instant payout requests. Only eligible receipt balance (customer payments after platform fee) can be requested for instant transfer. Approve debits both balance and eligible_receipt_balance.
                </p>
                {walletBreakdown.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <h3 className="p-3 font-semibold text-sm border-b border-border">Vendor wallet breakdown (eligible vs total)</h3>
              <div className="overflow-x-auto max-h-[30vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Vendor ID</th>
                      <th className="text-right p-3 font-semibold">Total balance</th>
                      <th className="text-right p-3 font-semibold">Eligible (instant)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletBreakdown.map((w) => (
                      <tr key={w.vendor_id} className="border-t border-border">
                        <td className="p-3 font-mono text-xs">{w.vendor_id}</td>
                        <td className="p-3 text-right">₹{w.balance.toFixed(2)}</td>
                        <td className="p-3 text-right font-medium">₹{w.eligible_receipt_balance.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {loadingInstantPayouts ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[55vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="w-10 p-3 text-left">
                        {pendingInstantPayouts.length > 0 && (
                          <Checkbox
                            checked={allPendingInstantSelected}
                            onCheckedChange={(checked) => setSelectedInstantPayoutIds(checked ? pendingInstantPayouts.map((r) => r.id) : [])}
                            aria-label="Select all pending"
                          />
                        )}
                      </th>
                      <th className="text-left p-3 font-semibold">Vendor</th>
                      <th className="text-right p-3 font-semibold">Amount</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                      <th className="text-left p-3 font-semibold">Requested</th>
                      <th className="text-left p-3 font-semibold">Processed</th>
                      <th className="w-48 p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instantPayouts.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-3">
                          {r.status === "pending" && (
                            <Checkbox
                              checked={selectedInstantPayoutIds.includes(r.id)}
                              onCheckedChange={(checked) => setSelectedInstantPayoutIds((prev) => checked ? [...prev, r.id] : prev.filter((id) => id !== r.id))}
                              aria-label={`Select request ${r.id.slice(0, 8)}`}
                            />
                          )}
                        </td>
                        <td className="p-3 font-mono text-xs">{r.vendor_id}</td>
                        <td className="p-3 text-right font-semibold">₹{Number(r.amount).toFixed(2)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            r.status === "processed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                            r.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                            "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{new Date(r.requested_at).toLocaleString()}</td>
                        <td className="p-3 text-muted-foreground">{r.processed_at ? new Date(r.processed_at).toLocaleString() : "—"}</td>
                        <td className="p-3 text-right">
                          {r.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="mr-1"
                                disabled={processingInstantPayoutId === r.id}
                                onClick={async () => {
                                  setProcessingInstantPayoutId(r.id);
                                  const res = await adminDecideInstantPayoutRequest(r.id, "approve");
                                  setProcessingInstantPayoutId(null);
                                  if (res.ok) {
                                    toast.success("Approved");
                                    loadInstantPayouts();
                                  } else {
                                    toast.error(res.error ?? "Failed");
                                  }
                                }}
                              >
                                {processingInstantPayoutId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                disabled={processingInstantPayoutId === r.id}
                                onClick={async () => {
                                  setProcessingInstantPayoutId(r.id);
                                  const res = await adminDecideInstantPayoutRequest(r.id, "reject");
                                  setProcessingInstantPayoutId(null);
                                  if (res.ok) {
                                    toast.success("Rejected");
                                    loadInstantPayouts();
                                  } else {
                                    toast.error(res.error ?? "Failed");
                                  }
                                }}
                              >
                                <X size={14} /> Reject
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {instantPayouts.length === 0 && (
                <p className="p-6 text-center text-muted-foreground">No instant payout requests yet.</p>
              )}
            </div>
          )}
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="riders" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bike size={20} /> Riders (2/3/4-wheelers)
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { loadRiders(); loadRiderSettings(); }}
                disabled={loadingRiders || loadingRiderSettings}
              >
                <RefreshCw size={14} className={loadingRiders || loadingRiderSettings ? "animate-spin" : ""} /> Refresh
              </Button>
              <Button
                size="sm"
                disabled={riderPayoutRunning || loadingRiders}
                onClick={async () => {
                  setRiderPayoutRunning(true);
                  try {
                    const res = await adminRunRiderMonthlyPayout(null);
                    if (res.ok) {
                      toast.success(`Monthly payout: ${res.riders_credited ?? 0} riders credited for ${res.month ?? ""}`);
                      loadRiders();
                    } else {
                      toast.error(res.error ?? "Payout failed");
                    }
                  } finally {
                    setRiderPayoutRunning(false);
                  }
                }}
              >
                {riderPayoutRunning ? <Loader2 size={14} className="animate-spin" /> : null}
                {riderPayoutRunning ? " Running…" : " Run monthly payout"}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Base rental ₹75 (2W) / ₹99 (3/4W). +20% bonus for 50+ scans. Cap ₹150. Min withdrawal ₹499.
          </p>
          {loadingRiders ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left p-3">Phone</th>
                    <th className="text-left p-3">Vehicle</th>
                    <th className="text-left p-3">Balance</th>
                    <th className="text-left p-3">Verified</th>
                    <th className="text-left p-3">Created</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ridersList.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No riders yet.</td></tr>
                  ) : (
                    ridersList.map((r) => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="p-3">{r.phone ?? "—"}</td>
                        <td className="p-3">{r.vehicle_type ?? "—"}</td>
                        <td className="p-3">₹{Number(r.balance ?? 0).toFixed(0)}</td>
                        <td className="p-3">{r.verified ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}</td>
                        <td className="p-3 text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                        <td className="p-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const ok = await adminSetRiderVerified(r.id!, !r.verified);
                              if (ok.ok) {
                                toast.success(r.verified ? "Unverified" : "Verified");
                                loadRiders();
                              } else {
                                toast.error(ok.error);
                              }
                            }}
                          >
                            {r.verified ? "Unverify" : "Approve"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-6">
            <h3 className="text-base font-medium mb-2">Rider settings (slabs)</h3>
            {loadingRiderSettings ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : (
              <div className="space-y-3">
                {riderSettings.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
                    <span className="font-medium">{s.vehicle_type}</span>
                    <span className="text-muted-foreground">Base: ₹{Number(s.base_rental).toFixed(0)}</span>
                    <span className="text-muted-foreground">Bonus: {Number(s.bonus_percent)}%</span>
                    <span className="text-muted-foreground">Min withdrawal: ₹{Number(s.min_withdrawal).toFixed(0)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const base = prompt("Base rental (₹)", String(s.base_rental));
                        if (base == null) return;
                        const n = parseInt(base, 10);
                        if (!Number.isNaN(n) && n >= 0) {
                          const ok = await adminUpdateRiderSettings(s.vehicle_type, { base_rental: n });
                          if (ok.ok) { toast.success("Updated"); loadRiderSettings(); } else toast.error(ok.error);
                        }
                      }}
                    >
                      Edit base
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const v = prompt("Min withdrawal (₹)", String(s.min_withdrawal));
                        if (v == null) return;
                        const n = parseInt(v, 10);
                        if (!Number.isNaN(n) && n >= 0) {
                          const ok = await adminUpdateRiderSettings(s.vehicle_type, { min_withdrawal: n });
                          if (ok.ok) { toast.success("Updated"); loadRiderSettings(); } else toast.error(ok.error);
                        }
                      }}
                    >
                      Edit min withdrawal
                    </Button>
                  </div>
                ))}
                {riderSettings.length === 0 && <p className="text-sm text-muted-foreground">No rider_settings. Run migration 20260222000000_riders.sql</p>}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sectors" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openSectorForm(null)}>
              <Plus size={14} /> Add sector
            </Button>
            <Button variant="outline" size="sm" onClick={loadSectors} disabled={loadingSectors}>
              <RefreshCw size={14} className={loadingSectors ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Sectors are top-level groups (e.g. Food, Grocery). Used for catalog and default menu.</p>
          {loadingSectors ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Name</th>
                      <th className="text-left p-3 font-semibold">Icon</th>
                      <th className="w-28 p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectors.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="p-3 font-medium">{s.name}</td>
                        <td className="p-3 text-muted-foreground">{s.icon ?? "—"}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSectorForm(s)} title="Edit">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm({ type: "sector", id: s.id, label: s.name })} title="Delete">
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sectors.length === 0 && <p className="p-6 text-center text-muted-foreground">No sectors. Add one to get started.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openCategoryForm(null)} disabled={sectors.length === 0}>
              <Plus size={14} /> Add category
            </Button>
            <Button variant="outline" size="sm" onClick={loadCategories} disabled={loadingCategories}>
              <RefreshCw size={14} className={loadingCategories ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Categories belong to a sector. Add sectors first if none exist.</p>
          {loadingCategories ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Name</th>
                      <th className="text-left p-3 font-semibold">Sector</th>
                      <th className="text-right p-3 font-semibold">GST %</th>
                      <th className="w-28 p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="p-3 font-medium">{c.name}</td>
                        <td className="p-3 text-muted-foreground">{sectors.find((s) => s.id === c.sector_id)?.name ?? c.sector_id.slice(0, 8)}</td>
                        <td className="p-3 text-right">{c.gst_rate}%</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCategoryForm(c)} title="Edit">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm({ type: "category", id: c.id, label: c.name })} title="Delete">
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {categories.length === 0 && <p className="p-6 text-center text-muted-foreground">No categories. Add sectors first.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="defaultMenu" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openDefaultMenuForm(null)} disabled={sectors.length === 0}>
              <Plus size={14} /> Add menu item
            </Button>
            <Button variant="outline" size="sm" onClick={loadDefaultMenu} disabled={loadingDefaultMenu}>
              <RefreshCw size={14} className={loadingDefaultMenu ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Default menu items appear when vendors choose a sector. Shown as templates.</p>
          {loadingDefaultMenu ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Item</th>
                      <th className="text-left p-3 font-semibold">Sector</th>
                      <th className="text-left p-3 font-semibold">Price range</th>
                      <th className="text-right p-3 font-semibold">GST %</th>
                      <th className="w-28 p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defaultMenuItems.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="p-3 font-medium">{m.item_name}</td>
                        <td className="p-3 text-muted-foreground">{sectors.find((s) => s.id === m.sector_id)?.name ?? m.sector_id.slice(0, 8)}</td>
                        <td className="p-3 text-muted-foreground">{m.default_selling_price_range}</td>
                        <td className="p-3 text-right">{m.gst_rate}%</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDefaultMenuForm(m)} title="Edit">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm({ type: "defaultMenuItem", id: m.id, label: m.item_name })} title="Delete">
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {defaultMenuItems.length === 0 && <p className="p-6 text-center text-muted-foreground">No default menu items. Add sectors first.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openProductForm(null)} disabled={categories.length === 0}>
              <Plus size={14} /> Add product
            </Button>
            <Button variant="outline" size="sm" onClick={loadCatalogProducts} disabled={loadingCatalogProducts}>
              <RefreshCw size={14} className={loadingCatalogProducts ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Catalog products appear on the Catalog page. Add categories first.</p>
          {loadingCatalogProducts ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Name</th>
                      <th className="text-left p-3 font-semibold">Category</th>
                      <th className="text-right p-3 font-semibold">MRP</th>
                      <th className="text-right p-3 font-semibold">Selling</th>
                      <th className="text-right p-3 font-semibold">Stock</th>
                      <th className="w-28 p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogProducts.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3 text-muted-foreground">{categories.find((c) => c.id === p.category_id)?.name ?? p.category_id.slice(0, 8)}</td>
                        <td className="p-3 text-right">₹{(p.mrp / 100).toFixed(0)}</td>
                        <td className="p-3 text-right">₹{(p.selling_price / 100).toFixed(0)}</td>
                        <td className="p-3 text-right">{p.stock_quantity}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openProductForm(p)} title="Edit">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm({ type: "catalogProduct", id: p.id, label: p.name })} title="Delete">
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {catalogProducts.length === 0 && <p className="p-6 text-center text-muted-foreground">No catalog products. Add categories first.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="space-y-6">
          <h2 className="text-lg font-semibold">Admin Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-4 flex flex-col"
          >
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <Banknote size={18} className="text-primary" />
              Daily Incentive Calc
            </h3>
            <p className="mb-4 text-sm text-muted-foreground flex-1">
              Count yesterday&apos;s orders per vendor, match slabs, insert vendor_incentives. Rewards also credit cash wallet.
            </p>
            <Button onClick={handleRunDailyCalc} disabled={dailyCalcRunning} className="w-fit">
              {dailyCalcRunning ? <Loader2 size={16} className="animate-spin mr-1" /> : <Banknote size={16} className="mr-1" />}
              {dailyCalcRunning ? " Running…" : " Run Daily Calc"}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            className="rounded-xl border border-border bg-card p-4 flex flex-col"
          >
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <UserPlus size={18} className="text-primary" />
              Referral Bonus Calc
            </h3>
            <p className="mb-4 text-sm text-muted-foreground flex-1">
              Pay referrers ₹100 for each referred vendor who hit 100+ entries yesterday. Run after Daily Calc.
            </p>
            <Button onClick={handleRunReferralCalc} disabled={referralCalcRunning} className="w-fit">
              {referralCalcRunning ? <Loader2 size={16} className="animate-spin mr-1" /> : <UserPlus size={16} className="mr-1" />}
              {referralCalcRunning ? " Running…" : " Run Referral Calc"}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-border bg-card p-4 flex flex-col"
          >
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <Trophy size={18} className="text-accent" />
              Monthly Draw
            </h3>
            <p className="mb-4 text-sm text-muted-foreground flex-1">
              Pick RNG winner from vendors with 10000+ entries last month (₹5000 lucky draw).
            </p>
            <Button onClick={handleRunMonthlyDraw} disabled={monthlyDrawRunning} className="w-fit">
              {monthlyDrawRunning ? <Loader2 size={16} className="animate-spin mr-1" /> : <Trophy size={16} className="mr-1" />}
              {monthlyDrawRunning ? " Running…" : " Run Monthly Draw"}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-4 flex flex-col"
          >
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <Trophy size={18} className="text-accent" />
              Daily Draw
            </h3>
            <p className="mb-4 text-sm text-muted-foreground flex-1">
              Pick a random winner from today&apos;s eligible entries and send a notification.
            </p>
            <Button onClick={handleRunDraw} disabled={drawRunning} className="w-fit">
              {drawRunning ? <Loader2 size={16} className="animate-spin mr-1" /> : <Trophy size={16} className="mr-1" />}
              {drawRunning ? " Running…" : " Run Daily Draw"}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-border bg-card p-4 sm:col-span-2 lg:col-span-3"
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
          </div>
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

      {/* Sector form sheet */}
      <Sheet open={sectorFormOpen} onOpenChange={(open) => !open && (setSectorFormOpen(false), setEditingSector(null))}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingSector ? "Edit sector" : "Add sector"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={sectorForm.name} onChange={(e) => setSectorForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Food, Grocery" className="mt-1.5" />
            </div>
            <div>
              <Label>Icon (optional, emoji or class)</Label>
              <Input value={sectorForm.icon} onChange={(e) => setSectorForm((f) => ({ ...f, icon: e.target.value }))} placeholder="🍜 or lucide icon name" className="mt-1.5" />
            </div>
            <Button className="w-full" onClick={handleSaveSector}>Save</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Category form sheet */}
      <Sheet open={categoryFormOpen} onOpenChange={(open) => !open && (setCategoryFormOpen(false), setEditingCategory(null))}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingCategory ? "Edit category" : "Add category"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Snacks, Beverages" className="mt-1.5" />
            </div>
            <div>
              <Label>Sector</Label>
              <Select value={categoryForm.sector_id} onValueChange={(v) => setCategoryForm((f) => ({ ...f, sector_id: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select sector" /></SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>GST rate (%)</Label>
              <Input type="number" min={0} max={28} value={categoryForm.gst_rate} onChange={(e) => setCategoryForm((f) => ({ ...f, gst_rate: parseInt(e.target.value, 10) || 0 }))} className="mt-1.5" />
            </div>
            <Button className="w-full" onClick={handleSaveCategory}>Save</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Default menu item form sheet */}
      <Sheet open={defaultMenuFormOpen} onOpenChange={(open) => !open && (setDefaultMenuFormOpen(false), setEditingDefaultMenu(null))}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingDefaultMenu ? "Edit menu item" : "Add menu item"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Item name</Label>
              <Input value={defaultMenuForm.item_name} onChange={(e) => setDefaultMenuForm((f) => ({ ...f, item_name: e.target.value }))} placeholder="e.g. Chai, Samosa" className="mt-1.5" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={defaultMenuForm.description} onChange={(e) => setDefaultMenuForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description" className="mt-1.5" />
            </div>
            <div>
              <Label>Sector</Label>
              <Select value={defaultMenuForm.sector_id} onValueChange={(v) => setDefaultMenuForm((f) => ({ ...f, sector_id: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select sector" /></SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default price range</Label>
              <Input value={defaultMenuForm.default_selling_price_range} onChange={(e) => setDefaultMenuForm((f) => ({ ...f, default_selling_price_range: e.target.value }))} placeholder="e.g. 10-50" className="mt-1.5" />
            </div>
            <div>
              <Label>GST rate (%)</Label>
              <Input type="number" min={0} max={28} value={defaultMenuForm.gst_rate} onChange={(e) => setDefaultMenuForm((f) => ({ ...f, gst_rate: parseInt(e.target.value, 10) || 0 }))} className="mt-1.5" />
            </div>
            <div>
              <Label>Sort order (lower first)</Label>
              <Input type="number" min={0} value={defaultMenuForm.sort_order} onChange={(e) => setDefaultMenuForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))} className="mt-1.5" />
            </div>
            <Button className="w-full" onClick={handleSaveDefaultMenu}>Save</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Catalog product form sheet */}
      <Sheet open={productFormOpen} onOpenChange={(open) => !open && (setProductFormOpen(false), setEditingProduct(null))}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingProduct ? "Edit product" : "Add product"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={productForm.name} onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Basmati Rice" className="mt-1.5" />
            </div>
            <div>
              <Label>Name (Hindi)</Label>
              <Input value={productForm.name_hi} onChange={(e) => setProductForm((f) => ({ ...f, name_hi: e.target.value }))} placeholder="Optional" className="mt-1.5" />
            </div>
            <div>
              <Label>Name (Telugu)</Label>
              <Input value={productForm.name_te} onChange={(e) => setProductForm((f) => ({ ...f, name_te: e.target.value }))} placeholder="Optional" className="mt-1.5" />
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={productForm.category_id} onValueChange={(v) => setProductForm((f) => ({ ...f, category_id: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({sectors.find((s) => s.id === c.sector_id)?.name ?? "—"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={productForm.description} onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" className="mt-1.5" />
            </div>
            <div>
              <Label>MRP (₹)</Label>
              <Input type="number" min={0} step={0.01} value={productForm.mrp} onChange={(e) => setProductForm((f) => ({ ...f, mrp: e.target.value }))} placeholder="e.g. 60" className="mt-1.5" />
            </div>
            <div>
              <Label>Selling price (₹)</Label>
              <Input type="number" min={0} step={0.01} value={productForm.selling_price} onChange={(e) => setProductForm((f) => ({ ...f, selling_price: e.target.value }))} placeholder="e.g. 55" className="mt-1.5" />
            </div>
            <div>
              <Label>Discount %</Label>
              <Input type="number" min={0} max={100} value={productForm.discount_percent} onChange={(e) => setProductForm((f) => ({ ...f, discount_percent: parseInt(e.target.value, 10) || 0 }))} className="mt-1.5" />
            </div>
            <div>
              <Label>GST %</Label>
              <Input type="number" min={0} max={28} value={productForm.gst_rate} onChange={(e) => setProductForm((f) => ({ ...f, gst_rate: parseInt(e.target.value, 10) || 0 }))} className="mt-1.5" />
            </div>
            <div>
              <Label>Stock quantity</Label>
              <Input type="number" min={0} value={productForm.stock_quantity} onChange={(e) => setProductForm((f) => ({ ...f, stock_quantity: parseInt(e.target.value, 10) || 0 }))} className="mt-1.5" />
            </div>
            <div>
              <Label>Image URL (emoji or https://)</Label>
              <Input value={productForm.image_url} onChange={(e) => setProductForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="🍚 or https://…" className="mt-1.5" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_eco" checked={productForm.is_eco} onChange={(e) => setProductForm((f) => ({ ...f, is_eco: e.target.checked }))} />
              <Label htmlFor="is_eco">Eco-friendly</Label>
            </div>
            <Button className="w-full" onClick={handleSaveProduct}>Save</Button>
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
                <Label>Dukaan type</Label>
                <Input
                  value={editVendor.stall_type ?? ""}
                  onChange={(e) => setEditVendor({ ...editVendor, stall_type: e.target.value })}
                  placeholder="e.g. Kirana Store, Tea Stall, Hardware"
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

      {/* Edit swap sheet */}
      <Sheet open={swapEditOpen} onOpenChange={(open) => !open && (setSwapEditOpen(false), setEditingSwap(null))}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit swap listing</SheetTitle>
          </SheetHeader>
          {editingSwap && (
            <div className="mt-6 space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={swapEditForm.title} onChange={(e) => setSwapEditForm((f) => ({ ...f, title: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={swapEditForm.description} onChange={(e) => setSwapEditForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" className="mt-1.5" />
              </div>
              <div>
                <Label>Price notes</Label>
                <Input value={swapEditForm.price_notes} onChange={(e) => setSwapEditForm((f) => ({ ...f, price_notes: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={swapEditForm.location} onChange={(e) => setSwapEditForm((f) => ({ ...f, location: e.target.value }))} placeholder="Optional" className="mt-1.5" />
              </div>
              <Button className="w-full" onClick={handleUpdateSwap} disabled={moderatingId === editingSwap.id}>
                {moderatingId === editingSwap.id ? <Loader2 size={16} className="animate-spin" /> : null}
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
            <AlertDialogTitle>
              Delete {deleteConfirm?.type === "vendor" ? "vendor" : deleteConfirm?.type === "order" ? "order" : deleteConfirm?.type === "swap" ? "swap" : deleteConfirm?.type === "sector" ? "sector" : deleteConfirm?.type === "category" ? "category" : deleteConfirm?.type === "defaultMenuItem" ? "menu item" : "product"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === "vendor" && "This will remove the vendor profile. Dependent data (orders, etc.) may be affected."}
              {deleteConfirm?.type === "order" && "This will permanently delete the order and its items."}
              {deleteConfirm?.type === "swap" && "This will permanently delete the swap listing."}
              {deleteConfirm?.type === "sector" && "This will remove the sector. Categories under it may be affected."}
              {deleteConfirm?.type === "category" && "This will remove the category."}
              {deleteConfirm?.type === "defaultMenuItem" && "This will remove the default menu item."}
              {deleteConfirm?.type === "catalogProduct" && "This will remove the catalog product. It will no longer appear on the Catalog page."}
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
                else if (type === "sector") void handleDeleteSector(id);
                else if (type === "category") void handleDeleteCategory(id);
                else if (type === "defaultMenuItem") void handleDeleteDefaultMenuItem(id);
                else if (type === "catalogProduct") void handleDeleteCatalogProduct(id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </div>
      </div>
    </TooltipProvider>
  );
}
