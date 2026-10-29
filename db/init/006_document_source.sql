-- One email can carry several invoices (one per PDF/XML attachment). source = attachment name, or 'email' for the body.
alter table documents add column if not exists source text not null default 'email';
create unique index if not exists documents_message_source on documents (message_id, source);   -- idempotent per document
