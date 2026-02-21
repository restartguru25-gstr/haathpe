// Public endpoint (no JWT). Verifies phone+mpin from customer_profiles, sets Auth credentials.
// Client then calls signInWithPassword. Deploy with: verify_jwt = false

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
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    let body: { phone?: string; mpin?: string };
    try {
      body = (await req.json()) as { phone?: string; mpin?: string };
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const mpin = typeof body.mpin === "string" ? body.mpin.replace(/\D/g, "").slice(0, 4) : "";
    if (phone.length < 10 || mpin.length !== 4) {
      return jsonResponse({ error: "Phone and 4-digit MPIN required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: row, error: qErr } = await supabase
      .from("customer_profiles")
      .select("id, mpin")
      .eq("phone", phone)
      .maybeSingle();

    if (qErr || !row) {
      return jsonResponse({ error: "Invalid phone or MPIN" }, 401);
    }
    if (row.mpin !== mpin) {
      return jsonResponse({ error: "Invalid phone or MPIN" }, 401);
    }

    const digits = phone.replace(/\D/g, "").slice(-10);
    const syntheticEmail = `p${digits}@mpin.local`;
    const paddedPassword = mpin + "00";

    const { error: updateErr } = await supabase.auth.admin.updateUserById(row.id, {
      email: syntheticEmail,
      password: paddedPassword,
      email_confirm: true,
    });

    if (updateErr) {
      console.error("prepare-mpin-signin:", updateErr);
      return jsonResponse({ error: updateErr.message }, 400);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("prepare-mpin-signin:", e);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
