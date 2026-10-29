#!/usr/bin/env python3
"""End-to-end check: reset data, replay all 12 emails, compare DB state with fixtures/expected.json. Exit 1 on mismatch."""
import os, pathlib as _pl
for _l in (_pl.Path(__file__).resolve().parent.parent / ".env").read_text().splitlines() if (_pl.Path(__file__).resolve().parent.parent / ".env").exists() else []:
    if "=" in _l and not _l.startswith("#"): os.environ.setdefault(_l.split("=", 1)[0].strip(), _l.split("=", 1)[1].strip())
import imaplib, json, pathlib, subprocess, sys, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
def psql(sql): return subprocess.run(["docker", "exec", "intake-postgres", "psql", "-U", "intake", "-d", "intake", "-At", "-c", sql], capture_output=True, text=True).stdout.strip()
if "--keep" not in sys.argv:
    psql("set session_replication_role = replica; truncate audit_log, alerts, erp_invoices, documents, inbound_emails restart identity cascade; update erp_status set available = true, note = 'ERP online';")
    print("reset data")
    for user in ("rechnungen@hallmann.example", "oncall@avanai.example"):   # empty the mailboxes
        try:
            m = imaplib.IMAP4("localhost", 3143); m.login(user, os.environ.get("MAILBOX_PASSWORD", "mailbox") if user.startswith("rechnungen") else user); m.select("INBOX")
            typ, ids = m.search(None, "ALL")
            for i in ids[0].split(): m.store(i, "+FLAGS", "\\Deleted")
            m.expunge(); m.logout()
        except Exception: pass
expected = {k: v for k, v in json.loads((ROOT / "fixtures" / "expected.json").read_text()).items() if not k.startswith("_")}
# Deliver like a supplier would (SMTP → mailbox); n8n's IMAP trigger picks them up.
subprocess.run([sys.executable, str(ROOT / "scripts" / "send-emails.py")], check=True)
t0 = time.time(); docs = {}
while time.time() - t0 < 900:
    rows = psql("select json_agg(row_to_json(t)) from (select split_part(message_id, '@', 1) as message_id, status::text, doc_type::text, gross_amount, invoice_number, related_invoice, reasons, warnings, injection_flag from documents order by created_at) t")
    docs = {d["message_id"]: d for d in (json.loads(rows) if rows else [])}
    settled = all(k in docs and docs[k]["status"] != "pending_erp" for k in expected)
    print(f"\r  waiting… {len(docs)}/{len(expected)} documents  ({time.time() - t0:.0f}s)", end="", flush=True)
    if settled: break
    time.sleep(5)
print()
fails = 0
for mid, exp in expected.items():
    d = docs.get(mid)
    problems = []
    if not d: problems.append("no document row")
    else:
        if d["status"] != exp["status"]: problems.append(f"status {d['status']} ≠ {exp['status']}")
        if d["doc_type"] != exp["doc_type"]: problems.append(f"type {d['doc_type']} ≠ {exp['doc_type']}")
        if "gross" in exp and (d["gross_amount"] is None or abs(float(d["gross_amount"]) - exp["gross"]) > 0.001): problems.append(f"gross {d['gross_amount']} ≠ {exp['gross']}")
        if "invoice_number" in exp and d["invoice_number"] != exp["invoice_number"]: problems.append(f"number {d['invoice_number']} ≠ {exp['invoice_number']}")
        if "related" in exp and (d["related_invoice"] or "") != exp["related"]: problems.append(f"related {d['related_invoice']} ≠ {exp['related']}")
        if "reason" in exp and exp["reason"].lower() not in json.dumps(d["reasons"]).lower(): problems.append(f"reason '{exp['reason']}' not in {d['reasons']}")
    print(("✔" if not problems else "✖"), mid, exp["status"], "·", exp["why"], ("" if not problems else " → " + "; ".join(problems)))
    fails += bool(problems)
erp = psql("select count(*) from erp_invoices"); audit = psql("select count(*) from audit_log"); alerts = psql("select count(*) from alerts")
print(f"\nERP rows: {erp} · audit entries: {audit} · alerts: {alerts}")
print("RESULT:", "ALL PASS" if not fails else f"{fails} FAILED"); sys.exit(1 if fails else 0)
