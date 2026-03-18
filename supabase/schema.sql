-- =====================
-- SHARED
-- =====================

CREATE TABLE IF NOT EXISTS clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    text NOT NULL,
  email        text UNIQUE NOT NULL,
  phone        text,
  created_at   timestamptz DEFAULT now()
);

-- =====================
-- SIM BOOKING SERVICE
-- =====================

CREATE TABLE IF NOT EXISTS sim_bookings (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                       uuid REFERENCES clients(id),
  status                          text CHECK (status IN (
                                    'pending',
                                    'approved',
                                    'declined',
                                    'cancelled',
                                    'completed'
                                  )) DEFAULT 'pending',

  event_date                      date NOT NULL,
  event_time                      time NOT NULL,
  duration_hours                  int NOT NULL,
  package_type                    text CHECK (package_type IN (
                                    'standard_1h',
                                    'standard_2h',
                                    'standard_3h',
                                    'custom'
                                  )),

  hourly_rate                     numeric(10,2),
  setup_fee                       numeric(10,2),
  addons_total                    numeric(10,2),
  subtotal                        numeric(10,2),
  deposit_amount                  numeric(10,2),
  remainder_amount                numeric(10,2),

  client_address                  text NOT NULL,
  city                            text NOT NULL,
  state                           text,
  zip                             text,

  has_space_confirmed             boolean DEFAULT false,
  has_power_confirmed             boolean DEFAULT false,

  client_notes                    text,
  admin_notes                     text,

  stripe_payment_intent_id        text,
  stripe_remainder_intent_id      text,
  deposit_captured_at             timestamptz,
  remainder_captured_at           timestamptz,

  created_at                      timestamptz DEFAULT now(),
  updated_at                      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sim_booking_addons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid REFERENCES sim_bookings(id) ON DELETE CASCADE,
  addon_key     text NOT NULL,
  addon_label   text NOT NULL,
  addon_price   numeric(10,2) NOT NULL
);

-- =====================
-- ADMIN-CONFIGURABLE DATA
-- =====================

CREATE TABLE IF NOT EXISTS sim_packages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key              text UNIQUE NOT NULL,
  label            text NOT NULL,
  hours            int NOT NULL,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,  -- discount off hourly_rate × hours
  description      text,
  is_active        boolean DEFAULT true,
  display_order    int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sim_addons (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text UNIQUE NOT NULL,
  label        text NOT NULL,
  description  text,
  price        numeric(10,2) NOT NULL,   -- per-hour rate if is_per_hour, else flat fee
  is_per_hour  boolean DEFAULT false,
  is_active    boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS sim_pricing_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hourly_rate      numeric(10,2) NOT NULL,
  setup_fee        numeric(10,2) NOT NULL,
  deposit_percent  int NOT NULL DEFAULT 30,
  updated_at       timestamptz DEFAULT now()
);

-- =====================
-- SEED DATA
-- =====================

INSERT INTO sim_packages (key, label, hours, discount_percent, description, display_order) VALUES
  ('standard_1h', '1 Hour Package',  1, 0,  'Perfect for small gatherings', 1),
  ('standard_2h', '2 Hour Package',  2, 10, 'Most popular choice — 10% off',  2),
  ('standard_3h', '3 Hour Package',  3, 15, 'Full event experience — 15% off', 3)
ON CONFLICT (key) DO NOTHING;

INSERT INTO sim_addons (key, label, description, price, is_per_hour) VALUES
  ('vr_headset', 'Extra VR Headset', 'Add an additional VR headset for more players', 40.00, true),
  ('generator',  'Generator Rental', 'No power outlet? We bring our own generator',   20.00, true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO sim_pricing_config (hourly_rate, setup_fee, deposit_percent)
SELECT 150.00, 75.00, 30
WHERE NOT EXISTS (SELECT 1 FROM sim_pricing_config);

-- =====================
-- UPDATED_AT TRIGGER
-- =====================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sim_bookings_updated_at ON sim_bookings;
CREATE TRIGGER update_sim_bookings_updated_at
  BEFORE UPDATE ON sim_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- RLS POLICIES
-- =====================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_booking_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_pricing_config ENABLE ROW LEVEL SECURITY;

-- Public read for packages/addons/pricing (needed for booking form)
CREATE POLICY "Public read sim_packages" ON sim_packages FOR SELECT USING (true);
CREATE POLICY "Public read sim_addons" ON sim_addons FOR SELECT USING (true);
CREATE POLICY "Public read sim_pricing_config" ON sim_pricing_config FOR SELECT USING (true);

-- Service role has full access (used by API routes)
-- No additional policies needed; service role bypasses RLS

-- Authenticated users (admins) can read all bookings data
CREATE POLICY "Authenticated read sim_bookings" ON sim_bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read sim_booking_addons" ON sim_booking_addons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read clients" ON clients FOR SELECT TO authenticated USING (true);
