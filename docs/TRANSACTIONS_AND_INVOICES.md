# Transaction details & invoices – how we handle them

## 1. Customers (payments for orders at vendor – QR/menu)

**What we give customers:**

- **Order list** (`/customer/orders`): Logged-in customers see all their orders with:
  - Vendor name, date/time, status (pending → prepared → ready → delivered/paid)
  - **Line items** (item name × qty)
  - **Total amount** (₹)
  - Coins earned (if any), rating/review
  - **“Track order”** link to `/order/:orderId`

- **Order tracking** (`/order/:orderId`): Single order view with status timeline, delivery address (if any), and same order details. No separate “payment receipt” PDF; the order card is the record.

- **After payment** (`/payment/return`): Success screen with “Payment successful”, “Track order”, “View my orders”. Voice confirmation can speak the amount. No downloadable receipt or invoice is shown here.

- **Wallet transactions** (`/customer/wallet`, `/customer/transactions`): For **coins/wallet** only (credit/debit, rewards). Shows **transaction list** (type, amount, description, date) – this is for wallet activity, not for “payment receipt” for a food/order payment.

**What we do *not* give customers today:**

- No **downloadable receipt or invoice** for a specific order payment (no PDF/text “Payment receipt” or “Tax invoice” for the order from the customer side).
- No **email/SMS** with order or payment summary (no automated “receipt” message).

So: **customers get transaction details in the app** (order list + order detail + track page) and **wallet transaction history**, plus **downloadable receipt (TXT + PDF)** per order.

---

## 2. Vendors (their purchases via app – Catalog / “Buying Spot”)

**What we give vendors:**

- **Orders page** (`/orders` – “Buying Spot”): Lists the vendor’s **supply/purchase orders** (from Catalog, `orders` table).

- **Invoice for each order:**
  - **View**: Invoice sheet with Order ID, Date, Status, line items (name, qty, unit price), GST, subtotal, total.
  - **Print**: Opens print dialog with “haathpe – Tax Invoice” and full order details.
  - **Download .txt**: Plain-text “haathpe – Tax Invoice” with same details.
  - **Download PDF**: GST-style tax invoice (jsPDF) with order id, date, status, item table (Item, Qty, Unit ₹, GST %, Amount), subtotal, GST, total.

So: **Vendors do get invoices for their purchases** – view, print, and download (text + PDF) from the Orders page. No separate “we issue and send” step; the vendor pulls the invoice from the app when they need it.

---

## 3. Vendor transaction history (purchases + sales)

- **Profile / SVANidhi**: Transaction history export (PDF/CSV) combines:
  - **Purchases**: from `orders` (vendor’s catalog orders) – date, id, items, total.
  - **Sales**: from `customer_orders` (vendor’s sales) – date, id, items, total.

This is for **proof of business / compliance**, not a per-transaction “invoice to customer”.

---

## Summary

| Who            | What they get                                                                 | Invoice / receipt? |
|----------------|-------------------------------------------------------------------------------|--------------------|
| **Customer**   | Order list, order detail, track page, wallet transactions; success screen after pay | No downloadable invoice/receipt for order payment |
| **Vendor**     | Orders list (Buying Spot) + **Invoice** (view, print, download PDF/txt) per purchase | Yes – self-serve from Orders page |

If you want to add **customer-facing receipts** (e.g. “Download receipt” for an order payment or email/SMS summary), that would be a new feature on top of the current behaviour.
