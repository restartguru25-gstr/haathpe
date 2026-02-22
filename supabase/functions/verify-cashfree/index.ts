/**
 * Cashfree Secure ID verification: Bank, PAN, GSTIN.
 * Calls Cashfree VRS API server-side so keys are never exposed to client.
 *
 * Deploy: supabase functions deploy verify-cashfree
 * (Use default JWT verification - do NOT use --no-verify-jwt)
 *
 * Secrets (Supabase Dashboard > Project Settings > Edge Functions):
 *   CASHFREE_APP_ID  - x-client-id from Cashfree Verification dashboard
 *   CASHFREE_SECRET  - x-client-secret
 *
 * Client: supabase.functions.invoke("verify-cashfree", { body: { type, ... } })
 * Body: { type: "bank"|"pan"|"gstin", bank_account?, ifsc?, name?, phone?, pan?, GSTIN? }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function corsPreflight() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

const BASE = Deno.env.get("CASHFREE_VERIFICATION_BASE") || "https://api.cashfree.com/verification";

async function verifyBank(clientId: string, clientSecret: string, body: {
  bank_account: string;
  ifsc: string;
  name?: string;
  phone?: string;
}): Promise<{ ok: boolean; valid?: boolean; error?: string; message?: string }> {
  const res = await fetch(`${BASE}/bank-account/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
    },
    body: JSON.stringify({
      bank_account: body.bank_account.replace(/\s/g, ""),
      ifsc: body.ifsc?.trim().toUpperCase(),
      name: body.name?.trim() || undefined,
      phone: body.phone?.replace(/\D/g, "").slice(0, 13) || undefined,
    }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error: (data.message as string) || (data.code as string) || "Bank verification failed",
    };
  }
  const status = data.account_status as string;
  const valid = status === "VALID";
  return {
    ok: true,
    valid,
    message: valid ? "Bank account verified" : (data.account_status_code as string) || status,
  };
}

async function verifyPan(clientId: string, clientSecret: string, body: {
  pan: string;
  name?: string;
}): Promise<{ ok: boolean; valid?: boolean; error?: string; message?: string }> {
  const pan = (body.pan || "").trim().toUpperCase();
  if (!pan || pan.length !== 10) {
    return { ok: false, error: "PAN must be 10 characters" };
  }
  const res = await fetch(`${BASE}/pan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "x-api-version": "2022-10-26",
    },
    body: JSON.stringify({
      pan,
      name: body.name?.trim() || "VERIFY",
    }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error: (data.message as string) || (data.code as string) || "PAN verification failed",
    };
  }
  if (data.type === "validation_error" || data.type === "authentication_error") {
    return { ok: false, error: (data.message as string) || "PAN verification failed" };
  }
  const valid = data.valid === true;
  const message = (data.message as string) || (valid ? "PAN verified" : "Invalid PAN");
  return { ok: true, valid, message };
}

async function verifyGstin(clientId: string, clientSecret: string, body: {
  GSTIN: string;
  business_name?: string;
}): Promise<{ ok: boolean; valid?: boolean; error?: string; message?: string }> {
  const gstin = (body.GSTIN || "").trim().toUpperCase();
  if (!gstin || gstin.length !== 15) {
    return { ok: false, error: "GSTIN must be 15 characters" };
  }
  const res = await fetch(`${BASE}/gstin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
    },
    body: JSON.stringify({
      GSTIN: gstin,
      business_name: body.business_name?.trim() || undefined,
    }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error: (data.message as string) || (data.code as string) || "GSTIN verification failed",
    };
  }
  const valid = data.valid === true;
  const message = (data.message as string) || (valid ? "GSTIN verified" : "GSTIN invalid");
  return { ok: true, valid, message };
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return corsPreflight();
    if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

    const token = getBearerToken(req);
    if (!token) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

    const clientId = Deno.env.get("CASHFREE_VERIFICATION_APP_ID");
    const clientSecret = Deno.env.get("CASHFREE_VERIFICATION_SECRET");
    if (!clientId || !clientSecret) {
      return jsonResponse({ ok: false, error: "Cashfree credentials not configured" }, 503);
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const type = body.type as string;
    if (!type || !["bank", "pan", "gstin"].includes(type)) {
      return jsonResponse({ ok: false, error: "type must be bank, pan, or gstin" }, 400);
    }

    let result: { ok: boolean; valid?: boolean; error?: string; message?: string };

    if (type === "bank") {
      const bank = (body.bank_account ?? body.bankAccount ?? "").toString().trim();
      const ifsc = (body.ifsc ?? body.ifsc_code ?? "").toString().trim();
      if (!bank || !ifsc) {
        return jsonResponse({ ok: false, error: "bank_account and ifsc required" }, 400);
      }
      result = await verifyBank(clientId, clientSecret, {
        bank_account: bank,
        ifsc,
        name: body.name as string | undefined,
        phone: body.phone as string | undefined,
      });
    } else if (type === "pan") {
      const pan = (body.pan ?? body.pan_number ?? "").toString().trim();
      if (!pan) return jsonResponse({ ok: false, error: "pan required" }, 400);
      result = await verifyPan(clientId, clientSecret, {
        pan,
        name: body.name as string | undefined,
      });
    } else {
      const gstin = (body.gstin ?? body.GSTIN ?? body.gst_number ?? "").toString().trim();
      if (!gstin) return jsonResponse({ ok: false, error: "GSTIN required" }, 400);
      result = await verifyGstin(clientId, clientSecret, {
        GSTIN: gstin,
        business_name: (body.business_name ?? body.name) as string | undefined,
      });
    }

    return jsonResponse(result, 200);
  } catch (e) {
    console.error("[verify-cashfree]", e);
    const msg = e instanceof Error ? e.message : "Internal error";
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
