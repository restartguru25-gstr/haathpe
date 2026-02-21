# Auth & navigation flow (vendor / dukaanwaale)

This doc explains where users land and how sign-in, sign-up, and logout work so the UX is predictable.

**Rule:** Without signing up or signing in, the app does **not** know whether you are a customer or a vendor. So **Profile**, **My Shop**, **Dashboard**, and other vendor areas open **only after** you sign in. Until then you see the **Landing** page (and public pages like Search). After sign-in, the header on Landing shows **"Signed in as [your email or phone]"** and **Log out** so it is clear you are logged in.

---

## 1. New visitor (not signed in)

| Where they are | Where they land |
|----------------|------------------|
| Open site or go to `/` | **Landing page** (`/`) — home with hero, Features, Get started, etc. |

---

## 2. When they click Sign in / Sign up / Get started / My Shop

| Action | What happens |
|--------|----------------|
| **Sign in** or **Sign up** (header) | Navigate to **`/auth`**. No `next` is sent, so after login they go to **Dashboard** (`/dashboard`). |
| **Get started** | Same as above → `/auth` → after login → **Dashboard**. |
| **My Shop** (when not logged in) | Navigate to **`/auth`** with `state: { next: "/sales" }`. After login they go to **My Shop** (`/sales`). |
| **Dashboard** (when not logged in) | Same idea → `/auth` with `next: "/dashboard"` → after login → **Dashboard**. |

So: **Sign in / Sign up** → after success → **Dashboard**. **My Shop** (when not logged in) → after success → **My Shop**.

---

## 3. After they sign in or sign up on `/auth`

| How they got to `/auth` | Where they land after successful sign-in |
|-------------------------|------------------------------------------|
| From **Sign in** / **Sign up** / **Get started** (no `next`) | **Dashboard** (`/dashboard`) |
| From **My Shop** (we passed `next: "/sales"`) | **My Shop** (`/sales`) |
| From **ProtectedRoute** (e.g. they opened `/profile` while logged out) | Back to **that page** (e.g. `/profile`) |

So: we always send them to the page they intended, or to Dashboard by default.

---

## 4. Logout (from Profile)

| Action | What happens |
|--------|----------------|
| User is on **Profile** (`/profile`) and clicks **Logout** | Session is cleared and the app does a **full redirect to `/`** (Landing). They see the **Landing page** again, as a visitor. |

So: **Logout** always ends on the **Landing page** (`/`).

---

## 5. When they are already logged out

| If they try to open… | What happens |
|----------------------|--------------|
| **`/profile`**, **`/sales`**, **`/dashboard`**, or any protected route | They are **redirected to `/auth`** with `state: { next: "/profile" }` (or the path they tried). They **cannot** see Profile/Sales/Dashboard until they sign in. After sign-in they are sent back to that page. |

So: **no “logged out but still on Profile”**. If they’re logged out and open Profile (or Sales, etc.), they go to Sign in first; after sign-in they return to the page they wanted.

---

## Summary

| Scenario | Page they land on |
|----------|--------------------|
| New visitor opens site | **Landing** (`/`) |
| Click Sign in / Sign up → complete auth | **Dashboard** (`/dashboard`) |
| Click My Shop (not logged in) → complete auth | **My Shop** (`/sales`) |
| Click Logout (from Profile) | **Landing** (`/`) |
| Logged out and open `/profile` or `/sales` | **Sign in** (`/auth`), then back to that page after login |

---

## Troubleshooting: "New vendor" / missing profile and catalog

If you sign in with **dukaan@hyder.com** (or another account) and My Shop looks like a fresh signup (no saved profile, no catalog):

### Likely cause: separate auth identities

Supabase creates **different users** for different sign-in methods:
- Sign up with **email** (dukaan@hyder.com) → user A (id: `xyz`)
- Sign up with **phone** (OTP) → user B (id: `abc`)

Profile and catalog are stored by `user.id`. If you saved data while signed in with **phone**, but you now sign in with **email**, you get user A, which has no profile or menu.

### What to do

1. **Use the same sign-in method** – If you created the shop with phone OTP, always sign in with phone. If you created it with email/magic link, always sign in with email.
2. **Verify in Supabase** – In Supabase Dashboard → Authentication → Users, check if there are multiple users for the same person (one with email, one with phone). If so, either link them (Supabase supports identity linking) or always use one method.
3. **Check profile row** – In Table Editor → `profiles`, find the row where `id` = your user's UUID. The app fetches profile by `auth.uid()` = `profiles.id`. If the row is missing or has the wrong id, that explains the "new vendor" state.
4. **Dev console** – When profile stays null after retries, the app logs in dev: `[Auth] Profile null after retries. Check Supabase profiles for id: <uuid>`. Use that id to verify the profile row exists.

---

## Code references

- **Protected routes**: `src/components/ProtectedRoute.tsx` — redirects to `/auth` with `next` when not authenticated. No guest/dev bypass.
- **Auth page**: `src/pages/Auth.tsx` — uses `state.next` (or `/dashboard`) for where to go after sign-in.
- **Logout**: `src/pages/Profile.tsx` → `handleLogout` → `signOut()` then `window.location.replace("/")`.
- **Landing**: `src/pages/Landing.tsx` — “My Shop” uses `navigate("/auth", { state: { next: "/sales" } })`. When signed in, header shows "Signed in as [email/phone]" and Log out. Profile and Sales redirect to /auth if user is missing.
