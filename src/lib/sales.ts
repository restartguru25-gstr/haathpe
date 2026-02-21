import { supabase } from "./supabase";
import { calculatePlatformFee } from "./platformFees";

export interface DefaultMenuItem {
  id: string;
  sector_id: string;
  item_name: string;
  description: string | null;
  default_selling_price_range: string;
  gst_rate: number;
  category_id: string | null;
  image_url: string | null;
  is_popular: boolean;
  sort_order: number;
}

export interface VendorMenuItem {
  id: string;
  vendor_id: string;
  default_menu_item_id: string | null;
  item_name: string;
  description: string | null;
  default_selling_price_range: string | null;
  gst_rate: number;
  custom_selling_price: number;
  custom_description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerOrderItem {
  item_name: string;
  qty: number;
  price: number;
  gst_rate: number;
  gst?: number;
}

export interface CustomerOrder {
  id: string;
  vendor_id: string;
  customer_name_phone: string | null;
  items: CustomerOrderItem[];
  subtotal: number;
  gst_amount: number;
  total: number;
  payment_method: "cash" | "upi" | "online";
  status: "pending" | "prepared" | "ready" | "delivered" | "paid";
  payment_id: string | null;
  created_at: string;
}

const STALL_TO_SECTOR: Record<string, string> = {
  "Kirana Store": "a0000006-0006-4000-8000-000000000006", // New sector for Kirana
  "General Store": "a0000002-0002-4000-8000-000000000002",
  "Kirana/General Store": "a0000006-0006-4000-8000-000000000006", // Use Kirana sector
  "Tea Stall": "a0000004-0004-4000-8000-000000000004",
  "Tea Stalls": "a0000004-0004-4000-8000-000000000004",
  "Beverage Stalls": "a0000004-0004-4000-8000-000000000004",
  "Food Stall": "a0000002-0002-4000-8000-000000000002",
  "Snacks Stall": "a0000004-0004-4000-8000-000000000004",
  "Panipuri Stall": "a0000001-0001-4000-8000-000000000001",
  "PaniPuri": "a0000001-0001-4000-8000-000000000001",
  "Panipuri": "a0000001-0001-4000-8000-000000000001",
  "Tiffin Centres": "a0000002-0002-4000-8000-000000000002",
  "Tiffin Centre": "a0000002-0002-4000-8000-000000000002",
  "Tiffin": "a0000002-0002-4000-8000-000000000002",
  "Pan Shops": "a0000003-0003-4000-8000-000000000003",
  "Pan Shop": "a0000003-0003-4000-8000-000000000003",
  "Fast Food Carts": "a0000005-0005-4000-8000-000000000005",
  "Fast Food": "a0000005-0005-4000-8000-000000000005",
  "Hardware Shop": "a0000007-0007-4000-8000-000000000007", // New sector for Hardware
  "Hardware": "a0000007-0007-4000-8000-000000000007",
  "Saloon/Spa": "a0000008-0008-4000-8000-000000000008", // New sector for Saloon/Spa
  "Salon/Spa": "a0000008-0008-4000-8000-000000000008",
};

export function getSectorIdFromStallType(stallType: string | null): string | null {
  if (!stallType) return null;
  const trimmed = stallType.trim();
  return STALL_TO_SECTOR[trimmed] ?? null;
}

export function parsePriceRange(range: string): number {
  const parts = range.split("-").map((p) => parseFloat(p.trim()));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return Math.round((parts[0] + parts[1]) / 2);
  }
  const single = parseFloat(range.replace(/[^\d.]/g, ""));
  return Number.isNaN(single) ? 0 : single;
}

export async function getDefaultMenuBySector(sectorId: string): Promise<DefaultMenuItem[]> {
  const { data, error } = await supabase
    .from("default_menu_items")
    .select("*")
    .eq("sector_id", sectorId)
    .order("sort_order");
  if (error) return [];
  return (data ?? []) as DefaultMenuItem[];
}

/** Get default menu items filtered by vendor's stall_type (shop-specific defaults). */
export async function getDefaultMenuByStallType(stallType: string | null): Promise<DefaultMenuItem[]> {
  if (!stallType) return [];
  const sectorId = getSectorIdFromStallType(stallType);
  if (!sectorId) return [];
  return getDefaultMenuBySector(sectorId);
}

export async function getVendorMenuItems(vendorId: string): Promise<VendorMenuItem[]> {
  const { data, error } = await supabase
    .from("vendor_menu_items")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("sort_order");
  if (error) return [];
  return (data ?? []) as VendorMenuItem[];
}

/** Get vendor public profile (name, zone, shop details). Uses RPC so anon can read. */
export async function getVendorPublicProfile(vendorId: string): Promise<{
  name: string | null;
  zone: string | null;
  opening_hours?: Record<string, string> | null;
  weekly_off?: string | null;
  holidays?: string[] | null;
  is_online?: boolean;
} | null> {
  const { data, error } = await supabase.rpc("get_vendor_public_info", {
    p_vendor_id: vendorId,
  });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  return {
    name: (r.name as string | null) ?? null,
    zone: (r.zone as string | null) ?? null,
    opening_hours: r.opening_hours as Record<string, string> | null | undefined,
    weekly_off: r.weekly_off as string | null | undefined,
    holidays: r.holidays as string[] | null | undefined,
    is_online: r.is_online as boolean | undefined,
  };
}

/** Get vendor zone for ad targeting. Uses getVendorPublicProfile (RPC). */
export async function getVendorZone(vendorId: string): Promise<string | null> {
  const p = await getVendorPublicProfile(vendorId);
  return p?.zone ?? null;
}

export async function getActiveVendorMenuForPublic(vendorId: string): Promise<VendorMenuItem[]> {
  const { data, error } = await supabase
    .from("vendor_menu_items")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("is_active", true)
    .order("sort_order");
  if (error) return [];
  return (data ?? []) as VendorMenuItem[];
}

export async function activateDefaultMenu(
  vendorId: string,
  sectorId: string
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const defaults = await getDefaultMenuBySector(sectorId);
  if (defaults.length === 0) return { ok: false, error: "No default menu for this sector" };
  const rows = defaults.map((d) => ({
    vendor_id: vendorId,
    default_menu_item_id: d.id,
    item_name: d.item_name,
    description: d.description,
    default_selling_price_range: d.default_selling_price_range,
    gst_rate: d.gst_rate,
    custom_selling_price: parsePriceRange(d.default_selling_price_range),
    image_url: d.image_url,
    is_active: true,
    sort_order: d.sort_order,
  }));
  const { error } = await supabase.from("vendor_menu_items").upsert(rows, {
    onConflict: "vendor_id,default_menu_item_id",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: rows.length };
}

export async function updateVendorMenuItem(
  id: string,
  vendorId: string,
  updates: { custom_selling_price?: number; custom_description?: string | null; is_active?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("vendor_menu_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("vendor_id", vendorId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Add a custom menu item (no default template). Use when vendor has no stall type or wants to add items manually. */
export async function addCustomVendorMenuItem(
  vendorId: string,
  payload: { item_name: string; custom_selling_price: number; gst_rate?: number; sort_order?: number }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const price = Number(payload.custom_selling_price);
  if (!payload.item_name?.trim() || Number.isNaN(price) || price < 0) {
    return { ok: false, error: "Item name and a valid price (₹) are required" };
  }
  const { data, error } = await supabase
    .from("vendor_menu_items")
    .insert({
      vendor_id: vendorId,
      default_menu_item_id: null,
      item_name: payload.item_name.trim(),
      description: null,
      default_selling_price_range: null,
      gst_rate: payload.gst_rate ?? 5,
      custom_selling_price: price,
      custom_description: null,
      image_url: "🍽️",
      is_active: true,
      sort_order: payload.sort_order ?? 0,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

/** Create a direct payment order (pay-like-PhonePe flow). Single line item for the amount. */
export async function createDirectPaymentOrder(
  vendorId: string,
  amount: number,
  opts?: { customerPhone?: string | null; customerId?: string | null; note?: string | null }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const items: CustomerOrderItem[] = [
    { item_name: opts?.note?.trim() ? `Direct payment – ${opts.note.trim().slice(0, 80)}` : "Direct payment", qty: 1, price: amount, gst_rate: 0, gst: 0 },
  ];
  return createCustomerOrder(vendorId, {
    customer_phone: opts?.customerPhone ?? null,
    customer_id: opts?.customerId ?? null,
    items,
    subtotal: amount,
    gst_amount: 0,
    total: amount,
    payment_method: "upi",
    status: "pending",
    delivery_option: "pickup",
  });
}

export async function createCustomerOrder(
  vendorId: string,
  payload: {
    customer_name_phone?: string | null;
    customer_phone?: string | null;
    customer_id?: string | null;
    items: CustomerOrderItem[];
    subtotal: number;
    gst_amount: number;
    total: number;
    payment_method: "cash" | "upi" | "online";
    status?: "pending" | "paid";
    payment_id?: string | null;
    delivery_option?: "pickup" | "self_delivery";
    delivery_address?: string | null;
    wallet_used?: number;
    coins_awarded?: number;
  }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { platform_fee, vendor_amount } = await calculatePlatformFee(vendorId, payload.total);

  const { data, error } = await supabase
    .from("customer_orders")
    .insert({
      vendor_id: vendorId,
      customer_name_phone: payload.customer_name_phone ?? null,
      customer_phone: payload.customer_phone ?? null,
      customer_id: payload.customer_id ?? null,
      items: payload.items,
      subtotal: payload.subtotal,
      gst_amount: payload.gst_amount,
      total: payload.total,
      payment_method: payload.payment_method,
      status: payload.status ?? "pending",
      payment_id: payload.payment_id ?? null,
      delivery_option: payload.delivery_option ?? "pickup",
      delivery_address: payload.delivery_address ?? null,
      platform_fee,
      vendor_amount,
      wallet_used: payload.wallet_used ?? 0,
      coins_awarded: payload.coins_awarded ?? 0,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export interface TrackedOrder {
  id: string;
  vendor_id: string;
  status: string;
  created_at: string;
  vendor_name: string | null;
  delivery_option: string;
  delivery_address: string | null;
}

/** Get order for public tracking (shareable link). */
export async function getOrderForTracking(orderId: string): Promise<TrackedOrder | null> {
  const { data, error } = await supabase.rpc("get_order_for_tracking", {
    p_order_id: orderId,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as {
    id: string;
    vendor_id: string;
    status: string;
    created_at: string;
    vendor_name: string | null;
    delivery_option: string;
    delivery_address: string | null;
  };
  return { ...row, delivery_option: row.delivery_option ?? "pickup" };
}

export interface VendorReview {
  order_id: string;
  rating: number;
  review_text: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** Get vendor reviews for dashboard. */
export async function getVendorReviews(vendorId: string): Promise<VendorReview[]> {
  const { data, error } = await supabase.rpc("get_vendor_reviews", {
    p_vendor_id: vendorId,
  });
  if (error) return [];
  return (data ?? []) as VendorReview[];
}

/** Update customer order status (vendor only). */
export async function updateCustomerOrderStatus(
  vendorId: string,
  orderId: string,
  status: "pending" | "prepared" | "ready" | "delivered" | "paid"
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("customer_orders")
    .update({ status })
    .eq("id", orderId)
    .eq("vendor_id", vendorId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getCustomerOrders(
  vendorId: string,
  opts?: { limit?: number }
): Promise<CustomerOrder[]> {
  let q = supabase
    .from("customer_orders")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as CustomerOrder[];
}

export async function getSalesStats(
  vendorId: string,
  since: string
): Promise<{ totalRevenue: number; orderCount: number; topItems: { item_name: string; qty: number }[] }> {
  const { data, error } = await supabase
    .from("customer_orders")
    .select("items, total")
    .eq("vendor_id", vendorId)
    .gte("created_at", since);
  if (error) return { totalRevenue: 0, orderCount: 0, topItems: [] };
  const orders = (data ?? []) as { items: CustomerOrderItem[]; total: number }[];
  let totalRevenue = 0;
  const itemCounts: Record<string, number> = {};
  for (const o of orders) {
    totalRevenue += Number(o.total);
    for (const line of o.items) {
      itemCounts[line.item_name] = (itemCounts[line.item_name] ?? 0) + line.qty;
    }
  }
  const topItems = Object.entries(itemCounts)
    .map(([item_name, qty]) => ({ item_name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  return { totalRevenue, orderCount: orders.length, topItems };
}
