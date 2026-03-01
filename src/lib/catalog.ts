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

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_label: string;
  variant_price: number;
  variant_stock: number;
  weight_unit: string | null;
}

export interface CatalogProduct {
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
  /** Market/reference price (paise) for savings display. Null = no comparison. */
  reference_price?: number | null;
  discount_percent: number;
  gst_rate: number;
  image_url: string | null;
  stock_quantity: number;
  is_eco: boolean;
  categories?: Category | null;
  product_variants?: ProductVariant[];
}

export async function getSectors(): Promise<Sector[]> {
  const { data, error } = await supabase
    .from("sectors")
    .select("id, name, icon")
    .order("name");
  if (error) return [];
  return (data ?? []) as Sector[];
}

export async function getCategories(sectorId?: string): Promise<Category[]> {
  let q = supabase.from("categories").select("id, name, sector_id, gst_rate").order("name");
  if (sectorId) q = q.eq("sector_id", sectorId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as Category[];
}

export async function getCatalogProducts(opts?: {
  sectorId?: string;
  categoryId?: string;
  search?: string;
  limit?: number;
}): Promise<CatalogProduct[]> {
  let q = supabase
    .from("catalog_products")
    .select(
      "id, name, name_hi, name_te, category_id, description, description_hi, description_te, mrp, selling_price, reference_price, discount_percent, gst_rate, image_url, stock_quantity, is_eco, categories(id, name, sector_id, gst_rate), product_variants(id, product_id, variant_label, variant_price, variant_stock, weight_unit)"
    )
    .order("name");
  if (opts?.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts?.sectorId) {
    const cats = await getCategories(opts.sectorId);
    const catIds = cats.map((c) => c.id);
    if (catIds.length) q = q.in("category_id", catIds);
  }
  if (opts?.search) q = q.or(`name.ilike.%${opts.search}%,description.ilike.%${opts.search}%`);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as CatalogProduct[];
}

/** Fetch a single catalog product with variants by id (for reorder). */
export async function getCatalogProductById(id: string): Promise<CatalogProduct | null> {
  const { data, error } = await supabase
    .from("catalog_products")
    .select(
      "id, name, name_hi, name_te, category_id, description, description_hi, description_te, mrp, selling_price, reference_price, discount_percent, gst_rate, image_url, stock_quantity, is_eco, categories(id, name, sector_id, gst_rate), product_variants(id, product_id, variant_label, variant_price, variant_stock, weight_unit)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as CatalogProduct;
}

/** Paise to rupees (for display). DB stores paise (₹1 = 100). */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Format INR with locale. */
export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(paise / 100);
}
