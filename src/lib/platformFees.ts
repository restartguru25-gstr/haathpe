import { supabase } from "./supabase";

export type FeeType = "percentage" | "fixed" | "slab";

export interface PlatformFee {
  id: string;
  vendor_id: string;
  fee_type: FeeType;
  fee_value: number;
  min_order_value: number;
  slabs: { min_order_value: number; fee_value: number }[] | null;
  is_exempt: boolean;
  effective_from: string;
  created_at: string;
}

export interface PlatformFeeWithVendor extends PlatformFee {
  vendor_name: string | null;
  stall_type: string | null;
}

export interface FeeSummary {
  total_fee: number;
  order_count: number;
}

export interface CalculatedFee {
  platform_fee: number;
  vendor_amount: number;
}

/** Calculate platform fee via RPC (works in client and can be called from Edge Functions via service role). */
export async function calculatePlatformFee(
  vendorId: string,
  orderTotal: number
): Promise<CalculatedFee> {
  const { data, error } = await supabase.rpc("calculate_platform_fee", {
    p_vendor_id: vendorId,
    p_order_total: orderTotal,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    // Fallback: 3% default
    const fee = Math.round((orderTotal * 0.03) * 100) / 100;
    return {
      platform_fee: fee,
      vendor_amount: Math.round((orderTotal - fee) * 100) / 100,
    };
  }
  const row = data[0] as { platform_fee: number; vendor_amount: number };
  return {
    platform_fee: Number(row.platform_fee ?? 0),
    vendor_amount: Number(row.vendor_amount ?? orderTotal),
  };
}

/** Get all vendors with their platform fee settings (admin). Vendors without a fee use default. */
export async function getAllVendorFees(): Promise<PlatformFeeWithVendor[]> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, stall_type")
    .not("stall_type", "is", null)
    .order("name");

  if (!profiles?.length) return [];

  const vendorIds = (profiles as { id: string }[]).map((p) => p.id);
  const { data: fees } = await supabase
    .from("platform_fees")
    .select("*")
    .in("vendor_id", vendorIds);

  const feeMap = new Map<string, PlatformFee>();
  (fees ?? []).forEach((f: PlatformFee) => feeMap.set(f.vendor_id, f));

  return (profiles as { id: string; name: string | null; stall_type: string | null }[]).map(
    (p) => {
      const fee = feeMap.get(p.id);
      return {
        id: fee?.id ?? "",
        vendor_id: p.id,
        fee_type: (fee?.fee_type ?? "percentage") as FeeType,
        fee_value: fee?.fee_value ?? 0,
        min_order_value: fee?.min_order_value ?? 0,
        slabs: fee?.slabs ?? null,
        is_exempt: fee?.is_exempt ?? false,
        effective_from: fee?.effective_from ?? "",
        created_at: fee?.created_at ?? "",
        vendor_name: p.name,
        stall_type: p.stall_type,
      };
    }
  );
}

/** Get all vendors (for dropdown) - those with menu or ONDC. */
export async function getVendorsForFeeAdmin(): Promise<{ id: string; name: string | null; stall_type: string | null }[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, stall_type")
    .not("stall_type", "is", null)
    .order("name");
  if (error) return [];
  return (data ?? []) as { id: string; name: string | null; stall_type: string | null }[];
}

/** Get platform fee for a vendor (for vendor dashboard). */
export async function getVendorPlatformFee(vendorId: string): Promise<PlatformFee | null> {
  const { data, error } = await supabase
    .from("platform_fees")
    .select("*")
    .eq("vendor_id", vendorId)
    .lte("effective_from", new Date().toISOString())
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as PlatformFee;
}

/** Get global default fee % from platform_fee_config. */
export async function getDefaultFeePercent(): Promise<number> {
  const { data } = await supabase
    .from("platform_fee_config")
    .select("fee_percent")
    .limit(1)
    .single();
  return Number((data as { fee_percent?: number } | null)?.fee_percent ?? 3);
}

/** Format fee for display. */
export function formatFeeDisplay(fee: PlatformFee | null, defaultPercent: number): string {
  if (!fee) return `${defaultPercent}%`;
  if (fee.is_exempt) return "Exempt";
  switch (fee.fee_type) {
    case "percentage":
      return `${fee.fee_value}%`;
    case "fixed":
      return `₹${fee.fee_value} fixed`;
    case "slab":
      if (fee.slabs && fee.slabs.length > 0) {
        const parts = fee.slabs
          .sort((a, b) => a.min_order_value - b.min_order_value)
          .map((s) => `≥₹${s.min_order_value}: ₹${s.fee_value}`);
        return `Slab: ${parts.join(", ")}`;
      }
      return `Slab ≥₹${fee.min_order_value}: ₹${fee.fee_value}`;
    default:
      return `${defaultPercent}%`;
  }
}

/** Upsert platform fee for a vendor (admin). */
export async function upsertPlatformFee(
  vendorId: string,
  payload: {
    fee_type: FeeType;
    fee_value: number;
    min_order_value?: number;
    slabs?: { min_order_value: number; fee_value: number }[];
    is_exempt: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("platform_fees").upsert(
    {
      vendor_id: vendorId,
      fee_type: payload.fee_type,
      fee_value: payload.fee_value,
      min_order_value: payload.min_order_value ?? 0,
      slabs: payload.slabs ?? null,
      is_exempt: payload.is_exempt,
      effective_from: new Date().toISOString(),
    },
    { onConflict: "vendor_id" }
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Bulk set default % for vendors without a custom fee. */
export async function bulkSetDefaultPercent(percent: number): Promise<{ ok: boolean; count: number; error?: string }> {
  const { data: vendors } = await supabase.from("profiles").select("id").not("stall_type", "is", null);
  if (!vendors || vendors.length === 0) return { ok: true, count: 0 };

  const { data: existing } = await supabase.from("platform_fees").select("vendor_id");
  const existingIds = new Set((existing ?? []).map((r) => (r as { vendor_id: string }).vendor_id));

  const toInsert = (vendors as { id: string }[])
    .filter((v) => !existingIds.has(v.id))
    .map((v) => ({
      vendor_id: v.id,
      fee_type: "percentage" as const,
      fee_value: percent,
      min_order_value: 0,
      slabs: null,
      is_exempt: false,
    }));

  if (toInsert.length === 0) return { ok: true, count: 0 };

  const { error } = await supabase.from("platform_fees").upsert(toInsert, {
    onConflict: "vendor_id",
    ignoreDuplicates: false,
  });
  return error ? { ok: false, count: 0, error: error.message } : { ok: true, count: toInsert.length };
}

/** Bulk exempt selected vendors. */
export async function bulkExemptVendors(vendorIds: string[]): Promise<{ ok: boolean; error?: string }> {
  if (vendorIds.length === 0) return { ok: true };
  const rows = vendorIds.map((id) => ({
    vendor_id: id,
    fee_type: "percentage" as const,
    fee_value: 0,
    min_order_value: 0,
    slabs: null,
    is_exempt: true,
  }));
  const { error } = await supabase.from("platform_fees").upsert(rows, { onConflict: "vendor_id" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Get platform fee summary for this month (admin). */
export async function getPlatformFeeSummaryThisMonth(): Promise<FeeSummary> {
  const { data, error } = await supabase.rpc("get_platform_fee_summary_this_month");
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { total_fee: 0, order_count: 0 };
  }
  const row = data[0] as { total_fee: number; order_count: number };
  return {
    total_fee: Number(row.total_fee ?? 0),
    order_count: Number(row.order_count ?? 0),
  };
}
