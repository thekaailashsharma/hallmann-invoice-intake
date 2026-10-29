#!/usr/bin/env bash
# Trial only: turns the Firebase CLI login into an Admin SDK credential (secrets/firebase-refresh.json)
# so the review app can create users and verify tokens. Production uses a service account key instead.
set -euo pipefail
cd "$(dirname "$0")/.."
CS="$HOME/.config/configstore/firebase-tools.json"
API=/opt/homebrew/lib/node_modules/firebase-tools/lib/api.js
CID=$(grep -oE 'FIREBASE_CLIENT_ID", "[^"]+"' "$API" | sed 's/.*", "//; s/"$//')
SEC=$(grep -oE 'FIREBASE_CLIENT_SECRET", "[^"]+"' "$API" | sed 's/.*", "//; s/"$//')
python3 - "$CS" "$CID" "$SEC" <<'PY'
import json,sys
cs=json.load(open(sys.argv[1])); rt=cs["tokens"]["refresh_token"]
json.dump({"type":"authorized_user","client_id":sys.argv[2],"client_secret":sys.argv[3],"refresh_token":rt}, open("secrets/firebase-refresh.json","w"))
print("wrote secrets/firebase-refresh.json for", cs.get("user",{}).get("email"))
PY
chmod 600 secrets/firebase-refresh.json
