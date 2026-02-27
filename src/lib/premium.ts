import { createCcaOrder, redirectToCcavenue, isCcavenueConfigured } from "./ccavenue";

const PREMIUM_AMOUNT_RUPEES = 99;

export function isPremiumCheckoutConfigured(): boolean {
  return isCcavenueConfigured();
}

/** Redirect to CCAvenue checkout for premium upgrade (₹99/month) */
export async function createPremiumCheckout(
  userId: string,
  options?: { customerPhone?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isCcavenueConfigured()) {
    return { ok: false, error: "Payment gateway not configured" };
  }
  const orderId = `prem_${userId}_${Date.now()}`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const ccaRes = await createCcaOrder({
    order_id: orderId,
    order_amount: PREMIUM_AMOUNT_RUPEES,
    customer_phone: options?.customerPhone,
    customer_id: userId,
    return_to: origin ? `${origin}/payment/return` : "",
    order_note: "Premium subscription — 1 month",
    billing_name: "Haathpe Premium",
  });

  if (!ccaRes.ok) {
    return { ok: false, error: ccaRes.error ?? "Could not create payment request" };
  }

  redirectToCcavenue({
    gateway_url: ccaRes.gateway_url,
    access_code: ccaRes.access_code,
    enc_request: ccaRes.enc_request,
    target: "_self",
  });

  return { ok: true };
}
