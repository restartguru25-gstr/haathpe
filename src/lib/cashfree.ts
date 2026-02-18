/**
 * Cashfree PG checkout — create session via Edge Function, open Cashfree hosted checkout.
 * Requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_CASHFREE_APP_ID, VITE_CASHFREE_MODE (sandbox|production).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const CASHFREE_APP_ID = import.meta.env.VITE_CASHFREE_APP_ID ?? "";
const CASHFREE_MODE = (import.meta.env.VITE_CASHFREE_MODE ?? "sandbox").toLowerCase();
/** Edge Function slug for creating Cashfree orders (default create-cashfree-order; use clever-worker if you created the function with that slug) */
const CASHFREE_ORDER_FUNCTION = import.meta.env.VITE_CASHFREE_ORDER_FUNCTION ?? "create-cashfree-order";

export function isCashfreeConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON && CASHFREE_APP_ID);
}

/** Returns why Cashfree is not configured (for debugging / UI). */
export function getCashfreeConfigStatus(): { configured: boolean; missing?: string } {
  if (!SUPABASE_URL) return { configured: false, missing: "VITE_SUPABASE_URL" };
  if (!SUPABASE_ANON) return { configured: false, missing: "VITE_SUPABASE_ANON_KEY" };
  if (!CASHFREE_APP_ID) return { configured: false, missing: "VITE_CASHFREE_APP_ID" };
  return { configured: true };
}

export interface CreateSessionParams {
  order_id: string;
  order_amount: number;
  customer_phone?: string;
  customer_id?: string;
  customer_email?: string;
  return_url: string;
  order_note?: string;
}

/** Call Edge Function to create Cashfree order and get payment_session_id */
export async function createCashfreeSession(
  params: CreateSessionParams
): Promise<{ ok: true; payment_session_id: string } | { ok: false; error: string }> {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${CASHFREE_ORDER_FUNCTION}`;
  if (typeof window !== "undefined") {
    console.log("[Cashfree] Creating session:", url);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON}`,
      apikey: SUPABASE_ANON,
    },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data as { error?: string; message?: string; code?: string };
    const err = d.error ?? d.message ?? "Failed to create payment session";
    if (typeof window !== "undefined") console.error("[Cashfree] Session failed:", res.status, err, data);
    return { ok: false, error: err };
  }
  const payment_session_id = (data as { payment_session_id?: string }).payment_session_id;
  if (!payment_session_id) {
    if (typeof window !== "undefined") console.error("[Cashfree] No payment_session_id in response", data);
    return { ok: false, error: "No payment session received" };
  }
  if (typeof window !== "undefined") console.log("[Cashfree] Session OK, payment_session_id received");
  return { ok: true, payment_session_id };
}

/** Base URL for Cashfree hosted checkout (redirect). Same as Edge Function. */
const CASHFREE_CHECKOUT_BASE =
  CASHFREE_MODE === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

/**
 * Direct URL to Cashfree hosted checkout page. Use this for a guaranteed redirect
 * when the SDK doesn't redirect (e.g. CSP, script load issues).
 */
export function getCashfreeCheckoutUrl(paymentSessionId: string): string {
  return `${CASHFREE_CHECKOUT_BASE}/view/gateway/${encodeURIComponent(paymentSessionId)}`;
}

/** Open Cashfree checkout. Uses direct redirect URL so the user always lands on Cashfree. */
export async function openCashfreeCheckout(paymentSessionId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const url = getCashfreeCheckoutUrl(paymentSessionId);
  window.location.href = url;
}
