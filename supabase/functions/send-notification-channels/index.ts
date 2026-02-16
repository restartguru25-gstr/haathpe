// VendorHub: stub for sending notifications via push/SMS/WhatsApp.
// Deploy: supabase functions deploy send-notification-channels
// Add web-push (VAPID), Twilio SMS, or WhatsApp API here and read push_subscriptions from DB.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface Payload {
  user_id: string;
  title: string;
  body: string | null;
  type: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  try {
    const payload = (await req.json()) as Payload;
    // TODO: fetch push_subscriptions for payload.user_id, send web-push
    // TODO: if SMS/WhatsApp enabled, call Twilio or WhatsApp API
    console.log("send-notification-channels", payload);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
});
