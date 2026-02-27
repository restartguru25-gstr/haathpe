# haathpe — Knowledge Transfer: Feature & Role Flows

A detailed walkthrough of all features, roles, and flows in the application.

---

## 1. ROLES

| Role | Who | Sign-in | Access |
|------|-----|---------|--------|
| **Visitor** | Anonymous user | None | Landing, Search, Catalog (read), VendorEntry, PublicMenu, PayDirect (limited) |
| **Vendor** | Dukaanwaala (shop owner) | `/auth` (email/phone OTP) | Dashboard, Profile, Sales, POS, Orders, Loyalty, Forum, Swap, Courses, Catalog (buy supplies) |
| **Customer** | End customer (eats/orders from dukaan) | `/customer-login` (phone OTP + MPIN) | Search, PublicMenu, PayDirect, Customer Orders, Wallet, Redemptions |
| **Admin** | Platform admin | Same as Vendor (role=admin in profiles) | All Vendor + Admin Dashboard |

---

## 2. ROLE-WISE FLOWS

### 2.1 Visitor (Anonymous)

| Entry Point | Flow | Routes |
|-------------|------|--------|
| **Landing** | Open site → `/` | Hero CTAs: Find dukaan, Customer sign in, Browse supplies |
| **Find dukaan** | `/search` | Search by keyword, zone, stall type; see vendor cards |
| **Click dukaan** | `/menu/:vendorId` (VendorEntry) | See dukaan name, “Browse menu”, “Pay directly” |
| **Browse menu** | `/menu/:vendorId/browse` | View menu, add to cart, place order (guest or customer) |
| **Pay directly** | `/menu/:vendorId/pay` | Enter amount, pay (CCAvenue or pay at counter) |
| **Browse supplies** | `/catalog` | Browse catalog (vendors buy supplies; visitor can browse) |
| **Vendor sign-in** | `/auth` | Email/phone OTP → creates Vendor session |
| **Customer sign-in** | `/customer-login` | Phone OTP + MPIN → creates Customer session |

### 2.2 Vendor (Dukaanwaala)

| Entry Point | Flow | Routes |
|-------------|------|--------|
| **Sign in** | `/auth` | Email/phone OTP → `profiles` row; redirect to Dashboard or `next` |
| **Dashboard** | `/dashboard` | Overview, quick links |
| **My Shop (Sales)** | `/sales` | Menu items, activate default menu, edit prices, add custom items, customer orders, incentives, ONDC, **Premium Upgrade** (₹99/month) |
| **Quick POS** | `/pos` | Cash Paid or Generate UPI QR (CCAvenue) |
| **Orders** | `/orders` | Supply orders (from Catalog) |
| **Loyalty** | `/loyalty` | Points, streak, tier, draws |
| **Profile** | `/profile` | Name, stall type, language, alerts, logout |
| **Forum** | `/forum` | Community posts |
| **Swap** | `/swap` | Post excess stock (barter); Admin approves |
| **Courses** | `/courses` | Learning content |
| **Catalog** | `/catalog` | Buy supplies; add to cart → `/cart` |
| **Cart** | `/cart` | Place supply order (CCAvenue) |
| **Admin** | `/admin` | Only if `role=admin` in profiles |

Protected: All above (except Search, Catalog, Contact) require Vendor auth. If not signed in → redirect to `/auth` with `next`.

### 2.3 Customer (End Customer)

| Entry Point | Flow | Routes |
|-------------|------|--------|
| **Sign in** | `/customer-login` | Phone OTP → verify → MPIN create/sign-in; `returnTo` for redirect |
| **Search** | `/search` | Same as visitor; can favorite vendors |
| **Dukaan** | `/menu/:vendorId` | Same as visitor |
| **Browse menu** | `/menu/:vendorId/browse` | Add to cart, use wallet, place order (online or pay at dukaan) |
| **Pay directly** | `/menu/:vendorId/pay` | Same as visitor; coins awarded |
| **My orders** | `/customer/orders` | Order history |
| **Wallet** | `/customer/wallet` | Balance, coins, use at checkout |
| **Transactions** | `/customer/transactions` | Wallet transaction log |
| **Redemption** | `/customer/redemption` | Redeem coins (cash/coupon); Admin approves |

### 2.4 Admin

| Entry Point | Flow | Routes |
|-------------|------|--------|
| **Admin Dashboard** | `/admin` | Tabs: Vendors, Orders, Swaps, Redemptions, SVANidhi, Incentives, Ads, ONDC, Cx Redemptions, Coins, Sectors, Categories, Menu, Products, Actions |
| **Set Admin** | SQL | `supabase/set-admin-by-email.sql` → set `role='admin'` for a profile |
| **Visibility** | TopNav/BottomNav | Admin tab/link shown only when `profile.role === 'admin'` |

---

## 3. FEATURE-WISE FLOWS

### 3.1 Search & Find Dukaan

| Step | Action | Route/Component |
|------|--------|------------------|
| 1 | User visits Search | `/search` |
| 2 | Optional: keyword, zone, stall type, sort | `getVendorSearchResults` RPC |
| 3 | Results | `VendorCard` list |
| 4 | Click vendor | `/menu/:vendorId` (VendorEntry) |
| 5 | Ad (if enabled) | `AdBanner` page="search" |

**Backend:** `get_vendor_search_results` (Supabase RPC). Requires `profiles.zone`, `vendor_menu_items` (active), migrations applied.

---

### 3.2 Dukaan Entry (VendorEntry)

| Step | Action | Route/Component |
|------|--------|------------------|
| 1 | Land on dukaan | `/menu/:vendorId` |
| 2 | Load vendor | `get_vendor_public_info` RPC (name, stall_type, opening_hours) |
| 3 | Show choices | “Browse menu” → `/menu/:vendorId/browse`, “Pay directly” → `/menu/:vendorId/pay` |
| 4 | Ad (if enabled) | `AdBanner` page="dukaan" |
| 5 | Back | Link to `/search` |

**Owner flow:** If visitor is the vendor (same `vendorId`), can “Load my dukaan” to sync profile.

---

### 3.3 Browse Menu (PublicMenu)

| Step | Action | Route/Component |
|------|--------|------------------|
| 1 | Land | `/menu/:vendorId/browse` |
| 2 | Load menu | `getActiveVendorMenuForPublic` |
| 3 | Add to cart | Per-item +/- ; cart state |
| 4 | Delivery | Pickup or Self-delivery (address) |
| 5 | Payment | Wallet (if customer) + Pay online (CCAvenue) or Pay at dukaan |
| 6 | Place order | `createCustomerOrder` → `customer_orders` |
| 7 | If online | CCAvenue checkout → `/payment/return?order_id=...` |
| 8 | Success | Order placed; track at `/order/:orderId` |
| 9 | Ads | `AdBanner` page="menu", "menu_mobile", "cart", "confirmation" |

**Shop status:** Uses `opening_hours`, `weekly_off`, `holidays`; “Currently unavailable” if closed.

---

### 3.4 Pay Direct (PayDirect)

| Step | Action | Route/Component |
|------|--------|------------------|
| 1 | Land | `/menu/:vendorId/pay` |
| 2 | Enter amount | Numpad + quick amounts |
| 3 | Optional note | Text input |
| 4 | Pay | `createDirectPaymentOrder` → `customer_orders` |
| 5 | If online | Opens CCAvenue → redirect to `/payment/return?order_id=...` |
| 6 | If not | “Payment request sent! Pay at the counter.” |
| 7 | Ad (if enabled) | `AdBanner` page="pay" variant="compact" |

**RLS:** Requires “Anyone can insert customer_orders” policy (migration `20260220300000`).

---

### 3.5 Customer Auth (Phone + MPIN)

| Step | Action | Route/Component |
|------|--------|------------------|
| 1 | Land | `/customer-login?returnTo=...` |
| 2 | Enter phone | 10 digits |
| 3 | Send OTP | `sendCustomerOtp` (Supabase Auth) |
| 4 | Verify OTP | `verifyCustomerOtp` |
| 5 | Create MPIN | 4-digit MPIN (first time) |
| 6 | Sign in | MPIN (returning) |
| 7 | Redirect | `returnTo` or `/` |

**Storage:** Customer profile in `customer_profiles`; MPIN stored securely.

---

### 3.6 Vendor Auth (Email/Phone OTP)

| Step | Action | Route/Component |
|------|--------|------------------|
| 1 | Land | `/auth` (or redirect from ProtectedRoute) |
| 2 | Email or Phone | Supabase Auth |
| 3 | OTP / Magic link | Sent |
| 4 | Verify | Session created |
| 5 | Profile | `profiles` row by `auth.uid()` |
| 6 | Redirect | `state.next` or `/dashboard` |

---

### 3.7 Payment (CCAvenue)

| Payment Point | Route | Flow |
|---------------|-------|------|
| **Public Menu** | `/menu/:id/browse` | Place order → `createCcaOrder` → redirect to CCAvenue |
| **Pay Direct** | `/menu/:id/pay` | Pay → `createCcaOrder` → redirect to CCAvenue |
| **POS (Vendor)** | `/pos` | Generate UPI QR → same flow |
| **Cart (Supply)** | `/cart` | Place order → same flow |
| **Premium Upgrade** | `/sales` | Upgrade → `createPremiumCheckout` → CCAvenue |

**Return:** `/payment/return?order_id=...` (or `prem_...` for premium).  
**Return handler:** CCAvenue → `verify-cca-payment` Edge Function → updates `customer_orders/orders.status = 'paid'`.

**Secrets:** `CCAVENUE_MERCHANT_ID`, `CCAVENUE_ACCESS_CODE`, `CCAVENUE_WORKING_KEY`, `CCAVENUE_MODE`.

---

### 3.8 Premium Upgrade (Vendor)

| Step | Action | Route/Component |
|------|--------|------------------|
| 1 | Vendor on Sales | `/sales` |
| 2 | Click Upgrade | `createPremiumCheckout` (₹99/month) |
| 3 | CCAvenue | Redirect to CCAvenue |
| 4 | Success | Redirect to `/payment/return?order_id=prem_...` |
| 5 | Finalize | Edge Function `verify-cca-payment` upgrades `premium_tier`, `premium_expires_at` |
| 6 | UI | Premium badge, boosted search ranking |

**Note:** JWT is OFF for `verify-cca-payment` (CCAvenue posts to it).

---

### 3.9 Ads & Placements

| Placement | Page | Slug | Admin Toggle |
|-----------|------|------|--------------|
| Dukaan | VendorEntry | `dukaan` | ✅ |
| Menu sidebar | PublicMenu (desktop) | `menu` | ✅ |
| Menu top (mobile) | PublicMenu | `menu_mobile` | ✅ |
| Cart | PublicMenu | `cart` | ✅ |
| Pay | PayDirect | `pay` | ✅ |
| Search | Search | `search` | ✅ |
| Confirmation | PublicMenu (order success) | `confirmation` | ✅ |

**Admin:** Ads tab → Ad placements section → toggle per placement.  
**Table:** `ad_placement_config` (page_slug, enabled, label).  
**Ad content:** `ads` table (brand_name, image_url, link_url, zone, is_active, priority).

---

### 3.10 Admin Features (Tabs)

| Tab | Purpose |
|-----|---------|
| **Vendors** | List vendors, edit role (vendor/admin), credit limit, delete |
| **Orders** | Platform supply orders |
| **Swaps** | Approve/reject Swap listings |
| **Redemptions** | Vendor loyalty redemptions |
| **SVANidhi** | SVANidhi support requests, admin notes |
| **Incentives** | Slabs, daily calc, referral bonus, monthly draw, eligible list |
| **Ads** | Add/edit/delete ads; **Ad placements** toggles |
| **ONDC** | ONDC orders |
| **Cx Redemptions** | Customer wallet redemptions (approve/reject) |
| **Coins** | Coins config (award per payment, etc.) |
| **Sectors** | CRUD sectors (Kirana, Electricals, etc.) |
| **Categories** | CRUD categories |
| **Menu** | CRUD default menu items |
| **Products** | CRUD catalog products |
| **Actions** | Run Daily Calc, Referral Bonus, Monthly Draw; set credit limit |

---

### 3.11 Wallet & Coins (Customer)

| Step | Action | Route/Component |
|------|--------|------------------|
| 1 | Earn coins | Per payment (config in Admin → Coins) |
| 2 | View balance | `/customer/wallet` |
| 3 | Use at checkout | PublicMenu: “Use wallet” slider |
| 4 | Redeem | `/customer/redemption` → request cash/coupon |
| 5 | Admin | Cx Redemptions tab → approve/reject |

---

### 3.12 Order Tracking

| Step | Action | Route/Component |
|------|--------|------------------|
| 1 | After order | Link to `/order/:orderId` |
| 2 | Public page | `getOrderForTracking` RPC (no auth) |
| 3 | Share | Copy link for customer/vendor |

---

## 4. ROUTE SUMMARY

| Route | Auth | Role | Description |
|-------|------|------|-------------|
| `/` | No | All | Landing |
| `/auth` | No | — | Vendor sign-in/up |
| `/customer-login` | No | — | Customer sign-in |
| `/search` | No | All | Find dukaan |
| `/catalog` | No | All | Browse supplies |
| `/menu/:vendorId` | No | All | Dukaan entry |
| `/menu/:vendorId/browse` | No | All | Browse menu, order |
| `/menu/:vendorId/pay` | No | All | Pay direct |
| `/order/:orderId` | No | All | Track order |
| `/payment/return` | No | All | Payment return |
| `/dashboard` | Yes | Vendor | Dashboard |
| `/sales` | Yes | Vendor | My Shop |
| `/pos` | Yes | Vendor | Quick POS |
| `/orders` | Yes | Vendor | Supply orders |
| `/loyalty` | Yes | Vendor | Loyalty |
| `/profile` | Yes | Vendor | Profile |
| `/forum` | Yes | Vendor | Forum |
| `/swap` | Yes | Vendor | Swap |
| `/courses` | Yes | Vendor | Courses |
| `/cart` | Yes | Vendor | Cart |
| `/admin` | Yes | Admin | Admin dashboard |
| `/customer/orders` | Yes | Customer | Customer orders |
| `/customer/wallet` | Yes | Customer | Wallet |
| `/customer/transactions` | Yes | Customer | Transactions |
| `/customer/redemption` | Yes | Customer | Redemption |
| `/contact` | No | All | Contact |

---

## 5. KEY MIGRATIONS & DEPENDENCIES

| Migration | Purpose |
|-----------|---------|
| `20260216000000_initial_schema.sql` | profiles, orders, etc. |
| `20260217000000_get_vendor_public_info.sql` | RPC for VendorEntry |
| `20260220000000_fix_vendor_search_ambiguous_vendor_id.sql` | Search RPC fix |
| `20260220100000_seed_sectors_categories.sql` | Sectors, categories seed |
| `20260220200000_premium_subscription.sql` | premium_expires_at, search ranking |
| `20260220300000_customer_orders_insert_policy.sql` | RLS for guest inserts |
| `20260220400000_ensure_search_schema.sql` | zone, opening_hours, etc. |
| `20260220500000_ad_placement_config.sql` | Ad placement toggles |

---

## 6. ENV & EDGE FUNCTIONS

| Env | Purpose |
|-----|---------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase client |
| `CCAVENUE_MERCHANT_ID`, `CCAVENUE_ACCESS_CODE`, `CCAVENUE_WORKING_KEY`, `CCAVENUE_MODE` | CCAvenue (Edge Function secrets) |
| `VITE_WHATSAPP_API_KEY` | Optional: payment alerts |

| Edge Function | Purpose |
|---------------|---------|
| `create-cca-order` | Create encrypted payment request |
| `verify-cca-payment` | Return handler: decrypt + update DB |
