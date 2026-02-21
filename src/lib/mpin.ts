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

const SET_MPIN_TIMEOUT_MS = 15000;

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
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-mpin`;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    await supabase.auth.refreshSession();
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    const token = freshSession?.access_token ?? session.access_token;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey ?? "",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ mpin: digits }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (json as { error?: string }).error ?? "Edge function failed" };
    }
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
