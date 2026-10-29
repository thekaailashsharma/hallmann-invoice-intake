#!/usr/bin/env bash
# One-shot setup: start the stack, create n8n credentials from .env, import + activate workflows.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "copy .env.example to .env and fill SARVAM_API_KEY"; exit 1; }
set -a; . ./.env; set +a
cp shared/validate.js app/validate.js
docker compose up -d --build
for i in $(seq 1 90); do curl -sf http://localhost:5681/healthz >/dev/null && break; sleep 1; done
TMP=$(mktemp -d)
cat > "$TMP/creds.json" <<JSON
[
 {"id":"IntakePostgres001","name":"Intake Postgres","type":"postgres","data":{"host":"postgres","port":5432,"database":"intake","user":"intake","password":"${POSTGRES_PASSWORD:-intake}","ssl":"disable","allowUnauthorizedCerts":false}},
 {"id":"IntakeLlmOpenAi01","name":"LLM (OpenAI-compatible: Sarvam-105B)","type":"openAiApi","data":{"apiKey":"${SARVAM_API_KEY}","url":"${LLM_BASE_URL:-https://api.sarvam.ai/v1}","organizationId":"","header":false}}
]
JSON
chmod 644 "$TMP/creds.json"
docker cp "$TMP/creds.json" intake-n8n:/tmp/creds.json
docker exec intake-n8n n8n import:credentials --input=/tmp/creds.json | grep -i success
docker exec -u root intake-n8n rm -f /tmp/creds.json; rm -rf "$TMP"
python3 scripts/import-workflows.py
echo "→ n8n:    http://localhost:5681   (create the owner account on first visit)"
echo "→ review: http://localhost:3001"
