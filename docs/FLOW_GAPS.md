# VendorHub – Application Flow Gaps

This document lists **gaps between user flows and backend/data** so you can fix or extend them.

---

## 1. Rewards / Redemptions (fixed with part8)

| Gap | Status | Fix |
|-----|--------|-----|
| **Rewards table missing** | Fixed | Run `supabase/run-this-in-supabase-part8-rewards.sql`. Adds `reward_redemptions` and RPC `redeem_reward`. |
| **Loyalty: Family Trip, Repair Kit, Credit Boost, Supplies Kit** | Fixed | These now call `redeem_reward`, deduct points, and insert into `reward_redemptions`. Tree-planting continues to use `eco_redemptions` + `redeem_tree_planting`. |

**If you haven’t run part8:** The four reward types above only show a toast and do not deduct points or persist. Run part8 and redeploy so redemptions are stored and points are deducted.

---

## 2. Daily draw & past winners

| Gap | Description | Suggested fix |
|-----|-------------|----------------|
| **PAST_WINNERS is static** | Loyalty page “Recent winners” uses hardcoded list from `Loyalty.tsx`. | Add table e.g. `draw_winners` (id, user_id, draw_date, prize_description, created_at) and have `run_daily_draw` insert the winner. Loyalty page reads from this table. |
| **Draw notification** | `run_daily_draw` creates a notification; winner is in RPC return. No separate “winners” history. | Either persist winner in `draw_winners` (or similar) and show last N in Loyalty, or keep static copy and document it as placeholder. |

---

## 3. Orders flow

| Step | Table/RPC | Gap? |
|------|-----------|------|
| Place order (Cart) | `orders` (total, status, gst_total, subtotal_before_tax, **eco_flag**) | None if part7 applied. If `eco_flag` column missing, insert will fail until you add it. |
| Order items | `order_items` | None. |
| Notify | `notifications` | None. |
| Streak | `purchases_daily` via `upsert_purchase_today` | None. |
| Draw entry | `draws_entries` (when total ≥ 1000) | None. |
| Points | `add_loyalty_points` → `loyalty_points` | None. |
| Profile sync | `refresh_profile_incentives` → copies points/streak/tier/credit to `profiles` | None. |
| Green score | `increment_green_score` when order has eco items | None if part7 applied. |

**Note:** Points are stored in `loyalty_points` and synced to `profiles.points` by `refresh_profile_incentives`. Redemptions deduct from `profiles.points` only; consider syncing back to `loyalty_points` if you want a single source of truth (e.g. trigger or extra step in RPC).

---

## 4. Sales / POS / Public menu flow

| Flow | Tables | Gap? |
|------|--------|------|
| My Shop Menu | `default_menu_items`, `vendor_menu_items` | None. Stall type → sector mapping in app. |
| Activate default | `vendor_menu_items` upsert | None. |
| POS – Cash | `customer_orders` insert | None. |
| POS – UPI | Toast only, no payment gateway | Stub: integrate Razorpay/GPay and set `payment_id`. |
| Public menu – Pay online | `customer_orders` with `payment_method: 'online'`, `payment_id: null` | Stub: no real gateway; add Razorpay (or similar) and persist `payment_id`. |

---

## 5. Vendor Swap flow

| Step | Table | Gap? |
|------|--------|------|
| Post listing | `vendor_swaps` (status = pending) | None. |
| Admin approve/reject | `vendor_swaps.status` | None. |
| List approved | `vendor_swaps` where status = approved | None. |
| Add review | `swap_ratings` upsert | None. |

---

## 6. Profile & auth flow

| Step | Table / behaviour | Gap? |
|------|-------------------|------|
| Sign in | Supabase Auth + `profiles` row (create/update) | None. |
| Edit profile | `profiles` update (name, stall_type, stall_address, phone) | None. |
| Green score | `profiles.green_score` (updated by `increment_green_score`) | None if part7 applied. |
| SVANidhi Boost | Link to govt portal with stub query params | Stub: replace with real pre-fill/API when available. |

---

## 7. Forum & courses flow

| Flow | Table | Gap? |
|------|--------|------|
| Topics / replies | `forum_topics`, `forum_replies` | None. |
| Course progress | `course_progress` | None. |
| Course content | Static `COURSES` in `src/lib/courses.ts` | By design; move to DB if you want admin-editable courses. |

---

## 8. Notifications & admin flow

| Flow | Table / RPC | Gap? |
|------|-------------|------|
| Notifications list | `notifications` | None. |
| Mark read | `notifications` update | None. |
| Admin – vendors / orders | `profiles`, `orders` | None. |
| Admin – run draw | `run_daily_draw` | None. |
| Admin – credit limit | `profiles` update | None. |
| Admin – swap moderation | `vendor_swaps` | None. |

---

## 9. Catalog & cart flow

| Step | Source | Gap? |
|------|--------|------|
| Products | Supabase `catalog_products` (with sectors/categories); fallback `products` in `data.ts` when empty | None. |
| Cart | AppContext (in-memory) | None. |
| Place order | See “Orders flow” above | None. |

---

## Summary checklist

- [x] **Rewards table** – Add and use `reward_redemptions` + `redeem_reward` (part8); Loyalty redeems (trip, repair, credit, supplies) persist and deduct points.
- [x] **Tree-planting** – Uses `eco_redemptions` + `redeem_tree_planting` (part7).
- [ ] **Past winners** – Optional: add `draw_winners` (or similar) and show real data on Loyalty.
- [ ] **UPI (POS)** – Stub; add real payment and `payment_id`.
- [ ] **Pay online (public menu)** – Stub; add gateway and `payment_id`.
- [ ] **SVANidhi** – Stub link; replace with real API/pre-fill when ready.

After running **part8** and deploying the Loyalty changes, the only remaining data/flow gaps are the optional “past winners” table and the payment stubs above.
