# Invoice intake for Hallmann Maschinenbau

Supplier invoices come in by email. Clean invoices are booked in the ERP. Everything else goes to a person. The AI reads the invoice, the rules decide what happens to it.

1. Review screen: https://hallmann-invoices.vercel.app
2. Visual walkthrough: `docs/invoice-journey.pdf`
3. n8n workflows: `workflows/`
4. Production checklist: `docs/PRODUCTION-CHECKLIST.md`

## The journey

![The invoice journey across the five n8n workflows](docs/img/journey-flow.png)

## Run it

Copy `.env.example` to `.env` and fill it in. Then:

```bash
./scripts/setup.sh                 # starts the stack and imports the workflows
python3 scripts/send-emails.py     # delivers the sample emails to the mailbox
```

The review screen runs on http://localhost:3001, n8n on http://localhost:5678.

## How it is built, and why

There are five n8n workflows:

1. Invoice Intake: reads the mailbox (IMAP or Gmail) and stores every email and its files before anything else runs.
2. Process Email: reads the PDF or XML, checks for manipulation, lets the AI classify and extract, then the rules decide.
3. ERP Booking: books in the ERP in real time. If the ERP is down, it waits and retries every 5 minutes.
4. Review Decision: handles approve, save, reject and reopen from the review screen.
5. Monitoring: alerts Avanai by email when something fails or gets stuck.

The AI only reads. A set of plain rules decides what gets booked, and those rules are unit-tested. Every amount, the invoice number and the VAT ID must appear in the document. Net plus VAT must equal gross. This is how the net/gross mix-up Sabine mentioned cannot happen again.

The rules also catch duplicates (even when the number is written differently), unknown suppliers, changed bank details and look-alike senders. Nothing above 10,000 € is booked without a person, the same limit a clerk has.

Emails are stored first, so nothing is lost if a later step fails. Each invoice is booked once, even if the ERP is asked twice.

On the review screen, Jana and Thomas see the original PDF next to the fields. Red means fix, amber means accept with a note. A lead can force a booking, which is logged as forced. Every change is saved in an audit log that cannot be edited: who, when, before and after.

Data lives in Postgres, because auditors need transactions and a log nobody can change.

## How I know it works

1. 30 unit tests on the rules and the workflow structure. All pass.
2. 19 emails sent through a real mailbox, end to end: the 12 samples plus 7 edge cases. All pass.
3. 26 invoice formats, including tables, multi-page invoices, XRechnung and official ZUGFeRD samples. 25 behave as expected.
4. An ERP outage test: the invoice waits, Avanai gets one email, and it is booked exactly once when the ERP is back.
5. Gmail tested end to end on a real account.

## What I would add before this runs for a real client

1. Hallmann's real ERP. Today it is a mock that behaves like a real booking API.
2. An AI model hosted in the EU, under a data processing agreement. Today it is Sarvam, hosted in India.
3. A dedicated invoice mailbox, set up by Hallmann IT.
4. Real hosting with HTTPS and backups.
5. A supplier list synced from the ERP.
6. A pilot on real invoices with automatic booking switched off.

## What I didn't finish

1. Scanned PDFs go to a person. There is no OCR yet.
2. Invoices with two VAT rates go to a person.
3. Early-payment discounts (Skonto) are not captured.
4. The manipulation check flags some genuine e-invoices. That is safe, because they go to a person, but it needs tuning.
5. The live demo runs on my machine through a tunnel, not on a server.

## What I assumed

1. A few invoices arrive per hour, so emails are processed one at a time.
2. An invoice can arrive as email text, a PDF, or an XRechnung/ZUGFeRD file.
3. Correct beats automatic. Anything the rules cannot prove goes to a person.
4. Jana and Thomas are clerks. Sabine is a lead.
5. Foreign currency and non-EU VAT always need a person.

## What I propose next

1. Connect the ERP test system, the mailbox and an EU model.
2. Run a four-week pilot with automatic booking off, and measure how often the system is right.
3. Switch automatic booking on, one supplier at a time.

## Where I used AI coding tools

I built this with Claude Code as a pair programmer, for code, tests and design reviews. The product decisions and the manual testing are mine.
