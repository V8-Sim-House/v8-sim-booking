-- Migration 006: Add server-side form progress to sim_leads
alter table sim_leads
  add column if not exists form_progress jsonb,
  add column if not exists current_step int;
