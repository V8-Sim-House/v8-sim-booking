-- Migration 004: Lead capture table
create table if not exists sim_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  event_type text not null,
  event_date date not null,
  selected_package text,
  created_at timestamptz default now(),
  pricing_email_sent_at timestamptz,
  reminder_3w_sent_at timestamptz,
  reminder_1w_sent_at timestamptz,
  converted_to_booking boolean default false
);

-- Allow anon inserts (lead capture is public), deny reads
alter table sim_leads enable row level security;

create policy "Anon can insert leads"
  on sim_leads for insert
  to anon
  with check (true);

-- Service role (admin/cron) can do everything (bypasses RLS)
