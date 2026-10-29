#!/usr/bin/env python3
"""End-to-end check: reset data, replay all 12 emails, compare DB state with fixtures/expected.json. Exit 1 on mismatch."""
import json, pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
def psql(sql): return subprocess.run(["docker", "exec", "intake-postgres", "psql", "-U", "intake", "-d", "intake", "-At", "-c", sql], capture_output=True, text=True).stdout.strip()
if "--keep" not in sys.argv:
    psql("truncate audit_log, alerts, erp_invoices, documents, inbound_emails restart identity cascade; update erp_status set available = true, note = 'ERP online';")
    print("reset data")
subprocess.run([sys.executable, str(ROOT / "scripts" / "replay.py")], check=False)
expected = {k: v for k, v in json.loads((ROOT / "fixtures" / "expected.json").read_text()).items() if not k.startswith("_")}
rows = psql("select json_agg(row_to_json(t)) from (select message_id, status::text, doc_type::text, gross_amount, invoice_number, related_invoice, reasons, warnings, injection_flag from documents order by created_at) t")
docs = {d["message_id"]: d for d in (json.loads(rows) if rows and rows != "" else [])}
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
