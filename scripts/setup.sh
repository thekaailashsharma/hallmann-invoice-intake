#!/usr/bin/env bash
# One-shot setup: start the stack, create n8n credentials from .env, import + activate workflows.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "copy .env.example to .env and fill SARVAM_API_KEY"; exit 1; }
set -a; . ./.env; set +a
cp shared/validate.js app/validate.js
N8N_CONTAINER="${N8N_CONTAINER:-intake-n8n}"; N8N_URL="${N8N_URL:-http://localhost:5681}"; PG_HOST_FOR_N8N="${PG_HOST_FOR_N8N:-postgres}"; PG_PORT_FOR_N8N="${PG_PORT_FOR_N8N:-5432}"
if [ "$N8N_CONTAINER" = "intake-n8n" ]; then docker compose up -d --build; else docker compose up -d --build postgres mailbox erp review; fi
for i in $(seq 1 90); do curl -sf "$N8N_URL/healthz" >/dev/null && break; sleep 1; done
for f in db/init/*.sql; do docker exec -i intake-postgres psql -U intake -d intake -q < "$f" 2>/dev/null || true; done   # idempotent migrations
python3 scripts/build-workflows.py   # bakes this machine's ERP URL / Gmail query into the workflow files
python3 scripts/import-workflows.py
echo "→ n8n:    $N8N_URL"
echo "→ review: http://localhost:3001"
