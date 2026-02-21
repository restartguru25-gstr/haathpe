# Payment Gateway Audit — Cash & Pay Online

This document audits all payment points in the app and confirms Cashfree integration.

---

## Summary

| Payment Point | Route | Cash | Pay Online (Cashfree) | Status |
|---------------|-------|------|------------------------|--------|
| **POS** (Vendor) | `/pos` | ✅ Cash Paid | ✅ Generate UPI QR | ✅ Complete |
| **Public Menu** (Browse & order) | `/menu/:id/browse` | ✅ Implicit (pay at dukaan) | ✅ Place order → Cashfree | ✅ Complete |
| **Pay Direct** (Enter amount) | `/menu/:id/pay` | ✅ Implicit (pay at counter) | ✅ Pay → Cashfree | ✅ Complete |
| **Cart** (Buy supplies) | `/cart` | N/A (supply orders) | ✅ Place order → Cashfree | ✅ Complete |
| **Swap** | `/swap` | N/A | N/A | No payment (barter/excess stock) |

---

## 1. POS — Vendor Point of Sale

**Route:** `/pos` (linked from Sales → "Quick POS")

**Options:**
- **Cash Paid** — Creates `customer_order` with `payment_method: "cash"`, status updated immediately.
- **Generate UPI QR** — Creates `customer_order` with `payment_method: "online"`, then opens Cashfree in a new tab. Customer pays via UPI/card. Webhook marks order as paid.

**Code:** `src/pages/POS.tsx`
- `handleCashPaid` → Cash flow
- `handleUpiQr` → Cashfree flow (`createCashfreeSession` + `openCashfreeCheckout` with `redirectTarget: "_blank"`)

**Fallback:** If Cashfree not configured, toast says "Use Cash for now."

---

## 2. Public Menu — Customer Orders from Vendor

**Route:** `/menu/:vendorId/browse` (from VendorEntry → "Browse menu")

**Flow:**
- Single **Place order** button.
- If `payAtDukaan > 0` and Cashfree configured → Opens Cashfree checkout (Pay Online).
- If full wallet covers total → Order placed, no Cashfree.
- If Cashfree not configured → Order placed as pending; customer pays at dukaan when collecting (Cash / UPI at counter).

**Code:** `src/pages/PublicMenu.tsx` → `handlePayOnline`

**Return:** `/payment/return?order_id=...` — Webhook or client verification marks `customer_orders` as paid.

---

## 3. Pay Direct — Enter Amount & Pay

**Route:** `/menu/:vendorId/pay` (from VendorEntry → "Pay directly")

**Flow:**
- Enter amount → **Pay** button.
- If Cashfree configured → Opens Cashfree (Pay Online).
- If not configured → Creates order, shows "Payment request sent! Pay at the counter."

**Code:** `src/pages/PayDirect.tsx` → `handlePay`

---

## 4. Cart — Buy Supplies (Vendors)

**Route:** `/cart` (from Catalog)

**Flow:**
- **Place order** → If Cashfree configured, creates Cashfree session, opens checkout.
- If not configured → Inserts into `orders` table (supply order, pending).
- No explicit Cash option (supply orders are typically online or on delivery).

**Code:** `src/pages/Cart.tsx` → `handlePlaceOrder`

**Return:** `/payment/return?order_id=...` — `finalizeOrderAfterPayment` inserts into `orders` after verification.

---

## 5. Swap — No Payment

**Route:** `/swap`

No payment gateway. Vendors post excess stock; no money flow in-app.

---

## QR Code Entry Points

| QR / Link | Landing Page | Payment Flow |
|-----------|--------------|--------------|
| `/menu/:vendorId` | VendorEntry | Two choices: Browse menu → PublicMenu, Pay directly → PayDirect |
| Browse menu | PublicMenu | Place order → Cashfree or pay at dukaan |
| Pay directly | PayDirect | Pay → Cashfree or pay at counter |

---

## Webhook & Return URLs

- **Webhook:** `https://<project-ref>.supabase.co/functions/v1/cashfree-webhook`  
  - Event: **PAYMENT_SUCCESS**  
  - Updates `customer_orders` status to `paid`.

- **Return URL:** `/payment/return?order_id=<id>`  
  - Verifies payment via Cashfree.  
  - For Cart: calls `finalizeOrderAfterPayment` to insert into `orders`.  
  - For customer_orders: webhook usually updates first; client shows success.

---

## Env & Deploy Checklist

- [ ] `VITE_CASHFREE_APP_ID` in .env (and Vercel)
- [ ] `VITE_CASHFREE_MODE=production` (or sandbox)
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Supabase Edge Functions: `create-cashfree-order`, `verify-cashfree-payment`, `finalize-order-after-payment`, `cashfree-webhook`
- [ ] Supabase Secrets: `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`
- [ ] Cashfree Dashboard: Webhook URL with `PAYMENT_SUCCESS`
- [ ] Verify JWT = **OFF** for all Cashfree functions

---

## Implemented: Pay at Dukaan Option

**Explicit "Pay at dukaan (cash)" on Public Menu** ✅  
When Cashfree is configured and the customer has an amount to pay (`payAtDukaan > 0`), they see two options:
- **Pay online now** — Card, UPI, etc. (Cashfree)
- **Pay at dukaan when I collect** — Cash or UPI at counter (order placed as pending)
