# V8 Sim Booking — Project Spec

## Overview
A private event booking platform for V8 Sim House LLC. Clients book a mobile racing simulator experience for their events. The admin reviews requests, approves or declines them, and collects payment in two stages (deposit on approval, remainder on event day).

**Stack:** Next.js 14 (App Router) · Supabase (Postgres + RLS) · Stripe · Resend · Vercel

---

## Architecture

### Payment Flow (Two-Stage)
1. **Client books** → Stripe PaymentIntent created with `capture_method: "manual"` (card hold only, not charged)
2. **Admin approves** → Deposit captured + remainder PaymentIntent created (`off_session`, ready for event day)
3. **Admin charges remainder** → Remainder PaymentIntent captured on event day
4. **Admin declines** → Deposit PaymentIntent cancelled (hold released) or refunded if already captured

### Database (Supabase)
| Table | Purpose |
|---|---|
| `clients` | Customer records (email unique) |
| `sim_bookings` | Booking records with pricing snapshot + Stripe intent IDs |
| `sim_booking_addons` | Line items for selected add-ons per booking |
| `sim_packages` | Admin-configurable packages (hours, discount %) |
| `sim_addons` | Admin-configurable add-ons (flat or per-hour pricing) |
| `sim_pricing_config` | Single-row config (hourly rate, setup fee, deposit %, travel buffer) |

### Booking Statuses
`pending` → `approved` → `completed`
`pending` → `declined`
`approved` → `cancelled`

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/bookings/create` | Creates booking + Stripe deposit PI |
| POST | `/api/bookings/[id]/approve` | Captures deposit + creates remainder PI |
| POST | `/api/bookings/[id]/decline` | Cancels/refunds deposit PI |
| POST | `/api/bookings/[id]/charge-remainder` | Captures remainder PI |
| POST | `/api/bookings/[id]/cancel` | Cancels approved booking + remainder PI |
| GET | `/api/bookings/availability` | Returns booked time slots + travel buffer |
| POST | `/api/stripe/webhook` | Handles Stripe async events (payment failed/cancelled) |

---

## Key Files

```
app/
  api/bookings/
    create/route.ts          — booking creation + Stripe customer + deposit PI
    [id]/approve/route.ts    — capture deposit + create remainder PI
    [id]/decline/route.ts    — cancel/refund deposit PI
    [id]/charge-remainder/   — capture remainder PI
    [id]/cancel/             — cancel approved booking
    availability/route.ts    — time availability with travel buffer
  api/stripe/webhook/        — Stripe webhook handler
  admin/
    bookings/[id]/page.tsx   — booking detail + approve/decline/charge actions
    settings/page.tsx        — pricing config, packages, add-ons, travel buffer
  book/
    page.tsx                 — 4-step booking form orchestration
    success/                 — post-booking success page
components/booking/
  Step1Package.tsx           — package selection
  Step2Addons.tsx            — add-on selection
  Step3Details.tsx           — event details, time slot picker, availability
  Step4Payment.tsx           — Stripe card element + booking submission
  DatePicker.tsx             — date picker (blocks past dates)
  AddressAutocomplete.tsx    — Google Maps Places autocomplete
lib/
  stripe.ts                  — Stripe singleton
  supabase.ts                — Supabase client + admin client
  resend.ts                  — all email templates and send functions
  pricing.ts                 — pricing calculation logic
types/booking.ts             — all shared TypeScript types
supabase/
  schema.sql                 — full DB schema + seed data + RLS policies
  migration_001_*.sql        — added is_per_hour to addons, discount_percent to packages
  migration_002_*.sql        — added travel_buffer_hours to pricing config
```

---

## Completed Changes

### Stripe Payment Fixes
**Problem:** Two Stripe errors when handling multiple bookings from the same user.

**Fix 1 — PaymentMethod reuse across PaymentIntents**
- `app/api/bookings/create/route.ts`: On booking creation, find or create a Stripe Customer by email. Create the deposit PI with `customer: stripeCustomerId` + `setup_future_usage: "off_session"`. This saves the payment method to the customer after confirmation.
- `app/api/bookings/[id]/approve/route.ts`: Create remainder PI with `customer: pi.customer`, `payment_method: pi.payment_method`, `off_session: true`, `confirm: true`. The PI goes straight to `requires_capture` with `capture_method: "manual"`.
- **Root cause:** Stripe does not allow reusing a PaymentMethod across multiple PaymentIntents unless it is attached to a Customer.

**Fix 2 — Decline route crashing on succeeded PaymentIntent**
- `app/api/bookings/[id]/decline/route.ts`: Now retrieves PI status before acting. If `succeeded` → issues a refund instead of cancel. If `canceled` → skips Stripe call. Otherwise → cancels to release the hold.
- **Root cause:** `stripe.paymentIntents.cancel()` throws if PI status is `succeeded`.

### Time Slot Availability (booking form)
- `app/api/bookings/availability/route.ts`: Upgraded from returning just booked dates to returning `{ bookings: [{date, startTime, durationHours}], travelBufferHours }`. Added `export const dynamic = "force-dynamic"` to prevent Next.js static prerender at build time (which fails without env vars).
- `components/booking/Step3Details.tsx`: Replaced native `<select>` with a scrollable custom time slot grid (15-min intervals, 8am–10pm). Slots are blocked when:
  - The user's session `[T, T+duration]` overlaps with an existing booking's buffered window `[start−buffer, end+buffer]`
  - The session would end past 10pm
  - Blocked slots render as grayed-out with strikethrough and are non-clickable.
- `app/book/page.tsx`: Computes `durationHours` from selected package or custom hours and passes it to Step3 so blocking is accurate per their booking length.

### Travel Buffer Setting
- `supabase/migration_002_travel_buffer.sql`: Adds `travel_buffer_hours int NOT NULL DEFAULT 1` to `sim_pricing_config`. **Must be run in Supabase SQL editor.**
- `types/booking.ts`: Added `travel_buffer_hours: number` to `SimPricingConfig`.
- `app/admin/settings/page.tsx`: Added "Travel Buffer" input (0–4hrs, 0.5 step) to the pricing config section. Saves alongside other config fields.

### Google Maps API Key
- Added `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to production environment variables on Vercel.
- Requires a redeploy to take effect (NEXT_PUBLIC vars are inlined at build time).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role (server only) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (server only) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `RESEND_API_KEY` | Yes | Resend API key for emails |
| `ADMIN_EMAIL` | Yes | Email address for admin notifications |
| `NEXT_PUBLIC_APP_URL` | Yes | Full app URL (used in admin email links) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Google Maps Places API key |

---

## Next Task — Fix Email Sending

### What exists
All email templates are written in `lib/resend.ts`:
- `sendBookingSubmittedClient` — confirmation to client after booking
- `sendBookingSubmittedAdmin` — new booking alert to admin
- `sendBookingApproved` — approval confirmation to client
- `sendBookingDeclined` — decline notice to client
- `sendBookingCancelled` — cancellation notice to client
- `sendEventReminder` — day-before reminder to client (exists but **never triggered automatically**)

### Known issues to investigate & fix
1. **Silent failures** — all email calls use fire-and-forget `.catch(console.error)`. If Resend rejects (wrong API key, unverified domain, bad address), the error is swallowed and the booking flow continues silently. Need to surface errors or at minimum log them properly.
2. **`NEXT_PUBLIC_APP_URL` in admin email** — the "Review Booking" button in the admin notification email uses this env var. Verify it is set correctly in production, otherwise the link is broken.
3. **`sendEventReminder` is never triggered** — the day-before reminder template exists but there is no cron job or scheduled trigger calling it. Needs a scheduled route (Vercel Cron or similar) that runs daily and sends reminders for bookings happening the next day.
4. **Resend domain verification** — confirm `v8simhouse.com` is verified in the Resend dashboard and the `FROM` address `bookings@v8simhouse.com` is authorized to send. Unverified domains silently fail or get blocked.
5. **Test email delivery end-to-end** — trigger each email type manually and confirm receipt, check spam placement.
