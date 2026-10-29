#!/usr/bin/env python3
"""Imports workflows/*.json into intake-n8n with credentials attached, activates the triggered ones, restarts n8n."""
import json, os, pathlib, subprocess, tempfile, time, urllib.request
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
subprocess.run(["docker", "cp", tmp, "intake-n8n:/tmp/wfs.json"], check=True)
out = dx("intake-n8n", "n8n", "import:workflow", "--input=/tmp/wfs.json")
print([l for l in out.stdout.splitlines() if "import" in l.lower()][-1] if out.stdout else out.stderr[-500:])
for wid in ACTIVATE:
    r = dx("intake-n8n", "n8n", "update:workflow", f"--id={wid}", "--active=true")
    print(f"activate {wid}:", (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1])
subprocess.run(["docker", "restart", "intake-n8n"], check=True, capture_output=True)
for _ in range(90):
    try:
        if urllib.request.urlopen("http://localhost:5681/healthz", timeout=2).status == 200: break
    except Exception: time.sleep(1)
print("n8n restarted; active workflows loaded")
