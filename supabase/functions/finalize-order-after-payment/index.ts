/**
 * Finalize order after Cashfree payment success — server-side insert (avoids client AbortError).
 * Verifies payment via Cashfree, inserts order + order_items, awards coins.
 *
 * Deploy: supabase functions deploy finalize-order-after-payment --no-verify-jwt
 * Secrets: CASHFREE_APP_ID, CASHFREE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CASHFREE_SANDBOX = "https://sandbox.cashfree.com/pg";
const CASHFREE_PROD = "https://api.cashfree.com/pg";
const API_VERSION = "2023-08-01";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://www.haathpe.com", // or "*" for testing
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400", // Cache preflight 24 hours
};

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** CORS preflight — must return 200 for browser to allow actual request. JWT must be disabled on this function. */
function corsPreflight() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

async function verifyCashfreePaid(orderId: string): Promise<boolean> {
  const appId = Deno.env.get("CASHFREE_APP_ID");
  const secret = Deno.env.get("CASHFREE_SECRET_KEY");
  const env = (Deno.env.get("CASHFREE_ENV") ?? "production").toLowerCase();
  const baseUrl = env === "sandbox" ? CASHFREE_SANDBOX : CASHFREE_PROD;
  if (!appId || !secret) return false;

  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-api-version": API_VERSION,
      "x-client-id": appId,
      "x-client-secret": secret,
    },
  });
  const data = (await res.json().catch(() => ({}))) as { order_status?: string };
  return (data.order_status ?? "").toUpperCase() === "PAID";
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return corsPreflight();
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Server misconfiguration" }, 503);
    }

    let body: {
      orderId?: string;
      userId?: string;
      total?: number;
      gstTotal?: number | null;
      subtotalBeforeTax?: number | null;
      ecoFlag?: boolean;
      items?: Array<{
        productId: string;
        productName: string;
        qty: number;
        unitPrice: number;
        variantId: string | null;
        variantLabel: string | null;
        mrp: number | null;
        gstRate: number | null;
      }>;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const total = Number(body.total);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!orderId || !userId || total < 0 || items.length === 0) {
      return jsonResponse({ error: "orderId, userId, total, and items[] required" }, 400);
    }

    const isPaid = await verifyCashfreePaid(orderId);
    if (!isPaid) {
      return jsonResponse({ error: "Payment not confirmed" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const orderPayload = {
      id: orderId,
      user_id: userId,
      total,
      status: "paid",
      gst_total: body.gstTotal ?? null,
      subtotal_before_tax: body.subtotalBeforeTax ?? null,
      eco_flag: Boolean(body.ecoFlag),
    };

    const { error: orderErr } = await supabase.from("orders").insert(orderPayload);
    if (orderErr) {
      if (orderErr.code === "23505") {
        const { data: awardData } = await supabase.rpc("award_coins_for_paid_order", {
          p_order_id: orderId,
        });
        const res = awardData as { ok?: boolean; coins?: number; cashback?: number } | null;
        return jsonResponse({
          ok: true,
          duplicate: true,
          coins: res?.coins ?? 2,
          cashback: res?.cashback ?? 2,
        });
      }
      console.error("finalize-order order insert:", orderErr);
      return jsonResponse({ ok: false, error: orderErr.message }, 500);
    }

    const itemRows = items.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      product_name: item.productName,
      qty: item.qty,
      unit_price: item.unitPrice,
      variant_id: item.variantId,
      variant_label: item.variantLabel,
      mrp: item.mrp,
      gst_rate: item.gstRate,
      discount_amount: null,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
    if (itemsErr) {
      console.error("finalize-order order_items insert:", itemsErr);
      return jsonResponse({ ok: false, error: itemsErr.message }, 500);
    }

    const { data: awardData } = await supabase.rpc("award_coins_for_paid_order", {
      p_order_id: orderId,
    });
    const award = awardData as { ok?: boolean; coins?: number; cashback?: number } | null;

    return jsonResponse({
      ok: true,
      order_id: orderId,
      coins: award?.coins ?? 2,
      cashback: award?.cashback ?? 2,
    });
  } catch (e) {
    console.error("finalize-order-after-payment:", e);
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
