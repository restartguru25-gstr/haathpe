# Rental Income (Vendor Incentive)

DOCILE ONLINE MART PRIVATE LIMITED / haathpe — monthly payout based on vendor transaction volume.

## Setup

1. **Run migration** in Supabase SQL Editor:
   - `supabase/part24-vendor-rental-payouts.sql` — creates `vendor_rental_payouts` table and RLS.

2. **Volume source**: `customer_orders` — sum of `total` where `vendor_id` = vendor, `status` = `'paid'`, `created_at` in the calendar month.

3. **Slabs** (see `src/lib/rentalIncomeSlabs.ts`): monthly volume (₹) → payout (₹). Easy to adjust there.

## Admin: Creating and crediting

- **Create pending rows**: At month-end, for each vendor (or for a specific vendor/month), call `upsertRentalPayoutForVendor(vendorId, 'YYYY-MM')` (e.g. from Admin UI or a script). This computes volume and incentive amount and inserts/updates `vendor_rental_payouts` with `status: 'pending'`.
- **Credit to Cash Wallet**: Use Admin → Incentives → Rental income section and click "Credit to wallet". Backend: `markRentalPayoutPaid(id)` credits the amount to the vendor's Cash Wallet (via `creditVendorCashWallet`) and sets `status = 'paid'`, `paid_at = now()`. Vendors can then use the wallet for purchases or withdraw.

## Vendor dashboard

- Route: `/rental-income` (protected, vendor only).
- Shows: current month volume, tier, projected credit (to Cash Wallet), progress to next tier, slab table, credit history (last 6 months).

## Security

- RLS: vendors can only SELECT their own rows; admins can SELECT/INSERT/UPDATE/DELETE.
- Uses existing `is_admin()` for admin policy.
