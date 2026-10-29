# Invoice intake · Hallmann Maschinenbau × Avanai

Supplier invoices in, clean invoices booked in the ERP, everything else to a person. **The AI reads, the rules decide.**

- **Live review screen:** https://hallmann-invoices.vercel.app
- **Visual walkthrough (PDF):** [docs/invoice-journey.pdf](docs/invoice-journey.pdf)
- **n8n workflows:** [workflows/](workflows/)
- **Before go-live:** [docs/PRODUCTION-CHECKLIST.md](docs/PRODUCTION-CHECKLIST.md)

## The journey

![The invoice journey across the five n8n workflows](docs/img/journey-flow.png)

## Run it

```bash
cp .env.example .env && ./scripts/setup.sh      # whole stack + workflows
python3 scripts/send-emails.py                  # deliver the sample emails
open http://localhost:3001                       # review screen · n8n on :5678
```

## 1. How it is built, and why

- **n8n, 5 workflows:** Intake · Process Email · ERP Booking · Review Decision · Monitoring.
- **The AI only reads** (type + fields). A unit-tested rule set decides what is booked.
- **Every number must appear in the document**, and net + VAT must equal gross: no net/gross mix-ups.
- **Duplicates are caught**, even when the invoice number is written differently.
- **Fraud checks:** unknown supplier, changed IBAN, look-alike sender go to a person.
- **Auto-booking is capped at 10,000 €**, the same as a clerk's limit.
- **Emails are stored first**, so nothing is lost if anything fails later.
- **The ERP is called in real time.** Down means wait and retry every 5 min. Never booked twice.
- **Review screen:** the PDF next to the fields, red = fix, amber = accept with a note, force with a logged confirmation.
- **Append-only audit log:** who, when, before and after.
- **Google sign-in** with roles: clerk, lead, admin.
- **Postgres**, because auditors need transactions and a log that can't be edited.

## 2. How I know it works

- **30 unit tests:** rules, number formats, fraud, tax, workflow structure.
- **19 emails end to end** through a real mailbox: all pass.
- **26 invoice formats** (tables, multi-page, XRechnung, official ZUGFeRD samples): 25 as expected.
- **ERP outage test:** waits, one alert, booked exactly once when the ERP is back.
- **Gmail tested** end to end on a real account.

## 3. Before a real client

- Connect Hallmann's real ERP (today: a mock with the same behaviour).
- An EU-hosted AI model under a data processing agreement (today: Sarvam, hosted in India).
- A dedicated invoice mailbox, set up by Hallmann IT.
- Real hosting with HTTPS and backups.
- A supplier master synced from the ERP.
- A pilot on real invoices with auto-booking off.

## 4. What I didn't finish

- Scanned PDFs go to a person (no OCR yet).
- Invoices with two VAT rates go to a person.
- Skonto terms are not captured.
- Guardrails flag some genuine e-invoices (fail-safe, needs tuning).
- The live demo runs on my machine through a tunnel, not on a server.

## Assumptions

- A few invoices per hour, so emails are processed one at a time.
- An invoice can come as email text, a PDF, or an XRechnung/ZUGFeRD file.
- Correct beats automatic: anything unproven goes to a person.
- Jana and Thomas are clerks; Sabine is a lead.
- Foreign currency and non-EU VAT always need a person.

## Next

1. Connect the ERP sandbox, the mailbox and an EU model.
2. Run a 4-week pilot with auto-booking off and measure accuracy.
3. Switch auto-booking on supplier by supplier.

## AI coding tools

Built with Claude Code as a pair programmer: code, tests and design reviews. The product decisions and the manual testing are mine.
