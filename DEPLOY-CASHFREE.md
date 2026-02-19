# Deploy Cashfree Edge Functions

**Important:** This app is **Vite + React**, not Next.js. There is **no** `/api/create-cashfree-order` route. The backend is the **Supabase Edge Function** at:

- `https://<your-project-ref>.supabase.co/functions/v1/create-cashfree-order`

The frontend calls this URL (with `Authorization` and `apikey` headers) from `src/lib/cashfree.ts` → `createCashfreeSession()`. If you see "backend not found" or timeout, the Edge Function is missing or not deployed — see below.

---

## Troubleshooting: Payment not opening / silent fail

| Cause | What to check |
|-------|----------------|
| **Backend route wrong** | We do **not** use `https://haathpe.com/api/create-cashfree-order`. We use the **Supabase Edge Function** URL. In the browser console, step 2/3 will show the real URL (e.g. `https://xxx.supabase.co/functions/v1/create-cashfree-order`). If that returns 404, deploy the function (Option A or B below). |
| **Vercel env vars** | Only **client** vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CASHFREE_APP_ID`, `VITE_CASHFREE_MODE=production`. Do **not** put `CASHFREE_SECRET_KEY` in Vercel (it must stay in Supabase secrets). |
| **Supabase secrets** | Dashboard → Edge Functions → Secrets: `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, and optionally `CASHFREE_ENV=production`. |
| **Fetch aborted / CORS** | Console logs 1–9 show where it stops. If it stops at step 3 with no "4. Raw response body", the request was aborted or blocked (timeout, CORS, or network). Ensure **Verify JWT** is **OFF** for all Cashfree functions: `create-cashfree-order`, `verify-cashfree-payment`, `finalize-order-after-payment` (Supabase → Edge Functions → each function → Settings → Verify JWT = OFF). If JWT is ON, the preflight OPTIONS request is rejected before your code runs, causing CORS errors. |
| **Backend 500** | Check Supabase Dashboard → Edge Functions → create-cashfree-order → Logs. Fix payload or missing env (e.g. Cashfree keys). |

**Test the backend manually (Postman or curl):**

- **URL:** `https://<project-ref>.supabase.co/functions/v1/create-cashfree-order`
- **Method:** POST  
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <VITE_SUPABASE_ANON_KEY>`, `apikey: <VITE_SUPABASE_ANON_KEY>`
- **Body (JSON):** `{ "order_id": "test-1", "order_amount": 100, "return_url": "https://haathpe.com/payment/return?order_id=test-1" }`  
- **Expected:** 200 OK with `{ "payment_session_id": "...", "order_id": "test-1" }`. If 404 → function not deployed. If 503 → secrets missing.

**CORS / "blocked by CORS policy" / "Failed to fetch" on finalize-order-after-payment:**

- Supabase rejects the preflight OPTIONS request **before** your function runs if **Verify JWT** is ON. The browser never gets CORS headers.
- **Fix:** Supabase Dashboard → Edge Functions → `finalize-order-after-payment` → Settings (or Details) → turn **Verify JWT** OFF.
- Or redeploy: `npx supabase functions deploy finalize-order-after-payment --no-verify-jwt`
- Test OPTIONS: `curl -X OPTIONS -i "https://tobpayhdvdoduspxdrjz.supabase.co/functions/v1/finalize-order-after-payment"` → should return 200 with `Access-Control-Allow-Origin` header.

---

You can either use the **CLI** (terminal) or create the functions **in the Supabase Dashboard** (browser).

---

## Option A: CLI (terminal)

Run these commands **in your terminal** from the project folder.

### 1. Log in to Supabase (once)

```bash
cd /home/surya/Downloads/bizcart-india-main
npx supabase login
```

A browser window will open; sign in and allow access.

### 2. Link this project (if not already linked)

```bash
npx supabase link --project-ref tobpayhdvdoduspxdrjz
```

Enter the database password if prompted (from Supabase Dashboard → Project Settings → Database).

### 3. Deploy the Cashfree functions

```bash
npx supabase functions deploy create-cashfree-order --no-verify-jwt
npx supabase functions deploy verify-cashfree-payment --no-verify-jwt
npx supabase functions deploy finalize-order-after-payment --no-verify-jwt
npx supabase functions deploy cashfree-webhook --no-verify-jwt
```

### 4. Verify

- In **Supabase Dashboard** → your project → **Edge Functions**, you should see:
  - `create-cashfree-order`
  - `verify-cashfree-payment` (confirms payment via Cashfree API)
  - `finalize-order-after-payment` (server-side order insert + coins — avoids client AbortError)
  - `cashfree-webhook`
- In your app, open **http://localhost:8080/payment/return** and click **Test Cashfree connection**. You should get a success or a clear error message.

---

## Option B: Create in Supabase Dashboard (browser)

1. Open **Supabase Dashboard** → your project → **Edge Functions**.
2. Click **Create a new function**.
3. **First function: `create-cashfree-order`**
   - Name: **create-cashfree-order** (must match exactly).
   - Replace the default code with the code below (for **create-cashfree-order**).
   - Save / Deploy.
4. **Second function: `cashfree-webhook`**
   - Create another function, name: **cashfree-webhook**.
   - Replace the default code with the code below (for **cashfree-webhook**).
   - Save / Deploy.
5. Set **Secrets** (Edge Functions → Secrets): `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`.
6. For **create-cashfree-order**: open the function → **Function configuration** → set **Verify JWT** to **OFF** and Save. (If ON, the gateway may reject the request before your code runs and the browser can show "Could not reach the payment server".)

### Code for `create-cashfree-order`

Paste this as the full body of the function. (Uses string concatenation instead of template literals so the dashboard bundler accepts it.)

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CASHFREE_SANDBOX = "https://sandbox.cashfree.com/pg";
const CASHFREE_PROD = "https://api.cashfree.com/pg";
const API_VERSION = "2023-08-01";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const appId = Deno.env.get("CASHFREE_APP_ID");
  const secret = Deno.env.get("CASHFREE_SECRET_KEY");
  const env = (Deno.env.get("CASHFREE_ENV") ?? "sandbox").toLowerCase();
  const baseUrl = env === "production" ? CASHFREE_PROD : CASHFREE_SANDBOX;

  if (!appId || !secret) return jsonResponse({ error: "Cashfree not configured" }, 503);

  try {
    const body = (await req.json()) as {
      order_id: string;
      order_amount: number;
      customer_phone?: string;
      customer_id?: string;
      customer_email?: string;
      return_url: string;
      order_note?: string;
    };

    const orderId = body.order_id?.trim();
    const orderAmount = Number(body.order_amount);
    const returnUrl = body.return_url?.trim();
    if (!orderId || orderAmount < 1 || !returnUrl) {
      return jsonResponse({ error: "order_id, order_amount (>= 1), and return_url are required" }, 400);
    }

    const payload = {
      order_id: orderId,
      order_amount: orderAmount,
      order_currency: "INR",
      customer_details: {
        customer_id: body.customer_id?.trim() || orderId,
        customer_phone: body.customer_phone?.replace(/\D/g, "").slice(-10) || "9999999999",
        customer_email: body.customer_email?.trim() || undefined,
      },
      order_meta: { return_url: returnUrl },
      order_note: body.order_note?.slice(0, 500) || undefined,
    };

    const ordersUrl = baseUrl + "/orders";
    const res = await fetch(ordersUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": API_VERSION,
        "x-client-id": appId,
        "x-client-secret": secret,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return jsonResponse({ error: (data as { message?: string }).message || "Cashfree order creation failed", details: data }, res.status);
    }

    const paymentSessionId = (data as { payment_session_id?: string }).payment_session_id;
    if (!paymentSessionId) return jsonResponse({ error: "No payment_session_id in response", details: data }, 502);

    return jsonResponse({ payment_session_id: paymentSessionId, order_id: orderId });
  } catch (e) {
    console.error("create-cashfree-order:", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
```

### Code for `cashfree-webhook`

Paste this as the full body of the function:

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: cors });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const raw = await req.text();
    const body = JSON.parse(raw) as {
      type?: string;
      data?: {
        order?: { order_id?: string };
        payment?: { cf_payment_id?: string; payment_status?: string; order_id?: string };
      };
    };

    const type = body.type ?? "";
    const orderId = body.data?.order?.order_id ?? body.data?.payment?.order_id;
    const cfPaymentId = body.data?.payment?.cf_payment_id;
    const paymentStatus = body.data?.payment?.payment_status;

    if (!orderId) return jsonResponse({ received: true, skip: "no order_id" });

    const isSuccess = type === "PAYMENT_SUCCESS" || type === "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus === "SUCCESS";
    if (!isSuccess) return jsonResponse({ received: true });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: order, error: fetchErr } = await supabase
      .from("customer_orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (fetchErr || !order) return jsonResponse({ received: true, skip: "order not found" });
    if ((order as { status?: string }).status === "paid") return jsonResponse({ received: true, duplicate: true });

    const { error: updateErr } = await supabase
      .from("customer_orders")
      .update({ status: "paid", payment_id: cfPaymentId ?? "cashfree" })
      .eq("id", orderId);

    if (updateErr) {
      console.error("cashfree-webhook update:", updateErr);
      return jsonResponse({ error: updateErr.message }, 500);
    }
    return jsonResponse({ received: true, order_id: orderId, updated: true });
  } catch (e) {
    console.error("cashfree-webhook:", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
```

---

## Database fix: Vendor search (error 42702)

If the **Find dukaanwaale** / vendor search page shows:

`column reference "vendor_id" is ambiguous`

run the fix in Supabase:

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Click **New query**, paste the contents of **`supabase/fix-vendor-search-ambiguous-vendor_id.sql`**, then **Run**.
3. You should see **Success. No rows returned.** Vendor search should work after that.

---

## Production (e.g. Vercel): Cart / Buy supplies checkout

For **Buy supplies → Cart → Place order** to open Cashfree, the **host** (e.g. Vercel) must have these **Environment Variables** set (Vercel → Project → Settings → Environment Variables):

- `VITE_SUPABASE_URL` (your Supabase project URL)
- `VITE_SUPABASE_ANON_KEY` (anon key)
- `VITE_CASHFREE_APP_ID` (Cashfree App ID)
- `VITE_CASHFREE_MODE` = `production` or `sandbox`

Redeploy after adding them. Without these, checkout will place the order but will not redirect to Cashfree.

---

## Performance and UX

- **My Shop / Sales:** If the page stays loading, it now stops after 12 seconds so you see content or can retry. Dashboard data (incentives, orders) failures no longer block the page.
- **Search:** If you see "column reference vendor_id is ambiguous", run the SQL fix (see Database fix above). The Search page now shows a clear error and "Try again" when the RPC fails.
- **Cart checkout:** You’ll see "Redirecting to payment…" when Cashfree is about to open; if the gateway fails, you’re sent to Orders with a message.
- **General:** Routes are lazy-loaded; keep Supabase and (if used) Vercel in the same region for lower latency.

---

## Secrets (set in Dashboard)

Ensure these are set in **Supabase Dashboard** → **Edge Functions** → **Secrets** (or Project Settings → Edge Functions):

- `CASHFREE_APP_ID`
- `CASHFREE_SECRET_KEY`
- `CASHFREE_ENV` = `production` (or `sandbox` for testing)
