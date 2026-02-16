import { supabase } from "./supabase";

export interface IncentiveSlab {
  id: string;
  slab_type: "daily" | "monthly";
  min_count: number;
  max_count: number | null;
  reward_amount: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
}

export interface VendorIncentive {
  id: string;
  vendor_id: string;
  slab_date: string;
  slab_type: "daily" | "monthly" | "referral";
  entry_count: number;
  earned_amount: number;
  status: "pending" | "paid";
  draw_eligible: boolean;
  referred_vendor_id?: string | null;
  created_at: string;
}

/** Get incentive slabs for display. */
export async function getIncentiveSlabs(): Promise<IncentiveSlab[]> {
  const { data, error } = await supabase
    .from("incentive_slabs")
    .select("*")
    .eq("is_active", true)
    .order("slab_type")
    .order("min_count");
  if (error) return [];
  return (data ?? []) as IncentiveSlab[];
}

/** Admin: Get all vendor incentives. */
export async function getAdminVendorIncentives(): Promise<VendorIncentive[]> {
  const { data, error } = await supabase
    .from("vendor_incentives")
    .select("*")
    .order("slab_date", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data ?? []) as VendorIncentive[];
}

/** Get vendor's incentive history. */
export async function getVendorIncentives(vendorId: string): Promise<VendorIncentive[]> {
  const { data, error } = await supabase
    .from("vendor_incentives")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("slab_date", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as VendorIncentive[];
}

/** Get today's entry count for a vendor (customer_orders count today). */
export async function getTodayEntryCount(vendorId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from("customer_orders")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", vendorId)
    .gte("created_at", `${today}T00:00:00`)
    .lt("created_at", `${today}T23:59:59.999`);
  if (error) return 0;
  return count ?? 0;
}

/** Get potential reward for a given entry count (from daily slabs). */
export function getPotentialRewardForCount(slabs: IncentiveSlab[], entryCount: number): number {
  const daily = slabs.filter((s) => s.slab_type === "daily");
  for (let i = daily.length - 1; i >= 0; i--) {
    const s = daily[i];
    if (entryCount >= s.min_count && (s.max_count == null || entryCount <= s.max_count)) {
      return Number(s.reward_amount);
    }
  }
  return 0;
}

/** Admin: Run daily incentive calc. */
export async function runDailyIncentiveCalc(): Promise<{ ok: boolean; count?: number; error?: string }> {
  const { data, error } = await supabase.rpc("run_daily_incentive_calc");
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; count?: number; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error ?? "Calc failed" };
  return { ok: true, count: result.count ?? 0 };
}

/** Set referrer for current user (call after signup with ?ref=UUID). */
export async function setMyReferrer(referrerId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("set_my_referrer", { p_referrer_id: referrerId });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; error?: string };
  return result?.ok ? { ok: true } : { ok: false, error: result?.error };
}

/** Admin: Run referral bonus calc (₹100 per referred vendor who hits 100 entries). */
export async function runReferralBonusCalc(): Promise<{ ok: boolean; count?: number; error?: string }> {
  const { data, error } = await supabase.rpc("run_referral_bonus_calc");
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; count?: number; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error ?? "Calc failed" };
  return { ok: true, count: result.count ?? 0 };
}

/** Admin: Get all incentive slabs (including inactive). */
export async function getAllIncentiveSlabs(): Promise<IncentiveSlab[]> {
  const { data, error } = await supabase
    .from("incentive_slabs")
    .select("*")
    .order("slab_type")
    .order("min_count");
  if (error) return [];
  return (data ?? []) as IncentiveSlab[];
}

/** Admin: Upsert incentive slab. */
export async function upsertIncentiveSlab(
  slab: Partial<IncentiveSlab> & {
    slab_type: "daily" | "monthly";
    min_count: number;
    max_count: number | null;
    reward_amount: number;
  }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const payload = {
    slab_type: slab.slab_type,
    min_count: slab.min_count,
    max_count: slab.max_count,
    reward_amount: slab.reward_amount,
    is_active: slab.is_active ?? true,
    description: slab.description ?? null,
  };
  if (slab.id) {
    const { error } = await supabase.from("incentive_slabs").update(payload).eq("id", slab.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: slab.id };
  }
  const { data, error } = await supabase.from("incentive_slabs").insert(payload).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

/** Admin: Delete incentive slab. */
export async function deleteIncentiveSlab(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("incentive_slabs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Admin: Get vendors eligible for draw. */
export async function getEligibleForDraw(): Promise<VendorIncentive[]> {
  const { data, error } = await supabase
    .from("vendor_incentives")
    .select("*")
    .eq("draw_eligible", true)
    .order("slab_date", { ascending: false });
  if (error) return [];
  return (data ?? []) as VendorIncentive[];
}

/** Get vendor earnings in last 7 days. */
export async function getLast7DaysEarnings(vendorId: string): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data, error } = await supabase
    .from("vendor_incentives")
    .select("earned_amount")
    .eq("vendor_id", vendorId)
    .gte("slab_date", sevenDaysAgo.toISOString().slice(0, 10));
  if (error) return 0;
  return (data ?? []).reduce((sum, r) => sum + Number(r.earned_amount ?? 0), 0);
}

/** Get vendor total earnings this month. */
export async function getThisMonthEarnings(vendorId: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  const { data, error } = await supabase
    .from("vendor_incentives")
    .select("earned_amount")
    .eq("vendor_id", vendorId)
    .gte("slab_date", start.toISOString().slice(0, 10));
  if (error) return 0;
  return (data ?? []).reduce((sum, r) => sum + Number(r.earned_amount ?? 0), 0);
}

/** Request payout (withdraw from available_balance). */
export async function requestPayout(amount: number): Promise<{ ok: boolean; new_balance?: number; error?: string }> {
  if (amount <= 0) return { ok: false, error: "Invalid amount" };
  const { data, error } = await supabase.rpc("request_payout", { p_amount: amount });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; new_balance?: number; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error ?? "Payout failed" };
  return { ok: true, new_balance: result.new_balance };
}

/** Admin: Run monthly draw. */
export async function runMonthlyDraw(): Promise<{ ok: boolean; winner_id?: string; winner_name?: string; error?: string }> {
  const { data, error } = await supabase.rpc("run_monthly_draw");
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; winner_id?: string; winner_name?: string; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error ?? "Draw failed" };
  return { ok: true, winner_id: result.winner_id, winner_name: result.winner_name };
}
