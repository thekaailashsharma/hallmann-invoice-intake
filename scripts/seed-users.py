#!/usr/bin/env python3
"""Creates the trial accounts in Firebase Auth and app_users. Passwords are printed once. Usage: python3 scripts/seed-users.py"""
import json, os, secrets, subprocess, urllib.request, urllib.parse, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
env = dict(l.split("=", 1) for l in (ROOT / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
PID = env["FIREBASE_PROJECT_ID"]
c = json.load(open(ROOT / "secrets" / "firebase-refresh.json"))
tok = json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=urllib.parse.urlencode({"client_id": c["client_id"], "client_secret": c["client_secret"], "refresh_token": c["refresh_token"], "grant_type": "refresh_token"}).encode())))["access_token"]
USERS = [("kailashps.1011@gmail.com", "Kailash (Avanai)", "admin"), ("sabine.krueger@hallmann.example", "Sabine Krüger", "lead"), ("jana@hallmann.example", "Jana", "clerk"), ("thomas@hallmann.example", "Thomas", "clerk")]
def it(method, path, body):
    req = urllib.request.Request(f"https://identitytoolkit.googleapis.com/v1/projects/{PID}/accounts{path}", data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}, method=method)
    try: return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e: return {"error": json.load(e)}
for email, name, role in USERS:
    pw = secrets.token_urlsafe(10)
    r = it("POST", "", {"email": email, "password": pw, "displayName": name, "emailVerified": True})
    if "error" in r:
        msg = r["error"].get("error", {}).get("message", "")
        if "EMAIL_EXISTS" in msg: pw = "(unchanged)"
        else: print("✖", email, msg); continue
    subprocess.run(["docker", "exec", "intake-postgres", "psql", "-U", "intake", "-d", "intake", "-c", f"insert into app_users (email, display_name, role, created_by) values ('{email}', '{name}', '{role}', 'seed') on conflict (email) do update set display_name = excluded.display_name, role = excluded.role, active = true"], capture_output=True)
    print(f"✔ {role:6} {email:36} password: {pw}")
