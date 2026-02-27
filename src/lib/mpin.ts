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

/** Sign in with phone + MPIN (for returning users). Calls prepare-mpin-signin to set Auth, then signInWithPassword. */
export async function signInWithMpin(
  phone: string,
  mpin: string
): Promise<{ ok: boolean; error?: string }> {
  const digits = (phone || "").replace(/\D/g, "").slice(-10);
  const mpinDigits = (mpin || "").replace(/\D/g, "").slice(0, 4);
  const fullPhone = digits.length === 10 ? `+91${digits}` : "";
  if (!fullPhone || mpinDigits.length !== 4) {
    return { ok: false, error: "Enter phone and 4-digit MPIN" };
  }

  const { data, error: fnErr } = await supabase.functions.invoke("prepare-mpin-signin", {
    body: { phone: fullPhone, mpin: mpinDigits },
  });
  if (fnErr) {
    const msg = fnErr.message || "Invalid phone or MPIN";
    return { ok: false, error: msg };
  }
  const ok = (data as { ok?: boolean } | null)?.ok;
  if (!ok) return { ok: false, error: "Invalid phone or MPIN" };

  const padded = padMpin(mpinDigits);
  const email = getMpinEmail(phone);
  const { error } = await supabase.auth.signInWithPassword({ email, password: padded });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const SET_MPIN_TIMEOUT_MS = 10000;

/** Set MPIN after OTP verify (server-side). Uses Edge Function so RLS/session issues don't block. */
export async function setMpinAfterOtp(
  mpin: string,
  _phoneOverride?: string
): Promise<{ ok: boolean; error?: string }> {
  const digits = (mpin || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length !== 4) {
    return { ok: false, error: "MPIN must be 4 digits" };
  }

  const run = async (): Promise<{ ok: boolean; error?: string }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Not signed in. Verify OTP first." };
    }

    // Ensure JWT is fresh before invoking set-mpin (it validates Authorization header).
    await Promise.race([supabase.auth.refreshSession(), new Promise((r) => setTimeout(r, 2500))]);

    const { data, error } = await supabase.functions.invoke("set-mpin", {
      body: { mpin: digits },
    });
    if (error) return { ok: false, error: error.message };
    const ok = (data as { ok?: boolean; error?: string } | null)?.ok;
    if (!ok) return { ok: false, error: (data as { error?: string } | null)?.error ?? "Failed to set MPIN" };
    return { ok: true };
  };

  const timeout = () =>
    new Promise<{ ok: boolean; error?: string }>((_, reject) =>
      setTimeout(
        () => reject(new Error("Request timed out. Check your connection and try again.")),
        SET_MPIN_TIMEOUT_MS
      )
    );

  try {
    return await Promise.race([run(), timeout()]);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to set MPIN." };
  }
}
