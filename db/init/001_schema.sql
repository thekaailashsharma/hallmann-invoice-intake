-- Invoice intake schema. Postgres plays two roles: the intake store (documents, audit) and a stand-in ERP (erp_invoices).
create extension if not exists pgcrypto;

-- Idempotency: one row per mailbox message. A message is processed at most once.
create table inbound_emails (
  message_id    text primary key,
  received_at   timestamptz not null,
  from_addr     text not null,
  subject       text,
  body          text not null,
  body_hash     text not null,
  created_at    timestamptz not null default now()
);

create type doc_status as enum ('needs_review', 'pending_erp', 'booked', 'rejected', 'ignored', 'duplicate');
create type doc_type   as enum ('invoice', 'credit_note', 'reminder', 'other');

create table documents (
  id               uuid primary key default gen_random_uuid(),
  message_id       text not null references inbound_emails(message_id),
  doc_type         doc_type not null,
  status           doc_status not null,
  supplier_name    text,
  supplier_vat_id  text,
  supplier_country text,
  invoice_number   text,
  invoice_date     date,
  due_date         date,
  currency         text,
  po_number        text,
  net_amount       numeric(14,2),
  vat_rate         numeric(5,2),
  vat_amount       numeric(14,2),
  gross_amount     numeric(14,2),
  language         text,
  line_items       jsonb not null default '[]',
  extraction       jsonb not null default '{}',   -- raw LLM output, kept for audit
  reasons          jsonb not null default '[]',   -- why it needs review / was ignored (human-readable)
  warnings         jsonb not null default '[]',
  injection_flag   boolean not null default false,
  related_invoice  text,                          -- reminders / credit notes point at an invoice number
  erp_invoice_id   uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on documents (status);
create index on documents (supplier_vat_id, invoice_number);

-- The "ERP". Unique constraint is the last line of defence against double booking.
create table erp_invoices (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references documents(id),
  supplier_vat_id  text not null,
  supplier_name    text not null,
  invoice_number   text not null,
  doc_type         doc_type not null,
  invoice_date     date not null,
  due_date         date,
  currency         text not null,
  net_amount       numeric(14,2) not null,
  vat_amount       numeric(14,2) not null,
  gross_amount     numeric(14,2) not null,
  po_number        text,
  booked_by        text not null,                 -- 'system' or a person
  booked_at        timestamptz not null default now(),
  unique (supplier_vat_id, invoice_number)
);

-- Simulates ERP maintenance windows. The review screen can toggle it.
create table erp_status (
  id         int primary key default 1 check (id = 1),
  available  boolean not null default true,
  note       text,
  updated_at timestamptz not null default now()
);
insert into erp_status (id, available, note) values (1, true, 'ERP online');

-- Who did what, when, with before/after. Answers the auditors.
create table audit_log (
  id           bigserial primary key,
  ts           timestamptz not null default now(),
  actor        text not null,                     -- 'system' | 'Jana' | 'Thomas' | ...
  action       text not null,                     -- received | classified | extracted | validated | auto_booked | queued_for_review | corrected | approved | rejected | erp_booked | erp_unavailable | ...
  document_id  uuid,
  message_id   text,
  before       jsonb,
  after        jsonb,
  note         text
);
create index on audit_log (document_id);

-- Operational alerts for Avanai (and Sabine). Error workflow + ERP outages write here; a notifier drains it.
create table alerts (
  id            bigserial primary key,
  ts            timestamptz not null default now(),
  severity      text not null check (severity in ('info', 'warning', 'critical')),
  source        text not null,
  message       text not null,
  details       jsonb,
  acknowledged  boolean not null default false
);

create or replace function touch_updated_at() returns trigger as $$ begin new.updated_at = now(); return new; end $$ language plpgsql;
create trigger documents_touch before update on documents for each row execute function touch_updated_at();
