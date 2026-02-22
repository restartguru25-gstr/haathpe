/**
 * Cashfree Secure ID verification (Bank, PAN, GSTIN).
 * Calls Supabase Edge Function so Cashfree keys stay server-side.
 */
import { supabase } from "@/lib/supabase";

export type VerifyType = "bank" | "pan" | "gstin";

export interface VerifyResult {
  ok: boolean;
  valid?: boolean;
  error?: string;
  message?: string;
}

function parseInvokeError(error: unknown, data: unknown): string {
  const err = error as { message?: string; context?: { body?: { error?: string } }; status?: number };
  if (data && typeof data === "object" && "error" in data && typeof (data as { error?: string }).error === "string") {
    return (data as { error: string }).error;
  }
  if (err?.context?.body?.error) return err.context.body.error;
  if (err?.status === 401) return "Session expired. Please sign in again.";
  if (err?.status === 503) return "Verification service not configured.";
  return err?.message || "Verification failed";
}

/** Verify bank account via Cashfree (Edge Function) */
export async function verifyBank(params: {
  bank_account: string;
  ifsc: string;
  name?: string;
  phone?: string;
}): Promise<VerifyResult> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return { ok: false, error: "Not authenticated" };

    const { data, error } = await supabase.functions.invoke("verify-cashfree", {
      body: { type: "bank", ...params },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) return { ok: false, error: parseInvokeError(error, data) };
    const res = (data ?? {}) as VerifyResult;
    return res.ok ? res : { ok: false, error: res.error || "Verification failed" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verification failed";
    return { ok: false, error: msg };
  }
}

/** Verify PAN via Cashfree (Edge Function) */
export async function verifyPan(params: { pan: string; name?: string }): Promise<VerifyResult> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return { ok: false, error: "Not authenticated" };

    const { data, error } = await supabase.functions.invoke("verify-cashfree", {
      body: { type: "pan", ...params },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) return { ok: false, error: parseInvokeError(error, data) };
    const res = (data ?? {}) as VerifyResult;
    return res.ok ? res : { ok: false, error: res.error || "Verification failed" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verification failed";
    return { ok: false, error: msg };
  }
}

/** Verify GSTIN via Cashfree (Edge Function) */
export async function verifyGstin(params: {
  GSTIN: string;
  business_name?: string;
}): Promise<VerifyResult> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return { ok: false, error: "Not authenticated" };

    const { data, error } = await supabase.functions.invoke("verify-cashfree", {
      body: { type: "gstin", ...params },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) return { ok: false, error: parseInvokeError(error, data) };
    const res = (data ?? {}) as VerifyResult;
    return res.ok ? res : { ok: false, error: res.error || "Verification failed" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verification failed";
    return { ok: false, error: msg };
  }
}
