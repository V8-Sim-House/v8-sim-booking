-- Add 'awaiting_payment' status for bookings created before card authorization is confirmed
ALTER TABLE sim_bookings
  DROP CONSTRAINT IF EXISTS sim_bookings_status_check,
  ADD CONSTRAINT sim_bookings_status_check CHECK (status IN (
    'awaiting_payment',
    'pending',
    'approved',
    'declined',
    'cancelled',
    'completed'
  ));
