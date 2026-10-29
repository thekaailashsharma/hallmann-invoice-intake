# Invoice intake for Hallmann Maschinenbau

Jana and Thomas spend most of their week typing supplier invoices into the ERP. This project takes that work off their desk. Invoices arrive by email, the system reads them, and the ones that are clearly correct are booked in the ERP on their own. Anything the system is not sure about goes to Jana and Thomas, with the reason written next to it.

You can try the review screen at https://hallmann-invoices.vercel.app. There is also a short visual walkthrough in `docs/invoice-journey.pdf`, the n8n workflows are in `workflows/`, and the list of what is needed before go-live is in `docs/PRODUCTION-CHECKLIST.md`.

## The journey

![The invoice journey across the five n8n workflows](docs/img/journey-flow.png)

## Run it

Copy `.env.example` to `.env` and fill in the keys. Then start everything and send the sample emails into the mailbox:

```bash
./scripts/setup.sh
python3 scripts/send-emails.py
```

The review screen runs on http://localhost:3001 and n8n on http://localhost:5678.

## How it is built, and why

The work is split into five n8n workflows, each with one job. Invoice Intake reads the mailbox and saves every email and its attachments before anything else happens. Process Email reads the invoice, whether it is in the email text, a PDF or an XRechnung file, and decides what to do with it. ERP Booking is the only part that writes to the ERP. Review Decision handles what Jana and Thomas do on the screen. Monitoring tells Avanai when something goes wrong.

The most important decision was that the AI never decides what gets booked. Sabine's last tool mixed up net and gross for weeks without anyone noticing, so here the AI only reads the invoice. A set of plain rules then checks what it read. Every amount, the invoice number and the VAT ID must actually appear in the document, and net plus VAT must equal gross. If anything doesn't add up, the invoice goes to a person instead of the ERP.

The same rules catch the things Sabine listed. A resent invoice is recognised as a duplicate, even when the number is written a little differently. Reminders, proformas and meeting emails are recorded but never booked. Forwarded invoices from colleagues are read like any other. Credit notes are booked as credit notes. German and English both work. On top of that, the rules flag unknown suppliers, changed bank details and emails from look-alike addresses, because those are how invoice fraud usually happens. Nothing above 10,000 € is booked without a person, which is the same limit a clerk has.

Nothing gets lost along the way. Every email is saved before the system starts working on it, so if a step fails, it can pick up again later. When the ERP is down for maintenance, the invoice simply waits and the system tries again every five minutes. Each invoice is booked once, even if the ERP is asked twice.

The review screen is kept simple. Jana and Thomas see the original PDF next to the fields the system read. Fields that are wrong are marked red, and things that only need a second look are marked amber. When they change a number, the related amounts update on their own. A lead can still force a booking if needed, and that is logged clearly. Every change is saved with who made it, when, and what the values were before and after, so the auditors' question finally has an answer.

All of this is stored in Postgres, because the auditors need a record that cannot be quietly changed afterwards.

## How I know it works

I tested it in four ways. There are 30 unit tests on the rules and on how the workflows are wired, and they all pass. I sent Sabine's 12 sample emails plus 7 harder cases through a real mailbox, one at a time, and every one ended up where it should. I also tested 26 different invoice layouts, including multi-page invoices, two VAT rates, US dates, XRechnung and official ZUGFeRD samples. 25 of them behave as expected, and the one that doesn't still goes safely to a person. Finally, I switched the ERP off in the middle of a booking: the invoice waited, Avanai got one email, and once the ERP was back the invoice was booked exactly once. I also tested the whole flow with a real Gmail account.

## What I would add before this runs for a real client

The biggest piece is Hallmann's real ERP. Today the system books into a mock that behaves like a real booking API, so we need to know which ERP Hallmann uses and get access to a test system. The AI model should move to a provider hosted in the EU, with a data processing agreement, since the current one is hosted in India. Hallmann IT would set up a dedicated invoice mailbox, and the system needs proper hosting with HTTPS and backups. The supplier list should be synced from the ERP every night. Before any invoice is booked automatically, I would run a pilot on real invoices with automatic booking switched off, to see how often the system gets it right.

## What I didn't finish

Scanned PDFs without text still go to a person, because there is no OCR yet. Invoices with two VAT rates also go to a person, and early-payment discounts (Skonto) are not captured. The check for manipulated emails sometimes flags genuine e-invoices. That is safe, because they go to a person, but it needs tuning on real mail. And the live demo runs on my laptop through a tunnel, not on a proper server.

## What I assumed

Where the brief left things open, I made these calls. Several hundred invoices a month is a few per hour, so emails are handled one at a time and correctness matters more than speed. An invoice can arrive as email text, a PDF or an e-invoice file. Being correct matters more than being automatic, so anything the rules cannot prove goes to a person. Jana and Thomas are clerks and Sabine is a lead. Invoices in foreign currencies, or with VAT from outside the EU, always need a person.

## What I propose next

First, connect Hallmann's ERP test system, the real mailbox and an EU-hosted model. Then run a pilot for about four weeks with automatic booking switched off, so every invoice still goes to Jana and Thomas and we can measure how often the system was right. Once Sabine is happy with the numbers, we switch automatic booking on, one supplier at a time.

## Where I used AI coding tools

I used Claude Code as a pair programmer throughout: it wrote much of the code and the tests and helped review the design. The product decisions, the rules and the hands-on testing are mine.
