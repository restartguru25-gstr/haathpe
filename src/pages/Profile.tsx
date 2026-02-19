import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Edit,
  CreditCard,
  Shield,
  Bell,
  LogOut,
  Users,
  BookOpen,
  Globe,
  MapPin,
  Mail,
  Phone,
  Star,
  Flame,
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  FileCheck,
  FileDown,
  Share2,
  ImagePlus,
  X,
  Package,
  UserPlus,
  Clock,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/contexts/AppContext";
import { useProfile } from "@/hooks/useProfile";
import { useSession } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { Language } from "@/lib/data";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import {
  getNotificationSettings,
  setNotificationSettings,
  type NotificationSettings,
} from "@/lib/notificationSettings";
import {
  isPushSupported,
  getPushPermission,
  subscribePush,
  savePushSubscription,
  getPushSubscriptions,
} from "@/lib/pushNotifications";
import { getSvanidhiBoostUrl } from "@/lib/svanidhi";
import {
  fetchTransactionHistory,
  downloadTransactionHistoryPdf,
  downloadTransactionHistoryCsv,
  shareOrDownloadTransactionHistory,
} from "@/lib/transactionHistory";
import { requestPayout } from "@/lib/incentives";
import {
  isShopOpen,
  buildOpeningHours,
  getOpenCloseFromHours,
  TIME_OPTIONS,
  WEEKLY_OFF_OPTIONS,
  type ShopDetails,
} from "@/lib/shopDetails";

const fadeUp = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.06, duration: 0.35 },
});

const LANG_OPTIONS: { value: Language; label: string; full: string }[] = [
  { value: "en", label: "EN", full: "English" },
  { value: "hi", label: "हि", full: "Hindi" },
  { value: "te", label: "తె", full: "Telugu" },
];

const STALL_TYPES = [
  "Kirana Store",
  "General Store",
  "Kirana/General Store",
  "Tea Stall",
  "Beverage Stalls",
  "Food Stall",
  "Snacks Stall",
  "Panipuri Stall",
  "Tiffin Centre",
  "Pan Shop",
  "Fast Food",
  "Hardware Shop",
  "Hardware",
  "Saloon/Spa",
  "Salon/Spa",
];

export default function Profile() {
  const { t, lang, setLang } = useApp();
  const { profile, isLoading } = useProfile();
  const { signOut, user, refreshProfile, profile: rawProfile } = useSession();
  const { isAdmin } = useAdmin();
  const [editOpen, setEditOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => getNotificationSettings());
  const [editForm, setEditForm] = useState({
    name: "",
    stallType: "",
    stallAddress: "",
    phone: "",
    businessAddress: "",
    shopPhotoUrls: [] as string[],
    gstNumber: "",
    panNumber: "",
    udyamNumber: "",
    fssaiLicense: "",
    otherBusinessDetails: "",
    upiId: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [svanidhiSupportOpen, setSvanidhiSupportOpen] = useState(false);
  const [txHistoryLoading, setTxHistoryLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [shopTimingsOpen, setShopTimingsOpen] = useState(false);
  const [shopForm, setShopForm] = useState({
    openTime: "08:00",
    closeTime: "22:00",
    weeklyOff: "",
    holidaysText: "",
    isOnline: true,
  });
  const [savingShop, setSavingShop] = useState(false);

  const {
    name,
    stallType,
    stallIcon,
    phone,
    address,
    creditLimit,
    creditUsed,
    points,
    tier,
    streak,
    photoUrl,
    availableBalance,
    businessAddress,
    shopPhotoUrls,
    gstNumber,
    panNumber,
    udyamNumber,
    fssaiLicense,
    otherBusinessDetails,
    upiId,
  } = profile;
  const creditPercent = creditLimit > 0 ? Math.round((creditUsed / creditLimit) * 100) : 0;

  useEffect(() => {
    setNotifSettings(getNotificationSettings());
  }, [notifOpen]);

  useEffect(() => {
    if (shopTimingsOpen && rawProfile) {
      const { open, close } = getOpenCloseFromHours(rawProfile.opening_hours);
      const holidays = Array.isArray(rawProfile.holidays) ? rawProfile.holidays : [];
      setShopForm({
        openTime: open,
        closeTime: close,
        weeklyOff: rawProfile.weekly_off ?? "",
        holidaysText: holidays.join("\n"),
        isOnline: rawProfile.is_online !== false,
      });
    }
  }, [shopTimingsOpen, rawProfile]);

  useEffect(() => {
    if (notifOpen && user?.id && isPushSupported()) {
      getPushSubscriptions(user.id).then((list) => setPushEnabled(list.length > 0));
    }
  }, [notifOpen, user?.id]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      toast.success("Logged out");
    } catch {
      toast.error("Logout failed");
    } finally {
      setLoggingOut(false);
      // Hard redirect so session is gone and we don't stay on protected route
      window.location.replace("/");
    }
  };

  const openEdit = () => {
    setEditForm({
      name: name || "",
      stallType: stallType || "",
      stallAddress: address || "",
      phone: phone || "",
      businessAddress: businessAddress || address || "",
      shopPhotoUrls: [...shopPhotoUrls],
      gstNumber: gstNumber || "",
      panNumber: panNumber || "",
      udyamNumber: udyamNumber || "",
      fssaiLicense: fssaiLicense || "",
      otherBusinessDetails: otherBusinessDetails || "",
      upiId: upiId || "",
    });
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!user?.id) {
      toast.error("Not signed in. Please log in again.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: (editForm.name || "").trim() || null,
        stall_type: (editForm.stallType || "").trim() || null,
        stall_address: (editForm.stallAddress || "").trim() || null,
        phone: (editForm.phone || "").trim() || null,
        business_address: (editForm.businessAddress || "").trim() || null,
        shop_photo_urls: editForm.shopPhotoUrls.length ? editForm.shopPhotoUrls : null,
        gst_number: (editForm.gstNumber || "").trim() || null,
        pan_number: (editForm.panNumber || "").trim() || null,
        udyam_number: (editForm.udyamNumber || "").trim() || null,
        fssai_license: (editForm.fssaiLicense || "").trim() || null,
        other_business_details: (editForm.otherBusinessDetails || "").trim() || null,
        upi_id: (editForm.upiId || "").trim() || null,
      };
      
      // Try Edge Function first, fallback to direct Supabase update
      let success = false;
      try {
        const { data, error } = await supabase.functions.invoke("update-profile", { body: payload });
        if (error) {
          console.warn("[Profile] Edge Function failed, using direct update:", error);
          throw error; // Will trigger fallback
        }
        success = true;
      } catch (edgeError: unknown) {
        // Fallback: Direct Supabase update (works if Edge Function not deployed or fails)
        console.log("[Profile] Using direct Supabase update as fallback");
        const { error: directError } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", user.id)
          .select("id")
          .single();
        if (directError) {
          throw directError;
        }
        success = true;
      }
      
      if (success) {
        await refreshProfile();
        setEditOpen(false);
        toast.success(t("profileUpdated"));
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      const err = e as { message?: string; code?: string; details?: string };
      const msg = err?.message ?? "Could not update profile. Try again.";
      if (typeof window !== "undefined") {
        console.error("[Profile] Save failed:", { message: err?.message, code: err?.code, details: err?.details });
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleShopPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image (JPEG, PNG or WebP).");
      return;
    }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}_${index}.${ext}`;
      const { error } = await supabase.storage.from("vendor-shop-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("vendor-shop-photos").getPublicUrl(path);
      const newUrls = [...editForm.shopPhotoUrls];
      while (newUrls.length <= index) newUrls.push("");
      newUrls[index] = urlData.publicUrl;
      setEditForm((f) => ({ ...f, shopPhotoUrls: newUrls }));
      toast.success("Photo added");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed. Create bucket 'vendor-shop-photos' in Supabase if needed.";
      toast.error(msg);
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const removeShopPhoto = (index: number) => {
    setEditForm((f) => ({
      ...f,
      shopPhotoUrls: f.shopPhotoUrls.filter((_, i) => i !== index),
    }));
  };

  const handleNotifToggle = (key: keyof NotificationSettings, value: boolean) => {
    const next = { ...notifSettings, [key]: value };
    setNotifSettings(next);
    setNotificationSettings(next);
    toast.success(t("saved"));
  };

  const handleEnablePush = async () => {
    if (!user?.id || !isPushSupported()) return;
    setPushLoading(true);
    try {
      const perm = await getPushPermission();
      if (perm !== "granted") {
        toast.error("Permission denied");
        setPushLoading(false);
        return;
      }
      const sub = await subscribePush();
      if (!sub) {
        toast.error("Push not available. Add VITE_VAPID_PUBLIC_KEY to enable.");
        setPushLoading(false);
        return;
      }
      const ok = await savePushSubscription(user.id, sub);
      if (ok) {
        setPushEnabled(true);
        toast.success("Browser push enabled");
      } else {
        toast.error("Could not save subscription");
      }
    } catch (e) {
      toast.error("Could not enable push");
    } finally {
      setPushLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <div className="container max-w-2xl px-4 py-6">
          <Skeleton className="mb-6 h-8 w-24" />
          <Skeleton className="mb-6 h-28 rounded-xl" />
          <Skeleton className="mb-6 h-36 rounded-xl" />
          <Skeleton className="mb-6 h-32 rounded-xl" />
          <Skeleton className="mb-6 h-24 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-6">
      <div className="container max-w-2xl px-4 py-6">
        {/* Header */}
        <motion.div {...fadeUp(0)} className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">{t("profile")}</h1>
          <p className="text-sm text-muted-foreground">{t("manageAccount")}</p>
        </motion.div>

        {/* Profile card */}
        <motion.div
          {...fadeUp(1)}
          className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-4xl">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                stallIcon
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">{name}</h2>
              <p className="text-sm text-muted-foreground">{stallType}</p>
              {stallType && stallType !== "Default" && (
                <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  <ShieldCheck size={12} /> {t("ondcEnabled")} · {t("ondcMenuLive")}
                </p>
              )}
              {user?.email && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail size={12} /> {user.email}
                </p>
              )}
              {phone && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone size={12} /> {phone}
                </p>
              )}
              {address && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin size={12} /> {address}
                </p>
              )}
            </div>
            <Button variant="outline" size="icon" className="shrink-0" onClick={openEdit}>
              <Edit size={16} />
            </Button>
          </div>
        </motion.div>

        {/* Quick stats */}
        <motion.div {...fadeUp(2)} className="mb-6 grid grid-cols-3 gap-3">
          <Link
            to="/loyalty"
            className="flex flex-col items-center rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
          >
            <Star size={20} className="mb-1 text-primary" />
            <span className="text-lg font-bold">{points}</span>
            <span className="text-[11px] font-medium text-muted-foreground">{t("points")}</span>
          </Link>
          <Link
            to="/loyalty"
            className="flex flex-col items-center rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
          >
            <span className="mb-1 text-lg font-bold text-primary">{tier}</span>
            <span className="text-[11px] font-medium text-muted-foreground">{t("tier")}</span>
          </Link>
          <Link
            to="/loyalty"
            className="flex flex-col items-center rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
          >
            <Flame size={20} className="mb-1 text-accent" />
            <span className="text-lg font-bold">{streak}</span>
            <span className="text-[11px] font-medium text-muted-foreground">{t("streak")}</span>
          </Link>
        </motion.div>

        {/* Incentive Earnings */}
        {user?.id && (
          <motion.div
            {...fadeUp(2.5)}
            className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Gift size={18} className="text-primary" />
              Withdraw Earnings
            </h3>
            <p className="mb-2 text-sm text-muted-foreground">
              Available balance: <strong className="text-primary">₹{availableBalance?.toFixed(0) ?? 0}</strong>
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[120px]">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Amount (₹)</label>
                <Input
                  type="number"
                  min={1}
                  max={availableBalance ?? 0}
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="bg-background"
                />
              </div>
              <Button
                disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || (availableBalance ?? 0) < parseFloat(withdrawAmount || "0")}
                onClick={async () => {
                  const amt = parseFloat(withdrawAmount);
                  if (amt <= 0 || amt > (availableBalance ?? 0)) return;
                  setWithdrawing(true);
                  try {
                    const result = await requestPayout(amt);
                    if (result.ok) {
                      toast.success(`Withdrawal of ₹${amt} requested.`);
                      setWithdrawAmount("");
                      refreshProfile();
                    } else {
                      toast.error(result.error ?? "Withdrawal failed");
                    }
                  } catch {
                    toast.error("Withdrawal failed");
                  } finally {
                    setWithdrawing(false);
                  }
                }}
              >
                {withdrawing ? "…" : "Withdraw"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Withdraw your incentive earnings to your bank. Payouts are processed by admin.</p>
          </motion.div>
        )}

        {/* Credit Wallet */}
        <motion.div
          {...fadeUp(3)}
          className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
            <CreditCard size={18} className="text-primary" />
            {t("creditWallet")}
          </h3>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">{t("used")}</span>
            <span className="font-semibold">
              ₹{creditUsed} <span className="text-muted-foreground">/ ₹{creditLimit}</span>
            </span>
          </div>
          <Progress value={creditPercent} className="mb-3 h-2.5" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield size={14} className="shrink-0 text-success" />
            <span>{t("insuranceOptIn")}</span>
          </div>
        </motion.div>

        {/* Dukaan Timings & Online Status */}
        {user?.id && (
          <motion.div
            {...fadeUp(3.2)}
            className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Clock size={18} className="text-primary" />
              {t("shopTimingsTitle")}
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">{t("shopTimingsDesc")}</p>
            {(() => {
              const details: ShopDetails = {
                opening_hours: rawProfile?.opening_hours ?? undefined,
                weekly_off: rawProfile?.weekly_off ?? undefined,
                holidays: rawProfile?.holidays ?? undefined,
                is_online: rawProfile?.is_online,
              };
              const status = isShopOpen(details);
              const statusKey = lang === "hi" ? "messageHi" : lang === "te" ? "messageTe" : "message";
              return (
                <>
                  <div className="mb-3 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className={`text-sm font-semibold ${status.open ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {status.open ? t("shopOpenNow") : t("shopClosedNow")}
                    </span>
                    <Switch
                      checked={rawProfile?.is_online !== false}
                      onCheckedChange={async (checked) => {
                        if (!user?.id) return;
                        try {
                          let success = false;
                          try {
                            const { error } = await supabase.functions.invoke("update-profile", {
                              body: { is_online: checked },
                            });
                            if (error) throw error;
                            success = true;
                          } catch {
                            // Fallback to direct update
                            const { error: directError } = await supabase
                              .from("profiles")
                              .update({ is_online: checked })
                              .eq("id", user.id);
                            if (directError) throw directError;
                            success = true;
                          }
                          if (success) {
                            await refreshProfile();
                            toast.success(checked ? "Online orders enabled" : "Online orders disabled");
                          }
                        } catch (e) {
                          if (e instanceof Error && e.name === "AbortError") return;
                          toast.error("Could not update");
                        }
                      }}
                    />
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">{status[statusKey]}</p>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setShopTimingsOpen(true)}>
                    Edit timings & holidays
                  </Button>
                </>
              );
            })()}
          </motion.div>
        )}

        {/* SVANidhi Boost – govt scheme link with transaction proof stub */}
        {user?.id && (
          <motion.div
            {...fadeUp(3.5)}
            className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 shadow-sm"
          >
            <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-amber-900 dark:text-amber-100">
              <CreditCard size={18} />
              SVANidhi Boost
            </h3>
            <p className="mb-3 text-sm text-amber-800 dark:text-amber-200">
              PM SVANidhi loans for chhoti dukaan & vendors. Your app data (purchases & sales) can be used as proof for instant credit.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full gap-2 border-amber-300 bg-white hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 text-amber-900 dark:text-amber-100"
                onClick={async () => {
                  if (!user?.id) return;
                  const { error } = await supabase
                    .from("svanidhi_support_requests")
                    .insert({ user_id: user.id });
                  if (error) {
                    const msg = error.message || "Could not submit request.";
                    toast.error(
                      msg.includes("does not exist")
                        ? "Support requests not set up yet. Ask admin to run part10 SQL in Supabase."
                        : msg
                    );
                    return;
                  }
                  toast.success("Your request has been received.");
                  setSvanidhiSupportOpen(true);
                }}
              >
                <HelpCircle size={18} />
                Support for application
              </Button>
              <a href={getSvanidhiBoostUrl(user.id)} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                  <FileCheck size={18} />
                  Apply for SVANidhi loan
                </Button>
              </a>
            </div>
            <p className="mt-3 text-xs font-medium text-amber-900 dark:text-amber-100">Transaction history (for SVANidhi upload)</p>
            <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
              Download or share your sales & purchases. Upload this when applying for the loan.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-amber-300 text-amber-900 dark:border-amber-700 dark:text-amber-100"
                disabled={txHistoryLoading}
                onClick={async () => {
                  if (!user?.id) return;
                  setTxHistoryLoading(true);
                  try {
                    const data = await fetchTransactionHistory(user.id, name || "Dukaanwaala");
                    downloadTransactionHistoryPdf(data);
                    toast.success("PDF downloaded. Use it for SVANidhi upload.");
                  } catch {
                    toast.error("Could not generate PDF.");
                  } finally {
                    setTxHistoryLoading(false);
                  }
                }}
              >
                {txHistoryLoading ? null : <FileDown size={16} />}
                {txHistoryLoading ? "…" : "Download PDF"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-amber-300 text-amber-900 dark:border-amber-700 dark:text-amber-100"
                disabled={txHistoryLoading}
                onClick={async () => {
                  if (!user?.id) return;
                  setTxHistoryLoading(true);
                  try {
                    const data = await fetchTransactionHistory(user.id, name || "Dukaanwaala");
                    downloadTransactionHistoryCsv(data);
                    toast.success("CSV downloaded. Use for SVANidhi or Excel.");
                  } catch {
                    toast.error("Could not generate CSV.");
                  } finally {
                    setTxHistoryLoading(false);
                  }
                }}
              >
                {txHistoryLoading ? null : <FileDown size={16} />}
                {txHistoryLoading ? "…" : "Download CSV"}
              </Button>
              {typeof navigator !== "undefined" && navigator.share && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-amber-300 text-amber-900 dark:border-amber-700 dark:text-amber-100"
                  disabled={txHistoryLoading}
                  onClick={async () => {
                    if (!user?.id) return;
                    setTxHistoryLoading(true);
                    try {
                      const data = await fetchTransactionHistory(user.id, name || "Dukaanwaala");
                      shareOrDownloadTransactionHistory(data, "pdf", () => {
                        toast.success("Shared or downloaded. Use for SVANidhi upload.");
                        setTxHistoryLoading(false);
                      });
                    } catch {
                      toast.error("Could not share.");
                      setTxHistoryLoading(false);
                    }
                  }}
                >
                  {txHistoryLoading ? null : <Share2 size={16} />}
                  {txHistoryLoading ? "…" : "Share"}
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Support: we help with documents & steps. Direct apply opens govt portal with transaction history as proof.
            </p>
          </motion.div>
        )}

        {/* Settings */}
        <motion.div
          {...fadeUp(4)}
          className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <h3 className="mb-4 text-base font-bold">{t("settings")}</h3>

          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Globe size={16} className="text-muted-foreground" />
              {t("language")}
            </div>
            <div className="flex flex-wrap gap-2">
              {LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLang(opt.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    lang === opt.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {opt.full}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">{t("notificationSettings")}</span>
              </div>
              <span className="text-xs font-medium text-success">
                {getNotificationSettings().orderUpdates ? "On" : "Off"}
              </span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
            <Link to="/notifications" className="block">
              <Button variant="outline" className="w-full justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Bell size={16} /> {t("viewNotifications")}
                </span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Community */}
        <motion.div
          {...fadeUp(5)}
          className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <h3 className="mb-3 text-base font-bold">{t("community")}</h3>
          <div className="space-y-2">
            <Link to="/forum">
              <Button variant="outline" className="w-full justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Users size={16} /> {t("vendorForum")}
                </span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </Button>
            </Link>
            <Link to="/swap">
              <Button variant="outline" className="w-full justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Package size={16} /> {t("vendorSwap")}
                </span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </Button>
            </Link>
            <Link to="/courses">
              <Button variant="outline" className="w-full justify-between text-sm">
                <span className="flex items-center gap-2">
                  <BookOpen size={16} /> {t("upskillCourses")}
                </span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </Button>
            </Link>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <UserPlus size={18} className="text-primary" />
                {t("referralBonus")}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("referralBonusDesc")}</p>
              {user?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={() => {
                    const link = `${window.location.origin}/auth?ref=${user.id}`;
                    navigator.clipboard.writeText(link);
                    toast.success("Link copied!");
                  }}
                >
                  {t("copyLink")}
                </Button>
              )}
            </div>
            {isAdmin && (
              <Link to="/admin">
                <Button variant="outline" className="w-full justify-between text-sm border-primary/30 text-primary">
                  <span className="flex items-center gap-2">
                    <ShieldCheck size={16} /> {t("adminDashboard")}
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </Button>
              </Link>
            )}
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div {...fadeUp(6)}>
          <Button
            variant="outline"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut size={16} className="mr-2" />
            {loggingOut ? "Logging out…" : t("logout")}
          </Button>
        </motion.div>
      </div>

      {/* Edit profile sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>{t("editProfile")}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="edit-stall-type">{t("dukaanType")}</Label>
              <select
                id="edit-stall-type"
                value={editForm.stallType}
                onChange={(e) => setEditForm((f) => ({ ...f, stallType: e.target.value }))}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Select type</option>
                {STALL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="edit-address">{t("dukaanAddress")}</Label>
              <Input
                id="edit-address"
                value={editForm.stallAddress}
                onChange={(e) => setEditForm((f) => ({ ...f, stallAddress: e.target.value }))}
                placeholder="e.g. Near Charminar, Hyderabad"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="edit-business-address">Complete business address</Label>
              <Input
                id="edit-business-address"
                value={editForm.businessAddress}
                onChange={(e) => setEditForm((f) => ({ ...f, businessAddress: e.target.value }))}
                placeholder="Full address for SVANidhi / compliance"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Shop photos (2–3)</Label>
              <p className="mt-1 text-xs text-muted-foreground">Upload images of your shop for SVANidhi / verification</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="relative">
                    {editForm.shopPhotoUrls[i] ? (
                      <div className="relative h-20 w-20 rounded-lg border border-border overflow-hidden bg-muted">
                        <img src={editForm.shopPhotoUrls[i]} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeShopPhoto(i)}
                          className="absolute right-1 top-1 rounded-full bg-destructive/90 p-1 text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 hover:bg-muted/50">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          disabled={uploadingPhoto}
                          onChange={(ev) => handleShopPhotoUpload(ev, i)}
                        />
                        {uploadingPhoto ? <span className="text-xs">…</span> : <ImagePlus size={24} className="text-muted-foreground" />}
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="edit-gst">GST number (optional)</Label>
              <Input
                id="edit-gst"
                value={editForm.gstNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, gstNumber: e.target.value }))}
                placeholder="e.g. 36AABCU9603R1ZM"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="edit-pan">PAN (optional)</Label>
              <Input
                id="edit-pan"
                value={editForm.panNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, panNumber: e.target.value }))}
                placeholder="e.g. ABCDE1234F"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="edit-udyam">UDYAM number (optional)</Label>
              <Input
                id="edit-udyam"
                value={editForm.udyamNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, udyamNumber: e.target.value }))}
                placeholder="e.g. UDYAM-XX-00-0000000"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="edit-fssai">FSSAI license (optional)</Label>
              <Input
                id="edit-fssai"
                value={editForm.fssaiLicense}
                onChange={(e) => setEditForm((f) => ({ ...f, fssaiLicense: e.target.value }))}
                placeholder="FSSAI registration number"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="edit-other">Other details (optional)</Label>
              <textarea
                id="edit-other"
                value={editForm.otherBusinessDetails}
                onChange={(e) => setEditForm((f) => ({ ...f, otherBusinessDetails: e.target.value }))}
                placeholder="Any other business details for SVANidhi or compliance"
                className="mt-1.5 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-upi">{t("upiForPayout")}</Label>
              <Input
                id="edit-upi"
                value={editForm.upiId}
                onChange={(e) => setEditForm((f) => ({ ...f, upiId: e.target.value }))}
                placeholder={t("upiPlaceholder")}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("upiPayoutHint")}</p>
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="mt-1.5"
              />
            </div>
            <Button onClick={handleSaveProfile} className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dukaan Timings sheet */}
      <Sheet open={shopTimingsOpen} onOpenChange={setShopTimingsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>{t("shopTimingsTitle")}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium">{t("onlineOrdersAvailable")}</p>
                <p className="text-xs text-muted-foreground">When OFF, customers cannot place orders from your menu</p>
              </div>
              <Switch
                checked={shopForm.isOnline}
                onCheckedChange={(v) => setShopForm((f) => ({ ...f, isOnline: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("openTime")}</Label>
                <select
                  value={shopForm.openTime}
                  onChange={(e) => setShopForm((f) => ({ ...f, openTime: e.target.value }))}
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TIME_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t("closeTime")}</Label>
                <select
                  value={shopForm.closeTime}
                  onChange={(e) => setShopForm((f) => ({ ...f, closeTime: e.target.value }))}
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TIME_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>{t("weeklyOff")}</Label>
              <select
                value={shopForm.weeklyOff}
                onChange={(e) => setShopForm((f) => ({ ...f, weeklyOff: e.target.value }))}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {WEEKLY_OFF_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="shop-holidays">{t("shopHolidays")}</Label>
              <textarea
                id="shop-holidays"
                value={shopForm.holidaysText}
                onChange={(e) => setShopForm((f) => ({ ...f, holidaysText: e.target.value }))}
                placeholder="2026-03-01\n2026-08-15"
                className="mt-1.5 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={4}
              />
            </div>
            <Button
              className="w-full"
              disabled={savingShop}
              onClick={async () => {
                if (!user?.id) return;
                const open = shopForm.openTime;
                const close = shopForm.closeTime;
                if (parseInt(open.replace(":", ""), 10) >= parseInt(close.replace(":", ""), 10)) {
                  toast.error("Opening time must be before closing time");
                  return;
                }
                setSavingShop(true);
                try {
                  const holidays = shopForm.holidaysText
                    .split(/[\n,]+/)
                    .map((s) => s.trim())
                    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
                  const openingHours = buildOpeningHours(open, close, shopForm.weeklyOff || null);
                  const updatePayload = {
                    opening_hours: openingHours,
                    weekly_off: shopForm.weeklyOff || null,
                    holidays,
                    is_online: shopForm.isOnline,
                  };
                  let success = false;
                  try {
                    const { error } = await supabase.functions.invoke("update-profile", { body: updatePayload });
                    if (error) throw error;
                    success = true;
                  } catch {
                    // Fallback to direct update
                    const { error: directError } = await supabase
                      .from("profiles")
                      .update(updatePayload)
                      .eq("id", user.id);
                    if (directError) throw directError;
                    success = true;
                  }
                  if (!success) throw new Error("Update failed");
                  await refreshProfile();
                  setShopTimingsOpen(false);
                  toast.success(t("profileUpdated"));
                } catch (e) {
                  if (e instanceof Error && e.name === "AbortError") return;
                  toast.error("Could not save. Try again.");
                } finally {
                  setSavingShop(false);
                }
              }}
            >
              {savingShop ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Notifications sheet */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>Notification settings</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium">Order updates</p>
                <p className="text-xs text-muted-foreground">Status and delivery alerts</p>
              </div>
              <Switch
                checked={notifSettings.orderUpdates}
                onCheckedChange={(v) => handleNotifToggle("orderUpdates", v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium">Promotions</p>
                <p className="text-xs text-muted-foreground">Offers and discounts</p>
              </div>
              <Switch
                checked={notifSettings.promotions}
                onCheckedChange={(v) => handleNotifToggle("promotions", v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium">Draw results</p>
                <p className="text-xs text-muted-foreground">Daily draw winners</p>
              </div>
              <Switch
                checked={notifSettings.drawResults}
                onCheckedChange={(v) => handleNotifToggle("drawResults", v)}
              />
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="font-medium">Payment alert volume</p>
              <p className="mb-3 text-xs text-muted-foreground">Sound level when a payment is received</p>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={async () => {
                      if (!user?.id) return;
                      try {
                        let success = false;
                        try {
                          const { error } = await supabase.functions.invoke("update-profile", {
                            body: { alert_volume: level },
                          });
                          if (error) throw error;
                          success = true;
                        } catch {
                          // Fallback to direct update
                          const { error: directError } = await supabase
                            .from("profiles")
                            .update({ alert_volume: level })
                            .eq("id", user.id);
                          if (directError) throw directError;
                          success = true;
                        }
                        if (success) {
                          await refreshProfile();
                          toast.success("Saved");
                        }
                      } catch (e) {
                        if (e instanceof Error && e.name === "AbortError") return;
                        toast.error("Could not update");
                      }
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${
                      (rawProfile as { alert_volume?: string } | null)?.alert_volume === level
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            {isPushSupported() && (
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Browser push</p>
                  <p className="text-xs text-muted-foreground">
                    Get notifications even when the app is closed
                  </p>
                </div>
                {pushEnabled ? (
                  <span className="text-sm font-medium text-success">On</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEnablePush}
                    disabled={pushLoading}
                  >
                    {pushLoading ? "…" : "Enable"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* SVANidhi – Support for application */}
      <Sheet open={svanidhiSupportOpen} onOpenChange={setSvanidhiSupportOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <HelpCircle size={20} />
              We support your SVANidhi application
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 text-sm text-amber-800 dark:text-amber-200">
            <p>
              We help you prepare and submit your PM SVANidhi loan application using your app data as proof of business.
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li><strong>Document checklist</strong> – what you need (ID, address, bank details)</li>
              <li><strong>Step-by-step guide</strong> – how to fill the form and upload documents</li>
              <li><strong>Transaction history as proof</strong> – we attach your purchases & sales from this app</li>
            </ul>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              When you’re ready, use “Apply for SVANidhi loan” to open the official portal. Your transaction proof stub will be included.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
