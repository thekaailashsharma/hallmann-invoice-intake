# Production checklist — Hallmann invoice intake

Status today: **ready for a demo and a supervised trial, not for unattended production.** Tick each item before real invoices flow. Owner: **A** = Avanai, **H** = Hallmann (IT / finance).

## 1. Decisions from Hallmann (before building further)
- [ ] **H** Which ERP and version (SAP S/4HANA, Business Central, proALPHA, abas, DATEV…), and is there an API for posting supplier invoices?
- [ ] **H** A test/sandbox ERP and a technical user for it.
- [ ] **H** Where expense account, cost centre and tax code come from: PO three-way match, supplier default, or a person.
- [ ] **H** What the ERP answers during maintenance (HTTP 503, timeout, or a "200 OK" maintenance page).
- [ ] **H** Auto-book limit (today 10,000 € gross) and clerk approval limit (today 10,000 €).
- [ ] **H** Who are clerks, leads and admins (Jana, Thomas, Sabine…), and who may force a booking.
- [ ] **H** Retention: invoices and originals 10 years (GoBD); where the long-term archive lives.

## 2. Mailbox
- [ ] **H** Dedicated invoice mailbox that receives nothing else; colleagues forward invoices to it.
- [ ] **H** Credential with minimum rights: Gmail `gmail.modify` (Workspace service account approved by the admin for this one mailbox) or an M365 app credential.
- [ ] **H** Gmail label `Processed` created once in that mailbox (Gmail only).
- [ ] **A** Switch the intake from the test mailbox: `IMAP_ENABLED` / `GMAIL_ENABLED`, `GMAIL_QUERY`, re-run setup.
- [ ] **A** Send 5 real test emails and see them processed end to end.

## 3. ERP connection
- [ ] **A** Replace the mock in **ERP Booking → Send to ERP** with the real API (URL + credential); keep our document id as the idempotency key.
- [ ] **A** Map our fields to the ERP's (vendor number from the supplier master, tax code, account/cost centre).
- [ ] **A** Confirm a booking only counts when the ERP returns its own booking id.
- [ ] **A** Re-run `scripts/outage-test.py` against the ERP sandbox (maintenance, duplicate, refused, booked).

## 4. Supplier master
- [ ] **A** Nightly sync from the ERP vendor master into `suppliers` (VAT ID, IBAN, sender domains, vendor number).
- [ ] **H** Process for bank-detail changes (phone verification) — the system flags them; people must verify.

## 5. AI model and data protection
- [ ] **A/H** EU-hosted model under a data processing agreement (Mistral, Azure OpenAI EU, Claude via Bedrock Frankfurt). Change the one OpenAI-compatible credential.
- [ ] **A** Re-run all suites on the new model: `npm test`, `e2e.py`, `format-test.py`; compare field accuracy.
- [ ] **H** DPO sign-off: data flows, retention (emails minimised after processing, n8n execution logs 30 days), records of processing.

## 6. Hosting and security
- [ ] **A** Server or cloud project in the EU; the whole `docker compose` stack (or managed Postgres) with pinned image versions.
- [ ] **A** HTTPS on a Hallmann/Avanai domain for the review screen; n8n editor not public (VPN / IP allow-list).
- [ ] **A** Secrets in a secret manager (`.env` values, ERP and mailbox credentials, webhook key); rotate every key used in the trial.
- [ ] **A** Firebase Admin via a service account (not the CLI token used in the trial); authorized domains = production domain only.
- [ ] **A** Database user for the app without UPDATE/DELETE on `audit_log` (append-only is enforced by trigger; the grant removes the last way around it).
- [ ] **A** Daily Postgres backups, tested restore, and an n8n workflow + credential backup.
- [ ] **A** n8n in queue mode with 2 workers if volume grows beyond a few hundred invoices a day.

## 7. Operations
- [ ] **A** Alerts to Avanai's real on-call channel (e-mail works; Teams/Slack/PagerDuty are drop-in) and a daily digest to Sabine.
- [ ] **A** Uptime checks on the review screen, n8n and the ERP endpoint.
- [ ] **A** Runbook: ERP down, mailbox credential expired, model provider down, "invoice missing" enquiry from a supplier.

## 8. Pilot
- [ ] **H/A** 2–4 weeks on real, anonymised invoices with auto-booking **off**: every invoice goes to review, we measure how often the system would have been right.
- [ ] **A** Track: auto-book rate, wrong fields per 100 invoices, review time per invoice, forced bookings.
- [ ] **H** Switch auto-booking on per supplier once the numbers are agreed.

## 9. Known gaps to close
- [ ] Very long invoices (60+ lines): page-wise extraction.
- [ ] Scanned PDFs: OCR.
- [ ] Invoices with several VAT rates: VAT breakdown in the extraction.
- [ ] Skonto terms captured for early-payment discounts.
- [ ] Duplicate detection for suppliers without a VAT ID.
