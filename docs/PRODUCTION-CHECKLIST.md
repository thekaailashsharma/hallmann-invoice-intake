# Production checklist

Today this is ready for a demo and a supervised trial. It is not ready to run on its own with real invoices. Work through this list first. Each item names who owns it: Avanai or Hallmann.

## Decisions from Hallmann

1. Which ERP and which version, and whether it has an API for posting supplier invoices. Hallmann.
2. A test system for the ERP, with a technical user. Hallmann.
3. Where the expense account, cost centre and tax code come from: the purchase order, the supplier, or a person. Hallmann.
4. What the ERP answers during maintenance. Hallmann.
5. The limit for automatic booking and the clerk approval limit. Both are 10,000 € today. Hallmann.
6. Who is a clerk, a lead or an admin, and who may force a booking. Hallmann.
7. How long invoices are kept (10 years under GoBD) and where the archive lives. Hallmann.

## Mailbox

1. A dedicated invoice mailbox that receives nothing else. Hallmann.
2. A credential with the fewest rights possible: Gmail with `gmail.modify`, or a Microsoft 365 app credential. Hallmann.
3. A Gmail label called "Processed", created once. Hallmann.
4. Switch the intake from the test mailbox to the real one, and send five real test emails. Avanai.

## ERP connection

1. Replace the mock in ERP Booking with the real API. Keep our document id as the key that prevents double booking. Avanai.
2. Map our fields to the ERP's fields. Avanai.
3. Count a booking only when the ERP returns its own booking id. Avanai.
4. Run the outage test against the ERP test system. Avanai.

## Supplier list

1. Sync the supplier list from the ERP every night: VAT ID, IBAN, sender domains, vendor number. Avanai.
2. Agree how changed bank details are verified, for example by phone. The system flags them, a person checks them. Hallmann.

## AI model and data protection

1. Move to an AI model hosted in the EU, under a data processing agreement. Avanai and Hallmann.
2. Run all test suites again on the new model. Avanai.
3. Sign-off from the data protection officer. Hallmann.

## Hosting and security

1. A server in the EU running the whole stack, with fixed image versions. Avanai.
2. HTTPS on a proper domain for the review screen. The n8n editor stays private. Avanai.
3. All secrets in a secret manager, and every key from the trial replaced. Avanai.
4. Firebase admin access through a service account, and sign-in allowed only on the production domain. Avanai.
5. A database user for the app that cannot change the audit log. Avanai.
6. Daily database backups, with a tested restore. Avanai.

## Operations

1. Alerts to Avanai's real on-call channel, and a daily summary for Sabine. Avanai.
2. Uptime checks on the review screen, n8n and the ERP. Avanai.
3. A short runbook for the common problems: ERP down, mailbox credential expired, AI provider down, a supplier asking about a missing invoice. Avanai.

## Pilot

1. Two to four weeks on real invoices with automatic booking off. Every invoice goes to a person, and we measure how often the system was right. Hallmann and Avanai.
2. Track the automatic booking rate, wrong fields per 100 invoices, review time and forced bookings. Avanai.
3. Switch automatic booking on, one supplier at a time. Hallmann.

## Known gaps

1. Scanned PDFs need OCR.
2. Invoices with several VAT rates need a VAT breakdown.
3. Early-payment discounts (Skonto) are not captured yet.
4. The manipulation check needs tuning on real Hallmann mail.
5. Duplicate checks are weaker for suppliers without a VAT ID.
