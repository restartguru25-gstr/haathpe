/**
 * Verify Cashfree payment status via Get Order API.
 * Called from PaymentReturn when order may not exist in DB yet (post-payment flow).
 *
 * Deploy: supabase functions deploy verify-cashfree-payment
 * Secrets: CASHFREE_APP_ID, CASHFREE_SECRET_KEY. For sandbox set CASHFREE_ENV=sandbox.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CASHFREE_SANDBOX = "https://sandbox.cashfree.com/pg";
const CASHFREE_PROD = "https://api.cashfree.com/pg";
const API_VERSION = "2023-08-01";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors } });
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (req.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const appId = Deno.env.get("CASHFREE_APP_ID");
    const secret = Deno.env.get("CASHFREE_SECRET_KEY");
    const env = (Deno.env.get("CASHFREE_ENV") ?? "production").toLowerCase();
    const baseUrl = env === "sandbox" ? CASHFREE_SANDBOX : CASHFREE_PROD;

    if (!appId || !secret) {
      return jsonResponse({ error: "Cashfree not configured" }, 503);
    }

    const url = new URL(req.url);
    const orderId = url.searchParams.get("order_id")?.trim();
    if (!orderId) {
      return jsonResponse({ error: "order_id query param required" }, 400);
    }

    const ordersUrl = `${baseUrl}/orders/${encodeURIComponent(orderId)}`;
    const res = await fetch(ordersUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-version": API_VERSION,
        "x-client-id": appId,
        "x-client-secret": secret,
      },
    });

    const data = (await res.json().catch(() => ({}))) as {
      order_status?: string;
      order_id?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      return jsonResponse(
        {
          error: data.error?.message ?? "Failed to fetch order status",
          details: data,
        },
        res.status
      );
    }

    const orderStatus = (data.order_status ?? "").toUpperCase();
    const isPaid = orderStatus === "PAID";

    return jsonResponse({
      ok: true,
      order_id: orderId,
      order_status: orderStatus,
      paid: isPaid,
    });
  } catch (e) {
    console.error("verify-cashfree-payment:", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
