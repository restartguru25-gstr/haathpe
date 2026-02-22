/**
 * Update vendor profile server-side (avoids client AbortError + RLS confusion).
 *
 * Deploy:
 *   supabase functions deploy update-profile
 * (JWT verification enabled by default)
 *
 * Secrets required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Client:
 *   supabase.functions.invoke("update-profile", { body: { ...fields } })
 *
 * Notes:
 * - JWT validated by Supabase before request reaches handler.
 * - We resolve user ID from Authorization header and update profiles via Service Role.
 * - Only whitelisted fields can be updated (includes bank_account_number, ifsc_code, bank_verified, pan_verified, gstin_verified).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type AllowedUpdate =
  | "name"
  | "phone"
  | "stall_type"
  | "stall_address"
  | "business_address"
  | "shop_photo_urls"
  | "gst_number"
  | "pan_number"
  | "udyam_number"
  | "fssai_license"
  | "other_business_details"
  | "upi_id"
  | "opening_hours"
  | "weekly_off"
  | "holidays"
  | "is_online"
  | "alert_volume"
  | "bank_account_number"
  | "ifsc_code"
  | "bank_verified"
  | "pan_verified"
  | "gstin_verified";

const ALLOWED_FIELDS: ReadonlySet<AllowedUpdate> = new Set<AllowedUpdate>([
  "name",
  "phone",
  "stall_type",
  "stall_address",
  "business_address",
  "shop_photo_urls",
  "gst_number",
  "pan_number",
  "udyam_number",
  "fssai_license",
  "other_business_details",
  "upi_id",
  "opening_hours",
  "weekly_off",
  "holidays",
  "is_online",
  "alert_volume",
  "bank_account_number",
  "ifsc_code",
  "bank_verified",
  "pan_verified",
  "gstin_verified",
]);

function pickAllowed(body: Record<string, unknown>) {
  const update: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      update[key] = body[key];
    }
  }
  return update;
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

    const token = getBearerToken(req);
    if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const update = pickAllowed(body);
    if (Object.keys(update).length === 0) {
      return jsonResponse({ error: "No updatable fields provided" }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }
    const userId = userData.user.id;

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id")
      .single();

    if (updateError) {
      console.error("[update-profile] update error:", updateError);
      return jsonResponse({ error: updateError.message }, 400);
    }

    return jsonResponse({ ok: true, userId }, 200);
  } catch (e) {
    console.error("[update-profile] unexpected:", e);
    const msg = e instanceof Error ? e.message : "Internal error";
    return jsonResponse({ error: msg }, 500);
  }
});

