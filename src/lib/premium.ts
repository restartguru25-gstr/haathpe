import { createCashfreeSession, openCashfreeCheckout, isCashfreeConfigured } from "./cashfree";

const PREMIUM_AMOUNT_RUPEES = 99;
const PENDING_PREMIUM_KEY = "cf_pending_premium";

export interface PendingPremiumData {
  orderId: string;
  userId: string;
}

export function savePendingPremium(data: PendingPremiumData): void {
  try {
    sessionStorage.setItem(PENDING_PREMIUM_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getPendingPremium(): PendingPremiumData | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PREMIUM_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingPremiumData;
  } catch {
    return null;
  }
}

export function clearPendingPremium(): void {
  try {
    sessionStorage.removeItem(PENDING_PREMIUM_KEY);
  } catch {
    /* ignore */
  }
}

export function isPremiumCheckoutConfigured(): boolean {
  return isCashfreeConfigured();
}

/** Create Cashfree session and open checkout for premium upgrade (₹99/month) */
export async function createPremiumCheckout(
  userId: string,
  options?: { customerPhone?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isCashfreeConfigured()) {
    return { ok: false, error: "Payment gateway not configured" };
  }
  const orderId = `prem_${userId}_${Date.now()}`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const returnUrl = origin ? `${origin}/payment/return` : "/payment/return";

  const sessionRes = await createCashfreeSession({
    order_id: orderId,
    order_amount: PREMIUM_AMOUNT_RUPEES,
    return_url: returnUrl,
    customer_phone: options?.customerPhone,
    customer_id: userId,
    order_note: "Premium subscription — 1 month",
  });

  if (!sessionRes.ok || !sessionRes.payment_session_id) {
    return { ok: false, error: sessionRes.error ?? "Could not create payment session" };
  }

  savePendingPremium({ orderId, userId });
  await openCashfreeCheckout(sessionRes.payment_session_id, { redirectTarget: "_self" });
  return { ok: true };
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const FINALIZE_PREMIUM_FUNCTION =
  import.meta.env.VITE_CASHFREE_FINALIZE_PREMIUM_FUNCTION ?? "finalize-premium-after-payment";

/** Finalize premium upgrade server-side after Cashfree payment verified */
export async function finalizePremiumAfterPayment(
  pending: PendingPremiumData
): Promise<{ ok: boolean; error?: string }> {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${FINALIZE_PREMIUM_FUNCTION}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON}`,
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify(pending),
    });
    clearTimeout(timeoutId);

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: data.ok ?? false, error: data.error };
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
