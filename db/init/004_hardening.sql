-- Hardening added after review. Safe to re-run.

-- Audit log is append-only. (Test resets bypass it with session_replication_role = replica, superuser only.)
create or replace function audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
drop trigger if exists audit_no_update on audit_log;
create trigger audit_no_update before update or delete on audit_log for each row execute function audit_immutable();
drop trigger if exists audit_no_truncate on audit_log;
create trigger audit_no_truncate before truncate on audit_log for each statement execute function audit_immutable();

-- Poison documents: count ERP attempts, park after N failures instead of retrying forever.
alter table documents add column if not exists erp_attempts int not null default 0;
alter table documents add column if not exists last_error text;

-- Email processing state: an email is only "done" once a document row exists.
alter table inbound_emails add column if not exists attachments jsonb not null default '[]';
create index if not exists documents_message_id on documents (message_id);

-- Alert de-duplication key (same source + message within a window is one alert).
alter table alerts add column if not exists occurrences int not null default 1;
alter table alerts add column if not exists last_seen timestamptz not null default now();
