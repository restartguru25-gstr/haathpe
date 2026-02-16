import { supabase } from "./supabase";

export interface Ad {
  id: string;
  image_url: string;
  brand_name: string;
  title?: string | null;
  link_url: string | null;
  zone: string;
  is_active: boolean;
  priority: number;
  impressions_count?: number | null;
  clicks_count?: number | null;
  created_at: string;
}

/** Admin: Get all ads. */
export async function getAdminAds(): Promise<Ad[]> {
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .order("priority", { ascending: false });
  if (error) return [];
  return (data ?? []) as Ad[];
}

/** Get a random active ad for a zone (vendor's zone or 'general'). */
export async function getRandomAd(vendorZone?: string | null): Promise<Ad | null> {
  const zones = vendorZone ? [vendorZone, "general"] : ["general"];
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .eq("is_active", true)
    .in("zone", zones)
    .order("priority", { ascending: false });
  if (error || !data || data.length === 0) return null;
  const idx = Math.floor(Math.random() * data.length);
  return data[idx] as Ad;
}

/** Record ad impression (view or click). */
export async function recordAdImpression(
  adId: string,
  action: "view" | "click",
  opts?: { vendorId?: string | null; customerPhone?: string | null; page?: string | null; sessionId?: string | null }
): Promise<void> {
  await supabase.from("ad_impressions").insert({
    ad_id: adId,
    vendor_id: opts?.vendorId ?? null,
    customer_phone: opts?.customerPhone ?? null,
    action,
    page: opts?.page ?? null,
    session_id: opts?.sessionId ?? null,
  });
}

/** Get or create session ID for ad analytics. */
export function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return crypto.randomUUID?.() ?? String(Date.now());
  let sid = sessionStorage.getItem("ad_session_id");
  if (!sid) {
    sid = crypto.randomUUID?.() ?? String(Date.now());
    sessionStorage.setItem("ad_session_id", sid);
  }
  return sid;
}

/** Admin: Upsert ad. */
export async function upsertAd(
  ad: Partial<Ad> & {
    brand_name: string;
    image_url: string;
    zone: string;
  }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const payload = {
    brand_name: ad.brand_name,
    image_url: ad.image_url,
    title: ad.title ?? null,
    link_url: ad.link_url ?? null,
    zone: ad.zone,
    is_active: ad.is_active ?? true,
    priority: ad.priority ?? 0,
  };
  if (ad.id) {
    const { error } = await supabase.from("ads").update(payload).eq("id", ad.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: ad.id };
  }
  const { data, error } = await supabase.from("ads").insert(payload).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

/** Admin: Delete ad. */
export async function deleteAd(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Admin: Upload ad image to storage. */
export async function uploadAdImage(file: File): Promise<{ url: string; error?: string }> {
  if (!file.type.startsWith("image/")) return { url: "", error: "Select an image" };
  const ext = file.name.split(".").pop() || "jpg";
  const path = `ads/${Date.now()}_${crypto.randomUUID?.()?.slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from("ad-images").upload(path, file, { upsert: true });
  if (error) return { url: "", error: error.message };
  const { data } = supabase.storage.from("ad-images").getPublicUrl(path);
  return { url: data.publicUrl };
}
