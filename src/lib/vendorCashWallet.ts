/**
 * Vendor cash wallet: signup bonus, rewards, withdrawals.
 * RLS on vendor_cash_wallets and vendor_cash_transactions.
 */

import { supabase } from "./supabase";

export interface VendorCashWallet {
  id: string;
  vendor_id: string;
  balance: number;
  updated_at: string;
}

export interface VendorCashTransaction {
  id: string;
  vendor_id: string;
  type: "credit" | "debit" | "withdrawal_request";
  amount: number;
  description: string | null;
  status: "success" | "pending" | "rejected";
  created_at: string;
}

export interface VendorSettings {
  id: string;
  signup_bonus_amount: number;
  min_withdrawal_amount: number;
  updated_at: string;
}

const VENDOR_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

/** Get vendor wallet (balance). */
export async function getVendorWallet(
  vendorId: string
): Promise<VendorCashWallet | null> {
  try {
    const { data, error } = await supabase
      .from("vendor_cash_wallets")
      .select("*")
      .eq("vendor_id", vendorId)
      .maybeSingle();
    if (error) return null;
    return data as VendorCashWallet;
  } catch {
    return null;
  }
}

/** Get recent transactions for vendor. */
export async function getVendorCashTransactions(
  vendorId: string,
  limit = 20
): Promise<VendorCashTransaction[]> {
  try {
    const { data, error } = await supabase
      .from("vendor_cash_transactions")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as VendorCashTransaction[];
  } catch {
    return [];
  }
}

/** Get vendor_settings (admin). */
export async function getVendorSettings(): Promise<VendorSettings | null> {
  try {
    const { data, error } = await supabase
      .from("vendor_settings")
      .select("*")
      .eq("id", VENDOR_SETTINGS_ID)
      .maybeSingle();
    if (error) return null;
    return data as VendorSettings;
  } catch {
    return null;
  }
}

/** Update vendor_settings (admin). */
export async function updateVendorSettings(
  values: { signup_bonus_amount?: number; min_withdrawal_amount?: number }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload: Record<string, number> = {};
    if (typeof values.signup_bonus_amount === "number") {
      payload.signup_bonus_amount = values.signup_bonus_amount;
    }
    if (typeof values.min_withdrawal_amount === "number") {
      payload.min_withdrawal_amount = values.min_withdrawal_amount;
    }
    if (Object.keys(payload).length === 0) return { ok: true };
    const { error } = await supabase
      .from("vendor_settings")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", VENDOR_SETTINGS_ID);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}

/** Ensure vendor has wallet with signup bonus (idempotent). Call on first profile activation. */
export async function ensureVendorWalletWithSignupBonus(
  vendorId: string
): Promise<{ ok: boolean; bonusAwarded?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("ensure_vendor_cash_wallet_with_signup_bonus", {
      p_vendor_id: vendorId,
    });
    if (error) return { ok: false, error: error.message };
    const res = data as { ok?: boolean; bonus_awarded?: number; error?: string };
    if (!res?.ok) return { ok: false, error: res?.error ?? "Failed" };
    return { ok: true, bonusAwarded: res.bonus_awarded };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Credit reward to vendor (for referral, daily 100, etc.). */
export async function creditVendorCashWallet(
  vendorId: string,
  amount: number,
  description: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("credit_vendor_cash_wallet", {
      p_vendor_id: vendorId,
      p_amount: amount,
      p_description: description,
    });
    if (error) return { ok: false, error: error.message };
    const res = data as { ok?: boolean; error?: string };
    if (!res?.ok) return { ok: false, error: res?.error ?? "Failed" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Request withdrawal (stub). */
export async function requestVendorWithdrawal(
  vendorId: string
): Promise<{ ok: boolean; amount?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("request_vendor_cash_withdrawal", {
      p_vendor_id: vendorId,
    });
    if (error) return { ok: false, error: error.message };
    const res = data as { ok?: boolean; amount?: number; error?: string };
    if (!res?.ok) return { ok: false, error: res?.error ?? "Failed" };
    return { ok: true, amount: res.amount };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
