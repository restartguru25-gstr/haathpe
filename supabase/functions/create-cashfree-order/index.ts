/**
 * Creates a Cashfree PG order and returns payment_session_id for client-side checkout.
 * Call from frontend after creating customer_order (pending). Use response to open Cashfree checkout.
 *
 * Deploy: supabase functions deploy create-cashfree-order
 * Set secrets: CASHFREE_APP_ID, CASHFREE_SECRET_KEY (Supabase Dashboard → Edge Functions → Secrets)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CASHFREE_SANDBOX = "https://sandbox.cashfree.com/pg";
const CASHFREE_PROD = "https://api.cashfree.com/pg";
const API_VERSION = "2023-08-01";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const appId = Deno.env.get("CASHFREE_APP_ID");
  const secret = Deno.env.get("CASHFREE_SECRET_KEY");
  const env = (Deno.env.get("CASHFREE_ENV") ?? "sandbox").toLowerCase();
  const baseUrl = env === "production" ? CASHFREE_PROD : CASHFREE_SANDBOX;

  if (!appId || !secret) {
    return jsonResponse({ error: "Cashfree not configured" }, 503);
  }

  try {
    const body = (await req.json()) as {
      order_id: string;
      order_amount: number;
      customer_phone?: string;
      customer_id?: string;
      customer_email?: string;
      return_url: string;
      order_note?: string;
    };

    const orderId = body.order_id?.trim();
    const orderAmount = Number(body.order_amount);
    const returnUrl = body.return_url?.trim();

    if (!orderId || orderAmount < 1 || !returnUrl) {
      return jsonResponse(
        { error: "order_id, order_amount (>= 1), and return_url are required" },
        400
      );
    }

    const payload = {
      order_id: orderId,
      order_amount: orderAmount,
      order_currency: "INR",
      customer_details: {
        customer_id: body.customer_id?.trim() || orderId,
        customer_phone: body.customer_phone?.replace(/\D/g, "").slice(-10) || "9999999999",
        customer_email: body.customer_email?.trim() || undefined,
      },
      order_meta: {
        return_url: returnUrl,
      },
      order_note: body.order_note?.slice(0, 500) || undefined,
    };

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": API_VERSION,
        "x-client-id": appId,
        "x-client-secret": secret,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return jsonResponse(
        { error: (data as { message?: string }).message || "Cashfree order creation failed", details: data },
        res.status
      );
    }

    const paymentSessionId = (data as { payment_session_id?: string }).payment_session_id;
    if (!paymentSessionId) {
      return jsonResponse({ error: "No payment_session_id in response", details: data }, 502);
    }

    return jsonResponse({ payment_session_id: paymentSessionId, order_id: orderId });
  } catch (e) {
    console.error("create-cashfree-order:", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
