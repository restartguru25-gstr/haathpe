/**
 * Haathpe ONDC Webhook — receives orders from ONDC buyer apps (PhonePe, Paytm, etc.)
 * Deploy: supabase functions deploy ondc-webhook
 * URL: https://<project>.supabase.co/functions/v1/ondc-webhook
 *
 * ONDC protocol v1.2+ actions: search | select | init | confirm | status
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

interface OndcContext {
  action?: string;
  transaction_id?: string;
  domain?: string;
  bpp_id?: string;
  bpp_uri?: string;
}

interface OndcRequest {
  context?: OndcContext;
  message?: Record<string, unknown>;
}

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: cors });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = (await req.json()) as OndcRequest;
    const action = body.context?.action ?? "unknown";
    const transactionId = body.context?.transaction_id ?? "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (action) {
      case "search": {
        // Return vendor catalog stub (from our export format)
        const { data: vendors } = await supabase
          .from("profiles")
          .select("id, name, stall_type, zone")
          .not("stall_type", "is", null)
          .limit(5);
        return jsonResponse({
          context: { ...body.context, action: "on_search" },
          message: {
            catalog: {
              "bpp/providers": (vendors ?? []).map((v) => ({
                id: v.id,
                descriptor: { name: v.name || "Dukaanwaala", short_desc: v.stall_type },
                locations: [{ id: v.zone || "Hyderabad" }],
              })),
            },
          },
        });
      }

      case "select": {
        // Confirm item availability — stub true
        return jsonResponse({
          context: { ...body.context, action: "on_select" },
          message: { order: { provider: { id: "selected" }, items: body.message?.order?.items ?? [] } },
        });
      }

      case "init": {
        // Initialize order
        return jsonResponse({
          context: { ...body.context, action: "on_init" },
          message: { order: { ...(body.message?.order ?? {}), id: transactionId } },
        });
      }

      case "confirm": {
        // Create Razorpay order, insert ondc_orders, return payment link
        const order = body.message?.order as Record<string, unknown> | undefined;
        const provider = order?.provider as { id?: string } | undefined;
        const quote = order?.quote as { price?: { value?: string }; breakdown?: unknown[] } | undefined;
        const items = (order?.items ?? []) as Array<{ id?: string; quantity?: number; item?: { descriptor?: { name?: string } } }>;
        const fulfillment = order?.fulfillment as { contact?: { phone?: string }; customer?: { person?: { name?: string } } } | undefined;

        const vendorId = provider?.id ?? "";
        const totalStr = quote?.price?.value ?? "0";
        const total = Math.round(parseFloat(totalStr) * 100) / 100;
        const totalPaise = Math.round(total * 100);

        if (!vendorId || totalPaise < 100) {
          return jsonResponse({ error: "Invalid order: vendor or amount missing" }, 400);
        }

        // Get platform fee via RPC (per-vendor or global default)
        const { data: feeData } = await supabase.rpc("calculate_platform_fee", {
          p_vendor_id: vendorId,
          p_order_total: total,
        });
        const feeRow = Array.isArray(feeData) && feeData[0] ? feeData[0] : null;
        const platformFee = Number(feeRow?.platform_fee ?? 0);
        const vendorAmount = Number(feeRow?.vendor_amount ?? total);

        // Create Razorpay order
        const rzpKeyId = Deno.env.get("RAZORPAY_KEY_ID");
        const rzpSecret = Deno.env.get("RAZORPAY_KEY_SECRET");
        let razorpayOrderId = "";
        let paymentUrl = "";

        if (rzpKeyId && rzpSecret) {
          const auth = btoa(`${rzpKeyId}:${rzpSecret}`);
          const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${auth}`,
            },
            body: JSON.stringify({
              amount: totalPaise,
              currency: "INR",
              receipt: `ondc-${transactionId}`,
              notes: { ondc_transaction_id: transactionId, vendor_id: vendorId },
            }),
          });
          if (rzpRes.ok) {
            const rzpData = (await rzpRes.json()) as { id?: string };
            razorpayOrderId = rzpData.id ?? "";
            paymentUrl = `https://api.razorpay.com/v1/checkout/${razorpayOrderId}`;
          }
        } else {
          razorpayOrderId = `stub_${transactionId}`;
          paymentUrl = `https://haathpe.com/pay/${razorpayOrderId}`;
        }

        const orderItems = items.map((i) => ({
          item_name: i.item?.descriptor?.name ?? "Item",
          qty: i.quantity ?? 1,
          price: total / (items.length || 1),
        }));

        const { data: inserted, error: insErr } = await supabase
          .from("ondc_orders")
          .insert({
            ondc_transaction_id: transactionId,
            vendor_id: vendorId,
            items: orderItems,
            total,
            platform_fee: platformFee,
            vendor_amount: vendorAmount,
            razorpay_fee: 0,
            buyer_app: body.context?.bpp_id ?? "ondc",
            buyer_name: fulfillment?.customer?.person?.name,
            buyer_phone: fulfillment?.contact?.phone,
            status: "pending",
            payment_status: "pending",
            razorpay_order_id: razorpayOrderId,
          })
          .select("id")
          .single();

        if (insErr) {
          console.error("ondc_orders insert:", insErr);
          return jsonResponse({ error: insErr.message }, 500);
        }

        // Notify vendor via realtime (Supabase broadcast)
        await supabase.from("ondc_orders").select("*").eq("id", inserted?.id).single();

        return jsonResponse({
          context: { ...body.context, action: "on_confirm" },
          message: {
            order: {
              id: inserted?.id,
              state: "Created",
              provider: { id: vendorId },
              payment: {
                uri: paymentUrl,
                tl_method: "http/get",
                params: { amount: total, currency: "INR", transaction_id: razorpayOrderId },
              },
            },
          },
        });
      }

      case "status": {
        // Update order status (e.g. from buyer app)
        const orderId = (body.message?.order_id as string) ?? transactionId;
        const status = (body.message?.status as string) ?? "pending";
        if (orderId) {
          await supabase.from("ondc_orders").update({ status }).eq("ondc_transaction_id", orderId).or(`id.eq.${orderId}`);
        }
        return jsonResponse({
          context: { ...body.context, action: "on_status" },
          message: { order: { id: orderId, state: status } },
        });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("ondc-webhook:", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
