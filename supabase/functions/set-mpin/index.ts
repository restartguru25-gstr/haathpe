// Sets MPIN after OTP verify. Requires authenticated session.
// Uses Admin API to set synthetic email p{phone}@mpin.local and password (mpin+"00").
// Deploy: supabase functions deploy set-mpin

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: { mpin?: string };
    try {
      body = (await req.json()) as { mpin?: string };
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const mpin = typeof body.mpin === "string" ? body.mpin.replace(/\D/g, "").slice(0, 4) : "";
    if (mpin.length !== 4) {
      return jsonResponse({ error: "MPIN must be 4 digits" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify user session (validates JWT)
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey ?? "", {});
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    const phone = user.phone ?? (user.user_metadata?.phone as string | undefined);
    const phoneDigits = (phone || "").replace(/\D/g, "").slice(-10);
    if (phoneDigits.length !== 10) {
      return jsonResponse({ error: "Phone number required for MPIN" }, 400);
    }

    const syntheticEmail = `p${phoneDigits}@mpin.local`;
    const paddedPassword = mpin + "00";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: syntheticEmail,
      password: paddedPassword,
      email_confirm: true,
    });

    if (updateError) {
      console.error("set-mpin updateUserById:", updateError);
      return jsonResponse({ error: updateError.message }, 400);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("set-mpin:", e);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
