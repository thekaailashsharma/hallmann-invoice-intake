#!/usr/bin/env bash
# One-shot setup: start the stack, create n8n credentials from .env, import + activate workflows.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "copy .env.example to .env and fill SARVAM_API_KEY"; exit 1; }
set -a; . ./.env; set +a
cp shared/validate.js app/validate.js
N8N_CONTAINER="${N8N_CONTAINER:-intake-n8n}"; N8N_URL="${N8N_URL:-http://localhost:5681}"; PG_HOST_FOR_N8N="${PG_HOST_FOR_N8N:-postgres}"; PG_PORT_FOR_N8N="${PG_PORT_FOR_N8N:-5432}"
if [ "$N8N_CONTAINER" = "intake-n8n" ]; then docker compose up -d --build; else docker compose up -d --build postgres review; fi
for i in $(seq 1 90); do curl -sf "$N8N_URL/healthz" >/dev/null && break; sleep 1; done
TMP=$(mktemp -d)
cat > "$TMP/creds.json" <<JSON
[
 {"id":"IntakePostgres001","name":"Intake Postgres","type":"postgres","data":{"host":"${PG_HOST_FOR_N8N}","port":${PG_PORT_FOR_N8N},"database":"intake","user":"intake","password":"${POSTGRES_PASSWORD:-intake}","ssl":"disable","allowUnauthorizedCerts":false}},
 {"id":"IntakeLlmOpenAi01","name":"LLM (OpenAI-compatible: Sarvam-105B)","type":"openAiApi","data":{"apiKey":"${SARVAM_API_KEY}","url":"${LLM_BASE_URL:-https://api.sarvam.ai/v1}","organizationId":"","header":false}}
]
JSON
chmod 644 "$TMP/creds.json"
docker cp "$TMP/creds.json" "$N8N_CONTAINER:/tmp/creds.json"
docker exec "$N8N_CONTAINER" n8n import:credentials --input=/tmp/creds.json | grep -i success
docker exec -u root "$N8N_CONTAINER" rm -f /tmp/creds.json; rm -rf "$TMP"
docker exec intake-postgres psql -U intake -d intake -q -c "insert into app_settings (key, value) values ('super_admin_key', crypt('${SUPER_ADMIN_KEY}', gen_salt('bf'))) on conflict (key) do update set value = excluded.value, updated_at = now()"
python3 scripts/import-workflows.py
echo "→ n8n:    $N8N_URL"
echo "→ review: http://localhost:3001"
