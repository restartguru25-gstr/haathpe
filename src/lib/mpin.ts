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

/** Call Edge Function to set MPIN after OTP verify (requires session). */
export async function setMpinAfterOtp(mpin: string): Promise<{ ok: boolean; error?: string }> {
  const digits = (mpin || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length !== 4) {
    return { ok: false, error: "MPIN must be 4 digits" };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: "Not signed in. Verify OTP first." };
  }
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
    return { ok: false, error: (json as { error?: string }).error ?? "Failed to set MPIN" };
  }
  return { ok: true };
}
