/**
 * Rental Income: vendor monthly transaction volume (paid customer_orders) and payout history.
 * Volume = sum of customer_orders.total where status = 'paid', current calendar month.
 */

import { supabase } from "./supabase";
import { getIncentive } from "./rentalIncomeSlabs";
import { creditVendorCashWallet } from "./vendorCashWallet";

export interface RentalPayoutRow {
  id: string;
  vendor_id: string;
  month: string;
  transaction_volume: number;
  incentive_amount: number;
  status: "pending" | "paid";
  paid_at: string | null;
  created_at: string;
}

/** Current calendar month as YYYY-MM. */
export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Start of month ISO string (e.g. 2026-02-01T00:00:00.000Z). */
function monthStart(YYYYMM: string): string {
  return `${YYYYMM}-01T00:00:00.000Z`;
}

/** End of month ISO string. */
function monthEnd(YYYYMM: string): string {
  const [y, m] = YYYYMM.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${YYYYMM}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;
}

/**
 * Sum of paid order totals for the given vendor in the given calendar month.
 * Uses customer_orders (vendor_id, status = 'paid', created_at in month).
 */
export async function getVendorMonthlyVolume(
  vendorId: string,
  yearMonth?: string
): Promise<number> {
  const month = yearMonth ?? getCurrentMonthKey();
  const start = monthStart(month);
  const end = monthEnd(month);

  const { data, error } = await supabase
    .from("customer_orders")
    .select("total")
    .eq("vendor_id", vendorId)
    .eq("status", "paid")
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) return 0;
  const rows = (data ?? []) as { total: number }[];
  return rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
}

/**
 * Rental payout history for a vendor (from vendor_rental_payouts table).
 * Returns last 6 months; empty if table does not exist or no rows.
 */
export async function getRentalPayoutHistory(
  vendorId: string,
  limit = 6
): Promise<RentalPayoutRow[]> {
  const { data, error } = await supabase
    .from("vendor_rental_payouts")
    .select("id, vendor_id, month, transaction_volume, incentive_amount, status, paid_at, created_at")
    .eq("vendor_id", vendorId)
    .order("month", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as RentalPayoutRow[];
}

export interface RentalIncomeSummary {
  month: string;
  volume: number;
  tierLabel: string;
  payout: number;
  nextTierAt: number | null;
  nextTierPayout: number | null;
}

/**
 * Get current month volume and computed tier/payout (no DB table needed for current month).
 */
export async function getRentalIncomeSummary(
  vendorId: string
): Promise<RentalIncomeSummary> {
  const month = getCurrentMonthKey();
  const volume = await getVendorMonthlyVolume(vendorId, month);
  const { tierLabel, payout, nextTierAt, nextTierPayout } = getIncentive(volume);
  return {
    month,
    volume,
    tierLabel,
    payout,
    nextTierAt,
    nextTierPayout,
  };
}

/** Admin: list all rental payouts (for admin UI). RLS restricts to admins. */
export async function getAdminRentalPayouts(limit = 50): Promise<RentalPayoutRow[]> {
  const { data, error } = await supabase
    .from("vendor_rental_payouts")
    .select("id, vendor_id, month, transaction_volume, incentive_amount, status, paid_at, created_at")
    .order("month", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as RentalPayoutRow[];
}

/**
 * Admin: mark a rental payout as paid — credits amount to vendor's Cash Wallet, then sets status=paid.
 * Idempotent: if already paid, does not credit again.
 */
export async function markRentalPayoutPaid(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: row, error: fetchError } = await supabase
    .from("vendor_rental_payouts")
    .select("vendor_id, month, incentive_amount, status")
    .eq("id", id)
    .single();
  if (fetchError || !row) return { ok: false, error: fetchError?.message ?? "Payout not found" };
  const r = row as { vendor_id: string; month: string; incentive_amount: number; status: string };
  if (r.status === "paid") return { ok: true };
  const amount = Number(r.incentive_amount ?? 0);
  if (amount <= 0) {
    const { error: updateErr } = await supabase
      .from("vendor_rental_payouts")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    return updateErr ? { ok: false, error: updateErr.message } : { ok: true };
  }
  const creditRes = await creditVendorCashWallet(
    r.vendor_id,
    amount,
    `Rental income for ${r.month}`
  );
  if (!creditRes.ok) return creditRes;
  const { error: updateError } = await supabase
    .from("vendor_rental_payouts")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true };
}

/**
 * Admin: create or update rental payout row for a vendor/month.
 * Computes volume from customer_orders and payout from slabs; upserts vendor_rental_payouts.
 */
export async function upsertRentalPayoutForVendor(
  vendorId: string,
  yearMonth: string
): Promise<{ ok: boolean; error?: string }> {
  const volume = await getVendorMonthlyVolume(vendorId, yearMonth);
  const { payout } = getIncentive(volume);
  const { error } = await supabase.from("vendor_rental_payouts").upsert(
    {
      vendor_id: vendorId,
      month: yearMonth,
      transaction_volume: volume,
      incentive_amount: payout,
      status: "pending",
    },
    { onConflict: "vendor_id,month" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
