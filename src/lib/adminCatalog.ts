/**
 * Admin CRUD for sectors, categories, default_menu_items.
 * Requires admin role (RLS policies allow only admins to INSERT/UPDATE/DELETE).
 */
import { supabase } from "./supabase";

export interface Sector {
  id: string;
  name: string;
  icon: string | null;
}

export interface Category {
  id: string;
  name: string;
  sector_id: string;
  gst_rate: number;
}

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

export async function getSectorsAdmin(): Promise<Sector[]> {
  const { data, error } = await supabase.from("sectors").select("id, name, icon").order("name");
  if (error) return [];
  return (data ?? []) as Sector[];
}

export async function upsertSector(payload: { id?: string; name: string; icon?: string | null }): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    if (payload.id) {
      const { error } = await supabase.from("sectors").update({ name: payload.name, icon: payload.icon ?? null }).eq("id", payload.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: payload.id };
    }
    const { data, error } = await supabase.from("sectors").insert({ name: payload.name, icon: payload.icon ?? null }).select("id").single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteSector(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("sectors").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getCategoriesAdmin(sectorId?: string): Promise<Category[]> {
  let q = supabase.from("categories").select("id, name, sector_id, gst_rate").order("name");
  if (sectorId) q = q.eq("sector_id", sectorId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as Category[];
}

export async function upsertCategory(payload: {
  id?: string;
  name: string;
  sector_id: string;
  gst_rate: number;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    if (payload.id) {
      const { error } = await supabase
        .from("categories")
        .update({ name: payload.name, sector_id: payload.sector_id, gst_rate: payload.gst_rate })
        .eq("id", payload.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: payload.id };
    }
    const { data, error } = await supabase
      .from("categories")
      .insert({ name: payload.name, sector_id: payload.sector_id, gst_rate: payload.gst_rate })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteCategory(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getDefaultMenuItemsAdmin(sectorId?: string): Promise<DefaultMenuItem[]> {
  let q = supabase
    .from("default_menu_items")
    .select("id, sector_id, item_name, description, default_selling_price_range, gst_rate, category_id, image_url, is_popular, sort_order")
    .order("sort_order");
  if (sectorId) q = q.eq("sector_id", sectorId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as DefaultMenuItem[];
}

export async function upsertDefaultMenuItem(payload: {
  id?: string;
  sector_id: string;
  item_name: string;
  description?: string | null;
  default_selling_price_range: string;
  gst_rate: number;
  category_id?: string | null;
  image_url?: string | null;
  is_popular?: boolean;
  sort_order?: number;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const row = {
      sector_id: payload.sector_id,
      item_name: payload.item_name,
      description: payload.description ?? null,
      default_selling_price_range: payload.default_selling_price_range,
      gst_rate: payload.gst_rate,
      category_id: payload.category_id ?? null,
      image_url: payload.image_url ?? null,
      is_popular: payload.is_popular ?? false,
      sort_order: payload.sort_order ?? 0,
    };
    if (payload.id) {
      const { error } = await supabase.from("default_menu_items").update(row).eq("id", payload.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: payload.id };
    }
    const { data, error } = await supabase.from("default_menu_items").insert(row).select("id").single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteDefaultMenuItem(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("default_menu_items").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Catalog products (shown in Catalog page). Admin CRUD. */
export interface CatalogProductAdmin {
  id: string;
  name: string;
  name_hi: string | null;
  name_te: string | null;
  category_id: string;
  description: string | null;
  description_hi: string | null;
  description_te: string | null;
  mrp: number;
  selling_price: number;
  reference_price: number | null;
  discount_percent: number;
  gst_rate: number;
  image_url: string | null;
  stock_quantity: number;
  is_eco: boolean;
}

export async function getCatalogProductsAdmin(categoryId?: string): Promise<CatalogProductAdmin[]> {
  let q = supabase
    .from("catalog_products")
    .select("id, name, name_hi, name_te, category_id, description, description_hi, description_te, mrp, selling_price, reference_price, discount_percent, gst_rate, image_url, stock_quantity, is_eco")
    .order("name");
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as CatalogProductAdmin[];
}

export async function upsertCatalogProduct(payload: {
  id?: string;
  name: string;
  name_hi?: string | null;
  name_te?: string | null;
  category_id: string;
  description?: string | null;
  description_hi?: string | null;
  description_te?: string | null;
  mrp: number;
  selling_price: number;
  reference_price?: number | null;
  discount_percent?: number;
  gst_rate?: number;
  image_url?: string | null;
  stock_quantity?: number;
  is_eco?: boolean;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const row = {
      name: payload.name,
      name_hi: payload.name_hi ?? null,
      name_te: payload.name_te ?? null,
      category_id: payload.category_id,
      description: payload.description ?? null,
      description_hi: payload.description_hi ?? null,
      description_te: payload.description_te ?? null,
      mrp: payload.mrp,
      selling_price: payload.selling_price,
      reference_price: payload.reference_price ?? null,
      discount_percent: payload.discount_percent ?? 0,
      gst_rate: payload.gst_rate ?? 5,
      image_url: payload.image_url ?? null,
      stock_quantity: payload.stock_quantity ?? 0,
      is_eco: payload.is_eco ?? false,
    };
    if (payload.id) {
      const { error } = await supabase.from("catalog_products").update(row).eq("id", payload.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: payload.id };
    }
    const { data, error } = await supabase.from("catalog_products").insert(row).select("id").single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteCatalogProduct(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("catalog_products").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
