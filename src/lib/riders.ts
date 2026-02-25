/**
 * Riders: 2/3/4-wheeler partners (Rapido/Ola-style).
 * Signup, dashboard, monthly rental, withdrawals, admin.
 */

import { supabase } from "./supabase";

const PHONE_PREFIX = "+91";

/** Send OTP to rider phone (E.164). */
export async function sendRiderOtp(phone: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Verify OTP and return; does not create customer profile. */
export async function verifyRiderOtp(
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
  return { ok: true };
}

export const RIDER_VEHICLE_TYPES = ["2-wheelers", "3-wheelers", "4-wheelers"] as const;
export type RiderVehicleType = (typeof RIDER_VEHICLE_TYPES)[number];

export interface Rider {
  id: string;
  phone: string;
  auth_user_id: string | null;
  vehicle_type: string;
  qr_code_text: string;
  verified: boolean;
  balance: number;
  secure_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiderTransaction {
  id: string;
  rider_id: string;
  type: "rental_credit" | "withdrawal" | "adjustment";
  amount: number;
  balance_after: number | null;
  description: string | null;
  month_key: string | null;
  scans_count: number | null;
  created_at: string;
}

export interface RiderSettingsRow {
  id: string;
  vehicle_type: string;
  base_rental: number;
  bonus_percent: number;
  min_withdrawal: number;
  updated_at: string;
}

/** Get current rider by auth (for dashboard). */
export async function getRiderByAuth(): Promise<Rider | null> {
  const { data, error } = await supabase.rpc("get_rider_by_auth");
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as Rider;
}

/** After OTP verified: upsert rider (phone, vehicle_type). */
export async function upsertRiderAfterSignup(
  phone: string,
  vehicleType: RiderVehicleType,
  qrCodeText?: string | null
): Promise<{ ok: boolean; rider_id?: string; is_new?: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("upsert_rider_after_signup", {
    p_phone: phone,
    p_vehicle_type: vehicleType,
    p_qr_code_text: qrCodeText ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as { ok?: boolean; rider_id?: string; is_new?: boolean; error?: string };
  if (obj?.ok === false) return { ok: false, error: obj.error ?? "Failed" };
  return {
    ok: true,
    rider_id: obj?.rider_id,
    is_new: obj?.is_new,
  };
}

/** Rider transactions (for dashboard). */
export async function getRiderTransactions(
  riderId: string,
  limit = 30
): Promise<RiderTransaction[]> {
  const { data, error } = await supabase
    .from("rider_transactions")
    .select("*")
    .eq("rider_id", riderId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as RiderTransaction[];
}

/** Scans count for current month (for dashboard stats). */
export async function getRiderScansThisMonth(riderId: string): Promise<number> {
  const monthKey = new Date().toISOString().slice(0, 7);
  const { data, error } = await supabase.rpc("get_rider_scans_count", {
    p_rider_id: riderId,
    p_month_key: monthKey,
  });
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

/** Request withdrawal (balance must be >= min_withdrawal from settings). */
export async function riderRequestWithdrawal(
  riderId: string,
  amount: number
): Promise<{ ok: boolean; balance_after?: number; error?: string }> {
  const { data, error } = await supabase.rpc("rider_request_withdrawal", {
    p_rider_id: riderId,
    p_amount: amount,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as { ok?: boolean; balance_after?: number; error?: string };
  if (obj?.ok === false) return { ok: false, error: obj.error ?? "Failed" };
  return {
    ok: true,
    balance_after: obj?.balance_after,
  };
}

/** Admin: list riders */
export async function getAdminRiders(limit = 100): Promise<Partial<Rider>[]> {
  const { data, error } = await supabase.rpc("get_admin_riders", { p_limit: limit });
  if (error) return [];
  return (data ?? []) as Partial<Rider>[];
}

/** Admin: set rider verified */
export async function adminSetRiderVerified(
  riderId: string,
  verified: boolean
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("admin_set_rider_verified", {
    p_rider_id: riderId,
    p_verified: verified,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as { ok?: boolean };
  return { ok: obj?.ok !== false };
}

/** Admin: run monthly payout for all riders */
export async function adminRunRiderMonthlyPayout(
  monthKey?: string | null
): Promise<{ ok: boolean; month?: string; riders_processed?: number; riders_credited?: number; error?: string }> {
  const { data, error } = await supabase.rpc("admin_run_rider_monthly_payout", {
    p_month_key: monthKey ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as { ok?: boolean; month?: string; riders_processed?: number; riders_credited?: number };
  return {
    ok: obj?.ok !== false,
    month: obj?.month,
    riders_processed: obj?.riders_processed,
    riders_credited: obj?.riders_credited,
  };
}

/** Admin: get rider settings */
export async function getRiderSettings(): Promise<RiderSettingsRow[]> {
  const { data, error } = await supabase.from("rider_settings").select("*").order("vehicle_type");
  if (error) return [];
  return (data ?? []) as RiderSettingsRow[];
}

/** Admin: update rider settings for a vehicle type */
export async function adminUpdateRiderSettings(
  vehicleType: string,
  updates: { base_rental?: number; bonus_percent?: number; min_withdrawal?: number }
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("admin_update_rider_settings", {
    p_vehicle_type: vehicleType,
    p_base_rental: updates.base_rental ?? null,
    p_bonus_percent: updates.bonus_percent ?? null,
    p_min_withdrawal: updates.min_withdrawal ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as { ok?: boolean };
  return { ok: obj?.ok !== false };
}

/** Generate QR link for rider (customers scan; rider param = qr_code_text for resolution). */
export function getRiderQrLink(riderId: string, qrCodeText: string, baseUrl?: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : baseUrl ?? "";
  return `${origin}/search?rider=${encodeURIComponent(qrCodeText)}`;
}

/** Resolve rider_id from qr_code_text (for order attribution). */
export async function getRiderIdByQrCode(qrCodeText: string | null): Promise<string | null> {
  if (!qrCodeText?.trim()) return null;
  const { data, error } = await supabase
    .from("riders")
    .select("id")
    .eq("qr_code_text", qrCodeText.trim())
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}
