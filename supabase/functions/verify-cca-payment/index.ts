/**
 * CCAvenue redirect/return handler.
 *
 * CCAvenue posts `encResp` (form-encoded) to `redirect_url`.
 * This function decrypts `encResp` using the server-side WORKING KEY, then:
 * - marks matching `customer_orders` / `orders` row as paid (if Success)
 * - calls `award_coins_for_paid_order` (idempotent)
 * - handles premium order ids `prem_<userId>_<ts>` by upgrading profile
 * - redirects browser to `return_to` (defaults to https://www.haathpe.com/payment/return)
 *
 * Deploy: supabase functions deploy verify-cca-payment --no-verify-jwt
 * Secrets: CCAVENUE_WORKING_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @deno-types="https://esm.sh/@types/crypto-js@4.2.1/index.d.ts"
import CryptoJS from "https://esm.sh/crypto-js@4.2.0";

const PREMIUM_DAYS = 30;

function decryptFromCCAvenue(encRespHex: string, workingKey: string): string {
  const keyHex = CryptoJS.MD5(workingKey).toString(CryptoJS.enc.Hex);
  const keyWA = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse("000102030405060708090a0b0c0d0e0f");

  const ciphertextWA = CryptoJS.enc.Hex.parse(encRespHex);
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ciphertextWA });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWA, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
}

function buildRedirectUrl(base: string, params: Record<string, string>): string {
  const sep = base.includes("?") ? "&" : "?";
  const qs = new URLSearchParams(params).toString();
  return `${base}${sep}${qs}`;
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const workingKey = Deno.env.get("CCAVENUE_WORKING_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!workingKey || !supabaseUrl || !serviceKey) {
      return new Response("Server not configured", { status: 503 });
    }

    // return_to is passed via redirect_url query param
    const url = new URL(req.url);
    const returnTo = url.searchParams.get("return_to") || "https://www.haathpe.com/payment/return";

    const rawBody = await req.text();
    const form = new URLSearchParams(rawBody);
    const encResp = form.get("encResp") || "";

    if (!encResp) {
      const location = buildRedirectUrl(returnTo, { status: "error", reason: "missing_encResp" });
      return new Response(null, { status: 302, headers: { Location: location } });
    }

    let decrypted = "";
    try {
      decrypted = decryptFromCCAvenue(encResp.trim(), workingKey);
    } catch (e) {
      console.error("[verify-cca-payment] decrypt failed:", e);
      const location = buildRedirectUrl(returnTo, { status: "error", reason: "decrypt_failed" });
      return new Response(null, { status: 302, headers: { Location: location } });
    }

    const respParams = new URLSearchParams(decrypted);
    const orderId = respParams.get("order_id") || "";
    const trackingId = respParams.get("tracking_id") || "";
    const orderStatusRaw = (respParams.get("order_status") || "").toLowerCase();
    const amount = respParams.get("amount") || "";

    const isSuccess = orderStatusRaw === "success";

    const supabase = createClient(supabaseUrl, serviceKey);

    // Premium flow: prem_<userId>_<ts>
    if (orderId.startsWith("prem_")) {
      const parts = orderId.split("_");
      const userId = parts.length >= 2 ? parts[1] : "";
      if (isSuccess && userId) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + PREMIUM_DAYS);
        const { error } = await supabase
          .from("profiles")
          .update({ premium_tier: "premium", premium_expires_at: expiresAt.toISOString() })
          .eq("id", userId);
        if (error) console.error("[verify-cca-payment] premium update:", error);
      }

      const location = buildRedirectUrl(returnTo, {
        order_id: orderId,
        status: isSuccess ? "success" : "failed",
        tracking_id: trackingId,
        amount,
      });
      return new Response(null, { status: 302, headers: { Location: location } });
    }

    // Normal orders: update customer_orders first, then orders
    if (orderId) {
      const { data: co, error: coErr } = await supabase
        .from("customer_orders")
        .select("id, status")
        .eq("id", orderId)
        .maybeSingle();

      if (!coErr && co?.id) {
        if (isSuccess) {
          await supabase
            .from("customer_orders")
            .update({
              status: "paid",
              payment_id: trackingId || "ccavenue",
            })
            .eq("id", orderId);
          await supabase.rpc("award_coins_for_paid_order", { p_order_id: orderId });
          await supabase.rpc("credit_vendor_receipt_from_order", { p_order_id: orderId });
          // ₹5 platform fee collected from customer → Haathpe revenue (online orders only)
          await supabase.rpc("record_platform_revenue_from_order", { p_order_id: orderId });
        }

        const location = buildRedirectUrl(returnTo, {
          order_id: orderId,
          status: isSuccess ? "success" : "failed",
          tracking_id: trackingId,
          amount,
        });
        return new Response(null, { status: 302, headers: { Location: location } });
      }

      const { data: ord, error: ordErr } = await supabase
        .from("orders")
        .select("id, status")
        .eq("id", orderId)
        .maybeSingle();

      if (!ordErr && ord?.id) {
        if (isSuccess) {
          await supabase.from("orders").update({ status: "paid" }).eq("id", orderId);
          await supabase.rpc("award_coins_for_paid_order", { p_order_id: orderId });
          await supabase.rpc("record_platform_revenue_from_catalog_order", { p_order_id: orderId });
        }
        const location = buildRedirectUrl(returnTo, {
          order_id: orderId,
          status: isSuccess ? "success" : "failed",
          tracking_id: trackingId,
          amount,
        });
        return new Response(null, { status: 302, headers: { Location: location } });
      }
    }

    const location = buildRedirectUrl(returnTo, {
      order_id: orderId || "unknown",
      status: isSuccess ? "success" : "failed",
      tracking_id: trackingId,
      amount,
      reason: "order_not_found",
    });
    return new Response(null, { status: 302, headers: { Location: location } });
  } catch (e) {
    console.error("verify-cca-payment:", e);
    return new Response("Internal error", { status: 500 });
  }
});

