import { supabase } from "./supabase";

export interface VendorSwap {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  price_notes: string;
  location: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  vendor_name?: string | null;
}

export interface SwapRating {
  id: string;
  swap_id: string;
  reviewer_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer_name?: string | null;
}

export async function getApprovedSwaps(): Promise<VendorSwap[]> {
  const { data, error } = await supabase
    .from("vendor_swaps")
    .select("id, vendor_id, title, description, price_notes, location, status, created_at, updated_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    vendor_id: row.vendor_id,
    title: row.title,
    description: row.description ?? null,
    price_notes: row.price_notes,
    location: row.location ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vendor_name: null as string | null,
  })) as VendorSwap[];
}

export async function getSwapById(id: string): Promise<VendorSwap | null> {
  const { data, error } = await supabase
    .from("vendor_swaps")
    .select(`
      id,
      vendor_id,
      title,
      description,
      price_notes,
      location,
      status,
      created_at,
      updated_at,
      profiles(name)
    `)
    .eq("id", id)
    .single();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    vendor_id: row.vendor_id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    price_notes: row.price_notes as string,
    location: (row.location as string) ?? null,
    status: row.status as "pending" | "approved" | "rejected",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    vendor_name: (row.profiles as { name?: string } | null)?.name ?? null,
  };
}

export async function createSwap(payload: {
  vendor_id: string;
  title: string;
  description?: string | null;
  price_notes: string;
  location?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("vendor_swaps")
      .insert({
        vendor_id: payload.vendor_id,
        title: payload.title,
        description: payload.description ?? null,
        price_notes: payload.price_notes,
        location: payload.location ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return { ok: false, error: msg };
  }
}

export async function getRatingsForSwap(swapId: string): Promise<SwapRating[]> {
  const { data, error } = await supabase
    .from("swap_ratings")
    .select("id, swap_id, reviewer_id, rating, review_text, created_at")
    .eq("swap_id", swapId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as SwapRating[];
}

export async function addSwapRating(payload: {
  swap_id: string;
  reviewer_id: string;
  rating: number;
  review_text?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("swap_ratings").upsert(
    {
      swap_id: payload.swap_id,
      reviewer_id: payload.reviewer_id,
      rating: Math.min(5, Math.max(1, payload.rating)),
      review_text: payload.review_text ?? null,
    },
    { onConflict: "swap_id,reviewer_id" }
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getPendingSwapsForAdmin(): Promise<VendorSwap[]> {
  const { data, error } = await supabase
    .from("vendor_swaps")
    .select(`
      id,
      vendor_id,
      title,
      description,
      price_notes,
      location,
      status,
      created_at,
      updated_at,
      profiles(name)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    vendor_id: row.vendor_id,
    title: row.title,
    description: row.description ?? null,
    price_notes: row.price_notes,
    location: row.location ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vendor_name: (row.profiles as { name?: string } | null)?.name ?? null,
  })) as VendorSwap[];
}

export async function moderateSwap(
  swapId: string,
  status: "approved" | "rejected"
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("vendor_swaps")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", swapId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getAllSwapsForAdmin(): Promise<VendorSwap[]> {
  const { data, error } = await supabase
    .from("vendor_swaps")
    .select(`
      id,
      vendor_id,
      title,
      description,
      price_notes,
      location,
      status,
      created_at,
      updated_at,
      profiles(name)
    `)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    vendor_id: row.vendor_id,
    title: row.title,
    description: row.description ?? null,
    price_notes: row.price_notes,
    location: row.location ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vendor_name: (row.profiles as { name?: string } | null)?.name ?? null,
  })) as VendorSwap[];
}

export async function updateSwap(
  swapId: string,
  payload: { title?: string; description?: string | null; price_notes?: string; location?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("vendor_swaps")
    .update({
      ...(payload.title != null && { title: payload.title }),
      ...(payload.description != null && { description: payload.description }),
      ...(payload.price_notes != null && { price_notes: payload.price_notes }),
      ...(payload.location != null && { location: payload.location }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", swapId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteSwap(swapId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("vendor_swaps").delete().eq("id", swapId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
