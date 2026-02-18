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

declare global {
  interface Window {
    Cashfree?: (opts: { mode: string }) => { checkout: (opts: { paymentSessionId: string; redirectTarget: string }) => void | Promise<unknown> };
  }
}

/** Load Cashfree.js script and return Cashfree instance */
function loadCashfreeScript(): Promise<{ checkout: (opts: { paymentSessionId: string; redirectTarget: string }) => void | Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Not in browser"));
      return;
    }
    if (window.Cashfree) {
      resolve(window.Cashfree({ mode: CASHFREE_MODE === "production" ? "production" : "sandbox" }));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => {
      if (window.Cashfree) {
        resolve(window.Cashfree({ mode: CASHFREE_MODE === "production" ? "production" : "sandbox" }));
      } else {
        reject(new Error("Cashfree SDK failed to load"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
    document.head.appendChild(script);
  });
}

/** Open Cashfree checkout (redirect or modal). Redirect is default for simplicity. */
export async function openCashfreeCheckout(paymentSessionId: string): Promise<void> {
  if (typeof window !== "undefined") console.log("[Cashfree] Loading SDK and opening checkout...");
  const cashfree = await loadCashfreeScript();
  if (typeof window !== "undefined") console.log("[Cashfree] SDK loaded, calling checkout()");
  cashfree.checkout({
    paymentSessionId,
    redirectTarget: "_self",
  });
}
