-- Supplier master: who Hallmann already pays. Production: refreshed nightly from the ERP vendor master
-- (VAT ID, bank account, sender domains). Used by the intake to catch unknown suppliers, changed IBANs and look-alike senders.
create table if not exists suppliers (
  vat_id          text primary key,            -- normalised: upper case, letters and digits only
  name            text not null,
  iban            text,
  sender_domains  text[] not null default '{}',
  erp_vendor_no   text,
  synced_at       timestamptz not null default now()
);
insert into suppliers (vat_id, name, iban, sender_domains, erp_vendor_no) values
  ('DE298765431',    'Nordwerk Industriebedarf GmbH', 'DE89370400440532013000', '{nordwerk.example}', '70001'),
  ('GB284551907',    'Brightline Logistics Ltd',      null, '{brightline-logistics.example}', '70002'),
  ('DE301447892',    'Kessler Druck & Medien GmbH',   null, '{kessler-druck.example}', '70003'),
  ('NL859012345B01', 'Orbis Cloud Services B.V.',     null, '{orbis-cloud.example}', '70004'),
  ('DE276554310',    'Schäfer Elektrotechnik GmbH',   null, '{schaefer-elektro.example}', '70005'),
  ('DE288190554',    'Atlas Facility Services GmbH',  null, '{atlas-facility.example}', '70006')
on conflict (vat_id) do nothing;
