# Click & Fix – Web apps (Customer · Technician · Admin)

One Vite + React project that contains three apps sharing one data store:

| App | URL (dev) | Who uses it |
|---|---|---|
| Customer | `http://localhost:5173/` | your original prototype, now connected to the shared data |
| Technician | `http://localhost:5173/technician/` | field team (mobile-first) |
| **Admin dashboard** | `http://localhost:5173/admin/` | business owner / dispatcher |

## Run
```bash
npm install
npm run dev        # development
npm run build      # production build in dist/ (all three apps)
npm run preview    # serve the production build
```
Needs Node 18+. `package.json` uses `latest` for React/Vite like your original project; pin versions once it works for you.

**Admin demo login:** `admin@clickfix.in` / `admin123`  (a client-side gate only – see "Before going live").

## Try the full flow (use three browser tabs, same browser)
1. **Customer** → pick a service → book (try coupon `WELCOME10`).
2. **Admin** → *Bookings* (or the "Awaiting assignment" panel on the Dashboard) → assign a technician.
3. **Technician** → the job appears as *New* → Accept → Start journey → Start work → enter final amount → Complete.
4. **Customer** → *Track* updates live; *Payments* shows the new payment. **Admin** totals, payments and reports update too.
5. **Admin → Service Categories**: change a price or hide a service – the customer app updates instantly.

## Admin dashboard (matches your poster)
Dashboard (KPIs, bookings trend, services split, awaiting-assignment, recent bookings, top technicians) · Customers · Technicians (add, suspend) · Bookings (search, filter, assign, unassign, cancel, CSV export) · Service Categories (price, visibility, add) · Inventory (stock +/−, low-stock alerts) · Payments (CSV export) · Reports · Offers & Coupons · Settings (technician payout %, reset demo data) · Logout.

## Folder layout
```
index.html                 customer entry          technician/index.html   admin/index.html
src/shared/   seed.js (sample data) · store.js (shared state + actions) · utils.js · logo.png
src/customer/ App.jsx · styles.css      src/technician/ App.jsx · styles.css
src/admin/    App.jsx (login, sidebar) · pages.jsx · charts.jsx · styles.css
```

## How the data works (demo mode)
All three apps read/write `localStorage` (key `clickfix.web.v1`) through `src/shared/store.js`, and sync across tabs with the browser `storage` event. That is why they only share data **in the same browser on the same address**.
**The Android apps are separate and do not talk to this admin yet.**

## Before going live (what is NOT real yet)
1. **Backend + database.** Replace each function in `store.js → actions` (and the initial load) with API calls. The screens only use `useStore()` and `actions.*`, so they stay as they are. The Android apps should call the same API so all four clients share data.
2. **Real admin authentication.** The login here is a hard-coded demo gate and is not secure. Use server-side auth (sessions/JWT, roles) and check permissions on the server.
3. **Payments** (Razorpay etc.), **OTP login** for customers/technicians, **push notifications**, and **live GPS tracking**.
4. Validation, audit logs and role-based access (admin vs dispatcher) on the server.
