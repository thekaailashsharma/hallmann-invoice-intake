#!/usr/bin/env python3
"""Creates n8n credentials from .env, imports workflows/*.json, publishes them, files them into a folder,
seeds the Supplier master data table and restarts n8n. Idempotent."""
import json, os, pathlib, subprocess, tempfile, time, urllib.request, urllib.error
ROOT = pathlib.Path(__file__).resolve().parent.parent
for l in (ROOT / ".env").read_text().splitlines() if (ROOT / ".env").exists() else []:
    if "=" in l and not l.startswith("#"): os.environ.setdefault(l.split("=", 1)[0].strip(), l.split("=", 1)[1].strip())
E = os.environ.get
N8N, N8N_URL = E("N8N_CONTAINER", "intake-n8n"), E("N8N_URL", "http://localhost:5681")
FOLDER = "Hallmann · Invoice Intake"
CREDS = {  # type → (id, name, data)
    "postgres": ("IntakePostgres001", "Intake Postgres", {"host": E("PG_HOST_FOR_N8N", "postgres"), "port": int(E("PG_PORT_FOR_N8N", "5432")), "database": "intake", "user": "intake", "password": E("POSTGRES_PASSWORD", "intake"), "ssl": "disable", "allowUnauthorizedCerts": False}),
    "openAiApi": ("IntakeLlmOpenAi01", "LLM (OpenAI-compatible: Sarvam-105B)", {"apiKey": E("SARVAM_API_KEY", ""), "url": E("LLM_BASE_URL", "https://api.sarvam.ai/v1"), "organizationId": "", "header": False}),
    "httpHeaderAuth": ("IntakeWebhookKey1", "Intake webhook key", {"name": "X-Intake-Key", "value": E("N8N_WEBHOOK_KEY", "")}),
    "imap": ("IntakeImap0000001", "Invoice mailbox (IMAP)", {"user": E("MAILBOX_USER", "rechnungen@hallmann.example"), "password": E("MAILBOX_PASSWORD", "mailbox"), "host": E("MAILBOX_HOST_FOR_N8N", "mailbox"), "port": int(E("MAILBOX_PORT", "3143")), "secure": False, "allowUnauthorizedCerts": True}),
    "smtp": ("IntakeSmtp0000001", "Alert mail (SMTP)", {"user": "", "password": "", "host": E("MAILBOX_HOST_FOR_N8N", "mailbox"), "port": int(E("SMTP_PORT", "3025")), "secure": False, "disableStartTls": True}),
}
NEEDS = {"n8n-nodes-base.postgres": "postgres", "@n8n/n8n-nodes-langchain.lmChatOpenAi": "openAiApi", "n8n-nodes-base.webhook": "httpHeaderAuth", "n8n-nodes-base.emailReadImap": "imap", "n8n-nodes-base.emailSend": "smtp"}
PUBLISH = ["InvIntake00000001", "InvErpBooking0001", "InvReviewDecision", "InvErrorHandler01"]
RETIRED = ["InvErpRetry000001", "InvWatchdog00001", "InvSupplierSetup"]   # merged into ERP Booking / Monitoring; supplier master is a Postgres table
def dx(*a, **k): return subprocess.run(["docker", "exec", *a], capture_output=True, text=True, **k)
def cp_in(obj, dest):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh: json.dump(obj, fh); tmp = fh.name
    os.chmod(tmp, 0o644); subprocess.run(["docker", "cp", tmp, f"{N8N}:{dest}"], check=True); os.unlink(tmp)

cp_in([{"id": i, "name": n, "type": t, "data": d} for t, (i, n, d) in CREDS.items()], "/tmp/creds.json")
print("credentials:", (dx(N8N, "n8n", "import:credentials", "--input=/tmp/creds.json").stdout.strip().splitlines() or ["?"])[-1])
dx("-u", "root", N8N, "rm", "-f", "/tmp/creds.json")

# Gmail: the OAuth credential is created by a person in the n8n UI (Google consent). Reuse it if it exists;
# GMAIL_ENABLED=true switches the intake from the IMAP trigger to the Gmail trigger.
vol0 = subprocess.run(["docker", "inspect", N8N, "--format", '{{range .Mounts}}{{if eq .Destination "/home/node/.n8n"}}{{.Name}}{{end}}{{end}}'], capture_output=True, text=True).stdout.strip()
g = subprocess.run(["docker", "run", "--rm", "-v", f"{vol0}:/d", "python:3.12-alpine", "python", "-c",
    "import sqlite3,json;c=sqlite3.connect('file:/d/database.sqlite?mode=ro',uri=True);print(json.dumps(c.execute(\"select id,name from credentials_entity where type='gmailOAuth2' order by updatedAt desc limit 1\").fetchone()))"], capture_output=True, text=True).stdout.strip()
GMAIL = json.loads(g) if g and g != "null" else None
GMAIL_ON = E("GMAIL_ENABLED", "false").lower() == "true"
print("gmail credential:", GMAIL[1] if GMAIL else "none yet", "· trigger:", "Gmail" if GMAIL_ON and GMAIL else "IMAP")
bundle = []
for f in sorted((ROOT / "workflows").glob("*.json")):
    wf = json.loads(f.read_text())
    for n in wf["nodes"]:
        t = NEEDS.get(n["type"])
        if t: n["credentials"] = {t: {"id": CREDS[t][0], "name": CREDS[t][1]}}
        if n["type"] == "n8n-nodes-base.gmail" and GMAIL: n["credentials"] = {"gmailOAuth2": {"id": GMAIL[0], "name": GMAIL[1]}}
        if n["type"] == "n8n-nodes-base.gmailTrigger":
            if GMAIL: n["credentials"] = {"gmailOAuth2": {"id": GMAIL[0], "name": GMAIL[1]}}
            n["disabled"] = not (GMAIL_ON and GMAIL)
        if n["type"] == "n8n-nodes-base.emailReadImap": n["disabled"] = bool(GMAIL_ON and GMAIL)
    bundle.append(wf)
cp_in(bundle, "/tmp/wfs.json")
out = dx(N8N, "n8n", "import:workflow", "--input=/tmp/wfs.json")
print([l for l in out.stdout.splitlines() if "import" in l.lower()][-1] if out.stdout else out.stderr[-500:])
for wid in RETIRED: dx(N8N, "n8n", "unpublish:workflow", f"--id={wid}")
for wid in PUBLISH:
    r = dx(N8N, "n8n", "publish:workflow", f"--id={wid}")
    line = [l for l in (r.stdout + r.stderr).splitlines() if l.strip() and "license" not in l.lower() and "python" not in l.lower()]
    print(f"publish {wid}:", (line or ["?"])[-1][:110])

# Folders + node groups + retire: n8n's CLI has no folder flag, so set it in n8n's database while n8n is stopped.
vol = subprocess.run(["docker", "inspect", N8N, "--format", '{{range .Mounts}}{{if eq .Destination "/home/node/.n8n"}}{{.Name}}{{end}}{{end}}'], capture_output=True, text=True).stdout.strip()
groups = {wf["id"]: None for wf in bundle}
script = f"""
import sqlite3, json, secrets, datetime
c = sqlite3.connect('/d/database.sqlite'); now = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.000')
pid = c.execute("select id from project where type = 'personal' limit 1").fetchone()[0]
def folder(name):
    r = c.execute('select id from folder where name = ? and projectId = ?', (name, pid)).fetchone()
    if r: return r[0]
    fid = secrets.token_urlsafe(12)[:16]; c.execute('insert into folder (id, name, parentFolderId, projectId, createdAt, updatedAt) values (?, ?, null, ?, ?, ?)', (fid, name, pid, now, now)); return fid
inv = folder({FOLDER!r})
for wid, g in json.loads({json.dumps(json.dumps(groups))}).items():
    c.execute("update workflow_entity set parentFolderId = ?, nodeGroups = '[]' where id = ?", (inv, wid)); c.execute("update workflow_history set nodeGroups = '[]' where workflowId = ?", (wid,))
c.execute("update workflow_entity set isArchived = 1, active = 0, parentFolderId = ? where id in ({','.join(repr(r) for r in RETIRED)})", (inv,))
ws = c.execute("select id from workflow_entity where id in ('cto0htST9qyowFcF', 'NspES53w6oBlbIHT')").fetchall()
if ws:
    wsf = folder('Sarvam Workshop')
    for (wid,) in ws: c.execute('update workflow_entity set parentFolderId = ? where id = ?', (wsf, wid))
c.commit(); print('folders set')
"""
subprocess.run(["docker", "stop", N8N], check=True, capture_output=True)
r = subprocess.run(["docker", "run", "--rm", "-v", f"{vol}:/d", "python:3.12-alpine", "python", "-c", script], capture_output=True, text=True)
print(r.stdout.strip() or r.stderr[-400:])
subprocess.run(["docker", "start", N8N], check=True, capture_output=True)
for _ in range(90):
    try:
        if urllib.request.urlopen(f"{N8N_URL}/healthz", timeout=2).status == 200: break
    except Exception: time.sleep(1)
for _ in range(60):   # webhooks register a few seconds after /healthz turns green
    try: urllib.request.urlopen(urllib.request.Request(f"{N8N_URL}/webhook/review-decision", data=b"{}", method="POST"), timeout=3)
    except urllib.error.HTTPError as ex:
        if ex.code != 404: break
    except Exception: pass
    time.sleep(1)
print("n8n ready:", N8N_URL)
