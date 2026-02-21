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

/** Call to set MPIN after OTP verify (requires session). Tries client updateUser first, then Edge Function. */
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

  const tryClientUpdate = async (): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await supabase.auth.updateUser({
      email: syntheticEmail,
      password: padded,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const tryEdgeFunction = async (): Promise<{ ok: boolean; error?: string }> => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-mpin`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ mpin: digits }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (json as { error?: string }).error ?? "Edge function failed" };
    }
    return { ok: true };
  };

  const clientResult = await tryClientUpdate();
  if (clientResult.ok) return clientResult;

  const efResult = await tryEdgeFunction();
  if (efResult.ok) return efResult;

  return { ok: false, error: clientResult.error ?? efResult.error ?? "Failed to set MPIN" };
}
