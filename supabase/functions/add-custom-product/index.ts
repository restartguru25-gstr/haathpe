/**
 * Add custom vendor menu item server-side (avoids client AbortError + RLS).
 *
 * Deploy:
 *   supabase functions deploy add-custom-product --no-verify-jwt
 *
 * Secrets required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Client:
 *   supabase.functions.invoke("add-custom-product", { body: { item_name, custom_selling_price, sort_order } })
 *
 * RLS migration (run in Supabase SQL Editor if vendor_menu_items INSERT fails):
 *   ALTER TABLE public.vendor_menu_items ENABLE ROW LEVEL SECURITY;
 *   DROP POLICY IF EXISTS "Vendor can manage own menu" ON public.vendor_menu_items;
 *   CREATE POLICY "Vendor can manage own menu" ON public.vendor_menu_items
 *     FOR ALL USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);
 *   DROP POLICY IF EXISTS "Anyone can read active vendor menu" ON public.vendor_menu_items;
 *   CREATE POLICY "Anyone can read active vendor menu" ON public.vendor_menu_items
 *     FOR SELECT USING (is_active = true);
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

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return corsPreflight();
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("[add-custom-product] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return jsonResponse({ error: "Server misconfiguration" }, 503);
    }

    const token = getBearerToken(req);
    if (!token) {
      console.error("[add-custom-product] No Authorization header");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const itemName = typeof body.item_name === "string" ? body.item_name.trim() : "";
    const price = Number(body.custom_selling_price);
    const sortOrder = typeof body.sort_order === "number" ? body.sort_order : 0;
    const gstRate = typeof body.gst_rate === "number" ? body.gst_rate : 5;

    if (!itemName) {
      return jsonResponse({ error: "Item name is required" }, 400);
    }
    if (Number.isNaN(price) || price < 0) {
      return jsonResponse({ error: "Valid price (₹) is required" }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      console.error("[add-custom-product] Invalid token:", userError?.message);
      return jsonResponse({ error: "Invalid token" }, 401);
    }
    const vendorId = userData.user.id;

    const row = {
      vendor_id: vendorId,
      default_menu_item_id: null,
      item_name: itemName,
      description: null,
      default_selling_price_range: null,
      gst_rate: gstRate,
      custom_selling_price: price,
      custom_description: null,
      image_url: "🍽️",
      is_active: true,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("vendor_menu_items")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("[add-custom-product] insert error:", error);
      return jsonResponse({ error: error.message }, 400);
    }

    console.log("[add-custom-product] success:", { vendorId, itemName, id: data?.id });
    return jsonResponse({ ok: true, id: data?.id }, 200);
  } catch (e) {
    console.error("[add-custom-product] unexpected:", e);
    const msg = e instanceof Error ? e.message : "Internal error";
    return jsonResponse({ error: msg }, 500);
  }
});
