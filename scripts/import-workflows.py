#!/usr/bin/env python3
"""Imports workflows/*.json into intake-n8n with credentials attached, activates the triggered ones, restarts n8n."""
import os, pathlib as _pl
for _l in (_pl.Path(__file__).resolve().parent.parent / ".env").read_text().splitlines() if (_pl.Path(__file__).resolve().parent.parent / ".env").exists() else []:
    if "=" in _l and not _l.startswith("#"): os.environ.setdefault(_l.split("=", 1)[0].strip(), _l.split("=", 1)[1].strip())
import json, os, pathlib, subprocess, tempfile, time, urllib.request
N8N = os.environ.get("N8N_CONTAINER", "intake-n8n")
N8N_URL = os.environ.get("N8N_URL", "http://localhost:5681")
N8N = os.environ.get("N8N_CONTAINER", "intake-n8n")
N8N_URL = os.environ.get("N8N_URL", "http://localhost:5681")
ROOT = pathlib.Path(__file__).resolve().parent.parent
NEEDS = {"n8n-nodes-base.postgres": ("postgres", "IntakePostgres001", "Intake Postgres"),
         "@n8n/n8n-nodes-langchain.lmChatOpenAi": ("openAiApi", "IntakeLlmOpenAi01", "LLM (OpenAI-compatible: Sarvam-105B)")}
ACTIVATE = ["InvIntake00000001", "InvErpBooking0001", "InvErpRetry000001", "InvReviewDecision", "InvErrorHandler01"]
def dx(*a): return subprocess.run(["docker", "exec", *a], capture_output=True, text=True)
bundle = []
for f in sorted((ROOT / "workflows").glob("*.json")):
    wf = json.loads(f.read_text())
    for n in wf["nodes"]:
        t = NEEDS.get(n["type"])
        if t: n["credentials"] = {t[0]: {"id": t[1], "name": t[2]}}
    bundle.append(wf)
with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh: json.dump(bundle, fh); tmp = fh.name
os.chmod(tmp, 0o644)
subprocess.run(["docker", "cp", tmp, f"{N8N}:/tmp/wfs.json"], check=True)
out = dx(N8N, "n8n", "import:workflow", "--input=/tmp/wfs.json")
print([l for l in out.stdout.splitlines() if "import" in l.lower()][-1] if out.stdout else out.stderr[-500:])
for wid in ACTIVATE:
    # n8n 2.x: import writes the draft; publish makes it the live version (and activates triggers)
    r = dx(N8N, "n8n", "publish:workflow", f"--id={wid}")
    line = [l for l in (r.stdout + r.stderr).splitlines() if l.strip() and "license" not in l.lower() and "python" not in l.lower()]
    print(f"publish {wid}:", (line or ["?"])[-1][:120])
subprocess.run(["docker", "restart", N8N], check=True, capture_output=True)
for _ in range(90):
    try:
        if urllib.request.urlopen(f"{N8N_URL}/healthz", timeout=2).status == 200: break
    except Exception: time.sleep(1)
print("n8n restarted; active workflows loaded")
