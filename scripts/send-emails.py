#!/usr/bin/env python3
"""Delivers the sample emails into the invoice mailbox over SMTP, exactly like a supplier would.
n8n's IMAP trigger picks them up. Usage: python3 scripts/send-emails.py [--only msg-006] [--host localhost --port 3025]"""
import json, pathlib, smtplib, sys, time
from email.message import EmailMessage
from email.utils import format_datetime
from datetime import datetime
ROOT = pathlib.Path(__file__).resolve().parent.parent
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
only, host, port = arg("--only", None), arg("--host", "localhost"), int(arg("--port", "3025"))
TO = "rechnungen@hallmann.example"
if "--file" in sys.argv: emails = json.loads((ROOT / arg("--file", "")).read_text())["emails"]
else: emails = json.loads((ROOT / "fixtures" / "sample-emails.json").read_text())["emails"]
if "--samples-only" not in sys.argv and "--file" not in sys.argv: emails += json.loads((ROOT / "fixtures" / "edge-emails.json").read_text())["emails"]

def pdf(lines):
    """Minimal one-page text PDF (Helvetica, WinAnsi), enough for any PDF text extractor."""
    esc = lambda t: t.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = "BT /F1 11 Tf 56 780 Td 15 TL " + " ".join(f"({esc(l)}) '" for l in lines) + " ET"
    data = stream.encode("cp1252")
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length %d >>\nstream\n" % len(data) + data + b"\nendstream",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"]
    out = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1): offs.append(len(out)); out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(out); out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
    return out + b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
with smtplib.SMTP(host, port, timeout=20) as s:
    for e in emails:
        if only and e["id"] != only: continue
        m = EmailMessage()
        m["From"], m["To"], m["Subject"] = e["from"], TO, e["subject"]
        m["Message-ID"] = f"<{e['id']}-{int(time.time())}@trial.hallmann.example>" if "--fresh" in sys.argv else f"<{e['id']}@trial.hallmann.example>"   # stable id: re-sending the same mail is a no-op downstream
        m["Date"] = format_datetime(datetime.fromisoformat(e["received_at"].replace("Z", "+00:00")))
        for k, v in (e.get("headers") or {}).items(): m[k] = v
        m.set_content(e["body"])
        for att in ([e["attachment"]] if e.get("attachment") else []) + e.get("attachments", []):
            m.add_attachment(pdf(att["lines"]), maintype="application", subtype="pdf", filename=att["name"])
        s.send_message(m)
        print(f"sent {e['id']}  {e['subject'][:60]}")
