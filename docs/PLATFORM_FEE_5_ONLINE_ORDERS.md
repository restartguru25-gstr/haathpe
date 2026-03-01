# ₹5 Platform Fee — Online Orders Flow

**Updated ₹5 Platform Fee Flow: Collected from Customer → Haathpe; Vendor gets subtotal -1.2%; Delivery to Riders**

## Summary

- **Customer total** = Products/subtotal + GST + Delivery (actual/placeholder) + **Flat ₹5 Platform Fee** (online only).
- **Vendor** receives: **subtotal − 1.2%** (no deduction for the ₹5 platform fee).
- **Riders** receive: full delivery charges (pass-through; platform handles payout or separate).
- **Haathpe** receives: **flat ₹5 per online order** as revenue.
- **No ₹5** on POS / in-store / pay-at-dukaan orders.

---

## 1. DB schema additions

**File:** `supabase/migrations/20260229000001_platform_fee_5_online_orders.sql`

- **customer_orders**
  - `platform_fee_amount` DECIMAL(12,2) NOT NULL DEFAULT 0  
  - `delivery_fee_amount` DECIMAL(12,2) NOT NULL DEFAULT 0  
  - `is_online` BOOLEAN NOT NULL DEFAULT false  
- **platform_revenue**
  - New table: `id`, `order_id`, `amount`, `source` ('online_order' | 'catalog_order'), `created_at`.  
  - Used to log ₹5 per paid online order.
- **orders** (catalog/Cart)
  - `platform_fee_amount` DECIMAL(12,2) NOT NULL DEFAULT 0  
- **get_order_receipt**
  - Return columns: `subtotal`, `delivery_fee_amount`, `platform_fee_amount` for invoice breakdown.
- **Refunds:** When implementing refunds, reverse or debit `platform_revenue` (not implemented in this change).

---

## 2. RPCs / triggers

- **credit_vendor_receipt_from_order**
  - Uses **subtotal** (not total).
  - Vendor credit = **subtotal − 1.2%** (₹5 is not deducted from vendor).
- **record_platform_revenue_from_order**
  - For paid `customer_orders` with `is_online` and `platform_fee_amount > 0`: insert one row into `platform_revenue`.
- **record_platform_revenue_from_catalog_order**
  - For paid `orders` with `platform_fee_amount > 0`: insert one row into `platform_revenue` (source `catalog_order`).

---

## 3. Edge functions

- **create-cca-order**
  - No change. Order is created on the frontend with `subtotal`, `delivery_fee_amount`, `platform_fee_amount`, `is_online`; CCAvenue is called with `order_amount` = customer total (subtotal + gst + delivery + platform fee).
- **verify-cca-payment**
  - After marking `customer_orders` paid:  
    `credit_vendor_receipt_from_order` → `record_platform_revenue_from_order`.
  - After marking `orders` paid:  
    `record_platform_revenue_from_catalog_order`.

---

## 4. Frontend

- **PublicMenu**
  - Order summary: Products, Delivery (if > 0), Platform Fee ₹5 (when paying online), Total.
  - `createCustomerOrder` is called with `delivery_fee_amount`, `platform_fee_amount` (5 when online), `is_online`.
- **PayDirect**
  - Online: customer total = amount + ₹5; summary shows Amount + Platform Fee ₹5; `createDirectPaymentOrder(..., { isOnlinePayment: true })`; CCAvenue `order_amount` = amount + 5.
- **Cart**
  - Platform Fee ₹5 when CCAvenue configured; total = `finalTotal + 5`; order insert includes `platform_fee_amount: 5`, `total: amountToCharge`.
- **Order receipt / invoice**
  - `CustomerOrderReceipt` and `get_order_receipt`: include `subtotal`, `delivery_fee_amount`, `platform_fee_amount`.  
  - Plain-text and PDF invoices show Products, Delivery, Platform Fee when present.
- **Admin**
  - Orders tab: `platform_fee_amount` column; “Platform revenue (₹5/order): ₹X (Y orders)” from `platform_revenue`.

---

## 5. Testing checklist

- [ ] **PublicMenu (QR / browse)**  
  - Place order with “Pay online”.  
  - Order summary shows: Products, Platform Fee: ₹5, Total = products + GST + 5.  
  - After payment, vendor receipt = subtotal − 1.2%; one row in `platform_revenue` with amount 5.
- [ ] **PayDirect**  
  - Enter amount, pay online.  
  - Summary shows Amount + Platform Fee ₹5 = Total; CCAvenue is charged that total.  
  - After payment, `platform_revenue` has one row (if customer_orders path is used for PayDirect).
- [ ] **Cart (catalog)**  
  - Add items, place order.  
  - Summary shows Platform Fee: ₹5, total = cart total + 5.  
  - After payment, `orders` row has `platform_fee_amount = 5`, `platform_revenue` has one row (catalog_order).
- [ ] **Pay at dukaan / POS**  
  - No Platform Fee line; total does not include ₹5; `is_online` false, `platform_fee_amount` 0.
- [ ] **Invoice / receipt**  
  - Customer order receipt (tracking page): Products, Delivery (if any), Platform Fee (if any), Total.  
  - Same for PDF and text download.
- [ ] **Admin**  
  - Orders tab: Platform Fee column; “Platform revenue (₹5/order): ₹X (Y orders)” matches `platform_revenue` total and count.
- [ ] **Refunds**  
  - When refund flow exists: ensure ₹5 is reversed (e.g. debit or reverse entry in `platform_revenue`).

---

## 6. Comments in code

- Migration and RPCs document: “₹5 platform fee collected from customer → Haathpe revenue; delivery to riders; product net to vendor after 1.2%.”
- Refund handling is left for a future change; migration comment notes that refunds should reverse the ₹5.
