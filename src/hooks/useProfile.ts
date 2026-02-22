import { useSession } from "@/contexts/AuthContext";
import { vendorProfile } from "@/lib/data";
import type { Profile } from "@/lib/database.types";

export interface DisplayProfile {
  name: string;
  stallType: string;
  stallIcon: string;
  phone: string;
  address: string;
  points: number;
  tier: "Bronze" | "Silver" | "Gold";
  streak: number;
  creditLimit: number;
  creditUsed: number;
  availableBalance: number;
  zone: string | null;
  photoUrl: string | null;
  preferredLanguage: "en" | "hi" | "te";
  alertVolume: "low" | "medium" | "high";
  greenScore: number;
  businessAddress: string;
  shopPhotoUrls: string[];
  gstNumber: string;
  panNumber: string;
  bankAccountNumber: string;
  ifscCode: string;
  bankVerified: boolean;
  panVerified: boolean;
  gstinVerified: boolean;
  udyamNumber: string;
  fssaiLicense: string;
  otherBusinessDetails: string;
  premiumTier: "free" | "basic" | "premium";
  upiId: string;
}

const stallIcons: Record<string, string> = {
  "Kirana Store": "🏪",
  "General Store": "🏬",
  "Kirana/General Store": "🏪",
  "Tea Stall": "☕",
  "Beverage Stalls": "🥤",
  "Food Stall": "🍲",
  "Snacks Stall": "🍿",
  "Panipuri Stall": "🎪",
  "Tiffin Centre": "🍱",
  "Pan Shop": "🍃",
  "Fast Food": "🍔",
  "Hardware Shop": "🔧",
  "Saloon/Spa": "💇",
  "Default": "🛒",
};

function profileToDisplay(p: Profile | null, user?: { email?: string | null; phone?: string | null } | null): DisplayProfile {
  if (!p) return vendorProfileToDisplay();
  const stallType = p.stall_type || "Default";
  const raw = p as Profile & {
    business_address?: string | null;
    shop_photo_urls?: string[] | null;
    gst_number?: string | null;
    pan_number?: string | null;
    bank_account_number?: string | null;
    ifsc_code?: string | null;
    bank_verified?: boolean | null;
    pan_verified?: boolean | null;
    gstin_verified?: boolean | null;
    udyam_number?: string | null;
    fssai_license?: string | null;
    other_business_details?: string | null;
    upi_id?: string | null;
    available_balance?: number | null;
    zone?: string | null;
    premium_tier?: string | null;
    premium_expires_at?: string | null;
    alert_volume?: "low" | "medium" | "high" | null;
  };
  const shopUrls = raw.shop_photo_urls;
  const displayName = p.name || (user?.email ? user.email.split("@")[0] : null) || (user?.phone || "") || "Dukaanwaala";
  const displayPhone = p.phone || user?.phone || "";
  return {
    name: displayName,
    stallType,
    stallIcon: stallIcons[stallType] || stallIcons.Default,
    phone: displayPhone,
    address: p.stall_address || vendorProfile.address,
    points: p.points ?? vendorProfile.points,
    tier: p.tier || "Silver",
    streak: p.streak ?? vendorProfile.streak,
    creditLimit: p.credit_limit ?? vendorProfile.creditLimit,
    creditUsed: p.credit_used ?? vendorProfile.creditUsed,
    availableBalance: raw.available_balance ?? 0,
    zone: raw.zone ?? null,
    photoUrl: p.photo_url,
    preferredLanguage: p.preferred_language || "en",
    alertVolume: (raw.alert_volume as "low" | "medium" | "high") || "medium",
    greenScore: (p as { green_score?: number }).green_score ?? 0,
    businessAddress: raw.business_address ?? raw.stall_address ?? "",
    shopPhotoUrls: Array.isArray(shopUrls) ? shopUrls : [],
    gstNumber: raw.gst_number ?? "",
    panNumber: raw.pan_number ?? "",
    bankAccountNumber: raw.bank_account_number ?? "",
    ifscCode: raw.ifsc_code ?? "",
    bankVerified: raw.bank_verified === true,
    panVerified: raw.pan_verified === true,
    gstinVerified: raw.gstin_verified === true,
    udyamNumber: raw.udyam_number ?? "",
    fssaiLicense: raw.fssai_license ?? "",
    otherBusinessDetails: raw.other_business_details ?? "",
    premiumTier: (() => {
      const tier = (raw.premium_tier as "free" | "basic" | "premium") || "free";
      if (tier !== "premium") return tier;
      const expiresAt = raw.premium_expires_at;
      if (!expiresAt) return tier;
      if (new Date(expiresAt) <= new Date()) return "free" as const;
      return tier;
    })(),
    upiId: raw.upi_id ?? "",
  };
}

function vendorProfileToDisplay(): DisplayProfile {
  return {
    name: vendorProfile.name,
    stallType: vendorProfile.stallType,
    stallIcon: vendorProfile.stallIcon,
    phone: vendorProfile.phone,
    address: vendorProfile.address,
    points: vendorProfile.points,
    tier: vendorProfile.tier,
    streak: vendorProfile.streak,
    creditLimit: vendorProfile.creditLimit,
    creditUsed: vendorProfile.creditUsed,
    availableBalance: 0,
    zone: null,
    photoUrl: null,
    preferredLanguage: "en",
    alertVolume: "medium",
    greenScore: 0,
    businessAddress: "",
    shopPhotoUrls: [],
    gstNumber: "",
    panNumber: "",
    bankAccountNumber: "",
    ifscCode: "",
    bankVerified: false,
    panVerified: false,
    gstinVerified: false,
    udyamNumber: "",
    fssaiLicense: "",
    otherBusinessDetails: "",
    premiumTier: "free" as const,
    upiId: "",
  };
}

export function useProfile(): { profile: DisplayProfile; isLoading: boolean; isFromSupabase: boolean } {
  const { profile: supabaseProfile, user, isLoading } = useSession();
  const profile = profileToDisplay(supabaseProfile, user);
  const isFromSupabase = !!supabaseProfile;
  return { profile, isLoading, isFromSupabase };
}
