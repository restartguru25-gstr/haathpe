# Haathpe – Full Feature Document (Pitch Deck)

**Product:** Haathpe – Dukaanwaale Ka App | Sab Kuch Haath Pe  
**Audience:** Pitch deck / investor & partner documentation  
**Last updated:** February 2026  

---

## 1. Product Overview

Haathpe is a **B2B2C platform** for small retailers (dukaanwaale) and their customers in India. It serves two primary user types:

- **Vendors (Dukaanwaale):** Order wholesale supplies (B2B), run their dukaan (POS, online menu, sales), earn loyalty, credit lines, and rewards.
- **Customers:** Discover vendors, order from public menus, track orders, and leave reviews.

**Core value propositions:**

- **For vendors:** Easy supplies delivery, streak-based credit lines, loyalty points & redemption (trips, cash, supplies), POS & online menu, incentives & referral bonuses.
- **For customers:** Search vendors by zone/stall type, order from QR/menu link, track orders in real time, favorite vendors & items.

**Tech stack:** React (Vite), TypeScript, Supabase (auth, DB, realtime), Tailwind CSS, Vercel deployment. Multi-language: English, Hindi, Telugu.

---

## 2. Panel-Wise Features

### 2.1 Landing & Public (No login required)

| Feature | Description |
|--------|-------------|
| **Landing page** | Hero with tagline, language toggle (EN / हि / తె), dual CTAs: “I want to buy supplies” (vendor purchases) and “I run a dukaan” (vendor sales). Stats (e.g. 1000+ Dukaanwaale, 50K+ orders, Hyderabad). |
| **How it works** | 4-step flow: Sign up → Order supplies → Build streak & credit → Earn rewards. |
| **Features section** | Easy Supplies, Unlock Credit, Earn & Redeem (with icons and short copy). |
| **Testimonials** | Vendor quotes (e.g. tea stall, snacks, beverage) with name, stall, quote. |
| **Buy vs Sell cards** | Two cards: “Buy supplies” (catalog, credit, loyalty, delivery) and “Sell at dukaan” (default menu, POS, QR orders, sales tracking). |
| **Footer CTA** | Sign in / Sign up, Terms, Privacy. Make in India footer. |
| **Search (public)** | `/search` – Vendor discovery by keyword, zone (e.g. Charminar, Gachibowli), stall type, sort (popular, rating, etc.). Results as vendor cards; link to public menu. |
| **Public menu** | `/menu/:vendorId` – Browse vendor’s active menu, add to cart, choose pickup/self-delivery, place order (guest or customer login). Shop open/closed status, opening hours. Optional customer login for favorites & order history. |
| **Order tracking (public)** | `/order/:orderId` – Real-time status timeline for a customer order; shareable link; copy link. |
| **Customer login** | `/customer-login` – Phone OTP (India +91) for customers to access “My orders” and favorites. |

---

### 2.2 Vendor Panel – Purchases (Dukaan buying supplies)

*Routes under protected layout: Dashboard, Catalog, Cart, Orders, Loyalty, Profile, Forum, Swap, Courses, Notifications.*

| Feature | Description |
|--------|-------------|
| **Auth** | `/auth` – Sign in / Sign up via Phone OTP (+91), Magic Link (email), or Email & password. Required “I agree to Terms & Conditions and Privacy Policy” checkbox. Back to home. |
| **Dashboard** | `/dashboard` – Greeting (morning/afternoon/evening), profile summary (name, stall type, streak, points, tier). Credit line usage (used/limit, %), days to unlock credit. Today’s orders count, quick links to Catalog, Orders, Loyalty. Sales snapshot (today’s revenue, orders, top items) when user has sales role. Shop open/closed badge. |
| **Catalog** | `/catalog` – B2B product catalog: sectors, categories, search, eco filter, sort (price, name). Product cards with name (EN/Hi/Te), price (INR), add to cart. Product detail sheet with variants (if any), quantity, add to cart. Cart icon with count in header. |
| **Cart** | `/cart` – Cart line items, quantity update, remove. Subtotal, GST, total. Place order. |
| **Orders** | `/orders` – List of vendor’s supply orders: All / Active / Past. Order card: id, date, status (pending, in-transit, delivered), total, line items. Invoice view: download/print PDF, re-order. |
| **Loyalty** | `/loyalty` – Points balance, tier (Bronze/Silver/Gold), tier progress. Streak (e.g. 30-day calendar). Redeem options: Family Trip Voucher, Repair Kit, Credit Boost, Supplies Kit (points cost). Green score & tree planting (points). Past winners (daily draw). |
| **Profile** | `/profile` – Edit name, stall type, address, phone, business details (GST, PAN, Udyam, FSSAI, UPI). Shop photo upload. Language (EN/Hi/Te). Notification settings (in-app). Push notification subscribe/unsubscribe. Shop timings: open/close, weekly off, holidays, “open for orders” toggle. Transaction history: PDF/CSV download, share. Svanidhi Boost link. Referral: share link, copy referral link; copy “Invite Dukaanwaale” – earn when referred vendor hits 100 entries. Withdraw (incentive payout). Admin link (if admin). Sign out. |
| **Forum** | `/forum` – Community forum: list topics (title, author, reply count), open topic to see replies. Create topic, post reply. Realtime updates (Supabase). |
| **Swap** | `/swap` – Vendor-to-vendor swap/marketplace: list approved swaps (title, description, location, price notes). View detail, rate & review. Create swap listing (title, description, price notes, location). Admin moderates (approve/reject). |
| **Courses** | `/courses` – Upskill courses for vendors: list courses with progress (X/Y sections). Open course → Course detail. |
| **Course detail** | `/courses/:courseId` – Sections/chapters, mark section complete, progress tracking. |
| **Notifications** | `/notifications` – In-app notification list (order updates, promotions, draw results). Mark read, mark all read. Unread count in nav. |

---

### 2.3 Vendor Panel – Sales (Dukaan selling to customers)

*Routes: Sales, POS; optional Ondc Export.*

| Feature | Description |
|--------|-------------|
| **Sales** | `/sales` – **Menu:** Sector-based default menu; “Activate default menu”; edit item prices; add custom item (name, price). **Orders:** Customer orders list (real-time); status updates (e.g. accepted → preparing → ready → delivered). **Reviews:** Customer reviews for vendor. **Incentives:** Today’s entry count, last 7 days & this month earnings; incentive slabs (daily/monthly/referral); list of earned incentives. **Platform fee:** Display of applicable platform fee (%). **ONDC:** Link to ONDC orders (if any). **Referral:** Copy referral link; copy “Invite Dukaanwaale” CTA; referral bonus description. **Premium:** Optional “Upgrade to premium” CTA. **QR / Public menu link:** Open public menu in new tab. Real-time subscription for new customer orders. |
| **POS** | `/pos` – In-shop POS: load vendor menu items, add to cart (quantity), remove/update qty. Subtotal, GST, total. “Cash” – record sale (creates customer order as paid). “UPI / QR” – placeholder for future integration. Real-time order creation in DB. |
| **ONDC export** | `/vendor/ondc-export` – Export vendor profile + menu as ONDC-compliant catalog JSON for upload to ONDC network. |

---

### 2.4 Customer Panel

*Routes: Public menu (above), Customer login, Customer orders. Search is shared with public.*

| Feature | Description |
|--------|-------------|
| **Customer login** | `/customer-login` – Phone (+91) → Send OTP → Verify OTP. Return URL support (`returnTo`). |
| **Public menu** | `/menu/:vendorId` – For logged-in customers: favorites (heart) on items; order history can feed “My orders.” Delivery option (pickup / self-delivery), delivery address. Place order → order id; redirect to tracking or orders. |
| **Customer orders** | `/customer/orders` – List orders for logged-in customer (by phone). Order card: vendor, items, total, status. Status timeline. Submit review (rating + text) per order. Real-time updates. Sign out. |
| **Order tracking** | `/order/:orderId` – Shared with public: timeline of status (e.g. placed → accepted → preparing → ready → delivered). Copy tracking link. |

---

### 2.5 Admin Panel

*Route: `/admin`. Access restricted by role (admin).*

| Feature | Description |
|--------|-------------|
| **Vendors** | List vendors (name, phone, stall type, credit limit/used, streak, points, tier, role). Edit vendor (e.g. credit limit). Delete vendor (with confirm). |
| **Orders** | List orders (id, user, total, status, date, items). Update order status. Delete order (with confirm). |
| **Swaps** | Pending swaps: approve/reject. All swaps list; delete swap. |
| **Incentives** | List vendor incentives (daily/monthly/referral). Incentive slabs: add/edit/delete slab (type, min/max count, reward amount, active). **Daily incentive calc** – run job (entries → payouts). **Referral bonus calc** – run job (pay referrers for referred vendors who hit 100 entries). **Monthly draw** – run draw; show eligible vendors, trigger winner. |
| **Ads** | List ads (brand, title, image, link, zone, active, priority). Add/edit ad; image upload. Delete ad. |
| **ONDC** | List ONDC orders (platform). Platform fee config: set global fee %. |
| **Platform fees** | Default fee %; list vendor-level fees (override/exempt). Per-vendor fee form (type: percentage/fixed/slab, value, min order, exempt). Bulk set default %; bulk exempt vendors. Fee summary (this month: total fee, order count). |
| **Reward redemptions** | List redemptions (user, reward type, points, status, date). |
| **Svanidhi support** | List Svanidhi support requests (user, status, admin notes). |

---

## 3. Feature-Wise Summary (Cross-cutting)

### 3.1 Authentication & Users

- **Vendor auth:** Phone OTP (+91), Magic Link (email), Email + password. Terms & Conditions checkbox required.
- **Customer auth:** Phone OTP (+91) only; session for “My orders” and favorites.
- **Profiles:** Vendor profile (name, stall type, address, phone, business docs, shop timings, photos, language, notification prefs). Customer profile (phone, favorites, favorite vendors).

### 3.2 Commerce – B2B (Vendor purchases)

- Catalog (sectors, categories, products, variants), cart, place order.
- Orders list with status; invoice (PDF); re-order.
- GST in cart and orders.

### 3.3 Commerce – B2C (Vendor sales to customers)

- Vendor menu (default by sector + custom items); activate default, edit prices.
- POS: in-shop cash (and placeholder UPI/QR).
- Customer orders from public menu (pickup/self-delivery); real-time status updates.
- Customer reviews per vendor; display on Sales.
- Platform fee (configurable per vendor / default); admin fee management.

### 3.4 Loyalty & Incentives

- Points, tiers (Bronze/Silver/Gold), streak (e.g. 30 days).
- Redemptions: family trip, repair kit, credit boost, supplies kit, tree planting.
- Daily/monthly draws; past winners.
- Incentive slabs (daily/monthly/referral); admin runs daily calc, referral calc, monthly draw.
- Referral: vendor share link; referrer earns when referred vendor hits 100 entries; admin runs referral bonus calc.

### 3.5 Credit

- Credit limit (admin-editable per vendor); credit used; display on Dashboard and Profile.
- Unlock credit by streak (e.g. 20/30 days).
- Credit boost redemption (loyalty points).

### 3.6 Discovery & Search

- Vendor search: keyword, zone, stall type, sort (popular, rating, etc.). Vendor cards with link to public menu.
- Public menu by vendor; shop open/closed; opening hours.

### 3.7 Notifications

- In-app notifications (order update, promotion, draw result); mark read; unread count.
- Optional push notifications (subscribe/unsubscribe in Profile).
- Realtime (Supabase) for orders, forum, menu/profile updates.

### 3.8 Content & Engagement

- Forum: topics, replies, create topic/reply.
- Swap: vendor listings; ratings/reviews; admin moderation.
- Courses: list courses, sections, progress, mark complete.

### 3.9 Operations & Integrations

- **ONDC:** Export catalog (vendor); admin view ONDC orders; platform fee config.
- **Platform fees:** Per-vendor and default; percentage/fixed/slab; exempt; summary.
- **Ads:** Zone-based ads; admin CRUD; impression tracking; display on public menu.
- **Transaction history:** Vendor PDF/CSV download and share.
- **Svanidhi:** Link to Svanidhi Boost from Profile; admin Svanidhi support list.

### 3.10 Localization & Accessibility

- Languages: English, Hindi, Telugu (landing, catalog, key copy).
- Make in India footer; Terms & Privacy links.

---

## 4. Routes Quick Reference

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | Public | Landing |
| `/auth` | Public | Vendor sign in / sign up |
| `/search` | Public | Vendor search |
| `/menu/:vendorId` | Public | Public menu & order |
| `/order/:orderId` | Public | Order tracking |
| `/customer-login` | Public | Customer OTP login |
| `/customer/orders` | Customer | My orders & reviews |
| `/dashboard` | Vendor | Dashboard |
| `/catalog` | Vendor | B2B catalog |
| `/cart` | Vendor | Cart |
| `/orders` | Vendor | Supply orders |
| `/loyalty` | Vendor | Loyalty & rewards |
| `/profile` | Vendor | Profile, settings, referral |
| `/forum` | Vendor | Forum |
| `/swap` | Vendor | Swap marketplace |
| `/courses` | Vendor | Courses list |
| `/courses/:courseId` | Vendor | Course detail |
| `/notifications` | Vendor | Notifications |
| `/sales` | Vendor | Sales panel (menu, orders, incentives) |
| `/pos` | Vendor | POS |
| `/vendor/ondc-export` | Vendor | ONDC catalog export |
| `/admin` | Admin | Admin panel |

---

## 5. Differentiators for Pitch

- **Single app** for vendors: buy supplies (B2B) and sell at dukaan (B2C) with one account.
- **Streak-based credit** to improve retention and order frequency.
- **Loyalty that matters:** trips, cash, supplies, credit boost, tree planting.
- **Real-time:** orders, forum, menu/status so vendors and customers stay in sync.
- **Multi-language** (EN/Hi/Te) for local adoption.
- **ONDC-ready:** catalog export and platform fee handling.
- **Admin control:** incentives, fees, ads, swaps, redemptions, and ops in one panel.

Use this document as the single source of truth for “what’s implemented” in decks, demos, and partner conversations.
