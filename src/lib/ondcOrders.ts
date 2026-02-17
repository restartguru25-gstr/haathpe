import { supabase } from "./supabase";

export interface OndcOrder {
  id: string;
  ondc_transaction_id: string | null;
  vendor_id: string;
  items: Array<{ item_name: string; qty: number; price?: number }>;
  total: number;
  platform_fee: number;
  vendor_amount: number;
  razorpay_fee: number;
  buyer_app: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  status: string;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  payout_id: string | null;
  created_at: string;
}

export async function getOndcOrdersForVendor(vendorId: string): Promise<OndcOrder[]> {
  const { data, error } = await supabase
    .from("ondc_orders")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as OndcOrder[];
}

export async function getOndcOrdersForAdmin(): Promise<OndcOrder[]> {
  const { data, error } = await supabase
    .from("ondc_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data ?? []) as OndcOrder[];
}

export interface PlatformFeeConfig {
  id: string;
  fee_percent: number;
}

export async function getPlatformFeeConfig(): Promise<PlatformFeeConfig | null> {
  const { data, error } = await supabase
    .from("platform_fee_config")
    .select("id, fee_percent")
    .limit(1)
    .single();
  if (error || !data) return null;
  return data as PlatformFeeConfig;
}

export async function updatePlatformFee(feePercent: number): Promise<{ ok: boolean; error?: string }> {
  const { data: row } = await supabase.from("platform_fee_config").select("id").limit(1).single();
  if (!row?.id) {
    const { error: ins } = await supabase.from("platform_fee_config").insert({ fee_percent: feePercent });
    return ins ? { ok: false, error: ins.message } : { ok: true };
  }
  const { error } = await supabase
    .from("platform_fee_config")
    .update({ fee_percent: feePercent, updated_at: new Date().toISOString() })
    .eq("id", row.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
