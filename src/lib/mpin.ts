/**
 * MPIN helpers for cost-saving auth: OTP at signup, MPIN for regular sign-in.
 * Uses Supabase password auth with synthetic email p{phone}@mpin.local.
 */

import { supabase } from "./supabase";

/** Supabase requires min 6 chars for password. Pad 4-digit MPIN with "00". */
export function padMpin(mpin: string): string {
  const digits = (mpin || "").replace(/\D/g, "").slice(0, 4);
  return digits.length === 4 ? digits + "00" : "";
}

/** Derive synthetic email from phone for MPIN sign-in. */
export function getMpinEmail(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `p${digits}@mpin.local` : "";
}

/** Check if MPIN is valid (4 digits). */
export function isValidMpin(mpin: string): boolean {
  return /^\d{4}$/.test((mpin || "").replace(/\D/g, ""));
}

/** Sign in with phone + MPIN (for returning users). */
export async function signInWithMpin(
  phone: string,
  mpin: string
): Promise<{ ok: boolean; error?: string }> {
  const padded = padMpin(mpin);
  const email = getMpinEmail(phone);
  if (!padded || !email) {
    return { ok: false, error: "Enter phone and 4-digit MPIN" };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password: padded });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const SET_MPIN_TIMEOUT_MS = 45000; // Edge Function cold start + slow networks

/** Call to set MPIN after OTP verify (requires session). Tries Edge Function first (more reliable), then client updateUser. */
export async function setMpinAfterOtp(
  mpin: string,
  phoneOverride?: string
): Promise<{ ok: boolean; error?: string }> {
  const digits = (mpin || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length !== 4) {
    return { ok: false, error: "MPIN must be 4 digits" };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return { ok: false, error: "Not signed in. Verify OTP first." };
  }

  const padded = padMpin(digits);
  const phone =
    phoneOverride ? phoneOverride.replace(/\D/g, "").slice(-10)
    : (session.user.phone ?? (session.user.user_metadata?.phone as string | undefined) ?? "").replace(/\D/g, "").slice(-10);
  const syntheticEmail = phone.length === 10 ? `p${phone}@mpin.local` : "";

  if (!syntheticEmail) {
    return { ok: false, error: "Phone number required for MPIN. Sign in with phone OTP first." };
  }

  const tryEdgeFunction = async (): Promise<{ ok: boolean; error?: string }> => {
    // Cap refresh at 5s so slow refresh doesn't cause timeout
    await Promise.race([
      supabase.auth.refreshSession(),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    // Use invoke() — automatically attaches session JWT; fixes 401 with manual fetch
    const { data, error } = await supabase.functions.invoke("set-mpin", {
      body: { mpin: digits },
    });
    if (error) return { ok: false, error: error.message ?? "Edge function failed" };
    const err = (data as { error?: string })?.error;
    if (err) return { ok: false, error: err };
    return { ok: true };
  };

  const tryClientUpdate = async (): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await supabase.auth.updateUser({
      email: syntheticEmail,
      password: padded,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const timeout = () =>
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Setting MPIN timed out. Please try again.")), SET_MPIN_TIMEOUT_MS)
    );

  const run = async (): Promise<{ ok: boolean; error?: string }> => {
    const efResult = await tryEdgeFunction();
    if (efResult.ok) return efResult;
    const clientResult = await tryClientUpdate();
    if (clientResult.ok) return clientResult;
    return { ok: false, error: efResult.error ?? clientResult.error ?? "Failed to set MPIN" };
  };

  try {
    return await Promise.race([run(), timeout()]);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to set MPIN. Try again." };
  }
}
