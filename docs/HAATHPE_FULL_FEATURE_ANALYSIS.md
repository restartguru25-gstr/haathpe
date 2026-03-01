# ✅ Haathpe Full Feature Analysis Complete

**Tech stack (actual):** Vite + React + TypeScript + Supabase (PostgreSQL, Auth, Edge Functions, Realtime) + Tailwind + shadcn/ui + Zustand.  
**Not Flutter/Next.js** — this is a React SPA with optional PWA install.

---

## 1. Core Concept & Unique Selling Points

- **One-line description:** Haathpe is a B2B/B2C platform for small shopkeepers (dukaanwaale) in Hyderabad to buy supplies, run their shop (menu, POS, online orders), and earn monthly rental income + daily incentives with no upfront investment.
- **Key differentiators:**
  - **Rental Income:** Monthly credit to Cash Wallet based on sales volume and “successful days” (9+ paid tx/day), prorated by slab (₹0–₹500).
  - **Daily incentives:** Cash rewards for daily transaction counts (slab-based); referral bonus (₹100 when referred vendor hits 100 entries).
  - **Instant Funds:** Vendors can request instant payout of eligible receipt balance (min ₹100) in 6 daily IST settlement cycles (10:30–20:30).
  - **Hyderabad / Telangana focus:** Zones (Charminar, Hi-Tech City, Secunderabad, etc.), “dukaan near you”, local language (Hindi, Telugu) across landing and key flows.
  - **No investment:** Sign up as vendor, activate default menu, start selling; customer signup bonus ₹55 (₹5×11 uses) to drive orders.
  - **Sab Kuch Haath Pe:** Single app for supplies (catalog/cart), sales (My Shop, POS, QR menu), credit, rewards, and payouts.
  - **Legal entity:** DOCILE ONLINE MART PRIVATE LIMITED — compliance (About, T&C, Privacy, Refund, Shipping, Contact) and invoice marketing line (Zenith Books).

---

## 2. Features for Part-Time Workers / Earners (Vendor & Rider Side)

### 2.1 Vendor signup & auth
- **Feature:** Phone/email signup and login (Supabase Auth); optional MPIN for quick re-auth.
- **Flow:** Landing → Sign in/Sign up → Auth page (phone OTP or email/password) → set MPIN (Edge Function `set-mpin`) → Dashboard/Sales.
- **Logic:** Protected routes (e.g. `/sales`, `/profile`) require auth; `ProtectedRoute` + `AppLayout` wrap vendor app; MPIN stored server-side.

### 2.2 My Shop (Sales dashboard) — `/sales`
- **Feature:** Vendor hub: default menu activation, custom products, QR code menu link, POS link, cash wallet summary, daily incentives, rental income teaser, instant funds (if eligible ≥₹100), customer reviews, recent/online orders.
- **Flow:** Vendor opens My Shop → sees default menu or “activate default” by dukaan type → can add custom products (saved to DB) → QR Code & Menu opens public menu URL → POS for in-store orders.
- **Logic:** `getVendorMenuItems`, `activateDefaultMenu`, `addCustomProduct`; realtime on `customer_orders` and `vendor_daily_activity`; eligible receipt balance for instant funds (min ₹100).

### 2.3 Default menu & custom products
- **Feature:** Sector/stall-type–based default menu (e.g. Tea Stall, Kirana, PaniPuri); vendors can add custom products anytime and edit prices.
- **Flow:** Profile sets stall type → Sales shows default items → Activate → edit prices; Add custom name/price → saved to `vendor_menu_items`.
- **Logic:** `getDefaultMenuByStallType`, `updateVendorMenuItem`, `addCustomProduct` (action); custom products persist after default activation.

### 2.4 POS (Point of Sale) — `/pos`
- **Feature:** In-store order entry: select items, quantities, cash/UPI; mark paid; optional online payment via CCAvenue.
- **Flow:** Vendor selects items → sets cash paid or “Pay online” → CCAvenue redirect for online part → return → order status updated; order status dropdown (pending → prepared → ready → delivered → paid).
- **Logic:** Creates `customer_orders`; online payment via `create-cca-order` Edge Function; vendor receipt credited on success (`credit_vendor_receipt_from_order`).

### 2.5 QR code & public menu
- **Feature:** Each vendor has public menu at `/menu/:vendorId`; QR points to this; customer can Browse menu or Pay direct.
- **Flow:** Customer scans QR or opens link → VendorEntry → Browse Menu (add to cart, checkout) or Pay Direct (amount + optional note → CCAvenue).
- **Logic:** `VendorEntry`, `PublicMenu`, `PayDirect`; guest or logged-in customer; CCAvenue for payment; marketing line banner on menu page.

### 2.6 Rental Income — `/rental-income`
- **Feature:** Prorated monthly credit by “successful days” (≥9 paid tx/day). Slab by monthly volume (₹0–₹500); credit = slab × (successful_days/30) to Cash Wallet.
- **Flow:** Vendor opens Rental Income → sees Successful days X/30, projected rental income, progress bar, daily goal “Hit 9+ paid transactions today”, today’s tx count, volume, tier, slab table, payout history.
- **Logic:** `vendor_daily_activity` (tx_count, is_successful); trigger on `customer_orders.status = 'paid'`; admin runs `run_rental_income_monthly_calc(month)`; realtime on `vendor_daily_activity`.

### 2.7 Daily incentives (vendor)
- **Feature:** Daily transaction-count slabs (from `incentive_slabs`) → cash reward; today’s entry count; potential reward display; referral bonus (₹100 when referred vendor hits 100 entries).
- **Flow:** Sales shows “Today: N entries”, “Potential reward: ₹X”; referral link in Profile; admin runs Daily Calc / Referral Calc → credits `vendor_incentives` and wallet.
- **Logic:** `getTodayEntryCount`, `getPotentialRewardForCount`, `getVendorIncentives`; `run_daily_incentive_calc`, `run_referral_bonus_calc` (RPC); rewards credit cash wallet.

### 2.8 Cash wallet & withdraw — Profile / Sales
- **Feature:** Vendor cash wallet (balance + eligible_receipt_balance); withdraw (min ₹499); signup bonus and incentives credited here.
- **Flow:** Sales/Profile show balance; Withdraw requests (admin approves); wallet section shows “Eligible for Instant Transfer” vs “Locked Bonus/Other”.
- **Logic:** `vendor_cash_wallets`, `vendor_cash_transactions`; `request_vendor_cash_withdrawal`; min withdrawal from `vendor_settings`.

### 2.9 Instant Funds — `/vendor/payouts`
- **Feature:** Request instant payout of eligible receipt balance (customer payments only); min ₹100; 6 daily IST cycles (10:30, 12:30, 14:30, 16:30, 18:30, 20:30); after 20:30 blocked until next day 10:30.
- **Flow:** Vendor opens Payouts → sees “Available to settle instantly” (eligible_receipt_balance) → enters amount (≥100) → Request → entry in `vendor_instant_payout_requests` → admin approves → wallet debited, status updated.
- **Logic:** `getInstantFundsCycleState()` (IST); `request_vendor_instant_payout_amount` RPC; admin approve/reject debits both balance and eligible_receipt_balance.

### 2.10 Vendor profile — `/profile`
- **Feature:** Name, phone, photo, address, stall type, GSTIN/PAN/Bank (optional, no verification), referral link, MPIN change, notification prefs, withdraw CTA.
- **Flow:** Edit fields → Save (Supabase + Edge Function for sensitive updates); copy referral link.
- **Logic:** Optional GSTIN/PAN/Bank; no “Verify” buttons; profile persisted via Supabase.

### 2.11 Rider signup — `/rider-signup`
- **Feature:** Riders (2/3/4-wheelers): phone OTP signup, vehicle type selection, optional Secure ID; creates `riders` row with QR variant.
- **Flow:** Phone → OTP → Verify → Select vehicle type → Submit → upsert rider → redirect to rider dashboard.
- **Logic:** `sendRiderOtp`, `verifyRiderOtp`, `upsertRiderAfterSignup`; `riders` table, `rider_settings` (base_rental, bonus_percent, min_withdrawal).

### 2.12 Rider dashboard — `/rider/dashboard`
- **Feature:** Balance, QR code to download/print, performance stats, withdrawal request (if balance ≥ min e.g. ₹499), transaction history; monthly rental (base ₹75/₹99 + 20% bonus for 50+ scans, cap ₹150).
- **Flow:** Rider logs in → sees balance, QR, stats → Request withdrawal if eligible; admin runs monthly payout → balance credited.
- **Logic:** `getRiderByAuth`, `getRiderTransactions`; `run_rider_monthly_rental` (admin); scans tracked via `rider_id` on orders.

### 2.13 Buy supplies (vendor) — Catalog, Cart, Orders
- **Feature:** Browse catalog (products by sector/category), add to cart, place order; CCAvenue checkout; order history at “Buying Spot” (`/orders`).
- **Flow:** Dashboard/Catalog → add to cart → Cart → Place Order → CCAvenue → return → order paid; Orders list with status.
- **Logic:** Catalog from `catalog_products` / default menu items; cart in Zustand; `create-cca-order` for supply orders; RLS allows anon/authenticated insert on `customer_orders` for guest checkout.

### 2.14 Premium upgrade (vendor)
- **Feature:** Optional premium tier for vendors; payment via CCAvenue; Edge Function updates `premium_tier`, `premium_expires_at` on success.
- **Flow:** Sales shows upgrade CTA → checkout → CCAvenue → return → `verify-cca-payment` upgrades profile.
- **Logic:** `createPremiumCheckout`, `isPremiumCheckoutConfigured`; premium stored on `profiles`.

### 2.15 Shop open/closed
- **Feature:** Vendor shop status from opening_hours, weekly_off, holidays; “Open”/“Closed” on menu/entry.
- **Logic:** `shopDetails.ts` — `isShopOpen()`, message in en/hi/te; used on VendorEntry/PublicMenu.

---

## 3. Features for Businesses / Task Posters (Customer & Platform)

### 3.1 Customer login (guest or phone OTP) — `/customer-login`, CustomerAuthContext
- **Feature:** Customers can continue as guest or login with phone OTP to save favorites, track orders, use wallet/signup bonus.
- **Flow:** Menu or Pay Direct → “Login with phone” or “Continue as Guest” → OTP → Verify → session stored; guest orders still allowed.
- **Logic:** Supabase Auth OTP; `CustomerAuthProvider`; customer_id from auth or anonymous.

### 3.2 Customer orders — `/customer/orders`
- **Feature:** List of customer’s orders (by customer_id or session); status, items, total; link to tracking.
- **Flow:** Customer logs in → Orders → see list → click order → Order tracking.
- **Logic:** Fetch by `customer_id` or order_id; `OrderTracking` for status timeline.

### 3.3 Customer wallet — `/customer/wallet`
- **Feature:** Balance, coins, signup bonus status (₹55, ₹5×11 uses, 30-day validity); transaction history; redeem/withdraw (admin-approved redemptions).
- **Flow:** Wallet page shows balance, bonus remaining, expiry; request redemption (cash/coupon/cashback) → admin approves/rejects.
- **Logic:** `getWalletBalanceAndCoins`, `getCustomerSignupBonusStatus`, `getWalletTransactions`; `ensure_customer_signup_bonus` on first signup.

### 3.4 Customer signup bonus (₹55)
- **Feature:** First successful customer signup credits ₹55 to wallet; ₹5 off per order (order total ≥₹55) for up to 11 uses; 30-day validity; posh congrats overlay.
- **Flow:** New customer completes signup → `ensure_customer_signup_bonus` → overlay; at checkout can apply “Use ₹5 bonus” (server RPC).
- **Logic:** `customer_wallets.bonus_remaining`, `signup_bonus_credited_at`; `use_customer_signup_bonus_for_order`; `SignupBonusOverlay`, `CongratsOverlay`.

### 3.5 Customer redemption — `/customer/redemption`
- **Feature:** Request redemption (cash/coupon/cashback); admin approves → wallet debited.
- **Logic:** `wallet.ts` redemptions; admin Customer Redemptions tab with approve/reject + bulk.

### 3.6 Customer transactions — `/customer/transactions`
- **Feature:** List of wallet transactions (credit/debit/redemption).
- **Logic:** `getWalletTransactions` or similar; read-only list.

### 3.7 Coins & cashback
- **Feature:** Coins awarded per paid order (configurable in admin); cashback logic; coins-to-rupees config.
- **Logic:** `award_coins_for_paid_order` RPC; `getCoinsConfig`; admin Coins tab to edit scenarios.

### 3.8 Find dukaan (search) — `/search`
- **Feature:** Search vendors by keyword, zone, stall type; sort by popular/rating/name; “View menu” → `/menu/:vendorId`; marketing line subtitle.
- **Flow:** Open Search → filters → results → View menu → VendorEntry.
- **Logic:** `getVendorSearchResults` RPC; `vendor_search` / `get_vendor_search_results`; no login required.

### 3.9 Browse products (catalog) — `/catalog`
- **Feature:** Public product catalog (default/supply products) to build trust; browse without sign-in.
- **Logic:** Catalog page; sectors/categories; add to cart when logged in (vendor buying supplies).

---

## 4. Admin / Backend Features

### 4.1 Admin panel — `/admin` (role = admin)
- **Feature:** Full admin dashboard with 19 tabs; left/right arrow + keyboard (Arrow Left/Right) to switch tabs.
- **Tabs:** Vendors | Orders | Swaps | Redemptions | SVANidhi | Incentives | Ads | ONDC | Customer Redemptions | Customer Bonuses | Coins | Vendor Wallet | Instant Payouts | Riders | Sectors | Categories | Menu (default) | Products | Actions.

### 4.2 Vendors tab
- **Feature:** List vendors; edit profile; set credit limit; delete vendor; refresh.
- **Logic:** `profiles`; credit limit update; delete with confirm.

### 4.3 Orders tab
- **Feature:** List supply orders; bulk select; bulk status update (pending/in-transit/delivered); bulk delete; per-row status dropdown; delete single order.
- **Logic:** `orders` table; refs for selection so bulk uses current IDs; `.in("id", ids)` for status update.

### 4.4 Swaps tab
- **Feature:** Vendor Swap listings; approve/reject per listing; bulk approve/reject for pending; edit; delete.
- **Logic:** `getAllSwapsForAdmin`, `moderateSwap`, `deleteSwap`; checkboxes for pending only.

### 4.5 Redemptions tab (reward_redemptions)
- **Feature:** List reward redemptions; bulk select; bulk status (pending/fulfilled); per-row status dropdown.
- **Logic:** `reward_redemptions`; bulk update by IDs.

### 4.6 SVANidhi tab
- **Feature:** PM SVANidhi Boost — link to govt scheme with vendor_id and “transaction_history” proof param; support requests list (svanidhi_requests) with status/notes.
- **Logic:** `getSvanidhiBoostUrl`; stub; admin can view/update support requests.

### 4.7 Incentives tab
- **Feature:** Eligible for Draw; incentive slabs (add/edit/delete); vendor incentives list; **Rental income (prorated):** Run monthly calc (month picker), vendor daily activity (month + optional vendor ID, Load), rental payouts table with successful_days, Credit to wallet (single + bulk); Run monthly calc creates/updates payouts and credits wallet.
- **Logic:** `run_daily_incentive_calc`, `run_referral_bonus_calc`, `run_monthly_draw`; `run_rental_income_monthly_calc`, `getAdminVendorDailyActivity`, `markRentalPayoutPaid`, `handleBulkRentalCredit`.

### 4.8 Ads tab
- **Feature:** Ad placements (enable/disable per page); list ads; add/edit/delete ad; image upload; impressions/clicks.
- **Logic:** `ads` table; placements; `AdBanner` component on selected pages.

### 4.9 ONDC tab
- **Feature:** List ONDC orders; export; webhook info for `/functions/v1/ondc-webhook`.
- **Logic:** `ondc_orders`; integration stubs/export.

### 4.10 Customer Redemptions tab
- **Feature:** List customer wallet redemptions (cash/coupon/cashback); approve/reject (single + bulk for pending).
- **Logic:** `approveRedemption`, `rejectRedemption`; refs for bulk selection.

### 4.11 Customer Bonuses tab
- **Feature:** View customer signup bonus status: balance, bonus left, credited, valid till.
- **Logic:** Read from `customer_wallets` / RPC.

### 4.12 Coins tab
- **Feature:** Edit coins config (scenarios, coins per payment, coins to rupees).
- **Logic:** `getCoinsConfig`, `updateCoinsConfig`.

### 4.13 Vendor Wallet tab
- **Feature:** Min instant transfer (₹), min withdrawal (₹); vendor wallet breakdown table (balance, eligible_receipt_balance per vendor).
- **Logic:** `vendor_settings`; `getAdminVendorWalletBreakdown`.

### 4.14 Instant Payouts tab
- **Feature:** List vendor instant payout requests; approve/reject (single + bulk for pending); wallet breakdown section above.
- **Logic:** `getAdminInstantPayoutRequests`, `adminDecideInstantPayoutRequest`; refs for bulk.

### 4.15 Riders tab
- **Feature:** List riders; set verified; run monthly payout; rider settings (base_rental, bonus_percent, min_withdrawal per vehicle type); edit slabs.
- **Logic:** `getAdminRiders`, `adminSetRiderVerified`, `adminRunRiderMonthlyPayout`, `getRiderSettings`, `adminUpdateRiderSettings`.

### 4.16 Sectors / Categories / Default Menu / Products tabs
- **Feature:** CRUD for sectors, categories, default menu items, catalog products; used by vendor catalog and default menu.
- **Logic:** `adminCatalog.ts` — get/upsert/delete for each entity.

### 4.17 Actions tab
- **Feature:** Run Daily Incentive Calc, Referral Bonus Calc, Monthly Draw; descriptions of each job.
- **Logic:** Calls same RPCs as Incentives tab.

---

## 5. Payment & Earning System

### 5.1 CCAvenue integration
- **Flow:** Client calls Edge Function `create-cca-order` with order params → backend creates order in DB, builds CCAvenue payload, encrypts with Working Key, returns redirect URL → client redirects to CCAvenue → user pays → CCAvenue returns to `verify-cca-payment` (or return URL with encResp) → Edge Function decrypts, updates order status to paid, credits vendor receipt (`credit_vendor_receipt_from_order`), awards coins/customer wallet/signup bonus usage as applicable.
- **Used for:** Public menu checkout, Pay Direct, POS online payment, Cart (supply orders), Premium upgrade.
- **Security:** Working Key only in Edge Function secrets; no client-side key.

### 5.2 Vendor earnings
- **Customer payment:** On paid `customer_orders`, vendor gets (total − 1.2% platform fee) into `balance` and `eligible_receipt_balance`; only eligible portion can be instant-transferred (min ₹100).
- **Rental income:** Monthly; credit = slab × (successful_days/30) into `balance` only (not eligible_receipt_balance).
- **Daily/referral incentives:** Credited to `balance` via `credit_vendor_cash_wallet`.
- **Payout timing:** Instant Funds in 6 IST cycles; normal withdrawal and rental payout processed by admin (manual/UPI).

### 5.3 Customer wallet & bonus
- **Signup bonus:** ₹55 once; ₹5 off per order (order ≥₹55), up to 11 uses, 30 days; applied at checkout via RPC.
- **Coins:** Awarded per paid order; configurable; redeem via redemptions (admin-approved).
- **Pay methods:** CCAvenue (card/UPI/net banking) for orders and premium.

### 5.4 Rider earnings
- **Monthly rental:** Base ₹75 (2W) / ₹99 (3/4W); +20% bonus for 50+ QR scans; cap ₹150; credited to rider balance; min withdrawal ₹499.
- **Logic:** `run_rider_monthly_rental` (admin); `rider_transactions`, `rider_settings`.

---

## 6. Mobile-Specific & Native Features

### 6.1 PWA
- **Feature:** Installable app (manifest: haathpe, theme #F97316, standalone); icons 192/512; “h” brand; iOS/desktop install prompt via `PWAInstallContext` and `PWAInstallPrompt`.
- **Logic:** `manifest.webmanifest`; service worker (Vite PWA or custom); install button and beforeinstallprompt handling.

### 6.2 Splash screen
- **Feature:** 3s splash: “I love haathpe”, “I am using haathpe”, small horizontal Indian flag (Ashoka Chakra); Framer Motion; then main app.
- **Logic:** `SplashScreen.tsx`; `SPLASH_DURATION_MS = 3000`; unmount after delay.

### 6.3 Responsive & touch
- **Feature:** Tailwind breakpoints; touch-friendly targets (min-h-44px on admin); bottom nav on mobile; responsive tables/cards.
- **No Capacitor/Flutter:** This is web-only (no native plugins for camera/location in codebase); no explicit offline persistence beyond cache.

### 6.4 Status bar / safe area
- **Feature:** Theme color and background in manifest; no explicit status bar or safe-area insets in code (handled by browser/PWA).

---

## 7. Other Features

### 7.1 Notifications
- **Feature:** In-app notifications list (`/notifications`); mark all read; unread count in nav; push notification stubs (`pushNotifications.ts`); notification settings in profile.
- **Logic:** `notifications` table; `useUnreadNotifications`; settings for alert volume (payment/voice).

### 7.2 Voice / payment notification (vendor)
- **Feature:** On payment/order received: sound (MP3 or beep), optional vibration, Web Speech API voice in en/hi/te (“Payment received X rupees”, “Thank you for paying X rupees” for customer); optional “speak order items”; volume from profile.
- **Logic:** `paymentNotification.ts` — `playPaymentSound`, `speakPaymentReceived`, `speakOrderSummary`; `PaymentNotificationContext`; `PaymentSuccessPopup`; `usePaidOrderNotification` (realtime on `customer_orders`).

### 7.3 Referral (vendor)
- **Feature:** Copy referral link from Profile; referred vendor signs up with `?ref=UUID`; when referred hits 100 entries, referrer gets ₹100 (referral bonus calc run by admin).
- **Logic:** `set_my_referrer` RPC; `run_referral_bonus_calc`; `vendor_incentives` slab_type referral.

### 7.4 Vendor forum — `/forum`
- **Feature:** Placeholder/community forum for dukaanwaale (likely stub or minimal).
- **Logic:** Forum page exists; content from data/API if any.

### 7.5 Vendor swap — `/swap`
- **Feature:** Vendors can list items for swap/sale (title, price notes, location); admin approves/rejects; edit/delete.
- **Logic:** `swaps` table; `getPendingSwapsForAdmin`, `moderateSwap`; Swap page for vendors to create listing.

### 7.6 Courses — `/courses`, `/courses/:courseId`
- **Feature:** Upskill courses list and detail; progress tracking (`courseProgress.ts`).
- **Logic:** `courses` table; course progress; likely learning content for vendors.

### 7.7 Loyalty — `/loyalty`
- **Feature:** Loyalty/rewards page for vendors (points, tier, streak from profile).
- **Logic:** Points/tier/streak displayed; link from Dashboard.

### 7.8 Dashboard — `/dashboard`
- **Feature:** Vendor home: greeting, quick links (Catalog, Cart, Orders, Sales, Profile), stats tiles, today orders, ad placeholder.
- **Logic:** AppLayout with nav; Dashboard content from `data.ts` and profile.

### 7.9 Order tracking — `/order/:orderId`
- **Feature:** Customer or vendor views order status timeline (pending → prepared → ready → delivered → paid).
- **Logic:** `OrderStatusTimeline`; fetch order by id.

### 7.10 Payment return — `/payment/return`
- **Feature:** CCAvenue return handler page; decrypts response (or calls verify-cca-payment); shows success/failure; updates order; triggers payment notification; redirects to orders or cart.
- **Logic:** Query params (order_id, encResp, status); Edge Function or client-side decrypt; award coins, vendor receipt, customer bonus usage.

### 7.11 Invoice / receipt
- **Feature:** Customer and vendor invoices (PDF/print); marketing line: “Generated in association with Zenith Books — India’s leading AI-powered accounting, taxation & compliance SaaS for MSMEs.”
- **Logic:** `invoice.ts` — `buildCustomerReceiptLines`, `appendMarketingToLines`; jsPDF for PDF; used from order/transaction screens.

### 7.12 Marketing line
- **Feature:** Banner on `/menu/:vendorId` and subtitle on `/search`: “Get your groceries, kirana essentials… Try Haathpe today and shop smarter.”
- **Logic:** `MarketingLine.tsx`; Framer Motion fade-in.

### 7.13 Policy & compliance pages
- **Feature:** About Us, Terms & Conditions, Privacy Policy, Refund & Cancellation, Shipping & Delivery, Contact Us; legal entity DOCILE ONLINE MART PRIVATE LIMITED; contact (phone, email, Siddipet address).
- **Logic:** Policy pages; `SiteFooter` with links; `PolicyPageLayout`.

### 7.14 Language (i18n)
- **Feature:** English, Hindi, Telugu on landing and key screens; `Language` in AppContext; `translations` in `data.ts`; language switcher on landing.
- **Logic:** `useApp().t(key)`, `lang`, `setLang`; keys for hero, features, steps, FAQ, testimonials, stats, product teasers.

### 7.15 Cart (Zustand)
- **Feature:** Global cart for catalog/supply orders; add/remove; persist; cart FAB; checkout to CCAvenue.
- **Logic:** `cartStore.ts`; `useCartPricing`; Cart page and FAB.

### 7.16 ONDC export — `/vendor/ondc-export`
- **Feature:** Export for ONDC (orders/catalog); link from Sales.
- **Logic:** `OndcExport` page; `ondcOrders` / `ondc.ts`.

### 7.17 404 & redirects
- **Feature:** `/buying-spot` → redirect to `/orders`; unknown path → NotFound.
- **Logic:** `Navigate to="/orders"`, `Route path="*"` → NotFound.

---

## 8. Comparison-Ready Summary (for MagicPin)

- **Hyderabad-focused B2B app for small shops (dukaanwaale):** supplies, menu, POS, online orders in one app.
- **Rental Income:** Monthly cash credit to vendor wallet based on sales volume and “successful days” (9+ tx/day), prorated (₹0–₹500).
- **Instant Funds:** Same-day payout of eligible customer-payment balance (min ₹100) in 6 IST settlement cycles.
- **Daily incentives + referral:** Slab-based cash rewards per day; ₹100 for referrer when referred vendor hits 100 entries.
- **CCAvenue-only payments:** All checkout flows (menu, Pay Direct, POS, cart, premium) via CCAvenue; no Cashfree.
- **Customer signup bonus:** ₹55 credit; ₹5 off × 11 orders (order ≥₹55); 30-day validity.
- **QR code menu + Pay Direct:** Public vendor link; browse menu or pay direct; guest or logged-in customer.
- **Vendor Cash Wallet:** Balance + eligible vs locked; withdraw (min ₹499); instant transfer for eligible only.
- **Riders (2/3/4-wheelers):** Separate signup/dashboard; monthly rental (₹75/₹99 + bonus); QR-based scan tracking.
- **Multilingual (EN/Hi/Te) and PWA:** Installable app; splash “I am using haathpe” + Indian flag; theme orange (#F97316).
- **Voice payment alerts:** Vendor hears “Payment received X rupees” (en/hi/te) and optional order items; customer hears “Thank you for paying X rupees.”
- **Admin: 19 tabs with bulk actions** (orders, redemptions, swaps, instant payouts, rental payouts, customer redemptions) and arrow navigation.

---

*Analysis based on full scan of `src/`, `supabase/functions/`, `supabase/migrations/`, and config. No Flutter or Next.js; stack is Vite + React + Supabase.*
