-- What the Intake learned while parsing (sender domain, newest-message text, forwarded / auto-reply flags, Gmail id),
-- stored with the email so Process Email and Monitoring re-runs work from Postgres alone.
alter table inbound_emails add column if not exists meta jsonb not null default '{}';
