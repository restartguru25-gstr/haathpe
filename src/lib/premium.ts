import { supabase } from "./supabase";

/** Mock premium upgrade (stub — real Razorpay payment later) */
export async function upgradeToPremiumMock(): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("upgrade_to_premium_mock");
  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.ok === false && row.error_msg) {
    return { ok: false, error: row.error_msg };
  }
  return { ok: true };
}
