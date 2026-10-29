-- A booking is claimed before the ERP call, so two runs never send the same document at the same time.
alter table documents add column if not exists booking_started_at timestamptz;
-- erp_status is now the LAST OBSERVED state (written by ERP Booking from the ERP's answers), not a switch.
