-- Add travel buffer setting to pricing config
-- This controls how many hours before/after a confirmed booking are blocked
-- to account for setup/teardown and travel time.

ALTER TABLE sim_pricing_config
  ADD COLUMN IF NOT EXISTS travel_buffer_hours int NOT NULL DEFAULT 1;
