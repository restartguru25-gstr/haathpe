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
  greenScore: number;
  businessAddress: string;
  shopPhotoUrls: string[];
  gstNumber: string;
  panNumber: string;
  udyamNumber: string;
  fssaiLicense: string;
  otherBusinessDetails: string;
}

const stallIcons: Record<string, string> = {
  "Tea Stall": "☕",
  "Beverage Stalls": "🥤",
  "Food Stall": "🍲",
  "Snacks Stall": "🍿",
  "Panipuri Stall": "🎪",
  "Default": "🛒",
};

function profileToDisplay(p: Profile | null): DisplayProfile {
  if (!p) return vendorProfileToDisplay();
  const stallType = p.stall_type || "Default";
  const raw = p as Profile & {
    business_address?: string | null;
    shop_photo_urls?: string[] | null;
    gst_number?: string | null;
    pan_number?: string | null;
    udyam_number?: string | null;
    fssai_license?: string | null;
    other_business_details?: string | null;
    available_balance?: number | null;
    zone?: string | null;
  };
  const shopUrls = raw.shop_photo_urls;
  return {
    name: p.name || "Vendor",
    stallType,
    stallIcon: stallIcons[stallType] || stallIcons.Default,
    phone: p.phone || vendorProfile.phone,
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
    greenScore: (p as { green_score?: number }).green_score ?? 0,
    businessAddress: raw.business_address ?? raw.stall_address ?? "",
    shopPhotoUrls: Array.isArray(shopUrls) ? shopUrls : [],
    gstNumber: raw.gst_number ?? "",
    panNumber: raw.pan_number ?? "",
    udyamNumber: raw.udyam_number ?? "",
    fssaiLicense: raw.fssai_license ?? "",
    otherBusinessDetails: raw.other_business_details ?? "",
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
    greenScore: 0,
    businessAddress: "",
    shopPhotoUrls: [],
    gstNumber: "",
    panNumber: "",
    udyamNumber: "",
    fssaiLicense: "",
    otherBusinessDetails: "",
  };
}

export function useProfile(): { profile: DisplayProfile; isLoading: boolean; isFromSupabase: boolean } {
  const { profile: supabaseProfile, isLoading } = useSession();
  const profile = profileToDisplay(supabaseProfile);
  const isFromSupabase = !!supabaseProfile;
  return { profile, isLoading, isFromSupabase };
}
