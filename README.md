# Take-home task: Invoice intake for Hallmann Maschinenbau

I built a system where invoices come in by email, clean ones are booked in the ERP on their own, and everything else goes to Jana and Thomas.

- Review screen: https://hallmann-invoices.vercel.app
- Walkthrough: `docs/invoice-journey.pdf`
- n8n workflows: `workflows/`
- Go-live checklist: `docs/PRODUCTION-CHECKLIST.md`

![The invoice journey](docs/img/journey-flow.png)

## Run it

```bash
cp .env.example .env    # fill in the keys
./scripts/setup.sh      # starts everything and imports the workflows
python3 scripts/send-emails.py
```

## How it is built, and why

- Five n8n workflows: Intake, Process Email, ERP Booking, Review Decision and Monitoring.
- The AI only reads the invoice; plain rules decide what gets booked.
- Every amount must appear in the document and net plus VAT must equal gross, so net and gross can't be mixed up again.
- Duplicates are caught, even when the invoice number is written differently.
- Reminders, proformas and other emails are recorded but never booked.
- Unknown suppliers, changed bank details and look-alike senders always go to a person.
- Nothing above 10,000 € is booked without a person, the same limit a clerk has.
- Every email is saved first, so nothing is lost if something breaks.
- When the ERP is down, the invoice waits and is retried every 5 minutes, and it is never booked twice.
- On the review screen, Jana and Thomas see the original PDF next to the fields and fix what is marked red.
- Every change is saved with who, when, and the values before and after.
- When something breaks, Avanai gets an email before a supplier notices.

## Future scope

- OCR for handwritten invoices.
- Invoices with two VAT rates go to a person.
- Early-payment discounts (Skonto) are not captured.
- The manipulation check sometimes flags genuine invoices and needs tuning.


## Where I used AI coding tools

- I used Claude Code & n8n MCP with Claude to write most of the code and tests; the decisions and the testing are mine.

Best
~ Kailash
