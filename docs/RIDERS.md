# Riders (2/3/4-wheelers) – Rapido/Ola-style partners

## Overview

Riders sign up with phone OTP, choose vehicle type (2/3/4-wheelers), and get a unique QR code. When customers scan the rider’s QR and place orders, those orders are attributed to the rider. Monthly rental income is credited to the rider’s balance (base + performance bonus), with a minimum withdrawal threshold.

## Database (run migration first)

Run in Supabase SQL Editor:

- `supabase/migrations/20260222000000_riders.sql`

This creates:

- **riders** – id, phone, auth_user_id, vehicle_type, qr_code_text, verified, balance, created_at
- **rider_settings** – vehicle_type, base_rental (75/99), bonus_percent (20), min_withdrawal (499)
- **rider_transactions** – rental_credit, withdrawal, adjustment
- **customer_orders.rider_id** – optional FK to riders for scan attribution

## Routes

| Route | Description |
|-------|-------------|
| `/rider-signup` | Rider signup: phone → OTP → vehicle type → create rider, redirect to dashboard |
| `/rider/dashboard` | Balance, QR (download/print), scans this month, withdrawal if balance ≥ min |

## Rider flow

1. **Signup** – Rider goes to `/rider-signup`, enters phone, receives OTP, verifies, selects vehicle type. Optional note for Cashfree Secure ID (Aadhaar/PAN) later. A unique `qr_code_text` is assigned.
2. **Dashboard** – Rider sees balance, “This month” scans, and a QR code linking to `/search?rider=<qr_code_text>`. Download/print QR. If balance ≥ ₹499 (or slab min), they can request withdrawal (deducts balance; actual payout is manual/external).
3. **Realtime** – Dashboard subscribes to `riders` and `rider_transactions` for live balance/transaction updates.

## Order attribution (rider scan)

- Customer opens link from rider QR: `/search?rider=<qr_code_text>`.
- Search and VendorEntry preserve `?rider=...` in links to browse/pay.
- PublicMenu reads `rider` from query, resolves `qr_code_text` → `rider_id`, and passes `rider_id` into `createCustomerOrder`. So orders placed after scanning a rider’s QR are stored with `customer_orders.rider_id`.

## Monthly rental (admin job)

- **Logic** – Per rider: base rental from `rider_settings` by vehicle_type (₹75 for 2-wheelers, ₹99 for 3/4-wheelers). If scans in that month ≥ 50, add bonus (default +20%). Cap total at ₹150. Credit to `riders.balance` and insert `rider_transactions` (type `rental_credit`). One credit per rider per month (idempotent).
- **Admin** – In Admin → **Riders** tab: “Run monthly payout” runs the calculation for the current month (or optional month key) for all riders.

## Admin (Admin → Riders tab)

- List riders (phone, vehicle, balance, verified, created).
- **Approve** / **Unverify** – set `riders.verified`.
- **Run monthly payout** – run the monthly rental job.
- **Rider settings (slabs)** – Edit base rental and min withdrawal per vehicle type (prompt-based for now).

## Withdrawal

- Rider can request withdrawal from dashboard when balance ≥ min_withdrawal (default ₹499).
- `rider_request_withdrawal` RPC deducts the requested amount from balance and inserts a `withdrawal` transaction. Actual payout (UPI/bank) is outside the app.

## Test flow

1. Run migration `20260222000000_riders.sql`.
2. Open `/rider-signup`, complete phone OTP and vehicle type → rider created, redirect to `/rider/dashboard`.
3. As admin, open `/admin` → Riders → **Approve** the rider.
4. From dashboard, copy the rider QR link (or open `/search?rider=<qr_code_text>`), pick a vendor, go to menu, place an order → order should have `rider_id` set.
5. In Admin → Riders → **Run monthly payout** → rider’s balance should get base (and bonus if scans ≥ 50); check **Recent transactions** on rider dashboard.
6. If balance ≥ ₹499, use **Withdraw** on dashboard → balance decreases and a withdrawal transaction appears.
