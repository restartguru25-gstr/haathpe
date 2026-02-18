/**
 * Cashfree payment webhook — on PAYMENT_SUCCESS update customer_orders (payment_id, status = paid).
 * Configure in Cashfree Dashboard: Webhooks → Add endpoint → Payment Success.
 *
 * Deploy: supabase functions deploy cashfree-webhook
 * Optional secret: CASHFREE_WEBHOOK_SECRET for signature verification (if Cashfree supports it).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: cors });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const raw = await req.text();
    const body = JSON.parse(raw) as {
      type?: string;
      data?: {
        order?: { order_id?: string };
        payment?: { cf_payment_id?: string; payment_status?: string };
      };
    };

    const type = body.type ?? "";
    const orderId = body.data?.order?.order_id ?? body.data?.payment?.order_id;
    const cfPaymentId = body.data?.payment?.cf_payment_id;
    const paymentStatus = body.data?.payment?.payment_status;

    if (!orderId) {
      return jsonResponse({ received: true, skip: "no order_id" });
    }

    const isSuccess =
      type === "PAYMENT_SUCCESS" ||
      type === "PAYMENT_SUCCESS_WEBHOOK" ||
      paymentStatus === "SUCCESS";

    if (!isSuccess) {
      return jsonResponse({ received: true });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: coOrder, error: coErr } = await supabase
      .from("customer_orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (!coErr && coOrder) {
      const row = coOrder as { status?: string };
      if (row.status === "paid") {
        return jsonResponse({ received: true, duplicate: true });
      }
      const { error: updateErr } = await supabase
        .from("customer_orders")
        .update({
          status: "paid",
          payment_id: cfPaymentId ?? "cashfree",
        })
        .eq("id", orderId);
      if (updateErr) {
        console.error("cashfree-webhook customer_orders:", updateErr);
        return jsonResponse({ error: updateErr.message }, 500);
      }
      return jsonResponse({ received: true, order_id: orderId, updated: true, table: "customer_orders" });
    }

    const { data: catalogOrder, error: ordErr } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (!ordErr && catalogOrder) {
      const row = catalogOrder as { status?: string };
      if (row.status === "paid") {
        return jsonResponse({ received: true, duplicate: true });
      }
      const { error: updateErr } = await supabase
        .from("orders")
        .update({ status: "paid" })
        .eq("id", orderId);
      if (updateErr) {
        console.error("cashfree-webhook orders:", updateErr);
        return jsonResponse({ error: updateErr.message }, 500);
      }
      return jsonResponse({ received: true, order_id: orderId, updated: true, table: "orders" });
    }

    return jsonResponse({ received: true, skip: "order not found" });
  } catch (e) {
    console.error("cashfree-webhook:", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
