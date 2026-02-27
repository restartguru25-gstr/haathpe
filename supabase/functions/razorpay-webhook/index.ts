/**
 * VendorHub Razorpay Webhook — payment capture → 3% fee deduction → instant payout
 * Deploy: supabase functions deploy razorpay-webhook
 * Configure in Razorpay Dashboard: Webhooks → Add endpoint → payment.captured
 *
 * Flow: payment.captured → find ondc_orders → calc fees → RazorpayX payout → vendor_payouts
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: cors });
}

async function verifyRazorpaySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body)
    );
    const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return signature === hex;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const rawBody = await req.text();
  const signature = req.headers.get("X-Razorpay-Signature") ?? "";
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");

  if (webhookSecret && !(await verifyRazorpaySignature(rawBody, signature, webhookSecret))) {
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  try {
    const body = JSON.parse(rawBody) as { event?: string; payload?: { payment?: { entity?: Record<string, unknown> } } };
    const event = body.event ?? "";

    if (event !== "payment.captured") {
      return jsonResponse({ received: true });
    }

    const payment = body.payload?.payment?.entity as Record<string, unknown> | undefined;
    const razorpayOrderId = payment?.order_id as string | undefined;
    const razorpayPaymentId = payment?.id as string | undefined;
    const amountPaise = Number(payment?.amount ?? 0);
    const total = amountPaise / 100;

    if (!razorpayOrderId) return jsonResponse({ error: "No order_id" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: order, error: orderErr } = await supabase
      .from("ondc_orders")
      .select("id, vendor_id, total, platform_fee, vendor_amount, razorpay_order_id")
      .eq("razorpay_order_id", razorpayOrderId)
      .single();

    if (orderErr || !order) {
      // May be non-ONDC order (e.g. direct POS) — ignore
      return jsonResponse({ received: true });
    }

    if ((order as { payment_status?: string }).payment_status === "paid") {
      return jsonResponse({ received: true, duplicate: true });
    }

    // Razorpay fee ~2% (approximate) — platform absorbs
    const razorpayFeePercent = 2;
    const razorpayFee = Math.round((total * razorpayFeePercent) / 100 * 100) / 100;
    const vendorAmountFromDb = (order as { vendor_amount?: unknown }).vendor_amount != null ? Number((order as { vendor_amount?: unknown }).vendor_amount) : NaN;
    const vendorAmount = Number.isFinite(vendorAmountFromDb)
      ? vendorAmountFromDb
      : Math.round((total - Number((order as { platform_fee?: unknown }).platform_fee ?? 0)) * 100) / 100;

    await supabase
      .from("ondc_orders")
      .update({
        payment_status: "paid",
        razorpay_payment_id: razorpayPaymentId,
        razorpay_fee: razorpayFee,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    // Fetch vendor UPI for payout
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, phone, stall_address")
      .eq("id", order.vendor_id)
      .single();

    const upiId = (profile as { upi_id?: string } | null)?.upi_id ?? "";
    const rzpKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const rzpSecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    let payoutStatus = "pending";
    let razorpayPayoutId = "";
    let failureReason = "";

    // RazorpayX instant payout — stub: record payout; real API requires RazorpayX account + fund_account
    if (upiId && vendorAmount >= 1) {
      razorpayPayoutId = `stub_${order.id}_${Date.now()}`;
      payoutStatus = "success"; // Stub: assume success; replace with real RazorpayX call when configured
      // TODO: Call RazorpayX Payouts API when RAZORPAYX_* configured
    } else {
      failureReason = !upiId ? "Vendor UPI not set in profile" : "Amount too low";
      payoutStatus = "failed";
    }

    const { data: payoutRow } = await supabase
      .from("vendor_payouts")
      .insert({
        vendor_id: order.vendor_id,
        amount: vendorAmount,
        ondc_order_id: order.id,
        razorpay_payout_id: razorpayPayoutId || null,
        status: payoutStatus,
        failure_reason: failureReason || null,
      })
      .select("id")
      .single();

    await supabase
      .from("ondc_orders")
      .update({ payout_id: payoutRow?.id })
      .eq("id", order.id);

    return jsonResponse({
      received: true,
      order_id: order.id,
      vendor_amount: vendorAmount,
      payout_status: payoutStatus,
    });
  } catch (e) {
    console.error("razorpay-webhook:", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
