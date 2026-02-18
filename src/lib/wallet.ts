import { supabase } from "./supabase";

export interface WalletBalance {
  id: string;
  balance: number;
}

export interface WalletTransaction {
  id: string;
  customer_id: string;
  type: "credit" | "debit" | "redemption";
  amount: number;
  description: string | null;
  order_id: string | null;
  created_at: string;
}

export interface Redemption {
  id: string;
  customer_id: string;
  type: "cash" | "coupon" | "cashback";
  amount: number;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoinsConfig {
  id: string;
  scenario: string;
  coins_per_payment: number;
  coins_to_rupees: number;
  description: string | null;
}

/** Get or create wallet balance for customer. */
export async function getWalletBalance(customerId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_or_create_wallet", { p_customer_id: customerId });
  if (error) return 0;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.balance != null ? Number(row.balance) : 0;
}

/** Award coins for order (credit wallet). Returns new balance. */
export async function awardCoinsForOrder(
  orderId: string,
  customerId: string,
  coins?: number
): Promise<{ ok: boolean; newBalance?: number; error?: string }> {
  const c = coins ?? (await getCoinsPerPayment());
  const { data, error } = await supabase.rpc("award_coins_for_order", {
    p_order_id: orderId,
    p_customer_id: customerId,
    p_coins: c,
  });
  if (error) return { ok: false, error: error.message };
  const res = data as { ok?: boolean; new_balance?: number; error?: string } | null;
  if (!res?.ok) return { ok: false, error: res?.error ?? "Failed" };
  return { ok: true, newBalance: res.new_balance != null ? Number(res.new_balance) : undefined };
}

/** Debit wallet for order (when customer uses wallet at checkout). */
export async function debitWalletForOrder(
  customerId: string,
  orderId: string,
  amount: number
): Promise<{ ok: boolean; error?: string }> {
  if (amount <= 0) return { ok: true };
  const { data, error } = await supabase.rpc("debit_wallet_for_order", {
    p_customer_id: customerId,
    p_order_id: orderId,
    p_amount: amount,
  });
  if (error) return { ok: false, error: error.message };
  const res = data as { ok?: boolean; error?: string } | null;
  if (!res?.ok) return { ok: false, error: res?.error ?? "Insufficient balance" };
  return { ok: true };
}

/** Get coins per payment from config (default 2). */
export async function getCoinsPerPayment(): Promise<number> {
  const { data, error } = await supabase
    .from("coins_config")
    .select("coins_per_payment")
    .eq("scenario", "default")
    .single();
  if (error || !data) return 2;
  return Number(data.coins_per_payment) || 2;
}

/** Get wallet transactions for customer (paginated). */
export async function getWalletTransactions(
  customerId: string,
  opts?: { limit?: number; offset?: number; type?: "credit" | "debit" }
): Promise<WalletTransaction[]> {
  let q = supabase
    .from("wallet_transactions")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (opts?.type) q = q.eq("type", opts.type);
  if (opts?.limit) q = q.limit(opts.limit);
  if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as WalletTransaction[];
}

/** Create redemption request. */
export async function createRedemption(
  customerId: string,
  type: "cash" | "coupon" | "cashback",
  amount: number
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase
    .from("redemptions")
    .insert({ customer_id: customerId, type, amount, status: "pending" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

/** Get customer redemptions. */
export async function getCustomerRedemptions(customerId: string): Promise<Redemption[]> {
  const { data, error } = await supabase
    .from("redemptions")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Redemption[];
}

/** Admin: Get all redemptions (pending first). */
export async function getAdminRedemptions(): Promise<(Redemption & { customer_phone?: string })[]> {
  const { data, error } = await supabase
    .from("redemptions")
    .select("*")
    .order("status")
    .order("created_at", { ascending: false });
  if (error) return [];
  const list = (data ?? []) as Redemption[];
  const customerIds = [...new Set(list.map((r) => r.customer_id))];
  const { data: profiles } = await supabase
    .from("customer_profiles")
    .select("id, phone")
    .in("id", customerIds);
  const phoneMap: Record<string, string> = {};
  (profiles ?? []).forEach((p: { id: string; phone: string }) => {
    phoneMap[p.id] = p.phone;
  });
  return list.map((r) => ({ ...r, customer_phone: phoneMap[r.customer_id] }));
}

/** Admin: Approve redemption (debits wallet). */
export async function approveRedemption(redemptionId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("approve_redemption", { p_redemption_id: redemptionId });
  if (error) return { ok: false, error: error.message };
  const res = data as { ok?: boolean; error?: string } | null;
  if (!res?.ok) return { ok: false, error: res?.error ?? "Failed" };
  return { ok: true };
}

/** Admin: Reject redemption. */
export async function rejectRedemption(redemptionId: string, notes?: string): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from("redemptions")
    .update({ status: "rejected", admin_notes: notes ?? null, updated_at: new Date().toISOString() })
    .eq("id", redemptionId);
  return { ok: !error };
}

/** Admin: Get coins config. */
export async function getCoinsConfig(): Promise<CoinsConfig[]> {
  const { data, error } = await supabase.from("coins_config").select("*").order("scenario");
  if (error) return [];
  return (data ?? []) as CoinsConfig[];
}

/** Admin: Update coins config (coins_per_payment and/or coins_to_rupees). */
export async function updateCoinsConfig(
  scenario: string,
  updates: { coins_per_payment?: number; coins_to_rupees?: number }
): Promise<{ ok: boolean }> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.coins_per_payment != null) payload.coins_per_payment = updates.coins_per_payment;
  if (updates.coins_to_rupees != null) payload.coins_to_rupees = updates.coins_to_rupees;
  const { error } = await supabase
    .from("coins_config")
    .update(payload)
    .eq("scenario", scenario);
  return { ok: !error };
}
