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
  coins?: number;
  is_bonus?: boolean;
  description: string | null;
  order_id: string | null;
  created_at: string;
}

export interface SignupBonusStatus {
  credited: boolean;
  credited_at: string | null;
  expires_at: string | null;
  bonus_remaining: number;
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

/** Get wallet balance and coins. */
export async function getWalletBalanceAndCoins(customerId: string): Promise<{ balance: number; coins: number }> {
  const { data, error } = await supabase.rpc("get_or_create_wallet", { p_customer_id: customerId });
  if (error) return { balance: 0, coins: 0 };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    balance: row?.balance != null ? Number(row.balance) : 0,
    coins: row?.coins != null ? Number(row.coins) : 0,
  };
}

/** Ensure signup bonus is credited (idempotent). Returns status + whether it was newly credited. */
export async function ensureCustomerSignupBonus(customerId: string): Promise<{
  ok: boolean;
  credited?: boolean;
  amount?: number;
  balance?: number;
  bonus_remaining?: number;
  credited_at?: string | null;
  expires_at?: string | null;
  error?: string;
}> {
  const { data, error } = await supabase.rpc("ensure_customer_signup_bonus", { p_customer_id: customerId });
  if (error) return { ok: false, error: error.message };
  const res = data as
    | {
        ok?: boolean;
        credited?: boolean;
        amount?: number;
        balance?: number;
        bonus_remaining?: number;
        credited_at?: string | null;
        expires_at?: string | null;
        error?: string;
      }
    | null;
  if (!res?.ok) return { ok: false, error: res?.error ?? "Failed" };
  return {
    ok: true,
    credited: !!res.credited,
    amount: res.amount != null ? Number(res.amount) : undefined,
    balance: res.balance != null ? Number(res.balance) : undefined,
    bonus_remaining: res.bonus_remaining != null ? Number(res.bonus_remaining) : undefined,
    credited_at: res.credited_at ?? null,
    expires_at: res.expires_at ?? null,
  };
}

/** Read signup bonus fields from wallet (best-effort; requires SELECT on own wallet). */
export async function getCustomerSignupBonusStatus(customerId: string): Promise<SignupBonusStatus> {
  const { data, error } = await supabase
    .from("customer_wallets")
    .select("signup_bonus_credited, signup_bonus_credited_at, bonus_remaining")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error || !data) {
    return { credited: false, credited_at: null, expires_at: null, bonus_remaining: 0 };
  }
  const credited = !!(data as { signup_bonus_credited?: boolean }).signup_bonus_credited;
  const credited_at = (data as { signup_bonus_credited_at?: string | null }).signup_bonus_credited_at ?? null;
  const bonus_remaining = Number((data as { bonus_remaining?: number }).bonus_remaining ?? 0);
  const expires_at = credited_at ? new Date(new Date(credited_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
  return { credited, credited_at, expires_at, bonus_remaining };
}

/** Use ₹5 signup bonus for an order (server enforces eligibility + 30-day validity + remaining uses). */
export async function applyCustomerSignupBonusForOrder(orderId: string): Promise<{
  ok: boolean;
  used?: boolean;
  balance?: number;
  bonus_remaining?: number;
  expires_at?: string | null;
  error?: string;
}> {
  const { data, error } = await supabase.rpc("use_customer_signup_bonus_for_order", { p_order_id: orderId });
  if (error) return { ok: false, error: error.message };
  const res = data as
    | { ok?: boolean; used?: boolean; balance?: number; bonus_remaining?: number; expires_at?: string | null; error?: string }
    | null;
  if (!res?.ok) return { ok: false, error: res?.error ?? "Failed" };
  return {
    ok: true,
    used: !!res.used,
    balance: res.balance != null ? Number(res.balance) : undefined,
    bonus_remaining: res.bonus_remaining != null ? Number(res.bonus_remaining) : undefined,
    expires_at: res.expires_at ?? null,
  };
}

/** Award coins for a paid order (idempotent; works for orders + customer_orders). Call from client when payment success. */
export async function awardCoinsForPaidOrder(orderId: string): Promise<{
  ok: boolean;
  coins?: number;
  cashback?: number;
  error?: string;
}> {
  const { data, error } = await supabase.rpc("award_coins_for_paid_order", { p_order_id: orderId });
  if (error) return { ok: false, error: error.message };
  const res = data as { ok?: boolean; coins?: number; cashback?: number; error?: string } | null;
  if (!res?.ok) return { ok: false, error: res?.error ?? "Already awarded or invalid" };
  return {
    ok: true,
    coins: res.coins != null ? Number(res.coins) : undefined,
    cashback: res.cashback != null ? Number(res.cashback) : undefined,
  };
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

export async function getAdminCustomerBonuses(limit = 200): Promise<
  {
    customer_id: string;
    customer_phone?: string;
    customer_name?: string | null;
    balance: number;
    coins: number;
    signup_bonus_credited: boolean;
    signup_bonus_credited_at: string | null;
    bonus_remaining: number;
  }[]
> {
  const { data, error } = await supabase
    .from("customer_wallets")
    .select("customer_id, balance, coins, signup_bonus_credited, signup_bonus_credited_at, bonus_remaining, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  const list = (data ?? []) as {
    customer_id: string;
    balance: number;
    coins: number;
    signup_bonus_credited: boolean;
    signup_bonus_credited_at: string | null;
    bonus_remaining: number;
  }[];
  const ids = [...new Set(list.map((r) => r.customer_id))];
  const { data: profiles } = await supabase
    .from("customer_profiles")
    .select("id, phone, name")
    .in("id", ids);
  const phoneMap: Record<string, { phone?: string; name?: string | null }> = {};
  (profiles ?? []).forEach((p: { id: string; phone: string; name?: string | null }) => {
    phoneMap[p.id] = { phone: p.phone, name: p.name ?? null };
  });
  return list.map((r) => ({
    ...r,
    balance: Number(r.balance ?? 0),
    coins: Number(r.coins ?? 0),
    bonus_remaining: Number(r.bonus_remaining ?? 0),
    signup_bonus_credited: !!r.signup_bonus_credited,
    signup_bonus_credited_at: r.signup_bonus_credited_at ?? null,
    customer_phone: phoneMap[r.customer_id]?.phone,
    customer_name: phoneMap[r.customer_id]?.name ?? null,
  }));
}
