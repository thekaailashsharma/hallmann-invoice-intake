#!/usr/bin/env python3
"""ERP outage test: ERP goes into (unannounced) maintenance, a clean invoice arrives, it must wait (pending_erp),
Avanai must get ONE alert e-mail, and after the ERP is back the retry must book it exactly once."""
import imaplib, os, pathlib, smtplib, subprocess, sys, time, uuid
from email.message import EmailMessage
ROOT = pathlib.Path(__file__).resolve().parent.parent
def psql(q): return subprocess.run(["docker", "exec", "intake-postgres", "psql", "-U", "intake", "-d", "intake", "-Atc", q], capture_output=True, text=True).stdout.strip()
def erp(a): return subprocess.run(["bash", str(ROOT / "scripts" / "erp.sh"), a], capture_output=True, text=True).stdout.strip()
def wait(q, want, t=300):
    t0 = time.time()
    while time.time() - t0 < t:
        v = psql(q)
        if v == want: return True
        time.sleep(4)
    print("   last value:", v); return False
def oncall_mails():
    m = imaplib.IMAP4("localhost", 3143); m.login("oncall@avanai.example", "oncall@avanai.example"); m.select("INBOX")
    n = len(m.search(None, "ALL")[1][0].split()); m.logout(); return n
ok = True; mid = f"outage-{uuid.uuid4().hex[:8]}"; num = f"2026-{int(time.time()) % 100000:05d}"
print("ERP →", erp("down"))
try: before = oncall_mails()
except Exception: before = 0
m = EmailMessage(); m["From"] = "billing@nordwerk.example"; m["To"] = "rechnungen@hallmann.example"; m["Subject"] = f"Invoice {num}"; m["Message-ID"] = f"<{mid}@trial.hallmann.example>"
m.set_content(f"Nordwerk Industriebedarf GmbH\nVAT ID: DE298765431\n\nInvoice number: {num}\nInvoice date: 27.10.2026\nDue date: 26.11.2026\nPO: 4500179100\n\nNet: 800,00 EUR\nVAT 19%: 152,00 EUR\nTotal: 952,00 EUR")
with smtplib.SMTP("localhost", 3025) as s: s.send_message(m)
print("sent", num)
r = wait(f"select status from documents where message_id like '{mid}%'", "pending_erp"); print(("✔" if r else "✖"), "invoice waits while the ERP is down (pending_erp)"); ok &= r
r = wait("select count(*) from alerts where source = 'erp-booking' and not acknowledged", "1", 60); print(("✔" if r else "✖"), "one ERP alert raised"); ok &= r
time.sleep(5)
try: after = oncall_mails()
except Exception: after = before
r = after - before == 1; print(("✔" if r else "✖"), f"one alert e-mail to Avanai on-call ({after - before})"); ok &= r
print("ERP →", erp("up"))
subprocess.run(["docker", "exec", "-e", "N8N_RUNNERS_BROKER_PORT=5680", os.environ.get("N8N_CONTAINER", "sarvam-n8n"), "n8n", "execute", "--id=InvErpBooking0001"], capture_output=True)
r = wait(f"select status from documents where message_id like '{mid}%'", "booked", 400); print(("✔" if r else "✖"), "booked after the ERP is back (retry)"); ok &= r
r = psql(f"select count(*) from erp_invoices where invoice_number = '{num}'") == "1"; print(("✔" if r else "✖"), "exactly one ERP row"); ok &= r
r = wait("select count(*) from alerts where source = 'erp-booking' and not acknowledged", "0", 60); print(("✔" if r else "✖"), "ERP alert closed automatically"); ok &= r
print("RESULT:", "ALL PASS" if ok else "FAILED"); sys.exit(0 if ok else 1)
