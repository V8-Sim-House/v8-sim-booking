# V8 Sim Booking — Project Spec

## Overview
A private event booking platform for **V8 Sim House LLC**. Clients book a mobile racing simulator experience for their events. The flow is:

1. **Lead capture** (Step 0) — client enters name, email, event type, date, and preferred time. A lead record is created and a pricing summary email is sent.
2. **Package + add-ons** (Steps 1–2) — client picks a package and optional add-ons.
3. **Event details** (Step 3) — client provides venue address, space/power confirmation, notes, guest count.
4. **Payment** (Step 4) — client enters card. Stripe card hold (not charged yet).
5. **Admin review** — admin approves (captures deposit + creates remainder hold) or declines (releases hold).
6. **Event day** — admin charges the remainder. A refundable $300 damage deposit is collected in person on arrival.

**Stack:** Next.js 14 (App Router) · Supabase (Postgres + RLS) · Stripe · Resend · Vercel

---

## Database Schema

| Table | Purpose |
|---|---|
| `clients` | Customer records (email unique) |
| `sim_bookings` | Booking records with pricing snapshot + Stripe intent IDs |
| `sim_booking_addons` | Line items for selected add-ons per booking |
| `sim_packages` | Admin-configurable packages (hours, discount %) |
| `sim_addons` | Admin-configurable add-ons (flat or per-hour pricing) |
| `sim_pricing_config` | Single-row config (hourly rate, setup fee, deposit %, travel buffer) |
| `sim_leads` | Lead records from Step 0 (pre-booking interest capture) |

### `sim_leads` columns
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `full_name` | text | |
| `email` | text | |
| `event_type` | text | |
| `event_date` | date | |
| `selected_package` | text | nullable — set when user picks a package in Step 1 |
| `form_progress` | jsonb | full `BookingFormState` object, saved by "Save for Later" |
| `current_step` | int | step number saved alongside `form_progress` |
| `pricing_email_sent_at` | timestamptz | set after pricing email is sent |
| `reminder_3w_sent_at` | timestamptz | set after 3-week reminder sent |
| `reminder_1w_sent_at` | timestamptz | set after 1-week reminder sent |
| `converted_to_booking` | boolean | true once client completes a booking from this lead |
| `created_at` | timestamptz | |

### `sim_leads` RLS
- **Anon INSERT** allowed — lead creation is public (Step 0 submit)
- **No anon SELECT** — leads are read-only via service role (admin API routes only)
- Service role bypasses RLS entirely

### `sim_bookings` key columns (beyond basics)
| Column | Notes |
|---|---|
| `event_type` | optional, from lead or Step 3 |
| `expected_guests` | optional integer |
| `stripe_payment_intent_id` | deposit hold PI |
| `stripe_remainder_intent_id` | remainder PI (created on approval) |
| `deposit_captured_at` | timestamptz, set on approve |
| `remainder_captured_at` | timestamptz, set on charge-remainder |
| `admin_notes` | internal freeform text |

### Booking Statuses
```
pending → approved → completed
pending → declined
approved → cancelled
```

### DB Migrations (run in order in Supabase SQL editor)
| File | Change |
|---|---|
| `migration_001_addon_perhour_package_discount.sql` | Adds `is_per_hour` to `sim_addons`, `discount_percent` to `sim_packages` |
| `migration_002_travel_buffer.sql` | Adds `travel_buffer_hours` to `sim_pricing_config` |
| `migration_003_awaiting_payment_status.sql` | Adds `awaiting_payment` to booking status enum |
| `supabase/migrations/migration_004_sim_leads.sql` | Creates `sim_leads` table with RLS |
| `supabase/migrations/migration_005_bookings_extras.sql` | Adds `event_type`, `expected_guests` to `sim_bookings` |
| `supabase/migrations/migration_006_leads_form_progress.sql` | Adds `form_progress`, `current_step` to `sim_leads` |

---

## Payment Flow (Two-Stage Stripe)

1. **Client submits booking** (`/api/bookings/create`)
   - Find or create Stripe Customer by email
   - Create deposit PaymentIntent with `capture_method: "manual"`, `setup_future_usage: "off_session"` — this saves the card to the customer without charging
   - Booking saved with status `pending`

2. **Admin approves** (`/api/bookings/[id]/approve`)
   - Capture deposit PI (charges the card)
   - Create remainder PI with `customer`, `payment_method`, `confirm: true`, `off_session: true`, `capture_method: "manual"` — goes straight to `requires_capture`
   - Booking status → `approved`

3. **Admin charges remainder** (`/api/bookings/[id]/charge-remainder`)
   - Capture remainder PI
   - Booking status → `completed`

4. **Admin declines** (`/api/bookings/[id]/decline`)
   - If PI status is `succeeded` → issue refund
   - If PI status is `canceled` → skip (already released)
   - Otherwise → cancel PI (releases card hold)
   - Booking status → `declined`

5. **Admin cancels approved booking** (`/api/bookings/[id]/cancel`)
   - Cancel remainder PI
   - Booking status → `cancelled`
   - Deposit is **non-refundable** on cancellation

6. **Damage deposit** — $300 collected in person on arrival (cash, card, or Zelle). Returned if no damage. This is NOT in Stripe.

### Stripe Webhook (`/api/stripe/webhook`)
Handles `payment_intent.amount_capturable_updated` — fires when a deposit PI is confirmed client-side. This is where the **booking confirmation emails** (client + admin) are sent.

> **Local dev:** Webhooks require `stripe listen --forward-to localhost:3000/api/stripe/webhook` to be running.

---

## Booking Form Flow

### Step 0 — Lead Capture (`components/booking/Step0Lead.tsx`)
- Collects: full name, email, event type (dropdown + "Other" freetext), event date, start time
- **Validation:** All fields required. Email validated with regex. Inline errors shown on blur or submit attempt.
- **Date picker:** Minimum date is **tomorrow** (today is blocked). Custom `DatePicker` component — previous-month nav disabled when at the earliest available month.
- **Time grid:** 15-minute slots from 8:00am–10:00pm. All slots are shown as selectable — no slots are grayed out in this step. The user picks freely.
- **Availability check:** Happens at the **exact moment the button is clicked** inside `handleSubmit` — a fresh `GET /api/bookings/availability` is fetched with `cache: "no-store"`. This avoids stale data from a pre-loaded mount fetch. The result determines the banner shown on Step 1.
- **On submit:** Creates a lead record via `POST /api/leads`. If the lead already had saved progress (`?lead=<uuid>` in URL), it restores the form state from DB.
- **Back navigation:** If user returns to Step 0 from a later step, the form is pre-filled via `initialData` prop passed from `book/page.tsx`.

### Step 1 — Package Selection (`components/booking/Step1Package.tsx`)
- Shows availability banner (green = available, amber = unavailable + alternative dates) based on `availStatus` returned from Step 0
- Package cards with pricing. Custom hours input for "Custom" package.

### Step 2 — Add-ons (`components/booking/Step2Addons.tsx`)
- Toggle add-ons. Per-hour add-ons show `$X/hr`. Flat add-ons show `$X`.

### Step 3 — Event Details (`components/booking/Step3Details.tsx`)
- Venue address (Google Maps autocomplete), city, state, zip
- Space confirmed / power confirmed checkboxes
- Expected guest count, event type (pre-filled from Step 0), client notes
- "Save for Later" button

### Step 4 — Payment (`components/booking/Step4Payment.tsx`)
- Stripe card element
- Submits to `/api/bookings/create`
- On success → redirects to `/book/success?id=<bookingId>`

### Progress Bar (`components/booking/BookingProgressBar.tsx`)
- Shows for steps 1–4 only (hidden on Step 0)
- Step labels always visible (not hidden on mobile)

---

## Save for Later / Resume Flow

When a user clicks "Save for Later" on any step 1–4:

1. `PATCH /api/leads/[id]/save-progress` is called with `{ formState, step }`
2. The full `BookingFormState` JSON and step number are saved to `sim_leads.form_progress` and `sim_leads.current_step`
3. A **"progress saved" email** is sent to the user with a resume link: `https://book.v8simhouse.com/book?lead=<uuid>`

When a user opens `/book?lead=<uuid>`:

1. `GET /api/leads/[id]/progress` is called on page load
2. If `converted_to_booking = true` → look up booking via client email + event date → redirect to `/book/success?id=<bookingId>` (prevents resubmission)
3. Otherwise → restore `formState` and `step` from DB, show a "Welcome back!" toast

All lead reminder emails (3-week, 1-week) also use `/book?lead=<uuid>` as their CTA link so the user always resumes their exact saved state.

---

## Lead Nurture Emails (Cron)

Cron job at `GET /api/cron/reminders` (runs daily via Vercel Cron):

| Trigger | Email | Condition |
|---|---|---|
| Step 0 submit | Pricing summary | `pricing_email_sent_at IS NULL` → sent immediately, flag set |
| 3 weeks before event | 3-week reminder | `reminder_3w_sent_at IS NULL AND event_date = today + 21 days` AND not yet converted |
| 1 week before event | 1-week reminder | `reminder_1w_sent_at IS NULL AND event_date = today + 7 days` AND not yet converted |

All lead emails include a `Complete My Booking →` button linking to `/book?lead=<uuid>`.

---

## Availability Logic

### API (`GET /api/bookings/availability`)
- Returns all **`approved`** bookings (not pending — unconfirmed requests don't block dates)
- Returns `{ bookings: [{ date, startTime, durationHours }], travelBufferHours }`
- Response header: `Cache-Control: no-store` — never cached by browser or CDN
- `export const dynamic = "force-dynamic"` — prevents Next.js static prerender

### Conflict check (`isSlotBlocked`)
A proposed slot `[slotStart, slotStart + checkDuration]` is blocked if it overlaps with a booking's buffered window `[bookingStart − buffer, bookingEnd + buffer]`:
```
blocked = slotStart < (bookingEnd + buffer)
       && (slotStart + checkDuration) > (bookingStart − buffer)
```

### Step 0 proxy duration
Since the package isn't chosen in Step 0, the conflict check uses **2 hours** as a conservative proxy. A slot showing as available in Step 0 is guaranteed to have at least 2 hours of clearance around existing bookings.

### How availability is surfaced
- **Step 0 time grid:** All slots shown — no visual blocking. User picks freely.
- **Step 1 banner:** After clicking "Check Availability & See Pricing →", a fresh availability check runs inside `handleSubmit`. The result:
  - ✅ Green banner — date/time is open
  - ⚠️ Amber banner — date/time is taken, with up to 3 alternative nearby dates offered

---

## Admin Panel

### Routes
| Page | Path |
|---|---|
| Dashboard | `/admin/dashboard` |
| All Bookings | `/admin/bookings` |
| Booking Detail | `/admin/bookings/[id]` |
| Leads | `/admin/leads` |
| Settings | `/admin/settings` |

### Dashboard (`/admin/dashboard`)
- Stats: total bookings, pending, approved, revenue collected
- Warning banner if any pending booking is ≥5 days old (Stripe 7-day hold limit)
- Pending requests list with inline Approve/Decline buttons and submission date+time
- Upcoming approved events (next 5, sorted by date)

### Bookings List (`/admin/bookings`)
- Filter by status, date range, search by name/email/ID
- Shows submission date + time for each row

### Booking Detail (`/admin/bookings/[id]`)
- Client info, event details (including event type, expected guests), add-ons
- Pricing breakdown: subtotal, add-ons, deposit (✓ if captured), remainder (✓ if captured)
- Damage deposit notice ($300 refundable, collected on arrival)
- Stripe PI IDs displayed for reference
- Actions panel: Approve / Decline (when pending), Charge Remainder / Cancel (when approved)
- Admin notes textarea (auto-saves on blur)
- Submission date+time shown in header

### Leads Page (`/admin/leads`)
- Stats: total leads, converted, unconverted, conversion rate
- Filter by converted/unconverted, search by name/email/event type
- Data fetched via `GET /api/leads/list` (server-side, uses service role to bypass RLS)
- Columns: name, email, event type, event date, package interest, pricing email sent, reminders sent (3w/1w), status (Lead/Booked)

### Settings (`/admin/settings`)
- Pricing config: hourly rate, setup fee, deposit %, travel buffer (0–4hrs, 0.5 step)
- Package management: name, hours, discount %
- Add-on management: name, price, per-hour flag, active toggle

---

## API Routes — Full Reference

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/bookings/create` | Public | Create booking + Stripe deposit PI |
| POST | `/api/bookings/[id]/approve` | Admin | Capture deposit + create remainder PI |
| POST | `/api/bookings/[id]/decline` | Admin | Cancel/refund deposit PI |
| POST | `/api/bookings/[id]/charge-remainder` | Admin | Capture remainder PI |
| POST | `/api/bookings/[id]/cancel` | Admin | Cancel approved booking |
| GET | `/api/bookings/availability` | Public | Approved bookings + travel buffer |
| POST | `/api/stripe/webhook` | Stripe sig | Handles `payment_intent.amount_capturable_updated` |
| POST | `/api/leads` | Public | Create lead record + send pricing email |
| POST | `/api/leads/[id]/save-package` | Public | Update selected package on lead |
| PATCH | `/api/leads/[id]/save-progress` | Public | Save form state + step + send resume email |
| GET | `/api/leads/[id]/progress` | Public | Get saved form state, or redirect if converted |
| GET | `/api/leads/list` | Admin | List all leads (bypasses RLS via service role) |
| GET | `/api/cron/reminders` | Cron secret | Send 3w/1w reminder emails for unconverted leads |

### Admin auth (`requireAdminAuth`)
All admin-only routes call `requireAdminAuth()` which checks a session cookie. Returns a 401 `NextResponse` if not authenticated — callers check `if (auth instanceof NextResponse) return auth`.

### Supabase clients
- `supabase` (anon client, `lib/supabase.ts`) — used in client components and public API routes
- `createAdminClient()` (service role, `lib/supabase.ts`) — used in admin/cron routes to bypass RLS

---

## Email System (`lib/resend.ts`)

| Function | Trigger | Recipient |
|---|---|---|
| `sendBookingSubmittedClient` | Stripe webhook | Client |
| `sendBookingSubmittedAdmin` | Stripe webhook | Admin |
| `sendBookingApproved` | `/api/bookings/[id]/approve` | Client |
| `sendBookingDeclined` | `/api/bookings/[id]/decline` | Client |
| `sendBookingCancelled` | `/api/bookings/[id]/cancel` | Client |
| `sendEventReminder` | Cron (day before) | Client |
| `sendLeadPricingSummary` | Step 0 submit | Lead |
| `sendSaveForLaterEmail` | Save for Later click | Lead |
| `sendLeadReminder3Week` | Cron (3w before) | Lead |
| `sendLeadReminder1Week` | Cron (1w before) | Lead |

All emails use a shared dark-themed HTML template (`baseTemplate`). From address: `V8 Sim House <bookings@book.v8simhouse.com>`.

**Add-on pricing in emails:** `buildAddonsList(addons)` renders per-hour add-ons as `$X/hr` and flat add-ons as `$X`, using live data from the DB (not hardcoded).

---

## Key Files

```
app/
  api/
    bookings/
      create/route.ts            — booking + Stripe customer + deposit PI
      [id]/approve/route.ts      — capture deposit + remainder PI
      [id]/decline/route.ts      — cancel/refund deposit PI
      [id]/charge-remainder/     — capture remainder PI
      [id]/cancel/               — cancel approved booking
      availability/route.ts      — approved bookings + travel buffer (no-cache)
    stripe/webhook/route.ts      — Stripe webhook (sends confirmation emails)
    leads/
      route.ts                   — POST: create lead + send pricing email
      [id]/save-package/route.ts — POST: update selected package
      [id]/save-progress/route.ts— PATCH: save form progress + send resume email
      [id]/progress/route.ts     — GET: retrieve saved progress or detect conversion
      list/route.ts              — GET: admin list of leads (service role)
    cron/reminders/route.ts      — GET: send 3w/1w reminder emails
  admin/
    dashboard/page.tsx           — stats, expiry warnings, quick approve/decline
    bookings/page.tsx            — bookings table with filters
    bookings/[id]/page.tsx       — booking detail with full actions
    leads/page.tsx               — leads table with stats
    settings/page.tsx            — pricing config, packages, add-ons
  book/
    page.tsx                     — 5-step form orchestration (step 0–4)
    success/page.tsx             — post-booking success screen
components/booking/
  Step0Lead.tsx                  — lead capture, validation, availability check on submit
  Step1Package.tsx               — package selection + availability banner
  Step2Addons.tsx                — add-on toggles
  Step3Details.tsx               — venue details, save for later
  Step4Payment.tsx               — Stripe card element + booking submit
  BookingProgressBar.tsx         — step 1–4 progress indicator with labels
  DatePicker.tsx                 — custom date picker (min: tomorrow, blocks past months)
  AddressAutocomplete.tsx        — Google Maps Places autocomplete
  PriceSummary.tsx               — sticky price sidebar (steps 1–4)
lib/
  stripe.ts                      — Stripe singleton
  supabase.ts                    — anon client + createAdminClient (service role)
  resend.ts                      — all email templates and send functions
  pricing.ts                     — calculatePricing() + formatCurrency()
  admin-auth.ts                  — requireAdminAuth() guard
types/booking.ts                 — all shared TypeScript types
supabase/
  schema.sql                     — full DB schema + seed data + RLS policies
  migration_001–006_*.sql        — incremental schema changes (run in order)
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server only — bypasses RLS) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (server only) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `RESEND_API_KEY` | Yes | Resend API key |
| `ADMIN_EMAIL` | Yes | Admin notification email address |
| `NEXT_PUBLIC_APP_URL` | Yes | Full app URL e.g. `https://book.v8simhouse.com` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Google Maps Places API (NEXT_PUBLIC = inlined at build) |

---

## Known Gotchas & Decisions

### Stripe webhook required locally
Confirmation emails are sent from the Stripe webhook handler (`payment_intent.amount_capturable_updated`), not from the create route. In local dev you must run:
```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### RLS blocks lead reads
`sim_leads` has anon INSERT only — no anon SELECT. The admin leads page and all lead-reading routes must use `createAdminClient()` (service role), never the anon client. This is intentional to prevent public exposure of lead data.

### Availability race condition (resolved)
Availability is fetched inside `handleSubmit` at click time — never pre-fetched on mount. This ensures a booking approved in another tab between page load and submit click is always reflected correctly. Both the fetch call (`cache: "no-store"`) and the API response (`Cache-Control: no-store`) disable all caching layers.

### Stripe PaymentMethod reuse
Stripe does not allow reusing a PaymentMethod across multiple PIs unless attached to a Customer. The create route always finds or creates a Stripe Customer by email, and uses `setup_future_usage: "off_session"` to attach the card. The approve route then uses that saved payment method for the remainder PI.

### Decline after accidental capture
If a deposit PI is in `succeeded` state when declined (rare edge case), the route issues a refund instead of cancel. `stripe.paymentIntents.cancel()` throws on succeeded PIs.

### `NEXT_PUBLIC_*` vars
These are inlined at build time. Changes require a redeploy to take effect — setting them in Vercel dashboard alone is not enough until the next build.
