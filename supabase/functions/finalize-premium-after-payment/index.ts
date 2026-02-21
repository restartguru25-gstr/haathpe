/**
 * Finalize premium upgrade after Cashfree payment success.
 * Verifies payment, sets premium_tier='premium' and premium_expires_at = now + 30 days.
 *
 * Deploy: supabase functions deploy finalize-premium-after-payment --no-verify-jwt
 * Secrets: CASHFREE_APP_ID, CASHFREE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CASHFREE_SANDBOX = "https://sandbox.cashfree.com/pg";
const CASHFREE_PROD = "https://api.cashfree.com/pg";
const API_VERSION = "2023-08-01";
const PREMIUM_DAYS = 30;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Server misconfiguration" }, 503);
    }

    let body: { orderId?: string; userId?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!orderId || !userId || !orderId.startsWith("prem_")) {
      return jsonResponse({ error: "orderId (prem_*) and userId required" }, 400);
    }

    const isPaid = await verifyCashfreePaid(orderId);
    if (!isPaid) {
      return jsonResponse({ error: "Payment not confirmed" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + PREMIUM_DAYS);

    const { error } = await supabase
      .from("profiles")
      .update({
        premium_tier: "premium",
        premium_expires_at: expiresAt.toISOString(),
      })
      .eq("id", userId);

    if (error) {
      console.error("finalize-premium update:", error);
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    return jsonResponse({
      ok: true,
      order_id: orderId,
      premium_expires_at: expiresAt.toISOString(),
    });
  } catch (e) {
    console.error("finalize-premium-after-payment:", e);
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
