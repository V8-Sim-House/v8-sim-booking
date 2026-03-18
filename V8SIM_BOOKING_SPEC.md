# V8 Sim — Party Booking System
## Full Project Specification for Claude Code

---

## 0. Development Status
> Keep this section updated as the source of truth for new sessions.

**App location:** `v8-sim-booking/` subfolder (standalone Next.js 14 app)
**Live testing:** Local dev working. Supabase dev project connected. Stripe test mode connected.

### ✅ Completed
- Next.js 14 + Tailwind + shadcn/ui project setup
- Supabase schema (all tables + RLS + seed data)
- 4-step booking form (package → addons → details → payment)
- Stripe PaymentIntent manual capture (authorize on submit)
- `/book/success` confirmation page
- Admin login (Supabase Auth)
- Admin dashboard (stats + pending bookings + upcoming events + expiry warning)
- Admin bookings table (filterable)
- Admin booking detail page (approve / decline / charge remainder / cancel)
- Admin settings page (edit pricing config, package discounts, addon prices)
- All 6 API routes + Stripe webhook
- Email notifications via Resend (all 5 triggers)
- Package pricing via discount % off hourly rate (not fixed price)
- Addons with per-hour pricing flag
- Custom dark-themed calendar date picker
- Address autocomplete component (Google Places, optional — needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
- Spec kept updated with all changes

### 🔲 Not Yet Built
- Day-of remainder auto-charge (Vercel cron job)
- 24h before event reminder email (Vercel cron job)
- Stripe hold renewal flow for pending bookings approaching 7-day expiry
- Production deployment to Vercel
- Separate prod Supabase project setup

### 🔑 Key Env Vars
See `.env.local.example` for full list. Google Maps key is optional (address autocomplete).

---

## 1. Overview

A multi-step event booking web app for **V8 Sim** — a VR simulator rental business that travels to client locations for private events (birthdays, graduations, parties, etc.).

The booking system lives as **separate pages** within the same Next.js project as the existing marketing site. Clicking "Book Now" on the landing page navigates to `/book`. The booking pages must **match the existing site's visual theme exactly** — same colors, fonts, logo, navbar, and footer. Do not create a new design system; extend what already exists.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| DB Client | Supabase JS SDK (`@supabase/supabase-js`) |
| Payments | Stripe (payment authorization + capture flow) |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS (extend existing theme tokens) |
| Admin Auth | Supabase Auth (email/password) |
| Email | Resend (`resend` npm package) |
| Hosting | Vercel |

---

## 3. Database Schema

> The database is intentionally designed to be **shared** across multiple services (this booking tool, a future VR House booking tool, and a future CRM). Use table prefixes to keep services isolated. The `clients` table is shared across all services.

```sql
-- =====================
-- SHARED
-- =====================

clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    text NOT NULL,
  email        text UNIQUE NOT NULL,
  phone        text,
  created_at   timestamptz DEFAULT now()
)

-- =====================
-- SIM BOOKING SERVICE
-- =====================

sim_bookings (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                       uuid REFERENCES clients(id),
  status                          text CHECK (status IN (
                                    'pending',    -- submitted, awaiting admin approval
                                    'approved',   -- admin approved, deposit captured
                                    'declined',   -- admin declined, card hold released
                                    'cancelled',  -- cancelled after approval, deposit kept
                                    'completed'   -- event done, remainder collected
                                  )) DEFAULT 'pending',

  -- Event details
  event_date                      date NOT NULL,
  event_time                      time NOT NULL,
  duration_hours                  int NOT NULL,
  package_type                    text CHECK (package_type IN (
                                    'standard_1h',
                                    'standard_2h',
                                    'standard_3h',
                                    'custom'
                                  )),

  -- Pricing snapshot (calculated at booking time, stored so price changes don't affect existing bookings)
  hourly_rate                     numeric(10,2),
  setup_fee                       numeric(10,2),
  addons_total                    numeric(10,2),
  subtotal                        numeric(10,2),
  deposit_amount                  numeric(10,2),   -- 30% of subtotal
  remainder_amount                numeric(10,2),   -- 70% of subtotal

  -- Location
  client_address                  text NOT NULL,
  city                            text NOT NULL,
  state                           text,
  zip                             text,

  -- Space & power requirements (client must confirm before submitting)
  has_space_confirmed             boolean DEFAULT false,  -- 20ft x 12ft minimum
  has_power_confirmed             boolean DEFAULT false,  -- or uses generator add-on

  -- Notes
  client_notes                    text,
  admin_notes                     text,

  -- Stripe
  stripe_payment_intent_id        text,   -- authorization hold for deposit
  stripe_remainder_intent_id      text,   -- scheduled charge for remainder (day-of)
  deposit_captured_at             timestamptz,
  remainder_captured_at           timestamptz,

  created_at                      timestamptz DEFAULT now(),
  updated_at                      timestamptz DEFAULT now()
)

sim_booking_addons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid REFERENCES sim_bookings(id) ON DELETE CASCADE,
  addon_key     text NOT NULL,     -- e.g. 'vr_headset', 'generator'
  addon_label   text NOT NULL,
  addon_price   numeric(10,2) NOT NULL
)

-- =====================
-- ADMIN-CONFIGURABLE DATA
-- =====================

sim_packages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key              text UNIQUE NOT NULL,   -- 'standard_1h', 'standard_2h', 'standard_3h'
  label            text NOT NULL,          -- '1 Hour Package'
  hours            int NOT NULL,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,  -- discount off (hourly_rate × hours)
  description      text,
  is_active        boolean DEFAULT true,
  display_order    int DEFAULT 0
)
-- NOTE: No fixed price column. Price is calculated dynamically:
--   package_price = (hourly_rate × hours × (1 - discount_percent/100)) + setup_fee

sim_addons (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text UNIQUE NOT NULL,   -- 'vr_headset', 'generator'
  label        text NOT NULL,
  description  text,
  price        numeric(10,2) NOT NULL,   -- per-hour rate if is_per_hour=true, else flat fee
  is_per_hour  boolean DEFAULT false,    -- if true, price is multiplied by booking hours
  is_active    boolean DEFAULT true
)

sim_pricing_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hourly_rate      numeric(10,2) NOT NULL,   -- used for custom packages
  setup_fee        numeric(10,2) NOT NULL,   -- flat fee added to all bookings
  deposit_percent  int NOT NULL DEFAULT 30,
  updated_at       timestamptz DEFAULT now()
)
```

### Seed Data (insert on first deploy)

```sql
INSERT INTO sim_packages (key, label, hours, discount_percent, description, display_order) VALUES
  ('standard_1h', '1 Hour Package',  1, 0,  'Perfect for small gatherings',  1),
  ('standard_2h', '2 Hour Package',  2, 10, 'Most popular choice — 10% off',  2),
  ('standard_3h', '3 Hour Package',  3, 15, 'Full event experience — 15% off', 3);

INSERT INTO sim_addons (key, label, description, price, is_per_hour) VALUES
  ('vr_headset', 'Extra VR Headset', 'Add an additional VR headset for more players', 40.00, true),
  ('generator',  'Generator Rental', 'No power outlet? We bring our own generator',   20.00, true);

INSERT INTO sim_pricing_config (hourly_rate, setup_fee, deposit_percent) VALUES
  (150.00, 75.00, 30);
```

---

## 4. Pricing Logic

### Preset Packages
Price is calculated dynamically from `sim_pricing_config` + `sim_packages.discount_percent`:
```
package_price = (hourly_rate × hours) × (1 - discount_percent / 100) + setup_fee
```

### Custom Package
No discount applied. Price calculated from raw hourly rate:
```
package_price = (hourly_rate × hours) + setup_fee
```

### Add-ons
Each addon has `is_per_hour` flag:
- `is_per_hour = true` → `addon_total = price × hours`
- `is_per_hour = false` → `addon_total = price` (flat fee)

### Full Subtotal
```
subtotal  = package_price + sum(addon totals)
deposit   = round(subtotal × deposit_percent / 100, 2)
remainder = subtotal - deposit
```

### UI
- Package cards show strikethrough base price and discounted price when discount > 0
- Add-on cards show per-hour rate and total for selected duration
- Booking form step 3 uses a custom dark-themed calendar date picker
- Address field uses Google Places autocomplete (requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`); gracefully falls back to plain text input if key not set

### Rules
- Deposit is **non-refundable** on cancellation
- Remainder is charged automatically on the **day of the event** (via Stripe scheduled capture)
- All prices are stored as snapshots at booking time — future config changes do not affect existing bookings

---

## 5. Stripe Payment Flow

Use **Stripe Payment Intents with manual capture** (authorization hold):

1. **On booking submission:**
   - Create a `PaymentIntent` with `capture_method: 'manual'` for the deposit amount
   - Collect card details via Stripe Elements on the frontend
   - Confirm the PaymentIntent — this authorizes (holds) the card without charging
   - Save `stripe_payment_intent_id` to the booking record
   - Booking status = `pending`

2. **On admin approval:**
   - Call `stripe.paymentIntents.capture(paymentIntentId)` to capture the deposit
   - Update booking status = `approved`
   - Send approval email to client
   - Create a second PaymentIntent for the remainder amount (to be captured day-of)

3. **On admin decline:**
   - Call `stripe.paymentIntents.cancel(paymentIntentId)` to release the hold
   - Update booking status = `declined`
   - Send decline email to client

4. **On cancellation (after approval):**
   - Deposit already captured — keep it (no refund)
   - Cancel the remainder PaymentIntent if not yet captured
   - Update booking status = `cancelled`

5. **Day-of remainder charge:**
   - Admin manually triggers from dashboard OR set up a Supabase cron job / Vercel cron to auto-capture on event date
   - Update `remainder_captured_at` and booking status = `completed`

> ⚠️ Note: Stripe authorization holds expire after **7 days**. If approval takes longer, implement a hold renewal flow or notify admin to act within 7 days.

---

## 6. Pages & Routes

### Public — Booking Flow

#### `GET /book`
**Multi-step booking form** with a progress bar at the top (Step 1 / 2 / 3 / 4).

---

**Step 1 — Choose Package**
- Display preset packages as selectable cards showing: name, duration, price, short description
- "Build Your Own" option that reveals:
  - Hour input (number input or +/- stepper, min 1, max 8)
  - Real-time price breakdown showing: hourly rate × hours, setup fee, total
- Live price summary panel (sticky on desktop, bottom bar on mobile) updates as user selects

---

**Step 2 — Add-ons & Extras**
- Show available add-ons from `sim_addons` table as toggle cards
- Each card shows: name, description, price
- Price summary updates live

---

**Step 3 — Event Details & Location**
- Fields:
  - Event date (date picker — disable past dates and already-booked dates)
  - Event start time (time picker)
  - Client full name
  - Client email
  - Client phone
  - Event address (street, city, state, zip)
  - Additional notes (optional)
- **Space Requirements Notice** (prominent info box):
  > "Our simulator requires a minimum space of **20ft × 12ft** with a **ceiling height of 8ft**. Please ensure your venue meets these requirements."
- **Checkboxes the client must check before proceeding:**
  - ☐ I confirm my venue has at least 20ft × 12ft of clear space
  - ☐ I confirm my venue has a standard power outlet available *(hidden/disabled if Generator add-on was selected in Step 2)*

---

**Step 4 — Review & Payment**
- Full order summary:
  - Package selected
  - Add-ons
  - Event date, time, address
  - Price breakdown (subtotal, deposit due now, remainder due on event day)
- **Stripe Elements** card input (embedded, not redirected)
- Disclaimer text:
  > "Your card will be authorized for the deposit amount (30%) but **not charged** until we confirm your booking. The remaining balance will be automatically collected on the day of your event. Deposits are non-refundable."
- Submit button: "Request Booking"
- On submit: create booking record + Stripe auth hold → show success page

---

#### `GET /book/success`
- Confirmation screen showing:
  - Booking reference ID
  - Summary of what was booked
  - "What happens next" — explain pending approval flow
  - Message: "You'll receive an email once we review and confirm your booking."

---

### Admin — Dashboard (protected, login required)

#### `GET /admin` → redirects to `/admin/login` if not authenticated

#### `GET /admin/login`
- Simple email/password login form using Supabase Auth
- On success → redirect to `/admin/dashboard`

#### `GET /admin/dashboard`
- Overview stats: total bookings, pending count, upcoming events, revenue
- Calendar view of upcoming approved bookings
- Recent pending bookings list with quick approve/decline actions

#### `GET /admin/bookings`
- Full bookings table with filters: status, date range, search by name/email
- Columns: date, client name, package, total, deposit, status, actions

#### `GET /admin/bookings/[id]`
- Full booking detail view
- Client info, event info, pricing breakdown, add-ons, notes
- Status badge
- Action buttons (based on current status):
  - `pending` → **Approve** / **Decline**
  - `approved` → **Charge Remainder** / **Cancel** / **Mark Complete**
  - `cancelled` / `completed` → read-only
- Admin notes field (editable, saves on blur)

#### `GET /admin/settings`
- Edit pricing config: hourly rate, setup fee, deposit percent
- Toggle packages on/off, edit package prices
- Toggle add-ons on/off, edit add-on prices

---

## 7. API Routes (Next.js `/app/api/`)

```
POST   /api/bookings/create          Create booking + Stripe auth hold
POST   /api/bookings/[id]/approve    Capture deposit, create remainder intent
POST   /api/bookings/[id]/decline    Release Stripe hold
POST   /api/bookings/[id]/cancel     Cancel remainder intent (deposit kept)
POST   /api/bookings/[id]/charge-remainder   Capture remainder payment
GET    /api/bookings/availability    Return booked dates for calendar blocking
POST   /api/stripe/webhook           Handle Stripe webhook events
```

All admin endpoints must verify Supabase session before executing.

---

## 8. Email Notifications (via Resend)

| Trigger | Recipient | Subject |
|---|---|---|
| Booking submitted | Client | "We received your booking request — V8 Sim" |
| Booking submitted | Admin (owner) | "New booking request from [Name]" |
| Booking approved | Client | "Your V8 Sim event is confirmed!" |
| Booking declined | Client | "Update on your V8 Sim booking request" |
| Booking cancelled | Client | "Your V8 Sim booking has been cancelled" |
| 24h before event | Client | "See you tomorrow! — V8 Sim reminder" |

Email templates should be simple HTML, matching brand colors.

---

## 9. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=

# Google Maps (optional — address autocomplete in booking form)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Admin
ADMIN_EMAIL=
```

---

## 10. Project File Structure

```
/
├── app/
│   ├── (marketing)/          # existing landing page lives here
│   │   └── page.tsx
│   ├── book/
│   │   ├── page.tsx          # multi-step booking form
│   │   └── success/
│   │       └── page.tsx
│   ├── admin/
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── bookings/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── bookings/
│       │   ├── create/route.ts
│       │   ├── availability/route.ts
│       │   └── [id]/
│       │       ├── approve/route.ts
│       │       ├── decline/route.ts
│       │       ├── cancel/route.ts
│       │       └── charge-remainder/route.ts
│       └── stripe/
│           └── webhook/route.ts
├── components/
│   ├── booking/              # booking form step components
│   └── admin/                # admin dashboard components
├── lib/
│   ├── supabase.ts
│   ├── stripe.ts
│   ├── resend.ts
│   └── pricing.ts            # pricing calculation logic
└── types/
    └── booking.ts            # TypeScript types
```

---

## 11. Key Business Rules (Summary)

1. A booking is **not confirmed** until admin explicitly approves it
2. Card is **authorized (held) but not charged** on submission
3. Deposit (30%) is captured on approval
4. Remainder (70%) is charged on the day of the event
5. Cancellations after approval: deposit is **kept**, remainder is **released**
6. Clients must confirm space requirements before submitting
7. Booked dates are blocked in the date picker
8. Admin can add notes to any booking at any time
9. Pricing config changes do **not** retroactively affect existing bookings
10. All amounts stored in USD, two decimal places

---

## 12. Out of Scope (for this version)

- Client login / booking history portal
- SMS notifications
- Multiple simultaneous bookings on same day (assume one event per day for now)
- Coupon / discount codes
- Tip collection
- VR House booking tool (separate project, same DB)
- CRM module (future, separate module in same DB)
