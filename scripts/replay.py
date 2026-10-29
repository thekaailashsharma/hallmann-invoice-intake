#!/usr/bin/env python3
"""Replays the sample mailbox one email at a time into the intake webhook. Usage: python3 scripts/replay.py [--only msg-006]"""
import os, pathlib as _pl
for _l in (_pl.Path(__file__).resolve().parent.parent / ".env").read_text().splitlines() if (_pl.Path(__file__).resolve().parent.parent / ".env").exists() else []:
    if "=" in _l and not _l.startswith("#"): os.environ.setdefault(_l.split("=", 1)[0].strip(), _l.split("=", 1)[1].strip())
import json, pathlib, sys, time, urllib.request
ROOT = pathlib.Path(__file__).resolve().parent.parent
import os
URL = os.environ.get("N8N_URL", "http://localhost:5681").rstrip("/") + "/webhook/invoice-intake"
only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
emails = json.loads((ROOT / "fixtures" / "sample-emails.json").read_text())["emails"]
for e in emails:
    if only and e["id"] != only: continue
    t0 = time.time()
    req = urllib.request.Request(URL, data=json.dumps(e).encode(), headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r: body = r.read().decode()
        try: j = json.loads(body); j = j[0] if isinstance(j, list) and j else j
        except Exception: j = {"raw": body[:200]}
        print(f"{e['id']}  {e['subject'][:45]:45}  → {j.get('status') or j.get('outcome') or j}  ({time.time() - t0:.1f}s)")
    except Exception as ex:
        print(f"{e['id']}  {e['subject'][:45]:45}  → ERROR {ex}")
