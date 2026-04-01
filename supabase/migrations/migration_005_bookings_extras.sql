-- Migration 005: Add event_type and expected_guests to sim_bookings
alter table sim_bookings
  add column if not exists event_type text,
  add column if not exists expected_guests integer;
