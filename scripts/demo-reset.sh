#!/usr/bin/env bash
# Wipe all invoices/emails/bookings/alerts/audit (users and suppliers stay) and load the hands-on test set.
set -euo pipefail; cd "$(dirname "$0")/.."
docker exec intake-postgres psql -U intake -d intake -q -c "set session_replication_role = replica; truncate audit_log, alerts, erp_invoices, attachments, documents, inbound_emails restart identity cascade; update erp_status set available = true, note = 'ERP online';"
bash scripts/erp.sh up >/dev/null
python3 scripts/send-emails.py --file fixtures/demo-emails.json --fresh
echo "Loaded. Give it a minute, then open http://localhost:3001"
