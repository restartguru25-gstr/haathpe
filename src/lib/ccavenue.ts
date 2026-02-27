/**
 * CCAvenue checkout helper (client-side).
 *
 * Security:
 * - Working key stays server-side (Supabase Edge Function secrets).
 * - Client only receives `encRequest`, `access_code`, and gateway URL to redirect.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

const CREATE_CCA_ORDER_FUNCTION =
  import.meta.env.VITE_CCAVENUE_CREATE_ORDER_FUNCTION ?? "create-cca-order";

export function isCcavenueConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON);
}

export interface CreateCcaOrderParams {
  order_id: string;
  order_amount: number;
  customer_phone?: string;
  customer_id?: string;
  customer_email?: string;
  return_to?: string; // where user should land after payment (SPA route)
  order_note?: string;
  billing_name?: string;
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  billing_country?: string;
  delivery_name?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_zip?: string;
  delivery_country?: string;
  delivery_tel?: string;
}

export async function createCcaOrder(
  params: CreateCcaOrderParams
): Promise<
  | { ok: true; order_id: string; enc_request: string; gateway_url: string; access_code: string }
  | { ok: false; error: string }
> {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const returnTo = params.return_to || (typeof window !== "undefined" ? `${window.location.origin}/payment/return` : "");
  const redirectUrl = `${base}/functions/v1/verify-cca-payment?return_to=${encodeURIComponent(returnTo)}`;

  const url = `${base}/functions/v1/${CREATE_CCA_ORDER_FUNCTION}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON}`,
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({
        order_id: params.order_id,
        order_amount: params.order_amount,
        customer_phone: params.customer_phone,
        customer_id: params.customer_id,
        customer_email: params.customer_email,
        return_url: redirectUrl,
        cancel_url: redirectUrl,
        order_note: params.order_note,
        billing_name: params.billing_name ?? "Customer",
        // Prefill billing/shipping to avoid bad UX on CCAvenue hosted checkout.
        billing_address: params.billing_address ?? "NA",
        billing_city: params.billing_city ?? "NA",
        billing_state: params.billing_state ?? "NA",
        billing_zip: params.billing_zip ?? "000000",
        billing_country: params.billing_country ?? "India",
        delivery_name: params.delivery_name,
        delivery_address: params.delivery_address,
        delivery_city: params.delivery_city,
        delivery_state: params.delivery_state,
        delivery_zip: params.delivery_zip,
        delivery_country: params.delivery_country,
        delivery_tel: params.delivery_tel,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText.slice(0, 200) || `HTTP ${res.status}` };
    }

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      order_id?: string;
      enc_request?: string;
      gateway_url?: string;
      access_code?: string;
      error?: string;
    };

    if (!data?.enc_request || !data?.gateway_url || !data?.access_code || !data?.order_id) {
      return { ok: false, error: data?.error ?? "Invalid gateway response" };
    }

    return {
      ok: true,
      order_id: data.order_id,
      enc_request: data.enc_request,
      gateway_url: data.gateway_url,
      access_code: data.access_code,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 200) || "Failed to create payment request" };
  }
}

/**
 * Redirect user to CCAvenue hosted payment page via POST form submit.
 * CCAvenue requires POST of `encRequest` and `access_code`.
 */
export function redirectToCcavenue(opts: {
  gateway_url: string;
  access_code: string;
  enc_request: string;
  target?: "_self" | "_blank";
}): void {
  if (typeof window === "undefined") return;

  const form = document.createElement("form");
  form.method = "POST";
  form.action = opts.gateway_url;
  form.target = opts.target ?? "_self";

  const enc = document.createElement("input");
  enc.type = "hidden";
  enc.name = "encRequest";
  enc.value = opts.enc_request;

  const ac = document.createElement("input");
  ac.type = "hidden";
  ac.name = "access_code";
  ac.value = opts.access_code;

  form.appendChild(enc);
  form.appendChild(ac);
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

