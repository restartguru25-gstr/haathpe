/**
 * Cashfree PG checkout — create session via Edge Function, open Cashfree hosted checkout.
 * Requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_CASHFREE_APP_ID, VITE_CASHFREE_MODE (sandbox|production).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const CASHFREE_APP_ID = import.meta.env.VITE_CASHFREE_APP_ID ?? "";
const CASHFREE_MODE = (import.meta.env.VITE_CASHFREE_MODE ?? "production").toLowerCase();
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

const CASHFREE_SESSION_TIMEOUT_MS = 10000;

/** Call Edge Function to create Cashfree order and get payment_session_id. Uses 10s timeout to avoid hanging. */
export async function createCashfreeSession(
  params: CreateSessionParams
): Promise<{ ok: true; payment_session_id: string } | { ok: false; error: string }> {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${CASHFREE_ORDER_FUNCTION}`;
  if (typeof window !== "undefined") console.log("[CART] Creating Cashfree order...", url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CASHFREE_SESSION_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON}`,
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify(params),
    });
    clearTimeout(timeoutId);

    if (typeof window !== "undefined") console.log("[CART] 3. Backend responded with status:", res.status);

    if (!res.ok) {
      const errText = await res.text();
      if (typeof window !== "undefined") console.log("[CART] 4. Raw response body:", errText);
      if (typeof window !== "undefined") console.error("[CART] Order creation failed – status:", res.status, "body:", errText);
      let errMsg: string;
      try {
        const d = JSON.parse(errText) as { error?: string; message?: string };
        errMsg = d.error ?? d.message ?? (errText.slice(0, 200) || `HTTP ${res.status}`);
      } catch {
        errMsg = errText.slice(0, 200) || `HTTP ${res.status}`;
      }
      return { ok: false, error: errMsg };
    }

    const data = (await res.json().catch(() => ({}))) as { payment_session_id?: string };
    if (typeof window !== "undefined") console.log("[CART] 4. Raw response body (success):", JSON.stringify({ ...data, payment_session_id: data?.payment_session_id ? "(present)" : undefined }));
    if (typeof window !== "undefined") console.log("[CART] 5. Parsed data – has payment_session_id:", !!data?.payment_session_id);

    const payment_session_id = data?.payment_session_id;
    if (!payment_session_id) {
      if (typeof window !== "undefined") console.error("[CART] Invalid response – no payment_session_id", data);
      return { ok: false, error: "No payment session received" };
    }
    return { ok: true, payment_session_id };
  } catch (e) {
    clearTimeout(timeoutId);
    const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
    if (name === "AbortError") {
      if (typeof window !== "undefined") console.error("[CART] Request timed out or aborted");
      return { ok: false, error: "Request timed out – please try again" };
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (typeof window !== "undefined") console.error("[CART] createCashfreeSession error:", e);
    return { ok: false, error: msg?.slice(0, 200) || "Failed to create payment session" };
  }
}

/** Open Cashfree checkout via official SDK (redirect in same tab). Do not use direct URL — it returns 400. */
export async function openCashfreeCheckout(paymentSessionId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const mode = CASHFREE_MODE === "production" ? "production" : "sandbox";
  if (typeof window !== "undefined") console.log("[CART] 7. Loading Cashfree SDK, mode:", mode);
  const { load } = await import("@cashfreepayments/cashfree-js");
  const cashfree = await load({ mode });
  if (typeof window !== "undefined") console.log("[CART] 8. Cashfree SDK loaded:", !!cashfree);
  if (!cashfree) throw new Error("Cashfree SDK failed to load");
  if (typeof window !== "undefined") console.log("[CART] 9. Launching Cashfree checkout with redirectTarget _self");
  cashfree.checkout({
    paymentSessionId,
    redirectTarget: "_self",
  });
}
