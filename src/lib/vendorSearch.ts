import { supabase } from "./supabase";

export const SEARCH_ZONES = [
  "",
  "Charminar",
  "Hi-Tech City",
  "Secunderabad",
  "Banjara Hills",
  "Kukatpally",
  "Gachibowli",
  "General",
] as const;

export const SORT_OPTIONS = [
  { value: "popular", labelKey: "sortPopular" },
  { value: "rating", labelKey: "sortRating" },
  { value: "name", labelKey: "sortName" },
] as const;

/** Stall types for filter dropdown (ILIKE match on profiles.stall_type). */
export const SEARCH_STALL_TYPES = [
  { value: "", labelKey: "searchStallTypeAll" },
  { value: "Kirana", labelKey: "searchStallTypeKirana" },
  { value: "General", labelKey: "searchStallTypeGeneral" },
  { value: "PaniPuri", labelKey: "searchStallTypePanipuri" },
  { value: "Chai", labelKey: "searchStallTypeChai" },
  { value: "Tiffin", labelKey: "searchStallTypeTiffin" },
  { value: "Pan", labelKey: "searchStallTypePan" },
  { value: "Fast Food", labelKey: "searchStallTypeFastFood" },
  { value: "Snacks", labelKey: "searchStallTypeSnacks" },
  { value: "Beverage", labelKey: "searchStallTypeBeverage" },
  { value: "Food", labelKey: "searchStallTypeFood" },
  { value: "Hardware", labelKey: "searchStallTypeHardware" },
  { value: "Saloon", labelKey: "searchStallTypeSaloon" },
] as const;

export interface VendorSearchFilters {
  keyword?: string;
  zone?: string;
  stallType?: string;
  sort?: "popular" | "name" | "rating";
}

export interface MenuPreviewItem {
  item_name: string;
  price: number;
}

export interface VendorSearchResult {
  vendor_id: string;
  name: string | null;
  stall_type: string | null;
  zone: string | null;
  address: string | null;
  menu_preview: MenuPreviewItem[];
  order_count: number;
  premium_tier?: string;
  avg_rating?: number | null;
}

export type VendorSearchResponse = { data: VendorSearchResult[]; error?: string };

export async function getVendorSearchResults(
  filters: VendorSearchFilters
): Promise<VendorSearchResponse> {
  const { data, error } = await supabase.rpc("get_vendor_search_results", {
    p_keyword: filters.keyword?.trim() || null,
    p_zone: filters.zone || null,
    p_stall_type: filters.stallType || null,
    p_sort: filters.sort === "rating" ? "rating" : filters.sort || "popular",
  });
  if (error) {
    console.error("get_vendor_search_results:", error);
    return { data: [], error: error.message };
  }
  const rows = (data ?? []) as Array<{
    vendor_id: string;
    name: string | null;
    stall_type: string | null;
    zone: string | null;
    address: string | null;
    menu_preview: unknown;
    order_count: number;
    premium_tier?: string | null;
    avg_rating?: number | null;
  }>;
  return {
    data: rows.map((r) => ({
      vendor_id: r.vendor_id,
      name: r.name ?? "",
      stall_type: r.stall_type ?? null,
      zone: r.zone ?? null,
      address: r.address ?? null,
      menu_preview: Array.isArray(r.menu_preview)
        ? (r.menu_preview as MenuPreviewItem[])
        : [],
      order_count: Number(r.order_count) || 0,
      premium_tier: r.premium_tier ?? "free",
      avg_rating: r.avg_rating != null ? Number(r.avg_rating) : null,
    })),
  };
}
