/**
 * CCAvenue Payment Gateway — create encrypted order request and return redirect payload.
 * Deploy: supabase functions deploy create-cca-order --no-verify-jwt
 * Secrets: CCAVENUE_MERCHANT_ID, CCAVENUE_ACCESS_CODE, CCAVENUE_WORKING_KEY.
 * Optional: CCAVENUE_MODE=TEST or PROD (default TEST).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="https://esm.sh/@types/crypto-js@4.2.1/index.d.ts"
import CryptoJS from "https://esm.sh/crypto-js@4.2.0";

const CCAVENUE_TEST_URL = "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction";
const CCAVENUE_PROD_URL = "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors } });
}

/** CCAvenue uses AES-128-CBC; key = MD5(working_key), IV = 0x00..0x0f */
function encryptForCCAvenue(plainText: string, workingKey: string): string {
  const key = CryptoJS.MD5(workingKey).toString(CryptoJS.enc.Hex);
  const keyWA = CryptoJS.enc.Hex.parse(key);
  const iv = CryptoJS.enc.Hex.parse("000102030405060708090a0b0c0d0e0f");
  const encrypted = CryptoJS.AES.encrypt(plainText, keyWA, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  // CCAvenue expects hex-encoded ciphertext (like PHP's bin2hex(openssl_encrypt(..., RAW_DATA))).
  return encrypted.ciphertext.toString(CryptoJS.enc.Hex);
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const merchantId = Deno.env.get("CCAVENUE_MERCHANT_ID");
    const accessCode = Deno.env.get("CCAVENUE_ACCESS_CODE");
    const workingKey = Deno.env.get("CCAVENUE_WORKING_KEY");
    const mode = (Deno.env.get("CCAVENUE_MODE") ?? "TEST").toUpperCase();
    const gatewayUrl = mode === "PROD" ? CCAVENUE_PROD_URL : CCAVENUE_TEST_URL;

    if (!merchantId || !accessCode || !workingKey) {
      return jsonResponse({ error: "CCAvenue not configured (missing merchant_id, access_code, or working_key)" }, 503);
    }

    let body: {
      order_id?: string;
      order_amount?: number;
      customer_phone?: string;
      customer_id?: string;
      customer_email?: string;
      return_url?: string;
      cancel_url?: string;
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
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
    const orderAmount = Number(body.order_amount);
    const returnUrl = typeof body.return_url === "string" ? body.return_url.trim() : "";
    const cancelUrl = typeof body.cancel_url === "string" ? body.cancel_url.trim() : returnUrl.replace(/order_id=[^&]+/, "order_id=cancelled");

    if (!orderId || orderAmount < 1 || !returnUrl) {
      return jsonResponse(
        { error: "order_id, order_amount (>= 1), and return_url are required" },
        400
      );
    }

    const billingName = typeof body.billing_name === "string" && body.billing_name.trim()
      ? body.billing_name.trim().slice(0, 100)
      : "Customer";
    const billingTel = typeof body.customer_phone === "string"
      ? body.customer_phone.replace(/\D/g, "").slice(-10) || "9999999999"
      : "9999999999";
    const billingEmail = typeof body.customer_email === "string" ? body.customer_email.trim().slice(0, 100) || "" : "";
    const billingAddress = typeof body.billing_address === "string" ? body.billing_address.trim().slice(0, 250) : "";
    const billingCity = typeof body.billing_city === "string" ? body.billing_city.trim().slice(0, 50) : "";
    const billingState = typeof body.billing_state === "string" ? body.billing_state.trim().slice(0, 50) : "";
    const billingZip = typeof body.billing_zip === "string" ? body.billing_zip.trim().slice(0, 10) : "";
    const billingCountry = typeof body.billing_country === "string" ? body.billing_country.trim().slice(0, 50) : "";

    const deliveryName = typeof body.delivery_name === "string" ? body.delivery_name.trim().slice(0, 100) : "";
    const deliveryAddress = typeof body.delivery_address === "string" ? body.delivery_address.trim().slice(0, 250) : "";
    const deliveryCity = typeof body.delivery_city === "string" ? body.delivery_city.trim().slice(0, 50) : "";
    const deliveryState = typeof body.delivery_state === "string" ? body.delivery_state.trim().slice(0, 50) : "";
    const deliveryZip = typeof body.delivery_zip === "string" ? body.delivery_zip.trim().slice(0, 10) : "";
    const deliveryCountry = typeof body.delivery_country === "string" ? body.delivery_country.trim().slice(0, 50) : "";
    const deliveryTel = typeof body.delivery_tel === "string" ? body.delivery_tel.replace(/\D/g, "").slice(-10) : "";

    // CCAvenue request string: key=value&key2=value2 (URL-encoded values)
    const params = new URLSearchParams();
    params.set("merchant_id", merchantId);
    params.set("order_id", orderId);
    params.set("amount", orderAmount.toFixed(2));
    params.set("currency", "INR");
    params.set("redirect_url", returnUrl);
    params.set("cancel_url", cancelUrl);
    params.set("billing_name", billingName);
    params.set("billing_tel", billingTel);
    if (billingEmail) params.set("billing_email", billingEmail);
    if (billingAddress) params.set("billing_address", billingAddress);
    if (billingCity) params.set("billing_city", billingCity);
    if (billingState) params.set("billing_state", billingState);
    if (billingZip) params.set("billing_zip", billingZip);
    if (billingCountry) params.set("billing_country", billingCountry);

    if (deliveryName) params.set("delivery_name", deliveryName);
    if (deliveryAddress) params.set("delivery_address", deliveryAddress);
    if (deliveryCity) params.set("delivery_city", deliveryCity);
    if (deliveryState) params.set("delivery_state", deliveryState);
    if (deliveryZip) params.set("delivery_zip", deliveryZip);
    if (deliveryCountry) params.set("delivery_country", deliveryCountry);
    if (deliveryTel) params.set("delivery_tel", deliveryTel);
    if (body.order_note) params.set("merchant_param1", String(body.order_note).slice(0, 100));

    const plainRequest = params.toString();
    const encRequest = encryptForCCAvenue(plainRequest, workingKey);

    return jsonResponse({
      ok: true,
      order_id: orderId,
      enc_request: encRequest,
      gateway_url: gatewayUrl,
      access_code: accessCode,
    });
  } catch (e) {
    console.error("create-cca-order:", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
