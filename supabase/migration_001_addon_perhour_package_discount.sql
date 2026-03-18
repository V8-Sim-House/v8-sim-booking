-- =====================
-- MIGRATION 001
-- Add is_per_hour to sim_addons
-- Add discount_percent to sim_packages
-- =====================

-- Add per-hour flag to addons
ALTER TABLE sim_addons
  ADD COLUMN IF NOT EXISTS is_per_hour boolean DEFAULT false;

-- Add discount_percent to packages (replaces fixed price)
ALTER TABLE sim_packages
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) DEFAULT 0;

-- Update seed addons: both are per-hour
UPDATE sim_addons SET is_per_hour = true, price = 40.00 WHERE key = 'vr_headset';
UPDATE sim_addons SET is_per_hour = true, price = 20.00 WHERE key = 'generator';

-- Update seed packages: set discounts
-- 1h: no discount, 2h: 10% off, 3h: 15% off
UPDATE sim_packages SET discount_percent = 0  WHERE key = 'standard_1h';
UPDATE sim_packages SET discount_percent = 10 WHERE key = 'standard_2h';
UPDATE sim_packages SET discount_percent = 15 WHERE key = 'standard_3h';
