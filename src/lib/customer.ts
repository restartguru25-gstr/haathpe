import { supabase } from "./supabase";

export interface CustomerProfile {
  id: string;
  phone: string;
  name: string | null;
  favorites: string[];
  favorite_vendor_ids?: string[];
  order_history: OrderHistoryEntry[];
  created_at: string;
}

export interface OrderHistoryEntry {
  order_id: string;
  vendor_id: string;
  vendor_name?: string;
  total: number;
  items: { item_name: string; qty: number; price: number }[];
  created_at: string;
}

/** Send OTP to phone (E.164, e.g. +919876543210). */
export async function sendCustomerOtp(phone: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Verify OTP and return session. Creates or updates customer_profiles row. */
export async function verifyCustomerOtp(
  phone: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });
  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Verification failed" };
  const uid = data.user.id;
  await supabase.auth.updateUser({ data: { role: "customer" } });
  const { error: upsertError } = await supabase.from("customer_profiles").upsert(
    { id: uid, phone, name: data.user.user_metadata?.name ?? null },
    { onConflict: "id" }
  );
  if (upsertError) {
    console.warn("Customer profile upsert:", upsertError.message);
  }
  return { ok: true };
}

/** Get customer profile for current auth user (id = auth.uid()). */
export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error || !data) return null;
  return {
    ...data,
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    favorite_vendor_ids: Array.isArray((data as { favorite_vendor_ids?: string[] }).favorite_vendor_ids)
      ? (data as { favorite_vendor_ids: string[] }).favorite_vendor_ids
      : [],
    order_history: Array.isArray(data.order_history) ? data.order_history : [],
  } as CustomerProfile;
}

/** Toggle favorite: add or remove menu item id from favorites. */
export async function toggleFavorite(
  customerId: string,
  menuItemId: string,
  currentFavorites: string[]
): Promise<{ ok: boolean; favorites?: string[]; error?: string }> {
  const set = new Set(currentFavorites);
  if (set.has(menuItemId)) set.delete(menuItemId);
  else set.add(menuItemId);
  const favorites = Array.from(set);
  const { error } = await supabase
    .from("customer_profiles")
    .update({ favorites })
    .eq("id", customerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, favorites };
}

/** Toggle vendor favorite (for search card heart). */
export async function toggleFavoriteVendor(
  customerId: string,
  vendorId: string,
  currentVendorIds: string[]
): Promise<{ ok: boolean; favorite_vendor_ids?: string[]; error?: string }> {
  const set = new Set(currentVendorIds);
  if (set.has(vendorId)) set.delete(vendorId);
  else set.add(vendorId);
  const favorite_vendor_ids = Array.from(set);
  const { error } = await supabase
    .from("customer_profiles")
    .update({ favorite_vendor_ids })
    .eq("id", customerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, favorite_vendor_ids };
}

/** Append order summary to customer's order_history. */
export async function appendOrderToHistory(
  customerId: string,
  entry: OrderHistoryEntry
): Promise<{ ok: boolean; error?: string }> {
  const { data: row } = await supabase
    .from("customer_profiles")
    .select("order_history")
    .eq("id", customerId)
    .single();
  const history = Array.isArray(row?.order_history) ? (row.order_history as OrderHistoryEntry[]) : [];
  const updated = [entry, ...history].slice(0, 100);
  const { error } = await supabase
    .from("customer_profiles")
    .update({ order_history: updated })
    .eq("id", customerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface CustomerOrderRow {
  id: string;
  vendor_id: string;
  items: unknown;
  total: number;
  status: string;
  created_at: string;
  vendor_name?: string;
  rating?: number | null;
  review_text?: string | null;
  reviewed_at?: string | null;
  delivery_option?: string;
  delivery_address?: string | null;
  coins_awarded?: number;
}

/** Fetch customer orders (by customer_phone) for /customer/orders page. */
export async function getOrdersForCustomer(phone: string): Promise<CustomerOrderRow[]> {
  const { data: orders, error } = await supabase
    .from("customer_orders")
    .select("id, vendor_id, items, total, status, created_at, rating, review_text, reviewed_at, delivery_option, delivery_address, coins_awarded")
    .eq("customer_phone", phone)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  const list = (orders ?? []) as CustomerOrderRow[];
  const vendorIds = [...new Set(list.map((o) => o.vendor_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", vendorIds);
  const nameMap: Record<string, string> = {};
  (profiles ?? []).forEach((p: { id: string; name: string | null }) => {
    nameMap[p.id] = p.name ?? "Vendor";
  });
  return list.map((o) => ({ ...o, vendor_name: nameMap[o.vendor_id] }));
}

/** Submit rating and review for a completed order. One review per order, phone must match. */
export async function submitOrderReview(
  orderId: string,
  rating: number,
  reviewText?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("submit_order_review", {
    p_order_id: orderId,
    p_rating: rating,
    p_review_text: reviewText ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.ok === false && row.error_msg) {
    return { ok: false, error: row.error_msg };
  }
  return { ok: true };
}
