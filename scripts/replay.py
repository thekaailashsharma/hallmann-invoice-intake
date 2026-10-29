#!/usr/bin/env python3
"""Replays the sample mailbox one email at a time into the intake webhook. Usage: python3 scripts/replay.py [--only msg-006]"""
import json, pathlib, sys, time, urllib.request
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = "http://localhost:5681/webhook/invoice-intake"
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
