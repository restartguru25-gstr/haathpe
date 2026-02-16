# VendorHub – Implemented Features & Static / Placeholder Content

## 1. Implemented Features (Total Overview)

### Authentication & Access
- **Landing** (`/`) – Dual-mode tiles (Buy supplies / Sell to customers), language toggle (EN/Hi/Te), testimonials, steps, stats, sign-in CTA. Redirects to `/auth` or app based on session.
- **Auth** (`/auth`) – Phone OTP, Magic link, Email+Password sign-in. Redirects to `location.state?.next` or dashboard after sign-in.
- **Protected routes** – All app routes require auth in production; dev allows guest with banner. Auth init has timeout safeguard so loading always resolves.
- **Profile (Supabase)** – Create/update profile on sign-in; `stall_type`, `stall_address`, `name`, `phone` editable in Profile page.

### Purchases (Vendor Buys Supplies)
- **Catalog** (`/catalog`) – Sectors/categories from Supabase; products from `catalog_products` with variants, GST, MRP. Fallback to static product list when Supabase catalog is empty. Search, sort, eco filter, add to cart (with variant + GST).
- **Cart** (`/cart`) – Cart from AppContext; GST breakdown; place order → `orders` + `order_items` in Supabase; loyalty points, streak, draw entry (≥₹1000); notifications; invoice PDF download (jsPDF).
- **Orders** (`/orders`) – List from Supabase `orders` + `order_items`; fallback to sample orders when empty or on error. Reorder (with variants), filter (All/Active/Past), GST invoice sheet + PDF/TXT download.

### Sales (Vendor Sells to Customers)
- **My Shop Menu** (`/sales`) – Default menu by stall type (sector); activate default → `vendor_menu_items`; edit selling prices; link to POS and public menu; QR code for `/menu/:vendorId`.
- **POS** (`/pos`) – Tiles from `vendor_menu_items`; cart; Cash/UPI buttons; Cash creates `customer_orders`; UPI shows toast (stub).
- **Public menu** (`/menu/:vendorId`) – Public page; menu from `vendor_menu_items` (active); cart; “Pay online” creates `customer_order` with `payment_method: 'online'`, `payment_id: null` (no real gateway).
- **Dashboard Sales Overview** – Today’s revenue, top items, stats from `customer_orders` via `getSalesStats`. Realtime toasts for new `customer_orders`.

### Profile & Settings
- **Profile** (`/profile`) – View/edit name, stall type, stall address, phone; language; notification settings (local); push notifications (if supported); credit wallet display; community links; logout. Saves to Supabase `profiles`.
- **Loyalty** (`/loyalty`) – Points, tier, streak from profile; redeem options (static list); past winners (static); streak calendar.

### Community & Learning
- **Forum** (`/forum`) – Topics and replies from Supabase `forum_topics` / `forum_replies`; post topic, reply; realtime updates.
- **Courses** (`/courses`) – Static list of courses (hygiene, accounts, digital, growth); progress in Supabase `course_progress`.
- **Course detail** (`/courses/:courseId`) – Sections and content from static `COURSES`; mark section complete → `course_progress`.

### Notifications & Admin
- **Notifications** (`/notifications`) – List from Supabase `notifications`; mark read / mark all read; unread badge in nav.
- **Admin** (`/admin`) – Role-gated; vendors list and orders from Supabase; run daily draw; set credit limit per vendor.

### Infrastructure & UX
- **PWA** – Manifest, service worker, meta for install.
- **Mobile** – Bottom nav, FAB cart, MobileHeader, safe-area; responsive layout.
- **i18n** – EN / Hindi / Telugu for app strings (from `src/lib/data.ts` translations).
- **Realtime** – `customer_orders` for vendor new-order toasts; forum topics/replies refresh.

---

## 2. Static Data & Placeholders

### 2.1 Static / Fallback Data (Intentional)

| Location | What | Purpose |
|----------|------|--------|
| `src/lib/data.ts` | `products` (10 items) | Fallback when Supabase `catalog_products` is empty or not used; used in Catalog when `useCatalogMode` is false. |
| `src/lib/data.ts` | `sampleOrders` (4 orders) | Fallback in **Orders** when Supabase `orders` returns empty or on error; fallback in **Dashboard** for “Today’s Orders” when no orders. |
| `src/lib/data.ts` | `vendorProfile` (Raju, Tea Stall, etc.) | Default profile when user not signed in or profile not in Supabase; used by `useProfile()` for name, stallType, points, tier, streak, credit, etc. |
| `src/lib/data.ts` | `translations` (en, hi, te) | All in-app copy (labels, toasts, headings). |
| `src/lib/courses.ts` | `COURSES` (4 courses with sections) | All course content (hygiene, accounts, digital, growth). |
| `src/pages/Loyalty.tsx` | `REDEEM_OPTIONS` | Redeem options (Family Trip, Repair Kit, Credit Boost, Supplies Kit). |
| `src/pages/Loyalty.tsx` | `PAST_WINNERS` | Past draw winners (names, prizes, dates). |
| `src/pages/Landing.tsx` | `features`, `steps`, `testimonials`, `stats` | Landing copy and social proof. |

### 2.2 Placeholders / Stubs (To Be Replaced)

| Location | What | Current behavior | Intended replacement |
|----------|------|------------------|----------------------|
| **POS** (`src/pages/POS.tsx`) | UPI payment | “Generate UPI QR” / UPI button shows toast: *“UPI QR integration: Add Razorpay/GPay stub. For now use Cash.”* | Integrate Razorpay (or GPay) for UPI/QR; create order with `payment_method: 'upi'` and real `payment_id`. |
| **Public menu** (`/menu/:vendorId`) | Online payment | “Pay online” creates `customer_order` with `payment_method: 'online'`, `payment_id: null`. No actual payment gateway. | Razorpay (or similar) checkout; on success create order with real `payment_id`. |
| **Profile** | Input placeholders | “Your name”, “e.g. Near Charminar, Hyderabad”, “+91 98765 43210” | Can stay as hints or be made configurable. |
| **Auth** | Input placeholders | Phone “98765 43210”, email “you@example.com”, admin “admin@street.com” | Can stay as hints. |

### 2.3 Dev-Only / Conditional

| Location | What | Notes |
|----------|------|--------|
| **ProtectedRoute** | Guest access in dev | In development, unauthenticated users can use the app; banner says “Viewing as guest (dev only)”. |
| **AuthContext** | 8s timeout | If auth (e.g. `getSession`) hangs, loading is forced off after 8s so the app still renders. |

### 2.4 Optional / External

| Item | Status | Notes |
|------|--------|--------|
| Push notifications | Optional | Uses Supabase + optional Edge Function `send-notification-channels`; requires `VITE_VAPID_PUBLIC_KEY` for push. |
| Notifications table | Supabase | Real; no static list. Empty state copy is static. |
| Forum | Supabase | Real topics/replies; no static topics. |
| Default menu items | Supabase (part6 seed) | Seeded per sector (PaniPuri, Tiffin, Pan, Tea, Fast Food). Not static in app. |

---

## 3. Summary Table

| Area | Features | Static / Placeholder |
|------|----------|----------------------|
| **Auth** | Landing, Auth (OTP, magic link, email/password), ProtectedRoute, profile create/update | Landing copy, testimonials, steps, stats; input placeholders |
| **Purchases** | Catalog (Supabase + fallback), Cart, Orders, GST, invoice PDF | `products`, `sampleOrders` fallback; Orders product display fallback from `products` when product_id not in catalog |
| **Sales** | Sales menu, POS, Public menu, Dashboard sales, Realtime | UPI in POS = stub; Public “Pay online” = no gateway |
| **Profile** | Profile edit, loyalty, settings, language | `vendorProfile` when no Supabase profile; Loyalty redeem options & past winners |
| **Community** | Forum (Supabase), Courses (content static) | Course content in `COURSES`; redeem/winners in Loyalty |
| **Other** | Notifications, Admin, PWA, mobile, i18n | Notification empty-state copy; admin form placeholders |

---

## 4. Recommended Next Steps (To Remove Placeholders)

1. **POS UPI** – Integrate Razorpay (or GPay) UPI/QR; replace toast stub with real payment flow and set `payment_id` on `customer_orders`.
2. **Public menu Pay online** – Add Razorpay (or similar) checkout for `payment_method: 'online'` and persist `payment_id` on order.
3. **Optional** – Replace Loyalty `PAST_WINNERS` with data from a “draw_winners” or similar table; replace `REDEEM_OPTIONS` with backend-driven rewards if you add redemption logic.
