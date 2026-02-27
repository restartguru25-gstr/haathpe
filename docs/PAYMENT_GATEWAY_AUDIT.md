# Payment Gateway Audit — Cash & Pay Online

This document audits all payment points in the app and confirms CCAvenue integration.

---

## Summary

| Payment Point | Route | Cash | Pay Online (CCAvenue) | Status |
|---------------|-------|------|------------------------|--------|
| **POS** (Vendor) | `/pos` | ✅ Cash Paid | ✅ Generate UPI QR | ✅ Complete |
| **Public Menu** (Browse & order) | `/menu/:id/browse` | ✅ Implicit (pay at dukaan) | ✅ Place order → CCAvenue | ✅ Complete |
| **Pay Direct** (Enter amount) | `/menu/:id/pay` | ✅ Implicit (pay at counter) | ✅ Pay → CCAvenue | ✅ Complete |
| **Cart** (Buy supplies) | `/cart` | N/A (supply orders) | ✅ Place order → CCAvenue | ✅ Complete |
| **Swap** | `/swap` | N/A | N/A | No payment (barter/excess stock) |

---

## 1. POS — Vendor Point of Sale

**Route:** `/pos` (linked from Sales → "Quick POS")

**Options:**
- **Cash Paid** — Creates `customer_order` with `payment_method: "cash"`, status updated immediately.
- **Generate UPI QR** — Creates `customer_order` with `payment_method: "online"`, then opens CCAvenue in a new tab. Customer pays via UPI/card. Return handler marks order as paid.

**Code:** `src/pages/POS.tsx`
- `handleCashPaid` → Cash flow
- `handleUpiQr` → CCAvenue flow (`createCcaOrder` + redirect with `encRequest`)

**Fallback:** If payment gateway not configured, toast says "Use Cash for now."

---

## 2. Public Menu — Customer Orders from Vendor

**Route:** `/menu/:vendorId/browse` (from VendorEntry → "Browse menu")

**Flow:**
- Single **Place order** button.
- If `payAtDukaan > 0` and CCAvenue configured → Redirects to CCAvenue checkout (Pay Online).
- If full wallet covers total → Order placed, no redirect.
- If payment gateway not configured → Order placed as pending; customer pays at dukaan when collecting (Cash / UPI at counter).

**Code:** `src/pages/PublicMenu.tsx` → `handlePayOnline`

**Return:** `/payment/return?order_id=...` — return handler updates `customer_orders` as paid.

---

## 3. Pay Direct — Enter Amount & Pay

**Route:** `/menu/:vendorId/pay` (from VendorEntry → "Pay directly")

**Flow:**
- Enter amount → **Pay** button.
- If CCAvenue configured → Redirects to CCAvenue (Pay Online).
- If not configured → Creates order, shows "Payment request sent! Pay at the counter."

**Code:** `src/pages/PayDirect.tsx` → `handlePay`

---

## 4. Cart — Buy Supplies (Vendors)

**Route:** `/cart` (from Catalog)

**Flow:**
- **Place order** → If CCAvenue configured, creates encrypted request and redirects to CCAvenue.
- If not configured → Inserts into `orders` table (supply order, pending).
- No explicit Cash option (supply orders are typically online or on delivery).

**Code:** `src/pages/Cart.tsx` → `handlePlaceOrder`

**Return:** `/payment/return?order_id=...` — return handler updates `orders` after verification.

---

## 5. Swap — No Payment

**Route:** `/swap`

No payment gateway. Vendors post excess stock; no money flow in-app.

---

## QR Code Entry Points

| QR / Link | Landing Page | Payment Flow |
|-----------|--------------|--------------|
| `/menu/:vendorId` | VendorEntry | Two choices: Browse menu → PublicMenu, Pay directly → PayDirect |
| Browse menu | PublicMenu | Place order → CCAvenue or pay at dukaan |
| Pay directly | PayDirect | Pay → CCAvenue or pay at counter |

---

## Return URL (CCAvenue)

- **Return handler (POST from CCAvenue):** `https://<project-ref>.supabase.co/functions/v1/verify-cca-payment?return_to=<your_return_page>`  
  - Decrypts `encResp` server-side using the working key.  
  - Updates `customer_orders/orders.status = 'paid'` on Success.  
  - Calls `award_coins_for_paid_order` (idempotent).  
  - Redirects browser to `/payment/return?order_id=<id>`.

---

## Env & Deploy Checklist

- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Supabase Edge Functions: `create-cca-order`, `verify-cca-payment`
- [ ] Supabase Secrets: `CCAVENUE_MERCHANT_ID`, `CCAVENUE_ACCESS_CODE`, `CCAVENUE_WORKING_KEY`, `CCAVENUE_MODE`
- [ ] Verify JWT = **OFF** for `verify-cca-payment`

---

## Implemented: Pay at Dukaan Option

**Explicit "Pay at dukaan (cash)" on Public Menu** ✅  
When CCAvenue is configured and the customer has an amount to pay (`payAtDukaan > 0`), they see two options:
- **Pay online now** — Card, UPI, etc. (CCAvenue)
- **Pay at dukaan when I collect** — Cash or UPI at counter (order placed as pending)
