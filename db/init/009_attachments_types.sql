-- Original attachment files, kept so reviewers see the real document next to the extracted fields (and for auditors).
create table if not exists attachments (
  message_id  text not null references inbound_emails(message_id),
  name        text not null,
  mime        text,
  size_bytes  int,
  sha256      text not null,
  content     bytea not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, name)
);
-- Documents that look like invoices but are never payable.
alter type doc_type add value if not exists 'proforma';
alter type doc_type add value if not exists 'order_confirmation';
alter type doc_type add value if not exists 'statement';
